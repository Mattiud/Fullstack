import axios from 'axios';

// Mismo origen que el frontend: Vite (desarrollo) o Render (producción) redirigen /api
// al backend. La sesión viaja en una cookie HttpOnly; el token nunca se maneja en JavaScript.
const client = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let onUnauthorized = null;

// Permite al contexto de autenticación cerrar la sesión local cuando el servidor
// responde 401 (sesión vencida, revocada o cuenta deshabilitada).
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

const RUTAS_SIN_AVISO = ['/auth/login', '/auth/me'];

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const ruta = error.config?.url;
    if (error.response?.status === 401 && !RUTAS_SIN_AVISO.includes(ruta)) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

export function mensajeDeError(
  error,
  porDefecto = 'Ocurrió un error inesperado'
) {
  if (error?.response?.data?.error) return error.response.data.error;
  if (error?.request && !error.response)
    return 'No se pudo conectar con el servidor';
  return porDefecto;
}

export function erroresDeCampos(error) {
  return error?.response?.data?.detalles ?? {};
}

export default client;
