const mongoose = require('mongoose');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Menor = require('../models/Menor');
const Diagnostico = require('../models/Diagnostico');
const Sesion = require('../models/Sesion');
const Documento = require('../models/Documento');
const Informe = require('../models/Informe');
const TipoDiagnostico = require('../models/TipoDiagnostico');
const ConfiguracionInforme = require('../models/ConfiguracionInforme');
const { AUDIT_ACTIONS } = AuditLog;
const { ROLES } = require('../config/roles');
const HttpError = require('../utils/httpError');
const { registrarAuditoria } = require('../utils/audit');
const { hashPassword } = require('../utils/password');
const {
  cuerpoDe,
  exigirCamposPermitidos,
  exigirSinErrores,
  normalizeEmail,
  validarEmail,
  validarNombre,
  validarRol,
  validarActivo,
  validarPassword,
} = require('../utils/validators');

const CAMPOS_CREACION = ['nombre', 'email', 'password', 'rol'];
const CAMPOS_ACTUALIZACION = ['nombre', 'rol', 'activo'];

async function buscarUsuario(id) {
  const usuario = mongoose.isValidObjectId(id) ? await User.findById(id) : null;
  if (!usuario) {
    throw new HttpError(404, 'Usuario no encontrado');
  }
  return usuario;
}

async function listarUsuarios(req, res) {
  const usuarios = await User.find().sort({ nombre: 1 });
  res.json({ usuarios });
}

async function obtenerUsuario(req, res) {
  res.json({ usuario: await buscarUsuario(req.params.id) });
}

async function crearUsuario(req, res) {
  const body = cuerpoDe(req);
  exigirCamposPermitidos(body, CAMPOS_CREACION);
  exigirSinErrores({
    nombre: validarNombre(body.nombre),
    email: validarEmail(body.email),
    password: validarPassword(body.password),
    rol: validarRol(body.rol),
  });

  const email = normalizeEmail(body.email);
  if (await User.exists({ email })) {
    throw new HttpError(409, 'Ya existe un usuario con ese correo', {
      detalles: { email: 'Ya existe un usuario con ese correo' },
    });
  }

  // La contraseña la define el administrador, por lo que se trata como temporal.
  const usuario = await User.create({
    nombre: body.nombre.trim(),
    email,
    passwordHash: await hashPassword(body.password),
    rol: body.rol,
    debeCambiarPassword: true,
    creadoPor: req.user._id,
    actualizadoPor: req.user._id,
  });

  await registrarAuditoria(req, {
    accion: AUDIT_ACTIONS.USUARIO_CREADO,
    recurso: 'usuario',
    recursoId: usuario._id,
    detalle: { rol: usuario.rol },
  });
  res.status(201).json({ usuario });
}

async function actualizarUsuario(req, res) {
  const body = cuerpoDe(req);
  exigirCamposPermitidos(body, CAMPOS_ACTUALIZACION);
  const campos = Object.keys(body);
  if (campos.length === 0) {
    throw new HttpError(400, 'No se indicaron cambios');
  }
  exigirSinErrores({
    nombre: 'nombre' in body ? validarNombre(body.nombre) : null,
    rol: 'rol' in body ? validarRol(body.rol) : null,
    activo: 'activo' in body ? validarActivo(body.activo) : null,
  });

  const usuario = await buscarUsuario(req.params.id);

  // Evita que el sistema quede sin administradores por una acción sobre la propia cuenta.
  const esPropiaCuenta = usuario._id.equals(req.user._id);
  if (esPropiaCuenta && (('rol' in body && body.rol !== ROLES.ADMIN) || body.activo === false)) {
    throw new HttpError(
      400,
      'No puede quitarse el rol de administrador ni deshabilitar su propia cuenta'
    );
  }

  if ('nombre' in body) usuario.nombre = body.nombre.trim();
  if ('rol' in body) usuario.rol = body.rol;
  if ('activo' in body) usuario.activo = body.activo;

  const modificados = campos.filter((campo) => usuario.isModified(campo));
  if (modificados.length === 0) {
    return res.json({ usuario });
  }

  // Un cambio de rol o de estado cierra las sesiones abiertas del usuario.
  if (usuario.isModified('rol') || usuario.isModified('activo')) {
    usuario.versionSesion += 1;
  }
  usuario.actualizadoPor = req.user._id;
  await usuario.save();

  const detalle = { campos: modificados };
  if (modificados.includes('rol')) detalle.rol = usuario.rol;
  if (modificados.includes('activo')) detalle.activo = usuario.activo;
  await registrarAuditoria(req, {
    accion: AUDIT_ACTIONS.USUARIO_ACTUALIZADO,
    recurso: 'usuario',
    recursoId: usuario._id,
    detalle,
  });
  res.json({ usuario });
}

async function asignarPasswordTemporal(req, res) {
  const body = cuerpoDe(req);
  exigirCamposPermitidos(body, ['password']);
  exigirSinErrores({ password: validarPassword(body.password) });

  const usuario = await buscarUsuario(req.params.id);
  if (usuario._id.equals(req.user._id)) {
    throw new HttpError(400, 'Para su propia cuenta use la opción de cambio de contraseña');
  }

  usuario.passwordHash = await hashPassword(body.password);
  usuario.debeCambiarPassword = true;
  usuario.versionSesion += 1;
  usuario.actualizadoPor = req.user._id;
  await usuario.save();

  await registrarAuditoria(req, {
    accion: AUDIT_ACTIONS.PASSWORD_TEMPORAL_ASIGNADA,
    recurso: 'usuario',
    recursoId: usuario._id,
  });
  res.json({ usuario });
}

// Información que referencia a una cuenta. Si existe alguna, la cuenta no se elimina
// (quedarían registros sin autor ni responsable): se informa y se sugiere desactivarla.
function dependenciasDe(id) {
  // Condiciones sin operadores: sanitizeFilter las acepta sin marcarlas como confiables.
  const alguno = (...campos) => ({ $or: campos.map((campo) => ({ [campo]: id })) });
  return [
    {
      etiqueta: 'menores registrados o asignados',
      modelo: Menor,
      filtro: alguno('creadoPor', 'actualizadoPor', 'profesionalesAsignados'),
    },
    {
      etiqueta: 'diagnósticos',
      modelo: Diagnostico,
      filtro: alguno('creadoPor', 'actualizadoPor', 'versiones.registradoPor'),
    },
    {
      etiqueta: 'sesiones',
      modelo: Sesion,
      filtro: alguno('profesional', 'creadoPor', 'actualizadoPor'),
    },
    { etiqueta: 'documentos', modelo: Documento, filtro: alguno('subidoPor') },
    {
      etiqueta: 'informes',
      modelo: Informe,
      filtro: alguno('creadoPor', 'actualizadoPor', 'pdfs.generadoPor'),
    },
    { etiqueta: 'categorías de diagnóstico', modelo: TipoDiagnostico, filtro: alguno('creadoPor') },
    {
      etiqueta: 'configuración de informes',
      modelo: ConfiguracionInforme,
      filtro: alguno('actualizadoPor'),
    },
    {
      etiqueta: 'otras cuentas creadas o modificadas',
      modelo: User,
      filtro: alguno('creadoPor', 'actualizadoPor'),
    },
    // Su propia actividad (inicios de sesión, cambios, consultas) es parte de la trazabilidad.
    { etiqueta: 'registros de actividad', modelo: AuditLog, filtro: alguno('usuario') },
  ];
}

// Eliminación definitiva, solo para cuentas sin información asociada (por ejemplo, una
// creada por error que nunca se usó). En los demás casos se debe desactivar.
async function eliminarUsuario(req, res) {
  const usuario = await buscarUsuario(req.params.id);
  if (usuario._id.equals(req.user._id)) {
    throw new HttpError(400, 'No puede eliminar su propia cuenta');
  }

  const asociadas = [];
  for (const { etiqueta, modelo, filtro } of dependenciasDe(usuario._id)) {
    if (await modelo.exists(filtro)) asociadas.push(etiqueta);
  }
  if (asociadas.length > 0) {
    throw new HttpError(
      409,
      `No se puede eliminar la cuenta de ${usuario.nombre} porque tiene información asociada (${asociadas.join(', ')}). Desactívela para impedir su acceso sin perder la trazabilidad.`,
      { codigo: 'USUARIO_CON_DEPENDENCIAS', detalles: { dependencias: asociadas } }
    );
  }

  await usuario.deleteOne();
  // Los datos de la cuenta quedan en la auditoría porque la cuenta ya no existe.
  await registrarAuditoria(req, {
    accion: AUDIT_ACTIONS.USUARIO_ELIMINADO,
    recurso: 'usuario',
    recursoId: usuario._id,
    detalle: { nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
  });
  res.status(204).end();
}

module.exports = {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  asignarPasswordTemporal,
  eliminarUsuario,
};
