import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { obtenerHistorial } from '../../api/menores';
import { mensajeDeError } from '../../api/client';
import { describirHistorial, formatearFecha } from '../../utils/formato';
import {
  Alerta,
  Cargando,
  CuerpoPanel,
  EncabezadoPanel,
  Panel,
  TextoAyuda,
  TituloSeccion,
} from '../ui';

const Lista = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;

  li {
    display: flex;
    gap: 12px;
  }
`;

const Fecha = styled.span`
  color: #777777;
  width: 120px;
  flex: none;
`;

// Trazabilidad del expediente (T06): fecha, usuario, acción y campos modificados.
export default function HistorialMenor({ menorId, version }) {
  const [historial, setHistorial] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    obtenerHistorial(menorId)
      .then((datos) => {
        if (vigente) setHistorial(datos);
      })
      .catch((err) => {
        if (vigente)
          setError(mensajeDeError(err, 'No se pudo cargar el historial'));
      });
    return () => {
      vigente = false;
    };
  }, [menorId, version]);

  return (
    <Panel aria-labelledby="titulo-historial">
      <EncabezadoPanel>
        <TituloSeccion id="titulo-historial">
          Historial de cambios
        </TituloSeccion>
      </EncabezadoPanel>
      <CuerpoPanel>
        {error && <Alerta role="alert">{error}</Alerta>}
        {!error && !historial && (
          <Cargando role="status">Cargando historial…</Cargando>
        )}
        {historial?.length === 0 && (
          <TextoAyuda>Sin cambios registrados.</TextoAyuda>
        )}
        {historial?.length > 0 && (
          <Lista>
            {historial.map((evento) => (
              <li key={evento._id}>
                <Fecha>{formatearFecha(evento.fecha)}</Fecha>
                <span>
                  <strong>{evento.usuario?.nombre ?? 'Sistema'}</strong>{' '}
                  {describirHistorial(evento)}
                </span>
              </li>
            ))}
          </Lista>
        )}
      </CuerpoPanel>
    </Panel>
  );
}
