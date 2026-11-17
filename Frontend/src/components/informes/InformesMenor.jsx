import { Link } from 'react-router-dom';
import { estadoInforme } from '../../constants/informes';
import { formatearDia, formatearFecha } from '../../utils/formato';
import {
  BotonEnlazado,
  Chip,
  ContenedorTabla,
  CuerpoPanel,
  EncabezadoPanel,
  Panel,
  Tabla,
  TextoAyuda,
  TituloSeccion,
} from '../ui';
import Icono from '../Icono';

// Pestaña «Informes» de la ficha del menor (solo para quien emite informes).
export default function InformesMenor({ menor, informes }) {
  return (
    <Panel aria-labelledby="titulo-informes">
      <EncabezadoPanel>
        <TituloSeccion id="titulo-informes">Informes</TituloSeccion>
        <BotonEnlazado to={`/informes/nuevo?menor=${menor._id}`}>
          <Icono nombre="agregar" />
          Nuevo informe
        </BotonEnlazado>
      </EncabezadoPanel>
      <CuerpoPanel>
        {informes.length === 0 ? (
          <TextoAyuda as="p">
            Aún no hay informes registrados para este menor.
          </TextoAyuda>
        ) : (
          <ContenedorTabla>
            <Tabla>
              <thead>
                <tr>
                  <th scope="col">Fecha del informe</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Última modificación</th>
                  <th scope="col">Profesional</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {informes.map((informe) => (
                  <tr key={informe._id}>
                    <td>{formatearDia(informe.fechaInforme)}</td>
                    <td>
                      <Chip>{estadoInforme(informe)}</Chip>
                    </td>
                    <td>{formatearFecha(informe.contenidoActualizadoEn)}</td>
                    <td>{informe.creadoPor?.nombre ?? '—'}</td>
                    <td>
                      <Link
                        to={`/menores/${menor._id}/informes/${informe._id}`}
                        aria-label={`Abrir informe del ${formatearDia(informe.fechaInforme)}`}
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </ContenedorTabla>
        )}
      </CuerpoPanel>
    </Panel>
  );
}
