import { useEffect, useId, useRef } from 'react';
import styled from 'styled-components';
import { BotonIcono } from './ui';
import Icono from './Icono';

// Ventana modal con formulario (por ejemplo, el registro de diagnóstico del mockup 1g).
// El foco queda dentro del cuadro y Escape equivale a cerrar. Se dibuja bajo las
// confirmaciones (ModalConfirmacion) para que estas aparezcan por encima.

const Fondo = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(43, 35, 40, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const Cuadro = styled.div`
  width: min(${({ $ancho }) => $ancho}px, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colores.superficie};
  border: 2px solid ${({ theme }) => theme.colores.primario};
  border-radius: 6px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
`;

const Cabecera = styled.div`
  padding: 14px 18px;
  border-bottom: 2px solid ${({ theme }) => theme.colores.primario};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;

  h2 {
    margin: 0;
    font-size: 19px;
  }
`;

const Contenido = styled.div`
  padding: 18px;
  overflow-y: auto;
`;

const Pie = styled.div`
  padding: 11px 18px;
  border-top: 1.5px dashed #bbbbbb;
  color: #777777;
  font-size: 14px;
`;

const ENFOCABLES =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]';

export default function Modal({
  titulo,
  pie,
  ancho = 760,
  onCerrar,
  children,
}) {
  const id = useId();
  const cuadroRef = useRef(null);

  // Foco inicial en el primer campo y regreso al elemento anterior al cerrar.
  useEffect(() => {
    const anterior = document.activeElement;
    const campo = cuadroRef.current?.querySelector(
      'input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'
    );
    (campo ?? cuadroRef.current)?.focus();
    return () => {
      if (anterior instanceof HTMLElement && anterior.isConnected)
        anterior.focus();
    };
  }, []);

  function handleKeyDown(evento) {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      onCerrar();
      return;
    }
    if (evento.key !== 'Tab') return;
    const enfocables = [...cuadroRef.current.querySelectorAll(ENFOCABLES)];
    if (enfocables.length === 0) return;
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  return (
    <Fondo>
      <Cuadro
        ref={cuadroRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        tabIndex={-1}
        $ancho={ancho}
        onKeyDown={handleKeyDown}
      >
        <Cabecera>
          <h2 id={`${id}-titulo`}>{titulo}</h2>
          <BotonIcono
            type="button"
            $variante="fantasma"
            aria-label="Cerrar"
            onClick={onCerrar}
          >
            <Icono nombre="cerrar" />
          </BotonIcono>
        </Cabecera>
        <Contenido>{children}</Contenido>
        {pie && <Pie>{pie}</Pie>}
      </Cuadro>
    </Fondo>
  );
}
