import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { useNotificaciones } from '../context/useNotificaciones';

// Pide confirmación antes de salir de la pantalla con cambios pendientes: al navegar
// dentro de la aplicación (modal "Cambios sin guardar") y al cerrar o recargar la
// pestaña (aviso del navegador). `omitirRef.current = true` permite salir sin aviso,
// por ejemplo después de guardar.
export function useCambiosSinGuardar(hayCambios, omitirRef) {
  const { confirmar } = useNotificaciones();

  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hayCambios &&
      !omitirRef.current &&
      currentLocation.pathname !== nextLocation.pathname
  );
  const bloqueoRef = useRef(bloqueo);
  bloqueoRef.current = bloqueo;

  useEffect(() => {
    if (bloqueo.state !== 'blocked') return;
    confirmar({
      titulo: 'Cambios sin guardar',
      mensaje: 'Tiene cambios sin guardar. Si sale ahora, se perderán.',
      textoConfirmar: 'Salir sin guardar',
      textoCancelar: 'Seguir editando',
    }).then((salir) =>
      salir ? bloqueoRef.current.proceed() : bloqueoRef.current.reset()
    );
  }, [bloqueo.state, confirmar]);

  useEffect(() => {
    if (!hayCambios) return undefined;
    const avisar = (evento) => {
      evento.preventDefault();
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [hayCambios]);
}
