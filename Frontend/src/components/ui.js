import { Link } from 'react-router-dom';
import styled, { css, keyframes } from 'styled-components';

// Componentes base según los mockups (docs/mockups): bordes en el color de acento,
// encabezados de sección en mayúsculas y filas separadas por línea discontinua.

export const Tarjeta = styled.section`
  background: ${({ theme }) => theme.colores.superficie};
  border: 1.5px solid ${({ theme }) => theme.colores.bordeTarjeta};
  border-radius: ${({ theme }) => theme.radio};
  box-shadow: ${({ theme }) => theme.sombra};
  padding: 20px;
`;

// Tarjeta con encabezado de sección, como "Matriz de permisos" en el mockup 1k.
export const Panel = styled.section`
  background: ${({ theme }) => theme.colores.superficie};
  border: 1.5px solid ${({ theme }) => theme.colores.bordeTarjeta};
  border-radius: ${({ theme }) => theme.radio};
  min-width: 0;
`;

export const EncabezadoPanel = styled.div`
  padding: 10px 14px;
  border-bottom: 2px solid ${({ theme }) => theme.colores.primario};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

export const CuerpoPanel = styled.div`
  padding: 14px;
`;

export const TituloSeccion = styled.h2`
  margin: 0;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colores.textoSuave};
`;

export const Titulo = styled.h1`
  font-size: 1.5rem;
  margin: 0 0 16px;
`;

export const Subtitulo = styled.h2`
  font-size: 1.125rem;
  margin: 0 0 16px;
`;

export const Formulario = styled.form`
  display: grid;
  gap: 16px;
`;

export const Campo = styled.div`
  display: grid;
  gap: 5px;
`;

export const Etiqueta = styled.label`
  font-size: 14px;
  color: ${({ theme }) => theme.colores.textoSuave};
`;

const estiloControl = css`
  width: 100%;
  padding: 7px 10px;
  border: 1.5px solid
    ${({ theme, $invalido }) => ($invalido ? theme.colores.error : theme.colores.borde)};
  border-radius: 3px;
  background: ${({ theme }) => theme.colores.superficieSuave};
  color: inherit;

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colores.primario};
    outline-offset: 1px;
  }

  &:disabled {
    color: ${({ theme }) => theme.colores.deshabilitado};
  }
`;

export const Entrada = styled.input`
  ${estiloControl}
`;

export const Selector = styled.select`
  ${estiloControl}
`;

export const TextoAyuda = styled.span`
  font-size: 0.8125rem;
  color: ${({ theme }) => theme.colores.textoSuave};
`;

export const ErrorCampo = styled.span`
  font-size: 0.8125rem;
  color: ${({ theme }) => theme.colores.error};
`;

// ---------------------------------------------------------------------------
// Botones. Todo botón del sistema parte de estos componentes para que tamaño,
// colores, íconos y estados (hover, presionado, foco, deshabilitado y carga)
// sean iguales en todos los módulos.
//
// - Boton / BotonPequeno: acciones con texto (y, si aporta, un <Icono> antes).
//   $variante:
//   · primario (por defecto): la acción principal de la zona (Guardar, Nuevo…).
//   · secundario: acciones de apoyo o de navegación (Cancelar, Volver…).
//   · edicion: abrir la edición de un registro (Editar, Modificar…).
//   · informativo: consultar sin modificar (Vista previa, Ampliar, Descargar…).
//   · peligro: acción destructiva fuera de una confirmación (Desactivar ficha…).
//   · destructivo: confirmar una acción destructiva (modal de confirmación).
//   · fantasma: discreto, sin borde (cerrar ventanas y avisos).
// - BotonIcono: solo ícono, cuadrado; exige aria-label.
// - BotonAccion: acción compacta de filas y listas (Editar, Eliminar…).
// - BotonEnlace: acción dentro de una frase, con aspecto de enlace.
// - BotonFiltro: píldora que se activa o desactiva (aria-pressed).
// - BotonEnlazado: Boton que navega a otra ruta.
// ---------------------------------------------------------------------------

const girar = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

// Transiciones, foco visible y cursor comunes a cualquier elemento pulsable. El
// foco se dibuja como anillo (box-shadow); el outline transparente lo mantiene
// visible en el modo de alto contraste de Windows.
export const estadosInteractivos = css`
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;

  &:focus-visible {
    outline: 2px solid transparent;
    outline-offset: 2px;
    box-shadow: ${({ theme }) => theme.anilloFoco};
  }

  &:disabled {
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// Variante sólida: se eleva levemente al pasar el cursor y se hunde al presionar.
function solido(fondo, hover, presionado, sombra, sombraHover) {
  return css`
    background: ${({ theme }) => theme.colores[fondo]};
    border-color: ${({ theme }) => theme.colores[fondo]};
    color: #fff;
    box-shadow: ${({ theme }) => theme[sombra]};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colores[hover]};
      border-color: ${({ theme }) => theme.colores[hover]};
      box-shadow: ${({ theme }) => theme[sombraHover]};
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      background: ${({ theme }) => theme.colores[presionado]};
      border-color: ${({ theme }) => theme.colores[presionado]};
      box-shadow: ${({ theme }) => theme[sombra]};
      transform: translateY(0);
    }
  `;
}

const variantesBoton = {
  primario: solido(
    'primario',
    'primarioOscuro',
    'primarioPresionado',
    'sombraBoton',
    'sombraBotonHover'
  ),
  destructivo: solido(
    'error',
    'errorOscuro',
    'errorOscuro',
    'sombraBotonPeligro',
    'sombraBotonPeligro'
  ),
  secundario: css`
    background: ${({ theme }) => theme.colores.superficie};
    border-color: ${({ theme }) => theme.colores.bordeBoton};
    color: ${({ theme }) => theme.colores.texto};
    box-shadow: ${({ theme }) => theme.sombraSuave};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colores.lateral};
      border-color: ${({ theme }) => theme.colores.primario};
      color: ${({ theme }) => theme.colores.primarioOscuro};
    }

    &:active:not(:disabled) {
      background: ${({ theme }) => theme.colores.lateralActivo};
    }
  `,
  edicion: css`
    background: ${({ theme }) => theme.colores.edicionFondo};
    border-color: ${({ theme }) => theme.colores.edicionFondo};
    color: ${({ theme }) => theme.colores.enlace};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colores.edicionHover};
      border-color: ${({ theme }) => theme.colores.edicionHover};
      color: ${({ theme }) => theme.colores.primarioOscuro};
    }

    &:active:not(:disabled) {
      background: ${({ theme }) => theme.colores.lateralPresionado};
      border-color: ${({ theme }) => theme.colores.lateralPresionado};
    }
  `,
  informativo: css`
    background: ${({ theme }) => theme.colores.informativoFondo};
    border-color: ${({ theme }) => theme.colores.informativoFondo};
    color: ${({ theme }) => theme.colores.texto};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colores.informativoHover};
      border-color: ${({ theme }) => theme.colores.informativoHover};
    }

    &:active:not(:disabled) {
      background: ${({ theme }) => theme.colores.bordeSuave};
      border-color: ${({ theme }) => theme.colores.bordeSuave};
    }
  `,
  peligro: css`
    background: ${({ theme }) => theme.colores.superficie};
    border-color: ${({ theme }) => theme.colores.errorBorde};
    color: ${({ theme }) => theme.colores.error};
    box-shadow: ${({ theme }) => theme.sombraSuave};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colores.error};
      border-color: ${({ theme }) => theme.colores.error};
      color: #fff;
      box-shadow: ${({ theme }) => theme.sombraBotonPeligro};
    }

    &:active:not(:disabled) {
      background: ${({ theme }) => theme.colores.errorOscuro};
      border-color: ${({ theme }) => theme.colores.errorOscuro};
      color: #fff;
    }
  `,
  fantasma: css`
    background: transparent;
    border-color: transparent;
    color: ${({ theme }) => theme.colores.textoSuave};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colores.lateral};
      color: ${({ theme }) => theme.colores.texto};
    }

    &:active:not(:disabled) {
      background: ${({ theme }) => theme.colores.lateralActivo};
    }
  `,
};

// Con $cargando el botón muestra un indicador giratorio en lugar de su ícono y se
// marca aria-busy. No lo deshabilita: cada pantalla mantiene su disabled y su texto.
const indicadorCarga = css`
  &[aria-busy='true'] {
    cursor: progress;
  }

  &[aria-busy='true']:disabled {
    opacity: 0.85;
  }

  &[aria-busy='true'] .icono {
    display: none;
  }

  &[aria-busy='true']::before {
    content: '';
    flex-shrink: 0;
    width: 1em;
    height: 1em;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: ${girar} 0.7s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &[aria-busy='true']::before {
      animation-duration: 2s;
    }
  }
`;

export const Boton = styled.button.attrs(({ $cargando }) => ({
  'aria-busy': $cargando ? true : undefined,
}))`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radioBoton};
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.2;
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
  ${estadosInteractivos}
  ${({ $variante = 'primario' }) =>
    variantesBoton[$variante] ?? variantesBoton.primario}

  .icono {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  &:focus-visible:not(:disabled) {
    box-shadow: ${({ theme }) => theme.anilloFoco};
  }

  &:disabled {
    opacity: 0.5;
    box-shadow: none;
    transform: none;
  }

  ${indicadorCarga}

  @media (max-width: ${({ theme }) => theme.movil}) {
    min-height: 44px;
  }
`;

export const BotonPequeno = styled(Boton)`
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  font-size: 13.5px;

  .icono {
    width: 16px;
    height: 16px;
  }

  @media (max-width: ${({ theme }) => theme.movil}) {
    min-height: 40px;
  }
`;

// Botón cuadrado de solo ícono (‹ ›, ↑ ↓, cerrar…). Siempre con aria-label. Por
// defecto es secundario; mide lo mismo que Boton (o BotonPequeno con $pequeno)
// para alinearse con los botones de texto vecinos.
const ladoIcono = ({ $pequeno }) => ($pequeno ? '34px' : '40px');
const ladoIconoMovil = ({ $pequeno }) => ($pequeno ? '40px' : '44px');

export const BotonIcono = styled(Boton).attrs(({ $variante }) => ({
  $variante: $variante ?? 'secundario',
}))`
  width: ${ladoIcono};
  min-height: ${ladoIcono};
  height: ${ladoIcono};
  padding: 0;

  .icono {
    width: ${({ $pequeno }) => ($pequeno ? '16px' : '18px')};
    height: ${({ $pequeno }) => ($pequeno ? '16px' : '18px')};
  }

  @media (max-width: ${({ theme }) => theme.movil}) {
    width: ${ladoIconoMovil};
    min-height: ${ladoIconoMovil};
    height: ${ladoIconoMovil};
  }
`;

// Boton que navega a otra ruta (react-router), con las mismas variantes.
export const BotonEnlazado = styled(Boton).attrs({ as: Link })``;

// Acción compacta de filas, tablas y listas (Editar, Desactivar, Eliminar, Ver…):
// ícono + texto, sin fondo en reposo y con fondo tonal al pasar el cursor. Con
// $peligro se muestra en rojo; con $soloIcono es un cuadrado (requiere aria-label).
export const BotonAccion = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  ${({ $soloIcono }) =>
    $soloIcono
      ? css`
          width: 32px;
          padding: 0;
        `
      : css`
          padding: 0 10px;
        `}
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: ${({ theme, $peligro }) =>
    $peligro ? theme.colores.error : theme.colores.enlace};
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  ${estadosInteractivos}

  .icono {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  &:hover:not(:disabled) {
    background: ${({ theme, $peligro }) =>
      $peligro ? theme.colores.errorFondo : theme.colores.lateral};
    border-color: ${({ theme, $peligro }) =>
      $peligro ? theme.colores.errorBorde : theme.colores.bordeTarjeta};
    color: ${({ theme, $peligro }) =>
      $peligro ? theme.colores.errorOscuro : theme.colores.primarioOscuro};
  }

  &:active:not(:disabled) {
    background: ${({ theme, $peligro }) =>
      $peligro ? theme.colores.errorPresionado : theme.colores.lateralActivo};
  }

  &:disabled {
    color: ${({ theme }) => theme.colores.deshabilitado};
    opacity: 0.7;
  }

  @media (max-width: ${({ theme }) => theme.movil}) {
    min-height: 40px;
    ${({ $soloIcono }) => $soloIcono && 'width: 40px;'}
  }
`;

// Agrupa BotonAccion en una fila. El margen negativo evita que las acciones
// agranden la altura de la fila de la tabla.
export const GrupoAcciones = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 4px;
  margin-block: -5px;
`;

// Acción dentro de una frase ("Ver la versión actual", "Reintentar"), con aspecto
// de enlace. El relleno y el fondo al pasar el cursor agrandan el área de toque;
// el margen negativo lo compensa para que el texto no se desplace.
export const BotonEnlace = styled.button`
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  margin: -4px -5px;
  padding: 2px 5px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: ${({ theme, $peligro }) =>
    $peligro ? theme.colores.error : theme.colores.enlace};
  text-align: left;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  ${estadosInteractivos}

  &:hover:not(:disabled) {
    background: ${({ theme, $peligro }) =>
      $peligro ? theme.colores.errorFondo : theme.colores.lateral};
    text-decoration-thickness: 2px;
  }

  &:active:not(:disabled) {
    background: ${({ theme, $peligro }) =>
      $peligro ? theme.colores.errorPresionado : theme.colores.lateralActivo};
  }

  &:disabled {
    color: ${({ theme }) => theme.colores.deshabilitado};
  }

  @media (max-width: ${({ theme }) => theme.movil}) {
    min-height: 40px;
    margin-block: -10px;
  }
`;

// Opción en forma de píldora que se activa o desactiva (filtros, áreas,
// asistencia). Indicar su estado con aria-pressed. Con $tono (ver TONOS_SESION),
// la opción activa toma esos colores.
export const BotonFiltro = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid
    ${({ theme, $activo }) =>
      $activo ? theme.colores.primario : theme.colores.bordeBoton};
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: ${({ $activo }) => ($activo ? 600 : 500)};
  background: ${({ theme, $activo }) =>
    $activo ? theme.colores.lateralActivo : theme.colores.superficie};
  color: ${({ theme, $activo }) =>
    $activo ? theme.colores.primarioOscuro : '#4f454a'};
  box-shadow: ${({ theme, $activo }) => ($activo ? 'none' : theme.sombraSuave)};
  white-space: nowrap;
  ${estadosInteractivos}

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colores.primario};
    color: ${({ theme }) => theme.colores.primarioOscuro};
    background: ${({ theme, $activo }) =>
      $activo ? theme.colores.lateralActivo : theme.colores.lateral};
  }

  &:active:not(:disabled) {
    background: ${({ theme }) => theme.colores.lateralPresionado};
  }

  ${({ theme, $activo, $tono }) =>
    $activo &&
    $tono &&
    css`
      &,
      &:hover:not(:disabled) {
        border-color: ${theme.colores[$tono.borde]};
        color: ${theme.colores[$tono.texto]};
        background: ${theme.colores[$tono.fondo]};
      }
    `}

  &:disabled {
    opacity: 0.55;
  }

  @media (max-width: ${({ theme }) => theme.movil}) {
    min-height: 38px;
  }
`;

export const Chip = styled.span`
  display: inline-block;
  border: 1.5px solid #8c8c8c;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 13.5px;
  color: #555555;
  white-space: nowrap;
`;

export const Alerta = styled.div`
  padding: 9px 12px;
  border-radius: 4px;
  border: 1.5px solid
    ${({ theme, $tipo }) => ($tipo === 'exito' ? theme.colores.exito : theme.colores.errorBorde)};
  background: ${({ theme, $tipo }) =>
    $tipo === 'exito' ? theme.colores.exitoFondo : theme.colores.errorFondo};
  color: ${({ theme, $tipo }) => ($tipo === 'exito' ? theme.colores.exito : theme.colores.error)};
`;

export const Cargando = styled.p`
  color: ${({ theme }) => theme.colores.textoSuave};
  text-align: center;
  padding: 32px 16px;
`;

export const ContenedorTabla = styled.div`
  overflow-x: auto;
`;

export const Tabla = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    text-align: left;
    font-weight: 700;
    padding: 9px 12px;
    border-bottom: 2px solid ${({ theme }) => theme.colores.primario};
  }

  td {
    padding: 10px 12px;
    border-bottom: 1.5px dashed ${({ theme }) => theme.colores.bordeSuave};
    vertical-align: top;
  }
`;
