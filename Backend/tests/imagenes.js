const zlib = require('node:zlib');

// Genera imágenes PNG sintéticas para las pruebas (bandas de color, sin contenido real).

function fragmento(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const tipoYDatos = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(tipoYDatos));
  return Buffer.concat([largo, tipoYDatos, crc]);
}

// Con `idatTruncado`, los datos comprimidos quedan incompletos pero la estructura de
// fragmentos (incluido IEND) es válida: simula un archivo dañado.
function crearPng(ancho, alto, { alfa = false, idatTruncado = false } = {}) {
  const canales = alfa ? 4 : 3;
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8; // bits por canal
  cabecera[9] = alfa ? 6 : 2; // RGBA o RGB
  const filas = [];
  for (let y = 0; y < alto; y += 1) {
    const fila = Buffer.alloc(1 + ancho * canales);
    for (let x = 0; x < ancho; x += 1) {
      const p = 1 + x * canales;
      const enBanda = x < ancho / 3;
      fila[p] = enBanda ? 0xb8 : 0x2b;
      fila[p + 1] = enBanda ? 0x49 : 0x23;
      fila[p + 2] = enBanda ? 0x6f : 0x28;
      if (alfa) fila[p + 3] = 0xff;
    }
    filas.push(fila);
  }
  const comprimido = zlib.deflateSync(Buffer.concat(filas));
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    fragmento('IHDR', cabecera),
    fragmento('IDAT', idatTruncado ? comprimido.subarray(0, comprimido.length / 2) : comprimido),
    fragmento('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { crearPng };
