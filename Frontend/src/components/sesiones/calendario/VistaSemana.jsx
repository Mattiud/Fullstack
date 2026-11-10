import styled from 'styled-components';
import {
  asignarCarriles,
  etiquetaDia,
  minutosDe,
} from '../../../utils/calendario';
import BloqueSesion from './BloqueSesion';

// Vista semanal del mockup 1i: una columna por día y una fila de 62 px por hora. Las
// horas van de 08:00 a 18:00 y se amplían si alguna sesión queda fuera. Las sesiones
// que se superponen se muestran lado a lado.

const ALTO_HORA = 62;
const HORA_INICIO = 8;
const HORA_FIN = 18;

const Contenedor = styled.div`
  overflow-x: auto;
  border: 1.5px solid ${({ theme }) => theme.colores.bordeTarjeta};
  border-radius: ${({ theme }) => theme.radio};
  background: ${({ theme }) => theme.colores.superficie};
`;

const Grilla = styled.div`
  display: grid;
  grid-template-columns: 62px repeat(
      ${({ $dias }) => $dias},
      minmax(140px, 1fr)
    );
  min-width: ${({ $dias }) => 62 + $dias * 140}px;
`;

const Encabezado = styled.div`
  padding: 9px;
  text-align: center;
  font-weight: 700;
  border-bottom: 2px solid ${({ theme }) => theme.colores.primario};
  border-left: 1.5px solid ${({ theme }) => theme.colores.bordeSuave};
  background: ${({ theme, $hoy }) =>
    $hoy ? theme.colores.lateralActivo : 'transparent'};
`;

const Esquina = styled.div`
  border-bottom: 2px solid ${({ theme }) => theme.colores.primario};
`;

const EtiquetaFila = styled.div`
  padding: 6px;
  font-size: 12.5px;
  color: #777777;
  text-align: right;
  border-bottom: 1.5px dashed ${({ theme }) => theme.colores.bordeSuave};
`;

const CeldaSinHorario = styled.div`
  padding: 5px;
  display: grid;
  gap: 4px;
  align-content: start;
  border-left: 1.5px solid ${({ theme }) => theme.colores.bordeSuave};
  border-bottom: 1.5px dashed ${({ theme }) => theme.colores.bordeSuave};
`;

const Horas = styled.div`
  color: #777777;
  font-size: 13.5px;

  div {
    height: ${ALTO_HORA}px;
    padding: 4px 6px;
    text-align: right;
  }
`;

const Dia = styled.div`
  position: relative;
  height: ${({ $alto }) => $alto}px;
  border-left: 1.5px solid ${({ theme }) => theme.colores.bordeSuave};
  background: repeating-linear-gradient(
    #ffffff,
    #ffffff ${ALTO_HORA - 1}px,
    #e9e9e7 ${ALTO_HORA - 1}px,
    #e9e9e7 ${ALTO_HORA}px
  );
`;

const dosDigitos = (n) => String(n).padStart(2, '0');
const tieneHorario = (sesion) => Boolean(sesion.horaInicio && sesion.horaFin);

export default function VistaSemana({ dias, sesiones, hoy }) {
  const porDia = new Map(dias.map((dia) => [dia, []]));
  for (const sesion of sesiones) {
    porDia.get(sesion.fecha.slice(0, 10))?.push(sesion);
  }

  const conHorario = sesiones.filter(tieneHorario);
  const inicio = Math.min(
    HORA_INICIO,
    ...conHorario.map((s) => Math.floor(minutosDe(s.horaInicio) / 60))
  );
  const fin = Math.max(
    HORA_FIN,
    ...conHorario.map((s) => Math.ceil(minutosDe(s.horaFin) / 60))
  );
  const horas = Array.from({ length: fin - inicio }, (_, i) => inicio + i);
  const haySinHorario = sesiones.some((s) => !tieneHorario(s));

  return (
    <Contenedor>
      <Grilla $dias={dias.length}>
        <Esquina />
        {dias.map((dia) => (
          <Encabezado key={dia} $hoy={dia === hoy}>
            {etiquetaDia(dia)}
            {dia === hoy && <span className="sr-only"> (hoy)</span>}
          </Encabezado>
        ))}

        {haySinHorario && (
          <>
            <EtiquetaFila>Sin horario</EtiquetaFila>
            {dias.map((dia) => (
              <CeldaSinHorario
                key={dia}
                role="group"
                aria-label={`Sin horario ${etiquetaDia(dia)}`}
              >
                {porDia
                  .get(dia)
                  .filter((s) => !tieneHorario(s))
                  .map((sesion) => (
                    <BloqueSesion key={sesion._id} sesion={sesion} compacto />
                  ))}
              </CeldaSinHorario>
            ))}
          </>
        )}

        <Horas aria-hidden="true">
          {horas.map((hora) => (
            <div key={hora}>{dosDigitos(hora)}:00</div>
          ))}
        </Horas>
        {dias.map((dia) => {
          const delDia = porDia.get(dia).filter(tieneHorario);
          const carriles = asignarCarriles(delDia);
          return (
            <Dia
              key={dia}
              role="group"
              aria-label={etiquetaDia(dia)}
              $alto={horas.length * ALTO_HORA}
            >
              {delDia.map((sesion) => {
                const desde = minutosDe(sesion.horaInicio) - inicio * 60;
                const duracion =
                  minutosDe(sesion.horaFin) - minutosDe(sesion.horaInicio);
                const { carril, carriles: total } = carriles.get(sesion._id);
                return (
                  <BloqueSesion
                    key={sesion._id}
                    sesion={sesion}
                    style={{
                      position: 'absolute',
                      top: `${(desde / 60) * ALTO_HORA + 2}px`,
                      // Altura según la duración; el bloque la usa para poder
                      // expandirse al pasar el mouse.
                      '--alto': `${Math.max((duracion / 60) * ALTO_HORA - 4, 24)}px`,
                      left: `calc(${(carril * 100) / total}% + 4px)`,
                      width: `calc(${100 / total}% - 8px)`,
                    }}
                  />
                );
              })}
            </Dia>
          );
        })}
      </Grilla>
    </Contenedor>
  );
}
