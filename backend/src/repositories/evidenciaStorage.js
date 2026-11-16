// D-04: las fotos viven en el sistema de archivos; la base de datos guarda solo el nombre.
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

function crearEvidenciaStorage(directorio) {
  return {
    directorio,
    async guardar(buffer, mimetype) {
      const extension = mimetype === 'image/png' ? 'png' : 'jpg';
      const nombre = `${crypto.randomUUID()}.${extension}`;
      await fs.mkdir(directorio, { recursive: true });
      await fs.writeFile(path.join(directorio, nombre), buffer);
      return nombre;
    },
    /** Si la transacción falla, se borra la foto para no dejar archivos huérfanos. */
    async eliminar(nombre) {
      try { await fs.unlink(path.join(directorio, nombre)); } catch (_) { /* ya no existe */ }
    },
  };
}

module.exports = { crearEvidenciaStorage };
