const mongoose = require('mongoose');
const TipoDiagnostico = require('../models/TipoDiagnostico');
const { MAX_NOMBRE, normalizarNombre } = TipoDiagnostico;
const { AUDIT_ACTIONS } = require('../models/AuditLog');
const { PERMISSIONS, hasPermission } = require('../config/roles');
const HttpError = require('../utils/httpError');
const { registrarAuditoria } = require('../utils/audit');
const {
  cuerpoDe,
  exigirCamposPermitidos,
  exigirSinErrores,
  validarTexto,
  validarActivo,
} = require('../utils/validators');

const MENSAJE_DUPLICADO = 'Ya existe una categoría con ese nombre';

function validarNombreTipo(nombre) {
  return validarTexto(nombre, { etiqueta: 'El nombre de la categoría', max: MAX_NOMBRE });
}

async function exigirNombreDisponible(nombre, excluirId) {
  const filtro = { nombreNormalizado: normalizarNombre(nombre) };
  if (excluirId) filtro._id = mongoose.trusted({ $ne: excluirId });
  if (await TipoDiagnostico.exists(filtro)) {
    throw new HttpError(409, MENSAJE_DUPLICADO, { detalles: { nombre: MENSAJE_DUPLICADO } });
  }
}

function auditar(req, accion, tipo, detalle) {
  return registrarAuditoria(req, {
    accion,
    recurso: 'tipoDiagnostico',
    recursoId: tipo._id,
    detalle,
  });
}

// Sugerencias para el campo "Tipo de diagnóstico". El administrador puede pedir
// también las inactivas para gestionarlas.
async function listarTipos(req, res) {
  const incluirInactivas =
    req.query.incluirInactivas === 'true' &&
    hasPermission(req.user.rol, PERMISSIONS.DIAGNOSTICOS_TIPOS);
  const tipos = await TipoDiagnostico.find(incluirInactivas ? {} : { activo: true })
    .select('nombre activo')
    .collation({ locale: 'es' })
    .sort({ nombre: 1 })
    .lean();
  res.json({ tipos });
}

async function crearTipo(req, res) {
  const body = cuerpoDe(req);
  exigirCamposPermitidos(body, ['nombre']);
  exigirSinErrores({ nombre: validarNombreTipo(body.nombre) });
  const nombre = body.nombre.trim().replace(/\s+/g, ' ');
  await exigirNombreDisponible(nombre);

  const tipo = await TipoDiagnostico.create({ nombre, creadoPor: req.user._id });
  await auditar(req, AUDIT_ACTIONS.TIPO_DIAGNOSTICO_CREADO, tipo);
  res.status(201).json({ tipo });
}

async function actualizarTipo(req, res) {
  const body = cuerpoDe(req);
  exigirCamposPermitidos(body, ['nombre', 'activo']);
  if (Object.keys(body).length === 0) throw new HttpError(400, 'No se indicaron cambios');
  exigirSinErrores({
    nombre: 'nombre' in body ? validarNombreTipo(body.nombre) : null,
    activo: 'activo' in body ? validarActivo(body.activo) : null,
  });

  const { id } = req.params;
  const tipo = mongoose.isValidObjectId(id) ? await TipoDiagnostico.findById(id) : null;
  if (!tipo) throw new HttpError(404, 'Categoría no encontrada');

  if ('nombre' in body) {
    const nombre = body.nombre.trim().replace(/\s+/g, ' ');
    await exigirNombreDisponible(nombre, tipo._id);
    tipo.nombre = nombre;
  }
  if ('activo' in body) tipo.activo = body.activo;

  const campos = ['nombre', 'activo'].filter((campo) => tipo.isModified(campo));
  if (campos.length > 0) {
    await tipo.save();
    await auditar(req, AUDIT_ACTIONS.TIPO_DIAGNOSTICO_ACTUALIZADO, tipo, {
      campos,
      activo: tipo.activo,
    });
  }
  res.json({ tipo });
}

module.exports = { listarTipos, crearTipo, actualizarTipo };
