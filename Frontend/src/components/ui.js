import styled, { css } from 'styled-components';

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

const variantesBoton = {
  primario: css`
    background: ${({ theme }) => theme.colores.primario};
    border-color: ${({ theme }) => theme.colores.primario};
    color: #fff;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colores.primarioOscuro};
      border-color: ${({ theme }) => theme.colores.primarioOscuro};
    }
  `,
  secundario: css`
    background: ${({ theme }) => theme.colores.superficie};
    border-color: ${({ theme }) => theme.colores.primario};
    color: ${({ theme }) => theme.colores.texto};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colores.lateral};
    }
  `,
  peligro: css`
    background: ${({ theme }) => theme.colores.superficie};
    border-color: ${({ theme }) => theme.colores.error};
    color: ${({ theme }) => theme.colores.error};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colores.errorFondo};
    }
  `,
};

export const Boton = styled.button`
  padding: 6px 14px;
  border: 2px solid transparent;
  border-radius: 4px;
  white-space: nowrap;
  cursor: pointer;
  ${({ $variante = 'primario' }) => variantesBoton[$variante]}

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colores.primario};
    outline-offset: 2px;
  }
`;

export const BotonPequeno = styled(Boton)`
  padding: 4px 10px;
  font-size: 0.8125rem;
`;

// Acción en línea con apariencia de enlace ("Editar · Desactivar" en el mockup 1k).
export const BotonEnlace = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: ${({ theme, $peligro }) => ($peligro ? theme.colores.error : theme.colores.enlace)};
  text-decoration: underline;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    color: ${({ theme }) => theme.colores.deshabilitado};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colores.primario};
    outline-offset: 2px;
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
