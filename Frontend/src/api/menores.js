import client from './client';

export async function listarMenores({
  q = '',
  estado = 'todos',
  pagina = 1,
} = {}) {
  const params = { pagina };
  if (q.trim()) params.q = q.trim();
  if (estado !== 'todos') params.estado = estado;
  const { data } = await client.get('/menores', { params });
  return data;
}

export async function obtenerMenor(id) {
  const { data } = await client.get(`/menores/${id}`);
  return data.menor;
}

export async function crearMenor(datos) {
  const { data } = await client.post('/menores', datos);
  return data.menor;
}

export async function actualizarMenor(id, cambios) {
  const { data } = await client.patch(`/menores/${id}`, cambios);
  return data.menor;
}

export async function cambiarEstadoMenor(id, activo) {
  const { data } = await client.patch(`/menores/${id}/estado`, { activo });
  return data.menor;
}

export async function asignarProfesionales(id, profesionales) {
  const { data } = await client.put(`/menores/${id}/profesionales`, {
    profesionales,
  });
  return data.menor;
}

export async function obtenerHistorial(id) {
  const { data } = await client.get(`/menores/${id}/historial`);
  return data.historial;
}

export async function listarDocumentos(menorId) {
  const { data } = await client.get(`/menores/${menorId}/documentos`);
  return data;
}

export async function subirDocumento(menorId, archivo, onProgreso) {
  const formulario = new FormData();
  formulario.append('archivo', archivo);
  const { data } = await client.post(
    `/menores/${menorId}/documentos`,
    formulario,
    {
      // El navegador agrega el separador del multipart.
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evento) => {
        if (evento.total) {
          onProgreso?.(Math.round((evento.loaded / evento.total) * 100));
        }
      },
    }
  );
  return data.documento;
}

// Con responseType arraybuffer, los errores JSON del servidor también llegan como
// bytes: se decodifican para poder mostrar su mensaje.
function decodificarError(error) {
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

// Devuelve { formato: 'pdf', datos: ArrayBuffer } o { formato: 'html', html }.
export async function obtenerVistaDocumento(menorId, documentoId) {
  try {
    const respuesta = await client.get(
      `/menores/${menorId}/documentos/${documentoId}/vista`,
      { responseType: 'arraybuffer' }
    );
    const tipo = respuesta.headers['content-type'] ?? '';
    if (tipo.startsWith('application/pdf')) {
      return { formato: 'pdf', datos: respuesta.data };
    }
    return JSON.parse(new TextDecoder().decode(respuesta.data));
  } catch (error) {
    throw decodificarError(error);
  }
}

// Descarga el archivo original sin exponer una URL pública: se guarda desde un blob.
export async function descargarDocumento(menorId, documento) {
  let respuesta;
  try {
    respuesta = await client.get(
      `/menores/${menorId}/documentos/${documento._id}/descarga`,
      { responseType: 'arraybuffer' }
    );
  } catch (error) {
    throw decodificarError(error);
  }
  const url = URL.createObjectURL(
    new Blob([respuesta.data], { type: documento.mimeType })
  );
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = documento.nombreOriginal;
  enlace.click();
  URL.revokeObjectURL(url);
}

export async function eliminarDocumento(menorId, documentoId) {
  await client.delete(`/menores/${menorId}/documentos/${documentoId}`);
}
