import { useEffect, useId, useRef } from 'react';
import styled from 'styled-components';
import { Boton } from './ui';

// Confirmación centrada que bloquea la página hasta que el usuario decide. El foco
// empieza en "Cancelar", queda dentro del cuadro y Escape equivale a cancelar.

const Fondo = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(43, 35, 40, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const Cuadro = styled.div`
  width: min(460px, 100%);
  background: ${({ theme }) => theme.colores.superficie};
  border: 2px solid ${({ theme }) => theme.colores.primario};
  border-radius: 6px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
`;

const Titulo = styled.h2`
  margin: 0;
  padding: 14px 18px;
  font-size: 18px;
  border-bottom: 2px solid ${({ theme }) => theme.colores.primario};
`;

const Mensaje = styled.p`
  margin: 0;
  padding: 18px;
`;

const Botones = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 18px 18px;
`;

export default function ModalConfirmacion({
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  textoProcesando = 'Procesando…',
  peligro = true,
  procesando,
  onConfirmar,
  onCancelar,
}) {
  const id = useId();
  const cuadroRef = useRef(null);
  const cancelarRef = useRef(null);

  // Foco inicial en "Cancelar" (opción segura) y regreso al elemento anterior al cerrar.
  useEffect(() => {
    const anterior = document.activeElement;
    cancelarRef.current?.focus();
    return () => {
      if (anterior instanceof HTMLElement && anterior.isConnected)
        anterior.focus();
    };
  }, []);

  function handleKeyDown(evento) {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      if (!procesando) onCancelar();
      return;
    }
    if (evento.key !== 'Tab') return;
    const botones = [
      ...cuadroRef.current.querySelectorAll('button:not(:disabled)'),
    ];
    if (botones.length === 0) {
      evento.preventDefault();
      return;
    }
    const primero = botones[0];
    const ultimo = botones[botones.length - 1];
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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-mensaje`}
        onKeyDown={handleKeyDown}
      >
        <Titulo id={`${id}-titulo`}>{titulo}</Titulo>
        <Mensaje id={`${id}-mensaje`}>{mensaje}</Mensaje>
        <Botones>
          <Boton
            ref={cancelarRef}
            type="button"
            $variante="secundario"
            onClick={onCancelar}
            disabled={procesando}
          >
            {textoCancelar}
          </Boton>
          <Boton
            type="button"
            $variante={peligro ? 'peligro' : 'primario'}
            onClick={onConfirmar}
            disabled={procesando}
          >
            {procesando ? textoProcesando : textoConfirmar}
          </Boton>
        </Botones>
      </Cuadro>
    </Fondo>
  );
}
