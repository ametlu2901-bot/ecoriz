// Validaciones de negocio (D-09: el servidor valida aunque la interfaz ya lo haya hecho).
// Cada función devuelve un arreglo [{ campo, motivo }]; vacío = válido.

const TIPOS_RESIDUO = ['PLASTICO', 'VIDRIO', 'PAPEL_CARTON', 'METAL', 'ORGANICO', 'ESCOMBROS', 'ELECTRONICO', 'OTRO'];
const PRIORIDADES = ['ALTA', 'MEDIA', 'BAJA'];
const TIPOS_JORNADA = ['LIMPIEZA', 'RECICLAJE'];
const DECISIONES = ['VALIDAR', 'RECHAZAR', 'DUPLICADO', 'SEGUIMIENTO'];
const MAX_FOTO_BYTES = 5 * 1024 * 1024;

const vacio = (v) => v === undefined || v === null || String(v).trim() === '';

function esJpeg(buf) { return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff; }
function esPng(buf) {
  return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

function validarCoordenadas(latitud, longitud) {
  const errores = [];
  const lat = Number(latitud);
  const lng = Number(longitud);
  if (vacio(latitud) || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    errores.push({ campo: 'latitud', motivo: 'La ubicación es obligatoria (latitud entre -90 y 90).' });
  }
  if (vacio(longitud) || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    errores.push({ campo: 'longitud', motivo: 'La ubicación es obligatoria (longitud entre -180 y 180).' });
  }
  return errores;
}

/** CU-01 · RF-01. foto = { buffer, mimetype, size } (de multer) o undefined. */
function validarNuevoReporte(datos, foto) {
  const errores = [];
  if (validarCoordenadas(datos.latitud, datos.longitud).length > 0) {
    errores.push({ campo: 'ubicacion', motivo: 'La ubicación es obligatoria: usa tu ubicación o elige un punto en el mapa.' });
  }

  if (vacio(datos.descripcion)) {
    errores.push({ campo: 'descripcion', motivo: 'La descripción es obligatoria.' });
  } else if (String(datos.descripcion).trim().length > 1000) {
    errores.push({ campo: 'descripcion', motivo: 'La descripción no puede superar 1000 caracteres.' });
  }
  if (!vacio(datos.tipoResiduo) && !TIPOS_RESIDUO.includes(datos.tipoResiduo)) {
    errores.push({ campo: 'tipoResiduo', motivo: 'El tipo de residuo no es válido.' });
  }
  if (!foto) {
    errores.push({ campo: 'foto', motivo: 'La evidencia fotográfica es obligatoria.' });
  } else if (!['image/jpeg', 'image/png'].includes(foto.mimetype)) {
    errores.push({ campo: 'foto', motivo: 'La foto debe ser JPEG o PNG.' });
  } else if (foto.size > MAX_FOTO_BYTES) {
    errores.push({ campo: 'foto', motivo: 'La foto no puede superar 5 MB.' });
  } else if (!(foto.mimetype === 'image/jpeg' ? esJpeg(foto.buffer) : esPng(foto.buffer))) {
    errores.push({ campo: 'foto', motivo: 'El archivo no es una imagen válida.' });
  }
  return errores;
}

/** CU-02 · decisión del validador. */
function validarDecision(datos) {
  const errores = [];
  if (!DECISIONES.includes(datos.decision)) {
    errores.push({ campo: 'decision', motivo: 'La decisión debe ser VALIDAR, RECHAZAR, DUPLICADO o SEGUIMIENTO.' });
  }
  if (vacio(datos.observacion)) {
    errores.push({ campo: 'observacion', motivo: 'La observación es obligatoria.' });
  }
  if (datos.decision === 'VALIDAR' && !PRIORIDADES.includes(datos.prioridad)) {
    errores.push({ campo: 'prioridad', motivo: 'Para validar debes elegir una prioridad (Alta, Media o Baja).' });
  }
  if (!vacio(datos.prioridad) && !PRIORIDADES.includes(datos.prioridad)) {
    errores.push({ campo: 'prioridad', motivo: 'La prioridad no es válida.' });
  }
  if (datos.decision === 'DUPLICADO' && vacio(datos.duplicadoDeCodigo) && vacio(datos.duplicadoDeId)) {
    errores.push({ campo: 'duplicadoDeCodigo', motivo: 'Indica el reporte original (por ejemplo RPT-0153).' });
  }
  if (!Number.isInteger(Number(datos.version)) || vacio(datos.version)) {
    errores.push({ campo: 'version', motivo: 'Falta la versión del reporte que se está decidiendo.' });
  }
  return errores;
}

/**
 * CU-03 · jornada. publicar=true exige todos los campos y fecha futura (A2);
 * publicar=false (borrador, A1) solo exige el título.
 * Si no hay reporteId, debe haber zona y justificación (A3).
 */
function validarJornada(datos, { publicar, ahora }) {
  const errores = [];
  if (vacio(datos.titulo)) errores.push({ campo: 'titulo', motivo: 'El título es obligatorio.' });
  if (!vacio(datos.tipo) && !TIPOS_JORNADA.includes(datos.tipo)) {
    errores.push({ campo: 'tipo', motivo: 'El tipo debe ser LIMPIEZA o RECICLAJE.' });
  }

  let fecha = null;
  if (!vacio(datos.fechaHora)) {
    fecha = new Date(datos.fechaHora);
    if (Number.isNaN(fecha.getTime())) {
      errores.push({ campo: 'fechaHora', motivo: 'La fecha y hora no son válidas.' });
      fecha = null;
    }
  }

  if (publicar) {
    if (!fecha && vacio(datos.fechaHora)) errores.push({ campo: 'fechaHora', motivo: 'La fecha y hora son obligatorias.' });
    if (fecha && fecha.getTime() <= ahora.getTime()) {
      errores.push({ campo: 'fechaHora', motivo: 'La fecha debe ser posterior al momento actual.' });
    }
    if (vacio(datos.puntoEncuentro)) errores.push({ campo: 'puntoEncuentro', motivo: 'El punto de encuentro es obligatorio.' });
    if (vacio(datos.organizacionId)) errores.push({ campo: 'organizacionId', motivo: 'La organización responsable es obligatoria.' });
    if (vacio(datos.reporteId)) {
      if (vacio(datos.zona)) errores.push({ campo: 'zona', motivo: 'Vincula un reporte validado o indica una zona de atención.' });
      if (vacio(datos.justificacionZona)) {
        errores.push({ campo: 'justificacionZona', motivo: 'Justifica la jornada por zona.' });
      }
    }
  }
  return errores;
}

module.exports = {
  TIPOS_RESIDUO, PRIORIDADES, DECISIONES, TIPOS_JORNADA, MAX_FOTO_BYTES,
  validarCoordenadas, validarNuevoReporte, validarDecision, validarJornada,
};
