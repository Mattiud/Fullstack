import client from './client';

export async function listarUsuarios() {
  const { data } = await client.get('/users');
  return data.usuarios;
}

export async function crearUsuario(datos) {
  const { data } = await client.post('/users', datos);
  return data.usuario;
}

export async function actualizarUsuario(id, cambios) {
  const { data } = await client.patch(`/users/${id}`, cambios);
  return data.usuario;
}

export async function asignarPasswordTemporal(id, password) {
  const { data } = await client.post(`/users/${id}/password-temporal`, {
    password,
  });
  return data.usuario;
}
