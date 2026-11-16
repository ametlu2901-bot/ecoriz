const { pool } = require('../config/db');

const organizacionRepository = {
  async listar(db = pool) {
    const r = await db.query('SELECT id, nombre, tipo, verificada FROM organizacion ORDER BY nombre');
    return r.rows;
  },
  async buscarPorId(id, db = pool) {
    const r = await db.query('SELECT id, nombre, tipo, verificada FROM organizacion WHERE id = $1', [id]);
    return r.rows[0] || null;
  },
};

module.exports = organizacionRepository;
