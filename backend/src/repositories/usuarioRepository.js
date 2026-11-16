const { pool } = require('../config/db');

const COLS = `id, nombre, correo, hash_contrasena AS "hashContrasena", rol, organizacion_id AS "organizacionId", activo`;

const usuarioRepository = {
  async buscarPorCorreo(correo, db = pool) {
    const r = await db.query(`SELECT ${COLS} FROM usuario WHERE lower(correo) = lower($1)`, [correo]);
    return r.rows[0] || null;
  },
  async buscarPorId(id, db = pool) {
    const r = await db.query(`SELECT ${COLS} FROM usuario WHERE id = $1`, [id]);
    return r.rows[0] || null;
  },
};

module.exports = usuarioRepository;
