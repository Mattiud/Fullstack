import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/useAuth';
import { mensajeDeError } from '../api/client';
import { listarMenores } from '../api/menores';
import { listarDiagnosticos } from '../api/diagnosticos';
import { obtenerCalendario } from '../api/sesiones';
import { listarInformes } from '../api/informes';
import { obtenerActividadReciente } from '../api/actividad';
import { PERMISOS } from '../constants/auth';
import { ESTADOS_SESION, horario } from '../constants/sesiones';
import { estadoInforme } from '../constants/informes';
import {
  describirAuditoria,
  describirHistorial,
  formatearFecha,
  hoyParaCampo,
  iniciales,
} from '../utils/formato';
import {
  etiquetaDia,
  inicioSemana,
  nombreMes,
  sumarDias,
} from '../utils/calendario';
import EncabezadoPagina, { CuerpoPagina } from '../components/EncabezadoPagina';
import BuscadorMenor from '../components/diagnosticos/BuscadorMenor';
import { ChipEstadoSesion } from '../components/sesiones/EstadoSesion';
import {
  Alerta,
  BotonEnlazado,
  Chip,
  EncabezadoPanel,
  Panel,
  TextoAyuda,
  TituloSeccion,
} from '../components/ui';
import Icono from '../components/Icono';

// Panel de inicio (mockup 1a): indicadores, próximas sesiones, informes del mes y
// actividad reciente, con datos reales de los módulos existentes. Cada rol ve solo lo
// que le permiten sus permisos (el administrador no ve informes ni planifica sesiones).

const MAXIMO_FILAS = 5;
// Período del calendario: semana actual y las siguientes (máximo del backend: 42 días).
const DIAS_CALENDARIO = 42;

const Buscador = styled.div`
  width: 260px;

  @media (max-width: ${({ theme }) => theme.movil}) {
    width: 100%;
  }
`;

const Indicadores = styled.div`
  display: grid;
  grid-template-columns: repeat(
    ${({ $columnas }) => $columnas},
    minmax(0, 1fr)
  );
  gap: 14px;

  @media (max-width: 1000px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 480px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Indicador = styled(Link)`
  border: 2px solid ${({ theme }) => theme.colores.primario};
  border-radius: ${({ theme }) => theme.radio};
  padding: 12px 14px;
  color: inherit;
  text-decoration: none;
  background: ${({ theme }) => theme.colores.superficie};

  &:hover {
    background: ${({ theme }) => theme.colores.lateral};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colores.primario};
    outline-offset: 2px;
  }
`;

const NombreIndicador = styled.span`
  display: block;
  color: #777777;
  font-size: 14px;
`;

const ValorIndicador = styled.span`
  display: block;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.3;
`;

const Columnas = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 18px;
  align-items: start;

  @media (max-width: ${({ theme }) => theme.movil}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const ColumnaDerecha = styled.div`
  display: grid;
  gap: 18px;
  min-width: 0;
`;

// Paneles con el borde del mockup (2px en el color principal).
const PanelInicio = styled(Panel)`
  border: 2px solid ${({ theme }) => theme.colores.primario};
`;

const EnlacePanel = styled(Link)`
  font-size: 14px;
  color: #777777;
`;

const Lista = styled.ul`
  list-style: none;
  margin: 0;
  padding: 4px 0;
`;

const FilaSesion = styled.li`
  border-bottom: 1.5px dashed ${({ theme }) => theme.colores.bordeSuave};

  &:last-child {
    border-bottom: none;
  }

  a {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 11px 14px;
    color: inherit;
    text-decoration: none;
  }

  a:hover {
    background: ${({ theme }) => theme.colores.lateral};
  }
`;

const Avatar = styled.span`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.colores.primario};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex: none;
`;

const TextoSesion = styled.span`
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
`;

const Secundario = styled.span`
  display: block;
  color: #777777;
  font-size: 14px;
`;

const ListaSimple = styled.ul`
  list-style: none;
  margin: 0;
  padding: 12px 14px;
  display: grid;
  gap: 10px;
`;

const FilaInforme = styled.li`
  a {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    color: inherit;
    text-decoration: none;
  }

  a:hover span:first-child {
    text-decoration: underline;
  }
`;

const FilaActividad = styled.li`
  font-size: 14.5px;
  color: #555555;
  overflow-wrap: anywhere;
`;

const Contenido = styled.div`
  padding: 12px 14px;
`;

// Carga independiente de cada bloque: un fallo no impide mostrar los demás.
function useDatos(cargar, habilitado = true) {
  const [estado, setEstado] = useState({
    cargando: habilitado,
    datos: null,
    error: '',
  });
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  useEffect(() => {
    if (!habilitado) return undefined;
    let vigente = true;
    Promise.resolve()
      .then(() => cargarRef.current())
      .then((datos) => {
        if (vigente) setEstado({ cargando: false, datos, error: '' });
      })
      .catch((err) => {
        if (vigente) {
          setEstado({
            cargando: false,
            datos: null,
            error: mensajeDeError(err, 'No se pudo cargar la información'),
          });
        }
      });
    return () => {
      vigente = false;
    };
  }, [habilitado]);

  return estado;
}

function TarjetaIndicador({ nombre, estado, valor, destino }) {
  let contenido = valor;
  if (estado.cargando) contenido = '…';
  else if (estado.error) contenido = '—';
  return (
    <Indicador to={destino} aria-busy={estado.cargando || undefined}>
      <NombreIndicador>{nombre}</NombreIndicador>
      <ValorIndicador>{contenido}</ValorIndicador>
      {estado.error && <TextoAyuda>No disponible</TextoAyuda>}
    </Indicador>
  );
}

// Carga, error o ausencia de datos de un panel.
function EstadoPanel({ estado, vacio, mensajeVacio, children }) {
  if (estado.cargando) {
    return (
      <Contenido>
        <TextoAyuda role="status">Cargando…</TextoAyuda>
      </Contenido>
    );
  }
  if (estado.error) {
    return (
      <Contenido>
        <Alerta role="alert">{estado.error}</Alerta>
      </Contenido>
    );
  }
  if (vacio) {
    return (
      <Contenido>
        <TextoAyuda as="p">{mensajeVacio}</TextoAyuda>
      </Contenido>
    );
  }
  return children;
}

function fechaDe(valor) {
  return String(valor ?? '').slice(0, 10);
}

function textoActividad(evento) {
  const autor = evento.usuario?.nombre ?? 'Una cuenta';
  if (evento.menor) {
    return `${autor} ${describirHistorial(evento)} · ${evento.menor.nombre}`;
  }
  // Cambios administrativos (cuentas, categorías, configuración).
  const afectados = new Map(
    evento.afectado ? [[evento.afectado._id, evento.afectado]] : []
  );
  return `${autor} ${describirAuditoria(
    { ...evento, recursoId: evento.afectado?._id },
    afectados
  )}`;
}

export default function Inicio() {
  const { tienePermiso } = useAuth();
  const navigate = useNavigate();
  const emiteInformes = tienePermiso(PERMISOS.INFORMES_EMITIR);
  const planificaSesiones = tienePermiso(PERMISOS.SESIONES_EDITAR);

  const hoy = hoyParaCampo();
  const lunes = inicioSemana(hoy);
  const domingo = sumarDias(lunes, 6);
  const mes = hoy.slice(0, 7);

  const menores = useDatos(() => listarMenores({ estado: 'activos' }));
  const diagnosticos = useDatos(() =>
    listarDiagnosticos({ estado: 'vigente' })
  );
  // Una sola consulta al calendario para el indicador semanal y las próximas sesiones.
  const sesiones = useDatos(() =>
    obtenerCalendario({
      desde: lunes,
      hasta: sumarDias(lunes, DIAS_CALENDARIO - 1),
    })
  );
  const pendientes = useDatos(
    () => listarInformes({ estado: 'pendientes' }),
    emiteInformes
  );
  const informesMes = useDatos(() => listarInformes({ mes }), emiteInformes);
  const actividad = useDatos(obtenerActividadReciente);

  const sesionesSemana = (sesiones.datos ?? []).filter(
    (s) =>
      s.estado === ESTADOS_SESION.PLANIFICADA &&
      fechaDe(s.fecha) >= lunes &&
      fechaDe(s.fecha) <= domingo
  ).length;
  const proximas = (sesiones.datos ?? [])
    .filter((s) => fechaDe(s.fecha) >= hoy)
    .slice(0, MAXIMO_FILAS);
  const mesCorto = nombreMes(`${mes}-01`).slice(0, 3);

  return (
    <>
      <EncabezadoPagina titulo="Panel de inicio">
        <Buscador>
          <BuscadorMenor
            etiqueta="Buscar menor"
            etiquetaOculta
            placeholder="Buscar menor por nombre o RUT…"
            seleccionado={null}
            onSeleccionar={(menor) => {
              if (menor) navigate(`/menores/${menor._id}`);
            }}
          />
        </Buscador>
        {planificaSesiones && (
          <BotonEnlazado to="/sesiones/nueva">
            <Icono nombre="agregar" />
            Nueva sesión
          </BotonEnlazado>
        )}
      </EncabezadoPagina>
      <CuerpoPagina>
        <Indicadores $columnas={emiteInformes ? 4 : 3} aria-label="Indicadores">
          <TarjetaIndicador
            nombre="Menores activos"
            estado={menores}
            valor={menores.datos?.total}
            destino="/menores"
          />
          <TarjetaIndicador
            nombre="Sesiones esta semana"
            estado={sesiones}
            valor={sesionesSemana}
            destino="/calendario"
          />
          {emiteInformes && (
            <TarjetaIndicador
              nombre="Informes pendientes"
              estado={pendientes}
              valor={pendientes.datos?.total}
              destino="/informes"
            />
          )}
          <TarjetaIndicador
            nombre="Diagnósticos vigentes"
            estado={diagnosticos}
            valor={diagnosticos.datos?.total}
            destino="/diagnosticos"
          />
        </Indicadores>

        <Columnas>
          <PanelInicio aria-labelledby="titulo-proximas">
            <EncabezadoPanel>
              <TituloSeccion id="titulo-proximas">
                Próximas sesiones
              </TituloSeccion>
              <EnlacePanel to="/calendario">Ver calendario →</EnlacePanel>
            </EncabezadoPanel>
            <EstadoPanel
              estado={sesiones}
              vacio={proximas.length === 0}
              mensajeVacio="No hay sesiones próximas registradas."
            >
              <Lista>
                {proximas.map((sesion) => (
                  <FilaSesion key={sesion._id}>
                    <Link
                      to={`/menores/${sesion.menor._id}/sesiones/${sesion._id}`}
                    >
                      <Avatar aria-hidden="true">
                        {iniciales(sesion.menor.nombre)}
                      </Avatar>
                      <TextoSesion>
                        {sesion.menor.nombre}
                        {sesion.primerObjetivo && ` · ${sesion.primerObjetivo}`}
                        <Secundario>
                          {etiquetaDia(fechaDe(sesion.fecha))} ·{' '}
                          {horario(sesion)}
                        </Secundario>
                      </TextoSesion>
                      <ChipEstadoSesion estado={sesion.estado} />
                    </Link>
                  </FilaSesion>
                ))}
              </Lista>
            </EstadoPanel>
          </PanelInicio>

          <ColumnaDerecha>
            {emiteInformes && (
              <PanelInicio aria-labelledby="titulo-informes-mes">
                <EncabezadoPanel>
                  <TituloSeccion id="titulo-informes-mes">
                    Informes del mes
                  </TituloSeccion>
                </EncabezadoPanel>
                <EstadoPanel
                  estado={informesMes}
                  vacio={informesMes.datos?.informes.length === 0}
                  mensajeVacio="No hay informes con fecha de este mes."
                >
                  <ListaSimple>
                    {informesMes.datos?.informes
                      .slice(0, MAXIMO_FILAS)
                      .map((informe) => (
                        <FilaInforme key={informe._id}>
                          <Link
                            to={`/menores/${informe.menor._id}/informes/${informe._id}`}
                          >
                            <span>
                              {informe.menor.nombre} — {mesCorto}
                            </span>
                            <Chip>{estadoInforme(informe)}</Chip>
                          </Link>
                        </FilaInforme>
                      ))}
                  </ListaSimple>
                </EstadoPanel>
              </PanelInicio>
            )}

            <PanelInicio aria-labelledby="titulo-actividad">
              <EncabezadoPanel>
                <TituloSeccion id="titulo-actividad">
                  Actividad reciente (trazabilidad)
                </TituloSeccion>
              </EncabezadoPanel>
              <EstadoPanel
                estado={actividad}
                vacio={actividad.datos?.length === 0}
                mensajeVacio="Aún no hay actividad registrada."
              >
                <ListaSimple>
                  {actividad.datos?.map((evento) => (
                    <FilaActividad key={evento._id}>
                      {textoActividad(evento)} · {formatearFecha(evento.fecha)}
                    </FilaActividad>
                  ))}
                </ListaSimple>
              </EstadoPanel>
            </PanelInicio>
          </ColumnaDerecha>
        </Columnas>
      </CuerpoPagina>
    </>
  );
}
