const mongoose = require('mongoose');
const Menor = require('../models/Menor');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS, ACCIONES_HISTORIAL } = AuditLog;
const { ROLES } = require('../config/roles');
const { filtroMenoresAccesibles } = require('../middleware/menorAccess');
const HttpError = require('../utils/httpError');
const { registrarAuditoria } = require('../utils/audit');
const {
  cuerpoDe,
  exigirCamposPermitidos,
  exigirSinErrores,
  validarTexto,
  normalizarRut,
  validarRut,
  parsearFecha,
  edadEn,
  validarFecha,
  validarFechaNacimiento,
  validarTelefono,
  escaparRegex,
} = require('../utils/validators');

const CAMPOS_MENOR = [
  'nombre',
  'rut',
  'fechaNacimiento',
  'establecimiento',
  'curso',
  'fechaIngreso',
  'apoderado',
  'antecedentesRelevantes',
];
const CAMPOS_APODERADO = ['nombre', 'parentesco', 'telefono'];
const POR_PAGINA = 20;
const DATOS_PROFESIONAL = 'nombre email rol activo';

const MENSAJE_APODERADO_OBLIGATORIO =
  'Los datos del apoderado son obligatorios para menores de 18 años';

// Valida y normaliza los datos del menor. En una actualización (parcial) solo se
// revisan los campos presentes y `actual` es el registro guardado. El apoderado se
// envía completo, o null para quitarlo.
function validarMenor(body, { parcial, actual = null }) {
  exigirCamposPermitidos(body, CAMPOS_MENOR);
  const presente = (campo) => !parcial || campo in body;
  const errores = {};

  if (presente('nombre')) {
    errores.nombre = validarTexto(body.nombre, { etiqueta: 'El nombre', max: 100 });
  }
  if (presente('rut')) errores.rut = validarRut(body.rut);
  if (presente('fechaNacimiento')) errores.fechaNacimiento = validarFechaNacimiento(body.fechaNacimiento);
  if (presente('establecimiento')) {
    errores.establecimiento = validarTexto(body.establecimiento, {
      etiqueta: 'El establecimiento',
      obligatorio: false,
      max: 150,
    });
  }
  if (presente('curso')) {
    errores.curso = validarTexto(body.curso, { etiqueta: 'El curso', obligatorio: false, max: 50 });
  }
  if ('fechaIngreso' in body) {
    errores.fechaIngreso = validarFecha(body.fechaIngreso, { etiqueta: 'La fecha de ingreso' });
  }
  if (presente('antecedentesRelevantes')) {
    errores.antecedentesRelevantes = validarTexto(body.antecedentesRelevantes, {
      etiqueta: 'El campo de antecedentes relevantes',
      max: 5000,
    });
  }
  if ('apoderado' in body && body.apoderado !== null) {
    const apoderado = body.apoderado;
    if (!apoderado || typeof apoderado !== 'object' || Array.isArray(apoderado)) {
      errores.apoderado = 'Los datos del apoderado no son válidos';
    } else {
      exigirCamposPermitidos(apoderado, CAMPOS_APODERADO);
      errores['apoderado.nombre'] = validarTexto(apoderado.nombre, {
        etiqueta: 'El nombre del apoderado',
        max: 100,
      });
      errores['apoderado.parentesco'] = validarTexto(apoderado.parentesco, {
        etiqueta: 'El parentesco',
        max: 50,
      });
      errores['apoderado.telefono'] = validarTelefono(apoderado.telefono);
    }
  }

  // El apoderado es obligatorio solo para personas menores de 18 años.
  const fechaNacimiento =
    'fechaNacimiento' in body ? parsearFecha(body.fechaNacimiento) : actual?.fechaNacimiento;
  const tendraApoderado =
    'apoderado' in body ? body.apoderado !== null : Boolean(actual?.apoderado);
  if (fechaNacimiento && edadEn(fechaNacimiento) < 18 && !tendraApoderado && !errores.apoderado) {
    errores.apoderado = MENSAJE_APODERADO_OBLIGATORIO;
  }
  exigirSinErrores(errores);

  const datos = {};
  for (const campo of ['nombre', 'establecimiento', 'curso', 'antecedentesRelevantes']) {
    if (campo in body) datos[campo] = body[campo] ? body[campo].trim() : undefined;
  }
  if ('rut' in body) datos.rut = normalizarRut(body.rut);
  if ('fechaNacimiento' in body) datos.fechaNacimiento = parsearFecha(body.fechaNacimiento);
  if ('fechaIngreso' in body) datos.fechaIngreso = parsearFecha(body.fechaIngreso);
  if ('apoderado' in body) {
    datos.apoderado =
      body.apoderado === null
        ? null
        : Object.fromEntries(
            CAMPOS_APODERADO.map((campo) => [campo, body.apoderado[campo].trim()])
          );
  }
  return datos;
}

async function exigirRutDisponible(rut, excluirId) {
  const filtro = excluirId ? { rut, _id: mongoose.trusted({ $ne: excluirId }) } : { rut };
  if (await Menor.exists(filtro)) {
    throw new HttpError(409, 'Ya existe un menor registrado con ese RUT', {
      detalles: { rut: 'Ya existe un menor registrado con ese RUT' },
    });
  }
}

// Filtro de búsqueda por nombre o RUT (con o sin puntos y guion).
function filtroBusqueda(q) {
  const texto = q.trim().slice(0, 100);
  if (!texto) return null;
  const condiciones = [{ nombre: mongoose.trusted({ $regex: escaparRegex(texto), $options: 'i' }) }];
  const rut = texto.replace(/[.\s-]/g, '').toUpperCase();
  if (/^[\dK]+$/.test(rut)) {
    condiciones.push({ rut: mongoose.trusted({ $regex: `^${rut.split('').join('-?')}` }) });
  }
  return { $or: condiciones };
}

async function listarMenores(req, res) {
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const filtro = { ...filtroMenoresAccesibles(req.user) };
  if (req.query.estado === 'activos') filtro.activo = true;
  if (req.query.estado === 'inactivos') filtro.activo = false;
  const busqueda = typeof req.query.q === 'string' ? filtroBusqueda(req.query.q) : null;
  if (busqueda) Object.assign(filtro, busqueda);

  const [menores, total] = await Promise.all([
    Menor.find(filtro)
      .select('nombre fechaNacimiento apoderado.nombre activo')
      .sort({ nombre: 1 })
      .skip((pagina - 1) * POR_PAGINA)
      .limit(POR_PAGINA)
      .lean(),
    Menor.countDocuments(filtro),
  ]);

  // Solo los datos que muestra el listado (minimización).
  res.json({
    menores: menores.map((menor) => ({
      _id: menor._id,
      nombre: menor.nombre,
      edad: edadEn(menor.fechaNacimiento),
      apoderado: menor.apoderado ? { nombre: menor.apoderado.nombre } : null,
      activo: menor.activo,
    })),
    total,
    pagina,
    limite: POR_PAGINA,
  });
}

async function crearMenor(req, res) {
  const datos = validarMenor(cuerpoDe(req), { parcial: false });
  await exigirRutDisponible(datos.rut);

  // Quien registra al menor queda asignado como profesional responsable.
  const menor = await Menor.create({
    ...datos,
    profesionalesAsignados: [req.user._id],
    creadoPor: req.user._id,
    actualizadoPor: req.user._id,
  });

  await registrarAuditoria(req, {
    accion: AUDIT_ACTIONS.MENOR_CREADO,
    recurso: 'menor',
    recursoId: menor._id,
  });
  res.status(201).json({ menor });
}

async function obtenerMenor(req, res) {
  const menor = await Menor.findById(req.menorId).populate(
    'profesionalesAsignados',
    DATOS_PROFESIONAL
  );
  await registrarAuditoria(req, {
    accion: AUDIT_ACTIONS.MENOR_CONSULTADO,
    recurso: 'menor',
    recursoId: menor._id,
  });
  res.json({ menor });
}

async function actualizarMenor(req, res) {
  const body = cuerpoDe(req);
  if (Object.keys(body).length === 0) throw new HttpError(400, 'No se indicaron cambios');
  const menor = await Menor.findById(req.menorId);
  const datos = validarMenor(body, { parcial: true, actual: menor });
  if (datos.rut) await exigirRutDisponible(datos.rut, menor._id);

  // El apoderado se asigna campo por campo para detectar solo los cambios reales.
  const { apoderado, ...resto } = datos;
  menor.set(resto);
  const quitarApoderado = apoderado === null && Boolean(menor.apoderado);
  if (quitarApoderado) {
    menor.apoderado = undefined;
  } else if (apoderado) {
    for (const campo of CAMPOS_APODERADO) menor.set(`apoderado.${campo}`, apoderado[campo]);
  }
  // Solo se registran los nombres de los campos modificados, nunca sus valores.
  const campos = [
    ...CAMPOS_MENOR.filter((campo) => campo !== 'apoderado' && menor.isModified(campo)),
    ...(quitarApoderado
      ? ['apoderado']
      : CAMPOS_APODERADO.map((campo) => `apoderado.${campo}`).filter((campo) =>
          menor.isModified(campo)
        )),
  ];

  if (campos.length > 0) {
    menor.actualizadoPor = req.user._id;
    await menor.save();
    await registrarAuditoria(req, {
      accion: AUDIT_ACTIONS.MENOR_ACTUALIZADO,
      recurso: 'menor',
      recursoId: menor._id,
      detalle: { campos },
    });
  }

  await menor.populate('profesionalesAsignados', DATOS_PROFESIONAL);
  res.json({ menor, campos });
}

async function cambiarEstado(req, res) {
  const body = cuerpoDe(req);
  exigirCamposPermitidos(body, ['activo']);
  if (typeof body.activo !== 'boolean') {
    throw new HttpError(400, 'Datos inválidos', {
      detalles: { activo: 'El estado debe ser verdadero o falso' },
    });
  }

  const menor = await Menor.findById(req.menorId);
  if (menor.activo !== body.activo) {
    menor.activo = body.activo;
    menor.actualizadoPor = req.user._id;
    await menor.save();
    await registrarAuditoria(req, {
      accion: AUDIT_ACTIONS.MENOR_ESTADO,
      recurso: 'menor',
      recursoId: menor._id,
      detalle: { activo: menor.activo },
    });
  }

  await menor.populate('profesionalesAsignados', DATOS_PROFESIONAL);
  res.json({ menor });
}

async function asignarProfesionales(req, res) {
  const body = cuerpoDe(req);
  exigirCamposPermitidos(body, ['profesionales']);
  const ids = body.profesionales;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > 20 ||
    !ids.every((id) => typeof id === 'string' && mongoose.isValidObjectId(id))
  ) {
    throw new HttpError(400, 'Datos inválidos', {
      detalles: { profesionales: 'Debe asignar al menos un profesional válido' },
    });
  }

  const unicos = [...new Set(ids)];
  const profesionales = await User.find({
    _id: mongoose.trusted({ $in: unicos }),
    rol: ROLES.PSICOPEDAGOGO,
    activo: true,
  }).select('_id');
  if (profesionales.length !== unicos.length) {
    throw new HttpError(400, 'Datos inválidos', {
      detalles: { profesionales: 'Solo se pueden asignar psicopedagogos con cuenta activa' },
    });
  }

  const menor = await Menor.findById(req.menorId);
  menor.profesionalesAsignados = unicos;
  menor.actualizadoPor = req.user._id;
  await menor.save();
  await registrarAuditoria(req, {
    accion: AUDIT_ACTIONS.PROFESIONALES_ASIGNADOS,
    recurso: 'menor',
    recursoId: menor._id,
    detalle: { profesionales: unicos },
  });

  await menor.populate('profesionalesAsignados', DATOS_PROFESIONAL);
  res.json({ menor });
}

// Historial de cambios del expediente: fecha, usuario, acción y campos (T06).
async function obtenerHistorial(req, res) {
  const registros = await AuditLog.find({
    recurso: 'menor',
    recursoId: String(req.menorId),
    accion: mongoose.trusted({ $in: ACCIONES_HISTORIAL }),
  })
    .sort({ fecha: -1 })
    .limit(100)
    .populate('usuario', 'nombre rol')
    .lean();

  res.json({
    historial: registros.map(({ _id, fecha, accion, usuario, detalle }) => ({
      _id,
      fecha,
      accion,
      usuario,
      detalle,
    })),
  });
}

module.exports = {
  listarMenores,
  crearMenor,
  obtenerMenor,
  actualizarMenor,
  cambiarEstado,
  asignarProfesionales,
  obtenerHistorial,
};
