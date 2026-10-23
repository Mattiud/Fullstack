// Validaciones de formulario equivalentes a las del backend (Backend/src/utils/validators.js).
import { hoyParaCampo } from './formato';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_BYTES = 72;

export function validarEmail(valor) {
  if (!valor.trim()) return 'Ingrese el correo';
  if (!EMAIL_RE.test(valor.trim())) return 'Ingrese un correo válido';
  return null;
}

export function validarNombre(valor) {
  const largo = valor.trim().length;
  if (largo === 0) return 'Ingrese el nombre';
  if (largo < 2 || largo > 100)
    return 'El nombre debe tener entre 2 y 100 caracteres';
  return null;
}

export function validarPassword(valor) {
  if (!valor) return 'Ingrese la contraseña';
  if (valor.length < PASSWORD_MIN_LENGTH) {
    return `Debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`;
  }
  if (new TextEncoder().encode(valor).length > PASSWORD_MAX_BYTES) {
    return 'La contraseña es demasiado larga';
  }
  if (!/\p{L}/u.test(valor) || !/\d/.test(valor))
    return 'Debe incluir letras y números';
  return null;
}

export function validarTexto(valor, { etiqueta, obligatorio = true, max }) {
  const largo = (valor ?? '').trim().length;
  if (largo === 0) return obligatorio ? `${etiqueta} es obligatorio` : null;
  if (largo > max) return `${etiqueta} admite como máximo ${max} caracteres`;
  return null;
}

function edadEn(fecha, hoy = new Date()) {
  let edad = hoy.getUTCFullYear() - fecha.getUTCFullYear();
  const mes = hoy.getUTCMonth() - fecha.getUTCMonth();
  if (mes < 0 || (mes === 0 && hoy.getUTCDate() < fecha.getUTCDate()))
    edad -= 1;
  return edad;
}

// Fecha en formato AAAA-MM-DD. Devuelve un Date en UTC o null si no es válida
// (p. ej., 2026-02-30, que Date convertiría en 01/03), como parsearFecha del backend.
function parsearFecha(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return Number.isNaN(fecha.getTime()) ||
    fecha.toISOString().slice(0, 10) !== valor
    ? null
    : fecha;
}

// Edad a partir de una fecha AAAA-MM-DD; null si la fecha no es válida.
// Se calcula respecto de la fecha local de hoy, no la de UTC.
export function edadDesde(valor) {
  const fecha = valor ? parsearFecha(valor) : null;
  return fecha ? edadEn(fecha, parsearFecha(hoyParaCampo())) : null;
}

export function validarFecha(valor, { etiqueta, obligatorio = true }) {
  if (!valor) return obligatorio ? `${etiqueta} es obligatoria` : null;
  if (!parsearFecha(valor)) return `${etiqueta} no es una fecha válida`;
  // Ambas en AAAA-MM-DD: la comparación de texto equivale a la de fechas.
  if (valor > hoyParaCampo()) return `${etiqueta} no puede ser futura`;
  return null;
}

// Se admite cualquier edad; solo se exige una fecha válida y no futura.
export function validarFechaNacimiento(valor) {
  return validarFecha(valor, { etiqueta: 'La fecha de nacimiento' });
}

export function validarTelefono(valor) {
  if (!valor.trim()) return 'El teléfono es obligatorio';
  if (!/^\+?[\d\s()-]+$/.test(valor.trim())) {
    return 'El teléfono no tiene un formato válido';
  }
  const digitos = valor.replace(/\D/g, '').length;
  if (digitos < 8 || digitos > 12)
    return 'El teléfono debe tener entre 8 y 12 dígitos';
  return null;
}

// Elimina las entradas sin error; devuelve un objeto vacío si el formulario es válido.
export function soloErrores(errores) {
  return Object.fromEntries(
    Object.entries(errores).filter(([, mensaje]) => mensaje)
  );
}
