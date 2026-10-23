import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  descargarDocumento,
  eliminarDocumento,
  subirDocumento,
} from '../../api/menores';
import { mensajeDeError } from '../../api/client';
import { useNotificaciones } from '../../context/useNotificaciones';
import { formatearFecha, formatearTamano } from '../../utils/formato';
import { validarArchivoLocal } from '../../utils/documentos';
import ZonaCarga from './ZonaCarga';
import VisorDocumento from './VisorDocumento';
import {
  BotonEnlace,
  BotonPequeno,
  Chip,
  ContenedorTabla,
  CuerpoPanel,
  EncabezadoPanel,
  Panel,
  Tabla,
  TextoAyuda,
  TituloSeccion,
} from '../ui';

const Seccion = styled.div`
  display: grid;
  gap: 16px;
`;

const Acciones = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  white-space: nowrap;
  color: #777777;
`;

const Fondo = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(43, 35, 40, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 10;
`;

const Dialogo = styled.div`
  width: min(1100px, 100%);
  height: min(90vh, 100%);
  background: ${({ theme }) => theme.colores.superficie};
  border: 2px solid ${({ theme }) => theme.colores.primario};
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  min-height: 0;

  > div:last-child {
    flex: 1;
    min-height: 0;
    padding: 12px;
  }
`;

// Visor ampliado. Escape lo cierra y el foco vuelve al botón de cierre al abrirlo.
function VisorAmpliado({ menorId, documento, onDescargar, onCerrar }) {
  const cerrarRef = useRef(null);
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;

  useEffect(() => {
    cerrarRef.current?.focus();
    const alPresionar = (evento) => {
      if (evento.key === 'Escape') onCerrarRef.current();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, []);

  return (
    <Fondo onClick={onCerrar}>
      <Dialogo
        role="dialog"
        aria-modal="true"
        aria-label={`Visor ampliado: ${documento.nombreOriginal}`}
        onClick={(evento) => evento.stopPropagation()}
      >
        <EncabezadoPanel>
          <strong>{documento.nombreOriginal}</strong>
          <Acciones>
            <BotonPequeno
              type="button"
              $variante="secundario"
              onClick={onDescargar}
            >
              Descargar
            </BotonPequeno>
            <BotonPequeno ref={cerrarRef} type="button" onClick={onCerrar}>
              Cerrar
            </BotonPequeno>
          </Acciones>
        </EncabezadoPanel>
        <div>
          <VisorDocumento menorId={menorId} documento={documento} alto="100%" />
        </div>
      </Dialogo>
    </Fondo>
  );
}

export default function DocumentosMenor({
  menorId,
  documentos,
  limites,
  puedeEditar,
  onAgregado,
  onEliminado,
}) {
  const [seleccionado, setSeleccionado] = useState(null);
  const [ampliado, setAmpliado] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const { notificar, confirmar } = useNotificaciones();

  async function handleArchivo(archivo) {
    const errorLocal = validarArchivoLocal(archivo, limites);
    if (errorLocal) {
      notificar({ tipo: 'error', mensaje: errorLocal });
      return;
    }
    setSubiendo(true);
    setProgreso(0);
    try {
      const documento = await subirDocumento(menorId, archivo, setProgreso);
      onAgregado(documento);
      notificar({
        tipo: 'exito',
        mensaje: 'Documento adjuntado correctamente',
      });
    } catch (err) {
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(err, 'No fue posible subir el documento'),
      });
    } finally {
      setSubiendo(false);
    }
  }

  async function handleDescargar(documento) {
    try {
      await descargarDocumento(menorId, documento);
    } catch (err) {
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(err, 'No fue posible descargar el documento'),
      });
    }
  }

  async function handleEliminar(documento) {
    try {
      const eliminado = await confirmar({
        titulo: 'Eliminar documento',
        mensaje: `Se eliminará definitivamente "${documento.nombreOriginal}". Esta acción no se puede deshacer.`,
        textoConfirmar: 'Eliminar',
        textoProcesando: 'Eliminando…',
        accion: () => eliminarDocumento(menorId, documento._id),
      });
      if (!eliminado) return;
      if (seleccionado?._id === documento._id) setSeleccionado(null);
      onEliminado(documento._id);
      notificar({
        tipo: 'exito',
        mensaje: 'Documento eliminado correctamente',
      });
    } catch (err) {
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(err, 'No fue posible eliminar el documento'),
      });
    }
  }

  return (
    <Seccion>
      <Panel aria-labelledby="titulo-documentos">
        <EncabezadoPanel>
          <TituloSeccion id="titulo-documentos">
            Documentos adjuntos
          </TituloSeccion>
        </EncabezadoPanel>
        <CuerpoPanel>
          <Seccion>
            {documentos.length === 0 ? (
              <TextoAyuda as="p">
                Este expediente aún no tiene documentos adjuntos.
              </TextoAyuda>
            ) : (
              <ContenedorTabla>
                <Tabla>
                  <thead>
                    <tr>
                      <th scope="col">Documento</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Tamaño</th>
                      <th scope="col">Cargado</th>
                      <th scope="col">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentos.map((documento) => (
                      <tr key={documento._id}>
                        <td>{documento.nombreOriginal}</td>
                        <td>
                          <Chip>{documento.tipo.toUpperCase()}</Chip>
                        </td>
                        <td>{formatearTamano(documento.tamano)}</td>
                        <td>
                          {formatearFecha(documento.createdAt)}
                          <TextoAyuda as="div">
                            {documento.subidoPor?.nombre}
                          </TextoAyuda>
                        </td>
                        <td>
                          <Acciones>
                            <BotonEnlace
                              type="button"
                              aria-label={`Ver ${documento.nombreOriginal}`}
                              onClick={() => setSeleccionado(documento)}
                            >
                              Ver
                            </BotonEnlace>
                            <span aria-hidden="true">·</span>
                            <BotonEnlace
                              type="button"
                              aria-label={`Descargar ${documento.nombreOriginal}`}
                              onClick={() => handleDescargar(documento)}
                            >
                              Descargar
                            </BotonEnlace>
                            {puedeEditar && (
                              <>
                                <span aria-hidden="true">·</span>
                                <BotonEnlace
                                  type="button"
                                  $peligro
                                  aria-label={`Eliminar ${documento.nombreOriginal}`}
                                  onClick={() => handleEliminar(documento)}
                                >
                                  Eliminar
                                </BotonEnlace>
                              </>
                            )}
                          </Acciones>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
              </ContenedorTabla>
            )}
            {puedeEditar && (
              <ZonaCarga
                limites={limites}
                subiendo={subiendo}
                progreso={progreso}
                onArchivo={handleArchivo}
              />
            )}
          </Seccion>
        </CuerpoPanel>
      </Panel>

      {seleccionado && (
        <Panel aria-label={`Vista de ${seleccionado.nombreOriginal}`}>
          <EncabezadoPanel>
            <strong>{seleccionado.nombreOriginal}</strong>
            <Acciones>
              <BotonPequeno
                type="button"
                $variante="secundario"
                onClick={() => setAmpliado(true)}
              >
                Ampliar
              </BotonPequeno>
              <BotonPequeno
                type="button"
                $variante="secundario"
                onClick={() => handleDescargar(seleccionado)}
              >
                Descargar
              </BotonPequeno>
              <BotonPequeno type="button" onClick={() => setSeleccionado(null)}>
                Cerrar
              </BotonPequeno>
            </Acciones>
          </EncabezadoPanel>
          <CuerpoPanel>
            {ampliado ? (
              <TextoAyuda as="p">
                El documento está abierto en el visor ampliado.
              </TextoAyuda>
            ) : (
              <VisorDocumento menorId={menorId} documento={seleccionado} />
            )}
          </CuerpoPanel>
        </Panel>
      )}

      {seleccionado && ampliado && (
        <VisorAmpliado
          menorId={menorId}
          documento={seleccionado}
          onDescargar={() => handleDescargar(seleccionado)}
          onCerrar={() => setAmpliado(false)}
        />
      )}
    </Seccion>
  );
}
