import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { ESTADOS_DIAGNOSTICO } from '../../constants/diagnosticos';
import { formatearFecha } from '../../utils/formato';
import TipoDiagnostico from './TipoDiagnostico';
import {
  Chip,
  CuerpoPanel,
  EncabezadoPanel,
  Panel,
  TextoAyuda,
  TituloSeccion,
} from '../ui';

const Lista = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
`;

const Tipo = styled(Link)`
  display: block;
  font-weight: 700;
  margin-bottom: 6px;
  color: inherit;
`;

const Detalle = styled.div`
  color: #555555;
`;

const Chips = styled.div`
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

// Panel "Diagnóstico vigente" del resumen de la ficha (mockup 1f).
export default function DiagnosticoVigente({ menorId, diagnosticos }) {
  const vigentes = diagnosticos.filter(
    (d) => d.estado === ESTADOS_DIAGNOSTICO.VIGENTE
  );

  return (
    <Panel aria-labelledby="titulo-diagnostico-vigente">
      <EncabezadoPanel>
        <TituloSeccion id="titulo-diagnostico-vigente">
          {vigentes.length > 1
            ? 'Diagnósticos vigentes'
            : 'Diagnóstico vigente'}
        </TituloSeccion>
      </EncabezadoPanel>
      <CuerpoPanel>
        {vigentes.length === 0 ? (
          <TextoAyuda as="p">Sin diagnóstico vigente.</TextoAyuda>
        ) : (
          <Lista>
            {vigentes.map((diagnostico) => (
              <li key={diagnostico._id}>
                <Tipo
                  to={`/menores/${menorId}/diagnosticos/${diagnostico._id}`}
                >
                  <TipoDiagnostico diagnostico={diagnostico} />
                </Tipo>
                <Detalle>
                  Registrado {formatearFecha(diagnostico.updatedAt)} · v
                  {diagnostico.version}
                  {diagnostico.actualizadoPor &&
                    ` · ${diagnostico.actualizadoPor.nombre}`}
                </Detalle>
                <Chips>
                  <Chip>Vigente</Chip>
                </Chips>
              </li>
            ))}
          </Lista>
        )}
      </CuerpoPanel>
    </Panel>
  );
}
