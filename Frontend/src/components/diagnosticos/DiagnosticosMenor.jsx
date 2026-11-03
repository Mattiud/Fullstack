import { useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import {
  NOMBRES_ESTADOS_DIAGNOSTICO,
  etiquetaVersion,
} from '../../constants/diagnosticos';
import { formatearDia, formatearFecha } from '../../utils/formato';
import ModalDiagnostico from './ModalDiagnostico';
import TipoDiagnostico from './TipoDiagnostico';
import {
  Boton,
  Chip,
  ContenedorTabla,
  CuerpoPanel,
  EncabezadoPanel,
  Panel,
  Tabla,
  TextoAyuda,
  TituloSeccion,
} from '../ui';

const Autor = styled.span`
  display: block;
  color: #777777;
  font-size: 13.5px;
`;

// Pestaña "Diagnósticos" de la ficha del menor.
export default function DiagnosticosMenor({
  menor,
  diagnosticos,
  puedeEditar,
  onGuardado,
}) {
  const [registrando, setRegistrando] = useState(false);

  return (
    <Panel aria-labelledby="titulo-diagnosticos">
      <EncabezadoPanel>
        <TituloSeccion id="titulo-diagnosticos">Diagnósticos</TituloSeccion>
        {puedeEditar && (
          <Boton type="button" onClick={() => setRegistrando(true)}>
            + Nuevo diagnóstico
          </Boton>
        )}
      </EncabezadoPanel>
      <CuerpoPanel>
        {diagnosticos.length === 0 ? (
          <TextoAyuda as="p">
            Aún no hay diagnósticos registrados para este menor.
          </TextoAyuda>
        ) : (
          <ContenedorTabla>
            <Tabla>
              <thead>
                <tr>
                  <th scope="col">Tipo</th>
                  <th scope="col">Fecha de evaluación</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Versión</th>
                  <th scope="col">Última modificación</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {diagnosticos.map((diagnostico) => (
                  <tr key={diagnostico._id}>
                    <td>
                      <TipoDiagnostico diagnostico={diagnostico} />
                    </td>
                    <td>{formatearDia(diagnostico.fechaEvaluacion)}</td>
                    <td>
                      <Chip>
                        {NOMBRES_ESTADOS_DIAGNOSTICO[diagnostico.estado]}
                      </Chip>
                    </td>
                    <td>{etiquetaVersion(diagnostico)}</td>
                    <td>
                      {formatearFecha(diagnostico.updatedAt)}
                      <Autor>{diagnostico.actualizadoPor?.nombre}</Autor>
                    </td>
                    <td>
                      <Link
                        to={`/menores/${menor._id}/diagnosticos/${diagnostico._id}`}
                        aria-label={`Ver diagnóstico ${diagnostico.tipo || 'sin tipo'}`}
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </ContenedorTabla>
        )}
      </CuerpoPanel>
      {registrando && (
        <ModalDiagnostico
          menor={{ _id: menor._id, nombre: menor.nombre }}
          onCerrar={() => setRegistrando(false)}
          onGuardado={(diagnostico, mensaje) => {
            setRegistrando(false);
            onGuardado(diagnostico, mensaje);
          }}
        />
      )}
    </Panel>
  );
}
