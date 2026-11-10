const path = require('node:path');
const zlib = require('node:zlib');
const PDFDocument = require('pdfkit');
const HttpError = require('./httpError');
const { LOGO_MAX_PX } = require('../config/informes');

// Formatos admitidos para el logo institucional. Algunos navegadores envían un tipo
// MIME vacío o genérico; en ese caso decide la verificación del contenido real.
const FORMATOS = {
  png: { extensiones: ['.png'], mime: 'image/png', firma: Buffer.from('89504e470d0a1a0a', 'hex') },
  jpeg: { extensiones: ['.jpg', '.jpeg'], mime: 'image/jpeg', firma: Buffer.from('ffd8ff', 'hex') },
};
const MIMES_GENERICOS = ['', 'application/octet-stream'];
const MENSAJE_DANADO = 'La imagen está dañada o no se puede leer';
const FIN_JPEG = Buffer.from('ffd9', 'hex');

function formatoPorExtension(nombre) {
  const extension = path.extname(nombre || '').toLowerCase();
  return (
    Object.keys(FORMATOS).find((formato) => FORMATOS[formato].extensiones.includes(extension)) ??
    null
  );
}

// Analiza la imagen con el mismo lector que la insertará en el PDF.
function abrirImagen(contenido) {
  try {
    return new PDFDocument({ autoFirstPage: false }).openImage(contenido);
  } catch {
    throw new HttpError(422, MENSAJE_DANADO);
  }
}

// Comprueba que los datos comprimidos del PNG estén completos. El límite de salida
// evita descomprimir más de lo que corresponde a sus dimensiones.
function verificarPng(contenido, imagen) {
  if (contenido.lastIndexOf('IEND') < contenido.length - 64) {
    throw new HttpError(422, MENSAJE_DANADO);
  }
  const png = imagen.image;
  const bytesPorFila = Math.ceil((png.width * (png.pixelBitlength || 64)) / 8);
  const esperado = png.height * (1 + bytesPorFila);
  // Adam7 agrega bytes de filtro por cada pasada.
  const maximo = png.height * (8 + bytesPorFila) + 1024;
  let datos;
  try {
    datos = zlib.inflateSync(png.imgData, { maxOutputLength: maximo });
  } catch {
    throw new HttpError(422, MENSAJE_DANADO);
  }
  if (png.interlaceMethod !== 1 && datos.length < esperado) {
    throw new HttpError(422, MENSAJE_DANADO);
  }
}

function verificarJpeg(contenido) {
  // Marcador de fin de imagen; se toleran bytes de relleno posteriores.
  if (contenido.lastIndexOf(FIN_JPEG) < Math.max(2, contenido.length - 1024)) {
    throw new HttpError(422, MENSAJE_DANADO);
  }
}

// Valida extensión, tipo MIME declarado, firma, integridad y dimensiones.
// Devuelve { mimeType, ancho, alto } con las dimensiones según la orientación EXIF.
function validarLogo({ originalname, mimetype, buffer }) {
  const formato = formatoPorExtension(originalname);
  if (!formato) {
    throw new HttpError(415, 'Formato no permitido. Solo se aceptan imágenes PNG, JPG y JPEG');
  }
  const { mime, firma } = FORMATOS[formato];
  const declarado = (mimetype || '').toLowerCase();
  if (declarado !== mime && !MIMES_GENERICOS.includes(declarado)) {
    throw new HttpError(415, 'El tipo del archivo no coincide con su extensión');
  }
  if (!buffer || buffer.length === 0) throw new HttpError(400, 'El archivo está vacío');
  if (!buffer.subarray(0, firma.length).equals(firma)) {
    throw new HttpError(
      415,
      `El contenido no corresponde a una imagen ${formato === 'png' ? 'PNG' : 'JPEG'}`
    );
  }

  const imagen = abrirImagen(buffer);
  if (!(imagen.width >= 1 && imagen.height >= 1)) throw new HttpError(422, MENSAJE_DANADO);
  if (imagen.width > LOGO_MAX_PX || imagen.height > LOGO_MAX_PX) {
    throw new HttpError(
      422,
      `La imagen no puede superar ${LOGO_MAX_PX} × ${LOGO_MAX_PX} píxeles`
    );
  }
  if (formato === 'png') verificarPng(buffer, imagen);
  else verificarJpeg(buffer);

  const girada = imagen.orientation > 4;
  return {
    mimeType: mime,
    ancho: girada ? imagen.height : imagen.width,
    alto: girada ? imagen.width : imagen.height,
  };
}

function limitesLogo(maxBytes) {
  return {
    maxBytes,
    maxPx: LOGO_MAX_PX,
    extensiones: Object.values(FORMATOS).flatMap((f) => f.extensiones),
    mimes: Object.values(FORMATOS).map((f) => f.mime),
  };
}

module.exports = { validarLogo, limitesLogo };
