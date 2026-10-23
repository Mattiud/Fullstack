import { useContext } from 'react';
import { NotificacionesContext } from './notificacionesContext';

// { notificar({ tipo, mensaje }), confirmar({ titulo, mensaje, ... }) }
export function useNotificaciones() {
  const contexto = useContext(NotificacionesContext);
  if (!contexto) {
    throw new Error(
      'useNotificaciones debe usarse dentro de NotificacionesProvider'
    );
  }
  return contexto;
}
