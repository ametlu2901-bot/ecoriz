import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { loginPorRol } from '../api.js';

const ENLACES = {
  CIUDADANO: [['/reportes/nuevo', 'Nuevo reporte'], ['/jornadas', 'Jornadas']],
  ENTIDAD: [['/bandeja', 'Validar reportes'], ['/jornadas/nueva', 'Crear jornada'], ['/jornadas', 'Jornadas']],
  ORGANIZACION: [['/bandeja', 'Validar reportes'], ['/jornadas/nueva', 'Crear jornada'], ['/jornadas', 'Jornadas']],
};

export default function Layout({ children }) {
  const { usuario, salir } = useAuth();
  const navegar = useNavigate();
  const enlaces = ENLACES[usuario.rol] || [['/jornadas', 'Jornadas']];

  return (
    <div className="pagina">
      <header className="cabecera">
        <span className="marca">Ecoriz</span>
        <nav aria-label="Principal" className="menu">
          {enlaces.map(([ruta, texto]) => (
            <NavLink key={ruta} to={ruta} end className={({ isActive }) => (isActive ? 'activo' : undefined)}>{texto}</NavLink>
          ))}
        </nav>
        <span className="sesion">
          {usuario.nombre}
          <button type="button" className="enlace" onClick={() => { const destino = loginPorRol(usuario.rol); salir(); navegar(destino); }}>Salir</button>
        </span>
      </header>
      <main className="contenido">{children}</main>
    </div>
  );
}
