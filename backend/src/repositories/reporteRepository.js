const { pool } = require('../config/db');

const COLS = `r.id, r.codigo, r.usuario_id AS "usuarioId", r.tipo_residuo AS "tipoResiduo", r.descripcion,
  r.latitud, r.longitud, r.estado, r.prioridad, r.duplicado_de_id AS "duplicadoDeId", r.version,
  r.fecha_creacion AS "fechaCreacion"`;

const TAMANO_PAGINA = 10;

// Distancia en metros (fórmula de Haversine) entre r y el punto ($lat, $lng)
const distanciaSql = (pLat, pLng) => `(6371000 * 2 * asin(sqrt(
  power(sin(radians(r.latitud - ${pLat}::float8) / 2), 2) +
  cos(radians(${pLat}::float8)) * cos(radians(r.latitud)) *
  power(sin(radians(r.longitud - ${pLng}::float8) / 2), 2))))`;

const reporteRepository = {
  TAMANO_PAGINA,

  /** CU-01: inserta el reporte en estado PENDIENTE; el código RPT-NNNN sale de una secuencia. */
  async crear(db, { usuarioId, tipoResiduo, descripcion, latitud, longitud }) {
    const r = await db.query(
      `INSERT INTO reporte (codigo, usuario_id, tipo_residuo, descripcion, latitud, longitud, estado)
       VALUES ('RPT-' || lpad(nextval('reporte_codigo_seq')::text, 4, '0'), $1, $2, $3, $4, $5, 'PENDIENTE')
       RETURNING id, codigo, estado, version`,
      [usuarioId, tipoResiduo || null, descripcion, latitud, longitud]
    );
    return r.rows[0];
  },

  /** bloquear=true usa FOR UPDATE (solo dentro de una transacción). */
  async buscarPorId(id, db = pool, { bloquear = false } = {}) {
    const r = await db.query(`SELECT ${COLS} FROM reporte r WHERE r.id = $1 ${bloquear ? 'FOR UPDATE' : ''}`, [id]);
    return r.rows[0] || null;
  },

  async buscarPorCodigo(codigo, db = pool) {
    const r = await db.query(`SELECT ${COLS} FROM reporte r WHERE upper(r.codigo) = upper($1)`, [codigo]);
    return r.rows[0] || null;
  },

  /** D-08: reportes abiertos (PENDIENTE o VALIDADO) a menos de radioM metros, del más cercano al más lejano. */
  async listarAbiertosCerca(latitud, longitud, radioM, { excluirId = null } = {}, db = pool) {
    const gradosLat = radioM / 111320;
    const gradosLng = radioM / (111320 * Math.max(Math.cos((latitud * Math.PI) / 180), 0.01));
    const r = await db.query(
      `SELECT ${COLS}, ${distanciaSql('$1', '$2')} AS distancia
         FROM reporte r
        WHERE r.estado IN ('PENDIENTE', 'VALIDADO')
          AND r.latitud  BETWEEN $1::float8 - $4 AND $1::float8 + $4
          AND r.longitud BETWEEN $2::float8 - $5 AND $2::float8 + $5
          AND ${distanciaSql('$1', '$2')} <= $3
          AND ($6::int IS NULL OR r.id <> $6)
        ORDER BY distancia
        LIMIT 10`,
      [latitud, longitud, radioM, gradosLat, gradosLng, excluirId]
    );
    return r.rows;
  },

  /** CU-02 / CU-03: lista paginada con filtros estado, tipo, fecha (AAAA-MM-DD) y zona ("lat,lng,radioM"). */
  async listar({ estado, tipo, fecha, zona, pagina = 1 }, db = pool) {
    const params = [];
    const condiciones = [];
    const p = (valor) => { params.push(valor); return `$${params.length}`; };

    if (estado) condiciones.push(`r.estado = ${p(estado)}`);
    if (tipo) condiciones.push(`r.tipo_residuo = ${p(tipo)}`);
    if (fecha) condiciones.push(`r.fecha_creacion::date = ${p(fecha)}::date`);
    if (zona) {
      const pLat = p(zona.latitud); const pLng = p(zona.longitud);
      condiciones.push(`${distanciaSql(pLat, pLng)} <= ${p(zona.radioM)}`);
    }
    const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const total = (await db.query(`SELECT count(*)::int AS n FROM reporte r ${donde}`, params)).rows[0].n;
    const limite = p(TAMANO_PAGINA);
    const desplazamiento = p((pagina - 1) * TAMANO_PAGINA);
    const filas = await db.query(
      `SELECT ${COLS},
              (SELECT e.ruta_archivo FROM evidencia e WHERE e.reporte_id = r.id ORDER BY e.id LIMIT 1) AS "fotoRuta"
         FROM reporte r ${donde}
        ORDER BY r.fecha_creacion DESC, r.id DESC
        LIMIT ${limite} OFFSET ${desplazamiento}`,
      params
    );
    return { items: filas.rows, total, pagina, tamano: TAMANO_PAGINA };
  },

  /**
   * D-07: cambia el estado solo si la versión sigue siendo la que vio el usuario.
   * Devuelve la fila actualizada o null si otra persona ya la modificó.
   */
  async actualizarEstado(db, { id, version, estadoNuevo, prioridad = null, duplicadoDeId = null }) {
    const r = await db.query(
      `UPDATE reporte
          SET estado = $3,
              prioridad = COALESCE($4, prioridad),
              duplicado_de_id = COALESCE($5, duplicado_de_id),
              version = version + 1
        WHERE id = $1 AND version = $2
        RETURNING id, codigo, estado, prioridad, duplicado_de_id AS "duplicadoDeId", version`,
      [id, version, estadoNuevo, prioridad, duplicadoDeId]
    );
    return r.rows[0] || null;
  },
};

module.exports = reporteRepository;
