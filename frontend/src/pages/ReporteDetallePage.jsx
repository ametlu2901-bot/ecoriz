import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ETIQUETA_ESTADO, ETIQUETA_TIPO_RESIDUO, formatearFecha } from '../api.js';
import MapaReportes from '../components/MapaReportes.jsx';

/** Vista de solo lectura. Los datos personales llegan filtrados por rol desde el servidor (RNF-05). */
export default function ReporteDetallePage() {
  const { id } = useParams();
  const [reporte, setReporte] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/reportes/${id}`).then(setReporte).catch((e) => setError(e.message));
    api.get(`/reportes/${id}/historial`).then(setHistorial).catch(() => setHistorial([]));
  }, [id]);

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!reporte) return <p>Cargando…</p>;

  return (
    <section className="tarjeta">
      <h1>{reporte.codigo} <span className={`estado estado-${reporte.estado}`}>{ETIQUETA_ESTADO[reporte.estado]}</span></h1>
      <MapaReportes posicion={{ lat: reporte.latitud, lng: reporte.longitud }} altura={240} etiqueta="Ubicación del reporte" />
      <dl className="resumen">
        <dt>Tipo de residuo</dt><dd>{reporte.tipoResiduo ? ETIQUETA_TIPO_RESIDUO[reporte.tipoResiduo] : 'Sin indicar'}</dd>
        <dt>Descripción</dt><dd>{reporte.descripcion}</dd>
        <dt>Registrado</dt><dd>{formatearFecha(reporte.fechaCreacion)}</dd>
        {reporte.prioridad && (<><dt>Prioridad</dt><dd>{reporte.prioridad}</dd></>)}
        {reporte.reportante && (<><dt>Reportado por</dt><dd>{reporte.reportante.nombre}{reporte.reportante.correo ? ` (${reporte.reportante.correo})` : ''}</dd></>)}
      </dl>
      {reporte.evidencias.map((e) => <img key={e.id} src={e.url} alt="Evidencia del reporte" className="foto" />)}
      {historial.length > 0 && (
        <>
          <h2>Historial</h2>
          <ul className="historial">
            {historial.map((h) => (
              <li key={h.id}>
                <strong>{ETIQUETA_ESTADO[h.estadoNuevo]}</strong> · {h.responsable} · {formatearFecha(h.fecha)}
                <br />{h.observacion}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
