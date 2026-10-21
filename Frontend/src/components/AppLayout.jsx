import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/useAuth';
import { NOMBRES_ROLES, PERMISOS } from '../constants/auth';
import { BotonEnlace } from './ui';

// Estructura común de los mockups: navegación lateral fija y contenido a la derecha.
// En pantallas angostas la barra lateral pasa a la parte superior.

const Estructura = styled.div`
  display: flex;
  min-height: 100vh;

  @media (max-width: ${({ theme }) => theme.movil}) {
    flex-direction: column;
  }
`;

const Lateral = styled.aside`
  width: 206px;
  flex: none;
  background: ${({ theme }) => theme.colores.lateral};
  border-right: 2px solid ${({ theme }) => theme.colores.primario};
  display: flex;
  flex-direction: column;

  @media (max-width: ${({ theme }) => theme.movil}) {
    width: 100%;
    border-right: none;
    border-bottom: 2px solid ${({ theme }) => theme.colores.primario};
  }
`;

const Marca = styled.div`
  padding: 16px 14px 12px;
  border-bottom: 2px solid ${({ theme }) => theme.colores.primario};
  font-size: 20px;
  font-weight: 700;
`;

const Navegacion = styled.nav`
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;

  a {
    padding: 8px 14px;
    border-left: 4px solid transparent;
    color: inherit;
    text-decoration: none;
  }

  a:hover {
    background: ${({ theme }) => theme.colores.lateralActivo};
  }

  a.active {
    background: ${({ theme }) => theme.colores.lateralActivo};
    border-left-color: ${({ theme }) => theme.colores.primario};
    font-weight: 700;
  }

  @media (max-width: ${({ theme }) => theme.movil}) {
    flex-direction: row;
    flex-wrap: wrap;
    padding: 6px 0;

    a.active {
      border-left-color: transparent;
      box-shadow: inset 0 -3px 0 ${({ theme }) => theme.colores.primario};
    }
  }
`;

const Cuenta = styled.div`
  padding: 12px 14px;
  border-top: 1.5px dashed #bbbbbb;
  display: grid;
  gap: 10px;
  font-size: 14px;
`;

const Persona = styled.div`
  display: flex;
  gap: 9px;
  align-items: center;
`;

const Avatar = styled.span`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.colores.primario};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex: none;
`;

const Rol = styled.span`
  display: block;
  color: #777777;
  font-size: 13px;
`;

const AccionesCuenta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;

  a {
    font-size: 13.5px;
  }
`;

const Principal = styled.main`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

function iniciales(nombre) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('');
}

export default function AppLayout() {
  const { usuario, cerrarSesion, tienePermiso } = useAuth();
  const [cerrando, setCerrando] = useState(false);

  async function handleCerrarSesion() {
    setCerrando(true);
    try {
      await cerrarSesion();
    } catch {
      // La sesión local se cierra igualmente aunque falle la solicitud.
    }
  }

  return (
    <Estructura>
      <Lateral>
        <Marca>SGP</Marca>
        <Navegacion aria-label="Principal">
          {!usuario.debeCambiarPassword && (
            <>
              <NavLink to="/" end>
                Inicio
              </NavLink>
              {tienePermiso(PERMISOS.USUARIOS_GESTIONAR) && (
                <NavLink to="/usuarios">Usuarios</NavLink>
              )}
            </>
          )}
        </Navegacion>
        <Cuenta>
          <Persona>
            <Avatar aria-hidden="true">{iniciales(usuario.nombre)}</Avatar>
            <span>
              {usuario.nombre}
              <Rol>{NOMBRES_ROLES[usuario.rol] ?? usuario.rol}</Rol>
            </span>
          </Persona>
          <AccionesCuenta>
            <NavLink to="/cambiar-password">Cambiar contraseña</NavLink>
            <BotonEnlace
              type="button"
              onClick={handleCerrarSesion}
              disabled={cerrando}
            >
              {cerrando ? 'Cerrando…' : 'Cerrar sesión'}
            </BotonEnlace>
          </AccionesCuenta>
        </Cuenta>
      </Lateral>
      <Principal>
        <Outlet />
      </Principal>
    </Estructura>
  );
}
