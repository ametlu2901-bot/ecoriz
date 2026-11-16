const { pool } = require('../config/db');

const evidenciaRepository = {
  async crear(db, { reporteId, rutaArchivo, tipoMime, tamanoBytes }) {
    const r = await db.query(
      `INSERT INTO evidencia (reporte_id, ruta_archivo, tipo_mime, tamano_bytes)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [reporteId, rutaArchivo, tipoMime, tamanoBytes]
    );
    return r.rows[0];
  },
  async listarPorReporte(reporteId, db = pool) {
    const r = await db.query(
      `SELECT id, ruta_archivo AS "rutaArchivo", tipo_mime AS "tipoMime" FROM evidencia WHERE reporte_id = $1 ORDER BY id`,
      [reporteId]
    );
    return r.rows;
  },
};

module.exports = evidenciaRepository;
