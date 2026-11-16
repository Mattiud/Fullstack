const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const Menor = require('../models/Menor');
const User = require('../models/User');
const { AUDIT_ACTIONS, ACCIONES_HISTORIAL } = AuditLog;
const { PERMISSIONS, hasPermission } = require('../config/roles');
const { filtroMenoresAccesibles } = require('../middleware/menorAccess');

// «Actividad reciente (trazabilidad)» del panel de inicio (mockup 1a). Solo cambios:
// no incluye inicios de sesión, consultas ni descargas. El detalle registrado en la
// auditoría nunca contiene información clínica.

const LIMITE = 6;

// Cambios administrativos que ve quien tiene acceso a la auditoría global.
const ACCIONES_ADMINISTRATIVAS = Object.freeze([
  AUDIT_ACTIONS.USUARIO_CREADO,
  AUDIT_ACTIONS.USUARIO_ACTUALIZADO,
  AUDIT_ACTIONS.PASSWORD_TEMPORAL_ASIGNADA,
  AUDIT_ACTIONS.TIPO_DIAGNOSTICO_CREADO,
  AUDIT_ACTIONS.TIPO_DIAGNOSTICO_ACTUALIZADO,
  AUDIT_ACTIONS.CONFIG_INFORMES_ACTUALIZADA,
  AUDIT_ACTIONS.LOGO_INFORMES_ACTUALIZADO,
  AUDIT_ACTIONS.LOGO_INFORMES_ELIMINADO,
]);

async function obtenerActividadReciente(req, res) {
  const cambiosExpedientes = {
    recurso: 'menor',
    accion: mongoose.trusted({ $in: ACCIONES_HISTORIAL }),
  };
  let filtro;
  if (hasPermission(req.user.rol, PERMISSIONS.AUDITORIA_LEER)) {
    // sanitizeFilter revisa cada condición del $or: cada operador se marca confiable.
    filtro = {
      $or: [
        cambiosExpedientes,
        { accion: mongoose.trusted({ $in: ACCIONES_ADMINISTRATIVAS }) },
      ],
    };
  } else {
    // El psicopedagogo solo ve los cambios de los expedientes a los que tiene acceso.
    const menores = await Menor.find(filtroMenoresAccesibles(req.user)).distinct('_id');
    filtro = {
      ...cambiosExpedientes,
      recursoId: mongoose.trusted({ $in: menores.map(String) }),
    };
  }

  const registros = await AuditLog.find(filtro)
    .sort({ fecha: -1 })
    .limit(LIMITE)
    .populate('usuario', 'nombre')
    .lean();

  // Nombres del menor o de la cuenta afectada, en una consulta por colección.
  const idsDe = (recurso) =>
    registros
      .filter((r) => r.recurso === recurso && mongoose.isValidObjectId(r.recursoId))
      .map((r) => r.recursoId);
  const [menores, usuarios] = await Promise.all([
    Menor.find({ _id: mongoose.trusted({ $in: idsDe('menor') }) }).select('nombre').lean(),
    User.find({ _id: mongoose.trusted({ $in: idsDe('usuario') }) }).select('nombre').lean(),
  ]);
  const nombres = new Map(
    [...menores, ...usuarios].map(({ _id, nombre }) => [String(_id), nombre])
  );

  res.json({
    actividad: registros.map(({ _id, fecha, accion, detalle, usuario, recurso, recursoId }) => ({
      _id,
      fecha,
      accion,
      detalle,
      usuario: usuario ? { nombre: usuario.nombre } : null,
      menor:
        recurso === 'menor' && nombres.has(recursoId)
          ? { _id: recursoId, nombre: nombres.get(recursoId) }
          : null,
      afectado:
        recurso === 'usuario' && nombres.has(recursoId)
          ? { _id: recursoId, nombre: nombres.get(recursoId) }
          : null,
    })),
  });
}

module.exports = { obtenerActividadReciente };
