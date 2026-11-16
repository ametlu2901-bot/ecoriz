const { AppError, ValidationError } = require('../utils/errors');
const { validarNuevoReporte, validarCoordenadas } = require('../utils/validators');

const ESTADOS = ['PENDIENTE', 'VALIDADO', 'RECHAZADO', 'DUPLICADO', 'CERRADO'];
const ROLES_VALIDADORES = ['ENTIDAD', 'ORGANIZACION'];

/**
 * ReporteService (CU-01 y consultas de CU-02/CU-03).
 * Las dependencias se inyectan para poder probar las reglas sin base de datos.
 */
function crearReporteService({
  reporteRepo, evidenciaRepo, historialRepo, usuarioRepo, evidenciaStorage, withTransaction, radioDuplicadoM = 100,
}) {
  const urlFoto = (e) => ({ id: e.id, tipoMime: e.tipoMime, url: `/uploads/${e.rutaArchivo}` });

  return {
    /** CU-01 · A3: avisa de reportes abiertos cerca. Solo devuelve datos no personales (RNF-05). */
    async cercanos({ lat, lng }) {
      const errores = validarCoordenadas(lat, lng);
      if (errores.length) throw new ValidationError(errores.map((e) => ({ ...e, campo: e.campo === 'latitud' ? 'lat' : 'lng' })));
      const filas = await reporteRepo.listarAbiertosCerca(Number(lat), Number(lng), radioDuplicadoM);
      return {
        radioM: radioDuplicadoM,
        reportes: filas.map((r) => ({
          id: r.id, codigo: r.codigo, estado: r.estado, latitud: r.latitud, longitud: r.longitud,
          distanciaM: Math.round(r.distancia),
          fechaCreacion: r.fechaCreacion,
        })),
      };
    },

    /**
     * CU-01 · flujo principal. D-04: primero se guarda la foto; si la transacción falla, se borra.
     * D-03: reporte + evidencia + historial se guardan juntos o no se guarda nada (E1, E2).
     */
    async registrar(usuario, datos, foto) {
      const errores = validarNuevoReporte(datos, foto);
      if (errores.length) throw new ValidationError(errores);

      const nombreArchivo = await evidenciaStorage.guardar(foto.buffer, foto.mimetype);
      try {
        return await withTransaction(async (db) => {
          const reporte = await reporteRepo.crear(db, {
            usuarioId: usuario.id,
            tipoResiduo: datos.tipoResiduo || null,
            descripcion: String(datos.descripcion).trim(),
            latitud: Number(datos.latitud),
            longitud: Number(datos.longitud),
          });
          await evidenciaRepo.crear(db, {
            reporteId: reporte.id, rutaArchivo: nombreArchivo, tipoMime: foto.mimetype, tamanoBytes: foto.size,
          });
          await historialRepo.agregar(db, {
            reporteId: reporte.id, responsableId: usuario.id, estadoAnterior: null,
            estadoNuevo: 'PENDIENTE', decision: 'REGISTRO', observacion: 'Reporte registrado por el ciudadano',
          });
          return { id: reporte.id, codigo: reporte.codigo, estado: reporte.estado };
        });
      } catch (err) {
        await evidenciaStorage.eliminar(nombreArchivo);
        throw err;
      }
    },

    /** RNF-05: los datos personales dependen del rol; un ciudadano nunca ve quién reportó un reporte ajeno. */
    async obtener(usuario, id) {
      const reporte = await reporteRepo.buscarPorId(id);
      if (!reporte) throw new AppError(404, 'NO_ENCONTRADO', 'El reporte no existe.');

      const esPropio = reporte.usuarioId === usuario.id;
      const esValidador = ROLES_VALIDADORES.includes(usuario.rol);
      const evidencias = (await evidenciaRepo.listarPorReporte(id)).map(urlFoto);

      const respuesta = {
        id: reporte.id, codigo: reporte.codigo, tipoResiduo: reporte.tipoResiduo, descripcion: reporte.descripcion,
        latitud: reporte.latitud, longitud: reporte.longitud, estado: reporte.estado, prioridad: reporte.prioridad,
        duplicadoDeId: reporte.duplicadoDeId, version: reporte.version, fechaCreacion: reporte.fechaCreacion,
        evidencias, esPropio,
      };

      if (esPropio || esValidador) {
        const autor = await usuarioRepo.buscarPorId(reporte.usuarioId);
        if (autor) respuesta.reportante = esPropio ? { nombre: autor.nombre, correo: autor.correo } : { nombre: autor.nombre };
      }
      if (esValidador) {
        const cerca = await reporteRepo.listarAbiertosCerca(reporte.latitud, reporte.longitud, radioDuplicadoM, { excluirId: reporte.id });
        respuesta.cercanos = cerca.map((r) => ({
          id: r.id, codigo: r.codigo, estado: r.estado, latitud: r.latitud, longitud: r.longitud, distanciaM: Math.round(r.distancia),
        }));
      }
      return respuesta;
    },

    /** CU-02: bandeja paginada con filtros. */
    async listar(query) {
      const errores = [];
      const filtros = {};
      if (query.estado) {
        if (ESTADOS.includes(query.estado)) filtros.estado = query.estado;
        else errores.push({ campo: 'estado', motivo: 'Estado no válido.' });
      }
      if (query.tipo) filtros.tipo = String(query.tipo);
      if (query.fecha) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(query.fecha)) filtros.fecha = query.fecha;
        else errores.push({ campo: 'fecha', motivo: 'Usa el formato AAAA-MM-DD.' });
      }
      if (query.zona) {
        const [lat, lng, radio] = String(query.zona).split(',').map(Number);
        if ([lat, lng, radio].every(Number.isFinite) && radio > 0) filtros.zona = { latitud: lat, longitud: lng, radioM: radio };
        else errores.push({ campo: 'zona', motivo: 'Usa el formato lat,lng,radioEnMetros.' });
      }
      const pagina = query.pagina === undefined ? 1 : Number(query.pagina);
      if (!Number.isInteger(pagina) || pagina < 1) errores.push({ campo: 'pagina', motivo: 'La página debe ser un entero positivo.' });
      if (errores.length) throw new ValidationError(errores);

      const resultado = await reporteRepo.listar({ ...filtros, pagina });
      return {
        ...resultado,
        items: resultado.items.map((r) => ({
          id: r.id, codigo: r.codigo, tipoResiduo: r.tipoResiduo, descripcion: r.descripcion, estado: r.estado,
          prioridad: r.prioridad, latitud: r.latitud, longitud: r.longitud, fechaCreacion: r.fechaCreacion,
          fotoUrl: r.fotoRuta ? `/uploads/${r.fotoRuta}` : null,
        })),
      };
    },

    /** RF-02: historial de decisiones. Lo ve el dueño del reporte y los validadores. */
    async historial(usuario, id) {
      const reporte = await reporteRepo.buscarPorId(id);
      if (!reporte) throw new AppError(404, 'NO_ENCONTRADO', 'El reporte no existe.');
      if (reporte.usuarioId !== usuario.id && !ROLES_VALIDADORES.includes(usuario.rol)) {
        throw new AppError(403, 'PROHIBIDO', 'No puedes ver el historial de este reporte.');
      }
      return historialRepo.listarPorReporte(id);
    },
  };
}

module.exports = { crearReporteService, ESTADOS };
