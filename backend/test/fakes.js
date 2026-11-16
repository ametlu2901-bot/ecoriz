// Repositorios en memoria para probar las reglas de negocio sin PostgreSQL.
function crearMundo() {
  const estado = {
    reportes: [], evidencias: [], historial: [], jornadas: [], seq: { reporte: 0, jornada: 0 },
    organizaciones: [{ id: 1, nombre: 'Alcaldía' }, { id: 2, nombre: 'Fundación' }],
    fotosEnDisco: new Set(),
  };

  const withTransaction = async (fn) => {
    const { fotosEnDisco, ...datos } = estado; // las fotos están fuera de la transacción (D-04)
    const copia = structuredClone(datos);
    try { return await fn({}); } catch (e) {
      Object.assign(estado, copia); // ROLLBACK
      throw e;
    }
  };

  const reporteRepo = {
    async crear(_db, d) {
      const id = ++estado.seq.reporte;
      const r = { id, codigo: `RPT-${String(id).padStart(4, '0')}`, usuarioId: d.usuarioId, tipoResiduo: d.tipoResiduo,
        descripcion: d.descripcion, latitud: d.latitud, longitud: d.longitud, estado: 'PENDIENTE', prioridad: null,
        duplicadoDeId: null, version: 1, fechaCreacion: new Date() };
      estado.reportes.push(r);
      return { id, codigo: r.codigo, estado: r.estado, version: 1 };
    },
    async buscarPorId(id) { return estado.reportes.find((r) => r.id === id) ? { ...estado.reportes.find((r) => r.id === id) } : null; },
    async buscarPorCodigo(c) { const r = estado.reportes.find((x) => x.codigo === c.toUpperCase()); return r ? { ...r } : null; },
    async listarAbiertosCerca() { return []; },
    async actualizarEstado(_db, { id, version, estadoNuevo, prioridad, duplicadoDeId }) {
      const r = estado.reportes.find((x) => x.id === id && x.version === version);
      if (!r) return null;
      r.estado = estadoNuevo; r.prioridad = prioridad || r.prioridad; r.duplicadoDeId = duplicadoDeId || r.duplicadoDeId; r.version += 1;
      return { ...r };
    },
  };
  const evidenciaRepo = {
    async crear(_db, d) { estado.evidencias.push(d); return { id: estado.evidencias.length }; },
    async listarPorReporte() { return []; },
  };
  const historialRepo = {
    async agregar(_db, d) { estado.historial.push(d); return { id: estado.historial.length }; },
    async listarPorReporte(id) { return estado.historial.filter((h) => h.reporteId === id); },
  };
  const usuarioRepo = { async buscarPorId() { return null; } };
  const organizacionRepo = { async buscarPorId(id) { return estado.organizaciones.find((o) => o.id === id) || null; } };
  const jornadaRepo = {
    async crear(_db, d) { const id = ++estado.seq.jornada; estado.jornadas.push({ ...d, id }); return { id, estado: d.estado }; },
    async buscarPorId(id) { const j = estado.jornadas.find((x) => x.id === id); return j ? { ...j } : null; },
    async actualizarBorrador(_db, id, d) { const j = estado.jornadas.find((x) => x.id === id && x.estado === 'BORRADOR'); if (!j) return null; Object.assign(j, d); return { id, estado: j.estado }; },
    async publicar(_db, id, d) { const j = estado.jornadas.find((x) => x.id === id && x.estado === 'BORRADOR'); if (!j) return null; Object.assign(j, d, { estado: 'PUBLICADA' }); return { id, estado: 'PUBLICADA' }; },
    async cerrar(_db, id, resultado) { const j = estado.jornadas.find((x) => x.id === id && x.estado === 'PUBLICADA'); if (!j) return null; j.estado = 'CERRADA'; j.resultado = resultado; return { id, estado: 'CERRADA' }; },
    async listar({ estado: e, creadorId }) { return estado.jornadas.filter((j) => j.estado === e && (!creadorId || j.creadorId === creadorId)); },
  };
  const evidenciaStorage = {
    directorio: '/tmp',
    async guardar() { const n = `foto-${estado.fotosEnDisco.size + 1}.png`; estado.fotosEnDisco.add(n); return n; },
    async eliminar(n) { estado.fotosEnDisco.delete(n); },
  };
  return { estado, withTransaction, reporteRepo, evidenciaRepo, historialRepo, usuarioRepo, organizacionRepo, jornadaRepo, evidenciaStorage };
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const fotoPng = (extra = {}) => ({ buffer: PNG, mimetype: 'image/png', size: PNG.length, ...extra });

module.exports = { crearMundo, fotoPng };
