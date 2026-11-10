const User = require('../models/User');
const { AUDIT_ACTIONS } = require('../models/AuditLog');
const { LIMITES_DATOS_PROFESIONALES: LIMITES } = require('../config/informes');
const { registrarAuditoria } = require('../utils/audit');
const { serializeUser } = require('../utils/session');
const { esImprimible } = require('../utils/informePdf');
const {
  cuerpoDe,
  exigirCamposPermitidos,
  exigirSinErrores,
  normalizeEmail,
  validarEmail,
  validarTelefono,
  validarTexto,
} = require('../utils/validators');

// Datos profesionales que el psicopedagogo define para el pie de página de sus
// informes PDF. Cada usuario modifica solo los suyos; todos son opcionales.

const CAMPOS = Object.freeze(['tituloProfesional', 'registro', 'correo', 'telefono']);
const ETIQUETAS = Object.freeze({
  tituloProfesional: 'El título profesional',
  registro: 'El número de registro',
  correo: 'El correo',
  telefono: 'El teléfono',
});

function validarCampo(campo, valor) {
  const vacio = valor === undefined || valor === null || valor === '';
  if (vacio) return null;
  const error = validarTexto(valor, {
    etiqueta: ETIQUETAS[campo],
    obligatorio: false,
    max: LIMITES[campo],
  });
  if (error) return error;
  if (!esImprimible(valor)) {
    return `${ETIQUETAS[campo]} contiene caracteres que no se pueden imprimir en el PDF`;
  }
  if (campo === 'correo' && valor.trim()) return validarEmail(valor);
  if (campo === 'telefono' && valor.trim()) return validarTelefono(valor);
  return null;
}

async function actualizarDatosProfesionales(req, res) {
  const body = cuerpoDe(req);
  exigirCamposPermitidos(body, CAMPOS);
  exigirSinErrores(
    Object.fromEntries(CAMPOS.map((campo) => [campo, validarCampo(campo, body[campo])]))
  );

  const datos = {};
  for (const campo of CAMPOS) {
    const valor = typeof body[campo] === 'string' ? body[campo].trim().replace(/\s+/g, ' ') : '';
    if (valor) datos[campo] = campo === 'correo' ? normalizeEmail(valor) : valor;
  }

  const user = await User.findById(req.user._id);
  const anteriores = user.datosProfesionales?.toObject?.() ?? {};
  const campos = CAMPOS.filter((campo) => (anteriores[campo] ?? '') !== (datos[campo] ?? ''));
  if (campos.length > 0) {
    user.datosProfesionales = Object.keys(datos).length > 0 ? datos : undefined;
    await user.save();
    // Solo los nombres de los campos modificados, nunca sus valores.
    await registrarAuditoria(req, {
      accion: AUDIT_ACTIONS.DATOS_PROFESIONALES_ACTUALIZADOS,
      recurso: 'usuario',
      recursoId: user._id,
      detalle: { campos },
    });
  }
  res.json({ usuario: serializeUser(user) });
}

module.exports = { actualizarDatosProfesionales };
