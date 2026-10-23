const { ROLES } = require('../config/roles');
const HttpError = require('./httpError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// bcrypt ignora los bytes posteriores al 72.
const PASSWORD_MAX_BYTES = 72;
const PASSWORD_MIN_LENGTH = 10;

function cuerpoDe(req) {
  const body = req.body;
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

// Rechaza campos que el cliente no puede asignar (por ejemplo, passwordHash o activo).
function exigirCamposPermitidos(body, permitidos) {
  const extra = Object.keys(body).filter((campo) => !permitidos.includes(campo));
  if (extra.length > 0) {
    throw new HttpError(400, `Campos no permitidos: ${extra.join(', ')}`);
  }
}

function exigirSinErrores(errores) {
  const detalles = Object.fromEntries(
    Object.entries(errores).filter(([, mensaje]) => mensaje)
  );
  if (Object.keys(detalles).length > 0) {
    throw new HttpError(400, 'Datos inválidos', { detalles });
  }
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validarEmail(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return 'El correo es obligatorio';
  }
  const email = normalizeEmail(value);
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return 'El correo no tiene un formato válido';
  }
  return null;
}

function validarNombre(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return 'El nombre es obligatorio';
  }
  const largo = value.trim().length;
  if (largo < 2 || largo > 100) {
    return 'El nombre debe tener entre 2 y 100 caracteres';
  }
  return null;
}

function validarRol(value) {
  return Object.values(ROLES).includes(value) ? null : 'El rol no es válido';
}

function validarActivo(value) {
  return typeof value === 'boolean' ? null : 'El estado debe ser verdadero o falso';
}

function validarPassword(value) {
  if (typeof value !== 'string' || !value) {
    return 'La contraseña es obligatoria';
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`;
  }
  if (Buffer.byteLength(value, 'utf8') > PASSWORD_MAX_BYTES) {
    return 'La contraseña es demasiado larga';
  }
  if (!/\p{L}/u.test(value) || !/\d/.test(value)) {
    return 'La contraseña debe incluir letras y números';
  }
  return null;
}

// Texto obligatorio u opcional con largo máximo. Devuelve el mensaje de error o null.
function validarTexto(value, { etiqueta, obligatorio = true, max }) {
  if (value === undefined || value === null || value === '') {
    return obligatorio ? `${etiqueta} es obligatorio` : null;
  }
  if (typeof value !== 'string') return `${etiqueta} no es válido`;
  const largo = value.trim().length;
  if (obligatorio && largo === 0) return `${etiqueta} es obligatorio`;
  if (largo > max) return `${etiqueta} admite como máximo ${max} caracteres`;
  return null;
}

// RUT chileno sin puntos ni guion, con dígito verificador en mayúscula: 12345678-K.
function normalizarRut(value) {
  if (typeof value !== 'string') return '';
  const limpio = value.replace(/[.\s-]/g, '').toUpperCase();
  return limpio.length > 1 ? `${limpio.slice(0, -1)}-${limpio.slice(-1)}` : limpio;
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

function validarRut(value) {
  if (typeof value !== 'string' || !value.trim()) return 'El RUT es obligatorio';
  const rut = normalizarRut(value);
  const coincide = /^(\d{7,8})-([\dK])$/.exec(rut);
  if (!coincide) return 'El RUT no tiene un formato válido';
  if (digitoVerificador(coincide[1]) !== coincide[2]) {
    return 'El dígito verificador del RUT no es válido';
  }
  return null;
}

// Fecha en formato AAAA-MM-DD. Devuelve un Date en UTC o null si no es válida.
function parsearFecha(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const fecha = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== value
    ? null
    : fecha;
}

function edadEn(fechaNacimiento, referencia = new Date()) {
  let edad = referencia.getUTCFullYear() - fechaNacimiento.getUTCFullYear();
  const mes = referencia.getUTCMonth() - fechaNacimiento.getUTCMonth();
  if (mes < 0 || (mes === 0 && referencia.getUTCDate() < fechaNacimiento.getUTCDate())) {
    edad -= 1;
  }
  return edad;
}

function validarFecha(value, { etiqueta, obligatorio = true }) {
  if (value === undefined || value === null || value === '') {
    return obligatorio ? `${etiqueta} es obligatoria` : null;
  }
  const fecha = parsearFecha(value);
  if (!fecha) return `${etiqueta} no es una fecha válida`;
  if (fecha > new Date()) return `${etiqueta} no puede ser futura`;
  return null;
}

// Se admite cualquier edad; solo se exige una fecha válida y no futura.
function validarFechaNacimiento(value) {
  return validarFecha(value, { etiqueta: 'La fecha de nacimiento' });
}

function validarTelefono(value) {
  if (typeof value !== 'string' || !value.trim()) return 'El teléfono es obligatorio';
  if (!/^\+?[\d\s()-]+$/.test(value.trim())) return 'El teléfono no tiene un formato válido';
  const digitos = value.replace(/\D/g, '').length;
  if (digitos < 8 || digitos > 12) return 'El teléfono debe tener entre 8 y 12 dígitos';
  return null;
}

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  validarTexto,
  normalizarRut,
  validarRut,
  parsearFecha,
  edadEn,
  validarFecha,
  validarFechaNacimiento,
  validarTelefono,
  escaparRegex,
  PASSWORD_MAX_BYTES,
  cuerpoDe,
  exigirCamposPermitidos,
  exigirSinErrores,
  normalizeEmail,
  validarEmail,
  validarNombre,
  validarRol,
  validarActivo,
  validarPassword,
};
