const { AUDIT_ACTIONS } = require('../models/AuditLog');
const { registrarAuditoria, rutaDe } = require('../utils/audit');

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Protección CSRF complementaria a la cookie SameSite=Strict: rechaza solicitudes que
// modifican datos desde un origen distinto al frontend. Los navegadores siempre envían
// Origin en estas solicitudes; si falta, se trata de un cliente no navegador
// (por ejemplo, Thunder Client), que no puede reutilizar la cookie de otra persona.
function verifyOrigin(origenPermitido) {
  return async (req, res, next) => {
    const origen = req.get('origin');
    if (METODOS_SEGUROS.has(req.method) || !origen || origen === origenPermitido) {
      return next();
    }

    await registrarAuditoria(req, {
      accion: AUDIT_ACTIONS.ORIGEN_RECHAZADO,
      resultado: 'denegado',
      usuario: null,
      detalle: { metodo: req.method, ruta: rutaDe(req), origen },
    });
    res.status(403).json({ error: 'Origen no permitido' });
  };
}

module.exports = verifyOrigin;
