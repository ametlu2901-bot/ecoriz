const { AppError } = require('../utils/errors');

function noEncontrada(_req, _res, next) {
  next(new AppError(404, 'NO_ENCONTRADO', 'La ruta no existe.'));
}

// eslint-disable-next-line no-unused-vars
function manejarErrores(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.codigo, mensaje: err.message, ...err.extra });
  }
  // Errores de multer (archivo demasiado grande, campo inesperado)
  if (err && err.name === 'MulterError') {
    const motivo = err.code === 'LIMIT_FILE_SIZE' ? 'La foto no puede superar 5 MB.' : 'No se pudo leer la foto adjunta.';
    return res.status(400).json({ error: 'VALIDACION', mensaje: 'Hay campos inválidos', campos: [{ campo: 'foto', motivo }] });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es JSON válido.' });
  }
  console.error('[error no controlado]', err);
  return res.status(500).json({ error: 'ERROR_INTERNO', mensaje: 'No se pudo completar la operación. Intenta de nuevo.' });
}

module.exports = { noEncontrada, manejarErrores };
