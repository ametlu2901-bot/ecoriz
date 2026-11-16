const { AppError, ValidationError } = require('../utils/errors');
const { validarJornada } = require('../utils/validators');

const vacio = (v) => v === undefined || v === null || String(v).trim() === '';
const texto = (v) => (vacio(v) ? null : String(v).trim());

/** Convierte el cuerpo de la petición (o una jornada guardada) en datos normalizados. */
function normalizar(b) {
  return {
    reporteId: vacio(b.reporteId) ? null : Number(b.reporteId),
    organizacionId: vacio(b.organizacionId) ? null : Number(b.organizacionId),
    titulo: texto(b.titulo),
    tipo: texto(b.tipo) || 'LIMPIEZA',
    fechaHora: b.fechaHora instanceof Date ? b.fechaHora.toISOString() : texto(b.fechaHora),
    puntoEncuentro: texto(b.puntoEncuentro),
    detalles: texto(b.detalles),
    zona: texto(b.zona),
    justificacionZona: texto(b.justificacionZona),
  };
}

/** JornadaService (CU-03 · RF-05, RF-06, RF-08). */
function crearJornadaService({ jornadaRepo, reporteRepo, historialRepo, organizacionRepo, withTransaction, ahora = () => new Date() }) {
  function validar(datos, publicar) {
    const errores = validarJornada(datos, { publicar, ahora: ahora() });
    if (Number.isNaN(datos.reporteId)) errores.push({ campo: 'reporteId', motivo: 'El reporte indicado no es válido.' });
    if (Number.isNaN(datos.organizacionId)) errores.push({ campo: 'organizacionId', motivo: 'La organización indicada no es válida.' });
    if (errores.length) throw new ValidationError(errores);
  }

  async function verificarOrganizacion(datos) {
    if (datos.organizacionId !== null && !(await organizacionRepo.buscarPorId(datos.organizacionId))) {
      throw new ValidationError([{ campo: 'organizacionId', motivo: 'La organización no existe.' }]);
    }
  }

  /** A3: justo antes de guardar se vuelve a consultar el reporte; pudo cerrarse o invalidarse. */
  async function verificarReporteDisponible(db, reporteId) {
    if (reporteId === null) return;
    const reporte = await reporteRepo.buscarPorId(reporteId, db, { bloquear: true });
    if (!reporte || reporte.estado !== 'VALIDADO') {
      throw new AppError(422, 'REPORTE_NO_DISPONIBLE',
        'El reporte ya no está validado (pudo cerrarse o invalidarse). Elige otro reporte o justifica la jornada por zona.');
    }
  }

  const puedeGestionar = (usuario, jornada) =>
    jornada.creadorId === usuario.id || (jornada.organizacionId !== null && jornada.organizacionId === usuario.organizacionId);

  return {
    /** accion = 'PUBLICAR' (por defecto) o 'BORRADOR' (A1). */
    async crear(usuario, body) {
      const publicar = body.accion !== 'BORRADOR';
      const datos = normalizar(body);
      validar(datos, publicar);
      await verificarOrganizacion(datos);

      return withTransaction(async (db) => {
        await verificarReporteDisponible(db, datos.reporteId);
        return jornadaRepo.crear(db, { ...datos, creadorId: usuario.id, estado: publicar ? 'PUBLICADA' : 'BORRADOR' });
      });
    },

    /** A1: edita un borrador. Solo su creador, y solo mientras siga siendo borrador. */
    async actualizar(usuario, id, body) {
      const actual = await jornadaRepo.buscarPorId(id);
      if (!actual) throw new AppError(404, 'NO_ENCONTRADO', 'La jornada no existe.');
      if (actual.creadorId !== usuario.id) throw new AppError(403, 'PROHIBIDO', 'Solo quien creó la jornada puede editarla.');
      if (actual.estado !== 'BORRADOR') throw new AppError(409, 'NO_ES_BORRADOR', 'La jornada ya no es un borrador.');

      const datos = normalizar(body);
      validar(datos, false);
      await verificarOrganizacion(datos);

      return withTransaction(async (db) => {
        await verificarReporteDisponible(db, datos.reporteId);
        const r = await jornadaRepo.actualizarBorrador(db, id, datos);
        if (!r) throw new AppError(409, 'NO_ES_BORRADOR', 'La jornada ya no es un borrador.');
        return r;
      });
    },

    /** Publica un borrador guardado: se vuelve a validar todo (fecha futura, reporte aún validado...). */
    async publicar(usuario, id) {
      return withTransaction(async (db) => {
        const jornada = await jornadaRepo.buscarPorId(id, db, { bloquear: true });
        if (!jornada) throw new AppError(404, 'NO_ENCONTRADO', 'La jornada no existe.');
        if (!puedeGestionar(usuario, jornada)) throw new AppError(403, 'PROHIBIDO', 'No puedes publicar esta jornada.');
        if (jornada.estado !== 'BORRADOR') throw new AppError(409, 'NO_ES_BORRADOR', 'La jornada ya no es un borrador.');

        const datos = normalizar(jornada);
        validar(datos, true);
        await verificarReporteDisponible(db, datos.reporteId);
        const r = await jornadaRepo.publicar(db, id, datos);
        if (!r) throw new AppError(409, 'NO_ES_BORRADOR', 'La jornada ya no es un borrador.');
        return r;
      });
    },

    /** RF-06: jornadas disponibles. Los borradores solo se muestran a su creador. */
    async listar(usuario, { estado } = {}) {
      const e = estado || 'PUBLICADA';
      if (!['BORRADOR', 'PUBLICADA', 'CERRADA'].includes(e)) {
        throw new ValidationError([{ campo: 'estado', motivo: 'Estado no válido.' }]);
      }
      return jornadaRepo.listar({ estado: e, creadorId: e === 'BORRADOR' ? usuario.id : null });
    },

    /**
     * RF-08: cierre. En la misma transacción se guarda el resultado y la fecha de cierre
     * y el reporte vinculado pasa de VALIDADO a CERRADO (Figura 7).
     */
    async cerrar(usuario, id, body = {}) {
      if (vacio(body.resultado)) throw new ValidationError([{ campo: 'resultado', motivo: 'El resultado es obligatorio.' }]);

      return withTransaction(async (db) => {
        const jornada = await jornadaRepo.buscarPorId(id, db, { bloquear: true });
        if (!jornada) throw new AppError(404, 'NO_ENCONTRADO', 'La jornada no existe.');
        if (jornada.organizacionId === null || jornada.organizacionId !== usuario.organizacionId) {
          throw new AppError(403, 'PROHIBIDO', 'Solo la organización responsable puede cerrar la jornada.');
        }
        if (jornada.estado !== 'PUBLICADA') throw new AppError(409, 'NO_ESTA_PUBLICADA', 'Solo se puede cerrar una jornada publicada.');

        const resultado = String(body.resultado).trim();
        const cerrada = await jornadaRepo.cerrar(db, id, resultado);
        if (!cerrada) throw new AppError(409, 'NO_ESTA_PUBLICADA', 'Solo se puede cerrar una jornada publicada.');

        if (jornada.reporteId !== null) {
          const reporte = await reporteRepo.buscarPorId(jornada.reporteId, db, { bloquear: true });
          if (reporte && reporte.estado === 'VALIDADO') {
            await reporteRepo.actualizarEstado(db, { id: reporte.id, version: reporte.version, estadoNuevo: 'CERRADO' });
            await historialRepo.agregar(db, {
              reporteId: reporte.id, responsableId: usuario.id, estadoAnterior: 'VALIDADO', estadoNuevo: 'CERRADO',
              decision: 'CIERRE_JORNADA', observacion: `Jornada "${jornada.titulo}" cerrada: ${resultado}`,
            });
          }
        }
        return cerrada;
      });
    },
  };
}

module.exports = { crearJornadaService };
