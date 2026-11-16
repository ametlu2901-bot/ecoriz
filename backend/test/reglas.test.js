const test = require('node:test');
const assert = require('node:assert/strict');
const { crearMundo, fotoPng } = require('./fakes');
const { crearReporteService } = require('../src/services/reporteService');
const { crearValidacionService } = require('../src/services/validacionService');
const { crearJornadaService } = require('../src/services/jornadaService');
const { validarNuevoReporte } = require('../src/utils/validators');

const ciudadano = { id: 10, rol: 'CIUDADANO' };
const validador = { id: 20, rol: 'ENTIDAD', organizacionId: 1 };
const datosOk = { descripcion: 'Bolsas de basura en la esquina', latitud: '8.9834', longitud: '-79.5198', tipoResiduo: 'PLASTICO' };
const AHORA = new Date('2026-11-15T12:00:00Z');
const MANANA = '2026-11-20T09:00:00Z';

function armar() {
  const m = crearMundo();
  const reporteService = crearReporteService({ ...m, radioDuplicadoM: 100 });
  const validacionService = crearValidacionService(m);
  const jornadaService = crearJornadaService({ ...m, ahora: () => AHORA });
  return { m, reporteService, validacionService, jornadaService };
}
const campos = (e) => e.campos.map((c) => c.campo);

// ---------- CU-01 ----------
test('CU-01 flujo principal: guarda reporte PENDIENTE, evidencia e historial', async () => {
  const { m, reporteService } = armar();
  const r = await reporteService.registrar(ciudadano, datosOk, fotoPng());
  assert.equal(r.estado, 'PENDIENTE');
  assert.match(r.codigo, /^RPT-\d{4}$/);
  assert.equal(m.estado.reportes.length, 1);
  assert.equal(m.estado.evidencias.length, 1);
  assert.equal(m.estado.historial[0].decision, 'REGISTRO');
});

test('CU-01 A2: descripción vacía devuelve 400 con el campo exacto y no guarda nada', async () => {
  const { m, reporteService } = armar();
  await assert.rejects(reporteService.registrar(ciudadano, { ...datosOk, descripcion: '  ' }, fotoPng()),
    (e) => e.status === 400 && campos(e).includes('descripcion'));
  assert.equal(m.estado.reportes.length, 0);
  assert.equal(m.estado.fotosEnDisco.size, 0);
});

test('CU-01: foto obligatoria, solo JPEG/PNG, máx. 5 MB y contenido real de imagen', () => {
  assert.deepEqual(validarNuevoReporte(datosOk, undefined).map((e) => e.campo), ['foto']);
  assert.deepEqual(validarNuevoReporte(datosOk, fotoPng({ mimetype: 'application/pdf' })).map((e) => e.campo), ['foto']);
  assert.deepEqual(validarNuevoReporte(datosOk, fotoPng({ size: 6 * 1024 * 1024 })).map((e) => e.campo), ['foto']);
  assert.deepEqual(validarNuevoReporte(datosOk, fotoPng({ buffer: Buffer.from('no soy imagen!') })).map((e) => e.campo), ['foto']);
  assert.deepEqual(validarNuevoReporte(datosOk, fotoPng()), []);
});

test('CU-01: ubicación inválida y tipo de residuo desconocido se rechazan', () => {
  const e = validarNuevoReporte({ ...datosOk, latitud: '999', tipoResiduo: 'LAVA' }, fotoPng()).map((x) => x.campo);
  assert.deepEqual(e.sort(), ['tipoResiduo', 'ubicacion']);
});

test('CU-01 E1/E2: si falla el guardado hay ROLLBACK y la foto se borra (D-03, D-04)', async () => {
  const { m, reporteService } = armar();
  m.historialRepo.agregar = async () => { throw new Error('falla simulada de la BD'); };
  await assert.rejects(reporteService.registrar(ciudadano, datosOk, fotoPng()), /falla simulada/);
  assert.equal(m.estado.reportes.length, 0);
  assert.equal(m.estado.evidencias.length, 0);
  assert.equal(m.estado.fotosEnDisco.size, 0);
});

// ---------- CU-02 ----------
async function reportePendiente(ctx) { return (await ctx.reporteService.registrar(ciudadano, datosOk, fotoPng())).id; }

test('CU-02: validar con prioridad y observación → VALIDADO, versión +1 e historial', async () => {
  const ctx = armar(); const id = await reportePendiente(ctx);
  const r = await ctx.validacionService.decidir(validador, id, { decision: 'VALIDAR', prioridad: 'ALTA', observacion: 'Confirmado en sitio', version: 1 });
  assert.equal(r.estado, 'VALIDADO'); assert.equal(r.version, 2);
  const h = ctx.m.estado.historial.at(-1);
  assert.deepEqual([h.estadoAnterior, h.estadoNuevo, h.responsableId], ['PENDIENTE', 'VALIDADO', 20]);
});

test('CU-02: la observación es obligatoria; validar exige prioridad', async () => {
  const ctx = armar(); const id = await reportePendiente(ctx);
  await assert.rejects(ctx.validacionService.decidir(validador, id, { decision: 'RECHAZAR', observacion: '', version: 1 }),
    (e) => e.status === 400 && campos(e).includes('observacion'));
  await assert.rejects(ctx.validacionService.decidir(validador, id, { decision: 'VALIDAR', observacion: 'ok', version: 1 }),
    (e) => e.status === 400 && campos(e).includes('prioridad'));
});

test('CU-02 A1/A2/A3: duplicado, rechazo y seguimiento producen el estado de la Figura 7', async () => {
  const ctx = armar();
  const a = await reportePendiente(ctx); const b = await reportePendiente(ctx);
  const c = await reportePendiente(ctx); const d = await reportePendiente(ctx);
  const dup = await ctx.validacionService.decidir(validador, b, { decision: 'DUPLICADO', duplicadoDeCodigo: 'RPT-0001', observacion: 'Mismo punto', version: 1 });
  assert.equal(dup.estado, 'DUPLICADO'); assert.equal(dup.duplicadoDeId, a);
  assert.equal((await ctx.validacionService.decidir(validador, c, { decision: 'RECHAZAR', observacion: 'No es acumulación', version: 1 })).estado, 'RECHAZADO');
  const seg = await ctx.validacionService.decidir(validador, d, { decision: 'SEGUIMIENTO', observacion: 'Pedir más fotos', version: 1 });
  assert.equal(seg.estado, 'PENDIENTE'); assert.equal(seg.version, 2);
});

test('CU-02: un reporte no puede ser duplicado de sí mismo ni de un código inexistente', async () => {
  const ctx = armar(); const id = await reportePendiente(ctx);
  await assert.rejects(ctx.validacionService.decidir(validador, id, { decision: 'DUPLICADO', duplicadoDeCodigo: 'RPT-0001', observacion: 'x', version: 1 }),
    (e) => e.status === 400);
  await assert.rejects(ctx.validacionService.decidir(validador, id, { decision: 'DUPLICADO', duplicadoDeCodigo: 'RPT-9999', observacion: 'x', version: 1 }),
    (e) => e.status === 400);
});

test('CU-02 E2: dos validadores a la vez → el segundo recibe 409 (D-07)', async () => {
  const ctx = armar(); const id = await reportePendiente(ctx);
  await ctx.validacionService.decidir(validador, id, { decision: 'VALIDAR', prioridad: 'MEDIA', observacion: 'primero', version: 1 });
  await assert.rejects(ctx.validacionService.decidir({ id: 21, rol: 'ORGANIZACION' }, id, { decision: 'RECHAZAR', observacion: 'segundo', version: 1 }),
    (e) => e.status === 409 && e.codigo === 'VERSION_DESACTUALIZADA');
  assert.equal(ctx.m.estado.reportes[0].estado, 'VALIDADO');
});

test('CU-02: un reporte ya decidido no admite otra transición (422)', async () => {
  const ctx = armar(); const id = await reportePendiente(ctx);
  await ctx.validacionService.decidir(validador, id, { decision: 'RECHAZAR', observacion: 'no aplica', version: 1 });
  await assert.rejects(ctx.validacionService.decidir(validador, id, { decision: 'VALIDAR', prioridad: 'BAJA', observacion: 'otra vez', version: 2 }),
    (e) => e.status === 422 && e.codigo === 'TRANSICION_INVALIDA');
});

test('RNF-05: el ciudadano no ve datos personales de quien reportó un reporte ajeno', async () => {
  const ctx = armar(); const id = await reportePendiente(ctx);
  ctx.m.usuarioRepo.buscarPorId = async () => ({ nombre: 'Carla', correo: 'carla@x.test' });
  const ajeno = await ctx.reporteService.obtener({ id: 99, rol: 'CIUDADANO' }, id);
  assert.equal(ajeno.reportante, undefined);
  const propio = await ctx.reporteService.obtener(ciudadano, id);
  assert.equal(propio.reportante.correo, 'carla@x.test');
  const v = await ctx.reporteService.obtener(validador, id);
  assert.deepEqual(v.reportante, { nombre: 'Carla' });
});

// ---------- CU-03 ----------
async function reporteValidado(ctx) {
  const id = await reportePendiente(ctx);
  await ctx.validacionService.decidir(validador, id, { decision: 'VALIDAR', prioridad: 'ALTA', observacion: 'ok', version: 1 });
  return id;
}
const jornadaOk = (reporteId) => ({ titulo: 'Limpieza de la quebrada', tipo: 'LIMPIEZA', reporteId, organizacionId: 1,
  fechaHora: MANANA, puntoEncuentro: 'Parque central', detalles: 'Traer guantes', accion: 'PUBLICAR' });

test('CU-03: publica una jornada sobre un reporte VALIDADO', async () => {
  const ctx = armar(); const id = await reporteValidado(ctx);
  const j = await ctx.jornadaService.crear(validador, jornadaOk(id));
  assert.equal(j.estado, 'PUBLICADA');
  assert.equal((await ctx.jornadaService.listar(validador, {})).length, 1);
});

test('CU-03 A2: fecha pasada → 400 con el campo fechaHora y no se guarda', async () => {
  const ctx = armar(); const id = await reporteValidado(ctx);
  await assert.rejects(ctx.jornadaService.crear(validador, { ...jornadaOk(id), fechaHora: '2026-11-01T09:00:00Z' }),
    (e) => e.status === 400 && campos(e).includes('fechaHora'));
  assert.equal(ctx.m.estado.jornadas.length, 0);
});

test('CU-03 A3: un reporte PENDIENTE (o ya cerrado) no se puede vincular → 422', async () => {
  const ctx = armar(); const id = await reportePendiente(ctx);
  await assert.rejects(ctx.jornadaService.crear(validador, jornadaOk(id)),
    (e) => e.status === 422 && e.codigo === 'REPORTE_NO_DISPONIBLE');
  assert.equal(ctx.m.estado.jornadas.length, 0);
});

test('CU-03 A3: sin reporte se exige zona y justificación', async () => {
  const ctx = armar();
  const sinReporte = { ...jornadaOk(null), reporteId: undefined };
  await assert.rejects(ctx.jornadaService.crear(validador, sinReporte),
    (e) => e.status === 400 && campos(e).includes('zona') && campos(e).includes('justificacionZona'));
  const j = await ctx.jornadaService.crear(validador, { ...sinReporte, zona: 'Calidonia', justificacionZona: 'Varios focos' });
  assert.equal(j.estado, 'PUBLICADA');
});

test('CU-03 A1: guardar borrador solo exige título; publicarlo después revalida', async () => {
  const ctx = armar(); const id = await reporteValidado(ctx);
  const b = await ctx.jornadaService.crear(validador, { titulo: 'Borrador', accion: 'BORRADOR', reporteId: id });
  assert.equal(b.estado, 'BORRADOR');
  assert.equal((await ctx.jornadaService.listar(validador, { estado: 'PUBLICADA' })).length, 0);
  await assert.rejects(ctx.jornadaService.publicar(validador, b.id), (e) => e.status === 400);
  await ctx.jornadaService.actualizar(validador, b.id, jornadaOk(id));
  assert.equal((await ctx.jornadaService.publicar(validador, b.id)).estado, 'PUBLICADA');
});

test('CU-03 RF-08: el cierre guarda resultado y pasa el reporte a CERRADO en la misma operación', async () => {
  const ctx = armar(); const id = await reporteValidado(ctx);
  const j = await ctx.jornadaService.crear(validador, jornadaOk(id));
  await assert.rejects(ctx.jornadaService.cerrar({ id: 5, rol: 'ORGANIZACION', organizacionId: 2 }, j.id, { resultado: 'x' }),
    (e) => e.status === 403);
  await assert.rejects(ctx.jornadaService.cerrar(validador, j.id, { resultado: '' }), (e) => e.status === 400);
  await ctx.jornadaService.cerrar(validador, j.id, { resultado: '30 bolsas recogidas' });
  assert.equal(ctx.m.estado.reportes[0].estado, 'CERRADO');
  assert.equal(ctx.m.estado.historial.at(-1).decision, 'CIERRE_JORNADA');
  await assert.rejects(ctx.jornadaService.cerrar(validador, j.id, { resultado: 'otra vez' }), (e) => e.status === 409);
});

// ---------- RF-10: acceso de ciudadanos y acceso del personal ----------
const bcrypt = require('bcryptjs');
const { crearAuthService } = require('../src/services/authService');

function armarAuth() {
  const hash = bcrypt.hashSync('Clave-123', 4);
  const usuarios = [
    { id: 1, nombre: 'Carla', correo: 'ciudadano@x.test', hashContrasena: hash, rol: 'CIUDADANO', organizacionId: null, activo: true },
    { id: 2, nombre: 'Elena', correo: 'entidad@x.test', hashContrasena: hash, rol: 'ENTIDAD', organizacionId: 1, activo: true },
  ];
  const usuarioRepo = { buscarPorCorreo: async (correo) => usuarios.find((u) => u.correo === correo) || null };
  return crearAuthService({ usuarioRepo, jwtSecret: 'secreto-de-prueba' });
}

test('RF-10: cada acceso admite solo sus cuentas; la del otro acceso recibe el mismo error que una clave errónea', async () => {
  const auth = armarAuth();
  assert.equal((await auth.login({ correo: 'ciudadano@x.test', contrasena: 'Clave-123', acceso: 'CIUDADANO' })).usuario.rol, 'CIUDADANO');
  assert.equal((await auth.login({ correo: 'entidad@x.test', contrasena: 'Clave-123', acceso: 'PERSONAL' })).usuario.rol, 'ENTIDAD');
  await assert.rejects(auth.login({ correo: 'entidad@x.test', contrasena: 'Clave-123', acceso: 'CIUDADANO' }),
    (e) => e.status === 401 && e.codigo === 'CREDENCIALES_INVALIDAS');
  await assert.rejects(auth.login({ correo: 'ciudadano@x.test', contrasena: 'Clave-123', acceso: 'PERSONAL' }),
    (e) => e.status === 401 && e.codigo === 'CREDENCIALES_INVALIDAS');
});

test('RF-10: un acceso desconocido es 400 y sin acceso se admite cualquier rol', async () => {
  const auth = armarAuth();
  await assert.rejects(auth.login({ correo: 'entidad@x.test', contrasena: 'Clave-123', acceso: 'toString' }),
    (e) => e.status === 400 && campos(e).includes('acceso'));
  // Sin acceso (clientes anteriores) se sigue admitiendo cualquier rol
  assert.equal((await auth.login({ correo: 'entidad@x.test', contrasena: 'Clave-123' })).usuario.rol, 'ENTIDAD');
});
