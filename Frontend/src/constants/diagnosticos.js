// Deben coincidir con Backend/src/models/Diagnostico.js.
export const ESTADOS_DIAGNOSTICO = {
  BORRADOR: 'borrador',
  VIGENTE: 'vigente',
};

export const NOMBRES_ESTADOS_DIAGNOSTICO = {
  [ESTADOS_DIAGNOSTICO.BORRADOR]: 'Borrador',
  [ESTADOS_DIAGNOSTICO.VIGENTE]: 'Vigente',
};

export const LIMITES_DIAGNOSTICO = {
  tipo: 150,
  instrumento: 200,
  descripcion: 5000,
  area: 50,
  areas: 10,
};

// Valor de la opción «Otro» del tipo de diagnóstico. Empieza con un espacio: los
// nombres de las categorías se guardan sin espacios al inicio, así que no puede
// coincidir con una de ellas.
export const TIPO_OTRO = ' otro';

// Mismo mensaje que Backend/src/controller/diagnosticos.controller.js.
export const MENSAJE_TIPO_LISTADO =
  'Ese tipo ya está en la lista; selecciónelo directamente';

// Áreas que ofrece el mockup 1g; con "+ otra" se puede agregar una distinta.
export const AREAS_SUGERIDAS = [
  'Lectura',
  'Escritura',
  'Cálculo',
  'Atención',
  'Lenguaje',
];

// Versión que se muestra: "Borrador" o "v2".
export function etiquetaVersion(diagnostico) {
  return diagnostico.estado === ESTADOS_DIAGNOSTICO.BORRADOR
    ? 'Borrador'
    : `v${diagnostico.version}`;
}
