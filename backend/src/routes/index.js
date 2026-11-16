const express = require('express');
const multer = require('multer');
const { autorizar } = require('../middleware/auth');
const { MAX_FOTO_BYTES } = require('../utils/validators');

// Tabla 6.1 de la Fase 2. La columna "Roles" se aplica con autorizar() (D-05).
module.exports = function crearRutas({ autenticar, authController, reporteController, validacionController, jornadaController }) {
  const router = express.Router();
  const VALIDADORES = ['ENTIDAD', 'ORGANIZACION'];
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FOTO_BYTES, files: 1 } }).single('foto');

  router.post('/auth/login', authController.login);

  // CU-01
  router.get('/reportes/cercanos', autenticar, autorizar('CIUDADANO'), reporteController.cercanos);
  router.post('/reportes', autenticar, autorizar('CIUDADANO'), upload, reporteController.crear);

  // CU-02 / CU-03
  router.get('/reportes', autenticar, autorizar(...VALIDADORES), reporteController.listar);
  router.get('/reportes/:id', autenticar, reporteController.obtener);
  router.post('/reportes/:id/decisiones', autenticar, autorizar(...VALIDADORES), validacionController.decidir);
  router.get('/reportes/:id/historial', autenticar, reporteController.historial);

  // CU-03
  router.post('/jornadas', autenticar, autorizar(...VALIDADORES), jornadaController.crear);
  router.get('/jornadas', autenticar, jornadaController.listar);
  router.put('/jornadas/:id', autenticar, autorizar(...VALIDADORES), jornadaController.actualizar);
  router.post('/jornadas/:id/publicar', autenticar, autorizar(...VALIDADORES), jornadaController.publicar);
  router.post('/jornadas/:id/cierre', autenticar, autorizar(...VALIDADORES), jornadaController.cerrar);

  router.get('/organizaciones', autenticar, jornadaController.organizaciones);
  return router;
};
