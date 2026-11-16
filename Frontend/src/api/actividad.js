import client from './client';

// Últimos cambios visibles para el usuario (panel de inicio).
export async function obtenerActividadReciente() {
  const { data } = await client.get('/actividad-reciente');
  return data.actividad;
}
