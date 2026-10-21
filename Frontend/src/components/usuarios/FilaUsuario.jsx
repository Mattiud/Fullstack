import { useState } from 'react';
import styled from 'styled-components';
import { actualizarUsuario, asignarPasswordTemporal } from '../../api/users';
import { mensajeDeError } from '../../api/client';
import { NOMBRES_ROLES } from '../../constants/auth';
import { formatearFecha } from '../../utils/formato';
import { validarNombre, validarPassword } from '../../utils/validacion';
import {
  BotonEnlace,
  BotonPequeno,
  Campo,
  Chip,
  Entrada,
  ErrorCampo,
  Etiqueta,
  Selector,
  TextoAyuda,
} from '../ui';

const Acciones = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
  color: #777777;
  white-space: nowrap;
`;

const Edicion = styled.div`
  display: grid;
  gap: 14px;
  padding: 4px 0 6px;
`;

const FilaCampos = styled.form`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;

  > div {
    flex: 1 1 200px;
    max-width: 280px;
  }
`;

const Botones = styled.div`
  display: flex;
  gap: 8px;
`;

export default function FilaUsuario({
  usuario,
  esPropio,
  onActualizado,
  onAviso,
}) {
  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState({
    nombre: usuario.nombre,
    rol: usuario.rol,
  });
  const [passwordTemporal, setPasswordTemporal] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar(accion, aviso) {
    setGuardando(true);
    setError('');
    try {
      const actualizado = await accion();
      onActualizado(actualizado);
      onAviso(aviso);
      return true;
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo guardar el cambio'));
      return false;
    } finally {
      setGuardando(false);
    }
  }

  function abrirEdicion() {
    setValores({ nombre: usuario.nombre, rol: usuario.rol });
    setPasswordTemporal('');
    setError('');
    setEditando(true);
  }

  function handleEstado() {
    const activo = !usuario.activo;
    if (
      !activo &&
      !window.confirm(`¿Desactivar la cuenta de ${usuario.nombre}?`)
    )
      return;
    guardar(
      () => actualizarUsuario(usuario._id, { activo }),
      `Se ${activo ? 'activó' : 'desactivó'} la cuenta de ${usuario.nombre}.`
    );
  }

  async function handleGuardarEdicion(evento) {
    evento.preventDefault();
    const errorNombre = validarNombre(valores.nombre);
    if (errorNombre) {
      setError(errorNombre);
      return;
    }
    const cambios = {};
    if (valores.nombre.trim() !== usuario.nombre)
      cambios.nombre = valores.nombre.trim();
    if (valores.rol !== usuario.rol) cambios.rol = valores.rol;
    if (Object.keys(cambios).length === 0) {
      setEditando(false);
      return;
    }
    const aviso = cambios.rol
      ? `Se cambió el rol de ${usuario.nombre} a ${NOMBRES_ROLES[cambios.rol]}.`
      : `Se actualizó la cuenta de ${usuario.nombre}.`;
    if (await guardar(() => actualizarUsuario(usuario._id, cambios), aviso)) {
      setEditando(false);
    }
  }

  async function handlePasswordTemporal(evento) {
    evento.preventDefault();
    const errorPassword = validarPassword(passwordTemporal);
    if (errorPassword) {
      setError(errorPassword);
      return;
    }
    const ok = await guardar(
      () => asignarPasswordTemporal(usuario._id, passwordTemporal),
      `Se asignó una contraseña temporal a ${usuario.nombre}.`
    );
    if (ok) setPasswordTemporal('');
  }

  return (
    <>
      <tr>
        <td>
          <strong>{usuario.nombre}</strong>
        </td>
        <td>{usuario.email}</td>
        <td>
          <Chip>{NOMBRES_ROLES[usuario.rol] ?? usuario.rol}</Chip>
        </td>
        <td>{usuario.activo ? 'Activo' : 'Inactivo'}</td>
        <td>{formatearFecha(usuario.ultimoAcceso)}</td>
        <td>
          <Acciones>
            <BotonEnlace
              type="button"
              onClick={editando ? () => setEditando(false) : abrirEdicion}
              aria-expanded={editando}
              aria-label={`Editar a ${usuario.nombre}`}
              disabled={guardando}
            >
              Editar
            </BotonEnlace>
            {esPropio ? (
              <TextoAyuda>(su cuenta)</TextoAyuda>
            ) : (
              <>
                <span aria-hidden="true">·</span>
                <BotonEnlace
                  type="button"
                  $peligro={usuario.activo}
                  onClick={handleEstado}
                  disabled={guardando}
                  aria-label={`${usuario.activo ? 'Desactivar' : 'Activar'} a ${usuario.nombre}`}
                >
                  {usuario.activo ? 'Desactivar' : 'Activar'}
                </BotonEnlace>
              </>
            )}
          </Acciones>
          {!editando && error && <ErrorCampo role="alert">{error}</ErrorCampo>}
        </td>
      </tr>
      {editando && (
        <tr>
          <td colSpan={6}>
            <Edicion>
              <FilaCampos onSubmit={handleGuardarEdicion} noValidate>
                <Campo>
                  <Etiqueta htmlFor={`nombre-${usuario._id}`}>Nombre</Etiqueta>
                  <Entrada
                    id={`nombre-${usuario._id}`}
                    value={valores.nombre}
                    onChange={(evento) =>
                      setValores({ ...valores, nombre: evento.target.value })
                    }
                  />
                </Campo>
                <Campo>
                  <Etiqueta htmlFor={`rol-${usuario._id}`}>Rol</Etiqueta>
                  <Selector
                    id={`rol-${usuario._id}`}
                    value={valores.rol}
                    onChange={(evento) =>
                      setValores({ ...valores, rol: evento.target.value })
                    }
                    disabled={esPropio}
                  >
                    {Object.entries(NOMBRES_ROLES).map(([valor, nombre]) => (
                      <option key={valor} value={valor}>
                        {nombre}
                      </option>
                    ))}
                  </Selector>
                </Campo>
                <Botones>
                  <BotonPequeno type="submit" disabled={guardando}>
                    Guardar cambios
                  </BotonPequeno>
                  <BotonPequeno
                    type="button"
                    $variante="secundario"
                    onClick={() => setEditando(false)}
                  >
                    Cancelar
                  </BotonPequeno>
                </Botones>
              </FilaCampos>
              {!esPropio && (
                <FilaCampos onSubmit={handlePasswordTemporal} noValidate>
                  <Campo>
                    <Etiqueta htmlFor={`password-${usuario._id}`}>
                      Contraseña temporal
                    </Etiqueta>
                    <Entrada
                      id={`password-${usuario._id}`}
                      type="password"
                      autoComplete="new-password"
                      value={passwordTemporal}
                      onChange={(evento) =>
                        setPasswordTemporal(evento.target.value)
                      }
                    />
                  </Campo>
                  <Botones>
                    <BotonPequeno
                      type="submit"
                      $variante="secundario"
                      disabled={guardando}
                    >
                      Asignar contraseña temporal
                    </BotonPequeno>
                  </Botones>
                </FilaCampos>
              )}
              {error && <ErrorCampo role="alert">{error}</ErrorCampo>}
            </Edicion>
          </td>
        </tr>
      )}
    </>
  );
}
