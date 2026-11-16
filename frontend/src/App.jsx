import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NuevoReportePage from './pages/NuevoReportePage.jsx';
import BandejaValidacionPage from './pages/BandejaValidacionPage.jsx';
import CrearJornadaPage from './pages/CrearJornadaPage.jsx';
import JornadasPage from './pages/JornadasPage.jsx';
import ReporteDetallePage from './pages/ReporteDetallePage.jsx';

const VALIDADORES = ['ENTIDAD', 'ORGANIZACION'];
export const inicioPorRol = (rol) => (VALIDADORES.includes(rol) ? '/bandeja' : '/reportes/nuevo');

/** El cliente oculta lo que no corresponde al rol, pero la autorización real la hace el servidor (D-05). */
function Protegida({ roles, children }) {
  const { usuario } = useAuth();
  // Sin sesión todo va al acceso de ciudadanos: /personal no se anuncia en ninguna redirección
  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to={inicioPorRol(usuario.rol)} replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { usuario } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage key="ciudadano" acceso="CIUDADANO" />} />
      <Route path="/personal" element={<LoginPage key="personal" acceso="PERSONAL" />} />
      <Route path="/reportes/nuevo" element={<Protegida roles={['CIUDADANO']}><NuevoReportePage /></Protegida>} />
      <Route path="/reportes/:id" element={<Protegida><ReporteDetallePage /></Protegida>} />
      <Route path="/bandeja" element={<Protegida roles={VALIDADORES}><BandejaValidacionPage /></Protegida>} />
      <Route path="/jornadas/nueva" element={<Protegida roles={VALIDADORES}><CrearJornadaPage /></Protegida>} />
      <Route path="/jornadas" element={<Protegida><JornadasPage /></Protegida>} />
      <Route path="*" element={<Navigate to={usuario ? inicioPorRol(usuario.rol) : '/login'} replace />} />
    </Routes>
  );
}
