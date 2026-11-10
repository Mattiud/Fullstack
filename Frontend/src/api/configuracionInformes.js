import client, { decodificarError } from './client';

const RUTA = '/configuracion-informes';

// Devuelve { configuracion, limitesLogo }.
export async function obtenerConfiguracionInformes() {
  const { data } = await client.get(RUTA);
  return data;
}

export async function guardarConfiguracionInformes(opciones) {
  const { data } = await client.put(RUTA, opciones);
  return data.configuracion;
}

export async function subirLogoInformes(archivo, onProgreso) {
  const formulario = new FormData();
  formulario.append('logo', archivo);
  const { data } = await client.put(`${RUTA}/logo`, formulario, {
    // El navegador agrega el separador del multipart.
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evento) => {
      if (evento.total) {
        onProgreso?.(Math.round((evento.loaded / evento.total) * 100));
      }
    },
  });
  return data.configuracion;
}

export async function eliminarLogoInformes() {
  await client.delete(`${RUTA}/logo`);
}

// El logo se pide con la sesión y se muestra desde un blob: no hay enlace público.
export async function obtenerLogoInformes() {
  try {
    const { data, headers } = await client.get(`${RUTA}/logo`, {
      responseType: 'arraybuffer',
    });
    return new Blob([data], { type: headers['content-type'] });
  } catch (error) {
    throw decodificarError(error);
  }
}

// PDF de prueba con datos ficticios y las opciones indicadas (aunque no estén guardadas).
export async function generarVistaPreviaInforme(opciones) {
  try {
    const { data } = await client.post(`${RUTA}/vista-previa`, opciones, {
      responseType: 'arraybuffer',
    });
    return data;
  } catch (error) {
    throw decodificarError(error);
  }
}
