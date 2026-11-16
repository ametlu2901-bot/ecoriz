// Cliente HTTP: envía el token JWT en cada petición (Figura 2, capa de presentación).
const CLAVE = 'ecoriz.sesion';

export function leerSesion() {
  try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; }
}
export function guardarSesion(sesion) { localStorage.setItem(CLAVE, JSON.stringify(sesion)); }
export function borrarSesion() { localStorage.removeItem(CLAVE); }

/** Ciudadanos entran por /login; el personal (entidades y organizaciones) por /personal. */
export const loginPorRol = (rol) => (rol && rol !== 'CIUDADANO' ? '/personal' : '/login');

export class ApiError extends Error {
  constructor(status, cuerpo) {
    super(cuerpo?.mensaje || 'No se pudo completar la operación.');
    this.status = status;
    this.codigo = cuerpo?.error;
    this.campos = cuerpo?.campos || [];
    this.cuerpo = cuerpo;
  }
  /** { descripcion: 'La descripción es obligatoria.' } para marcar el campo exacto (flujo A2). */
  get porCampo() {
    return Object.fromEntries(this.campos.map((c) => [c.campo, c.motivo]));
  }
}

async function pedir(metodo, ruta, cuerpo) {
  const sesion = leerSesion();
  const headers = {};
  if (sesion?.token) headers.Authorization = `Bearer ${sesion.token}`;
  let body;
  if (cuerpo instanceof FormData) body = cuerpo;
  else if (cuerpo !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(cuerpo); }

  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, { method: metodo, headers, body });
  } catch {
    throw new ApiError(0, { mensaje: 'No hay conexión con el servidor. Revisa que el backend esté en marcha.' });
  }
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    if (respuesta.status === 401 && sesion) { borrarSesion(); window.location.assign(loginPorRol(sesion.usuario?.rol)); }
    throw new ApiError(respuesta.status, datos);
  }
  return datos;
}

export const api = {
  get: (ruta) => pedir('GET', ruta),
  post: (ruta, cuerpo) => pedir('POST', ruta, cuerpo),
  put: (ruta, cuerpo) => pedir('PUT', ruta, cuerpo),
};

export const ETIQUETA_TIPO_RESIDUO = {
  PLASTICO: 'Plástico', VIDRIO: 'Vidrio', PAPEL_CARTON: 'Papel y cartón', METAL: 'Metal',
  ORGANICO: 'Orgánico', ESCOMBROS: 'Escombros', ELECTRONICO: 'Electrónico', OTRO: 'Otro',
};
export const ETIQUETA_ESTADO = {
  PENDIENTE: 'Pendiente', VALIDADO: 'Validado', RECHAZADO: 'Rechazado', DUPLICADO: 'Duplicado', CERRADO: 'Cerrado',
};
export const formatearFecha = (iso) =>
  iso ? new Date(iso).toLocaleString('es-PA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
