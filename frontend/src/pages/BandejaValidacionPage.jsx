import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, ETIQUETA_ESTADO, ETIQUETA_TIPO_RESIDUO, formatearFecha } from '../api.js';
import MapaReportes from '../components/MapaReportes.jsx';

export default function BandejaValidacionPage() {
  const [filtros, setFiltros] = useState({ estado: 'PENDIENTE', tipo: '', fecha: '' });
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState({ items: [], total: 0, tamano: 10 });
  const [errorLista, setErrorLista] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);

  const cargarLista = useCallback(async () => {
    const q = new URLSearchParams({ pagina });
    Object.entries(filtros).forEach(([k, v]) => { if (v) q.set(k, v); });
    try { setLista(await api.get(`/reportes?${q}`)); setErrorLista(''); }
    catch (e) { setErrorLista(e.message); }
  }, [filtros, pagina]);

  useEffect(() => { cargarLista(); }, [cargarLista]);

  const cambiarFiltro = (campo) => (e) => { setPagina(1); setFiltros({ ...filtros, [campo]: e.target.value }); };
  const totalPaginas = Math.max(1, Math.ceil(lista.total / lista.tamano));

  return (
    <div>
      <h1>Validación y clasificación de reportes</h1>
      <section className="tarjeta filtros" aria-label="Filtros">
        <div className="campo">
          <label htmlFor="f-estado">Estado</label>
          <select id="f-estado" value={filtros.estado} onChange={cambiarFiltro('estado')}>
            <option value="">Todos</option>
            {Object.entries(ETIQUETA_ESTADO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="f-tipo">Tipo de residuo</label>
          <select id="f-tipo" value={filtros.tipo} onChange={cambiarFiltro('tipo')}>
            <option value="">Todos</option>
            {Object.entries(ETIQUETA_TIPO_RESIDUO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="f-fecha">Fecha de registro</label>
          <input id="f-fecha" type="date" value={filtros.fecha} onChange={cambiarFiltro('fecha')} />
        </div>
      </section>

      <div className="dos-columnas">
        <section className="tarjeta" aria-label="Bandeja">
          {errorLista && <p className="error" role="alert">{errorLista}</p>}
          {lista.items.length === 0 && !errorLista && <p>No hay reportes con estos filtros.</p>}
          <ul className="lista">
            {lista.items.map((r) => (
              <li key={r.id}>
                <button type="button" className={`fila ${seleccionado === r.id ? 'seleccionada' : ''}`} onClick={() => setSeleccionado(r.id)}>
                  <strong>{r.codigo}</strong> <span className={`estado estado-${r.estado}`}>{ETIQUETA_ESTADO[r.estado]}</span>
                  <br /><span className="nota">{r.tipoResiduo ? ETIQUETA_TIPO_RESIDUO[r.tipoResiduo] : 'Sin tipo'} · {formatearFecha(r.fechaCreacion)}</span>
                  <br />{r.descripcion.length > 70 ? `${r.descripcion.slice(0, 70)}…` : r.descripcion}
                </button>
              </li>
            ))}
          </ul>
          <div className="acciones">
            <button type="button" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
            <span>Página {pagina} de {totalPaginas}</span>
            <button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
          </div>
        </section>

        {seleccionado
          ? <PanelDecision key={seleccionado} id={seleccionado} alDecidir={cargarLista} />
          : <section className="tarjeta"><p>Selecciona un reporte de la bandeja para revisarlo.</p></section>}
      </div>
    </div>
  );
}

function PanelDecision({ id, alDecidir }) {
  const [reporte, setReporte] = useState(null);
  const [prioridad, setPrioridad] = useState('');
  const [observacion, setObservacion] = useState('');
  const [duplicadoDe, setDuplicadoDe] = useState('');
  const [mostrarDuplicado, setMostrarDuplicado] = useState(false);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    try { setReporte(await api.get(`/reportes/${id}`)); }
    catch (e) { setMensaje({ tipo: 'error', texto: e.message }); }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  const cercanos = useMemo(() => reporte?.cercanos || [], [reporte]);
  const marcadores = useMemo(
    () => cercanos.map((c) => ({ lat: c.latitud, lng: c.longitud, texto: `${c.codigo} · ${c.distanciaM} m · ${ETIQUETA_ESTADO[c.estado]}` })),
    [cercanos]
  );

  async function decidir(decision) {
    const e = {};
    if (!observacion.trim()) e.observacion = 'La observación es obligatoria.';
    if (decision === 'VALIDAR' && !prioridad) e.prioridad = 'Para validar elige una prioridad.';
    if (decision === 'DUPLICADO' && !duplicadoDe.trim()) e.duplicadoDeCodigo = 'Indica el código del reporte original.';
    setErrores(e);
    if (Object.keys(e).length) return;

    setEnviando(true); setMensaje({ tipo: '', texto: '' });
    try {
      const r = await api.post(`/reportes/${id}/decisiones`, {
        decision, prioridad: prioridad || undefined, observacion, version: reporte.version,
        duplicadoDeCodigo: decision === 'DUPLICADO' ? duplicadoDe.trim() : undefined,
      });
      setMensaje({ tipo: 'ok', texto: `Reporte ${r.codigo} ahora está ${ETIQUETA_ESTADO[r.estado]}.` });
      setObservacion(''); setPrioridad(''); setDuplicadoDe(''); setMostrarDuplicado(false);
      await cargar(); alDecidir();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) setErrores(err.porCampo);
      else if (err instanceof ApiError && err.status === 409) {
        // E2: otra persona decidió primero → se recarga el reporte para decidir de nuevo
        setMensaje({ tipo: 'error', texto: err.message });
        await cargar(); alDecidir();
      } else setMensaje({ tipo: 'error', texto: err.message });
    } finally { setEnviando(false); }
  }

  if (!reporte) return <section className="tarjeta"><p>{mensaje.texto || 'Cargando…'}</p></section>;
  const pendiente = reporte.estado === 'PENDIENTE';

  return (
    <section className="tarjeta" aria-label="Detalle del reporte">
      <h2>{reporte.codigo} <span className={`estado estado-${reporte.estado}`}>{ETIQUETA_ESTADO[reporte.estado]}</span></h2>
      <MapaReportes posicion={{ lat: reporte.latitud, lng: reporte.longitud }} otros={marcadores} altura={220} etiqueta="Ubicación del reporte y reportes cercanos" />
      {reporte.evidencias.map((ev) => <img key={ev.id} src={ev.url} alt="Evidencia del reporte" className="foto" />)}
      <p>{reporte.descripcion}</p>
      <p className="nota">
        {reporte.tipoResiduo ? ETIQUETA_TIPO_RESIDUO[reporte.tipoResiduo] : 'Sin tipo'} · {formatearFecha(reporte.fechaCreacion)}
        {reporte.reportante ? ` · Reportó: ${reporte.reportante.nombre}` : ''}
      </p>
      {cercanos.length > 0 && (
        <p className="aviso">Reportes cercanos: {cercanos.map((c) => `${c.codigo} (${c.distanciaM} m, ${ETIQUETA_ESTADO[c.estado]})`).join(' · ')}</p>
      )}

      {mensaje.texto && <p className={mensaje.tipo === 'ok' ? 'exito' : 'error'} role={mensaje.tipo === 'ok' ? 'status' : 'alert'}>{mensaje.texto}</p>}

      {pendiente ? (
        <>
          <div className="campo">
            <label htmlFor="prioridad">Prioridad</label>
            <select id="prioridad" value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
              <option value="">Seleccionar</option><option value="ALTA">Alta</option><option value="MEDIA">Media</option><option value="BAJA">Baja</option>
            </select>
            {errores.prioridad && <p className="error" role="alert">{errores.prioridad}</p>}
          </div>
          {mostrarDuplicado && (
            <div className="campo">
              <label htmlFor="duplicado">Reporte relacionado (solo al marcar duplicado)</label>
              <input id="duplicado" value={duplicadoDe} onChange={(e) => setDuplicadoDe(e.target.value)} placeholder="RPT-0001" />
              {errores.duplicadoDeCodigo && <p className="error" role="alert">{errores.duplicadoDeCodigo}</p>}
            </div>
          )}
          <div className="campo">
            <label htmlFor="observacion">Observaciones *</label>
            <textarea id="observacion" rows={2} value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Motivo de la decisión" />
            {errores.observacion && <p className="error" role="alert">{errores.observacion}</p>}
          </div>
          <div className="acciones">
            <button type="button" disabled={enviando} onClick={() => decidir('SEGUIMIENTO')}>Mantener pendiente</button>
            <button type="button" disabled={enviando}
              onClick={() => (mostrarDuplicado ? decidir('DUPLICADO') : setMostrarDuplicado(true))}>Marcar duplicado</button>
            <button type="button" disabled={enviando} onClick={() => decidir('RECHAZAR')}>Rechazar</button>
            <button type="button" className="primario" disabled={enviando} onClick={() => decidir('VALIDAR')}>Validar</button>
          </div>
        </>
      ) : (
        <p className="nota">Este reporte ya no está pendiente; no admite nuevas decisiones.</p>
      )}
    </section>
  );
}
