import { useState } from 'react';
import styled from 'styled-components';
import { listarUsuarios } from '../../api/users';
import { asignarProfesionales } from '../../api/menores';
import { mensajeDeError } from '../../api/client';
import { ROLES } from '../../constants/auth';
import { useNotificaciones } from '../../context/useNotificaciones';
import {
  BotonPequeno,
  Chip,
  CuerpoPanel,
  EncabezadoPanel,
  Panel,
  TextoAyuda,
  TituloSeccion,
} from '../ui';

const Lista = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Opciones = styled.fieldset`
  border: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;

  label {
    display: flex;
    gap: 8px;
    align-items: center;
  }
`;

const Botones = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

// Profesionales con acceso al expediente. Solo el administrador puede modificarlos.
export default function ProfesionalesAsignados({
  menor,
  puedeAsignar,
  onActualizado,
}) {
  const [editando, setEditando] = useState(false);
  const [candidatos, setCandidatos] = useState([]);
  const [seleccion, setSeleccion] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const { notificar } = useNotificaciones();

  async function abrir() {
    try {
      const usuarios = await listarUsuarios();
      setCandidatos(
        usuarios.filter((u) => u.rol === ROLES.PSICOPEDAGOGO && u.activo)
      );
      setSeleccion(menor.profesionalesAsignados.map((p) => p._id));
      setEditando(true);
    } catch (err) {
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(
          err,
          'No fue posible cargar la lista de profesionales'
        ),
      });
    }
  }

  function alternar(id) {
    setSeleccion((actual) =>
      actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]
    );
  }

  async function guardar() {
    if (seleccion.length === 0) {
      notificar({
        tipo: 'advertencia',
        mensaje: 'Debe asignar al menos un profesional.',
      });
      return;
    }
    setGuardando(true);
    try {
      onActualizado(await asignarProfesionales(menor._id, seleccion));
      setEditando(false);
    } catch (err) {
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(err, 'No fue posible guardar los cambios'),
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Panel aria-labelledby="titulo-profesionales">
      <EncabezadoPanel>
        <TituloSeccion id="titulo-profesionales">
          Profesionales asignados
        </TituloSeccion>
        {puedeAsignar && !editando && (
          <BotonPequeno type="button" $variante="secundario" onClick={abrir}>
            Modificar
          </BotonPequeno>
        )}
      </EncabezadoPanel>
      <CuerpoPanel>
        {editando ? (
          <>
            <Opciones>
              <legend className="sr-only">
                Psicopedagogos con acceso al expediente
              </legend>
              {candidatos.map((usuario) => (
                <label key={usuario._id}>
                  <input
                    type="checkbox"
                    checked={seleccion.includes(usuario._id)}
                    onChange={() => alternar(usuario._id)}
                  />
                  {usuario.nombre}
                </label>
              ))}
              {candidatos.length === 0 && (
                <TextoAyuda>
                  No hay psicopedagogos con cuenta activa.
                </TextoAyuda>
              )}
            </Opciones>
            <Botones>
              <BotonPequeno
                type="button"
                onClick={guardar}
                disabled={guardando}
              >
                Guardar asignación
              </BotonPequeno>
              <BotonPequeno
                type="button"
                $variante="secundario"
                onClick={() => setEditando(false)}
              >
                Cancelar
              </BotonPequeno>
            </Botones>
          </>
        ) : (
          <Lista>
            {menor.profesionalesAsignados.map((profesional) => (
              <Chip key={profesional._id}>
                {profesional.nombre}
                {!profesional.activo && ' (cuenta inactiva)'}
              </Chip>
            ))}
            {menor.profesionalesAsignados.length === 0 && (
              <TextoAyuda>Sin profesionales asignados.</TextoAyuda>
            )}
          </Lista>
        )}
      </CuerpoPanel>
    </Panel>
  );
}
