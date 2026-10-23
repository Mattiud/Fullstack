const path = require('node:path');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');
const sanitizeHtml = require('sanitize-html');
const HttpError = require('./httpError');

// Formatos admitidos. Algunos navegadores envían un tipo MIME vacío o genérico para
// DOC/DOCX; en ese caso decide la verificación del contenido real.
const TIPOS = {
  pdf: { extension: '.pdf', mimes: ['application/pdf'] },
  docx: {
    extension: '.docx',
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
  doc: { extension: '.doc', mimes: ['application/msword'] },
};
const MIMES_GENERICOS = ['', 'application/octet-stream'];

const FIRMA_PDF = Buffer.from('%PDF-');
const FIRMA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const FIRMA_OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

// Límite del contenido descomprimido de un DOCX, para frenar archivos "bomba".
const MAX_DESCOMPRIMIDO = 100 * 1024 * 1024;
const MENSAJE_DANADO = 'El archivo está dañado o no se puede leer';

function tipoPorExtension(nombre) {
  const extension = path.extname(nombre).toLowerCase();
  return Object.keys(TIPOS).find((tipo) => TIPOS[tipo].extension === extension) ?? null;
}

// Nombre para mostrar: sin rutas ni caracteres de control, con largo acotado.
function sanearNombre(nombre) {
  // Multer entrega el nombre como latin1; se reinterpreta como UTF-8 cuando corresponde.
  const utf8 = Buffer.from(nombre, 'latin1').toString('utf8');
  const texto = utf8.includes('\uFFFD') ? nombre : utf8;
  const limpio = path
    .basename(texto.replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f"<>|]/g, '')
    .normalize('NFC')
    .trim();
  return (limpio || 'documento').slice(0, 200);
}

// Suma los tamaños descomprimidos declarados en el directorio central del ZIP.
function tamanoDescomprimidoZip(contenido) {
  let total = 0;
  let posicion = contenido.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  while (posicion !== -1 && posicion + 46 <= contenido.length) {
    total += contenido.readUInt32LE(posicion + 24);
    const largoNombre = contenido.readUInt16LE(posicion + 28);
    const largoExtra = contenido.readUInt16LE(posicion + 30);
    const largoComentario = contenido.readUInt16LE(posicion + 32);
    const siguiente = posicion + 46 + largoNombre + largoExtra + largoComentario;
    posicion = contenido.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), siguiente);
  }
  return total;
}

function verificarPdf(contenido) {
  if (!contenido.subarray(0, 5).equals(FIRMA_PDF)) return 'El contenido no corresponde a un PDF';
  if (!contenido.subarray(-1024).includes('%%EOF')) return MENSAJE_DANADO;
  // Contenido activo: acciones JavaScript o de ejecución de programas.
  if (/\/(JavaScript|JS|Launch)\b/.test(contenido.toString('latin1'))) {
    return 'El PDF contiene contenido activo no permitido';
  }
  return null;
}

function verificarDocx(contenido) {
  if (!contenido.subarray(0, 4).equals(FIRMA_ZIP)) {
    return 'El contenido no corresponde a un documento DOCX';
  }
  if (!contenido.includes('word/document.xml')) return 'El contenido no corresponde a un documento DOCX';
  if (contenido.includes('vbaProject.bin')) return 'El documento contiene macros, que no están permitidas';
  if (tamanoDescomprimidoZip(contenido) > MAX_DESCOMPRIMIDO) return MENSAJE_DANADO;
  return null;
}

function verificarDoc(contenido) {
  return contenido.subarray(0, 8).equals(FIRMA_OLE)
    ? null
    : 'El contenido no corresponde a un documento DOC';
}

const VERIFICADORES = { pdf: verificarPdf, docx: verificarDocx, doc: verificarDoc };

// Valida extensión, tipo MIME declarado y contenido real. Devuelve el tipo detectado.
function validarArchivo({ originalname, mimetype, buffer }) {
  const tipo = tipoPorExtension(originalname);
  if (!tipo) {
    throw new HttpError(415, 'Formato no permitido. Solo se aceptan archivos PDF, DOC y DOCX');
  }
  const mime = (mimetype || '').toLowerCase();
  if (!TIPOS[tipo].mimes.includes(mime) && !MIMES_GENERICOS.includes(mime)) {
    throw new HttpError(415, 'El tipo del archivo no coincide con su extensión');
  }
  if (buffer.length === 0) throw new HttpError(400, 'El archivo está vacío');

  const error = VERIFICADORES[tipo](buffer);
  if (error) throw new HttpError(415, error);
  return tipo;
}

function escaparHtml(texto) {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// HTML seguro para el visor: sin scripts, estilos, enlaces ni recursos externos.
function sanearHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
      'sub', 'sup', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th',
      'td', 'img',
    ],
    allowedAttributes: { img: ['src', 'alt'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] },
    // Solo imágenes incrustadas en el propio documento.
    allowedSchemesByTag: { img: ['data'] },
    allowedSchemes: [],
  });
}

// Convierte DOCX (con formato básico) o DOC (solo texto) a HTML. Nunca ejecuta macros:
// únicamente se lee el contenido.
async function convertirAHtml(tipo, contenido) {
  try {
    if (tipo === 'docx') {
      const { value } = await mammoth.convertToHtml({ buffer: contenido });
      return sanearHtml(value);
    }
    if (tipo === 'doc') {
      const documento = await new WordExtractor().extract(contenido);
      const parrafos = documento
        .getBody()
        .split(/\r?\n/)
        .map((linea) => linea.trim())
        .filter(Boolean)
        .map((linea) => `<p>${escaparHtml(linea)}</p>`);
      return parrafos.join('');
    }
  } catch {
    throw new HttpError(422, MENSAJE_DANADO);
  }
  throw new HttpError(415, 'Formato no compatible con el visor');
}

function limites(maxBytes) {
  return {
    maxBytes,
    extensiones: Object.values(TIPOS).map((t) => t.extension),
    mimes: Object.values(TIPOS).flatMap((t) => t.mimes),
  };
}

// Cabecera Content-Disposition con el nombre codificado (RFC 5987).
function contentDisposition(tipo, nombre) {
  const ascii = nombre.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

module.exports = {
  TIPOS,
  validarArchivo,
  sanearNombre,
  convertirAHtml,
  limites,
  contentDisposition,
};
