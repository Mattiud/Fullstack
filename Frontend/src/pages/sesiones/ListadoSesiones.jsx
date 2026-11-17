import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../context/useAuth';
import { listarSesiones } from '../../api/sesiones';
import { mensajeDeError } from '../../api/client';
import { PERMISOS } from '../../constants/auth';
import { horario, resumenObjetivos } from '../../constants/sesiones';
import { formatearDia, formatearFecha } from '../../utils/formato';
import EncabezadoPagina, {
  CuerpoPagina,
} from '../../components/EncabezadoPagina';
import ChipSeleccionable from '../../components/sesiones/ChipSeleccionable';
import {
  ChipAsistencia,
  ChipEstadoSesion,
} from '../../components/sesiones/EstadoSesion';
import {
  Alerta,
  Boton,
  BotonIcono,
  Cargando,
  ContenedorTabla,
  Tabla,
  TextoAyuda,
} from '../../components/ui';
import Icono from '../../components/Icono';

// Agenda de sesiones (T08): las próximas en orden cronológico, las anteriores de la
// más reciente a la más antigua y los borradores. El backend devuelve solo las de los
// menores a los que el usuario tiene acceso.

const Filtros = styled.div`
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
  align-items: center;
`;

const Separador = styled.span`
  width: 1px;
  align-self: stretch;
  background: ${({ theme }) => theme.colores.bordeSuave};
`;

const EnlaceMenor = styled(Link)`
  font-weight: 700;
  color: inherit;
`;

const Secundario = styled.span`
  display: block;
  color: #777777;
  font-size: 13.5px;
`;

const Chips = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const Pie = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  color: #777777;
`;

const Paginas = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const VISTAS = [
  {
    valor: 'proximas',
    etiqueta: 'Próximas',
    vacio: 'No hay sesiones planificadas desde hoy.',
  },
  {
    valor: 'anteriores',
    etiqueta: 'Anteriores',
    vacio: 'No hay sesiones anteriores.',
  },
  {
    valor: 'borradores',
    etiqueta: 'Borradores',
    vacio: 'No hay borradores de sesión.',
  },
];

export default function ListadoSesiones() {
  const { tienePermiso } = useAuth();
  const navigate = useNavigate();
  const [consulta, setConsulta] = useState({
    vista: 'proximas',
    mias: false,
    pagina: 1,
  });
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const puedePlanificar = tienePermiso(PERMISOS.SESIONES_EDITAR);

  useEffect(() => {
    let vigente = true;
    setResultado(null);
    setError('');
    listarSesiones(consulta)
      .then((datos) => {
        if (vigente) setResultado(datos);
      })
      .catch((err) => {
        if (vigente)
          setError(mensajeDeError(err, 'No se pudo cargar el listado'));
      });
    return () => {
      vigente = false;
    };
  }, [consulta]);

  const totalPaginas = resultado
    ? Math.max(1, Math.ceil(resultado.total / resultado.limite))
    : 1;
  const vista = VISTAS.find((v) => v.valor === consulta.vista);

  return (
    <>
      <EncabezadoPagina
        titulo={
          <>
            Sesiones{' '}
            {resultado && (
              <TextoAyuda as="span">({resultado.total})</TextoAyuda>
            )}
          </>
        }
      >
        {puedePlanificar && (
          <Boton type="button" onClick={() => navigate('/sesiones/nueva')}>
            <Icono nombre="agregar" />
            Nueva sesión
          </Boton>
        )}
      </EncabezadoPagina>
      <CuerpoPagina>
        <Filtros>
          <Filtros role="group" aria-label="Mostrar">
            {VISTAS.map(({ valor, etiqueta }) => (
              <ChipSeleccionable
                key={valor}
                type="button"
                $activo={consulta.vista === valor}
                aria-pressed={consulta.vista === valor}
                onClick={() =>
                  setConsulta((a) => ({ ...a, vista: valor, pagina: 1 }))
                }
              >
                {etiqueta}
              </ChipSeleccionable>
            ))}
          </Filtros>
          {puedePlanificar && (
            <>
              <Separador aria-hidden="true" />
              <ChipSeleccionable
                type="button"
                $activo={consulta.mias}
                aria-pressed={consulta.mias}
                onClick={() =>
                  setConsulta((a) => ({ ...a, mias: !a.mias, pagina: 1 }))
                }
              >
                Solo mis sesiones
              </ChipSeleccionable>
            </>
          )}
        </Filtros>

        {error && <Alerta role="alert">{error}</Alerta>}
        {!resultado && !error && (
          <Cargando role="status">Cargando sesiones…</Cargando>
        )}
        {resultado && resultado.sesiones.length === 0 && (
          <TextoAyuda as="p">{vista.vacio}</TextoAyuda>
        )}
        {resultado && resultado.sesiones.length > 0 && (
          <>
            <ContenedorTabla>
              <Tabla>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Horario</th>
                    <th scope="col">Menor</th>
                    <th scope="col">Objetivos</th>
                    <th scope="col">Profesional</th>
                    <th scope="col">Estado</th>
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.sesiones.map((sesion) => (
                    <tr key={sesion._id}>
                      <td>{formatearDia(sesion.fecha)}</td>
                      <td>{horario(sesion)}</td>
                      <td>
                        <EnlaceMenor
                          to={`/menores/${sesion.menor._id}?pestana=sesiones`}
                        >
                          {sesion.menor.nombre}
                        </EnlaceMenor>
                      </td>
                      <td>
                        {resumenObjetivos(sesion)}
                        <Secundario>
                          {sesion.totalActividades === 1
                            ? '1 actividad'
                            : `${sesion.totalActividades} actividades`}
                        </Secundario>
                      </td>
                      <td>
                        {sesion.profesional?.nombre ?? '—'}
                        <Secundario>
                          Modificada el {formatearFecha(sesion.updatedAt)}
                        </Secundario>
                      </td>
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
                          to={`/menores/${sesion.menor._id}/sesiones/${sesion._id}`}
                          aria-label={`Ver sesión de ${sesion.menor.nombre}${
                            sesion.fecha
                              ? ` del ${formatearDia(sesion.fecha)}`
                              : ''
                          }`}
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            </ContenedorTabla>
            <Pie>
              <span>
                Mostrando {resultado.sesiones.length} de {resultado.total}
              </span>
              <Paginas>
                <BotonIcono
                  $pequeno
                  type="button"
                  $variante="secundario"
                  aria-label="Página anterior"
                  disabled={consulta.pagina <= 1}
                  onClick={() =>
                    setConsulta((a) => ({ ...a, pagina: a.pagina - 1 }))
                  }
                >
                  <Icono nombre="anterior" />
                </BotonIcono>
                <span>
                  {consulta.pagina} / {totalPaginas}
                </span>
                <BotonIcono
                  $pequeno
                  type="button"
                  $variante="secundario"
                  aria-label="Página siguiente"
                  disabled={consulta.pagina >= totalPaginas}
                  onClick={() =>
                    setConsulta((a) => ({ ...a, pagina: a.pagina + 1 }))
                  }
                >
                  <Icono nombre="siguiente" />
                </BotonIcono>
              </Paginas>
            </Pie>
          </>
        )}
      </CuerpoPagina>
    </>
  );
}
