// Opciones de la configuración institucional de los informes PDF. Sin dependencias,
// para que el frontend pueda verificar que sus constantes coinciden
// (Frontend/src/__tests__/configuracionInformes.test.jsx).

const ALINEACIONES = Object.freeze(['izquierda', 'centro', 'derecha']);
const POSICIONES_LOGO = Object.freeze(['izquierda', 'derecha']);
// Caja máxima del logo en el PDF, en puntos (1/72 de pulgada). El logo se escala
// dentro de ella conservando su proporción.
const TAMANOS_LOGO = Object.freeze({
  pequeno: Object.freeze({ ancho: 90, alto: 36 }),
  mediano: Object.freeze({ ancho: 130, alto: 50 }),
  grande: Object.freeze({ ancho: 170, alto: 64 }),
});

const MAX_NOMBRE = 120;
const MAX_PIE = 300;
const MAX_LINEAS_PIE = 3;
const LOGO_MAX_BYTES = 1024 * 1024;
// Limita también la memoria necesaria para descomprimir el PNG (2000×2000 RGBA ≈ 16 MB).
const LOGO_MAX_PX = 2000;
const LOGO_MIMES = Object.freeze(['image/png', 'image/jpeg']);

const VALORES_POR_DEFECTO = Object.freeze({
  nombreInstitucion: '',
  alineacionEncabezado: 'izquierda',
  posicionLogo: 'derecha',
  tamanoLogo: 'mediano',
  textoPie: '',
  numeracionPaginas: true,
});

// Contenido del informe psicopedagógico. Nombre y fecha de nacimiento no se guardan en
// el informe: se leen del perfil del menor. Los límites solo evitan abusos: admiten
// redacciones extensas.
const LIMITES_INFORME = Object.freeze({
  curso: 50,
  establecimiento: 150,
  antecedentesRelevantes: 10000,
  // «Derivación y motivo de consulta».
  motivoConsulta: 10000,
  instrumentoEvaluativo: 3000,
  areasEvaluacion: 3000,
  // Texto general opcional antes de las tablas de resultados cuantitativos.
  analisisCuantitativo: 10000,
  objetivoEvaluacion: 5000,
  // Texto general opcional antes de las áreas del análisis cualitativo.
  analisisCualitativo: 10000,
  conclusion: 15000,
  sugerencia: 8000,
  // Tablas de resultados cuantitativos.
  tablas: 20,
  tituloTabla: 200,
  descripcionTabla: 3000,
  columnas: 12,
  filas: 100,
  celda: 300,
  // Análisis cualitativo por áreas y apartados.
  areas: 20,
  tituloArea: 200,
  apartados: 20,
  tituloApartado: 200,
  textoApartado: 15000,
});

// Campos de texto simples del informe, en el orden de la estructura del documento.
const CAMPOS_TEXTO_INFORME = Object.freeze([
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
]);
const APARTADOS_SUGERENCIAS = Object.freeze(['familia', 'escuela', 'nino']);

// Para generar el PDF definitivo todas las secciones deben estar completas, incluida al
// menos una tabla de resultados cuantitativos y un área del análisis cualitativo.
// Opcionales: curso y establecimiento (también lo son en el perfil del menor) y los
// textos generales que acompañan a las tablas y a las áreas.
const CAMPOS_OBLIGATORIOS_PDF = Object.freeze([
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
]);

// Datos profesionales del psicopedagogo que se imprimen en el pie de sus informes.
const LIMITES_DATOS_PROFESIONALES = Object.freeze({
  tituloProfesional: 120,
  registro: 60,
  correo: 254,
  telefono: 20,
});

module.exports = {
  LIMITES_INFORME,
  CAMPOS_TEXTO_INFORME,
  APARTADOS_SUGERENCIAS,
  CAMPOS_OBLIGATORIOS_PDF,
  LIMITES_DATOS_PROFESIONALES,
  ALINEACIONES,
  POSICIONES_LOGO,
  TAMANOS_LOGO,
  MAX_NOMBRE,
  MAX_PIE,
  MAX_LINEAS_PIE,
  LOGO_MAX_BYTES,
  LOGO_MAX_PX,
  LOGO_MIMES,
  VALORES_POR_DEFECTO,
};
