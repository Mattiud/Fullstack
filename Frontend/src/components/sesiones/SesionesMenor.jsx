import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { horario, resumenObjetivos } from '../../constants/sesiones';
import { formatearDia } from '../../utils/formato';
import { ChipAsistencia, ChipEstadoSesion } from './EstadoSesion';
import {
  Boton,
  ContenedorTabla,
  CuerpoPanel,
  EncabezadoPanel,
  Panel,
  Tabla,
  TextoAyuda,
  TituloSeccion,
} from '../ui';

const BotonEnlazado = styled(Boton).attrs({ as: Link })`
  text-decoration: none;
`;

const Chips = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

// Pestaña "Sesiones" de la ficha del menor: borradores primero y luego el historial
// de sesiones planificadas, de la más reciente a la más antigua.
export default function SesionesMenor({ menor, sesiones, puedeEditar }) {
  return (
    <Panel aria-labelledby="titulo-sesiones">
      <EncabezadoPanel>
        <TituloSeccion id="titulo-sesiones">Sesiones</TituloSeccion>
        {puedeEditar && (
          <BotonEnlazado to={`/sesiones/nueva?menor=${menor._id}`}>
            + Nueva sesión
          </BotonEnlazado>
        )}
      </EncabezadoPanel>
      <CuerpoPanel>
        {sesiones.length === 0 ? (
          <TextoAyuda as="p">
            Aún no hay sesiones registradas para este menor.
          </TextoAyuda>
        ) : (
          <ContenedorTabla>
            <Tabla>
              <thead>
                <tr>
                  <th scope="col">Sesión</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Horario</th>
                  <th scope="col">Objetivos</th>
                  <th scope="col">Profesional</th>
                  <th scope="col">Estado</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sesiones.map((sesion) => {
                  const nombre = sesion.numero
                    ? `Sesión ${sesion.numero}`
                    : 'Borrador';
                  return (
                    <tr key={sesion._id}>
                      <td>{nombre}</td>
                      <td>{formatearDia(sesion.fecha)}</td>
                      <td>{horario(sesion)}</td>
                      <td>{resumenObjetivos(sesion)}</td>
                      <td>{sesion.profesional?.nombre ?? '—'}</td>
                      <td>
                        <Chips>
                          <ChipEstadoSesion estado={sesion.estado} />
                          {sesion.asistencia && (
                            <ChipAsistencia asistencia={sesion.asistencia} />
                          )}
                        </Chips>
                      </td>
                      <td>
                        <Link
                          to={`/menores/${menor._id}/sesiones/${sesion._id}`}
                          aria-label={`Ver ${nombre.toLowerCase()}`}
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabla>
          </ContenedorTabla>
        )}
      </CuerpoPanel>
    </Panel>
  );
}
