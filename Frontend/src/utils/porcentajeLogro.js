// Misma lógica que Backend/src/utils/contenidoInforme.js: «Total de ítems» y «Logrados»
// solo admiten enteros, y el «% de logro» se calcula como Logrados ÷ Total × 100.

export function normalizarEncabezado(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const COLUMNAS_ENTERAS = ['total de items', 'logrados'];

export function esColumnaEntera(encabezado) {
  return COLUMNAS_ENTERAS.includes(normalizarEncabezado(encabezado));
}

// Posición de las tres columnas del cálculo; null si la tabla no las tiene todas.
export function columnasDeLogro(columnas) {
  const encabezados = columnas.map(normalizarEncabezado);
  const indices = {
    total: encabezados.indexOf('total de items'),
    logrados: encabezados.indexOf('logrados'),
    porcentaje: encabezados.indexOf('% de logro'),
  };
  return Object.values(indices).includes(-1) ? null : indices;
}

function enteroDe(celda) {
  const texto = String(celda ?? '').trim();
  return /^\d+$/.test(texto) ? Number(texto) : null;
}

// «58%» si la fila permite el cálculo; null si no (se usa lo ingresado a mano).
export function porcentajeCalculado(fila, indices) {
  const total = enteroDe(fila[indices.total]);
  const logrados = enteroDe(fila[indices.logrados]);
  if (total === null || logrados === null || total === 0 || logrados > total) {
    return null;
  }
  return `${Math.round((logrados / total) * 100)}%`;
}
