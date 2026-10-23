import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/useAuth';
import { mensajeDeError } from '../api/client';
import { soloErrores, validarEmail } from '../utils/validacion';
import CampoFormulario from '../components/CampoFormulario';
import CampoPassword from '../components/CampoPassword';
import { Alerta, Boton, Formulario, TextoAyuda } from '../components/ui';

// Pantalla 1d de los mockups: marca a la izquierda y formulario a la derecha.

const Pantalla = styled.main`
  min-height: 100vh;
  display: flex;
`;

const PanelMarca = styled.div`
  flex: 1;
  background: ${({ theme }) => theme.colores.lateral};
  border-right: 2px solid ${({ theme }) => theme.colores.primario};
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 56px;

  @media (max-width: ${({ theme }) => theme.movil}) {
    display: none;
  }
`;

const Sigla = styled.div`
  font-size: 34px;
  font-weight: 700;
  margin-bottom: 8px;
`;

const NombreSistema = styled.p`
  margin: 0;
  font-size: 20px;
  color: #555555;
  max-width: 330px;
`;

const PanelFormulario = styled.div`
  width: 470px;
  max-width: 100%;
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 48px;

  @media (max-width: ${({ theme }) => theme.movil}) {
    width: 100%;
    padding: 32px 16px;
  }
`;

const TituloLogin = styled.h1`
  margin: 0 0 16px;
  font-size: 24px;
`;

const AyudaLogin = styled(TextoAyuda).attrs({ as: 'p' })`
  margin: 0;
`;

const BotonIngresar = styled(Boton)`
  padding: 11px;
  font-size: 17px;
`;

export default function Login() {
  const { usuario, iniciarSesion } = useAuth();
  const location = useLocation();
  const [valores, setValores] = useState({ email: '', password: '' });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Con sesión iniciada se vuelve a la página solicitada originalmente.
  if (usuario) {
    return <Navigate to={location.state?.desde ?? '/'} replace />;
  }

  function handleChange(evento) {
    const { name, value } = evento.target;
    setValores((anteriores) => ({ ...anteriores, [name]: value }));
  }

  async function handleSubmit(evento) {
    evento.preventDefault();
    const nuevosErrores = soloErrores({
      email: validarEmail(valores.email),
      password: valores.password ? null : 'Ingrese la contraseña',
    });
    setErrores(nuevosErrores);
    setErrorGeneral('');
    if (Object.keys(nuevosErrores).length > 0) return;

    setEnviando(true);
    try {
      await iniciarSesion(valores.email, valores.password);
    } catch (error) {
      setErrorGeneral(mensajeDeError(error, 'No se pudo iniciar sesión'));
      setValores((anteriores) => ({ ...anteriores, password: '' }));
      setEnviando(false);
    }
  }

  return (
    <Pantalla>
      <PanelMarca>
        <Sigla>SGP</Sigla>
        <NombreSistema>
          Sistema de Gestión de Información Psicopedagógica
        </NombreSistema>
      </PanelMarca>
      <PanelFormulario>
        <TituloLogin>Iniciar sesión</TituloLogin>
        <Formulario onSubmit={handleSubmit} noValidate>
          <CampoFormulario
            etiqueta="Correo electrónico"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="nombre@pyme.cl"
            value={valores.email}
            onChange={handleChange}
            error={errores.email}
          />
          <CampoPassword
            etiqueta="Contraseña"
            name="password"
            autoComplete="current-password"
            value={valores.password}
            onChange={handleChange}
            error={errores.password}
          />
          <AyudaLogin>
            Si olvidó su contraseña, contacte al administrador.
          </AyudaLogin>
          <BotonIngresar type="submit" disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </BotonIngresar>
          {errorGeneral && (
            <Alerta role="alert">
              <span aria-hidden="true">✕ </span>
              {errorGeneral}
            </Alerta>
          )}
        </Formulario>
      </PanelFormulario>
    </Pantalla>
  );
}
