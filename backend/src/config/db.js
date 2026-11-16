require('dotenv').config();
const { Pool, types } = require('pg');

// NUMERIC (1700) y BIGINT (20) llegan como texto por defecto; los convertimos a número.
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Ejecuta fn(client) dentro de una transacción: COMMIT si termina bien, ROLLBACK si lanza error (D-03). */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* conexión ya caída */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };
