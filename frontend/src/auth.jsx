import { createContext, useContext, useState, useCallback } from 'react';
import { api, leerSesion, guardarSesion, borrarSesion } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(() => leerSesion());

  const entrar = useCallback(async (correo, contrasena, acceso) => {
    const datos = await api.post('/auth/login', { correo, contrasena, acceso });
    guardarSesion(datos);
    setSesion(datos);
    return datos.usuario;
  }, []);

  const salir = useCallback(() => { borrarSesion(); setSesion(null); }, []);

  return (
    <AuthContext.Provider value={{ usuario: sesion?.usuario || null, entrar, salir }}>
      {children}
    </AuthContext.Provider>
  );
}
