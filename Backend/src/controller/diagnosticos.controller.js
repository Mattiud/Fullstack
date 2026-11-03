const mongoose = require('mongoose');
const Diagnostico = require('../models/Diagnostico');
const Menor = require('../models/Menor');
const TipoDiagnostico = require('../models/TipoDiagnostico');
const { AUDIT_ACTIONS } = require('../models/AuditLog');
const { ESTADOS_DIAGNOSTICO, CAMPOS_CONTENIDO, CAMPOS_VERSIONADOS, LIMITES } = Diagnostico;
const { filtroMenoresAccesibles } = require('../middleware/menorAccess');
const HttpError = require('../utils/httpError');
const { registrarAuditoria } = require('../utils/audit');
const {
  cuerpoDe,
  exigirCamposPermitidos,
  exigirSinErrores,
  validarTexto,
  validarFecha,
  parsearFecha,
} = require('../utils/validators');

const POR_PAGINA = 20;
const DATOS_AUTOR = 'nombre';
// Datos que muestran los listados: sin la descripción ni las versiones (minimización).
const CAMPOS_RESUMEN =
  'menor tipo tipoPersonalizado fechaEvaluacion estado version actualizadoPor createdAt updatedAt';

const ETIQUETAS = {
  tipo: 'El tipo de diagnóstico',
  fechaEvaluacion: 'La fecha de evaluación',
  instrumento: 'El instrumento aplicado',
  descripcion: 'El campo de descripción y hallazgos',
};

const MENSAJE_TIPO_NO_LISTADO = 'Seleccione un tipo de la lista o elija «Otro»';
const MENSAJE_TIPO_LISTADO = 'Ese tipo ya está en la lista; selecciónelo directamente';

const MENSAJE_DESACTUALIZADO =
  'El diagnóstico fue modificado por otra persona. Recargue la página para ver la versión actual.';

function validarAreas(valor) {
  if (!Array.isArray(valor)) return { error: 'Las áreas afectadas no son válidas' };
  const areas = [];
  for (const area of valor) {
    if (typeof area !== 'string' || !area.trim()) {
      return { error: 'Las áreas afectadas no son válidas' };
    }
    const texto = area.trim().replace(/\s+/g, ' ');
    if (texto.length > LIMITES.area) {
      return { error: `Cada área admite como máximo ${LIMITES.area} caracteres` };
    }
    // Se omiten las repetidas, sin distinguir mayúsculas.
    if (!areas.some((a) => a.toLowerCase() === texto.toLowerCase())) areas.push(texto);
  }
  if (areas.length > LIMITES.areas) {
    return { error: `Se admiten como máximo ${LIMITES.areas} áreas` };
  }
  return { areas };
}

// Valida el formato de los campos de contenido presentes y los normaliza. Un texto
// vacío se devuelve como undefined (el campo queda sin valor). Los obligatorios se
// exigen aparte, según el estado final (exigirCompleto).
function validarContenido(body) {
  const errores = {};
  const datos = {};

  for (const campo of ['tipo', 'instrumento', 'descripcion']) {
    if (!(campo in body)) continue;
    errores[campo] = validarTexto(body[campo], {
      etiqueta: ETIQUETAS[campo],
      obligatorio: false,
      max: LIMITES[campo],
    });
    if (!errores[campo]) datos[campo] = body[campo] ? body[campo].trim() || undefined : undefined;
  }
  // tipoPersonalizado indica el origen del tipo, por lo que solo se acepta junto a él.
  if ('tipoPersonalizado' in body) {
    if (!('tipo' in body)) errores.tipo = 'Indique el tipo de diagnóstico';
    else if (typeof body.tipoPersonalizado !== 'boolean') errores.tipo = 'El tipo de diagnóstico no es válido';
  }
  if ('tipo' in body && !errores.tipo) {
    datos.tipoPersonalizado = Boolean(datos.tipo) && body.tipoPersonalizado === true;
  }
  if ('fechaEvaluacion' in body) {
    errores.fechaEvaluacion = validarFecha(body.fechaEvaluacion, {
      etiqueta: ETIQUETAS.fechaEvaluacion,
      obligatorio: false,
    });
    if (!errores.fechaEvaluacion) {
      datos.fechaEvaluacion = body.fechaEvaluacion ? parsearFecha(body.fechaEvaluacion) : undefined;
    }
  }
  if ('areasAfectadas' in body) {
    const { error, areas } = validarAreas(body.areasAfectadas ?? []);
    errores.areasAfectadas = error;
    if (!error) datos.areasAfectadas = areas;
  }
  if ('estado' in body && !Object.values(ESTADOS_DIAGNOSTICO).includes(body.estado)) {
    errores.estado = 'El estado no es válido';
  }

  exigirSinErrores(errores);
  return datos;
}

// Un tipo que no es «Otro» debe ser una categoría activa del administrador (se guarda
// con su nombre exacto); uno ingresado en «Otro» no puede repetir una categoría activa.
async function resolverTipo(datos) {
  if (!datos.tipo) return;
  const categoria = await TipoDiagnostico.findOne({
    nombreNormalizado: TipoDiagnostico.normalizarNombre(datos.tipo),
    activo: true,
  })
    .select('nombre')
    .lean();
  if (datos.tipoPersonalizado && categoria) {
    exigirSinErrores({ tipo: MENSAJE_TIPO_LISTADO });
  }
  if (!datos.tipoPersonalizado) {
    if (!categoria) exigirSinErrores({ tipo: MENSAJE_TIPO_NO_LISTADO });
    datos.tipo = categoria.nombre;
  }
}

function tieneValor(valor) {
  return Array.isArray(valor) ? valor.length > 0 : valor !== undefined && valor !== null;
}

// Un diagnóstico vigente necesita los campos obligatorios (*) del mockup 1g; un
// borrador, al menos un dato.
function exigirCompleto(contenido, estado) {
  if (estado === ESTADOS_DIAGNOSTICO.VIGENTE) {
    exigirSinErrores(
      Object.fromEntries(
        ['tipo', 'fechaEvaluacion', 'descripcion'].map((campo) => [
          campo,
          tieneValor(contenido[campo])
            ? null
            : `${ETIQUETAS[campo]} es ${campo === 'fechaEvaluacion' ? 'obligatoria' : 'obligatorio'}`,
        ])
      )
    );
  } else if (!CAMPOS_CONTENIDO.some((campo) => tieneValor(contenido[campo]))) {
    throw new HttpError(400, 'Complete al menos un campo para guardar el borrador');
  }
}

function contenidoDe(diagnostico) {
  return Object.fromEntries(CAMPOS_VERSIONADOS.map((campo) => [campo, diagnostico[campo]]));
}

// Compara valores de contenido (textos, fechas y listas de áreas).
function mismoValor(a, b) {
  const normal = (valor) => {
    if (!tieneValor(valor)) return null;
    if (valor instanceof Date) return valor.toISOString();
    return Array.isArray(valor) ? [...valor] : valor;
  };
  return JSON.stringify(normal(a)) === JSON.stringify(normal(b));
}

// El diagnóstico debe pertenecer al menor autorizado: un id ajeno responde 404.
async function buscarDiagnostico(req) {
  const { diagnosticoId } = req.params;
  const diagnostico = mongoose.isValidObjectId(diagnosticoId)
    ? await Diagnostico.findOne({ _id: diagnosticoId, menor: req.menorId })
    : null;
  if (!diagnostico) throw new HttpError(404, 'Diagnóstico no encontrado');
  return diagnostico;
}

function poblarDetalle(diagnostico) {
  return diagnostico.populate([
    { path: 'menor', select: 'nombre' },
    { path: 'creadoPor', select: DATOS_AUTOR },
    { path: 'actualizadoPor', select: DATOS_AUTOR },
    { path: 'versiones.registradoPor', select: DATOS_AUTOR },
  ]);
}

// Solo identificadores, estado y nombres de campos: nunca el contenido clínico.
function auditar(req, accion, diagnostico, campos) {
  return registrarAuditoria(req, {
    accion,
    recurso: 'menor',
    recursoId: req.menorId,
    detalle: {
      diagnosticoId: String(diagnostico._id),
      estado: diagnostico.estado,
      version: diagnostico.version,
      ...(campos ? { campos } : {}),
    },
  });
}

async function listarDiagnosticosMenor(req, res) {
  const diagnosticos = await Diagnostico.find({ menor: req.menorId })
    .select(CAMPOS_RESUMEN)
    .sort({ updatedAt: -1 })
    .populate('actualizadoPor', DATOS_AUTOR)
    .lean();
  res.json({ diagnosticos });
}

// Listado general: solo diagnósticos de los menores a los que el usuario tiene acceso.
async function listarDiagnosticos(req, res) {
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const filtro = {};
  const accesibles = filtroMenoresAccesibles(req.user);
  if (Object.keys(accesibles).length > 0) {
    const menores = await Menor.find(accesibles).distinct('_id');
    filtro.menor = mongoose.trusted({ $in: menores });
  }
  if (Object.values(ESTADOS_DIAGNOSTICO).includes(req.query.estado)) {
    filtro.estado = req.query.estado;
  }

  const [diagnosticos, total] = await Promise.all([
    Diagnostico.find(filtro)
      .select(CAMPOS_RESUMEN)
      .sort({ updatedAt: -1 })
      .skip((pagina - 1) * POR_PAGINA)
      .limit(POR_PAGINA)
      .populate('menor', 'nombre')
      .populate('actualizadoPor', DATOS_AUTOR)
      .lean(),
    Diagnostico.countDocuments(filtro),
  ]);

  res.json({ diagnosticos, total, pagina, limite: POR_PAGINA });
}

async function crearDiagnostico(req, res) {
  const body = cuerpoDe(req);
  // El menor sale siempre de la URL, ya verificada por authorizeMenorAccess.
  exigirCamposPermitidos(body, [...CAMPOS_VERSIONADOS, 'estado']);
  const datos = validarContenido(body);
  const estado = body.estado ?? ESTADOS_DIAGNOSTICO.VIGENTE;
  exigirCompleto(datos, estado);
  await resolverTipo(datos);

  const diagnostico = await Diagnostico.create({
    ...datos,
    menor: req.menorId,
    estado,
    version: estado === ESTADOS_DIAGNOSTICO.VIGENTE ? 1 : 0,
    creadoPor: req.user._id,
    actualizadoPor: req.user._id,
  });

  await auditar(req, AUDIT_ACTIONS.DIAGNOSTICO_CREADO, diagnostico);
  await poblarDetalle(diagnostico);
  res.status(201).json({ diagnostico });
}

async function obtenerDiagnostico(req, res) {
  const diagnostico = await buscarDiagnostico(req);
  await auditar(req, AUDIT_ACTIONS.DIAGNOSTICO_CONSULTADO, diagnostico);
  await poblarDetalle(diagnostico);
  res.json({ diagnostico });
}

async function actualizarDiagnostico(req, res) {
  const body = cuerpoDe(req);
  exigirCamposPermitidos(body, [...CAMPOS_VERSIONADOS, 'estado', 'ultimaActualizacion']);
  const { ultimaActualizacion, ...cambios } = body;
  if (Object.keys(cambios).length === 0) throw new HttpError(400, 'No se indicaron cambios');

  const diagnostico = await buscarDiagnostico(req);

  // Evita sobrescribir sin saberlo los cambios guardados por otra persona.
  const editada = typeof ultimaActualizacion === 'string' ? new Date(ultimaActualizacion) : null;
  if (!editada || Number.isNaN(editada.getTime())) {
    throw new HttpError(400, 'Falta indicar la versión del diagnóstico que se editó');
  }
  if (editada.getTime() !== diagnostico.updatedAt.getTime()) {
    throw new HttpError(409, MENSAJE_DESACTUALIZADO, { codigo: 'DIAGNOSTICO_DESACTUALIZADO' });
  }

  const eraVigente = diagnostico.estado === ESTADOS_DIAGNOSTICO.VIGENTE;
  if (eraVigente && cambios.estado === ESTADOS_DIAGNOSTICO.BORRADOR) {
    throw new HttpError(400, 'Datos inválidos', {
      detalles: { estado: 'Un diagnóstico vigente no puede volver a borrador' },
    });
  }

  const datos = validarContenido(cambios);
  const anterior = contenidoDe(diagnostico);
  const estado = cambios.estado ?? diagnostico.estado;
  exigirCompleto({ ...anterior, ...datos }, estado);
  await resolverTipo(datos);

  const cambiados = CAMPOS_VERSIONADOS.filter(
    (campo) => campo in datos && !mismoValor(datos[campo], anterior[campo])
  );
  // Solo se registran los nombres de los campos modificados, nunca sus valores. El
  // origen del tipo («Otro» o categoría) se informa como parte del campo tipo.
  const campos = CAMPOS_CONTENIDO.filter(
    (campo) =>
      cambiados.includes(campo) || (campo === 'tipo' && cambiados.includes('tipoPersonalizado'))
  );
  const publica = !eraVigente && estado === ESTADOS_DIAGNOSTICO.VIGENTE;

  if (cambiados.length > 0 || publica) {
    if (eraVigente) {
      // La versión actual pasa al historial antes de aplicar los cambios.
      diagnostico.versiones.push({
        ...anterior,
        version: diagnostico.version,
        registradoPor: diagnostico.actualizadoPor,
        fecha: diagnostico.updatedAt,
      });
      diagnostico.version += 1;
    } else if (publica) {
      diagnostico.version = 1;
    }
    for (const campo of cambiados) diagnostico.set(campo, datos[campo]);
    diagnostico.estado = estado;
    diagnostico.actualizadoPor = req.user._id;
    try {
      await diagnostico.save();
    } catch (err) {
      if (err.name === 'VersionError') {
        throw new HttpError(409, MENSAJE_DESACTUALIZADO, { codigo: 'DIAGNOSTICO_DESACTUALIZADO' });
      }
      throw err;
    }
    await auditar(req, AUDIT_ACTIONS.DIAGNOSTICO_ACTUALIZADO, diagnostico, campos);
  }

  await poblarDetalle(diagnostico);
  res.json({ diagnostico, campos });
}

module.exports = {
  listarDiagnosticos,
  listarDiagnosticosMenor,
  crearDiagnostico,
  obtenerDiagnostico,
  actualizarDiagnostico,
};
