import { Fragment, Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import styled from 'styled-components';
import {
  actualizarInforme,
  crearInforme,
  descargarPdfInforme,
  generarPdfInforme,
  obtenerInforme,
  obtenerPdfInforme,
  vistaPreviaInforme,
} from '../../api/informes';
import { obtenerMenor } from '../../api/menores';
import { erroresDeCampos, mensajeDeError } from '../../api/client';
import { useNotificaciones } from '../../context/useNotificaciones';
import { useCambiosSinGuardar } from '../../hooks/useCambiosSinGuardar';
import {
  APARTADOS,
  AYUDA_LISTAS,
  CAMPOS_OBLIGATORIOS_PDF,
  LETRAS,
  LIMITES_INFORME,
  MENSAJES_OBLIGATORIO,
  SECCIONES_FORMULARIO,
  estadoInforme,
} from '../../constants/informes';
import { edadCronologica, formatearEdadCronologica } from '../../utils/edad';
import {
  fechaParaCampo,
  formatearDia,
  formatearFecha,
  formatearTamano,
  hoyParaCampo,
} from '../../utils/formato';
import { validarFecha, validarTexto } from '../../utils/validacion';
import EncabezadoPagina, {
  CuerpoPagina,
} from '../../components/EncabezadoPagina';
import CampoFormulario from '../../components/CampoFormulario';
import Modal from '../../components/Modal';
import BuscadorMenor from '../../components/diagnosticos/BuscadorMenor';
import EditorTablas from '../../components/informes/EditorTablas';
import EditorAreas from '../../components/informes/EditorAreas';
import { conClaves, sinClaves } from '../../components/informes/claves';
import {
  Alerta,
  Boton,
  BotonAccion,
  Cargando,
  Chip,
  CuerpoPanel,
  EncabezadoPanel,
  estadosInteractivos,
  GrupoAcciones,
  Panel,
  TextoAyuda,
  TituloSeccion,
} from '../../components/ui';
import Icono from '../../components/Icono';

// pdf.js solo se descarga cuando se abre un PDF.
const VisorPdf = lazy(() => import('../../components/documentos/VisorPdf'));

// Formulario del informe psicopedagógico (mockup 1j), organizado por secciones. Los
// datos de identificación del menor se leen de su perfil; todo el contenido
// profesional lo redacta el psicopedagogo. El sistema no completa, interpreta ni
// calcula resultados: solo organiza, guarda y exporta lo ingresado.

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

const Distribucion = styled.div`
  display: grid;
  gap: 20px;
  grid-template-columns: 240px minmax(0, 1fr);
  align-items: start;

  @media (max-width: ${({ theme }) => theme.movil}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Indice = styled.nav`
  position: sticky;
  top: 16px;
  display: grid;
  gap: 2px;
  border: 1.5px solid ${({ theme }) => theme.colores.bordeTarjeta};
  border-radius: ${({ theme }) => theme.radio};
  padding: 6px 0;
  background: ${({ theme }) => theme.colores.superficie};

  @media (max-width: ${({ theme }) => theme.movil}) {
    position: static;
    display: flex;
    overflow-x: auto;
    padding: 4px;
  }
`;

const OpcionIndice = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 7px 12px;
  border: none;
  border-left: 4px solid
    ${({ theme, $activa }) => ($activa ? theme.colores.primario : 'transparent')};
  background: ${({ theme, $activa }) =>
    $activa ? theme.colores.lateralActivo : 'transparent'};
  font-weight: ${({ $activa }) => ($activa ? 700 : 400)};
  color: inherit;
  font-size: 14px;
  ${estadosInteractivos}

  &:hover {
    background: ${({ theme, $activa }) =>
      $activa ? theme.colores.lateralActivo : theme.colores.lateral};
  }

  &:active {
    background: ${({ theme }) => theme.colores.lateralPresionado};
  }

  &:focus-visible {
    outline-offset: -2px;
  }

  @media (max-width: ${({ theme }) => theme.movil}) {
    white-space: nowrap;
    width: auto;
  }
`;

const Marca = styled.span`
  margin-left: auto;
  font-weight: 700;
  color: ${({ theme, $tipo }) =>
    $tipo === 'error' ? theme.colores.error : theme.colores.exito};
`;

const Separador = styled.hr`
  border: none;
  border-top: 1.5px dashed ${({ theme }) => theme.colores.bordeSuave};
  margin: 4px 0;
  width: 100%;
`;

const CuerpoSeccion = styled(CuerpoPanel)`
  display: grid;
  gap: 14px;
`;

const NavegacionPasos = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 6px;
  border-top: 1.5px dashed ${({ theme }) => theme.colores.bordeSuave};
`;

const DatosMenor = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px 16px;

  dt {
    font-size: 14px;
    color: ${({ theme }) => theme.colores.textoSuave};
  }

  dd {
    margin: 2px 0 0;
    font-weight: 700;
  }
`;

const Fila = styled.div`
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
`;

const ListaVersiones = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;

  li {
    display: grid;
    gap: 2px;
    padding-bottom: 10px;
    border-bottom: 1.5px dashed ${({ theme }) => theme.colores.bordeSuave};
  }

  li:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const AccionesVersion = styled(GrupoAcciones)``;

const Aviso = styled.p`
  margin: 0;
  padding: 9px 12px;
  border-radius: 4px;
  border: 1.5px solid ${({ theme }) => theme.colores.advertenciaBorde};
  background: ${({ theme }) => theme.colores.advertenciaFondo};
  color: ${({ theme }) => theme.colores.advertencia};
  font-size: 14px;
`;

const MarcoPdf = styled.div`
  height: min(70vh, 640px);
  overflow: auto;
  background: #f5e6ec;
  padding: 12px;
  border-radius: ${({ theme }) => theme.radio};
`;

const VALORES_VACIOS = {
  fechaInforme: '',
  curso: '',
  establecimiento: '',
  antecedentesRelevantes: '',
  motivoConsulta: '',
  instrumentoEvaluativo: '',
  areasEvaluacion: '',
  analisisCuantitativo: '',
  tablasCuantitativas: [],
  objetivoEvaluacion: '',
  analisisCualitativo: '',
  areasCualitativas: [],
  conclusion: '',
  sugerencias: { familia: '', escuela: '', nino: '' },
};

const CAMPOS_TEXTO = [
  'curso',
  'establecimiento',
  'antecedentesRelevantes',
  'motivoConsulta',
  'instrumentoEvaluativo',
  'areasEvaluacion',
  'analisisCuantitativo',
  'objetivoEvaluacion',
  'analisisCualitativo',
  'conclusion',
];

function valoresDesdeInforme(informe) {
  return {
    ...Object.fromEntries(
      CAMPOS_TEXTO.map((campo) => [campo, informe[campo] ?? ''])
    ),
    fechaInforme: fechaParaCampo(informe.fechaInforme),
    ...conClaves(informe),
    sugerencias: {
      familia: informe.sugerencias?.familia ?? '',
      escuela: informe.sugerencias?.escuela ?? '',
      nino: informe.sugerencias?.nino ?? '',
    },
  };
}

// Informe nuevo: curso, establecimiento y antecedentes se proponen desde el perfil y
// el profesional puede modificarlos.
function valoresDesdePerfil(perfil) {
  return {
    ...VALORES_VACIOS,
    fechaInforme: hoyParaCampo(),
    curso: perfil.curso ?? '',
    establecimiento: perfil.establecimiento ?? '',
    antecedentesRelevantes: perfil.antecedentesRelevantes ?? '',
  };
}

function valorDe(valores, campo) {
  return campo.startsWith('sugerencias.')
    ? valores.sugerencias[campo.slice('sugerencias.'.length)]
    : valores[campo];
}

function tieneTexto(texto) {
  return Boolean(texto && texto.trim());
}

const ETIQUETAS_VALIDACION = {
  curso: 'El curso',
  establecimiento: 'El establecimiento',
  antecedentesRelevantes: 'Los antecedentes relevantes',
  motivoConsulta: 'La derivación y motivo de consulta',
  instrumentoEvaluativo: 'El instrumento evaluativo',
  areasEvaluacion: 'Las áreas de evaluación',
  analisisCuantitativo: 'El texto de los resultados cuantitativos',
  objetivoEvaluacion: 'El objetivo de la evaluación',
  analisisCualitativo: 'El texto del análisis cualitativo',
  conclusion: 'La conclusión psicopedagógica',
};

// Formato de los campos (el borrador puede quedar incompleto).
function validarFormato(valores) {
  const errores = {};
  const errorFecha = validarFecha(valores.fechaInforme, {
    etiqueta: 'La fecha del informe',
  });
  if (errorFecha) errores.fechaInforme = errorFecha;
  for (const [campo, etiqueta] of Object.entries(ETIQUETAS_VALIDACION)) {
    const error = validarTexto(valores[campo], {
      etiqueta,
      obligatorio: false,
      max: LIMITES_INFORME[campo],
    });
    if (error) errores[campo] = error;
  }
  for (const { campo, titulo } of APARTADOS) {
    const error = validarTexto(valores.sugerencias[campo], {
      etiqueta: `Las sugerencias (${titulo})`,
      obligatorio: false,
      max: LIMITES_INFORME.sugerencia,
    });
    if (error) errores[`sugerencias.${campo}`] = error;
  }
  return errores;
}

// Igual que en el backend (utils/contenidoInforme.js): tablas con encabezados y datos,
// y áreas con nombre y apartados con texto.
function problemaTablas(tablas) {
  if (tablas.length === 0) return MENSAJES_OBLIGATORIO.tablasCuantitativas;
  for (const [i, tabla] of tablas.entries()) {
    const n = i + 1;
    if (tabla.columnas.some((c) => !tieneTexto(c))) {
      return `Complete los encabezados de la tabla ${n}`;
    }
    if (!tabla.filas.some((fila) => fila.some(tieneTexto))) {
      return `La tabla ${n} no tiene datos; complétela o elimínela`;
    }
  }
  return null;
}

function problemaAreas(areas) {
  if (areas.length === 0) return MENSAJES_OBLIGATORIO.areasCualitativas;
  for (const [i, area] of areas.entries()) {
    const n = i + 1;
    if (!tieneTexto(area.titulo)) return `Indique el nombre del área ${n}`;
    if (area.apartados.length === 0) return `El área ${n} no tiene apartados`;
    const vacio = area.apartados.findIndex((ap) => !tieneTexto(ap.texto));
    if (vacio !== -1) {
      return `Complete el texto del apartado ${LETRAS[vacio]}) del área ${n}`;
    }
  }
  return null;
}

function faltantesParaPdf(valores) {
  const errores = {};
  for (const campo of CAMPOS_OBLIGATORIOS_PDF) {
    if (campo === 'tablasCuantitativas') {
      const problema = problemaTablas(valores.tablasCuantitativas);
      if (problema) errores[campo] = problema;
    } else if (campo === 'areasCualitativas') {
      const problema = problemaAreas(valores.areasCualitativas);
      if (problema) errores[campo] = problema;
    } else if (!tieneTexto(valorDe(valores, campo))) {
      errores[campo] = MENSAJES_OBLIGATORIO[campo];
    }
  }
  return errores;
}

// Para el PDF definitivo, todas las secciones deben estar completas.
function validarParaPdf(valores) {
  return { ...faltantesParaPdf(valores), ...validarFormato(valores) };
}

function contador(texto, maximo) {
  return `${texto.length}/${maximo} caracteres`;
}

export default function FormularioInforme() {
  const { menorId: menorRuta, informeId } = useParams();
  const [parametros] = useSearchParams();
  const esEdicion = Boolean(informeId);
  const menorInicial = esEdicion ? null : parametros.get('menor');
  const navigate = useNavigate();
  const location = useLocation();
  const { notificar, confirmar } = useNotificaciones();

  const [informe, setInforme] = useState(null);
  const [menor, setMenor] = useState(null);
  const [originales, setOriginales] = useState(VALORES_VACIOS);
  const [valores, setValores] = useState(VALORES_VACIOS);
  const [errores, setErrores] = useState({});
  const [errorCarga, setErrorCarga] = useState('');
  const [cargandoMenor, setCargandoMenor] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [seccion, setSeccion] = useState(SECCIONES_FORMULARIO[0].id);
  // PDF abierto en el visor: { titulo } con { cargando } | { datos } | { error }.
  const [visor, setVisor] = useState(null);
  // Permite salir sin aviso después de registrar.
  const guardadoRef = useRef(false);
  const contenidoRef = useRef(null);

  const hayCambios =
    JSON.stringify(sinClaves(valores)) !==
    JSON.stringify(sinClaves(originales));
  useCambiosSinGuardar(hayCambios, guardadoRef);

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

  // Informe existente.
  useEffect(() => {
    if (!esEdicion) return undefined;
    let vigente = true;
    setErrorCarga('');
    obtenerInforme(menorRuta, informeId)
      .then((datos) => {
        if (!vigente) return;
        const cargados = valoresDesdeInforme(datos);
        setInforme(datos);
        setMenor(datos.menor);
        setOriginales(cargados);
        setValores(cargados);
      })
      .catch((err) => {
        if (vigente)
          setErrorCarga(mensajeDeError(err, 'No se pudo cargar el informe'));
      });
    return () => {
      vigente = false;
    };
  }, [esEdicion, menorRuta, informeId]);

  // Informe nuevo: al elegir el menor (o desde la ficha, ?menor=…) se leen sus datos
  // de identificación y se proponen curso, establecimiento y antecedentes.
  async function elegirMenor(id) {
    if (!id) {
      setMenor(null);
      setValores(VALORES_VACIOS);
      setOriginales(VALORES_VACIOS);
      return;
    }
    setCargandoMenor(true);
    try {
      const perfil = await obtenerMenor(id);
      const propuestos = valoresDesdePerfil(perfil);
      setMenor({
        _id: perfil._id,
        nombre: perfil.nombre,
        fechaNacimiento: perfil.fechaNacimiento,
      });
      setValores(propuestos);
      setOriginales(propuestos);
      setErrores({});
    } catch (err) {
      setErrorCarga(mensajeDeError(err, 'No se pudo cargar el expediente'));
    } finally {
      setCargandoMenor(false);
    }
  }

  const elegirMenorRef = useRef(elegirMenor);
  elegirMenorRef.current = elegirMenor;
  useEffect(() => {
    if (menorInicial) elegirMenorRef.current(menorInicial);
  }, [menorInicial]);

  function limpiarError(campo) {
    if (!errores[campo]) return;
    setErrores((actuales) => {
      const restantes = { ...actuales };
      delete restantes[campo];
      return restantes;
    });
  }

  function cambiar(campo, valor) {
    setValores((v) =>
      campo.startsWith('sugerencias.')
        ? {
            ...v,
            sugerencias: {
              ...v.sugerencias,
              [campo.slice('sugerencias.'.length)]: valor,
            },
          }
        : { ...v, [campo]: valor }
    );
    limpiarError(campo);
  }

  function irA(id) {
    setSeccion(id);
    contenidoRef.current?.scrollIntoView?.({ block: 'start' });
  }

  // Muestra la primera sección con errores.
  function mostrarErrores(encontrados) {
    const primera = SECCIONES_FORMULARIO.find((s) =>
      s.campos.some((campo) => encontrados[campo])
    );
    if (primera) irA(primera.id);
  }

  // Guarda el informe. Devuelve el informe guardado, o null si no se pudo.
  async function guardar({ avisar = true } = {}) {
    const encontrados = validarFormato(valores);
    if (!menor) encontrados.menor = 'Seleccione el menor';
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      mostrarErrores(encontrados);
      notificar({
        tipo: 'error',
        mensaje: 'Revise los campos marcados antes de guardar',
      });
      return null;
    }

    setEnviando(true);
    try {
      const datos = sinClaves(valores);
      if (!esEdicion) {
        const creado = await crearInforme(menor._id, datos);
        // Al registrar se reemplaza la entrada del historial para que «Atrás» no
        // vuelva al formulario vacío.
        guardadoRef.current = true;
        navigate(`/menores/${menor._id}/informes/${creado._id}`, {
          replace: true,
          state: { aviso: 'Informe guardado como borrador' },
        });
        return creado;
      }
      const actualizado = await actualizarInforme(
        menor._id,
        informe._id,
        datos,
        informe.updatedAt
      );
      const guardados = valoresDesdeInforme(actualizado);
      setInforme(actualizado);
      setOriginales(guardados);
      setValores(guardados);
      if (avisar) {
        notificar({ tipo: 'exito', mensaje: 'Avance guardado correctamente' });
      }
      return actualizado;
    } catch (err) {
      const delServidor = erroresDeCampos(err);
      setErrores(delServidor);
      mostrarErrores(delServidor);
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(err, 'No fue posible guardar el informe'),
      });
      return null;
    } finally {
      setEnviando(false);
    }
  }

  async function handleGuardar() {
    if (esEdicion && !hayCambios) {
      notificar({
        tipo: 'advertencia',
        mensaje: 'No hay cambios para guardar.',
      });
      return;
    }
    await guardar();
  }

  async function handleGenerarPdf() {
    const encontrados = validarParaPdf(valores);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      mostrarErrores(encontrados);
      notificar({
        tipo: 'error',
        mensaje: 'Complete todas las secciones antes de generar el PDF',
      });
      return;
    }
    // El PDF se genera con el contenido guardado: primero se guardan los cambios.
    const vigente = hayCambios ? await guardar({ avisar: false }) : informe;
    if (!vigente) return;

    const version = (vigente.ultimoPdf?.version ?? 0) + 1;
    try {
      const resultado = await confirmar({
        titulo: 'Generar PDF',
        mensaje:
          version === 1
            ? 'Se generará el PDF del informe con el contenido guardado, la presentación institucional vigente y sus datos profesionales.'
            : `Se generará la versión ${version} del PDF. Las versiones anteriores se conservan sin cambios.`,
        textoConfirmar: 'Generar PDF',
        textoProcesando: 'Generando…',
        accion: () =>
          generarPdfInforme(menor._id, vigente._id, vigente.updatedAt),
      });
      if (!resultado) return;
      setInforme(resultado.informe);
      irA('pdfs');
      notificar({
        tipo: 'exito',
        mensaje: `PDF generado (versión ${resultado.version})`,
      });
    } catch (err) {
      const delServidor = erroresDeCampos(err);
      setErrores(delServidor);
      mostrarErrores(delServidor);
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(err, 'No fue posible generar el PDF'),
      });
    }
  }

  async function abrirPdf(titulo, obtener) {
    setVisor({ titulo, cargando: true });
    try {
      setVisor({ titulo, datos: await obtener() });
    } catch (err) {
      setErrores(erroresDeCampos(err));
      setVisor({
        titulo,
        error: mensajeDeError(err, 'No se pudo abrir el PDF'),
      });
    }
  }

  function handleVistaPrevia() {
    const encontrados = validarFormato(valores);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      mostrarErrores(encontrados);
      notificar({
        tipo: 'error',
        mensaje: 'Revise los campos marcados antes de ver la vista previa',
      });
      return;
    }
    abrirPdf('Vista previa del informe', () =>
      vistaPreviaInforme(menor._id, informe?._id, sinClaves(valores))
    );
  }

  async function handleDescargar(version) {
    try {
      await descargarPdfInforme(menor._id, informe, version);
    } catch (err) {
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(err, 'No se pudo descargar el PDF'),
      });
    }
  }

  const rutaVolver = menor
    ? `/menores/${menor._id}?pestana=informes`
    : '/informes';

  if (errorCarga) {
    return (
      <>
        <EncabezadoPagina titulo="Informe no disponible" />
        <CuerpoPagina>
          <Alerta role="alert">{errorCarga}</Alerta>
          <Link to="/informes">Volver al listado de informes</Link>
        </CuerpoPagina>
      </>
    );
  }

  if (esEdicion && !informe) {
    return <Cargando role="status">Cargando informe…</Cargando>;
  }

  const edad =
    menor?.fechaNacimiento &&
    !validarFecha(valores.fechaInforme, { etiqueta: '' })
      ? edadCronologica(menor.fechaNacimiento, valores.fechaInforme)
      : null;
  const titulo = menor
    ? `Informe psicopedagógico — ${menor.nombre}`
    : 'Nuevo informe psicopedagógico';
  const deshabilitado = !menor || enviando || cargandoMenor;

  // Avance de cada sección según los requisitos del PDF definitivo.
  const faltantes = faltantesParaPdf(valores);
  const secciones = esEdicion
    ? [
        ...SECCIONES_FORMULARIO,
        { id: 'pdfs', titulo: 'PDF generados', campos: [] },
      ]
    : SECCIONES_FORMULARIO;
  const indiceActual = secciones.findIndex((s) => s.id === seccion);
  const actual = secciones[indiceActual];
  const anterior = secciones[indiceActual - 1];
  const siguiente = secciones[indiceActual + 1];

  function estadoSeccion(s) {
    if (s.campos.some((campo) => errores[campo])) return 'error';
    if (s.campos.length > 0 && !s.campos.some((campo) => faltantes[campo])) {
      return 'completa';
    }
    return null;
  }

  function campoTexto(campo, etiqueta, { filas = 8, listas = true } = {}) {
    const maximo = campo.startsWith('sugerencias.')
      ? LIMITES_INFORME.sugerencia
      : LIMITES_INFORME[campo];
    const valor = valorDe(valores, campo);
    return (
      <CampoFormulario
        as="textarea"
        rows={filas}
        etiqueta={etiqueta}
        maxLength={maximo}
        value={valor}
        error={errores[campo]}
        ayuda={`${listas ? `${AYUDA_LISTAS} ` : ''}${contador(valor, maximo)}`}
        onChange={(e) => cambiar(campo, e.target.value)}
      />
    );
  }

  function contenidoSeccion() {
    switch (seccion) {
      case 'personales':
        return (
          <>
            <DatosMenor aria-label="Datos del perfil del menor">
              <div>
                <dt>Nombre</dt>
                <dd>{menor.nombre}</dd>
              </div>
              <div>
                <dt>Fecha de nacimiento</dt>
                <dd>{formatearDia(menor.fechaNacimiento)}</dd>
              </div>
              <div>
                <dt>Edad cronológica</dt>
                <dd data-testid="edad-cronologica">
                  {formatearEdadCronologica(edad) || '—'}
                </dd>
              </div>
            </DatosMenor>
            <TextoAyuda>
              Nombre y fecha de nacimiento provienen del perfil del menor; la
              edad se calcula a la fecha del informe.
            </TextoAyuda>
            <Fila>
              <CampoFormulario
                etiqueta="Fecha del informe *"
                type="date"
                max={hoyParaCampo()}
                value={valores.fechaInforme}
                error={errores.fechaInforme}
                onChange={(e) => cambiar('fechaInforme', e.target.value)}
              />
              <CampoFormulario
                etiqueta="Curso"
                maxLength={LIMITES_INFORME.curso}
                value={valores.curso}
                error={errores.curso}
                onChange={(e) => cambiar('curso', e.target.value)}
              />
              <CampoFormulario
                etiqueta="Establecimiento"
                maxLength={LIMITES_INFORME.establecimiento}
                value={valores.establecimiento}
                error={errores.establecimiento}
                onChange={(e) => cambiar('establecimiento', e.target.value)}
              />
            </Fila>
          </>
        );
      case 'relevantes':
        return campoTexto(
          'antecedentesRelevantes',
          'Antecedentes relevantes *'
        );
      case 'derivacion':
        return (
          <>
            <TextoAyuda as="p">
              Quién deriva al menor, el motivo de la evaluación y los objetivos
              que se buscan alcanzar.
            </TextoAyuda>
            {campoTexto('motivoConsulta', 'Derivación y motivo de consulta *', {
              filas: 10,
            })}
          </>
        );
      case 'evaluacion':
        return (
          <>
            {campoTexto('instrumentoEvaluativo', 'Instrumento evaluativo *', {
              filas: 4,
            })}
            {campoTexto('areasEvaluacion', 'Áreas de evaluación *', {
              filas: 5,
            })}
          </>
        );
      case 'cuantitativos':
        return (
          <>
            {campoTexto(
              'analisisCuantitativo',
              'Texto general de los resultados (opcional)',
              { filas: 4 }
            )}
            <EditorTablas
              tablas={valores.tablasCuantitativas}
              error={errores.tablasCuantitativas}
              onChange={(tablas) => cambiar('tablasCuantitativas', tablas)}
            />
          </>
        );
      case 'objetivo':
        return campoTexto('objetivoEvaluacion', 'Objetivo de la evaluación *', {
          filas: 6,
        });
      case 'cualitativos':
        return (
          <>
            {campoTexto(
              'analisisCualitativo',
              'Texto general del análisis (opcional)',
              { filas: 4 }
            )}
            <EditorAreas
              areas={valores.areasCualitativas}
              error={errores.areasCualitativas}
              onChange={(areas) => cambiar('areasCualitativas', areas)}
            />
          </>
        );
      case 'conclusion':
        return campoTexto('conclusion', 'Conclusión psicopedagógica *', {
          filas: 12,
        });
      case 'sugerencias':
        return APARTADOS.map(({ campo, titulo: tituloApartado }) => (
          <div key={campo}>
            {campoTexto(`sugerencias.${campo}`, `${tituloApartado} *`, {
              filas: 7,
            })}
          </div>
        ));
      case 'pdfs':
        return (
          <>
            {informe.pdfDesactualizado && (
              <Aviso role="status">
                El informe se modificó después del último PDF. Genere una nueva
                versión para incluir los cambios.
              </Aviso>
            )}
            {informe.pdfs.length === 0 ? (
              <TextoAyuda as="p">
                Aún no se ha generado el PDF de este informe.
              </TextoAyuda>
            ) : (
              <ListaVersiones aria-label="Versiones del PDF">
                {[...informe.pdfs].reverse().map((pdf) => (
                  <li key={pdf.version}>
                    <strong>Versión {pdf.version}</strong>
                    <TextoAyuda>
                      {formatearFecha(pdf.fecha)} ·{' '}
                      {pdf.generadoPor?.nombre ?? '—'} ·{' '}
                      {formatearTamano(pdf.tamano)}
                    </TextoAyuda>
                    <AccionesVersion>
                      <BotonAccion
                        type="button"
                        aria-label={`Ver versión ${pdf.version}`}
                        onClick={() =>
                          abrirPdf(`Informe — versión ${pdf.version}`, () =>
                            obtenerPdfInforme(
                              menor._id,
                              informe._id,
                              pdf.version
                            )
                          )
                        }
                      >
                        <Icono nombre="ver" />
                        Ver
                      </BotonAccion>
                      <BotonAccion
                        type="button"
                        aria-label={`Descargar versión ${pdf.version}`}
                        onClick={() => handleDescargar(pdf.version)}
                      >
                        <Icono nombre="descargar" />
                        Descargar
                      </BotonAccion>
                    </AccionesVersion>
                  </li>
                ))}
              </ListaVersiones>
            )}
            <TextoAyuda>
              El pie del PDF incluye la presentación institucional y los datos
              profesionales de quien creó el informe (se editan en «Datos
              profesionales»). Creado por {informe.creadoPor?.nombre ?? '—'} el{' '}
              {formatearFecha(informe.createdAt)}. Última modificación:{' '}
              {formatearFecha(informe.contenidoActualizadoEn)}.
            </TextoAyuda>
          </>
        );
      default:
        return null;
    }
  }

  return (
    <>
      <Migas aria-label="Ruta">
        {menor ? (
          <>
            <Link to="/menores">Menores</Link> ›{' '}
            <Link to={rutaVolver}>{menor.nombre}</Link> › Informe
          </>
        ) : (
          <>
            <Link to="/informes">Informes</Link> › Nuevo informe
          </>
        )}
      </Migas>
      <EncabezadoPagina titulo={titulo}>
        <Acciones>
          {informe && <Chip>{estadoInforme(informe)}</Chip>}
          <Boton
            type="button"
            $variante="secundario"
            onClick={() => navigate(rutaVolver)}
          >
            <Icono nombre="volver" />
            Volver
          </Boton>
          <Boton
            type="button"
            $variante="informativo"
            disabled={deshabilitado}
            onClick={handleVistaPrevia}
          >
            <Icono nombre="ver" />
            Vista previa
          </Boton>
          <Boton
            type="button"
            $variante="secundario"
            disabled={deshabilitado}
            onClick={handleGuardar}
            $cargando={enviando}
          >
            {enviando ? 'Guardando…' : 'Guardar avance'}
          </Boton>
          {esEdicion && (
            <Boton
              type="button"
              disabled={deshabilitado}
              onClick={handleGenerarPdf}
            >
              <Icono nombre="pdf" />
              Generar PDF
            </Boton>
          )}
        </Acciones>
      </EncabezadoPagina>
      <CuerpoPagina>
        <TextoAyuda as="p">
          Los campos marcados con * son obligatorios para generar el PDF. El
          informe puede guardarse incompleto y completarse después.
          {!esEdicion && ' El PDF se genera una vez guardado el informe.'}
        </TextoAyuda>

        {!esEdicion && !menorInicial && (
          <Panel aria-labelledby="titulo-menor">
            <EncabezadoPanel>
              <TituloSeccion id="titulo-menor">Menor *</TituloSeccion>
            </EncabezadoPanel>
            <CuerpoPanel>
              <BuscadorMenor
                seleccionado={menor}
                onSeleccionar={(elegido) => elegirMenor(elegido?._id)}
                error={errores.menor}
              />
            </CuerpoPanel>
          </Panel>
        )}

        {cargandoMenor && (
          <Cargando role="status">Cargando datos del menor…</Cargando>
        )}

        {menor && !cargandoMenor && (
          <Distribucion>
            <Indice aria-label="Secciones del informe">
              {secciones.map((s, i) => {
                const estado = estadoSeccion(s);
                return (
                  <Fragment key={s.id}>
                    {s.id === 'pdfs' && <Separador />}
                    <OpcionIndice
                      type="button"
                      $activa={s.id === seccion}
                      aria-current={s.id === seccion ? 'step' : undefined}
                      onClick={() => irA(s.id)}
                    >
                      {s.id === 'pdfs' ? s.titulo : `${i + 1}. ${s.titulo}`}
                      {estado === 'completa' && (
                        <Marca aria-hidden="true">✓</Marca>
                      )}
                      {estado === 'error' && (
                        <Marca $tipo="error" aria-hidden="true">
                          !
                        </Marca>
                      )}
                      {estado && (
                        <span className="sr-only">
                          {estado === 'error'
                            ? ' (con errores)'
                            : ' (completa)'}
                        </span>
                      )}
                    </OpcionIndice>
                  </Fragment>
                );
              })}
            </Indice>

            <Panel aria-labelledby="titulo-seccion-actual" ref={contenidoRef}>
              <EncabezadoPanel>
                <TituloSeccion id="titulo-seccion-actual">
                  {actual.titulo}
                </TituloSeccion>
                <TextoAyuda>
                  {actual.id === 'pdfs'
                    ? ''
                    : `Sección ${indiceActual + 1} de ${SECCIONES_FORMULARIO.length}`}
                </TextoAyuda>
              </EncabezadoPanel>
              <CuerpoSeccion>
                {contenidoSeccion()}
                <NavegacionPasos>
                  {anterior ? (
                    <Boton
                      type="button"
                      $variante="secundario"
                      onClick={() => irA(anterior.id)}
                    >
                      <Icono nombre="anterior" />
                      Anterior: {anterior.titulo}
                    </Boton>
                  ) : (
                    <span />
                  )}
                  {siguiente && (
                    <Boton
                      type="button"
                      $variante="secundario"
                      onClick={() => irA(siguiente.id)}
                    >
                      Siguiente: {siguiente.titulo}
                      <Icono nombre="siguiente" />
                    </Boton>
                  )}
                </NavegacionPasos>
              </CuerpoSeccion>
            </Panel>
          </Distribucion>
        )}
      </CuerpoPagina>

      {visor && (
        <Modal
          titulo={visor.titulo}
          ancho={820}
          onCerrar={() => setVisor(null)}
        >
          {visor.cargando && (
            <Cargando role="status">Preparando el PDF…</Cargando>
          )}
          {visor.error && <Alerta role="alert">{visor.error}</Alerta>}
          {visor.datos && (
            <MarcoPdf>
              <Suspense
                fallback={<Cargando role="status">Cargando visor…</Cargando>}
              >
                <VisorPdf datos={visor.datos} />
              </Suspense>
            </MarcoPdf>
          )}
        </Modal>
      )}
    </>
  );
}
