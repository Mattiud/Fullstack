import { useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  actualizarTipoDiagnostico,
  crearTipoDiagnostico,
  eliminarTipoDiagnostico,
  listarTiposDiagnostico,
} from '../../api/diagnosticos';
import { erroresDeCampos, mensajeDeError } from '../../api/client';
import { useNotificaciones } from '../../context/useNotificaciones';
import { LIMITES_DIAGNOSTICO } from '../../constants/diagnosticos';
import { validarTexto } from '../../utils/validacion';
import EncabezadoPagina, {
  CuerpoPagina,
} from '../../components/EncabezadoPagina';
import CampoFormulario from '../../components/CampoFormulario';
import Icono from '../../components/Icono';
import {
  Alerta,
  Boton,
  BotonAccion,
  Cargando,
  Chip,
  ContenedorTabla,
  CuerpoPanel,
  EncabezadoPanel,
  Entrada,
  ErrorCampo,
  GrupoAcciones,
  Panel,
  Tabla,
  TextoAyuda,
  TituloSeccion,
} from '../../components/ui';

// Categorías sugeridas para el campo "Tipo de diagnóstico". Solo el administrador
// las mantiene; no se eliminan, se desactivan.

const FormularioAgregar = styled.form`
  display: flex;
  gap: 10px;
  align-items: flex-end;
  flex-wrap: wrap;

  > div {
    flex: 1;
    min-width: 240px;
  }
`;

const Acciones = GrupoAcciones;

const EdicionNombre = styled.div`
  display: grid;
  gap: 4px;
`;

function validarNombre(nombre) {
  return validarTexto(nombre, {
    etiqueta: 'El nombre de la categoría',
    max: LIMITES_DIAGNOSTICO.tipo,
  });
}

export default function TiposDiagnostico() {
  const { notificar, confirmar } = useNotificaciones();
  const [tipos, setTipos] = useState(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [nombre, setNombre] = useState('');
  const [errorNombre, setErrorNombre] = useState('');
  const [agregando, setAgregando] = useState(false);
  // Fila en edición: { id, nombre, error }.
  const [edicion, setEdicion] = useState(null);

  useEffect(() => {
    let vigente = true;
    listarTiposDiagnostico({ incluirInactivas: true })
      .then((datos) => {
        if (vigente) setTipos(datos);
      })
      .catch((err) => {
        if (vigente)
          setErrorCarga(
            mensajeDeError(err, 'No se pudieron cargar las categorías')
          );
      });
    return () => {
      vigente = false;
    };
  }, []);

  function reemplazar(tipo) {
    setTipos((anteriores) =>
      anteriores
        .map((t) => (t._id === tipo._id ? tipo : t))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    );
  }

  async function handleAgregar(evento) {
    evento.preventDefault();
    const error = validarNombre(nombre);
    setErrorNombre(error ?? '');
    if (error) return;
    setAgregando(true);
    try {
      const tipo = await crearTipoDiagnostico(nombre.trim());
      setTipos((anteriores) =>
        [...anteriores, tipo].sort((a, b) =>
          a.nombre.localeCompare(b.nombre, 'es')
        )
      );
      setNombre('');
      notificar({ tipo: 'exito', mensaje: 'Categoría agregada correctamente' });
    } catch (err) {
      setErrorNombre(erroresDeCampos(err).nombre ?? '');
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(err, 'No fue posible agregar la categoría'),
      });
    } finally {
      setAgregando(false);
    }
  }

  async function handleRenombrar(tipo) {
    const error = validarNombre(edicion.nombre);
    if (error) {
      setEdicion((e) => ({ ...e, error }));
      return;
    }
    if (edicion.nombre.trim() === tipo.nombre) {
      setEdicion(null);
      return;
    }
    try {
      reemplazar(
        await actualizarTipoDiagnostico(tipo._id, {
          nombre: edicion.nombre.trim(),
        })
      );
      setEdicion(null);
      notificar({
        tipo: 'exito',
        mensaje: 'Categoría renombrada correctamente',
      });
    } catch (err) {
      setEdicion((e) => ({ ...e, error: erroresDeCampos(err).nombre ?? '' }));
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(err, 'No fue posible renombrar la categoría'),
      });
    }
  }

  // Eliminación definitiva. El servidor la rechaza si algún diagnóstico usa la
  // categoría y sugiere desactivarla; ese mensaje se muestra tal cual.
  async function handleEliminar(tipo) {
    try {
      const eliminado = await confirmar({
        titulo: 'Eliminar categoría',
        mensaje: `Se eliminará definitivamente la categoría "${tipo.nombre}". Esta acción no se puede deshacer. Solo se pueden eliminar categorías que ningún diagnóstico usa; en los demás casos, desactívela.`,
        textoConfirmar: 'Eliminar',
        textoProcesando: 'Eliminando…',
        accion: () => eliminarTipoDiagnostico(tipo._id),
      });
      if (!eliminado) return;
      setTipos((anteriores) => anteriores.filter((t) => t._id !== tipo._id));
      notificar({ tipo: 'exito', mensaje: 'Categoría eliminada' });
    } catch (err) {
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(err, 'No fue posible eliminar la categoría'),
      });
    }
  }

  async function handleEstado(tipo) {
    try {
      if (tipo.activo) {
        const actualizado = await confirmar({
          titulo: 'Desactivar categoría',
          mensaje: `"${tipo.nombre}" dejará de sugerirse al registrar diagnósticos. Los diagnósticos existentes no cambian.`,
          textoConfirmar: 'Desactivar',
          textoProcesando: 'Desactivando…',
          accion: () => actualizarTipoDiagnostico(tipo._id, { activo: false }),
        });
        if (!actualizado) return;
        reemplazar(actualizado);
        notificar({ tipo: 'exito', mensaje: 'Categoría desactivada' });
      } else {
        reemplazar(await actualizarTipoDiagnostico(tipo._id, { activo: true }));
        notificar({ tipo: 'exito', mensaje: 'Categoría reactivada' });
      }
    } catch (err) {
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(err, 'No fue posible cambiar el estado'),
      });
    }
  }

  return (
    <>
      <EncabezadoPagina titulo="Tipos de diagnóstico" />
      <CuerpoPagina>
        <TextoAyuda as="p">
          Estas categorías se ofrecen al registrar un diagnóstico; si ninguna
          corresponde, el profesional elige «Otro» y escribe el tipo. Renombrar
          o desactivar una categoría no modifica los diagnósticos ya
          registrados.
        </TextoAyuda>

        <Panel aria-labelledby="titulo-agregar">
          <EncabezadoPanel>
            <TituloSeccion id="titulo-agregar">Agregar categoría</TituloSeccion>
          </EncabezadoPanel>
          <CuerpoPanel>
            <FormularioAgregar onSubmit={handleAgregar} noValidate>
              <CampoFormulario
                etiqueta="Nombre de la categoría *"
                autoComplete="off"
                maxLength={LIMITES_DIAGNOSTICO.tipo}
                value={nombre}
                error={errorNombre}
                onChange={(evento) => setNombre(evento.target.value)}
              />
              <Boton type="submit" disabled={agregando} $cargando={agregando}>
                {agregando ? 'Agregando…' : 'Agregar'}
              </Boton>
            </FormularioAgregar>
          </CuerpoPanel>
        </Panel>

        <Panel aria-labelledby="titulo-categorias">
          <EncabezadoPanel>
            <TituloSeccion id="titulo-categorias">Categorías</TituloSeccion>
          </EncabezadoPanel>
          <CuerpoPanel>
            {errorCarga && <Alerta role="alert">{errorCarga}</Alerta>}
            {!tipos && !errorCarga && (
              <Cargando role="status">Cargando categorías…</Cargando>
            )}
            {tipos?.length === 0 && (
              <TextoAyuda as="p">Aún no hay categorías registradas.</TextoAyuda>
            )}
            {tipos?.length > 0 && (
              <ContenedorTabla>
                <Tabla>
                  <thead>
                    <tr>
                      <th scope="col">Nombre</th>
                      <th scope="col">Estado</th>
                      <th scope="col">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tipos.map((tipo) => (
                      <tr key={tipo._id}>
                        <td>
                          {edicion?.id === tipo._id ? (
                            <EdicionNombre>
                              <Entrada
                                aria-label={`Nuevo nombre para ${tipo.nombre}`}
                                maxLength={LIMITES_DIAGNOSTICO.tipo}
                                value={edicion.nombre}
                                $invalido={Boolean(edicion.error)}
                                autoFocus
                                onChange={(evento) =>
                                  setEdicion((e) => ({
                                    ...e,
                                    nombre: evento.target.value,
                                  }))
                                }
                                onKeyDown={(evento) => {
                                  if (evento.key === 'Enter')
                                    handleRenombrar(tipo);
                                  if (evento.key === 'Escape') setEdicion(null);
                                }}
                              />
                              {edicion.error && (
                                <ErrorCampo>{edicion.error}</ErrorCampo>
                              )}
                            </EdicionNombre>
                          ) : (
                            tipo.nombre
                          )}
                        </td>
                        <td>
                          <Chip>{tipo.activo ? 'Activa' : 'Inactiva'}</Chip>
                        </td>
                        <td>
                          <Acciones>
                            {edicion?.id === tipo._id ? (
                              <>
                                <BotonAccion
                                  type="button"
                                  onClick={() => handleRenombrar(tipo)}
                                >
                                  <Icono nombre="confirmar" />
                                  Guardar
                                </BotonAccion>
                                <BotonAccion
                                  type="button"
                                  onClick={() => setEdicion(null)}
                                >
                                  <Icono nombre="cerrar" />
                                  Cancelar
                                </BotonAccion>
                              </>
                            ) : (
                              <>
                                <BotonAccion
                                  type="button"
                                  aria-label={`Renombrar ${tipo.nombre}`}
                                  onClick={() =>
                                    setEdicion({
                                      id: tipo._id,
                                      nombre: tipo.nombre,
                                      error: '',
                                    })
                                  }
                                >
                                  <Icono nombre="editar" />
                                  Renombrar
                                </BotonAccion>
                                <BotonAccion
                                  type="button"
                                  $peligro={tipo.activo}
                                  aria-label={`${tipo.activo ? 'Desactivar' : 'Reactivar'} ${tipo.nombre}`}
                                  onClick={() => handleEstado(tipo)}
                                >
                                  <Icono
                                    nombre={
                                      tipo.activo ? 'desactivar' : 'activar'
                                    }
                                  />
                                  {tipo.activo ? 'Desactivar' : 'Reactivar'}
                                </BotonAccion>
                                <BotonAccion
                                  type="button"
                                  $peligro
                                  aria-label={`Eliminar ${tipo.nombre}`}
                                  onClick={() => handleEliminar(tipo)}
                                >
                                  <Icono nombre="eliminar" />
                                  Eliminar
                                </BotonAccion>
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
          </CuerpoPanel>
        </Panel>
      </CuerpoPagina>
    </>
  );
}
