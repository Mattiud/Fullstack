// RUT chileno: formato visual con puntos y guion, y validación del dígito
// verificador (mismo algoritmo que Backend/src/utils/validators.js).

const LARGO_MAXIMO = 9;

// Solo dígitos y K; la K únicamente puede ser el dígito verificador (al final).
export function limpiarRut(valor) {
  return (valor ?? '')
    .toUpperCase()
    .replace(/[^0-9K]/g, '')
    .replace(/K(?=.)/g, '')
    .slice(0, LARGO_MAXIMO);
}

// 212914541 → 21.291.454-1. Acepta entradas con o sin puntos y guion.
export function formatearRut(valor) {
  const limpio = limpiarRut(valor);
  if (limpio.length <= 1) return limpio;
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpo}-${limpio.slice(-1)}`;
}

// Posición en el texto formateado tras `cantidad` caracteres significativos.
export function posicionTrasSignificativos(formateado, cantidad) {
  if (cantidad <= 0) return 0;
  let contados = 0;
  for (let i = 0; i < formateado.length; i += 1) {
    if (/[0-9K]/.test(formateado[i])) contados += 1;
    if (contados === cantidad) return i + 1;
  }
  return formateado.length;
}

function digitoVerificador(cuerpo) {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

export function validarRut(valor) {
  if (!valor.trim()) return 'El RUT es obligatorio';
  const limpio = valor.replace(/[.\s-]/g, '').toUpperCase();
  const coincide = /^(\d{7,8})([\dK])$/.exec(limpio);
  if (!coincide) return 'El RUT no tiene un formato válido';
  if (digitoVerificador(coincide[1]) !== coincide[2]) {
    return 'El dígito verificador del RUT no es válido';
  }
  return null;
}
