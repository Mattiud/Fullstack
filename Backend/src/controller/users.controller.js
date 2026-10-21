const mongoose = require('mongoose');
const User = require('../models/User');
const { AUDIT_ACTIONS } = require('../models/AuditLog');
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

module.exports = {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  asignarPasswordTemporal,
};
