import styled, { css } from 'styled-components';

// Chip que se activa o desactiva (filtros, asistencia y logro de objetivos). Indicar
// su estado con aria-pressed. Con $tono (ver TONOS_SESION), la opción activa toma
// esos colores.
const ChipSeleccionable = styled.button`
  border: 1.5px solid
    ${({ theme, $activo }) => ($activo ? theme.colores.primario : '#8c8c8c')};
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 13.5px;
  background: ${({ theme, $activo }) =>
    $activo ? theme.colores.lateralActivo : theme.colores.superficie};
  color: ${({ $activo }) => ($activo ? '#222222' : '#555555')};
  cursor: pointer;
  white-space: nowrap;

  ${({ theme, $activo, $tono }) =>
    $activo &&
    $tono &&
    css`
      border-color: ${theme.colores[$tono.borde]};
      color: ${theme.colores[$tono.texto]};
      background: ${theme.colores[$tono.fondo]};
    `}

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colores.primario};
    outline-offset: 2px;
  }
`;

export default ChipSeleccionable;
