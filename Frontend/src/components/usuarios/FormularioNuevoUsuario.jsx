import { useId, useState } from 'react';
import styled from 'styled-components';
import { crearUsuario } from '../../api/users';
import { erroresDeCampos, mensajeDeError } from '../../api/client';
import { NOMBRES_ROLES, ROLES } from '../../constants/auth';
import {
  soloErrores,
  validarEmail,
  validarNombre,
  validarPassword,
} from '../../utils/validacion';
import CampoFormulario from '../CampoFormulario';
import {
  Alerta,
  Boton,
  Campo,
  CuerpoPanel,
  EncabezadoPanel,
  ErrorCampo,
  Etiqueta,
  Formulario,
  Panel,
  Selector,
  TituloSeccion,
} from '../ui';

const Columnas = styled.div`
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`;

const Botones = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
`;

const VALORES_INICIALES = {
  nombre: '',
  email: '',
  rol: ROLES.PSICOPEDAGOGO,
  password: '',
};

export default function FormularioNuevoUsuario({ onCreado, onCancelar }) {
  const id = useId();
  const [valores, setValores] = useState(VALORES_INICIALES);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);

  function handleChange(evento) {
    const { name, value } = evento.target;
    setValores((anteriores) => ({ ...anteriores, [name]: value }));
  }

  async function handleSubmit(evento) {
    evento.preventDefault();
    const nuevosErrores = soloErrores({
      nombre: validarNombre(valores.nombre),
      email: validarEmail(valores.email),
      rol: NOMBRES_ROLES[valores.rol] ? null : 'Seleccione un rol',
      password: validarPassword(valores.password),
    });
    setErrores(nuevosErrores);
    setErrorGeneral('');
    if (Object.keys(nuevosErrores).length > 0) return;

    setEnviando(true);
    try {
      const usuario = await crearUsuario({
        nombre: valores.nombre.trim(),
        email: valores.email.trim(),
        rol: valores.rol,
        password: valores.password,
      });
      onCreado(usuario);
    } catch (error) {
      setErrores(erroresDeCampos(error));
      setErrorGeneral(mensajeDeError(error, 'No se pudo crear el usuario'));
      setEnviando(false);
    }
  }

  return (
    <Panel aria-labelledby={`${id}-titulo`}>
      <EncabezadoPanel>
        <TituloSeccion id={`${id}-titulo`}>Nuevo usuario</TituloSeccion>
      </EncabezadoPanel>
      <CuerpoPanel>
        <Formulario onSubmit={handleSubmit} noValidate>
          <Columnas>
            <CampoFormulario
              etiqueta="Nombre"
              name="nombre"
              autoComplete="off"
              value={valores.nombre}
              onChange={handleChange}
              error={errores.nombre}
            />
            <CampoFormulario
              etiqueta="Correo institucional"
              name="email"
              type="email"
              autoComplete="off"
              placeholder="nombre@pyme.cl"
              value={valores.email}
              onChange={handleChange}
              error={errores.email}
            />
            <Campo>
              <Etiqueta htmlFor={`${id}-rol`}>Rol</Etiqueta>
              <Selector
                id={`${id}-rol`}
                name="rol"
                value={valores.rol}
                onChange={handleChange}
                $invalido={Boolean(errores.rol)}
              >
                {Object.entries(NOMBRES_ROLES).map(([valor, nombre]) => (
                  <option key={valor} value={valor}>
                    {nombre}
                  </option>
                ))}
              </Selector>
              {errores.rol && <ErrorCampo>{errores.rol}</ErrorCampo>}
            </Campo>
            <CampoFormulario
              etiqueta="Contraseña temporal"
              name="password"
              type="password"
              autoComplete="new-password"
              value={valores.password}
              onChange={handleChange}
              error={errores.password}
              ayuda="El usuario deberá cambiarla al iniciar sesión."
            />
          </Columnas>
          {errorGeneral && (
            <Alerta role="alert">
              <span aria-hidden="true">✕ </span>
              {errorGeneral}
            </Alerta>
          )}
          <Botones>
            <Boton type="button" $variante="secundario" onClick={onCancelar}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={enviando}>
              {enviando ? 'Registrando…' : 'Registrar usuario'}
            </Boton>
          </Botones>
        </Formulario>
      </CuerpoPanel>
    </Panel>
  );
}
