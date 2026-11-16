import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from './authContext';
import { setUnauthorizedHandler, setVencimientoHandler } from '../api/client';
import { login, logout, obtenerSesion, registrarActividad } from '../api/auth';
import { INACTIVIDAD_MAXIMA_MS, RENOVACION_MINIMA_MS } from '../constants/auth';

// Interacciones del usuario que cuentan como actividad.
const EVENTOS_ACTIVIDAD = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
// Margen tras el vencimiento antes de comprobarlo con el servidor.
const MARGEN_COMPROBACION_MS = 1000;
// Si la comprobación falla por un problema de conexión, se reintenta.
const REINTENTO_MS = 60 * 1000;

// Estado centralizado de la sesión. Al cargar la aplicación consulta /api/auth/me para
// recuperar la sesión desde la cookie HttpOnly; no se guarda nada en localStorage.
//
// Cierre por inactividad: el servidor renueva la sesión con cada actividad (como
// máximo una vez por hora) e informa el vencimiento en cada respuesta. Al llegar ese
// vencimiento se comprueba con el servidor (otra pestaña pudo renovarla) y, si venció,
// se cierra la sesión local con el aviso correspondiente.
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [sesionVence, setSesionVence] = useState(null);
  // 'inactividad' cuando la sesión se cerró por vencimiento.
  const [motivoCierre, setMotivoCierre] = useState(null);
  const sesionVenceRef = useRef(null);
  sesionVenceRef.current = sesionVence;

  const cerrarPorInactividad = useCallback(() => {
    setMotivoCierre('inactividad');
    setUsuario(null);
    setSesionVence(null);
  }, []);

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
    setUnauthorizedHandler((codigo) => {
      if (codigo === 'SESION_EXPIRADA') cerrarPorInactividad();
      else setUsuario(null);
    });
    setVencimientoHandler((vence) => {
      const instante = Date.parse(vence);
      if (!Number.isNaN(instante)) setSesionVence(instante);
    });
    return () => {
      setUnauthorizedHandler(null);
      setVencimientoHandler(null);
    };
  }, [cerrarPorInactividad]);

  // Comprobación al llegar el vencimiento conocido.
  useEffect(() => {
    if (!usuario || !sesionVence) return undefined;
    let vigente = true;
    let temporizador;

    function comprobar() {
      obtenerSesion()
        .then((usuarioSesion) => {
          if (!vigente) return;
          // Sigue vigente si otra pestaña la renovó: el nuevo vencimiento llega en la
          // respuesta y reprograma esta comprobación.
          if (!usuarioSesion) cerrarPorInactividad();
        })
        .catch(() => {
          if (vigente) temporizador = setTimeout(comprobar, REINTENTO_MS);
        });
    }

    const espera =
      Math.max(0, sesionVence - Date.now()) + MARGEN_COMPROBACION_MS;
    temporizador = setTimeout(comprobar, espera);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [usuario, sesionVence, cerrarPorInactividad]);

  // Actividad en la pantalla sin solicitudes al servidor (por ejemplo, al redactar un
  // informe): se informa como máximo una vez por hora.
  useEffect(() => {
    if (!usuario) return undefined;
    let enviando = false;

    function alInteractuar() {
      const vence = sesionVenceRef.current;
      if (!vence || enviando) return;
      const ultimaRenovacion = vence - INACTIVIDAD_MAXIMA_MS;
      if (Date.now() - ultimaRenovacion < RENOVACION_MINIMA_MS) return;
      enviando = true;
      registrarActividad()
        .catch(() => {})
        .finally(() => {
          enviando = false;
        });
    }

    for (const evento of EVENTOS_ACTIVIDAD) {
      window.addEventListener(evento, alInteractuar, { passive: true });
    }
    return () => {
      for (const evento of EVENTOS_ACTIVIDAD) {
        window.removeEventListener(evento, alInteractuar);
      }
    };
  }, [usuario]);

  const iniciarSesion = useCallback(async (email, password) => {
    const usuarioSesion = await login(email, password);
    setMotivoCierre(null);
    setUsuario(usuarioSesion);
    return usuarioSesion;
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await logout();
    } finally {
      setMotivoCierre(null);
      setSesionVence(null);
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
      motivoCierre,
      iniciarSesion,
      cerrarSesion,
      tienePermiso,
      actualizarSesion: setUsuario,
    }),
    [usuario, cargando, motivoCierre, iniciarSesion, cerrarSesion, tienePermiso]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
