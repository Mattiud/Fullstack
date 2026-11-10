// Deben coincidir con Backend/src/config/informes.js (lo verifica informes.test.jsx).

export const LIMITES_INFORME = {
  curso: 50,
  establecimiento: 150,
  antecedentesRelevantes: 10000,
  motivoConsulta: 10000,
  instrumentoEvaluativo: 3000,
  areasEvaluacion: 3000,
  analisisCuantitativo: 10000,
  objetivoEvaluacion: 5000,
  analisisCualitativo: 10000,
  conclusion: 15000,
  sugerencia: 8000,
  tablas: 20,
  tituloTabla: 200,
  descripcionTabla: 3000,
  columnas: 12,
  filas: 100,
  celda: 300,
  areas: 20,
  tituloArea: 200,
  apartados: 20,
  tituloApartado: 200,
  textoApartado: 15000,
};

export const CAMPOS_TEXTO_INFORME = [
  'curso',
  'establecimiento',
  'antecedentesRelevantes',
  'motivoConsulta',
  'instrumentoEvaluativo',
  'areasEvaluacion',
  'analisisCuantitativo',
  'objetivoEvaluacion',
  'analisisCualitativo',
  'conclusion',
];

export const APARTADOS_SUGERENCIAS = ['familia', 'escuela', 'nino'];

export const CAMPOS_OBLIGATORIOS_PDF = [
  'fechaInforme',
  'antecedentesRelevantes',
  'motivoConsulta',
  'instrumentoEvaluativo',
  'areasEvaluacion',
  'tablasCuantitativas',
  'objetivoEvaluacion',
  'areasCualitativas',
  'conclusion',
  'sugerencias.familia',
  'sugerencias.escuela',
  'sugerencias.nino',
];

export const LIMITES_DATOS_PROFESIONALES = {
  tituloProfesional: 120,
  registro: 60,
  correo: 254,
  telefono: 20,
};

export const APARTADOS = [
  { campo: 'familia', titulo: 'Familia' },
  { campo: 'escuela', titulo: 'Escuela' },
  { campo: 'nino', titulo: 'Niño' },
];

// Secciones del formulario, en el orden del documento. `campos` son los obligatorios
// para el PDF que se completan en cada una (para marcar su avance y sus errores).
export const SECCIONES_FORMULARIO = [
  {
    id: 'personales',
    titulo: 'Antecedentes personales',
    campos: ['fechaInforme', 'curso', 'establecimiento'],
  },
  {
    id: 'relevantes',
    titulo: 'Antecedentes relevantes',
    campos: ['antecedentesRelevantes'],
  },
  {
    id: 'derivacion',
    titulo: 'Derivación y motivo de consulta',
    campos: ['motivoConsulta'],
  },
  {
    id: 'evaluacion',
    titulo: 'Antecedentes de evaluación',
    campos: ['instrumentoEvaluativo', 'areasEvaluacion'],
  },
  {
    id: 'cuantitativos',
    titulo: 'Resultados cuantitativos',
    campos: ['analisisCuantitativo', 'tablasCuantitativas'],
  },
  {
    id: 'objetivo',
    titulo: 'Objetivo de la evaluación',
    campos: ['objetivoEvaluacion'],
  },
  {
    id: 'cualitativos',
    titulo: 'Análisis cualitativo por áreas',
    campos: ['analisisCualitativo', 'areasCualitativas'],
  },
  {
    id: 'conclusion',
    titulo: 'Conclusión psicopedagógica',
    campos: ['conclusion'],
  },
  {
    id: 'sugerencias',
    titulo: 'Sugerencias',
    campos: ['sugerencias.familia', 'sugerencias.escuela', 'sugerencias.nino'],
  },
];

export const MENSAJES_OBLIGATORIO = {
  fechaInforme: 'La fecha del informe es obligatoria',
  antecedentesRelevantes: 'Complete los antecedentes relevantes',
  motivoConsulta: 'Complete la derivación y motivo de consulta',
  instrumentoEvaluativo: 'Indique el instrumento evaluativo',
  areasEvaluacion: 'Indique las áreas de evaluación',
  tablasCuantitativas:
    'Agregue al menos una tabla de resultados cuantitativos con datos',
  objetivoEvaluacion: 'Complete el objetivo de la evaluación',
  areasCualitativas: 'Agregue al menos un área con su análisis cualitativo',
  conclusion: 'Complete la conclusión psicopedagógica',
  'sugerencias.familia': 'Complete las sugerencias para la familia',
  'sugerencias.escuela': 'Complete las sugerencias para la escuela',
  'sugerencias.nino': 'Complete las sugerencias para el niño',
};

// Columnas de referencia para una tabla nueva (solo encabezados; sin datos).
export const COLUMNAS_REFERENCIA = [
  'Área de evaluación',
  'Total de ítems',
  'Logrados',
  '% de logro',
];

export const AYUDA_LISTAS =
  'Para listas, comience cada línea con «- » (viñeta) o «1. » (numerada).';

export const LETRAS = 'abcdefghijklmnopqrstuvwxyz';

// Estado del PDF de un informe, a partir del resumen que entrega el backend.
export function estadoInforme({ ultimoPdf, pdfDesactualizado }) {
  if (!ultimoPdf) return 'Borrador';
  if (pdfDesactualizado) return 'Modificado después del PDF';
  return `PDF v${ultimoPdf.version}`;
}

// Línea del pie con los datos profesionales (mismo formato que el backend).
export function lineaProfesional(nombre, datos = {}) {
  return [
    nombre,
    datos.tituloProfesional,
    datos.registro ? `Registro: ${datos.registro}` : null,
    datos.correo,
    datos.telefono,
  ]
    .filter((dato) => dato && dato.trim())
    .map((dato) => dato.trim())
    .join(' · ');
}
