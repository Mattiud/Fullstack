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

module.exports = {
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
