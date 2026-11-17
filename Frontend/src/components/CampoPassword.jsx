import { useId, useState } from 'react';
import styled from 'styled-components';
import {
  Campo,
  Entrada,
  ErrorCampo,
  Etiqueta,
  estadosInteractivos,
} from './ui';

const Contenedor = styled.div`
  position: relative;

  input {
    padding-right: 44px;
  }
`;

// Ícono de ojo: gris con la contraseña oculta y en el color principal cuando se ve.
const BotonVisibilidad = styled.button`
  position: absolute;
  top: 50%;
  right: 3px;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: none;
  color: ${({ theme, $visible }) =>
    $visible ? theme.colores.primario : theme.colores.textoSuave};
  ${estadosInteractivos}

  /* Sin fondo al pasar el cursor: solo se oscurece el ícono. */
  &:hover {
    color: ${({ theme, $visible }) =>
      $visible ? theme.colores.primarioOscuro : theme.colores.texto};
  }

  &:focus-visible {
    outline-offset: -2px;
  }
`;

// Íconos de línea con la misma convención de IconoNavegacion (24 × 24, trazo 1,8,
// currentColor). Son decorativos: el nombre del botón lo da aria-label.
function IconoOjo({ abierto }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-testid={abierto ? 'ojo-abierto' : 'ojo-cerrado'}
    >
      {abierto ? (
        <>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M3 10c2.4 3.2 5.4 4.8 9 4.8s6.6-1.6 9-4.8" />
          <path d="M6.2 13.3 4.6 15.6M12 14.8v2.7M17.8 13.3l1.6 2.3" />
        </>
      )}
    </svg>
  );
}

// Campo de contraseña con opción para mostrar u ocultar lo escrito (mockup 1d).
export default function CampoPassword({ etiqueta, error, ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const idError = error ? `${id}-error` : undefined;

  return (
    <Campo>
      <Etiqueta htmlFor={id}>{etiqueta}</Etiqueta>
      <Contenedor>
        <Entrada
          id={id}
          type={visible ? 'text' : 'password'}
          $invalido={Boolean(error)}
          aria-invalid={Boolean(error)}
          aria-describedby={idError}
          {...props}
        />
        <BotonVisibilidad
          type="button"
          $visible={visible}
          onClick={() => setVisible((valor) => !valor)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          aria-controls={id}
        >
          <IconoOjo abierto={visible} />
        </BotonVisibilidad>
      </Contenedor>
      {error && <ErrorCampo id={idError}>{error}</ErrorCampo>}
    </Campo>
  );
}
