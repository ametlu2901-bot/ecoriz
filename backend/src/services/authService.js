const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppError, ValidationError } = require('../utils/errors');

/**
 * Hay dos accesos separados: el de ciudadanos y el del personal (entidades y organizaciones).
 * Cada uno solo admite sus roles; sin `acceso` se admite cualquier rol (clientes antiguos).
 */
const ACCESOS = {
  CIUDADANO: ['CIUDADANO'],
  PERSONAL: ['ENTIDAD', 'ORGANIZACION', 'UNIVERSIDAD', 'ADMIN'],
};

/** RF-10 · inicio de sesión. Devuelve un JWT de duración limitada (D-10). */
function crearAuthService({ usuarioRepo, jwtSecret, jwtExpiresIn = '2h' }) {
  return {
    async login({ correo, contrasena, acceso } = {}) {
      const errores = [];
      if (!correo || !String(correo).trim()) errores.push({ campo: 'correo', motivo: 'El correo es obligatorio.' });
      if (!contrasena) errores.push({ campo: 'contrasena', motivo: 'La contraseña es obligatoria.' });
      if (acceso !== undefined && !Object.hasOwn(ACCESOS, acceso)) {
        errores.push({ campo: 'acceso', motivo: 'El acceso debe ser CIUDADANO o PERSONAL.' });
      }
      if (errores.length) throw new ValidationError(errores);

      const usuario = await usuarioRepo.buscarPorCorreo(String(correo).trim());
      // Mismo mensaje para usuario inexistente, inactivo, clave errónea o cuenta del otro acceso:
      // no revela cuál falló ni que exista un acceso distinto
      const credencialesInvalidas = new AppError(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.');
      if (!usuario || !usuario.activo) throw credencialesInvalidas;
      const ok = await bcrypt.compare(String(contrasena), usuario.hashContrasena);
      if (!ok) throw credencialesInvalidas;
      if (acceso !== undefined && !ACCESOS[acceso].includes(usuario.rol)) throw credencialesInvalidas;

      const perfil = { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol, organizacionId: usuario.organizacionId };
      const token = jwt.sign(perfil, jwtSecret, { expiresIn: jwtExpiresIn });
      return { token, usuario: perfil };
    },
  };
}

module.exports = { crearAuthService, ACCESOS };
