const mongoose = require('mongoose');
const Sesion = require('../models/Sesion');
const Diagnostico = require('../models/Diagnostico');
const Menor = require('../models/Menor');
const { AUDIT_ACTIONS } = require('../models/AuditLog');
const { ESTADOS_SESION, ASISTENCIAS, LIMITES } = Sesion;
const { ESTADOS_DIAGNOSTICO } = Diagnostico;
const { filtroMenoresAccesibles } = require('../middleware/menorAccess');
const HttpError = require('../utils/httpError');
const { registrarAuditoria } = require('../utils/audit');
const {
  cuerpoDe,
  exigirCamposPermitidos,
  exigirSinErrores,
  validarTexto,
  validarHora,
  parsearFecha,
  hoyEnChile,
} = require('../utils/validators');

const POR_PAGINA = 20;
const DATOS_AUTOR = 'nombre';
// Los listados no incluyen las observaciones ni el texto de objetivos y actividades
// (minimización): solo lo necesario para contarlos.
const CAMPOS_RESUMEN =
  'menor profesional estado fecha horaInicio horaFin objetivos.logrado actividades asistencia actualizadoPor createdAt updatedAt';

// Campos que el profesional puede asignar (mockup 1h).
const CAMPOS_EDITABLES = Object.freeze([
  'diagnostico',
  'fecha',
  'horaInicio',
  'horaFin',
  'objetivos',
  'actividades',
  'asistencia',
  'observaciones',
]);

const VISTAS = Object.freeze(['proximas', 'anteriores', 'borradores']);

const MENSAJE_DESACTUALIZADO =
  'La sesión fue modificada por otra persona. Recargue la página para ver la versión actual.';

function fechaISO(fecha) {
  return fecha ? new Date(fecha).toISOString().slice(0, 10) : null;
}

function tieneValor(valor) {
  return Array.isArray(valor) ? valor.length > 0 : valor !== undefined && valor !== null;
}

function validarObjetivos(valor) {
  if (!Array.isArray(valor)) return { error: 'Los objetivos no son válidos' };
  if (valor.length > LIMITES.objetivos) {
    return { error: `Se admiten como máximo ${LIMITES.objetivos} objetivos` };
  }
  const objetivos = [];
  for (const item of valor) {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      Object.keys(item).some((clave) => !['descripcion', 'logrado'].includes(clave))
    ) {
      return { error: 'Los objetivos no son válidos' };
    }
    if (typeof item.descripcion !== 'string' || !item.descripcion.trim()) {
      return { error: 'Cada objetivo debe tener una descripción' };
    }
    const descripcion = item.descripcion.trim();
    if (descripcion.length > LIMITES.objetivo) {
      return { error: `Cada objetivo admite como máximo ${LIMITES.objetivo} caracteres` };
    }
    if (item.logrado !== undefined && item.logrado !== null && typeof item.logrado !== 'boolean') {
      return { error: 'El logro de los objetivos no es válido' };
    }
    objetivos.push(
      typeof item.logrado === 'boolean' ? { descripcion, logrado: item.logrado } : { descripcion }
    );
  }
  return { objetivos };
}

function validarActividades(valor) {
  if (!Array.isArray(valor)) return { error: 'Las actividades no son válidas' };
  if (valor.length > LIMITES.actividades) {
    return { error: `Se admiten como máximo ${LIMITES.actividades} actividades` };
  }
  const actividades = [];
  for (const actividad of valor) {
    if (typeof actividad !== 'string' || !actividad.trim()) {
      return { error: 'Cada actividad debe tener una descripción' };
    }
    if (actividad.trim().length > LIMITES.actividad) {
      return { error: `Cada actividad admite como máximo ${LIMITES.actividad} caracteres` };
    }
    actividades.push(actividad.trim());
  }
  return { actividades };
}

// Valida el formato de los campos presentes y los normaliza. Un valor vacío se
// devuelve como undefined (el campo queda sin valor). Los obligatorios y las reglas
// entre campos se exigen aparte, sobre el resultado final.
function validarContenido(body) {
  const errores = {};
  const datos = {};

  if ('diagnostico' in body) {
    const valor = body.diagnostico;
    if (valor === null || valor === '') datos.diagnostico = undefined;
    else if (typeof valor === 'string' && mongoose.isValidObjectId(valor)) datos.diagnostico = valor;
    else errores.diagnostico = 'El diagnóstico no es válido';
  }
  if ('fecha' in body) {
    if (body.fecha === null || body.fecha === '') datos.fecha = undefined;
    else {
      datos.fecha = parsearFecha(body.fecha);
      if (!datos.fecha) errores.fecha = 'La fecha no es válida';
    }
  }
  for (const [campo, etiqueta] of [
    ['horaInicio', 'La hora de inicio'],
    ['horaFin', 'La hora de término'],
  ]) {
    if (!(campo in body)) continue;
    errores[campo] = validarHora(body[campo], { etiqueta, obligatorio: false });
    if (!errores[campo]) datos[campo] = body[campo] || undefined;
  }
  if ('objetivos' in body) {
    const { error, objetivos } = validarObjetivos(body.objetivos ?? []);
    errores.objetivos = error;
    if (!error) datos.objetivos = objetivos;
  }
  if ('actividades' in body) {
    const { error, actividades } = validarActividades(body.actividades ?? []);
    errores.actividades = error;
    if (!error) datos.actividades = actividades;
  }
  if ('asistencia' in body) {
    if (body.asistencia === null || body.asistencia === '') datos.asistencia = undefined;
    else if (Object.values(ASISTENCIAS).includes(body.asistencia)) datos.asistencia = body.asistencia;
    else errores.asistencia = 'La asistencia no es válida';
  }
  if ('observaciones' in body) {
    errores.observaciones = validarTexto(body.observaciones, {
      etiqueta: 'El campo de observaciones',
      obligatorio: false,
      max: LIMITES.observaciones,
    });
    if (!errores.observaciones) {
      datos.observaciones = body.observaciones ? body.observaciones.trim() || undefined : undefined;
    }
  }
  if ('estado' in body && !Object.values(ESTADOS_SESION).includes(body.estado)) {
    errores.estado = 'El estado no es válido';
  }

  exigirSinErrores(errores);
  return datos;
}

// Una sesión planificada necesita fecha, horario, al menos un objetivo y una
// actividad (T08 y campos * del mockup 1h); un borrador, al menos un dato.
function exigirCompleto(sesion, estado) {
  const errores = {};
  if (estado === ESTADOS_SESION.PLANIFICADA) {
    if (!sesion.fecha) errores.fecha = 'La fecha es obligatoria';
    if (!sesion.horaInicio) errores.horaInicio = 'La hora de inicio es obligatoria';
    if (!sesion.horaFin) errores.horaFin = 'La hora de término es obligatoria';
    if (!tieneValor(sesion.objetivos)) errores.objetivos = 'Agregue al menos un objetivo';
    if (!tieneValor(sesion.actividades)) errores.actividades = 'Agregue al menos una actividad';
  } else if (
    !['diagnostico', 'fecha', 'horaInicio', 'horaFin', 'objetivos', 'actividades'].some((campo) =>
      tieneValor(sesion[campo])
    )
  ) {
    throw new HttpError(400, 'Complete al menos un campo para guardar el borrador');
  }
  if (sesion.horaInicio && sesion.horaFin && sesion.horaFin <= sesion.horaInicio) {
    errores.horaFin = 'La hora de término debe ser posterior a la de inicio';
  }
  exigirSinErrores(errores);
}

function tieneRegistroPostSesion(sesion) {
  return (
    Boolean(sesion.asistencia) ||
    Boolean(sesion.observaciones) ||
    (sesion.objetivos ?? []).some((objetivo) => typeof objetivo.logrado === 'boolean')
  );
}

// El registro post-sesión (asistencia, observaciones y logro de objetivos) solo se
// completa en sesiones planificadas, desde el día de la sesión.
function exigirRegistroPostSesion(final, estado, anterior = null, cambios = {}) {
  if (!tieneRegistroPostSesion(final)) return;
  if (estado === ESTADOS_SESION.PLANIFICADA && final.fecha && fechaISO(final.fecha) <= hoyEnChile()) {
    return;
  }
  if (anterior && tieneRegistroPostSesion(anterior) && 'fecha' in cambios) {
    exigirSinErrores({
      fecha: 'La sesión ya tiene registro post-sesión; no puede trasladarse a una fecha futura',
    });
  }
  exigirSinErrores({
    registroPostSesion:
      estado === ESTADOS_SESION.PLANIFICADA
        ? 'El registro post-sesión se habilita desde la fecha de la sesión'
        : 'El registro post-sesión solo se completa en sesiones planificadas',
  });
}

// El diagnóstico debe ser un diagnóstico vigente del mismo menor. Se guarda su versión
// al asociarlo; si no cambia, se conserva la versión registrada.
async function resolverDiagnostico(req, datos, anterior = {}) {
  if (!('diagnostico' in datos)) return;
  if (!datos.diagnostico) {
    datos.diagnosticoVersion = undefined;
    return;
  }
  if (anterior.diagnostico && String(anterior.diagnostico) === datos.diagnostico) {
    delete datos.diagnostico;
    return;
  }
  const diagnostico = await Diagnostico.findOne({
    _id: datos.diagnostico,
    menor: req.menorId,
    estado: ESTADOS_DIAGNOSTICO.VIGENTE,
  })
    .select('version')
    .lean();
  if (!diagnostico) {
    exigirSinErrores({ diagnostico: 'Seleccione un diagnóstico vigente de este menor' });
  }
  datos.diagnosticoVersion = diagnostico.version;
}

function contenidoDe(sesion) {
  const objeto = sesion.toObject();
  return Object.fromEntries(
    [...CAMPOS_EDITABLES, 'diagnosticoVersion'].map((campo) => [campo, objeto[campo]])
  );
}

// Compara valores de contenido (textos, fechas, referencias y listas).
function mismoValor(a, b) {
  const normal = (valor) => {
    if (!tieneValor(valor)) return null;
    if (valor instanceof Date) return valor.toISOString();
    if (valor instanceof mongoose.Types.ObjectId) return String(valor);
    return valor;
  };
  return JSON.stringify(normal(a)) === JSON.stringify(normal(b));
}

// Nombres de los campos modificados para la auditoría. El logro de los objetivos se
// informa aparte de su descripción.
function camposModificados(cambiados, datos, anterior) {
  const campos = [];
  for (const campo of cambiados) {
    if (campo === 'diagnosticoVersion') continue;
    if (campo !== 'objetivos') {
      campos.push(campo);
      continue;
    }
    const descripciones = (lista = []) => lista.map((o) => o.descripcion);
    const logros = (lista = []) => lista.map((o) => o.logrado ?? null);
    if (!mismoValor(descripciones(datos.objetivos), descripciones(anterior.objetivos))) {
      campos.push('objetivos');
    }
    if (!mismoValor(logros(datos.objetivos), logros(anterior.objetivos))) {
      campos.push('logroObjetivos');
    }
  }
  return campos;
}

function ordenCronologico(a, b) {
  return (
    a.fecha - b.fecha ||
    a.horaInicio.localeCompare(b.horaInicio) ||
    new Date(a.createdAt) - new Date(b.createdAt)
  );
}

// Datos de resumen de una sesión para los listados.
function resumen({ objetivos = [], actividades = [], ...sesion }) {
  return {
    ...sesion,
    totalObjetivos: objetivos.length,
    objetivosLogrados: objetivos.filter((o) => o.logrado === true).length,
    totalActividades: actividades.length,
  };
}

// Número de la sesión entre las planificadas del menor ("Sesión 15" del mockup 1h) y
// la sesión planificada anterior, para el panel "Contexto del menor". Sin una sesión
// planificada, la anterior es la última hasta su fecha (o hasta hoy).
async function contextoCronologico(menorId, sesion) {
  const planificadas = await Sesion.find({ menor: menorId, estado: ESTADOS_SESION.PLANIFICADA })
    .select('fecha horaInicio horaFin objetivos.logrado asistencia observaciones createdAt')
    .lean();
  planificadas.sort(ordenCronologico);

  let indice;
  if (sesion?.estado === ESTADOS_SESION.PLANIFICADA) {
    indice = planificadas.findIndex((s) => s._id.equals(sesion._id));
  } else {
    const referencia = sesion?.fecha ? fechaISO(sesion.fecha) : hoyEnChile();
    indice = planificadas.filter((s) => fechaISO(s.fecha) <= referencia).length;
  }

  const previa = indice > 0 ? planificadas[indice - 1] : null;
  return {
    numero: sesion?.estado === ESTADOS_SESION.PLANIFICADA ? indice + 1 : null,
    anterior: previa && {
      _id: previa._id,
      fecha: previa.fecha,
      horaInicio: previa.horaInicio,
      horaFin: previa.horaFin,
      asistencia: previa.asistencia,
      observaciones: previa.observaciones,
      totalObjetivos: previa.objetivos.length,
      objetivosLogrados: previa.objetivos.filter((o) => o.logrado === true).length,
    },
  };
}

// La sesión debe pertenecer al menor autorizado: un id ajeno responde 404.
async function buscarSesion(req) {
  const { sesionId } = req.params;
  const sesion = mongoose.isValidObjectId(sesionId)
    ? await Sesion.findOne({ _id: sesionId, menor: req.menorId })
    : null;
  if (!sesion) throw new HttpError(404, 'Sesión no encontrada');
  return sesion;
}

async function detalle(sesion) {
  await sesion.populate([
    { path: 'menor', select: 'nombre' },
    { path: 'profesional', select: DATOS_AUTOR },
    { path: 'diagnostico', select: 'tipo tipoPersonalizado estado version fechaEvaluacion' },
    { path: 'creadoPor', select: DATOS_AUTOR },
    { path: 'actualizadoPor', select: DATOS_AUTOR },
  ]);
  const { numero, anterior } = await contextoCronologico(sesion.menor._id, sesion);
  return { sesion: { ...sesion.toJSON(), numero }, anterior };
}

// Solo identificadores, estado y nombres de campos: nunca el contenido de la sesión.
// `publicada` indica que un borrador pasó a sesión planificada.
function auditar(req, accion, sesion, campos, publicada = false) {
  return registrarAuditoria(req, {
    accion,
    recurso: 'menor',
    recursoId: req.menorId,
    detalle: {
      sesionId: String(sesion._id),
      estado: sesion.estado,
      ...(campos ? { campos } : {}),
      ...(publicada ? { publicada } : {}),
    },
  });
}

// Pestaña "Sesiones" de la ficha: borradores primero y luego las planificadas, de la
// más reciente a la más antigua, numeradas en orden cronológico.
async function listarSesionesMenor(req, res) {
  const sesiones = await Sesion.find({ menor: req.menorId })
    .select(CAMPOS_RESUMEN)
    .populate('profesional', DATOS_AUTOR)
    .populate('actualizadoPor', DATOS_AUTOR)
    .lean();

  const borradores = sesiones
    .filter((s) => s.estado === ESTADOS_SESION.BORRADOR)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((s) => ({ ...resumen(s), numero: null }));
  const planificadas = sesiones
    .filter((s) => s.estado === ESTADOS_SESION.PLANIFICADA)
    .sort(ordenCronologico)
    .map((s, i) => ({ ...resumen(s), numero: i + 1 }))
    .reverse();

  res.json({ sesiones: [...borradores, ...planificadas] });
}

// Listado general (agenda): solo sesiones de los menores a los que se tiene acceso.
async function listarSesiones(req, res) {
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const vista = VISTAS.includes(req.query.vista) ? req.query.vista : 'proximas';
  const filtro = {};
  const accesibles = filtroMenoresAccesibles(req.user);
  if (Object.keys(accesibles).length > 0) {
    const menores = await Menor.find(accesibles).distinct('_id');
    filtro.menor = mongoose.trusted({ $in: menores });
  }
  if (req.query.mias === 'true') filtro.profesional = req.user._id;

  const hoy = parsearFecha(hoyEnChile());
  let orden;
  if (vista === 'borradores') {
    filtro.estado = ESTADOS_SESION.BORRADOR;
    orden = { updatedAt: -1 };
  } else if (vista === 'anteriores') {
    filtro.estado = ESTADOS_SESION.PLANIFICADA;
    filtro.fecha = mongoose.trusted({ $lt: hoy });
    orden = { fecha: -1, horaInicio: -1, createdAt: -1 };
  } else {
    filtro.estado = ESTADOS_SESION.PLANIFICADA;
    filtro.fecha = mongoose.trusted({ $gte: hoy });
    orden = { fecha: 1, horaInicio: 1, createdAt: 1 };
  }

  const [sesiones, total] = await Promise.all([
    Sesion.find(filtro)
      .select(CAMPOS_RESUMEN)
      .sort(orden)
      .skip((pagina - 1) * POR_PAGINA)
      .limit(POR_PAGINA)
      .populate('menor', 'nombre')
      .populate('profesional', DATOS_AUTOR)
      .populate('actualizadoPor', DATOS_AUTOR)
      .lean(),
    Sesion.countDocuments(filtro),
  ]);

  res.json({ sesiones: sesiones.map(resumen), total, pagina, limite: POR_PAGINA, vista });
}

// Contexto para registrar una sesión nueva: la última sesión planificada hasta hoy.
async function contextoSesion(req, res) {
  const { anterior } = await contextoCronologico(req.menorId, null);
  res.json({ anterior });
}

async function crearSesion(req, res) {
  const body = cuerpoDe(req);
  // El menor sale siempre de la URL, ya verificada por authorizeMenorAccess.
  exigirCamposPermitidos(body, [...CAMPOS_EDITABLES, 'estado']);
  const datos = validarContenido(body);
  const estado = body.estado ?? ESTADOS_SESION.PLANIFICADA;
  exigirCompleto(datos, estado);
  exigirRegistroPostSesion(datos, estado);
  await resolverDiagnostico(req, datos);

  const sesion = await Sesion.create({
    ...datos,
    menor: req.menorId,
    profesional: req.user._id,
    estado,
    creadoPor: req.user._id,
    actualizadoPor: req.user._id,
  });

  await auditar(req, AUDIT_ACTIONS.SESION_CREADA, sesion);
  res.status(201).json(await detalle(sesion));
}

async function obtenerSesion(req, res) {
  const sesion = await buscarSesion(req);
  await auditar(req, AUDIT_ACTIONS.SESION_CONSULTADA, sesion);
  res.json(await detalle(sesion));
}

async function actualizarSesion(req, res) {
  const body = cuerpoDe(req);
  exigirCamposPermitidos(body, [...CAMPOS_EDITABLES, 'estado', 'ultimaActualizacion']);
  const { ultimaActualizacion, ...cambios } = body;
  if (Object.keys(cambios).length === 0) throw new HttpError(400, 'No se indicaron cambios');

  const sesion = await buscarSesion(req);

  // Evita sobrescribir sin saberlo los cambios guardados por otra persona.
  const editada = typeof ultimaActualizacion === 'string' ? new Date(ultimaActualizacion) : null;
  if (!editada || Number.isNaN(editada.getTime())) {
    throw new HttpError(400, 'Falta indicar la versión de la sesión que se editó');
  }
  if (editada.getTime() !== sesion.updatedAt.getTime()) {
    throw new HttpError(409, MENSAJE_DESACTUALIZADO, { codigo: 'SESION_DESACTUALIZADA' });
  }

  const eraPlanificada = sesion.estado === ESTADOS_SESION.PLANIFICADA;
  if (eraPlanificada && cambios.estado === ESTADOS_SESION.BORRADOR) {
    throw new HttpError(400, 'Datos inválidos', {
      detalles: { estado: 'Una sesión planificada no puede volver a borrador' },
    });
  }

  const datos = validarContenido(cambios);
  const anterior = contenidoDe(sesion);
  const estado = cambios.estado ?? sesion.estado;
  const final = { ...anterior, ...datos };
  exigirCompleto(final, estado);
  exigirRegistroPostSesion(final, estado, anterior, datos);
  await resolverDiagnostico(req, datos, anterior);

  const cambiados = Object.keys(datos).filter((campo) => !mismoValor(datos[campo], anterior[campo]));
  const campos = camposModificados(cambiados, datos, anterior);
  const publica = !eraPlanificada && estado === ESTADOS_SESION.PLANIFICADA;

  if (cambiados.length > 0 || publica) {
    for (const campo of cambiados) sesion.set(campo, datos[campo]);
    sesion.estado = estado;
    sesion.actualizadoPor = req.user._id;
    try {
      await sesion.save();
    } catch (err) {
      if (err.name === 'VersionError') {
        throw new HttpError(409, MENSAJE_DESACTUALIZADO, { codigo: 'SESION_DESACTUALIZADA' });
      }
      throw err;
    }
    await auditar(req, AUDIT_ACTIONS.SESION_ACTUALIZADA, sesion, campos, publica);
  }

  res.json({ ...(await detalle(sesion)), campos });
}

module.exports = {
  listarSesiones,
  listarSesionesMenor,
  contextoSesion,
  crearSesion,
  obtenerSesion,
  actualizarSesion,
};
