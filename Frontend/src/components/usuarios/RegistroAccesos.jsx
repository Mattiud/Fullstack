import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { listarAuditoria } from '../../api/audit';
import { mensajeDeError } from '../../api/client';
import { describirAuditoria, formatearFecha } from '../../utils/formato';
import {
  CuerpoPanel,
  EncabezadoPanel,
  ErrorCampo,
  Panel,
  TextoAyuda,
  TituloSeccion,
} from '../ui';

const Lista = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
  color: #555555;
`;

const CANTIDAD = 8;

// Últimos eventos del registro de auditoría. `version` cambia tras cada modificación
// en la página para volver a consultarlo.
export default function RegistroAccesos({ usuarios, version }) {
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    listarAuditoria({ limite: CANTIDAD })
      .then((datos) => {
        if (!vigente) return;
        setRegistros(datos);
        setError('');
      })
      .catch((err) => {
        if (vigente)
          setError(mensajeDeError(err, 'No se pudo cargar el registro'));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [version]);

  const usuariosPorId = new Map(
    usuarios.map((usuario) => [usuario._id, usuario])
  );

  return (
    <Panel aria-labelledby="titulo-registro">
      <EncabezadoPanel>
        <TituloSeccion id="titulo-registro">
          Registro de accesos y cambios
        </TituloSeccion>
      </EncabezadoPanel>
      <CuerpoPanel>
        {error && <ErrorCampo role="alert">{error}</ErrorCampo>}
        {!error && cargando && <TextoAyuda>Cargando registro…</TextoAyuda>}
        {!error && !cargando && registros.length === 0 && (
          <TextoAyuda>Aún no hay eventos registrados.</TextoAyuda>
        )}
        {!error && registros.length > 0 && (
          <Lista>
            {registros.map((registro) => (
              <li key={registro._id}>
                {formatearFecha(registro.fecha)} ·{' '}
                {registro.usuario?.nombre ?? 'desconocido'} ·{' '}
                {describirAuditoria(registro, usuariosPorId)}
              </li>
            ))}
          </Lista>
        )}
      </CuerpoPanel>
    </Panel>
  );
}
