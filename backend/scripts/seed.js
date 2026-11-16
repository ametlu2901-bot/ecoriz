// Datos de demostración. Uso: npm run db:seed (después de db:init)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../src/config/db');

const CLAVE_DEMO = 'Ecoriz2026!';
// PNG de 1x1 píxel para que las fotos de demostración existan en disco
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function main() {
  const uploads = path.join(__dirname, '..', 'uploads');
  fs.mkdirSync(uploads, { recursive: true });
  fs.writeFileSync(path.join(uploads, 'demo.png'), Buffer.from(PNG_BASE64, 'base64'));
  const hash = await bcrypt.hash(CLAVE_DEMO, 10);

  await withTransaction(async (c) => {
    const org = async (nombre, tipo) =>
      (await c.query('INSERT INTO organizacion (nombre, tipo, verificada) VALUES ($1,$2,TRUE) RETURNING id', [nombre, tipo])).rows[0].id;
    const alcaldia = await org('Alcaldía de Panamá', 'ENTIDAD');
    const fundacion = await org('Fundación Panamá Recicla', 'ORGANIZACION');
    await org('UTP Eco', 'UNIVERSIDAD');

    const usuario = async (nombre, correo, rol, orgId) =>
      (await c.query(
        'INSERT INTO usuario (nombre, correo, hash_contrasena, rol, organizacion_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [nombre, correo, hash, rol, orgId]
      )).rows[0].id;
    const ciudadano = await usuario('Carla Ciudadana', 'ciudadano@ecoriz.test', 'CIUDADANO', null);
    const otroCiudadano = await usuario('Mario Vecino', 'ciudadano2@ecoriz.test', 'CIUDADANO', null);
    const entidad = await usuario('Elena Entidad', 'entidad@ecoriz.test', 'ENTIDAD', alcaldia);
    await usuario('Oscar Organización', 'organizacion@ecoriz.test', 'ORGANIZACION', fundacion);

    const reporte = async (uid, tipo, desc, lat, lng, estado, prioridad) => {
      const r = (await c.query(
        `INSERT INTO reporte (codigo, usuario_id, tipo_residuo, descripcion, latitud, longitud, estado, prioridad)
         VALUES ('RPT-' || lpad(nextval('reporte_codigo_seq')::text, 4, '0'), $1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [uid, tipo, desc, lat, lng, estado, prioridad]
      )).rows[0].id;
      await c.query(
        `INSERT INTO evidencia (reporte_id, ruta_archivo, tipo_mime, tamano_bytes) VALUES ($1,'demo.png','image/png',70)`, [r]);
      await c.query(
        `INSERT INTO historial_estado (reporte_id, responsable_id, estado_anterior, estado_nuevo, decision, observacion)
         VALUES ($1,$2,NULL,'PENDIENTE','REGISTRO','Reporte registrado por el ciudadano')`, [r, uid]);
      if (estado !== 'PENDIENTE') {
        await c.query(
          `INSERT INTO historial_estado (reporte_id, responsable_id, estado_anterior, estado_nuevo, decision, observacion)
           VALUES ($1,$2,'PENDIENTE',$3,'VALIDAR','Validado en datos de demostración')`, [r, entidad, estado]);
        await c.query('UPDATE reporte SET version = version + 1 WHERE id = $1', [r]);
      }
      return r;
    };
    await reporte(ciudadano, 'PLASTICO', 'Bolsas y botellas acumuladas junto a la quebrada', 8.98340, -79.51980, 'PENDIENTE', null);
    await reporte(otroCiudadano, 'ESCOMBROS', 'Escombros de construcción en la esquina', 8.98350, -79.51990, 'PENDIENTE', null);
    await reporte(ciudadano, 'ORGANICO', 'Basura orgánica en el lote baldío', 8.99100, -79.52500, 'PENDIENTE', null);
    await reporte(otroCiudadano, 'VIDRIO', 'Vidrios rotos frente a la escuela', 8.97200, -79.53600, 'VALIDADO', 'ALTA');
    await reporte(ciudadano, 'PAPEL_CARTON', 'Cartones amontonados detrás del mercado', 8.96500, -79.54000, 'VALIDADO', 'MEDIA');
  });

  console.log('Datos de demostración cargados.');
  console.log(`Usuarios: ciudadano@ecoriz.test, ciudadano2@ecoriz.test, entidad@ecoriz.test, organizacion@ecoriz.test  ·  clave: ${CLAVE_DEMO}`);
}

main()
  .catch((e) => { console.error('Error cargando datos:', e.message); process.exitCode = 1; })
  .finally(() => pool.end());
