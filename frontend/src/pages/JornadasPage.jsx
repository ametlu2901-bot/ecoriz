import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, formatearFecha } from '../api.js';
import { useAuth } from '../auth.jsx';

const VALIDADORES = ['ENTIDAD', 'ORGANIZACION'];

export default function JornadasPage() {
  const { usuario } = useAuth();
  const [params] = useSearchParams();
  const puedeGestionar = VALIDADORES.includes(usuario.rol);
  const [vista, setVista] = useState(params.get('ver') === 'borradores' && puedeGestionar ? 'BORRADOR' : 'PUBLICADA');
  const [jornadas, setJornadas] = useState([]);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
  const [cerrando, setCerrando] = useState(null); // id de la jornada cuyo cierre se está registrando
  const [resultado, setResultado] = useState('');

  const cargar = useCallback(async () => {
    try { setJornadas(await api.get(`/jornadas?estado=${vista}`)); }
    catch (e) { setMensaje({ tipo: 'error', texto: e.message }); }
  }, [vista]);
  useEffect(() => { cargar(); }, [cargar]);

  async function publicar(id) {
    setMensaje({ tipo: '', texto: '' });
    try { await api.post(`/jornadas/${id}/publicar`); setMensaje({ tipo: 'ok', texto: 'Jornada publicada.' }); await cargar(); }
    catch (e) {
      const detalle = e.campos?.length ? ` ${e.campos.map((c) => c.motivo).join(' ')}` : '';
      setMensaje({ tipo: 'error', texto: `${e.message}${detalle}` });
    }
  }

  async function cerrar(id) {
    setMensaje({ tipo: '', texto: '' });
    try {
      await api.post(`/jornadas/${id}/cierre`, { resultado });
      setMensaje({ tipo: 'ok', texto: 'Jornada cerrada. El reporte vinculado quedó en estado Cerrado.' });
      setCerrando(null); setResultado(''); await cargar();
    } catch (e) {
      const detalle = e.campos?.length ? ` ${e.campos.map((c) => c.motivo).join(' ')}` : '';
      setMensaje({ tipo: 'error', texto: `${e.message}${detalle}` });
    }
  }

  return (
    <section>
      <h1>Jornadas</h1>
      {puedeGestionar && (
        <div className="pestanas" role="group" aria-label="Vista">
          <button type="button" className={vista === 'PUBLICADA' ? 'activo' : ''} onClick={() => setVista('PUBLICADA')}>Actividades disponibles</button>
          <button type="button" className={vista === 'BORRADOR' ? 'activo' : ''} onClick={() => setVista('BORRADOR')}>Mis borradores</button>
        </div>
      )}
      {mensaje.texto && <p className={mensaje.tipo === 'ok' ? 'exito' : 'error'} role={mensaje.tipo === 'ok' ? 'status' : 'alert'}>{mensaje.texto}</p>}
      {jornadas.length === 0 && <p>No hay jornadas en esta lista.</p>}
      <ul className="lista">
        {jornadas.map((j) => (
          <li key={j.id} className="tarjeta">
            <h2>{j.titulo}</h2>
            <p className="nota">{j.tipo === 'LIMPIEZA' ? 'Limpieza' : 'Reciclaje'} · {formatearFecha(j.fechaHora)}</p>
            <p>
              {j.puntoEncuentro ? `Punto de encuentro: ${j.puntoEncuentro}. ` : ''}
              {j.organizacionNombre ? `Organiza: ${j.organizacionNombre}. ` : ''}
              {j.reporteCodigo ? `Atiende el reporte ${j.reporteCodigo}.` : j.zona ? `Zona: ${j.zona}.` : ''}
            </p>
            {j.detalles && <p>{j.detalles}</p>}

            {vista === 'BORRADOR' && <button type="button" className="primario" onClick={() => publicar(j.id)}>Publicar</button>}

            {vista === 'PUBLICADA' && puedeGestionar && j.organizacionId === usuario.organizacionId && (
              cerrando === j.id ? (
                <div>
                  <div className="campo">
                    <label htmlFor={`res-${j.id}`}>Resultado de la jornada *</label>
                    <textarea id={`res-${j.id}`} rows={2} value={resultado} onChange={(e) => setResultado(e.target.value)} />
                  </div>
                  <div className="acciones">
                    <button type="button" onClick={() => { setCerrando(null); setResultado(''); }}>Cancelar</button>
                    <button type="button" className="primario" onClick={() => cerrar(j.id)}>Registrar cierre</button>
                  </div>
                </div>
              ) : <button type="button" onClick={() => setCerrando(j.id)}>Registrar cierre</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
