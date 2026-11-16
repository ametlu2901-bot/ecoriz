const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');

/** AuthMiddleware (D-05, D-10): verifica el token JWT y deja el usuario en req.usuario. */
function crearAutenticacion(jwtSecret) {
  return function autenticar(req, _res, next) {
    const cabecera = req.headers.authorization || '';
    const [tipo, token] = cabecera.split(' ');
    if (tipo !== 'Bearer' || !token) return next(new AppError(401, 'NO_AUTENTICADO', 'Debes iniciar sesión.'));
    try {
      const datos = jwt.verify(token, jwtSecret);
      req.usuario = { id: datos.id, nombre: datos.nombre, rol: datos.rol, organizacionId: datos.organizacionId };
      return next();
    } catch (_) {
      return next(new AppError(401, 'TOKEN_INVALIDO', 'La sesión expiró o no es válida. Inicia sesión de nuevo.'));
    }
  };
}

/** Cada ruta declara qué roles pueden usarla (compromiso aceptado en D-05). */
function autorizar(...roles) {
  return function (req, _res, next) {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return next(new AppError(403, 'PROHIBIDO', 'Tu rol no tiene permiso para esta operación.'));
    }
    return next();
  };
}

module.exports = { crearAutenticacion, autorizar };
