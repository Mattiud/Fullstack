import client from './client';

// Listado general (agenda): solo las sesiones de los menores a los que se tiene acceso.
export async function listarSesiones({
  vista = 'proximas',
  mias = false,
  pagina = 1,
} = {}) {
  const params = { vista, pagina };
  if (mias) params.mias = true;
  const { data } = await client.get('/sesiones', { params });
  return data;
}

export async function listarSesionesMenor(menorId) {
  const { data } = await client.get(`/menores/${menorId}/sesiones`);
  return data.sesiones;
}

// Última sesión planificada del menor hasta hoy, para registrar una nueva.
export async function obtenerContextoSesion(menorId) {
  const { data } = await client.get(`/menores/${menorId}/sesiones/contexto`);
  return data.anterior;
}

// Devuelve { sesion, anterior }.
export async function obtenerSesion(menorId, sesionId) {
  const { data } = await client.get(`/menores/${menorId}/sesiones/${sesionId}`);
  return data;
}

export async function crearSesion(menorId, datos) {
  const { data } = await client.post(`/menores/${menorId}/sesiones`, datos);
  return data;
}

// `ultimaActualizacion` (updatedAt de la sesión editada) evita sobrescribir cambios
// guardados por otra persona.
export async function actualizarSesion(
  menorId,
  sesionId,
  cambios,
  ultimaActualizacion
) {
  const { data } = await client.patch(
    `/menores/${menorId}/sesiones/${sesionId}`,
    { ...cambios, ultimaActualizacion }
  );
  return data;
}
