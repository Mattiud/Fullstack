import styled from 'styled-components';
import { MATRIZ_PERMISOS, PERMISOS_POR_ROL, ROLES } from '../../constants/auth';
import { EncabezadoPanel, Panel, TituloSeccion } from '../ui';

const TablaMatriz = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 10px 12px;
    border-bottom: 1.5px dashed ${({ theme }) => theme.colores.bordeSuave};
    text-align: left;
  }

  th[scope='col'] {
    color: #777777;
    font-weight: 400;
    text-align: center;
  }

  th[scope='row'] {
    font-weight: 400;
  }

  td {
    text-align: center;
  }
`;

function Marca({ permitido }) {
  return permitido ? (
    <span aria-label="Permitido">✓</span>
  ) : (
    <span aria-label="No permitido">—</span>
  );
}

export default function MatrizPermisos() {
  return (
    <Panel aria-labelledby="titulo-matriz">
      <EncabezadoPanel>
        <TituloSeccion id="titulo-matriz">Matriz de permisos</TituloSeccion>
      </EncabezadoPanel>
      <TablaMatriz>
        <thead>
          <tr>
            <td aria-hidden="true" />
            <th scope="col">Admin</th>
            <th scope="col">Psicoped.</th>
          </tr>
        </thead>
        <tbody>
          {MATRIZ_PERMISOS.map(({ accion, permiso }) => (
            <tr key={permiso}>
              <th scope="row">{accion}</th>
              <td>
                <Marca
                  permitido={PERMISOS_POR_ROL[ROLES.ADMIN].includes(permiso)}
                />
              </td>
              <td>
                <Marca
                  permitido={PERMISOS_POR_ROL[ROLES.PSICOPEDAGOGO].includes(
                    permiso
                  )}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </TablaMatriz>
    </Panel>
  );
}
