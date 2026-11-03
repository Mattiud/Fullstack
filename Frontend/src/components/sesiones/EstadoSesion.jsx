import styled, { css } from 'styled-components';
import {
  NOMBRES_ASISTENCIA,
  NOMBRES_ESTADOS_SESION,
  TONOS_SESION,
} from '../../constants/sesiones';
import { Chip } from '../ui';

// Chips del estado de la sesión y de su asistencia, con el color de TONOS_SESION. Sin
// tono (borrador) se ven como el Chip gris habitual.

const ChipTono = styled(Chip)`
  ${({ theme, $tono }) =>
    $tono &&
    css`
      border-color: ${theme.colores[$tono.borde]};
      color: ${theme.colores[$tono.texto]};
      background: ${theme.colores[$tono.fondo]};
    `}
`;

export function ChipEstadoSesion({ estado }) {
  return (
    <ChipTono $tono={TONOS_SESION[estado]}>
      {NOMBRES_ESTADOS_SESION[estado]}
    </ChipTono>
  );
}

export function ChipAsistencia({ asistencia }) {
  return (
    <ChipTono $tono={TONOS_SESION[asistencia]}>
      {NOMBRES_ASISTENCIA[asistencia]}
    </ChipTono>
  );
}
