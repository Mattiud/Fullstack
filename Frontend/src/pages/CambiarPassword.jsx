import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/useAuth';
import { cambiarPassword } from '../api/auth';
import { erroresDeCampos, mensajeDeError } from '../api/client';
import { soloErrores, validarPassword } from '../utils/validacion';
import CampoFormulario from '../components/CampoFormulario';
import EncabezadoPagina, { CuerpoPagina } from '../components/EncabezadoPagina';
import { Alerta, Boton, Formulario, Tarjeta } from '../components/ui';

const Contenedor = styled(Tarjeta)`
  max-width: 480px;
  width: 100%;
`;

const VALORES_INICIALES = {
  passwordActual: '',
  passwordNueva: '',
  confirmacion: '',
};

export default function CambiarPassword() {
  const { usuario, actualizarSesion } = useAuth();
  const navigate = useNavigate();
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
      passwordActual: valores.passwordActual
        ? null
        : 'Ingrese su contraseña actual',
      passwordNueva:
        validarPassword(valores.passwordNueva) ||
        (valores.passwordNueva === valores.passwordActual
          ? 'Debe ser distinta de la contraseña actual'
          : null),
      confirmacion:
        valores.confirmacion === valores.passwordNueva
          ? null
          : 'Las contraseñas no coinciden',
    });
    setErrores(nuevosErrores);
    setErrorGeneral('');
    if (Object.keys(nuevosErrores).length > 0) return;

    setEnviando(true);
    try {
      const usuarioActualizado = await cambiarPassword(
        valores.passwordActual,
        valores.passwordNueva
      );
      actualizarSesion(usuarioActualizado);
      navigate('/', { replace: true });
    } catch (error) {
      setErrores(erroresDeCampos(error));
      setErrorGeneral(
        mensajeDeError(error, 'No se pudo cambiar la contraseña')
      );
      setEnviando(false);
    }
  }

  return (
    <>
      <EncabezadoPagina titulo="Cambiar contraseña" />
      <CuerpoPagina>
        <Contenedor>
          <Formulario onSubmit={handleSubmit} noValidate>
            {usuario.debeCambiarPassword && (
              <Alerta role="status">
                Su contraseña fue asignada por el administrador. Debe cambiarla
                para continuar.
              </Alerta>
            )}
            {errorGeneral && <Alerta role="alert">{errorGeneral}</Alerta>}
            <CampoFormulario
              etiqueta="Contraseña actual"
              name="passwordActual"
              type="password"
              autoComplete="current-password"
              value={valores.passwordActual}
              onChange={handleChange}
              error={errores.passwordActual}
            />
            <CampoFormulario
              etiqueta="Nueva contraseña"
              name="passwordNueva"
              type="password"
              autoComplete="new-password"
              value={valores.passwordNueva}
              onChange={handleChange}
              error={errores.passwordNueva}
              ayuda="Al menos 10 caracteres, con letras y números."
            />
            <CampoFormulario
              etiqueta="Repita la nueva contraseña"
              name="confirmacion"
              type="password"
              autoComplete="new-password"
              value={valores.confirmacion}
              onChange={handleChange}
              error={errores.confirmacion}
            />
            <Boton type="submit" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar contraseña'}
            </Boton>
          </Formulario>
        </Contenedor>
      </CuerpoPagina>
    </>
  );
}
