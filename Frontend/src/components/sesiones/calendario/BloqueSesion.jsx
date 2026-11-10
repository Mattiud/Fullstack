import { Link } from 'react-router-dom';
import styled, { css } from 'styled-components';
import {
  ESTADOS_SESION,
  NOMBRES_ASISTENCIA,
  NOMBRES_ESTADOS_SESION,
  TONOS_SESION,
  horario,
} from '../../../constants/sesiones';

// Bloque de una sesión en el calendario (mockup 1i): abre la planificación (1h). El
// color es el de la asistencia, si se registró; si no, el de "Planificada". Los
// borradores se ven con borde discontinuo. En la vista semanal el bloque mide lo que
// dura la sesión (variable --alto) y, al pasar el mouse o enfocarlo con el teclado,
// se expande para mostrar toda la información sobre los bloques vecinos.

const Linea = styled.span`
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const Enlace = styled(Link)`
  display: block;
  overflow: hidden;
  border: 1.5px solid #8c8c8c;
  border-radius: 4px;
  padding: 4px 7px;
  font-size: 13px;
  line-height: 1.3;
  color: ${({ theme }) => theme.colores.texto};
  background: ${({ theme }) => theme.colores.superficieSuave};
  text-decoration: none;

  ${({ theme, $tono }) =>
    $tono &&
    css`
      border-color: ${theme.colores[$tono.borde]};
      background: ${theme.colores[$tono.fondo]};
    `}

  ${({ theme, $borrador }) =>
    $borrador &&
    css`
      border-style: dashed;
      color: ${theme.colores.textoSuave};
    `}

  ${({ $compacto }) =>
    $compacto &&
    css`
      padding: 1px 6px;
      font-size: 12.5px;
      white-space: nowrap;
      text-overflow: ellipsis;
    `}

  ${({ $expandible }) =>
    $expandible &&
    css`
      height: var(--alto);
      transition: box-shadow 0.15s ease;

      &:hover,
      &:focus-visible {
        height: auto;
        min-height: var(--alto);
        min-width: 200px;
        overflow: visible;
        z-index: 3;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
      }

      &:hover ${Linea}, &:focus-visible ${Linea} {
        white-space: normal;
        overflow-wrap: anywhere;
      }
    `}

  &:hover {
    filter: brightness(0.96);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colores.primario};
    outline-offset: 1px;
  }
`;

const Secundaria = styled(Linea)`
  color: ${({ theme }) => theme.colores.textoSuave};
  font-size: 12.5px;
`;

const Estado = styled.span`
  color: ${({ theme, $tono }) =>
    $tono ? theme.colores[$tono.texto] : theme.colores.textoSuave};
  font-weight: 700;
`;

export default function BloqueSesion({ sesion, compacto = false, style }) {
  const borrador = sesion.estado === ESTADOS_SESION.BORRADOR;
  const tono = sesion.asistencia
    ? TONOS_SESION[sesion.asistencia]
    : TONOS_SESION[sesion.estado];
  const estado = sesion.asistencia
    ? NOMBRES_ASISTENCIA[sesion.asistencia]
    : NOMBRES_ESTADOS_SESION[sesion.estado];
  const horas = horario(sesion) === '—' ? 'Sin horario' : horario(sesion);
  const descripcion = [
    sesion.menor.nombre,
    horas,
    estado,
    sesion.primerObjetivo && `Objetivo: ${sesion.primerObjetivo}`,
    sesion.profesional && `Profesional: ${sesion.profesional.nombre}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Enlace
      to={`/menores/${sesion.menor._id}/sesiones/${sesion._id}`}
      aria-label={`Ver sesión: ${descripcion}`}
      // En la vista semanal el bloque se expande; el aviso nativo sería redundante.
      title={compacto ? descripcion : undefined}
      style={style}
      $tono={tono}
      $borrador={borrador}
      $compacto={compacto}
      $expandible={!compacto}
    >
      {compacto ? (
        <>
          {sesion.horaInicio && <strong>{sesion.horaInicio} </strong>}
          {sesion.menor.nombre}
        </>
      ) : (
        <>
          <Linea as="strong">{sesion.menor.nombre}</Linea>
          <Secundaria>
            {horas} · <Estado $tono={tono}>{estado}</Estado>
          </Secundaria>
          {sesion.primerObjetivo && <Linea>{sesion.primerObjetivo}</Linea>}
          {sesion.profesional && (
            <Secundaria>{sesion.profesional.nombre}</Secundaria>
          )}
        </>
      )}
    </Enlace>
  );
}
