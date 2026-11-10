const zlib = require('node:zlib');

// Lectura mínima de los PDF que genera pdfkit, para verificar su contenido en las pruebas.

// Contenido de cada stream, descomprimido cuando corresponde.
function streams(pdf) {
  const texto = pdf.toString('latin1');
  const resultado = [];
  let posicion = texto.indexOf('stream\n');
  while (posicion !== -1) {
    const inicio = posicion + 'stream\n'.length;
    const fin = texto.indexOf('\nendstream', inicio);
    const datos = pdf.subarray(inicio, fin);
    try {
      resultado.push(zlib.inflateSync(datos).toString('latin1'));
    } catch {
      resultado.push(datos.toString('latin1'));
    }
    posicion = texto.indexOf('stream\n', fin + '\nendstream'.length);
  }
  return resultado;
}

// Caracteres de WinAnsi (0x80–0x9F) que difieren de Latin-1.
const WINANSI = {
  0x80: '€',
  0x85: '…',
  0x91: '‘',
  0x92: '’',
  0x93: '“',
  0x94: '”',
  0x95: '•',
  0x96: '–',
  0x97: '—',
};

function decodificarWinAnsi(bytes) {
  return [...bytes].map((b) => WINANSI[b] ?? String.fromCharCode(b)).join('');
}

// Texto de los operadores TJ (pdfkit escribe el texto en hexadecimal, en WinAnsi).
function textoDelPdf(pdf) {
  const lineas = [];
  for (const contenido of streams(pdf)) {
    for (const [, arreglo] of contenido.matchAll(/\[([^\]]*)\] TJ/g)) {
      const partes = [...arreglo.matchAll(/<([0-9a-fA-F]*)>/g)].map(([, hex]) =>
        decodificarWinAnsi(Buffer.from(hex, 'hex'))
      );
      lineas.push(partes.join(''));
    }
  }
  return lineas.join('\n');
}

function totalPaginas(pdf) {
  return Number(/\/Type \/Pages\s*\/Count (\d+)/.exec(pdf.toString('latin1'))?.[1] ?? 0);
}

function tieneImagen(pdf) {
  return /\/Subtype \/Image/.test(pdf.toString('latin1'));
}

// Ancho y alto con que se dibuja cada imagen (matriz "a 0 0 d x y cm" antes de "Do").
function dimensionesImagenes(pdf) {
  const dimensiones = [];
  for (const contenido of streams(pdf)) {
    for (const [, ancho, alto] of contenido.matchAll(
      /([\d.]+) 0 0 (-?[\d.]+) [\d.-]+ [\d.-]+ cm\s*\/I\d+ Do/g
    )) {
      dimensiones.push({ ancho: Number(ancho), alto: Math.abs(Number(alto)) });
    }
  }
  return dimensiones;
}

module.exports = { textoDelPdf, totalPaginas, tieneImagen, dimensionesImagenes };
