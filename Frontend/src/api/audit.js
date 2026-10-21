import client from './client';

export async function listarAuditoria({ limite = 10 } = {}) {
  const { data } = await client.get('/audit-logs', { params: { limite } });
  return data.registros;
}
