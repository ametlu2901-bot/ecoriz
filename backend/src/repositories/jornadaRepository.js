const { pool } = require('../config/db');

const COLS = `j.id, j.reporte_id AS "reporteId", j.organizacion_id AS "organizacionId", j.creador_id AS "creadorId",
  j.titulo, j.tipo, j.fecha_hora AS "fechaHora", j.punto_encuentro AS "puntoEncuentro", j.detalles,
  j.zona, j.justificacion_zona AS "justificacionZona", j.estado, j.resultado, j.fecha_cierre AS "fechaCierre"`;

const jornadaRepository = {
  async crear(db, d) {
    const r = await db.query(
      `INSERT INTO jornada (reporte_id, organizacion_id, creador_id, titulo, tipo, fecha_hora, punto_encuentro,
                            detalles, zona, justificacion_zona, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, estado`,
      [d.reporteId, d.organizacionId, d.creadorId, d.titulo, d.tipo, d.fechaHora, d.puntoEncuentro,
       d.detalles, d.zona, d.justificacionZona, d.estado]
    );
    return r.rows[0];
  },

  async buscarPorId(id, db = pool, { bloquear = false } = {}) {
    const r = await db.query(`SELECT ${COLS} FROM jornada j WHERE j.id = $1 ${bloquear ? 'FOR UPDATE' : ''}`, [id]);
    return r.rows[0] || null;
  },

  /** Actualiza los datos de un borrador (A1). */
  async actualizarBorrador(db, id, d) {
    const r = await db.query(
      `UPDATE jornada SET reporte_id=$2, organizacion_id=$3, titulo=$4, tipo=$5, fecha_hora=$6,
              punto_encuentro=$7, detalles=$8, zona=$9, justificacion_zona=$10
        WHERE id = $1 AND estado = 'BORRADOR' RETURNING id, estado`,
      [id, d.reporteId, d.organizacionId, d.titulo, d.tipo, d.fechaHora, d.puntoEncuentro,
       d.detalles, d.zona, d.justificacionZona]
    );
    return r.rows[0] || null;
  },

  async publicar(db, id, d) {
    const r = await db.query(
      `UPDATE jornada SET estado='PUBLICADA', reporte_id=$2, organizacion_id=$3, titulo=$4, tipo=$5, fecha_hora=$6,
              punto_encuentro=$7, detalles=$8, zona=$9, justificacion_zona=$10
        WHERE id = $1 AND estado = 'BORRADOR' RETURNING id, estado`,
      [id, d.reporteId, d.organizacionId, d.titulo, d.tipo, d.fechaHora, d.puntoEncuentro,
       d.detalles, d.zona, d.justificacionZona]
    );
    return r.rows[0] || null;
  },

  async cerrar(db, id, resultado) {
    const r = await db.query(
      `UPDATE jornada SET estado='CERRADA', resultado=$2, fecha_cierre=now()
        WHERE id = $1 AND estado = 'PUBLICADA' RETURNING id, estado, fecha_cierre AS "fechaCierre"`,
      [id, resultado]
    );
    return r.rows[0] || null;
  },

  /** RF-06: jornadas por estado. Los borradores solo los ve su creador (creadorId). */
  async listar({ estado, creadorId }, db = pool) {
    const params = [estado];
    let filtroCreador = '';
    if (creadorId) { params.push(creadorId); filtroCreador = 'AND j.creador_id = $2'; }
    const r = await db.query(
      `SELECT ${COLS}, o.nombre AS "organizacionNombre", rp.codigo AS "reporteCodigo"
         FROM jornada j
         LEFT JOIN organizacion o ON o.id = j.organizacion_id
         LEFT JOIN reporte rp ON rp.id = j.reporte_id
        WHERE j.estado = $1 ${filtroCreador}
        ORDER BY j.fecha_hora NULLS LAST, j.id`,
      params
    );
    return r.rows;
  },
};

module.exports = jornadaRepository;
