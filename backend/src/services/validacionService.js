const { AppError, ValidationError } = require('../utils/errors');
const { validarDecision } = require('../utils/validators');

// Figura 7: transiciones permitidas desde PENDIENTE. Cualquier otra se rechaza.
const TRANSICIONES = {
  PENDIENTE: { VALIDAR: 'VALIDADO', RECHAZAR: 'RECHAZADO', DUPLICADO: 'DUPLICADO', SEGUIMIENTO: 'PENDIENTE' },
};

/** ValidacionService (CU-02 · RF-03): verifica transición, exige observación y controla la versión (D-07). */
function crearValidacionService({ reporteRepo, historialRepo, withTransaction }) {
  return {
    TRANSICIONES,

    async decidir(usuario, reporteId, body) {
      const errores = validarDecision(body);
      if (errores.length) throw new ValidationError(errores);
      const version = Number(body.version);

      return withTransaction(async (db) => {
        const reporte = await reporteRepo.buscarPorId(reporteId, db, { bloquear: true });
        if (!reporte) throw new AppError(404, 'NO_ENCONTRADO', 'El reporte no existe.');

        // E2: otra persona decidió primero → debe recargar y decidir de nuevo
        if (reporte.version !== version) {
          throw new AppError(409, 'VERSION_DESACTUALIZADA',
            'Otra persona modificó este reporte. Recárgalo y decide de nuevo.', { versionActual: reporte.version });
        }

        const estadoNuevo = (TRANSICIONES[reporte.estado] || {})[body.decision];
        if (!estadoNuevo) {
          throw new AppError(422, 'TRANSICION_INVALIDA',
            `Un reporte en estado ${reporte.estado} no admite la decisión ${body.decision}.`);
        }

        let duplicadoDeId = null;
        if (body.decision === 'DUPLICADO') {
          const original = body.duplicadoDeCodigo
            ? await reporteRepo.buscarPorCodigo(String(body.duplicadoDeCodigo).trim(), db)
            : await reporteRepo.buscarPorId(Number(body.duplicadoDeId), db);
          if (!original) {
            throw new ValidationError([{ campo: 'duplicadoDeCodigo', motivo: 'No existe un reporte con ese código.' }]);
          }
          if (original.id === reporte.id) {
            throw new ValidationError([{ campo: 'duplicadoDeCodigo', motivo: 'Un reporte no puede ser duplicado de sí mismo.' }]);
          }
          duplicadoDeId = original.id;
        }

        const actualizado = await reporteRepo.actualizarEstado(db, {
          id: reporte.id, version, estadoNuevo, prioridad: body.prioridad || null, duplicadoDeId,
        });
        if (!actualizado) {
          throw new AppError(409, 'VERSION_DESACTUALIZADA', 'Otra persona modificó este reporte. Recárgalo y decide de nuevo.');
        }

        await historialRepo.agregar(db, {
          reporteId: reporte.id, responsableId: usuario.id, estadoAnterior: reporte.estado, estadoNuevo,
          decision: body.decision, observacion: String(body.observacion).trim(),
        });
        return actualizado;
      });
    },
  };
}

module.exports = { crearValidacionService, TRANSICIONES };
