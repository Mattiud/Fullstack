import styled from 'styled-components';
import { formatearDia } from '../../../utils/formato';
import { mismoMes, nombreDia } from '../../../utils/calendario';
import { BotonEnlace } from '../../ui';
import BloqueSesion from './BloqueSesion';

// Vista mensual: 6 semanas de lunes a domingo. Cada día muestra hasta 3 sesiones;
// "+N más" abre la semana de ese día.

const MAXIMO_POR_DIA = 3;

const Contenedor = styled.div`
  overflow-x: auto;
  border: 1.5px solid ${({ theme }) => theme.colores.bordeTarjeta};
  border-radius: ${({ theme }) => theme.radio};
  background: ${({ theme }) => theme.colores.superficie};
`;

const Grilla = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(110px, 1fr));
  min-width: 770px;
`;

const Encabezado = styled.div`
  padding: 9px;
  text-align: center;
  font-weight: 700;
  border-bottom: 2px solid ${({ theme }) => theme.colores.primario};
`;

const Celda = styled.div`
  min-height: 104px;
  padding: 5px;
  display: grid;
  gap: 4px;
  align-content: start;
  border-left: 1.5px solid ${({ theme }) => theme.colores.bordeSuave};
  border-bottom: 1.5px solid ${({ theme }) => theme.colores.bordeSuave};
  background: ${({ theme, $hoy, $otroMes }) =>
    $hoy
      ? theme.colores.lateral
      : $otroMes
        ? theme.colores.superficieSuave
        : theme.colores.superficie};

  &:nth-child(7n + 1) {
    border-left: none;
  }
`;

const Numero = styled.span`
  font-size: 13px;
  font-weight: ${({ $hoy }) => ($hoy ? 700 : 400)};
  color: ${({ theme, $otroMes, $hoy }) =>
    $hoy
      ? theme.colores.primario
      : $otroMes
        ? theme.colores.deshabilitado
        : theme.colores.texto};
`;

const Mas = styled(BotonEnlace)`
  font-size: 12.5px;
  justify-self: start;
`;

export default function VistaMes({
  semanas,
  referencia,
  sesiones,
  hoy,
  onVerSemana,
}) {
  const porDia = new Map();
  for (const sesion of sesiones) {
    const dia = sesion.fecha.slice(0, 10);
    porDia.set(dia, [...(porDia.get(dia) ?? []), sesion]);
  }

  return (
    <Contenedor>
      <Grilla>
        {semanas[0].map((dia) => (
          <Encabezado key={dia}>{nombreDia(dia)}</Encabezado>
        ))}
        {semanas.flat().map((dia) => {
          const delDia = porDia.get(dia) ?? [];
          const otroMes = !mismoMes(dia, referencia);
          const restantes = delDia.length - MAXIMO_POR_DIA;
          return (
            <Celda
              key={dia}
              role="group"
              aria-label={`${formatearDia(dia)}${dia === hoy ? ' (hoy)' : ''}`}
              $hoy={dia === hoy}
              $otroMes={otroMes}
            >
              <Numero aria-hidden="true" $hoy={dia === hoy} $otroMes={otroMes}>
                {Number(dia.slice(8, 10))}
              </Numero>
              {delDia.slice(0, MAXIMO_POR_DIA).map((sesion) => (
                <BloqueSesion key={sesion._id} sesion={sesion} compacto />
              ))}
              {restantes > 0 && (
                <Mas
                  type="button"
                  onClick={() => onVerSemana(dia)}
                  aria-label={`Ver ${restantes} ${
                    restantes === 1 ? 'sesión más' : 'sesiones más'
                  } del ${formatearDia(dia)}`}
                >
                  +{restantes} más
                </Mas>
              )}
            </Celda>
          );
        })}
      </Grilla>
    </Contenedor>
  );
}
