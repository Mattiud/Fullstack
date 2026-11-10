const { CAMPOS_OBLIGATORIOS_PDF } = require('../config/informes');
const { edadCronologica, formatearEdadCronologica } = require('./validators');

// Estructura del informe psicopedagógico (en este orden). El sistema solo organiza lo
// que ingresó el profesional: no agrega secciones, texto, resultados ni cálculos.

const TITULO_INFORME = 'Informe Psicopedagógico';

const ETIQUETAS = Object.freeze({
  fechaInforme: 'La fecha del informe',
  curso: 'El curso',
  establecimiento: 'El establecimiento',
  antecedentesRelevantes: 'Los antecedentes relevantes',
  motivoConsulta: 'La derivación y motivo de consulta',
  instrumentoEvaluativo: 'El instrumento evaluativo',
  areasEvaluacion: 'Las áreas de evaluación',
  analisisCuantitativo: 'El texto de los resultados cuantitativos',
  objetivoEvaluacion: 'El objetivo de la evaluación',
  analisisCualitativo: 'El texto del análisis cualitativo',
  conclusion: 'La conclusión psicopedagógica',
  'sugerencias.familia': 'Las sugerencias para la familia',
  'sugerencias.escuela': 'Las sugerencias para la escuela',
  'sugerencias.nino': 'Las sugerencias para el niño',
});

const OBLIGATORIO = Object.freeze({
  fechaInforme: 'La fecha del informe es obligatoria',
  antecedentesRelevantes: 'Complete los antecedentes relevantes',
  motivoConsulta: 'Complete la derivación y motivo de consulta',
  instrumentoEvaluativo: 'Indique el instrumento evaluativo',
  areasEvaluacion: 'Indique las áreas de evaluación',
  tablasCuantitativas: 'Agregue al menos una tabla de resultados cuantitativos con datos',
  objetivoEvaluacion: 'Complete el objetivo de la evaluación',
  areasCualitativas: 'Agregue al menos un área con su análisis cualitativo',
  conclusion: 'Complete la conclusión psicopedagógica',
  'sugerencias.familia': 'Complete las sugerencias para la familia',
  'sugerencias.escuela': 'Complete las sugerencias para la escuela',
  'sugerencias.nino': 'Complete las sugerencias para el niño',
});

const SIN_COMPLETAR = '(Sección sin completar)';
const NO_REGISTRADO = 'No registrado';
const LETRAS = 'abcdefghijklmnopqrstuvwxyz';

function valorDe(informe, campo) {
  return campo.split('.').reduce((objeto, parte) => objeto?.[parte], informe);
}

function tieneTexto(valor) {
  return valor instanceof Date || (typeof valor === 'string' && valor.trim().length > 0);
}

// Problemas de una tabla para el PDF definitivo (null si está completa).
function problemaTabla(tabla, numero) {
  const columnas = tabla.columnas ?? [];
  if (columnas.length === 0) return `La tabla ${numero} no tiene columnas`;
  if (columnas.some((c) => !tieneTexto(c))) {
    return `Complete los encabezados de la tabla ${numero}`;
  }
  const conDatos = (tabla.filas ?? []).some((fila) => fila.some((celda) => tieneTexto(celda)));
  return conDatos ? null : `La tabla ${numero} no tiene datos; complétela o elimínela`;
}

// Problemas de un área del análisis cualitativo (null si está completa).
function problemaArea(area, numero) {
  if (!tieneTexto(area.titulo)) return `Indique el nombre del área ${numero}`;
  const apartados = area.apartados ?? [];
  if (apartados.length === 0) return `El área ${numero} no tiene apartados`;
  const vacio = apartados.findIndex((apartado) => !tieneTexto(apartado.texto));
  return vacio === -1
    ? null
    : `Complete el texto del apartado ${LETRAS[vacio] ?? vacio + 1}) del área ${numero}`;
}

// Campos obligatorios para el PDF definitivo que faltan o están incompletos.
function camposFaltantes(informe) {
  const faltantes = {};
  for (const campo of CAMPOS_OBLIGATORIOS_PDF) {
    if (campo === 'tablasCuantitativas') {
      const tablas = informe.tablasCuantitativas ?? [];
      const problema =
        tablas.length === 0
          ? OBLIGATORIO.tablasCuantitativas
          : tablas.map((t, i) => problemaTabla(t, i + 1)).find(Boolean);
      if (problema) faltantes[campo] = problema;
    } else if (campo === 'areasCualitativas') {
      const areas = informe.areasCualitativas ?? [];
      const problema =
        areas.length === 0
          ? OBLIGATORIO.areasCualitativas
          : areas.map((a, i) => problemaArea(a, i + 1)).find(Boolean);
      if (problema) faltantes[campo] = problema;
    } else if (!tieneTexto(valorDe(informe, campo))) {
      faltantes[campo] = OBLIGATORIO[campo];
    }
  }
  return faltantes;
}

// DD-MM-AAAA a partir de una fecha sin hora (guardada en UTC).
function formatearFecha(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha);
  const dos = (n) => String(n).padStart(2, '0');
  return `${dos(d.getUTCDate())}-${dos(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
}

// Texto de una sección; en la vista previa, una sección vacía se indica en gris.
function contenidoTexto(texto, { opcional = false } = {}) {
  if (tieneTexto(texto)) return { texto };
  return opcional ? {} : { parrafos: [SIN_COMPLETAR], atenuado: true };
}

// Línea del pie con los datos que el profesional definió para sus informes.
function lineaProfesional(profesional) {
  if (!profesional) return '';
  const datos = profesional.datosProfesionales ?? {};
  return [
    profesional.nombre,
    datos.tituloProfesional,
    datos.registro ? `Registro: ${datos.registro}` : null,
    datos.correo,
    datos.telefono,
  ]
    .filter((dato) => tieneTexto(dato))
    .map((dato) => dato.trim())
    .join(' · ');
}

// Encabezado sin mayúsculas, tildes ni espacios extra, para reconocer las columnas.
function normalizarEncabezado(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Columnas que solo admiten números enteros (se valida al guardar el informe).
const COLUMNAS_ENTERAS = Object.freeze(['total de items', 'logrados']);

function esColumnaEntera(encabezado) {
  return COLUMNAS_ENTERAS.includes(normalizarEncabezado(encabezado));
}

// Número entero ingresado en una celda; null si está vacía o no es un entero.
function numeroDe(celda) {
  const texto = String(celda ?? '').trim();
  return /^\d+$/.test(texto) ? Number(texto) : null;
}

// En el PDF, el «% de logro» se calcula como Logrados ÷ Total de ítems × 100 (entero).
// Solo si la tabla tiene las tres columnas; si una fila no permite el cálculo, se
// conserva lo que ingresó el profesional. No modifica el informe guardado.
function conPorcentajeCalculado(tabla) {
  const encabezados = (tabla.columnas ?? []).map(normalizarEncabezado);
  const total = encabezados.indexOf('total de items');
  const logrados = encabezados.indexOf('logrados');
  const porcentaje = encabezados.indexOf('% de logro');
  if (total === -1 || logrados === -1 || porcentaje === -1) return tabla;

  const filas = (tabla.filas ?? []).map((fila) => {
    const cantidadTotal = numeroDe(fila[total]);
    const cantidadLograda = numeroDe(fila[logrados]);
    const calculable =
      cantidadTotal !== null &&
      cantidadLograda !== null &&
      cantidadTotal > 0 &&
      cantidadLograda <= cantidadTotal;
    if (!calculable) return fila;
    const copia = [...fila];
    copia[porcentaje] = `${Math.round((cantidadLograda / cantidadTotal) * 100)}%`;
    return copia;
  });
  // Objeto nuevo y explícito: la tabla puede ser un subdocumento de Mongoose.
  return {
    titulo: tabla.titulo,
    descripcion: tabla.descripcion,
    columnas: [...tabla.columnas],
    filas,
  };
}

function seccionTablas(informe) {
  const tablas = (informe.tablasCuantitativas ?? [])
    .filter((t) => (t.columnas ?? []).length > 0)
    .map(conPorcentajeCalculado);
  const texto = contenidoTexto(informe.analisisCuantitativo, { opcional: tablas.length > 0 });
  return { titulo: 'RESULTADOS CUANTITATIVOS', ...texto, tablas };
}

// Áreas numeradas (1., 2., …) con apartados identificados por letra (a), b), …).
function seccionAreas(informe) {
  const areas = informe.areasCualitativas ?? [];
  const texto = contenidoTexto(informe.analisisCualitativo, { opcional: areas.length > 0 });
  return {
    titulo: 'RESULTADOS Y ANÁLISIS CUALITATIVOS POR ÁREAS',
    ...texto,
    subsecciones: areas.map((area, i) => ({
      titulo: `${i + 1}. ${area.titulo?.trim() || 'Área sin nombre'}`,
      subsecciones: (area.apartados ?? []).map((apartado, j) => ({
        titulo: tieneTexto(apartado.titulo)
          ? `${LETRAS[j] ?? j + 1}) ${apartado.titulo.trim()}`
          : undefined,
        ...contenidoTexto(apartado.texto),
      })),
    })),
  };
}

// Datos para generarInformePdf a partir del informe (guardado o del formulario), el
// perfil del menor y el profesional que lo creó.
function documentoDeInforme({ informe, menor, profesional, vistaPrevia = false }) {
  const edad =
    menor.fechaNacimiento && informe.fechaInforme
      ? edadCronologica(new Date(menor.fechaNacimiento), new Date(informe.fechaInforme))
      : null;

  const datosCabecera = [
    `Fecha del informe: ${formatearFecha(informe.fechaInforme) || NO_REGISTRADO}`,
    `Profesional: ${profesional?.nombre ?? NO_REGISTRADO}`,
  ];
  if (vistaPrevia) datosCabecera.unshift('VISTA PREVIA · NO ES EL DOCUMENTO DEFINITIVO');

  const secciones = [
    {
      titulo: 'ANTECEDENTES PERSONALES',
      campos: [
        { etiqueta: 'Nombre', valor: menor.nombre },
        { etiqueta: 'Fecha de nacimiento', valor: formatearFecha(menor.fechaNacimiento) },
        {
          etiqueta: 'Edad cronológica',
          valor: formatearEdadCronologica(edad) || NO_REGISTRADO,
        },
        { etiqueta: 'Curso', valor: informe.curso?.trim() || NO_REGISTRADO },
        { etiqueta: 'Establecimiento', valor: informe.establecimiento?.trim() || NO_REGISTRADO },
      ],
    },
    { titulo: 'ANTECEDENTES RELEVANTES', ...contenidoTexto(informe.antecedentesRelevantes) },
    { titulo: 'DERIVACIÓN Y MOTIVO DE CONSULTA', ...contenidoTexto(informe.motivoConsulta) },
    {
      titulo: 'ANTECEDENTES DE EVALUACIÓN',
      subsecciones: [
        { titulo: 'Instrumento evaluativo', ...contenidoTexto(informe.instrumentoEvaluativo) },
        { titulo: 'Áreas de evaluación', ...contenidoTexto(informe.areasEvaluacion) },
      ],
    },
    seccionTablas(informe),
    { titulo: 'OBJETIVO DE LA EVALUACIÓN', ...contenidoTexto(informe.objetivoEvaluacion) },
    seccionAreas(informe),
    { titulo: 'CONCLUSIÓN PSICOPEDAGÓGICA', ...contenidoTexto(informe.conclusion) },
    {
      titulo: 'SUGERENCIAS',
      subsecciones: [
        { titulo: 'Familia', ...contenidoTexto(informe.sugerencias?.familia) },
        { titulo: 'Escuela', ...contenidoTexto(informe.sugerencias?.escuela) },
        { titulo: 'Niño', ...contenidoTexto(informe.sugerencias?.nino) },
      ],
    },
  ];

  return {
    titulo: TITULO_INFORME,
    datosCabecera,
    secciones,
    pieProfesional: lineaProfesional(profesional),
    marcaAgua: vistaPrevia ? 'VISTA PREVIA' : undefined,
  };
}

module.exports = {
  TITULO_INFORME,
  ETIQUETAS,
  camposFaltantes,
  documentoDeInforme,
  esColumnaEntera,
  lineaProfesional,
  formatearFecha,
};
