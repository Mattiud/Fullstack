const mongoose = require('mongoose');
const ConfiguracionInforme = require('../models/ConfiguracionInforme');
const {
  CLAVE,
  ALINEACIONES,
  POSICIONES_LOGO,
  TAMANOS_LOGO,
  MAX_NOMBRE,
  MAX_PIE,
  MAX_LINEAS_PIE,
  LOGO_MAX_BYTES,
  CAMPOS,
  configuracionPublica,
} = ConfiguracionInforme;
const { AUDIT_ACTIONS } = require('../models/AuditLog');
const HttpError = require('../utils/httpError');
const { registrarAuditoria } = require('../utils/audit');
const { validarLogo, limitesLogo } = require('../utils/imagenes');
const { esImprimible, generarVistaPreviaPdf } = require('../utils/informePdf');
const {
  cuerpoDe,
  exigirCamposPermitidos,
  exigirSinErrores,
  validarTexto,
} = require('../utils/validators');

const MENSAJE_NO_IMPRIMIBLE = 'contiene caracteres que no se pueden imprimir en el PDF (por ejemplo, emojis)';

function validarTextoImprimible(valor, opciones) {
  const error = validarTexto(valor, { ...opciones, obligatorio: false });
  if (error || !valor) return error;
  if (!esImprimible(valor)) return `${opciones.etiqueta} ${MENSAJE_NO_IMPRIMIBLE}`;
  return null;
}

function validarOpcion(valor, permitidas, etiqueta) {
  return permitidas.includes(valor) ? null : `${etiqueta} no es válida`;
}

const VALIDADORES = {
  nombreInstitucion: (valor) => {
    const error = validarTextoImprimible(valor, {
      etiqueta: 'El nombre de la institución',
      max: MAX_NOMBRE,
    });
    if (error) return error;
    return /[\r\n]/.test(valor ?? '') ? 'El nombre de la institución debe ocupar una sola línea' : null;
  },
  alineacionEncabezado: (valor) => validarOpcion(valor, ALINEACIONES, 'La alineación'),
  posicionLogo: (valor) => validarOpcion(valor, POSICIONES_LOGO, 'La posición del logo'),
  tamanoLogo: (valor) => validarOpcion(valor, Object.keys(TAMANOS_LOGO), 'El tamaño del logo'),
  textoPie: (valor) => {
    const error = validarTextoImprimible(valor, {
      etiqueta: 'El texto del pie de página',
      max: MAX_PIE,
    });
    if (error) return error;
    const lineas = (valor ?? '').trim().split(/\r?\n/).length;
    return lineas > MAX_LINEAS_PIE
      ? `El texto del pie de página admite como máximo ${MAX_LINEAS_PIE} líneas`
      : null;
  },
  numeracionPaginas: (valor) =>
    typeof valor === 'boolean' ? null : 'La numeración de páginas debe ser verdadero o falso',
};

// Valida y normaliza las opciones recibidas. Todas son opcionales; se devuelven solo
// las presentes.
function leerOpciones(req) {
  const body = cuerpoDe(req);
  exigirCamposPermitidos(body, CAMPOS);
  exigirSinErrores(
    Object.fromEntries(
      Object.keys(body).map((campo) => [campo, VALIDADORES[campo](body[campo])])
    )
  );
  const opciones = { ...body };
  if ('nombreInstitucion' in opciones) {
    opciones.nombreInstitucion = (opciones.nombreInstitucion ?? '').trim().replace(/\s+/g, ' ');
  }
  if ('textoPie' in opciones) {
    // Líneas sin espacios sobrantes y sin líneas vacías intermedias.
    opciones.textoPie = (opciones.textoPie ?? '')
      .split(/\r?\n/)
      .map((linea) => linea.trim().replace(/[ \t]+/g, ' '))
      .filter(Boolean)
      .join('\n');
  }
  return opciones;
}

function auditar(req, accion, detalle) {
  return registrarAuditoria(req, {
    accion,
    recurso: 'configuracionInforme',
    recursoId: CLAVE,
    detalle,
  });
}

function respuesta(configuracion) {
  return { configuracion: configuracionPublica(configuracion), limitesLogo: limitesLogo(LOGO_MAX_BYTES) };
}

async function obtenerConfiguracion(req, res) {
  res.json(respuesta(await ConfiguracionInforme.findOne({ clave: CLAVE })));
}

async function actualizarConfiguracion(req, res) {
  const opciones = leerOpciones(req);
  if (Object.keys(opciones).length === 0) throw new HttpError(400, 'No se indicaron cambios');

  const anterior = configuracionPublica(await ConfiguracionInforme.findOne({ clave: CLAVE }));
  const campos = Object.keys(opciones).filter((campo) => opciones[campo] !== anterior[campo]);

  // Upsert sobre la clave única: crea la configuración la primera vez y luego la modifica.
  const configuracion = await ConfiguracionInforme.findOneAndUpdate(
    { clave: CLAVE },
    { $set: { ...opciones, actualizadoPor: req.user._id } },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
  );
  if (campos.length > 0) {
    // Solo los nombres de los campos: los textos no se registran.
    await auditar(req, AUDIT_ACTIONS.CONFIG_INFORMES_ACTUALIZADA, { campos });
  }
  res.json(respuesta(configuracion));
}

async function subirLogo(req, res) {
  if (!req.file) throw new HttpError(400, 'Debe adjuntar una imagen');
  const { mimeType, ancho, alto } = validarLogo(req.file);

  const configuracion = await ConfiguracionInforme.findOneAndUpdate(
    { clave: CLAVE },
    {
      $set: {
        logo: {
          datos: req.file.buffer,
          mimeType,
          ancho,
          alto,
          tamano: req.file.size,
          actualizadoEn: new Date(),
        },
        actualizadoPor: req.user._id,
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
  );
  await auditar(req, AUDIT_ACTIONS.LOGO_INFORMES_ACTUALIZADO, { mimeType, ancho, alto });
  res.json(respuesta(configuracion));
}

async function eliminarLogo(req, res) {
  const configuracion = await ConfiguracionInforme.findOneAndUpdate(
    // sanitizeFilter está activo: el operador definido por el servidor se marca como confiable.
    { clave: CLAVE, logo: mongoose.trusted({ $exists: true }) },
    { $unset: { logo: 1 }, $set: { actualizadoPor: req.user._id } },
    { returnDocument: 'after' }
  );
  if (!configuracion) throw new HttpError(404, 'No hay un logo configurado');
  await auditar(req, AUDIT_ACTIONS.LOGO_INFORMES_ELIMINADO);
  res.status(204).end();
}

// Entrega la imagen almacenada sin exponer rutas ni identificadores internos.
async function verLogo(req, res) {
  const configuracion = await ConfiguracionInforme.findOne({ clave: CLAVE }).select('+logo.datos');
  if (!configuracion?.logo?.datos) throw new HttpError(404, 'No hay un logo configurado');
  res.set({
    'Content-Type': configuracion.logo.mimeType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'",
  });
  res.send(configuracion.logo.datos);
}

// PDF de prueba con las opciones del formulario (aunque no estén guardadas) y el logo
// almacenado. Usa datos ficticios y no escribe en la base de datos.
async function vistaPrevia(req, res) {
  const opciones = leerOpciones(req);
  const guardada = await ConfiguracionInforme.obtenerVigente({ conLogo: true });
  const pdf = await generarVistaPreviaPdf({ ...guardada, ...opciones });
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline; filename="vista-previa-informe.pdf"',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  res.send(pdf);
}

module.exports = {
  obtenerConfiguracion,
  actualizarConfiguracion,
  subirLogo,
  eliminarLogo,
  verLogo,
  vistaPrevia,
};
