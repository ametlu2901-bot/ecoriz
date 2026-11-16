const { pool } = require('../config/db');

const historialRepository = {
  /** D-06: solo se agregan filas; nunca se modifican ni se borran. */
  async agregar(db, { reporteId, responsableId, estadoAnterior, estadoNuevo, decision, observacion }) {
    const r = await db.query(
      `INSERT INTO historial_estado (reporte_id, responsable_id, estado_anterior, estado_nuevo, decision, observacion)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [reporteId, responsableId, estadoAnterior, estadoNuevo, decision, observacion]
    );
    return r.rows[0];
  },
  async listarPorReporte(reporteId, db = pool) {
    const r = await db.query(
      `SELECT h.id, h.estado_anterior AS "estadoAnterior", h.estado_nuevo AS "estadoNuevo", h.decision,
              h.observacion, h.fecha, u.nombre AS responsable
         FROM historial_estado h JOIN usuario u ON u.id = h.responsable_id
        WHERE h.reporte_id = $1 ORDER BY h.fecha, h.id`,
      [reporteId]
    );
    return r.rows;
  },
};

module.exports = historialRepository;
