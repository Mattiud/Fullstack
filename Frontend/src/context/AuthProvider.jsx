import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './authContext';
import { setUnauthorizedHandler } from '../api/client';
import { login, logout, obtenerSesion } from '../api/auth';

// Estado centralizado de la sesión. Al cargar la aplicación consulta /api/auth/me para
// recuperar la sesión desde la cookie HttpOnly; no se guarda nada en localStorage.
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    obtenerSesion()
      .then((usuarioSesion) => {
        if (vigente) setUsuario(usuarioSesion);
      })
      .catch(() => {
        if (vigente) setUsuario(null);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUsuario(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const iniciarSesion = useCallback(async (email, password) => {
    const usuarioSesion = await login(email, password);
    setUsuario(usuarioSesion);
    return usuarioSesion;
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await logout();
    } finally {
      setUsuario(null);
    }
  }, []);

  const tienePermiso = useCallback(
    (permiso) => Boolean(usuario?.permisos?.includes(permiso)),
    [usuario]
  );

  const valor = useMemo(
    () => ({
      usuario,
      cargando,
      iniciarSesion,
      cerrarSesion,
      tienePermiso,
      actualizarSesion: setUsuario,
    }),
    [usuario, cargando, iniciarSesion, cerrarSesion, tienePermiso]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
