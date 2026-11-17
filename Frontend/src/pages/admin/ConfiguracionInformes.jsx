import {
  Suspense,
  lazy,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from 'styled-components';
import {
  eliminarLogoInformes,
  generarVistaPreviaInforme,
  guardarConfiguracionInformes,
  obtenerConfiguracionInformes,
  obtenerLogoInformes,
  subirLogoInformes,
} from '../../api/configuracionInformes';
import { erroresDeCampos, mensajeDeError } from '../../api/client';
import { useNotificaciones } from '../../context/useNotificaciones';
import { useCambiosSinGuardar } from '../../hooks/useCambiosSinGuardar';
import {
  ALINEACIONES,
  CAMPOS_CONFIGURACION,
  LIMITES_CONFIGURACION,
  LIMITES_LOGO,
  POSICIONES_LOGO,
  TAMANOS_LOGO,
  VALORES_POR_DEFECTO,
} from '../../constants/configuracionInformes';
import { formatearTamano } from '../../utils/formato';
import { validarTexto } from '../../utils/validacion';
import EncabezadoPagina, {
  CuerpoPagina,
} from '../../components/EncabezadoPagina';
import CampoFormulario from '../../components/CampoFormulario';
import Modal from '../../components/Modal';
import ZonaCarga from '../../components/documentos/ZonaCarga';
import VistaPreviaInforme from '../../components/configuracionInformes/VistaPreviaInforme';
import {
  Alerta,
  Boton,
  BotonPequeno,
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
import Icono from '../../components/Icono';

// pdf.js solo se descarga cuando se abre la vista previa en PDF.
const VisorPdf = lazy(() => import('../../components/documentos/VisorPdf'));

// Presentación institucional de los informes PDF (solo administrador). Los cambios
// se aplican a los informes que se generen después; los ya emitidos no cambian.

const Columnas = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
  gap: 18px;
  align-items: start;

  @media (max-width: ${({ theme }) => theme.movil}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const ColumnaFormulario = styled.div`
  display: grid;
  gap: 18px;
  min-width: 0;
`;

const ColumnaVistaPrevia = styled.div`
  position: sticky;
  top: 16px;
  min-width: 0;

  @media (max-width: ${({ theme }) => theme.movil}) {
    position: static;
  }
`;

const CuerpoFormulario = styled(CuerpoPanel)`
  display: grid;
  gap: 14px;
`;

const Fila = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 14px;
`;

const LogoActual = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
`;

const MarcoLogo = styled.div`
  width: 170px;
  height: 64px;
  flex: none;
  border: 1.5px dashed ${({ theme }) => theme.colores.bordeSuave};
  border-radius: ${({ theme }) => theme.radio};
  background: ${({ theme }) => theme.colores.superficieSuave};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
`;

const DatosLogo = styled.div`
  display: grid;
  gap: 6px;
  flex: 1;
  min-width: 180px;
`;

const Botones = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Casilla = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
`;

const AvisoModal = styled(TextoAyuda)`
  display: block;
  margin-bottom: 10px;
`;

const MarcoPdf = styled.div`
  height: min(70vh, 640px);
  overflow: auto;
  background: #f5e6ec;
  padding: 12px;
  border-radius: ${({ theme }) => theme.radio};
`;

function CampoSelector({ etiqueta, opciones, ...props }) {
  const id = useId();
  return (
    <Campo>
      <Etiqueta htmlFor={id}>{etiqueta}</Etiqueta>
      <Selector id={id} {...props}>
        {opciones.map(({ valor, etiqueta: texto }) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </Selector>
    </Campo>
  );
}

function soloCampos(configuracion) {
  return Object.fromEntries(
    CAMPOS_CONFIGURACION.map((campo) => [
      campo,
      configuracion?.[campo] ?? VALORES_POR_DEFECTO[campo],
    ])
  );
}

function validar(valores) {
  const errores = {
    nombreInstitucion: validarTexto(valores.nombreInstitucion, {
      etiqueta: 'El nombre de la institución',
      obligatorio: false,
      max: LIMITES_CONFIGURACION.nombreInstitucion,
    }),
    textoPie: validarTexto(valores.textoPie, {
      etiqueta: 'El texto del pie de página',
      obligatorio: false,
      max: LIMITES_CONFIGURACION.textoPie,
    }),
  };
  const lineas = valores.textoPie.trim().split('\n').filter(Boolean).length;
  if (!errores.textoPie && lineas > LIMITES_CONFIGURACION.lineasPie) {
    errores.textoPie = `El texto del pie de página admite como máximo ${LIMITES_CONFIGURACION.lineasPie} líneas`;
  }
  return Object.fromEntries(
    Object.entries(errores).filter(([, mensaje]) => mensaje)
  );
}

// Validación previa a la subida; el servidor vuelve a verificar el contenido real.
function validarArchivoLogo(archivo, limites) {
  const nombre = archivo.name.toLowerCase();
  if (!limites.extensiones.some((extension) => nombre.endsWith(extension))) {
    return 'Formato no permitido. Solo se aceptan imágenes PNG, JPG y JPEG';
  }
  if (archivo.type && !limites.mimes.includes(archivo.type)) {
    return 'El tipo del archivo no coincide con su extensión';
  }
  if (archivo.size === 0) return 'El archivo está vacío';
  if (archivo.size > limites.maxBytes) {
    return `El logo supera el tamaño máximo permitido (${formatearTamano(limites.maxBytes)})`;
  }
  return null;
}

function describirLogo(logo) {
  if (!logo?.ancho) return null;
  const formato = logo.mimeType === 'image/png' ? 'PNG' : 'JPEG';
  return `${formato} · ${logo.ancho} × ${logo.alto} px${
    logo.tamano ? ` · ${formatearTamano(logo.tamano)}` : ''
  }`;
}

export default function ConfiguracionInformes() {
  const { notificar, confirmar } = useNotificaciones();
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [limitesLogo, setLimitesLogo] = useState(LIMITES_LOGO);
  const [guardados, setGuardados] = useState(VALORES_POR_DEFECTO);
  const [valores, setValores] = useState(VALORES_POR_DEFECTO);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  // Logo almacenado: metadatos del servidor y una URL local (blob) para mostrarlo.
  const [logoGuardado, setLogoGuardado] = useState(null);
  const [errorImagenLogo, setErrorImagenLogo] = useState('');
  // Imagen elegida y aún no subida: { archivo, url, ancho, alto }.
  const [logoPendiente, setLogoPendiente] = useState(null);
  const [errorLogo, setErrorLogo] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  // Vista previa en PDF: { cargando } | { datos } | { error }.
  const [vistaPdf, setVistaPdf] = useState(null);
  const guardadoRef = useRef(false);
  const urlsRef = useRef(new Set());

  const hayCambios = useMemo(
    () =>
      CAMPOS_CONFIGURACION.some((campo) => valores[campo] !== guardados[campo]),
    [valores, guardados]
  );
  useCambiosSinGuardar(hayCambios || Boolean(logoPendiente), guardadoRef);

  function crearUrl(blob) {
    const url = URL.createObjectURL(blob);
    urlsRef.current.add(url);
    return url;
  }

  function liberarUrl(url) {
    if (url && urlsRef.current.delete(url)) URL.revokeObjectURL(url);
  }

  // Libera las URL locales al salir de la pantalla.
  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    let vigente = true;
    obtenerConfiguracionInformes()
      .then(({ configuracion, limitesLogo: limites }) => {
        if (!vigente) return;
        const campos = soloCampos(configuracion);
        setGuardados(campos);
        setValores(campos);
        if (limites) setLimitesLogo(limites);
        setCargado(true);
        if (configuracion.logo) {
          setLogoGuardado({ ...configuracion.logo, url: null });
          obtenerLogoInformes()
            .then((blob) => {
              if (!vigente) return;
              const url = URL.createObjectURL(blob);
              urlsRef.current.add(url);
              setLogoGuardado((actual) => (actual ? { ...actual, url } : null));
            })
            .catch((err) => {
              if (vigente)
                setErrorImagenLogo(
                  mensajeDeError(err, 'No se pudo mostrar el logo guardado')
                );
            });
        }
      })
      .catch((err) => {
        if (vigente)
          setErrorCarga(
            mensajeDeError(
              err,
              'No se pudo cargar la configuración de informes'
            )
          );
      });
    return () => {
      vigente = false;
    };
  }, []);

  function cambiar(campo, valor) {
    setValores((actuales) => ({ ...actuales, [campo]: valor }));
    if (errores[campo]) {
      setErrores((actuales) => {
        const restantes = { ...actuales };
        delete restantes[campo];
        return restantes;
      });
    }
  }

  async function handleGuardar() {
    const encontrados = validar(valores);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      notificar({
        tipo: 'error',
        mensaje: 'Revise los campos marcados antes de guardar',
      });
      return;
    }
    setGuardando(true);
    try {
      const configuracion = await guardarConfiguracionInformes(valores);
      const campos = soloCampos(configuracion);
      setGuardados(campos);
      setValores(campos);
      notificar({
        tipo: 'exito',
        mensaje:
          'Configuración guardada. Se aplicará a los informes que se generen desde ahora.',
      });
    } catch (err) {
      setErrores(erroresDeCampos(err));
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(err, 'No fue posible guardar la configuración'),
      });
    } finally {
      setGuardando(false);
    }
  }

  function descartarPendiente() {
    liberarUrl(logoPendiente?.url);
    setLogoPendiente(null);
  }

  function handleArchivo(archivo) {
    const error = validarArchivoLogo(archivo, limitesLogo);
    setErrorLogo(error ?? '');
    if (error) return;
    descartarPendiente();
    const url = crearUrl(archivo);
    setLogoPendiente({ archivo, url, ancho: null, alto: null });

    // Dimensiones reales para la vista previa; si no se puede leer, está dañada.
    const imagen = new Image();
    imagen.onload = () => {
      const { naturalWidth: ancho, naturalHeight: alto } = imagen;
      if (ancho > limitesLogo.maxPx || alto > limitesLogo.maxPx) {
        setErrorLogo(
          `La imagen no puede superar ${limitesLogo.maxPx} × ${limitesLogo.maxPx} píxeles`
        );
        liberarUrl(url);
        setLogoPendiente((actual) => (actual?.url === url ? null : actual));
        return;
      }
      setLogoPendiente((actual) =>
        actual?.url === url ? { ...actual, ancho, alto } : actual
      );
    };
    imagen.onerror = () => {
      setErrorLogo('La imagen está dañada o no se puede leer');
      liberarUrl(url);
      setLogoPendiente((actual) => (actual?.url === url ? null : actual));
    };
    imagen.src = url;
  }

  async function handleSubirLogo() {
    setSubiendo(true);
    setProgreso(0);
    setErrorLogo('');
    try {
      const configuracion = await subirLogoInformes(
        logoPendiente.archivo,
        setProgreso
      );
      liberarUrl(logoGuardado?.url);
      // La imagen local ya corresponde al logo guardado.
      setLogoGuardado({ ...configuracion.logo, url: logoPendiente.url });
      setErrorImagenLogo('');
      setLogoPendiente(null);
      notificar({ tipo: 'exito', mensaje: 'Logo guardado correctamente' });
    } catch (err) {
      setErrorLogo(mensajeDeError(err, 'No fue posible guardar el logo'));
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(err, 'No fue posible guardar el logo'),
      });
    } finally {
      setSubiendo(false);
    }
  }

  async function handleEliminarLogo() {
    try {
      const eliminado = await confirmar({
        titulo: 'Eliminar logo',
        mensaje:
          'Los informes que se generen desde ahora no incluirán logo. Los informes ya emitidos no cambian.',
        textoConfirmar: 'Eliminar',
        textoProcesando: 'Eliminando…',
        accion: eliminarLogoInformes,
      });
      if (!eliminado) return;
      liberarUrl(logoGuardado?.url);
      setLogoGuardado(null);
      notificar({ tipo: 'exito', mensaje: 'Logo eliminado' });
    } catch (err) {
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(err, 'No fue posible eliminar el logo'),
      });
    }
  }

  async function handleVistaPdf() {
    const encontrados = validar(valores);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      notificar({
        tipo: 'error',
        mensaje: 'Revise los campos marcados antes de generar la vista previa',
      });
      return;
    }
    setVistaPdf({ cargando: true });
    try {
      setVistaPdf({ datos: await generarVistaPreviaInforme(valores) });
    } catch (err) {
      setErrores(erroresDeCampos(err));
      setVistaPdf({
        error: mensajeDeError(err, 'No se pudo generar la vista previa'),
      });
    }
  }

  const logoVista = logoPendiente ?? logoGuardado;
  const lineasPie = valores.textoPie.split('\n').filter(Boolean).length;

  return (
    <>
      <EncabezadoPagina titulo="Configuración de informes">
        <Boton
          type="button"
          $variante="informativo"
          onClick={handleVistaPdf}
          disabled={!cargado || vistaPdf?.cargando}
          $cargando={vistaPdf?.cargando}
        >
          <Icono nombre="ver" />
          {vistaPdf?.cargando ? 'Generando…' : 'Vista previa PDF'}
        </Boton>
        <Boton
          type="button"
          onClick={handleGuardar}
          disabled={!cargado || !hayCambios || guardando}
          $cargando={guardando}
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </Boton>
      </EncabezadoPagina>
      <CuerpoPagina>
        <TextoAyuda as="p">
          Defina cómo se presentan los informes psicopedagógicos en PDF. Los
          cambios se aplican a los informes que se generen después de
          guardarlos; los informes ya emitidos no se modifican.
        </TextoAyuda>

        {errorCarga && <Alerta role="alert">{errorCarga}</Alerta>}
        {!cargado && !errorCarga && (
          <Cargando role="status">Cargando configuración…</Cargando>
        )}

        {cargado && (
          <Columnas>
            <ColumnaFormulario>
              <Panel aria-labelledby="titulo-logo">
                <EncabezadoPanel>
                  <TituloSeccion id="titulo-logo">
                    Logo institucional
                  </TituloSeccion>
                </EncabezadoPanel>
                <CuerpoFormulario>
                  {logoPendiente ? (
                    <LogoActual>
                      <MarcoLogo>
                        <img
                          src={logoPendiente.url}
                          alt="Vista previa del logo seleccionado"
                        />
                      </MarcoLogo>
                      <DatosLogo>
                        <span>
                          {logoPendiente.archivo.name}
                          {' · '}
                          {formatearTamano(logoPendiente.archivo.size)}
                        </span>
                        <TextoAyuda>
                          Vista previa: el logo aún no se ha guardado.
                        </TextoAyuda>
                        <Botones>
                          <BotonPequeno
                            type="button"
                            onClick={handleSubirLogo}
                            disabled={subiendo}
                            $cargando={subiendo}
                          >
                            <Icono nombre="subirArchivo" />
                            {subiendo
                              ? `Guardando… ${progreso}%`
                              : 'Guardar logo'}
                          </BotonPequeno>
                          <BotonPequeno
                            type="button"
                            $variante="secundario"
                            onClick={descartarPendiente}
                            disabled={subiendo}
                          >
                            Descartar
                          </BotonPequeno>
                        </Botones>
                      </DatosLogo>
                    </LogoActual>
                  ) : (
                    <>
                      {logoGuardado ? (
                        <LogoActual>
                          <MarcoLogo>
                            {logoGuardado.url ? (
                              <img
                                src={logoGuardado.url}
                                alt="Logo institucional guardado"
                              />
                            ) : (
                              <TextoAyuda>
                                {errorImagenLogo ? 'Sin vista' : 'Cargando…'}
                              </TextoAyuda>
                            )}
                          </MarcoLogo>
                          <DatosLogo>
                            <span>{describirLogo(logoGuardado)}</span>
                            {errorImagenLogo && (
                              <ErrorCampo>{errorImagenLogo}</ErrorCampo>
                            )}
                            <Botones>
                              <BotonPequeno
                                type="button"
                                $variante="peligro"
                                onClick={handleEliminarLogo}
                              >
                                <Icono nombre="eliminar" />
                                Eliminar logo
                              </BotonPequeno>
                            </Botones>
                          </DatosLogo>
                        </LogoActual>
                      ) : (
                        <TextoAyuda as="p">
                          No hay un logo configurado. Los informes se generan
                          sin logo hasta que se agregue uno.
                        </TextoAyuda>
                      )}
                      <ZonaCarga
                        limites={limitesLogo}
                        subiendo={false}
                        progreso={0}
                        onArchivo={handleArchivo}
                        etiqueta={
                          logoGuardado ? 'Reemplazar logo' : 'Seleccionar logo'
                        }
                        textoAyuda={`${
                          logoGuardado ? 'Para reemplazar el logo actual: ' : ''
                        }PNG, JPG o JPEG · máximo ${formatearTamano(
                          limitesLogo.maxBytes
                        )} · se ajusta sin deformarse`}
                      />
                    </>
                  )}
                  {errorLogo && (
                    <ErrorCampo role="alert">{errorLogo}</ErrorCampo>
                  )}
                </CuerpoFormulario>
              </Panel>

              <Panel aria-labelledby="titulo-encabezado">
                <EncabezadoPanel>
                  <TituloSeccion id="titulo-encabezado">
                    Encabezado
                  </TituloSeccion>
                </EncabezadoPanel>
                <CuerpoFormulario>
                  <CampoFormulario
                    etiqueta="Nombre del centro o empresa"
                    autoComplete="organization"
                    maxLength={LIMITES_CONFIGURACION.nombreInstitucion}
                    value={valores.nombreInstitucion}
                    error={errores.nombreInstitucion}
                    ayuda="Opcional. Se muestra sobre el título del informe."
                    onChange={(evento) =>
                      cambiar('nombreInstitucion', evento.target.value)
                    }
                  />
                  <Fila>
                    <CampoSelector
                      etiqueta="Alineación del encabezado"
                      opciones={ALINEACIONES}
                      value={valores.alineacionEncabezado}
                      onChange={(evento) =>
                        cambiar('alineacionEncabezado', evento.target.value)
                      }
                    />
                    <CampoSelector
                      etiqueta="Posición del logo"
                      opciones={POSICIONES_LOGO}
                      value={valores.posicionLogo}
                      onChange={(evento) =>
                        cambiar('posicionLogo', evento.target.value)
                      }
                    />
                    <CampoSelector
                      etiqueta="Tamaño del logo"
                      opciones={Object.entries(TAMANOS_LOGO).map(
                        ([valor, { etiqueta }]) => ({ valor, etiqueta })
                      )}
                      value={valores.tamanoLogo}
                      onChange={(evento) =>
                        cambiar('tamanoLogo', evento.target.value)
                      }
                    />
                  </Fila>
                </CuerpoFormulario>
              </Panel>

              <Panel aria-labelledby="titulo-pie">
                <EncabezadoPanel>
                  <TituloSeccion id="titulo-pie">Pie de página</TituloSeccion>
                </EncabezadoPanel>
                <CuerpoFormulario>
                  <CampoFormulario
                    as="textarea"
                    rows={3}
                    etiqueta="Texto institucional"
                    placeholder="Dirección, teléfono, correo electrónico o sitio web"
                    maxLength={LIMITES_CONFIGURACION.textoPie}
                    value={valores.textoPie}
                    error={errores.textoPie}
                    ayuda={`Opcional. ${valores.textoPie.length}/${LIMITES_CONFIGURACION.textoPie} caracteres · ${lineasPie}/${LIMITES_CONFIGURACION.lineasPie} líneas. Se repite en todas las páginas.`}
                    onChange={(evento) =>
                      cambiar('textoPie', evento.target.value)
                    }
                  />
                  <Casilla>
                    <input
                      type="checkbox"
                      checked={valores.numeracionPaginas}
                      onChange={(evento) =>
                        cambiar('numeracionPaginas', evento.target.checked)
                      }
                    />
                    Numerar las páginas («Página 1 de 2»)
                  </Casilla>
                </CuerpoFormulario>
              </Panel>
            </ColumnaFormulario>

            <ColumnaVistaPrevia>
              <Panel aria-labelledby="titulo-vista-previa">
                <EncabezadoPanel>
                  <TituloSeccion id="titulo-vista-previa">
                    Vista previa
                  </TituloSeccion>
                </EncabezadoPanel>
                <CuerpoFormulario>
                  <VistaPreviaInforme valores={valores} logo={logoVista} />
                  <TextoAyuda>
                    Representación aproximada de la primera página. Use «Vista
                    previa PDF» para ver el documento exacto con datos
                    ficticios.
                  </TextoAyuda>
                </CuerpoFormulario>
              </Panel>
            </ColumnaVistaPrevia>
          </Columnas>
        )}
      </CuerpoPagina>

      {vistaPdf && (
        <Modal
          titulo="Vista previa del informe PDF"
          ancho={820}
          onCerrar={() => setVistaPdf(null)}
        >
          <AvisoModal>
            Documento de prueba con datos ficticios. No se guarda ni se asocia a
            ningún menor.
            {logoPendiente && ' Usa el logo guardado, no la imagen pendiente.'}
          </AvisoModal>
          {vistaPdf.cargando && (
            <Cargando role="status">Generando vista previa…</Cargando>
          )}
          {vistaPdf.error && <Alerta role="alert">{vistaPdf.error}</Alerta>}
          {vistaPdf.datos && (
            <MarcoPdf>
              <Suspense
                fallback={<Cargando role="status">Cargando visor…</Cargando>}
              >
                <VisorPdf datos={vistaPdf.datos} />
              </Suspense>
            </MarcoPdf>
          )}
        </Modal>
      )}
    </>
  );
}
