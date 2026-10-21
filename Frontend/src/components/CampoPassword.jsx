import { useId, useState } from 'react';
import styled from 'styled-components';
import { Campo, Entrada, ErrorCampo, Etiqueta } from './ui';

const Contenedor = styled.div`
  position: relative;

  input {
    padding-right: 84px;
  }
`;

const BotonVisibilidad = styled.button`
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  padding: 2px 6px;
  border: none;
  background: none;
  color: ${({ theme }) => theme.colores.enlace};
  font-size: 13px;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colores.primario};
  }
`;

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
          onClick={() => setVisible((valor) => !valor)}
          aria-pressed={visible}
          aria-controls={id}
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </BotonVisibilidad>
      </Contenedor>
      {error && <ErrorCampo id={idError}>{error}</ErrorCampo>}
    </Campo>
  );
}
