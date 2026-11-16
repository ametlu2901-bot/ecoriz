// Crea las tablas. Uso: npm run db:init   (o npm run db:reset para borrar y recrear)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function main() {
  const dir = path.join(__dirname, '..', 'database');
  if (process.argv.includes('--reset')) {
    await pool.query(fs.readFileSync(path.join(dir, 'reset.sql'), 'utf8'));
    console.log('Tablas anteriores eliminadas.');
  }
  await pool.query(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));
  console.log('Esquema creado correctamente.');
}

main()
  .catch((e) => { console.error('Error creando el esquema:', e.message); process.exitCode = 1; })
  .finally(() => pool.end());
