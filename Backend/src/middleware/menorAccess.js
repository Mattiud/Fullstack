const mongoose = require('mongoose');
const { PERMISSIONS, hasPermission } = require('../config/roles');
const { AUDIT_ACTIONS } = require('../models/AuditLog');
const HttpError = require('../utils/httpError');
const { registrarAuditoria, rutaDe } = require('../utils/audit');

// Acceso a expedientes: el administrador accede a todos; el psicopedagogo solo a los
// menores en cuyo campo `profesionalesAsignados` (arreglo de referencias a User) figura.
// Diagnósticos, sesiones e informes deben resolverse a partir del menor al que pertenecen.

function accedeATodos(user) {
  return hasPermission(user.rol, PERMISSIONS.EXPEDIENTES_TODOS);
}

// Filtro de Mongo para listar únicamente los expedientes accesibles por el usuario.
function filtroMenoresAccesibles(user) {
  return accedeATodos(user) ? {} : { profesionalesAsignados: user._id };
}

// Middleware que verifica el acceso al menor indicado en req.params[param].
// Se usa después de authenticate() y authorize().
function authorizeMenorAccess(MenorModel, param = 'menorId') {
  return async (req, res, next) => {
    const menorId = req.params[param];
    if (!mongoose.isValidObjectId(menorId)) {
      throw new HttpError(400, 'Identificador inválido');
    }

    const menor = await MenorModel.findById(menorId)
      .select('_id profesionalesAsignados')
      .lean();
    if (!menor) {
      throw new HttpError(404, 'Expediente no encontrado');
    }

    const asignado = (menor.profesionalesAsignados || []).some((id) =>
      id.equals(req.user._id)
    );
    if (!accedeATodos(req.user) && !asignado) {
      await registrarAuditoria(req, {
        accion: AUDIT_ACTIONS.ACCESO_DENEGADO,
        resultado: 'denegado',
        recurso: 'menor',
        recursoId: menor._id,
        detalle: { metodo: req.method, ruta: rutaDe(req) },
      });
      throw new HttpError(403, 'No tiene permisos para acceder a este expediente');
    }

    req.menorId = menor._id;
    next();
  };
}

module.exports = { authorizeMenorAccess, filtroMenoresAccesibles };
