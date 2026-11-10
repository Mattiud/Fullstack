const mongoose = require('mongoose');

// Presentación institucional de los informes PDF. Existe un único documento
// (clave "institucional"): se crea o modifica con upsert, nunca se duplica.
// El logo se guarda en el mismo documento (máximo 1 MB): persiste en MongoDB aunque
// el servidor se reinicie. No se cifra porque no contiene datos personales.

const opciones = require('../config/informes');

const {
  ALINEACIONES,
  POSICIONES_LOGO,
  TAMANOS_LOGO,
  MAX_NOMBRE,
  MAX_PIE,
  LOGO_MAX_BYTES,
  LOGO_MAX_PX,
  LOGO_MIMES,
  VALORES_POR_DEFECTO,
} = opciones;

const CLAVE = 'institucional';

const CAMPOS = Object.freeze(Object.keys(VALORES_POR_DEFECTO));

const logoSchema = new mongoose.Schema(
  {
    // Nunca se devuelve en consultas salvo que se pida explícitamente.
    datos: { type: Buffer, required: true, select: false },
    mimeType: { type: String, enum: LOGO_MIMES, required: true },
    // Dimensiones en píxeles, ya corregidas según la orientación EXIF.
    ancho: { type: Number, required: true, min: 1, max: LOGO_MAX_PX },
    alto: { type: Number, required: true, min: 1, max: LOGO_MAX_PX },
    tamano: { type: Number, required: true, max: LOGO_MAX_BYTES },
    actualizadoEn: { type: Date, required: true },
  },
  { _id: false }
);

const configuracionInformeSchema = new mongoose.Schema(
  {
    clave: { type: String, default: CLAVE, enum: [CLAVE], unique: true, immutable: true },
    nombreInstitucion: { type: String, trim: true, maxlength: MAX_NOMBRE, default: '' },
    alineacionEncabezado: {
      type: String,
      enum: ALINEACIONES,
      default: VALORES_POR_DEFECTO.alineacionEncabezado,
    },
    posicionLogo: {
      type: String,
      enum: POSICIONES_LOGO,
      default: VALORES_POR_DEFECTO.posicionLogo,
    },
    tamanoLogo: {
      type: String,
      enum: Object.keys(TAMANOS_LOGO),
      default: VALORES_POR_DEFECTO.tamanoLogo,
    },
    textoPie: { type: String, trim: true, maxlength: MAX_PIE, default: '' },
    numeracionPaginas: { type: Boolean, default: VALORES_POR_DEFECTO.numeracionPaginas },
    logo: { type: logoSchema, default: undefined },
    actualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Representación para la API: opciones y metadatos del logo, sin sus bytes.
function configuracionPublica(origen) {
  const datos = origen?.toObject ? origen.toObject() : origen ?? {};
  const publica = Object.fromEntries(
    CAMPOS.map((campo) => [campo, datos[campo] ?? VALORES_POR_DEFECTO[campo]])
  );
  publica.logo = datos.logo?.mimeType
    ? {
        mimeType: datos.logo.mimeType,
        ancho: datos.logo.ancho,
        alto: datos.logo.alto,
        tamano: datos.logo.tamano,
        actualizadoEn: datos.logo.actualizadoEn,
      }
    : null;
  publica.actualizadoEn = datos.updatedAt ?? null;
  return publica;
}

// Configuración vigente para generar un informe. Si el administrador aún no la ha
// guardado, devuelve los valores por defecto sin crear el registro.
// Con `conLogo`, incluye los bytes del logo en `logo.datos` (Buffer).
configuracionInformeSchema.statics.obtenerVigente = async function obtenerVigente({
  conLogo = false,
} = {}) {
  const consulta = this.findOne({ clave: CLAVE });
  if (conLogo) consulta.select('+logo.datos');
  const documento = await consulta;
  const configuracion = configuracionPublica(documento);
  if (conLogo && configuracion.logo) configuracion.logo.datos = documento.logo.datos;
  return configuracion;
};

configuracionInformeSchema.statics.CLAVE = CLAVE;

module.exports = mongoose.model('ConfiguracionInforme', configuracionInformeSchema);
Object.assign(module.exports, opciones, { CLAVE, CAMPOS, configuracionPublica });
