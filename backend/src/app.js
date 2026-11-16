const express = require('express');
const cors = require('cors');
const path = require('path');
const { crearAutenticacion } = require('./middleware/auth');
const { noEncontrada, manejarErrores } = require('./middleware/errorHandler');
const crearRutas = require('./routes');

const { crearAuthService } = require('./services/authService');
const { crearReporteService } = require('./services/reporteService');
const { crearValidacionService } = require('./services/validacionService');
const { crearJornadaService } = require('./services/jornadaService');

/** Une controlador → servicio → repositorio (Figura 2). Recibe la configuración y las dependencias reales. */
function crearApp({ config, repos, withTransaction, evidenciaStorage }) {
  const authService = crearAuthService({ usuarioRepo: repos.usuarioRepo, jwtSecret: config.jwtSecret, jwtExpiresIn: config.jwtExpiresIn });
  const reporteService = crearReporteService({ ...repos, evidenciaStorage, withTransaction, radioDuplicadoM: config.radioDuplicadoM });
  const validacionService = crearValidacionService({ ...repos, withTransaction });
  const jornadaService = crearJornadaService({ ...repos, withTransaction });

  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/uploads', express.static(evidenciaStorage.directorio));

  app.get('/api/salud', (_req, res) => res.json({ estado: 'ok' }));
  app.use('/api', crearRutas({
    autenticar: crearAutenticacion(config.jwtSecret),
    authController: require('./controllers/authController')({ authService }),
    reporteController: require('./controllers/reporteController')({ reporteService }),
    validacionController: require('./controllers/validacionController')({ validacionService }),
    jornadaController: require('./controllers/jornadaController')({ jornadaService, organizacionRepo: repos.organizacionRepo }),
  }));

  app.use(noEncontrada);
  app.use(manejarErrores);
  return app;
}

module.exports = { crearApp };
