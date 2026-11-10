// Claves locales para identificar tablas, áreas y apartados mientras se editan (React
// las necesita para conservar el foco al reordenar). No se envían al servidor.
let contador = 0;

export function nuevaClave() {
  contador += 1;
  return `local-${contador}`;
}

export function tablaNueva(columnas = ['', '']) {
  return {
    clave: nuevaClave(),
    titulo: '',
    descripcion: '',
    columnas: [...columnas],
    filas: [columnas.map(() => '')],
  };
}

export function apartadoNuevo() {
  return { clave: nuevaClave(), titulo: '', texto: '' };
}

export function areaNueva() {
  return { clave: nuevaClave(), titulo: '', apartados: [apartadoNuevo()] };
}

// Quita las claves locales antes de enviar el contenido al servidor.
export function sinClaves({
  tablasCuantitativas = [],
  areasCualitativas = [],
  ...resto
}) {
  return {
    ...resto,
    tablasCuantitativas: tablasCuantitativas.map(
      ({ titulo, descripcion, columnas, filas }) => ({
        titulo,
        descripcion,
        columnas,
        filas,
      })
    ),
    areasCualitativas: areasCualitativas.map(({ titulo, apartados }) => ({
      titulo,
      apartados: apartados.map(({ titulo: subtitulo, texto }) => ({
        titulo: subtitulo,
        texto,
      })),
    })),
  };
}

// Agrega claves locales al contenido que llega del servidor.
export function conClaves({
  tablasCuantitativas = [],
  areasCualitativas = [],
}) {
  return {
    tablasCuantitativas: tablasCuantitativas.map((tabla) => ({
      clave: nuevaClave(),
      titulo: tabla.titulo ?? '',
      descripcion: tabla.descripcion ?? '',
      columnas: [...(tabla.columnas ?? [])],
      filas: (tabla.filas ?? []).map((fila) => [...fila]),
    })),
    areasCualitativas: areasCualitativas.map((area) => ({
      clave: nuevaClave(),
      titulo: area.titulo ?? '',
      apartados: (area.apartados ?? []).map((apartado) => ({
        clave: nuevaClave(),
        titulo: apartado.titulo ?? '',
        texto: apartado.texto ?? '',
      })),
    })),
  };
}
