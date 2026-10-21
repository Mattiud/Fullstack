import client from './client';

export async function login(email, password) {
  const { data } = await client.post('/auth/login', { email, password });
  return data.usuario;
}

export async function logout() {
  await client.post('/auth/logout');
}

// Devuelve el usuario de la sesión actual o null si no hay sesión válida.
export async function obtenerSesion() {
  try {
    const { data } = await client.get('/auth/me');
    return data.usuario;
  } catch (error) {
    if (error.response?.status === 401) return null;
    throw error;
  }
}

export async function cambiarPassword(passwordActual, passwordNueva) {
  const { data } = await client.post('/auth/password', {
    passwordActual,
    passwordNueva,
  });
  return data.usuario;
}
