import axios from 'axios';

// Mismo origen que el frontend: Vite (desarrollo) o Render (producción) redirigen /api
// al backend. La sesión viaja en una cookie HttpOnly; el token nunca se maneja en JavaScript.
const client = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let onUnauthorized = null;
let onVencimiento = null;

// Permite al contexto de autenticación cerrar la sesión local cuando el servidor
// responde 401 (sesión vencida, revocada o cuenta deshabilitada). Recibe el código del
// rechazo ('SESION_EXPIRADA' cuando la sesión se cerró por inactividad).
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// Recibe el vencimiento vigente de la sesión que informa el servidor en cada respuesta.
export function setVencimientoHandler(handler) {
  onVencimiento = handler;
}

// Marca una solicitud como automática: valida la sesión, pero no cuenta como actividad
// del usuario (no la renueva).
export const SOLICITUD_AUTOMATICA = { 'X-Solicitud-Automatica': '1' };

const RUTAS_SIN_AVISO = ['/auth/login', '/auth/me'];

// Comunica un vencimiento informado por el servidor (se exporta para las pruebas).
export function registrarVencimiento(vence) {
  if (vence) onVencimiento?.(vence);
}

function informarVencimiento(response) {
  registrarVencimiento(response?.headers?.['x-sesion-vence']);
}

client.interceptors.response.use(
  (response) => {
    informarVencimiento(response);
    return response;
  },
  (error) => {
    informarVencimiento(error.response);
    const ruta = error.config?.url;
    const codigo = error.response?.data?.codigo;
    // El cierre por inactividad se informa siempre, también al comprobar la sesión
    // al abrir la aplicación.
    if (
      error.response?.status === 401 &&
      (!RUTAS_SIN_AVISO.includes(ruta) || codigo === 'SESION_EXPIRADA')
    ) {
      onUnauthorized?.(codigo);
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

// Con responseType arraybuffer, los errores JSON del servidor también llegan como
// bytes: se decodifican para poder mostrar su mensaje.
export function decodificarError(error) {
  const datos = error.response?.data;
  if (datos instanceof ArrayBuffer) {
    try {
      error.response.data = JSON.parse(new TextDecoder().decode(datos));
    } catch {
      error.response.data = {};
    }
  }
  return error;
}

export function erroresDeCampos(error) {
  return error?.response?.data?.detalles ?? {};
}

export default client;
