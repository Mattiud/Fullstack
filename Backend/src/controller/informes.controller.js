const mongoose = require('mongoose');
const Informe = require('../models/Informe');
const Menor = require('../models/Menor');
const User = require('../models/User');
const ConfiguracionInforme = require('../models/ConfiguracionInforme');
const { AUDIT_ACTIONS } = require('../models/AuditLog');
const {
  LIMITES_INFORME,
  CAMPOS_TEXTO_INFORME,
  APARTADOS_SUGERENCIAS,
} = require('../config/informes');
const { filtroMenoresAccesibles } = require('../middleware/menorAccess');
const HttpError = require('../utils/httpError');
const { registrarAuditoria } = require('../utils/audit');
const { guardarCifrado, leerDescifrado, eliminarArchivo } = require('../utils/almacenamiento');
const { contentDisposition } = require('../utils/documentos');
const { esImprimible, generarInformePdf } = require('../utils/informePdf');
const {
  ETIQUETAS,
  camposFaltantes,
  documentoDeInforme,
  esColumnaEntera,
} = require('../utils/contenidoInforme');
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
const CAMPOS_LISTAS = Object.freeze(['tablasCuantitativas', 'areasCualitativas']);
const CAMPOS_CONTENIDO = Object.freeze([
  'fechaInforme',
  ...CAMPOS_TEXTO_INFORME,
  ...CAMPOS_LISTAS,
  'sugerencias',
]);
// Los listados no incluyen los textos del informe (minimización).
const CAMPOS_RESUMEN =
  'menor fechaInforme contenidoActualizadoEn pdfs.version pdfs.fecha creadoPor createdAt updatedAt';

const MENSAJE_DESACTUALIZADO =
  'El informe fue modificado por otra persona. Recargue la página para ver la versión actual.';
const MENSAJE_NO_IMPRIMIBLE =
  'contiene caracteres que no se pueden imprimir en el PDF (por ejemplo, emojis)';

function limiteDe(campo) {
  return campo.startsWith('sugerencias.') ? LIMITES_INFORME.sugerencia : LIMITES_INFORME[campo];
}

// Texto opcional: devuelve [error, valor normalizado]. Un texto vacío queda sin valor.
function validarTextoInforme(valor, campo) {
  const etiqueta = ETIQUETAS[campo];
  const error = validarTexto(valor, { etiqueta, obligatorio: false, max: limiteDe(campo) });
  if (error) return [error];
  if (!valor) return [null, undefined];
  if (!esImprimible(valor)) return [`${etiqueta} ${MENSAJE_NO_IMPRIMIBLE}`];
  const normalizado = valor.replace(/\r\n?/g, '\n').trim();
  return [null, normalizado || undefined];
}

// Texto libre dentro de tablas y áreas: [error, texto normalizado ('' si está vacío)].
function textoLibre(valor, { etiqueta, max }) {
  if (valor === undefined || valor === null) return [null, ''];
  if (typeof valor !== 'string') return [`${etiqueta} no es válido`];
  const normalizado = valor.replace(/\r\n?/g, '\n').trim();
  if (normalizado.length > max) return [`${etiqueta} admite como máximo ${max} caracteres`];
  if (!esImprimible(normalizado)) return [`${etiqueta} ${MENSAJE_NO_IMPRIMIBLE}`];
  return [null, normalizado];
}

function esObjeto(valor, claves) {
  return (
    valor &&
    typeof valor === 'object' &&
    !Array.isArray(valor) &&
    Object.keys(valor).every((clave) => claves.includes(clave))
  );
}

// Tablas de resultados cuantitativos: columnas y filas libres. Las celdas son texto
// (el sistema no calcula valores). Devuelve { error } o { valor }.
function validarTablas(valor) {
  const L = LIMITES_INFORME;
  if (!Array.isArray(valor)) return { error: 'Las tablas no son válidas' };
  if (valor.length > L.tablas) return { error: `Se admiten como máximo ${L.tablas} tablas` };
  const tablas = [];
  for (const [indice, tabla] of valor.entries()) {
    const n = indice + 1;
    if (!esObjeto(tabla, ['titulo', 'descripcion', 'columnas', 'filas'])) {
      return { error: `La tabla ${n} no es válida` };
    }
    const [errorTitulo, titulo] = textoLibre(tabla.titulo, {
      etiqueta: `El título de la tabla ${n}`,
      max: L.tituloTabla,
    });
    const [errorDescripcion, descripcion] = textoLibre(tabla.descripcion, {
      etiqueta: `La descripción de la tabla ${n}`,
      max: L.descripcionTabla,
    });
    const error = errorTitulo || errorDescripcion;
    if (error) return { error };

    const columnasRecibidas = tabla.columnas ?? [];
    if (!Array.isArray(columnasRecibidas) || columnasRecibidas.length === 0) {
      return { error: `La tabla ${n} debe tener al menos una columna` };
    }
    if (columnasRecibidas.length > L.columnas) {
      return { error: `La tabla ${n} admite como máximo ${L.columnas} columnas` };
    }
    const columnas = [];
    for (const columna of columnasRecibidas) {
      const [errorColumna, texto] = textoLibre(columna, {
        etiqueta: `Un encabezado de la tabla ${n}`,
        max: L.celda,
      });
      if (errorColumna) return { error: errorColumna };
      columnas.push(texto);
    }

    const filasRecibidas = tabla.filas ?? [];
    if (!Array.isArray(filasRecibidas)) return { error: `Las filas de la tabla ${n} no son válidas` };
    if (filasRecibidas.length > L.filas) {
      return { error: `La tabla ${n} admite como máximo ${L.filas} filas` };
    }
    const filas = [];
    for (const fila of filasRecibidas) {
      if (!Array.isArray(fila) || fila.length > columnas.length) {
        return { error: `Las filas de la tabla ${n} no coinciden con sus columnas` };
      }
      const celdas = [];
      for (const celda of fila) {
        const [errorCelda, texto] = textoLibre(celda, {
          etiqueta: `Una celda de la tabla ${n}`,
          max: L.celda,
        });
        if (errorCelda) return { error: errorCelda };
        celdas.push(texto);
      }
      // Las filas más cortas se completan con celdas vacías.
      while (celdas.length < columnas.length) celdas.push('');
      // «Total de ítems» y «Logrados» solo admiten números enteros.
      const invalida = columnas.findIndex(
        (columna, c) => esColumnaEntera(columna) && celdas[c] && !/^\d+$/.test(celdas[c])
      );
      if (invalida !== -1) {
        return { error: `En la tabla ${n}, «${columnas[invalida]}» solo admite números enteros` };
      }
      filas.push(celdas);
    }
    tablas.push({ titulo, descripcion, columnas, filas });
  }
  return { valor: tablas };
}

// Áreas del análisis cualitativo, cada una con apartados (subáreas).
function validarAreas(valor) {
  const L = LIMITES_INFORME;
  if (!Array.isArray(valor)) return { error: 'Las áreas no son válidas' };
  if (valor.length > L.areas) return { error: `Se admiten como máximo ${L.areas} áreas` };
  const areas = [];
  for (const [indice, area] of valor.entries()) {
    const n = indice + 1;
    if (!esObjeto(area, ['titulo', 'apartados'])) return { error: `El área ${n} no es válida` };
    const [errorTitulo, titulo] = textoLibre(area.titulo, {
      etiqueta: `El nombre del área ${n}`,
      max: L.tituloArea,
    });
    if (errorTitulo) return { error: errorTitulo };
    const apartadosRecibidos = area.apartados ?? [];
    if (!Array.isArray(apartadosRecibidos)) return { error: `El área ${n} no es válida` };
    if (apartadosRecibidos.length > L.apartados) {
      return { error: `El área ${n} admite como máximo ${L.apartados} apartados` };
    }
    const apartados = [];
    for (const [j, apartado] of apartadosRecibidos.entries()) {
      if (!esObjeto(apartado, ['titulo', 'texto'])) {
        return { error: `Un apartado del área ${n} no es válido` };
      }
      const [errorSubtitulo, subtitulo] = textoLibre(apartado.titulo, {
        etiqueta: `El subtítulo del apartado ${j + 1} del área ${n}`,
        max: L.tituloApartado,
      });
      const [errorTexto, texto] = textoLibre(apartado.texto, {
        etiqueta: `El texto del apartado ${j + 1} del área ${n}`,
        max: L.textoApartado,
      });
      if (errorSubtitulo || errorTexto) return { error: errorSubtitulo || errorTexto };
      apartados.push({ titulo: subtitulo, texto });
    }
    areas.push({ titulo, apartados });
  }
  return { valor: areas };
}

const VALIDADORES_LISTAS = { tablasCuantitativas: validarTablas, areasCualitativas: validarAreas };

// Valida y normaliza el contenido recibido. Solo se devuelven los campos presentes.
function validarContenido(body, menor, { exigirFecha = false } = {}) {
  const errores = {};
  const datos = {};

  if ('fechaInforme' in body || exigirFecha) {
    errores.fechaInforme = validarFecha(body.fechaInforme, { etiqueta: ETIQUETAS.fechaInforme });
    if (!errores.fechaInforme) {
      const fecha = parsearFecha(body.fechaInforme);
      if (menor.fechaNacimiento && fecha < menor.fechaNacimiento) {
        errores.fechaInforme = 'La fecha del informe no puede ser anterior a la fecha de nacimiento';
      } else {
        datos.fechaInforme = fecha;
      }
    }
  }

  for (const campo of CAMPOS_TEXTO_INFORME) {
    if (!(campo in body)) continue;
    const [error, valor] = validarTextoInforme(body[campo], campo);
    errores[campo] = error;
    if (!error) datos[campo] = valor;
  }

  for (const campo of CAMPOS_LISTAS) {
    if (!(campo in body)) continue;
    const { error, valor } = VALIDADORES_LISTAS[campo](body[campo] ?? []);
    errores[campo] = error;
    if (!error) datos[campo] = valor;
  }

  if ('sugerencias' in body) {
    const { sugerencias } = body;
    if (!sugerencias || typeof sugerencias !== 'object' || Array.isArray(sugerencias)) {
      errores.sugerencias = 'Las sugerencias no son válidas';
    } else {
      const extra = Object.keys(sugerencias).filter((c) => !APARTADOS_SUGERENCIAS.includes(c));
      if (extra.length > 0) {
        errores.sugerencias = 'Las sugerencias no son válidas';
      } else {
        datos.sugerencias = {};
        for (const apartado of APARTADOS_SUGERENCIAS) {
          if (!(apartado in sugerencias)) continue;
          const campo = `sugerencias.${apartado}`;
          const [error, valor] = validarTextoInforme(sugerencias[apartado], campo);
          errores[campo] = error;
          if (!error) datos.sugerencias[apartado] = valor;
        }
      }
    }
  }

  exigirSinErrores(errores);
  return datos;
}

function leerCuerpo(req, permitidos) {
  const body = cuerpoDe(req);
  // El menor sale siempre de la URL, ya verificada por authorizeMenorAccess.
  exigirCamposPermitidos(body, permitidos);
  return body;
}

async function menorDelInforme(req) {
  const menor = await Menor.findById(req.menorId).select('nombre fechaNacimiento').lean();
  if (!menor) throw new HttpError(404, 'Expediente no encontrado');
  return menor;
}

// El informe debe pertenecer al menor autorizado: un id ajeno responde 404.
async function buscarInforme(req) {
  const { informeId } = req.params;
  const informe = mongoose.isValidObjectId(informeId)
    ? await Informe.findOne({ _id: informeId, menor: req.menorId })
    : null;
  if (!informe) throw new HttpError(404, 'Informe no encontrado');
  return informe;
}

// Evita sobrescribir sin saberlo los cambios guardados por otra persona.
function exigirVersionActual(informe, ultimaActualizacion) {
  const editada = typeof ultimaActualizacion === 'string' ? new Date(ultimaActualizacion) : null;
  if (!editada || Number.isNaN(editada.getTime())) {
    throw new HttpError(400, 'Falta indicar la versión del informe que se editó');
  }
  if (editada.getTime() !== informe.updatedAt.getTime()) {
    throw new HttpError(409, MENSAJE_DESACTUALIZADO, { codigo: 'INFORME_DESACTUALIZADO' });
  }
}

async function guardarConControl(informe) {
  try {
    await informe.save();
  } catch (err) {
    if (err.name === 'VersionError') {
      throw new HttpError(409, MENSAJE_DESACTUALIZADO, { codigo: 'INFORME_DESACTUALIZADO' });
    }
    throw err;
  }
}

function ultimoPdf(informe) {
  return informe.pdfs.length > 0 ? informe.pdfs[informe.pdfs.length - 1] : null;
}

function estadoPdf(informe) {
  const ultimo = ultimoPdf(informe);
  return {
    ultimoPdf: ultimo ? { version: ultimo.version, fecha: ultimo.fecha } : null,
    pdfDesactualizado: Boolean(ultimo) && informe.contenidoActualizadoEn > ultimo.fecha,
  };
}

function resumen(informe) {
  const { pdfs: _pdfs, ...datos } = informe;
  return { ...datos, ...estadoPdf(informe) };
}

async function detalle(informe) {
  await informe.populate([
    { path: 'menor', select: 'nombre fechaNacimiento' },
    { path: 'creadoPor', select: DATOS_AUTOR },
    { path: 'actualizadoPor', select: DATOS_AUTOR },
    { path: 'pdfs.generadoPor', select: DATOS_AUTOR },
  ]);
  return { ...informe.toJSON(), ...estadoPdf(informe) };
}

// Solo identificadores y nombres de campos: nunca el contenido del informe.
function auditar(req, accion, informe, extra = {}) {
  return registrarAuditoria(req, {
    accion,
    recurso: 'menor',
    recursoId: req.menorId,
    detalle: { informeId: String(informe._id), ...extra },
  });
}

function mismoValor(a, b) {
  const normal = (valor) => (valor instanceof Date ? valor.toISOString() : valor || null);
  return normal(a) === normal(b);
}

// Listado general: solo informes de los menores a los que el usuario tiene acceso.
async function listarInformes(req, res) {
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const filtro = {};
  const accesibles = filtroMenoresAccesibles(req.user);
  if (Object.keys(accesibles).length > 0) {
    const menores = await Menor.find(accesibles).distinct('_id');
    filtro.menor = mongoose.trusted({ $in: menores });
  }
  // Pendientes: sin PDF o modificados después del último PDF. Las condiciones las arma
  // el servidor (sin datos del cliente), por eso cada operador se marca como confiable.
  if (req.query.estado === 'pendientes') {
    filtro.$or = [
      { 'pdfs.0': mongoose.trusted({ $exists: false }) },
      {
        $expr: mongoose.trusted({
          $gt: ['$contenidoActualizadoEn', { $max: '$pdfs.fecha' }],
        }),
      },
    ];
  }
  // Mes de la fecha del informe (AAAA-MM).
  if (req.query.mes !== undefined) {
    const coincidencia = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(req.query.mes));
    if (!coincidencia) throw new HttpError(400, 'Indique el mes en formato AAAA-MM');
    const [anio, mes] = [Number(coincidencia[1]), Number(coincidencia[2])];
    filtro.fechaInforme = mongoose.trusted({
      $gte: new Date(Date.UTC(anio, mes - 1, 1)),
      $lt: new Date(Date.UTC(anio, mes, 1)),
    });
  }

  const [informes, total] = await Promise.all([
    Informe.find(filtro)
      .select(CAMPOS_RESUMEN)
      .sort({ updatedAt: -1 })
      .skip((pagina - 1) * POR_PAGINA)
      .limit(POR_PAGINA)
      .populate('menor', 'nombre')
      .populate('creadoPor', DATOS_AUTOR)
      .lean(),
    Informe.countDocuments(filtro),
  ]);

  res.json({ informes: informes.map(resumen), total, pagina, limite: POR_PAGINA });
}

async function listarInformesMenor(req, res) {
  const informes = await Informe.find({ menor: req.menorId })
    .select(CAMPOS_RESUMEN)
    .sort({ updatedAt: -1 })
    .populate('creadoPor', DATOS_AUTOR)
    .lean();
  res.json({ informes: informes.map(resumen) });
}

async function crearInforme(req, res) {
  const body = leerCuerpo(req, CAMPOS_CONTENIDO);
  const menor = await menorDelInforme(req);
  const datos = validarContenido(body, menor, { exigirFecha: true });

  const informe = await Informe.create({
    ...datos,
    menor: req.menorId,
    contenidoActualizadoEn: new Date(),
    creadoPor: req.user._id,
    actualizadoPor: req.user._id,
  });

  await auditar(req, AUDIT_ACTIONS.INFORME_CREADO, informe);
  res.status(201).json({ informe: await detalle(informe) });
}

async function obtenerInforme(req, res) {
  const informe = await buscarInforme(req);
  await auditar(req, AUDIT_ACTIONS.INFORME_CONSULTADO, informe);
  res.json({ informe: await detalle(informe) });
}

async function actualizarInforme(req, res) {
  const body = leerCuerpo(req, [...CAMPOS_CONTENIDO, 'ultimaActualizacion']);
  const { ultimaActualizacion, ...cambios } = body;
  if (Object.keys(cambios).length === 0) throw new HttpError(400, 'No se indicaron cambios');

  const informe = await buscarInforme(req);
  exigirVersionActual(informe, ultimaActualizacion);
  const datos = validarContenido(cambios, await menorDelInforme(req));

  const campos = [];
  for (const campo of ['fechaInforme', ...CAMPOS_TEXTO_INFORME]) {
    if (campo in datos && !mismoValor(datos[campo], informe[campo])) {
      informe.set(campo, datos[campo]);
      campos.push(campo);
    }
  }
  for (const campo of CAMPOS_LISTAS) {
    if (!(campo in datos)) continue;
    const anterior = JSON.stringify(informe.toObject()[campo] ?? []);
    if (JSON.stringify(datos[campo]) !== anterior) {
      informe.set(campo, datos[campo]);
      campos.push(campo);
    }
  }
  for (const [apartado, valor] of Object.entries(datos.sugerencias ?? {})) {
    if (!mismoValor(valor, informe.sugerencias?.[apartado])) {
      informe.set(`sugerencias.${apartado}`, valor);
      campos.push(`sugerencias.${apartado}`);
    }
  }

  if (campos.length > 0) {
    informe.contenidoActualizadoEn = new Date();
    informe.actualizadoPor = req.user._id;
    await guardarConControl(informe);
    // Solo los nombres de los campos modificados, nunca sus valores.
    await auditar(req, AUDIT_ACTIONS.INFORME_ACTUALIZADO, informe, { campos });
  }

  res.json({ informe: await detalle(informe), campos });
}

// Los datos profesionales del pie son los de quien creó el informe, tal como están al
// generar el PDF (el PDF guardado no cambia si después se modifican).
async function pdfDeInforme(req, informe, menor, { vistaPrevia = false } = {}) {
  const profesional = informe.creadoPor
    ? await User.findById(informe.creadoPor).select('nombre datosProfesionales').lean()
    : req.user;
  const configuracion = await ConfiguracionInforme.obtenerVigente({ conLogo: true });
  return generarInformePdf({
    configuracion,
    ...documentoDeInforme({ informe, menor, profesional, vistaPrevia }),
  });
}

function enviarPdf(res, pdf, disposicion, nombre) {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': contentDisposition(disposicion, nombre),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  res.send(pdf);
}

// PDF de revisión con el contenido del formulario, aunque no esté guardado. Se genera
// en memoria y no se almacena.
async function vistaPrevia(req, res) {
  const body = leerCuerpo(req, CAMPOS_CONTENIDO);
  const menor = await menorDelInforme(req);
  const datos = validarContenido(body, menor);
  const guardado = req.params.informeId ? (await buscarInforme(req)).toObject() : {};
  const informe = {
    ...guardado,
    ...datos,
    sugerencias: { ...guardado.sugerencias, ...datos.sugerencias },
    creadoPor: guardado.creadoPor,
  };
  const pdf = await pdfDeInforme(req, informe, menor, { vistaPrevia: true });
  enviarPdf(res, pdf, 'inline', 'vista-previa-informe.pdf');
}

// Genera el PDF definitivo con el contenido guardado y lo agrega como nueva versión.
async function generarPdf(req, res) {
  const { ultimaActualizacion } = leerCuerpo(req, ['ultimaActualizacion']);
  const informe = await buscarInforme(req);
  exigirVersionActual(informe, ultimaActualizacion);
  const faltantes = camposFaltantes(informe);
  if (Object.keys(faltantes).length > 0) {
    throw new HttpError(400, 'Complete todas las secciones antes de generar el PDF', {
      detalles: faltantes,
    });
  }

  const menor = await menorDelInforme(req);
  const pdf = await pdfDeInforme(req, informe, menor);
  const almacenado = await guardarCifrado(pdf);
  const version = (ultimoPdf(informe)?.version ?? 0) + 1;
  informe.pdfs.push({
    version,
    ...almacenado,
    tamano: pdf.length,
    generadoPor: req.user._id,
    fecha: new Date(),
  });
  try {
    await guardarConControl(informe);
  } catch (err) {
    // No quedan archivos sin informe si el guardado falla.
    await eliminarArchivo(almacenado.archivoId).catch(() => {});
    throw err;
  }

  await auditar(req, AUDIT_ACTIONS.INFORME_PDF_GENERADO, informe, { version });
  res.status(201).json({ informe: await detalle(informe), version });
}

function nombreArchivo(informe, version) {
  const fecha = informe.fechaInforme.toISOString().slice(0, 10);
  return `informe-psicopedagogico-${fecha}-v${version}.pdf`;
}

// Entrega una versión del PDF. Las versiones generadas no se modifican.
async function obtenerPdf(req, res) {
  const informe = await buscarInforme(req);
  const version = Number(req.params.version);
  const pdf = Number.isInteger(version) ? informe.pdfs.find((p) => p.version === version) : null;
  if (!pdf) throw new HttpError(404, 'Versión del PDF no encontrada');

  let contenido;
  try {
    contenido = await leerDescifrado(pdf);
  } catch {
    // Falla si el archivo falta o fue alterado (el cifrado GCM lo detecta).
    throw new HttpError(500, 'No se pudo abrir el PDF');
  }
  const descarga = req.query.descarga === '1';
  await auditar(req, AUDIT_ACTIONS.INFORME_PDF_DESCARGADO, informe, {
    version,
    modo: descarga ? 'descarga' : 'vista',
  });
  enviarPdf(res, contenido, descarga ? 'attachment' : 'inline', nombreArchivo(informe, version));
}

module.exports = {
  listarInformes,
  listarInformesMenor,
  crearInforme,
  obtenerInforme,
  actualizarInforme,
  vistaPrevia,
  generarPdf,
  obtenerPdf,
};
