import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/useAuth';
import { mensajeDeError } from '../api/client';
import { soloErrores, validarEmail } from '../utils/validacion';
import CampoFormulario from '../components/CampoFormulario';
import CampoPassword from '../components/CampoPassword';
import { Alerta, Boton, Formulario, TextoAyuda } from '../components/ui';
import { LOGO_LOGIN } from '../constants/marca';

// Pantalla 1d de los mockups: espacio visual con el logo de la organización a la
// izquierda (50 %) y formulario a la derecha (50 %). En pantallas pequeñas el espacio
// visual se reduce a una franja sobre el formulario.

const Pantalla = styled.main`
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);

  @media (max-width: ${({ theme }) => theme.movil}) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
  }
`;

const PanelMarca = styled.div`
  background: ${({ theme }) => theme.colores.lateral};
  border-right: 2px solid ${({ theme }) => theme.colores.primario};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: clamp(32px, 6vw, 72px);
  text-align: center;
  min-width: 0;

  @media (max-width: ${({ theme }) => theme.movil}) {
    border-right: none;
    border-bottom: 2px solid ${({ theme }) => theme.colores.primario};
    padding: 20px 16px;
    gap: 8px;
  }
`;

// Logo: ocupa el espacio disponible sin deformarse (object-fit: contain). Se muestra
// solo cuando la imagen terminó de cargar.
const ImagenLogo = styled.img`
  display: ${({ $visible }) => ($visible ? 'block' : 'none')};
  width: 100%;
  max-width: 420px;
  height: auto;
  max-height: 50vh;
  object-fit: contain;

  @media (max-width: ${({ theme }) => theme.movil}) {
    max-width: 240px;
    max-height: 96px;
  }
`;

const Sigla = styled.div`
  font-size: 34px;
  font-weight: 700;

  @media (max-width: ${({ theme }) => theme.movil}) {
    font-size: 26px;
  }
`;

const NombreSistema = styled.p`
  margin: 0;
  font-size: ${({ $secundario }) => ($secundario ? '16px' : '20px')};
  color: #555555;
  max-width: 360px;

  @media (max-width: ${({ theme }) => theme.movil}) {
    font-size: 14px;
  }
`;

const PanelFormulario = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(32px, 5vw, 64px);
  min-width: 0;

  @media (max-width: ${({ theme }) => theme.movil}) {
    align-items: flex-start;
    padding: 28px 16px;
  }
`;

// Ancho cómodo para los campos en cualquier resolución.
const ContenidoFormulario = styled.div`
  width: 100%;
  max-width: 420px;
`;

const TituloLogin = styled.h1`
  margin: 0 0 16px;
  font-size: 24px;
`;

const AyudaLogin = styled(TextoAyuda).attrs({ as: 'p' })`
  margin: 0;
`;

const BotonIngresar = styled(Boton)`
  min-height: 46px;
  padding: 10px 16px;
  font-size: 17px;
`;

const AvisoSesion = styled.p`
  margin: 0 0 16px;
  padding: 9px 12px;
  border-radius: 4px;
  border: 1.5px solid ${({ theme }) => theme.colores.advertenciaBorde};
  background: ${({ theme }) => theme.colores.advertenciaFondo};
  color: ${({ theme }) => theme.colores.advertencia};
`;

const NOMBRE_SISTEMA = 'Sistema de Gestión de Información Psicopedagógica';

// Logo de la organización si existe (constants/marca.js); si no, la marca de texto.
// Mientras carga, o si el archivo no existe o no es una imagen válida, se muestra la
// marca de texto: nunca aparece una imagen rota ni un espacio vacío.
function LogoOrganizacion() {
  const [estado, setEstado] = useState(LOGO_LOGIN ? 'cargando' : 'sin-logo');
  const conLogo = estado === 'cargado';

  return (
    <>
      {estado !== 'sin-logo' && (
        <ImagenLogo
          src={LOGO_LOGIN}
          alt="Logo de la organización"
          $visible={conLogo}
          onLoad={() => setEstado('cargado')}
          onError={() => setEstado('sin-logo')}
        />
      )}
      {!conLogo && <Sigla>SGP</Sigla>}
      <NombreSistema $secundario={conLogo}>{NOMBRE_SISTEMA}</NombreSistema>
    </>
  );
}

export default function Login() {
  const { usuario, iniciarSesion, motivoCierre } = useAuth();
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
        <LogoOrganizacion />
      </PanelMarca>
      <PanelFormulario>
        <ContenidoFormulario>
          <TituloLogin>Iniciar sesión</TituloLogin>
          {motivoCierre === 'inactividad' && (
            <AvisoSesion role="status">
              Su sesión se cerró tras 12 horas de inactividad. Inicie sesión
              nuevamente.
            </AvisoSesion>
          )}
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
            <BotonIngresar
              type="submit"
              disabled={enviando}
              $cargando={enviando}
            >
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </BotonIngresar>
            {errorGeneral && (
              <Alerta role="alert">
                <span aria-hidden="true">✕ </span>
                {errorGeneral}
              </Alerta>
            )}
          </Formulario>
        </ContenidoFormulario>
      </PanelFormulario>
    </Pantalla>
  );
}
