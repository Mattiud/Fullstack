// Deben coincidir con Backend/src/config/informes.js
// (lo verifica configuracionInformes.test.jsx).

export const ALINEACIONES = [
  { valor: 'izquierda', etiqueta: 'Izquierda' },
  { valor: 'centro', etiqueta: 'Centrada' },
  { valor: 'derecha', etiqueta: 'Derecha' },
];

export const POSICIONES_LOGO = [
  { valor: 'izquierda', etiqueta: 'A la izquierda del título' },
  { valor: 'derecha', etiqueta: 'A la derecha del título' },
];

// Caja máxima del logo en el PDF, en puntos. El logo se ajusta dentro de ella sin
// deformarse.
export const TAMANOS_LOGO = {
  pequeno: { etiqueta: 'Pequeño', ancho: 90, alto: 36 },
  mediano: { etiqueta: 'Mediano', ancho: 130, alto: 50 },
  grande: { etiqueta: 'Grande', ancho: 170, alto: 64 },
};

export const LIMITES_CONFIGURACION = {
  nombreInstitucion: 120,
  textoPie: 300,
  lineasPie: 3,
};

// Valores usados mientras el servidor no responde; los reales llegan con la configuración.
export const LIMITES_LOGO = {
  maxBytes: 1024 * 1024,
  maxPx: 2000,
  extensiones: ['.png', '.jpg', '.jpeg'],
  mimes: ['image/png', 'image/jpeg'],
};

export const VALORES_POR_DEFECTO = {
  nombreInstitucion: '',
  alineacionEncabezado: 'izquierda',
  posicionLogo: 'derecha',
  tamanoLogo: 'mediano',
  textoPie: '',
  numeracionPaginas: true,
};

export const CAMPOS_CONFIGURACION = Object.keys(VALORES_POR_DEFECTO);

// Página A4 en puntos y márgenes laterales del PDF, para la vista previa a escala.
export const PAGINA_PDF = { ancho: 595.28, alto: 841.89, margenLateral: 56 };
