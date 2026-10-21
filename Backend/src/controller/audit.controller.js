const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS } = AuditLog;
const HttpError = require('../utils/httpError');

const LIMITE_MAXIMO = 100;

async function listarAuditoria(req, res) {
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const limite = Math.min(LIMITE_MAXIMO, Math.max(1, parseInt(req.query.limite, 10) || 50));

  const filtro = {};
  if (req.query.accion !== undefined) {
    if (!Object.values(AUDIT_ACTIONS).includes(req.query.accion)) {
      throw new HttpError(400, 'Acción no válida');
    }
    filtro.accion = req.query.accion;
  }
  if (req.query.usuario !== undefined) {
    if (!mongoose.isValidObjectId(req.query.usuario)) {
      throw new HttpError(400, 'Identificador inválido');
    }
    filtro.usuario = req.query.usuario;
  }

  const [registros, total] = await Promise.all([
    AuditLog.find(filtro)
      .sort({ fecha: -1 })
      .skip((pagina - 1) * limite)
      .limit(limite)
      .populate('usuario', 'nombre email rol')
      .lean(),
    AuditLog.countDocuments(filtro),
  ]);

  res.json({ registros, total, pagina, limite });
}

module.exports = { listarAuditoria };
