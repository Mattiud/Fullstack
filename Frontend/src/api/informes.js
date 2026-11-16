import client, { decodificarError } from './client';

const ruta = (menorId) => `/menores/${menorId}/informes`;

// Listado general: solo los informes de los menores a los que se tiene acceso.
// Filtros opcionales: estado 'pendientes' (sin PDF o con PDF desactualizado) y mes
// (AAAA-MM, según la fecha del informe).
export async function listarInformes({ pagina = 1, estado, mes } = {}) {
  const params = { pagina };
  if (estado) params.estado = estado;
  if (mes) params.mes = mes;
  const { data } = await client.get('/informes', { params });
  return data;
}

export async function listarInformesMenor(menorId) {
  const { data } = await client.get(ruta(menorId));
  return data.informes;
}

export async function obtenerInforme(menorId, informeId) {
  const { data } = await client.get(`${ruta(menorId)}/${informeId}`);
  return data.informe;
}

export async function crearInforme(menorId, datos) {
  const { data } = await client.post(ruta(menorId), datos);
  return data.informe;
}

// `ultimaActualizacion` (updatedAt del informe editado) evita sobrescribir cambios
// guardados por otra persona.
export async function actualizarInforme(
  menorId,
  informeId,
  cambios,
  ultimaActualizacion
) {
  const { data } = await client.patch(`${ruta(menorId)}/${informeId}`, {
    ...cambios,
    ultimaActualizacion,
  });
  return data.informe;
}

// Genera una nueva versión del PDF con el contenido guardado.
export async function generarPdfInforme(
  menorId,
  informeId,
  ultimaActualizacion
) {
  const { data } = await client.post(`${ruta(menorId)}/${informeId}/pdf`, {
    ultimaActualizacion,
  });
  return data;
}

// PDF de revisión con el contenido del formulario (aunque no esté guardado).
export async function vistaPreviaInforme(menorId, informeId, contenido) {
  const url = informeId
    ? `${ruta(menorId)}/${informeId}/vista-previa`
    : `${ruta(menorId)}/vista-previa`;
  try {
    const { data } = await client.post(url, contenido, {
      responseType: 'arraybuffer',
    });
    return data;
  } catch (error) {
    throw decodificarError(error);
  }
}

export async function obtenerPdfInforme(menorId, informeId, version) {
  try {
    const { data } = await client.get(
      `${ruta(menorId)}/${informeId}/pdfs/${version}`,
      { responseType: 'arraybuffer' }
    );
    return data;
  } catch (error) {
    throw decodificarError(error);
  }
}

// Descarga sin exponer una URL pública: el archivo se guarda desde un blob.
export async function descargarPdfInforme(menorId, informe, version) {
  let respuesta;
  try {
    respuesta = await client.get(
      `${ruta(menorId)}/${informe._id}/pdfs/${version}`,
      { params: { descarga: 1 }, responseType: 'arraybuffer' }
    );
  } catch (error) {
    throw decodificarError(error);
  }
  const url = URL.createObjectURL(
    new Blob([respuesta.data], { type: 'application/pdf' })
  );
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `informe-psicopedagogico-${informe.fechaInforme.slice(0, 10)}-v${version}.pdf`;
  enlace.click();
  URL.revokeObjectURL(url);
}
