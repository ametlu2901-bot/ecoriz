const path = require('path');
const config = require('./config/env');
const { withTransaction } = require('./config/db');
const { crearApp } = require('./app');
const { crearEvidenciaStorage } = require('./repositories/evidenciaStorage');

const repos = {
  usuarioRepo: require('./repositories/usuarioRepository'),
  organizacionRepo: require('./repositories/organizacionRepository'),
  reporteRepo: require('./repositories/reporteRepository'),
  evidenciaRepo: require('./repositories/evidenciaRepository'),
  historialRepo: require('./repositories/historialRepository'),
  jornadaRepo: require('./repositories/jornadaRepository'),
};

const evidenciaStorage = crearEvidenciaStorage(path.join(__dirname, '..', 'uploads'));
const app = crearApp({ config, repos, withTransaction, evidenciaStorage });

app.listen(config.port, () => console.log(`Ecoriz API escuchando en http://localhost:${config.port}`));
