import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, ETIQUETA_TIPO_RESIDUO } from '../api.js';
import MapaReportes from '../components/MapaReportes.jsx';

const MAX_BYTES = 5 * 1024 * 1024;

/** Misma regla que el servidor (D-09: se valida en la interfaz y en el servidor). */
function validar({ posicion, descripcion, foto }) {
  const e = {};
  if (!posicion) e.ubicacion = 'Usa tu ubicación o elige un punto en el mapa.';
  if (!descripcion.trim()) e.descripcion = 'La descripción es obligatoria.';
  else if (descripcion.trim().length > 1000) e.descripcion = 'La descripción no puede superar 1000 caracteres.';
  if (!foto) e.foto = 'La evidencia fotográfica es obligatoria.';
  else if (!['image/jpeg', 'image/png'].includes(foto.type)) e.foto = 'La foto debe ser JPEG o PNG.';
  else if (foto.size > MAX_BYTES) e.foto = 'La foto no puede superar 5 MB.';
  return e;
}

export default function NuevoReportePage() {
  const [posicion, setPosicion] = useState(null);
  const [avisoUbicacion, setAvisoUbicacion] = useState('');
  const [cercanos, setCercanos] = useState([]);
  const [tipoResiduo, setTipoResiduo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [foto, setFoto] = useState(null);
  const [errores, setErrores] = useState({});
  const [paso, setPaso] = useState('formulario'); // formulario | resumen | enviado
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');
  const [codigo, setCodigo] = useState('');

  // Pasos 1-2 de CU-01: pedir la ubicación al navegador; si la niega (A1), se elige en el mapa
  useEffect(() => {
    if (!navigator.geolocation) { setAvisoUbicacion('Tu navegador no ofrece ubicación. Elige el punto en el mapa.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setPosicion({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setAvisoUbicacion('No pudimos usar tu ubicación. Elige el punto en el mapa.'),
      { timeout: 8000 }
    );
  }, []);

  // A3: cada vez que cambia el punto, se buscan reportes abiertos cerca
  useEffect(() => {
    if (!posicion) return;
    let activo = true;
    api.get(`/reportes/cercanos?lat=${posicion.lat}&lng=${posicion.lng}`)
      .then((r) => { if (activo) setCercanos(r.reportes); })
      .catch(() => { if (activo) setCercanos([]); });
    return () => { activo = false; };
  }, [posicion]);

  const marcadores = useMemo(
    () => cercanos.map((c) => ({ lat: c.latitud, lng: c.longitud, texto: `${c.codigo} · ${c.distanciaM} m` })),
    [cercanos]
  );

  function revisar(e) {
    e.preventDefault();
    const v = validar({ posicion, descripcion, foto });
    setErrores(v);
    if (Object.keys(v).length === 0) setPaso('resumen');
  }

  async function confirmar() {
    setEnviando(true); setErrorEnvio('');
    const datos = new FormData();
    datos.append('latitud', posicion.lat);
    datos.append('longitud', posicion.lng);
    datos.append('descripcion', descripcion.trim());
    if (tipoResiduo) datos.append('tipoResiduo', tipoResiduo);
    datos.append('foto', foto);
    try {
      const r = await api.post('/reportes', datos);
      setCodigo(r.codigo);
      setPaso('enviado');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        // A2: el servidor indica el campo exacto; se vuelve al formulario con los datos conservados
        setErrores(err.porCampo);
        setPaso('formulario');
      } else {
        // E1/E2: no se muestra una confirmación falsa
        setErrorEnvio(err.message || 'No se pudo guardar el reporte. No se registró nada; intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  }

  function nuevo() {
    setPaso('formulario'); setDescripcion(''); setFoto(null); setTipoResiduo(''); setErrores({}); setCodigo('');
  }

  if (paso === 'enviado') {
    return (
      <section className="tarjeta">
        <h1>Reporte enviado</h1>
        <p>Tu código es <strong className="codigo">{codigo}</strong>. Un validador lo revisará pronto.</p>
        <p><button type="button" className="primario" onClick={nuevo}>Hacer otro reporte</button></p>
      </section>
    );
  }

  if (paso === 'resumen') {
    return (
      <section className="tarjeta">
        <h1>Revisa tu reporte</h1>
        <dl className="resumen">
          <dt>Ubicación</dt><dd>{posicion.lat.toFixed(5)}, {posicion.lng.toFixed(5)}</dd>
          <dt>Tipo de residuo</dt><dd>{tipoResiduo ? ETIQUETA_TIPO_RESIDUO[tipoResiduo] : 'Sin indicar'}</dd>
          <dt>Descripción</dt><dd>{descripcion}</dd>
          <dt>Foto</dt><dd>{foto.name}</dd>
        </dl>
        {errorEnvio && <p className="error" role="alert">{errorEnvio}</p>}
        <div className="acciones">
          <button type="button" onClick={() => setPaso('formulario')} disabled={enviando}>Volver a editar</button>
          <button type="button" className="primario" onClick={confirmar} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Confirmar envío'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="tarjeta">
      <h1>Nuevo reporte de acumulación de residuos</h1>
      <form onSubmit={revisar} noValidate>
        <div className="campo">
          <span className="etiqueta" id="et-ubicacion">Ubicación *</span>
          {avisoUbicacion && <p className="nota">{avisoUbicacion}</p>}
          <MapaReportes posicion={posicion} otros={marcadores} onElegir={(lat, lng) => setPosicion({ lat, lng })}
            etiqueta="Mapa para elegir la ubicación del reporte" />
          <p className="nota">{posicion ? `Punto elegido: ${posicion.lat.toFixed(5)}, ${posicion.lng.toFixed(5)}. Haz clic en el mapa para moverlo.` : 'Haz clic en el mapa para elegir el punto.'}</p>
          {errores.ubicacion && <p className="error" role="alert">{errores.ubicacion}</p>}
        </div>

        {cercanos.length > 0 && (
          <div className="aviso" role="status">
            <strong>Ya hay {cercanos.length === 1 ? 'un reporte abierto' : `${cercanos.length} reportes abiertos`} cerca de este punto.</strong>
            <ul>
              {cercanos.map((c) => (
                <li key={c.id}>{c.codigo} a {c.distanciaM} m — <Link to={`/reportes/${c.id}`} target="_blank">Ver ese reporte</Link></li>
              ))}
            </ul>
            <span className="nota">Si se trata de otra acumulación, continúa con tu reporte.</span>
          </div>
        )}

        <div className="campo">
          <label htmlFor="tipo">Tipo de residuo (opcional)</label>
          <select id="tipo" value={tipoResiduo} onChange={(e) => setTipoResiduo(e.target.value)}>
            <option value="">Seleccionar categoría</option>
            {Object.entries(ETIQUETA_TIPO_RESIDUO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="descripcion">Descripción *</label>
          <textarea id="descripcion" rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Describe la situación observada" aria-invalid={!!errores.descripcion} />
          {errores.descripcion && <p className="error" role="alert">{errores.descripcion}</p>}
        </div>

        <div className="campo">
          <label htmlFor="foto">Evidencia fotográfica * (JPEG o PNG, máx. 5 MB)</label>
          <input id="foto" type="file" accept="image/jpeg,image/png" onChange={(e) => setFoto(e.target.files[0] || null)}
            aria-invalid={!!errores.foto} />
          {errores.foto && <p className="error" role="alert">{errores.foto}</p>}
        </div>

        <div className="acciones">
          <button type="submit" className="primario">Revisar y enviar</button>
        </div>
        <p className="nota">* Campo obligatorio</p>
      </form>
    </section>
  );
}
