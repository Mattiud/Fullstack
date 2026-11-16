import client, { SOLICITUD_AUTOMATICA } from './client';

export async function login(email, password) {
  const { data } = await client.post('/auth/login', { email, password });
  return data.usuario;
}

export async function logout() {
  await client.post('/auth/logout');
}

// Devuelve el usuario de la sesión actual o null si no hay sesión válida. Es una
// comprobación automática: no cuenta como actividad del usuario.
export async function obtenerSesion() {
  try {
    const { data } = await client.get('/auth/me', {
      headers: SOLICITUD_AUTOMATICA,
    });
    return data.usuario;
  } catch (error) {
    if (error.response?.status === 401) return null;
    throw error;
  }
}

// Actividad del usuario en la pantalla: mantiene abierta la sesión.
export async function registrarActividad() {
  await client.post('/auth/actividad');
}

// Datos que el psicopedagogo define para el pie de sus informes PDF.
export async function guardarDatosProfesionales(datos) {
  const { data } = await client.put('/auth/datos-profesionales', datos);
  return data.usuario;
}

export async function cambiarPassword(passwordActual, passwordNueva) {
  const { data } = await client.post('/auth/password', {
    passwordActual,
    passwordNueva,
  });
  return data.usuario;
}
