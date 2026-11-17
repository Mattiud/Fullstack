import { useEffect, useId, useRef, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../context/useAuth';
import { useNotificaciones } from '../../context/useNotificaciones';
import { useCambiosSinGuardar } from '../../hooks/useCambiosSinGuardar';
import {
  actualizarSesion,
  crearSesion,
  obtenerContextoSesion,
  obtenerSesion,
} from '../../api/sesiones';
import { obtenerMenor } from '../../api/menores';
import { listarDiagnosticosMenor } from '../../api/diagnosticos';
import { erroresDeCampos, mensajeDeError } from '../../api/client';
import { PERMISOS } from '../../constants/auth';
import { ESTADOS_DIAGNOSTICO } from '../../constants/diagnosticos';
import {
  ASISTENCIAS,
  ESTADOS_SESION,
  LIMITES_SESION,
  NOMBRES_ASISTENCIA,
  DURACION_PREDETERMINADA_MIN,
  TONOS_SESION,
  horario,
  sumarMinutos,
} from '../../constants/sesiones';
import {
  fechaParaCampo,
  formatearDia,
  hoyParaCampo,
} from '../../utils/formato';
import { soloErrores, validarTexto } from '../../utils/validacion';
import EncabezadoPagina, {
  CuerpoPagina,
} from '../../components/EncabezadoPagina';
import CampoFormulario from '../../components/CampoFormulario';
import BuscadorMenor from '../../components/diagnosticos/BuscadorMenor';
import ListaEditable from '../../components/sesiones/ListaEditable';
import { aplicarOperacion } from '../../components/sesiones/operacionesLista';
import ChipSeleccionable from '../../components/sesiones/ChipSeleccionable';
import {
  ChipAsistencia,
  ChipEstadoSesion,
} from '../../components/sesiones/EstadoSesion';
import {
  Alerta,
  Boton,
  Campo,
  Cargando,
  CuerpoPanel,
  EncabezadoPanel,
  ErrorCampo,
  Etiqueta,
  Panel,
  Selector,
  TextoAyuda,
  TituloSeccion,
} from '../../components/ui';

// Pantalla 1h de los mockups: registrar, consultar y editar la planificación de una
// sesión. Sin el permiso de edición (administrador) se muestra en modo de solo lectura.

const Migas = styled.nav`
  padding: 12px 20px 0;
  color: #777777;
  font-size: 14px;

  a {
    color: inherit;
  }
`;

const Acciones = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
`;

const Columnas = styled.div`
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 1fr);
  align-items: start;

  @media (max-width: ${({ theme }) => theme.movil}) {
    grid-template-columns: 1fr;
  }
`;

const Columna = styled.div`
  display: grid;
  gap: 16px;
  min-width: 0;
`;

// Deshabilita todos los controles en modo de solo lectura.
const Campos = styled.fieldset`
  border: none;
  margin: 0;
  padding: 0;
  min-width: 0;
`;

const DatosBasicos = styled.div`
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
`;

const Ancho = styled.div`
  grid-column: 1 / -1;
`;

const Contexto = styled.dl`
  margin: 0;
  display: grid;
  gap: 8px;
  font-size: 15px;

  dt {
    font-weight: 700;
  }

  dd {
    margin: 0 0 4px;
    color: #555555;
    white-space: pre-wrap;
  }
`;

const Bloque = styled.div`
  display: grid;
  gap: 12px;
`;

const Opciones = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
`;

const Logros = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;

  li {
    display: grid;
    gap: 5px;
  }
`;

const Aviso = styled.p`
  margin: 0;
  padding: 8px 10px;
  border: 1.5px dashed ${({ theme }) => theme.colores.bordeSuave};
  border-radius: 3px;
  color: ${({ theme }) => theme.colores.textoSuave};
  font-size: 14px;
`;

const MENSAJE_BORRADOR_VACIO =
  'Complete al menos un campo para guardar el borrador';

function valoresIniciales() {
  return {
    fecha: '',
    horaInicio: '',
    horaFin: '',
    diagnostico: '',
    objetivos: [],
    actividades: [],
    asistencia: '',
    observaciones: '',
  };
}

function valoresDesdeSesion(sesion) {
  return {
    fecha: fechaParaCampo(sesion.fecha),
    horaInicio: sesion.horaInicio ?? '',
    horaFin: sesion.horaFin ?? '',
    diagnostico: sesion.diagnostico?._id ?? '',
    objetivos: sesion.objetivos.map((o) => ({
      descripcion: o.descripcion,
      logrado: o.logrado ?? null,
    })),
    actividades: [...sesion.actividades],
    asistencia: sesion.asistencia ?? '',
    observaciones: sesion.observaciones ?? '',
  };
}

function datosParaApi(valores) {
  return {
    fecha: valores.fecha || null,
    horaInicio: valores.horaInicio || null,
    horaFin: valores.horaFin || null,
    diagnostico: valores.diagnostico || null,
    objetivos: valores.objetivos.map(({ descripcion, logrado }) =>
      logrado === null
        ? { descripcion: descripcion.trim() }
        : { descripcion: descripcion.trim(), logrado }
    ),
    actividades: valores.actividades.map((a) => a.trim()),
    asistencia: valores.asistencia || null,
    observaciones: valores.observaciones.trim(),
  };
}

// Solo los campos que cambiaron.
function cambiosParaApi(originales, valores) {
  const antes = datosParaApi(originales);
  const despues = datosParaApi(valores);
  return Object.fromEntries(
    Object.entries(despues).filter(
      ([campo, valor]) => JSON.stringify(valor) !== JSON.stringify(antes[campo])
    )
  );
}

// Mismas reglas que Backend/src/controller/sesiones.controller.js.
function validar(valores, estado) {
  const planificada = estado === ESTADOS_SESION.PLANIFICADA;
  const errores = {
    fecha: planificada && !valores.fecha && 'La fecha es obligatoria',
    horaInicio:
      planificada && !valores.horaInicio && 'La hora de inicio es obligatoria',
    horaFin:
      (planificada &&
        !valores.horaFin &&
        'La hora de término es obligatoria') ||
      (valores.horaInicio &&
        valores.horaFin &&
        valores.horaFin <= valores.horaInicio &&
        'La hora de término debe ser posterior a la de inicio'),
    objetivos:
      (planificada &&
        valores.objetivos.length === 0 &&
        'Agregue al menos un objetivo') ||
      (valores.objetivos.some((o) => !o.descripcion.trim()) &&
        'Cada objetivo debe tener una descripción'),
    actividades:
      (planificada &&
        valores.actividades.length === 0 &&
        'Agregue al menos una actividad') ||
      (valores.actividades.some((a) => !a.trim()) &&
        'Cada actividad debe tener una descripción'),
    observaciones: validarTexto(valores.observaciones, {
      etiqueta: 'El campo de observaciones',
      obligatorio: false,
      max: LIMITES_SESION.observaciones,
    }),
  };
  return soloErrores(errores);
}

function borradorVacio(valores) {
  return (
    !valores.fecha &&
    !valores.horaInicio &&
    !valores.horaFin &&
    !valores.diagnostico &&
    valores.objetivos.length === 0 &&
    valores.actividades.length === 0
  );
}

function etiquetaDiagnostico(diagnostico) {
  const otro = diagnostico.tipoPersonalizado ? ' (Otro)' : '';
  return `${diagnostico.tipo}${otro} · v${diagnostico.version} · evaluado el ${formatearDia(diagnostico.fechaEvaluacion)}`;
}

export default function FormularioSesion() {
  const { menorId: menorRuta, sesionId } = useParams();
  const [parametros] = useSearchParams();
  const esEdicion = Boolean(sesionId);
  const menorInicial = esEdicion ? menorRuta : parametros.get('menor');
  const navigate = useNavigate();
  const location = useLocation();
  const { tienePermiso } = useAuth();
  const { notificar } = useNotificaciones();
  const idDiagnostico = useId();

  const [sesion, setSesion] = useState(null);
  const [menor, setMenor] = useState(null);
  const [diagnosticos, setDiagnosticos] = useState(null);
  const [anterior, setAnterior] = useState(null);
  const [originales, setOriginales] = useState(valoresIniciales);
  const [valores, setValores] = useState(valoresIniciales);
  const [errores, setErrores] = useState({});
  const [errorCarga, setErrorCarga] = useState('');
  const [cargando, setCargando] = useState(Boolean(menorInicial));
  const [enviando, setEnviando] = useState(false);
  // Permite salir sin aviso después de registrar.
  const guardadoRef = useRef(false);

  const soloLectura = !tienePermiso(PERMISOS.SESIONES_EDITAR);

  // Aviso enviado al registrar: se muestra una sola vez.
  const avisoRecibido = location.state?.aviso;
  useEffect(() => {
    if (!avisoRecibido) return;
    notificar({ tipo: 'exito', mensaje: avisoRecibido });
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [avisoRecibido, notificar, navigate, location.pathname, location.search]);

  // Sesión existente: sus datos y los diagnósticos del menor para el selector.
  useEffect(() => {
    if (!esEdicion) return undefined;
    let vigente = true;
    setCargando(true);
    setErrorCarga('');
    Promise.all([
      obtenerSesion(menorRuta, sesionId),
      listarDiagnosticosMenor(menorRuta),
    ])
      .then(([datos, listaDiagnosticos]) => {
        if (!vigente) return;
        const cargados = valoresDesdeSesion(datos.sesion);
        setSesion(datos.sesion);
        setMenor(datos.sesion.menor);
        setAnterior(datos.anterior);
        setDiagnosticos(listaDiagnosticos);
        setOriginales(cargados);
        setValores(cargados);
        setCargando(false);
      })
      .catch((err) => {
        if (vigente)
          setErrorCarga(mensajeDeError(err, 'No se pudo cargar la sesión'));
      });
    return () => {
      vigente = false;
    };
  }, [esEdicion, menorRuta, sesionId]);

  // Sesión nueva desde la ficha (?menor=…): datos básicos del menor.
  useEffect(() => {
    if (esEdicion || !menorInicial) return undefined;
    let vigente = true;
    obtenerMenor(menorInicial)
      .then((datos) => {
        if (vigente) setMenor({ _id: datos._id, nombre: datos.nombre });
      })
      .catch((err) => {
        if (vigente)
          setErrorCarga(mensajeDeError(err, 'No se pudo cargar el expediente'));
      });
    return () => {
      vigente = false;
    };
  }, [esEdicion, menorInicial]);

  // Sesión nueva: al elegir el menor se cargan su contexto y sus diagnósticos, y se
  // preselecciona el vigente más reciente.
  const menorElegido = esEdicion ? null : menor?._id;
  useEffect(() => {
    if (esEdicion) return undefined;
    if (!menorElegido) {
      // Al cambiar de menor, el diagnóstico elegido deja de corresponder.
      const sinDiagnostico = (v) => ({ ...v, diagnostico: '' });
      setDiagnosticos(null);
      setAnterior(null);
      setOriginales(sinDiagnostico);
      setValores(sinDiagnostico);
      return undefined;
    }
    let vigente = true;
    setCargando(true);
    Promise.all([
      listarDiagnosticosMenor(menorElegido),
      obtenerContextoSesion(menorElegido),
    ])
      .then(([listaDiagnosticos, previa]) => {
        if (!vigente) return;
        const masReciente = listaDiagnosticos.find(
          (d) => d.estado === ESTADOS_DIAGNOSTICO.VIGENTE
        );
        const preseleccion = (v) => ({
          ...v,
          diagnostico: masReciente?._id ?? '',
        });
        setDiagnosticos(listaDiagnosticos);
        setAnterior(previa);
        setOriginales(preseleccion);
        setValores(preseleccion);
        setCargando(false);
      })
      .catch((err) => {
        if (vigente)
          setErrorCarga(
            mensajeDeError(err, 'No se pudo cargar el contexto del menor')
          );
      });
    return () => {
      vigente = false;
    };
  }, [esEdicion, menorElegido]);

  const hayCambios =
    !soloLectura && JSON.stringify(valores) !== JSON.stringify(originales);
  useCambiosSinGuardar(hayCambios, guardadoRef);

  const estadoActual = sesion?.estado ?? ESTADOS_SESION.BORRADOR;
  const planificada = sesion?.estado === ESTADOS_SESION.PLANIFICADA;
  // El registro post-sesión se habilita desde la fecha de una sesión planificada.
  const postSesionHabilitado =
    planificada && Boolean(valores.fecha) && valores.fecha <= hoyParaCampo();

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  // Mientras se planifica (sesión nueva o borrador) se propone la hora de término 45
  // minutos después del inicio. Si el profesional ya la modificó, se respeta.
  function cambiarHoraInicio(horaInicio) {
    setValores((v) => {
      const propuesta =
        v.horaFin === sumarMinutos(v.horaInicio, DURACION_PREDETERMINADA_MIN);
      const recalcular = !planificada && (!v.horaFin || propuesta);
      return {
        ...v,
        horaInicio,
        horaFin: recalcular
          ? sumarMinutos(horaInicio, DURACION_PREDETERMINADA_MIN)
          : v.horaFin,
      };
    });
  }

  function operarObjetivos(operacion) {
    setValores((v) => ({
      ...v,
      objetivos: aplicarOperacion(v.objetivos, operacion, {
        nuevo: { descripcion: '', logrado: null },
        editar: (objetivo, descripcion) => ({ ...objetivo, descripcion }),
      }),
    }));
  }

  function operarActividades(operacion) {
    setValores((v) => ({
      ...v,
      actividades: aplicarOperacion(v.actividades, operacion, {
        nuevo: '',
        editar: (_actividad, texto) => texto,
      }),
    }));
  }

  // Un segundo clic en la opción elegida la desmarca.
  function marcarLogro(indice, logrado) {
    setValores((v) => ({
      ...v,
      objetivos: v.objetivos.map((o, i) =>
        i === indice
          ? { ...o, logrado: o.logrado === logrado ? null : logrado }
          : o
      ),
    }));
  }

  async function guardar(estado) {
    if (estado === ESTADOS_SESION.BORRADOR && borradorVacio(valores)) {
      setErrores({});
      notificar({ tipo: 'advertencia', mensaje: MENSAJE_BORRADOR_VACIO });
      return;
    }
    const nuevosErrores = validar(valores, estado);
    if (!esEdicion && !menor) nuevosErrores.menor = 'Seleccione el menor';
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) {
      notificar({
        tipo: 'advertencia',
        mensaje: 'Revise los campos marcados antes de guardar.',
      });
      return;
    }

    let cambios = null;
    if (esEdicion) {
      cambios = cambiosParaApi(originales, valores);
      if (estado !== sesion.estado) cambios.estado = estado;
      if (Object.keys(cambios).length === 0) {
        notificar({
          tipo: 'advertencia',
          mensaje: 'No hay cambios para guardar.',
        });
        return;
      }
    }

    setEnviando(true);
    let aviso;
    try {
      if (esEdicion) {
        await actualizarSesion(
          menor._id,
          sesion._id,
          cambios,
          sesion.updatedAt
        );
        aviso =
          cambios.estado === ESTADOS_SESION.PLANIFICADA
            ? 'Sesión planificada correctamente'
            : 'Cambios guardados correctamente';
      } else {
        await crearSesion(menor._id, { ...datosParaApi(valores), estado });
        aviso =
          estado === ESTADOS_SESION.PLANIFICADA
            ? 'Sesión planificada correctamente'
            : 'Borrador de sesión guardado';
      }
    } catch (error) {
      setErrores(erroresDeCampos(error));
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(error, 'No fue posible guardar la sesión'),
      });
      setEnviando(false);
      return;
    }

    // Una vez guardada, se vuelve a la pestaña "Sesiones" de la ficha, que muestra el
    // aviso y recarga el listado. Al registrar se reemplaza la entrada del historial
    // para que "Atrás" no vuelva al formulario vacío.
    guardadoRef.current = true;
    navigate(`/menores/${menor._id}?pestana=sesiones`, {
      replace: !esEdicion,
      state: { aviso },
    });
  }

  const rutaVolver = menor
    ? `/menores/${menor._id}?pestana=sesiones`
    : '/sesiones';

  let titulo = 'Nueva sesión';
  if (sesion && planificada) titulo = `Sesión ${sesion.numero}`;
  else if (sesion) titulo = 'Borrador de sesión';
  if (menor) titulo += ` — ${menor.nombre}`;

  if (errorCarga) {
    return (
      <>
        <EncabezadoPagina titulo="Sesión no disponible" />
        <CuerpoPagina>
          <Alerta role="alert">{errorCarga}</Alerta>
          <Link to="/sesiones">Volver al listado de sesiones</Link>
        </CuerpoPagina>
      </>
    );
  }

  if (esEdicion && !sesion) {
    return <Cargando role="status">Cargando sesión…</Cargando>;
  }

  // Diagnósticos vigentes del menor; el asociado se muestra aunque no figure.
  const vigentes = (diagnosticos ?? []).filter(
    (d) => d.estado === ESTADOS_DIAGNOSTICO.VIGENTE
  );
  const asociado = sesion?.diagnostico;
  const opcionesDiagnostico =
    asociado && !vigentes.some((d) => d._id === asociado._id)
      ? [asociado, ...vigentes]
      : vigentes;
  const diagnosticoElegido = opcionesDiagnostico.find(
    (d) => d._id === valores.diagnostico
  );

  const objetivosConTexto = valores.objetivos
    .map((objetivo, indice) => ({ ...objetivo, indice }))
    .filter((o) => o.descripcion.trim());

  return (
    <>
      <Migas aria-label="Ruta">
        {menor ? (
          <>
            <Link to="/menores">Menores</Link> ›{' '}
            <Link to={rutaVolver}>{menor.nombre}</Link> › Sesión
          </>
        ) : (
          <>
            <Link to="/sesiones">Sesiones</Link> › Nueva sesión
          </>
        )}
      </Migas>
      <EncabezadoPagina titulo={titulo}>
        <Acciones>
          <ChipEstadoSesion estado={estadoActual} />
          {sesion?.asistencia && (
            <ChipAsistencia asistencia={sesion.asistencia} />
          )}
          {!soloLectura && (
            <>
              <Boton
                type="button"
                $variante="secundario"
                onClick={() => navigate(rutaVolver)}
              >
                Cancelar
              </Boton>
              {!planificada && (
                <Boton
                  type="button"
                  $variante="secundario"
                  disabled={enviando}
                  onClick={() => guardar(ESTADOS_SESION.BORRADOR)}
                >
                  Guardar borrador
                </Boton>
              )}
              <Boton
                type="button"
                disabled={enviando}
                $cargando={enviando}
                onClick={() => guardar(ESTADOS_SESION.PLANIFICADA)}
              >
                {enviando
                  ? 'Guardando…'
                  : planificada
                    ? 'Guardar cambios'
                    : 'Guardar sesión'}
              </Boton>
            </>
          )}
        </Acciones>
      </EncabezadoPagina>
      <CuerpoPagina>
        {soloLectura && (
          <TextoAyuda as="p">
            Modo de consulta: solo el profesional a cargo puede modificar la
            planificación.
          </TextoAyuda>
        )}
        <Campos disabled={soloLectura || enviando}>
          <legend className="sr-only">Planificación de la sesión</legend>
          <Columnas>
            <Columna>
              {!esEdicion && !menorInicial && (
                <Panel aria-labelledby="titulo-menor">
                  <EncabezadoPanel>
                    <TituloSeccion id="titulo-menor">Menor *</TituloSeccion>
                  </EncabezadoPanel>
                  <CuerpoPanel>
                    <BuscadorMenor
                      seleccionado={menor}
                      onSeleccionar={(elegido) => {
                        setMenor(elegido);
                        setErrores((e) => ({ ...e, menor: undefined }));
                      }}
                      error={errores.menor}
                    />
                  </CuerpoPanel>
                </Panel>
              )}

              <Panel aria-labelledby="titulo-datos">
                <EncabezadoPanel>
                  <TituloSeccion id="titulo-datos">
                    Fecha y horario
                  </TituloSeccion>
                </EncabezadoPanel>
                <CuerpoPanel>
                  <DatosBasicos>
                    <CampoFormulario
                      etiqueta="Fecha *"
                      type="date"
                      value={valores.fecha}
                      onChange={(e) => cambiar('fecha', e.target.value)}
                      error={errores.fecha}
                    />
                    <CampoFormulario
                      etiqueta="Hora de inicio *"
                      type="time"
                      value={valores.horaInicio}
                      onChange={(e) => cambiarHoraInicio(e.target.value)}
                      error={errores.horaInicio}
                    />
                    <CampoFormulario
                      etiqueta="Hora de término *"
                      type="time"
                      value={valores.horaFin}
                      onChange={(e) => cambiar('horaFin', e.target.value)}
                      error={errores.horaFin}
                    />
                    <Ancho>
                      <Campo>
                        <Etiqueta htmlFor={idDiagnostico}>
                          Diagnóstico asociado
                        </Etiqueta>
                        <Selector
                          id={idDiagnostico}
                          value={valores.diagnostico}
                          onChange={(e) =>
                            cambiar('diagnostico', e.target.value)
                          }
                          $invalido={Boolean(errores.diagnostico)}
                          aria-invalid={Boolean(errores.diagnostico)}
                          disabled={!menor || cargando}
                        >
                          <option value="">Sin diagnóstico asociado</option>
                          {opcionesDiagnostico.map((d) => (
                            <option key={d._id} value={d._id}>
                              {etiquetaDiagnostico(d)}
                            </option>
                          ))}
                        </Selector>
                        {menor && !cargando && vigentes.length === 0 && (
                          <TextoAyuda>
                            El menor no tiene diagnósticos vigentes.
                          </TextoAyuda>
                        )}
                        {errores.diagnostico && (
                          <ErrorCampo>{errores.diagnostico}</ErrorCampo>
                        )}
                      </Campo>
                    </Ancho>
                  </DatosBasicos>
                </CuerpoPanel>
              </Panel>

              <ListaEditable
                id="objetivos"
                titulo="Objetivos de la sesión"
                nombreElemento="Objetivo"
                textos={valores.objetivos.map((o) => o.descripcion)}
                max={LIMITES_SESION.objetivos}
                maxLargo={LIMITES_SESION.objetivo}
                editable={!soloLectura}
                error={errores.objetivos}
                onOperacion={operarObjetivos}
              />
              <ListaEditable
                id="actividades"
                titulo="Actividades planificadas"
                nombreElemento="Actividad"
                textos={valores.actividades}
                max={LIMITES_SESION.actividades}
                maxLargo={LIMITES_SESION.actividad}
                ordenable
                editable={!soloLectura}
                error={errores.actividades}
                onOperacion={operarActividades}
              />
            </Columna>

            <Columna>
              <Panel aria-labelledby="titulo-contexto">
                <EncabezadoPanel>
                  <TituloSeccion id="titulo-contexto">
                    Contexto del menor
                  </TituloSeccion>
                </EncabezadoPanel>
                <CuerpoPanel>
                  {!menor ? (
                    <TextoAyuda as="p">
                      Seleccione un menor para ver su contexto.
                    </TextoAyuda>
                  ) : cargando ? (
                    <TextoAyuda as="p" role="status">
                      Cargando contexto…
                    </TextoAyuda>
                  ) : (
                    <Contexto>
                      <dt>Diagnóstico</dt>
                      <dd>
                        {diagnosticoElegido
                          ? `${diagnosticoElegido.tipo}${
                              asociado?._id === diagnosticoElegido._id &&
                              sesion.diagnosticoVersion !==
                                diagnosticoElegido.version
                                ? ` (v${sesion.diagnosticoVersion} al planificar; actual v${diagnosticoElegido.version})`
                                : ` (v${diagnosticoElegido.version})`
                            }`
                          : 'Sin diagnóstico asociado'}
                      </dd>
                      <dt>Sesión anterior</dt>
                      <dd>
                        {anterior
                          ? [
                              formatearDia(anterior.fecha),
                              horario(anterior),
                              `objetivos ${anterior.objetivosLogrados}/${anterior.totalObjetivos}`,
                              anterior.asistencia &&
                                NOMBRES_ASISTENCIA[anterior.asistencia],
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          : 'Sin sesiones anteriores'}
                      </dd>
                      <dt>Observación previa</dt>
                      <dd>{anterior?.observaciones || '—'}</dd>
                    </Contexto>
                  )}
                </CuerpoPanel>
              </Panel>

              <Panel aria-labelledby="titulo-post-sesion">
                <EncabezadoPanel>
                  <TituloSeccion id="titulo-post-sesion">
                    Registro post-sesión
                  </TituloSeccion>
                </EncabezadoPanel>
                <CuerpoPanel>
                  <Campos disabled={!postSesionHabilitado}>
                    <legend className="sr-only">Registro post-sesión</legend>
                    <Bloque>
                      {!postSesionHabilitado && (
                        <Aviso>
                          {planificada
                            ? 'Se habilita desde la fecha de la sesión.'
                            : 'Se completa al finalizar la sesión, una vez planificada.'}
                        </Aviso>
                      )}
                      <div>
                        <Etiqueta as="span" id="titulo-asistencia">
                          Asistencia
                        </Etiqueta>
                        <Opciones
                          role="group"
                          aria-labelledby="titulo-asistencia"
                        >
                          {ASISTENCIAS.map(({ valor, etiqueta }) => (
                            <ChipSeleccionable
                              key={valor}
                              type="button"
                              $activo={valores.asistencia === valor}
                              $tono={TONOS_SESION[valor]}
                              aria-pressed={valores.asistencia === valor}
                              onClick={() =>
                                cambiar(
                                  'asistencia',
                                  valores.asistencia === valor ? '' : valor
                                )
                              }
                            >
                              {etiqueta}
                            </ChipSeleccionable>
                          ))}
                        </Opciones>
                      </div>
                      {objetivosConTexto.length > 0 && (
                        <div>
                          <Etiqueta as="span">Logro de objetivos</Etiqueta>
                          <Logros>
                            {objetivosConTexto.map(
                              ({ descripcion, logrado, indice }) => (
                                <li key={indice}>
                                  <span>{descripcion}</span>
                                  <Opciones
                                    role="group"
                                    aria-label={`Logro del objetivo ${indice + 1}`}
                                  >
                                    <ChipSeleccionable
                                      type="button"
                                      $activo={logrado === true}
                                      aria-pressed={logrado === true}
                                      onClick={() => marcarLogro(indice, true)}
                                    >
                                      Logrado
                                    </ChipSeleccionable>
                                    <ChipSeleccionable
                                      type="button"
                                      $activo={logrado === false}
                                      aria-pressed={logrado === false}
                                      onClick={() => marcarLogro(indice, false)}
                                    >
                                      No logrado
                                    </ChipSeleccionable>
                                  </Opciones>
                                </li>
                              )
                            )}
                          </Logros>
                        </div>
                      )}
                      <CampoFormulario
                        etiqueta="Observaciones"
                        as="textarea"
                        rows={5}
                        maxLength={LIMITES_SESION.observaciones}
                        placeholder="Se completa al finalizar la sesión…"
                        value={valores.observaciones}
                        onChange={(e) =>
                          cambiar('observaciones', e.target.value)
                        }
                        error={errores.observaciones}
                      />
                      {errores.registroPostSesion && (
                        <ErrorCampo role="alert">
                          {errores.registroPostSesion}
                        </ErrorCampo>
                      )}
                    </Bloque>
                  </Campos>
                </CuerpoPanel>
              </Panel>

              {sesion && (
                <TextoAyuda as="p">
                  Profesional responsable: {sesion.profesional?.nombre ?? '—'}
                  {sesion.actualizadoPor &&
                    ` · Última modificación: ${sesion.actualizadoPor.nombre}`}
                </TextoAyuda>
              )}
            </Columna>
          </Columnas>
        </Campos>
        {!soloLectura && (
          <TextoAyuda as="p">
            Los campos marcados con * son obligatorios para planificar la
            sesión; un borrador puede guardarse incompleto.
          </TextoAyuda>
        )}
      </CuerpoPagina>
    </>
  );
}
