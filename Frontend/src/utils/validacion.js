// Validaciones de formulario equivalentes a las del backend (Backend/src/utils/validators.js).
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

// Elimina las entradas sin error; devuelve un objeto vacío si el formulario es válido.
export function soloErrores(errores) {
  return Object.fromEntries(
    Object.entries(errores).filter(([, mensaje]) => mensaje)
  );
}
