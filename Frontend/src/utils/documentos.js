import { formatearTamano } from './formato';

// Algunos navegadores no informan el tipo de DOC/DOCX; el backend verifica el contenido.
const MIMES_GENERICOS = ['', 'application/octet-stream'];

// Misma validación previa que el backend: extensión, tipo declarado y tamaño.
export function validarArchivoLocal(archivo, limites) {
  const punto = archivo.name.lastIndexOf('.');
  const extension = punto >= 0 ? archivo.name.slice(punto).toLowerCase() : '';
  if (!limites.extensiones.includes(extension)) {
    return 'Formato no permitido. Solo se aceptan archivos PDF, DOC y DOCX.';
  }
  if (
    !MIMES_GENERICOS.includes(archivo.type) &&
    !limites.mimes.includes(archivo.type)
  ) {
    return 'El tipo del archivo no coincide con su extensión.';
  }
  if (archivo.size === 0) return 'El archivo está vacío.';
  if (archivo.size > limites.maxBytes) {
    return `El archivo supera el tamaño máximo permitido (${formatearTamano(limites.maxBytes)}).`;
  }
  return null;
}
