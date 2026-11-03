import client from './client';

// Listado general: solo los diagnósticos de los menores a los que se tiene acceso.
export async function listarDiagnosticos({
  estado = 'todos',
  pagina = 1,
} = {}) {
  const params = { pagina };
  if (estado !== 'todos') params.estado = estado;
  const { data } = await client.get('/diagnosticos', { params });
  return data;
}

export async function listarDiagnosticosMenor(menorId) {
  const { data } = await client.get(`/menores/${menorId}/diagnosticos`);
  return data.diagnosticos;
}

export async function obtenerDiagnostico(menorId, diagnosticoId) {
  const { data } = await client.get(
    `/menores/${menorId}/diagnosticos/${diagnosticoId}`
  );
  return data.diagnostico;
}

export async function crearDiagnostico(menorId, datos) {
  const { data } = await client.post(`/menores/${menorId}/diagnosticos`, datos);
  return data.diagnostico;
}

// `ultimaActualizacion` (updatedAt del diagnóstico editado) evita sobrescribir
// cambios guardados por otra persona.
export async function actualizarDiagnostico(
  menorId,
  diagnosticoId,
  cambios,
  ultimaActualizacion
) {
  const { data } = await client.patch(
    `/menores/${menorId}/diagnosticos/${diagnosticoId}`,
    { ...cambios, ultimaActualizacion }
  );
  return data.diagnostico;
}

export async function listarTiposDiagnostico({
  incluirInactivas = false,
} = {}) {
  const { data } = await client.get('/tipos-diagnostico', {
    params: incluirInactivas ? { incluirInactivas: true } : undefined,
  });
  return data.tipos;
}

export async function crearTipoDiagnostico(nombre) {
  const { data } = await client.post('/tipos-diagnostico', { nombre });
  return data.tipo;
}

export async function actualizarTipoDiagnostico(id, cambios) {
  const { data } = await client.patch(`/tipos-diagnostico/${id}`, cambios);
  return data.tipo;
}
