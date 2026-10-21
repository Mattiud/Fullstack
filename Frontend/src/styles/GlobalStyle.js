import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: ${({ theme }) => theme.fuente};
    font-size: 14.5px;
    background: ${({ theme }) => theme.colores.fondo};
    color: ${({ theme }) => theme.colores.texto};
    line-height: 1.4;
  }

  button, input, select {
    font: inherit;
  }

  a {
    color: ${({ theme }) => theme.colores.enlace};
  }

  /* Texto visible solo para lectores de pantalla. */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
`;

export default GlobalStyle;
