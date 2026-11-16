import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api.js';
import { useAuth } from '../auth.jsx';

const VACIO = {
  reporteId: '', zona: '', justificacionZona: '', titulo: '', tipo: 'LIMPIEZA',
  fechaHora: '', puntoEncuentro: '', organizacionId: '', detalles: '',
};

export default function CrearJornadaPage() {
  const { usuario } = useAuth();
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ ...VACIO, organizacionId: usuario.organizacionId || '' });
  const [origen, setOrigen] = useState('reporte'); // reporte | zona
  const [validados, setValidados] = useState([]);
  const [organizaciones, setOrganizaciones] = useState([]);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [enviando, setEnviando] = useState(false);

  // Precondición de CU-03: solo se listan reportes en estado VALIDADO
  useEffect(() => {
    api.get('/reportes?estado=VALIDADO').then((r) => setValidados(r.items)).catch((e) => setMensaje({ tipo: 'error', texto: e.message }));
    api.get('/organizaciones').then(setOrganizaciones).catch(() => {});
  }, []);

  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

  async function guardar(accion) {
    setEnviando(true); setErrores({}); setMensaje({ tipo: '', texto: '' });
    const cuerpo = {
      ...datos, accion,
      fechaHora: datos.fechaHora ? new Date(datos.fechaHora).toISOString() : '',
      reporteId: origen === 'reporte' ? datos.reporteId : '',
      zona: origen === 'zona' ? datos.zona : '',
      justificacionZona: origen === 'zona' ? datos.justificacionZona : '',
    };
    try {
      await api.post('/jornadas', cuerpo);
      navegar(accion === 'BORRADOR' ? '/jornadas?ver=borradores' : '/jornadas');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        // A2: se marca el campo exacto y se conservan los demás datos
        setErrores(err.porCampo);
      } else {
        // A3 (422: el reporte ya no está validado) y E2 (error al guardar): el formulario se conserva
        setMensaje({ tipo: 'error', texto: err.message });
        if (err.codigo === 'REPORTE_NO_DISPONIBLE') {
          api.get('/reportes?estado=VALIDADO').then((r) => setValidados(r.items)).catch(() => {});
        }
      }
    } finally { setEnviando(false); }
  }

  return (
    <section className="tarjeta">
      <h1>Coordinar jornada de limpieza o reciclaje</h1>
      <form onSubmit={(e) => e.preventDefault()} noValidate>
        <fieldset className="campo">
          <legend>Origen de la jornada *</legend>
          <label className="opcion"><input type="radio" name="origen" checked={origen === 'reporte'} onChange={() => setOrigen('reporte')} /> Reporte validado</label>
          <label className="opcion"><input type="radio" name="origen" checked={origen === 'zona'} onChange={() => setOrigen('zona')} /> Zona de atención</label>
        </fieldset>

        {origen === 'reporte' ? (
          <div className="campo">
            <label htmlFor="reporte">Reporte origen (solo se listan reportes validados)</label>
            <select id="reporte" value={datos.reporteId} onChange={cambiar('reporteId')}>
              <option value="">Seleccionar reporte</option>
              {validados.map((r) => <option key={r.id} value={r.id}>{r.codigo} — {r.descripcion.slice(0, 60)}</option>)}
            </select>
            {validados.length === 0 && <p className="nota">No hay reportes validados disponibles. Puedes crear la jornada por zona.</p>}
            {errores.reporteId && <p className="error" role="alert">{errores.reporteId}</p>}
          </div>
        ) : (
          <>
            <div className="campo">
              <label htmlFor="zona">Zona de atención</label>
              <input id="zona" value={datos.zona} onChange={cambiar('zona')} placeholder="Barrio, corregimiento o sector" />
              {errores.zona && <p className="error" role="alert">{errores.zona}</p>}
            </div>
            <div className="campo">
              <label htmlFor="justificacion">Justificación de la zona</label>
              <textarea id="justificacion" rows={2} value={datos.justificacionZona} onChange={cambiar('justificacionZona')} />
              {errores.justificacionZona && <p className="error" role="alert">{errores.justificacionZona}</p>}
            </div>
          </>
        )}

        <div className="campo">
          <label htmlFor="titulo">Título *</label>
          <input id="titulo" value={datos.titulo} onChange={cambiar('titulo')} />
          {errores.titulo && <p className="error" role="alert">{errores.titulo}</p>}
        </div>
        <div className="campo">
          <label htmlFor="tipo">Tipo de jornada</label>
          <select id="tipo" value={datos.tipo} onChange={cambiar('tipo')}>
            <option value="LIMPIEZA">Limpieza</option><option value="RECICLAJE">Reciclaje</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="fecha">Fecha y hora *</label>
          <input id="fecha" type="datetime-local" value={datos.fechaHora} onChange={cambiar('fechaHora')} />
          {errores.fechaHora && <p className="error" role="alert">{errores.fechaHora} Los demás datos se conservan.</p>}
        </div>
        <div className="campo">
          <label htmlFor="punto">Punto de encuentro *</label>
          <input id="punto" value={datos.puntoEncuentro} onChange={cambiar('puntoEncuentro')} placeholder="Dirección o referencia" />
          {errores.puntoEncuentro && <p className="error" role="alert">{errores.puntoEncuentro}</p>}
        </div>
        <div className="campo">
          <label htmlFor="org">Organización responsable *</label>
          <select id="org" value={datos.organizacionId} onChange={cambiar('organizacionId')}>
            <option value="">Seleccionar organización</option>
            {organizaciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
          {errores.organizacionId && <p className="error" role="alert">{errores.organizacionId}</p>}
        </div>
        <div className="campo">
          <label htmlFor="detalles">Detalles</label>
          <textarea id="detalles" rows={3} value={datos.detalles} onChange={cambiar('detalles')} placeholder="Materiales, recomendaciones y observaciones" />
        </div>

        {mensaje.texto && <p className="error" role="alert">{mensaje.texto}</p>}
        <div className="acciones">
          <button type="button" disabled={enviando} onClick={() => guardar('BORRADOR')}>Guardar borrador</button>
          <button type="button" className="primario" disabled={enviando} onClick={() => guardar('PUBLICAR')}>
            {enviando ? 'Guardando…' : 'Publicar jornada'}
          </button>
        </div>
        <p className="nota">* Campo obligatorio para publicar</p>
      </form>
    </section>
  );
}
