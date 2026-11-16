import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { inicioPorRol } from '../App.jsx';

// Dos accesos separados y sin enlaces entre sí: ciudadanos en /login y personal en /personal.
// El servidor también revisa que la cuenta corresponda al acceso usado.
const TEXTOS = {
  CIUDADANO: {
    etiqueta: null,
    descripcion: 'Reporta acumulaciones de residuos y sigue las jornadas de limpieza.',
  },
  PERSONAL: {
    etiqueta: 'Panel de gestión',
    descripcion: 'Acceso para entidades y organizaciones que validan reportes y coordinan jornadas.',
  },
};

export default function LoginPage({ acceso = 'CIUDADANO' }) {
  const { usuario, entrar } = useAuth();
  const navegar = useNavigate();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const t = TEXTOS[acceso];

  if (usuario) return <Navigate to={inicioPorRol(usuario.rol)} replace />;

  async function enviar(e) {
    e.preventDefault();
    setError(''); setEnviando(true);
    try {
      const u = await entrar(correo, contrasena, acceso);
      navegar(inicioPorRol(u.rol));
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={acceso === 'PERSONAL' ? 'login login-personal' : 'login'}>
      {t.etiqueta && <span className="etiqueta-acceso">{t.etiqueta}</span>}
      <h1>Ecoriz</h1>
      <p>{t.descripcion}</p>
      <form onSubmit={enviar} noValidate>
        <div className="campo">
          <label htmlFor="correo">Correo</label>
          <input id="correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="username" />
        </div>
        <div className="campo">
          <label htmlFor="contrasena">Contraseña</label>
          <input id="contrasena" type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="primario" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
