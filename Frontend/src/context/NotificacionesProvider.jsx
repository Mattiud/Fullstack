import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NotificacionesContext } from './notificacionesContext';
import Notificaciones from '../components/Notificaciones';
import ModalConfirmacion from '../components/ModalConfirmacion';

// Duración de cada tipo de aviso en milisegundos; los errores quedan hasta cerrarlos.
const DURACION = { exito: 4000, advertencia: 6000, error: null };
const MAXIMO_VISIBLES = 3;

// Sistema común de avisos y confirmaciones; reemplaza alert() y confirm().
export function NotificacionesProvider({ children }) {
  const [avisos, setAvisos] = useState([]);
  const avisosRef = useRef([]);
  const temporizadores = useRef(new Map());
  const siguienteId = useRef(0);
  const [confirmacion, setConfirmacion] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const actualizar = useCallback((nuevos) => {
    avisosRef.current = nuevos;
    setAvisos(nuevos);
  }, []);

  const cerrar = useCallback(
    (id) => {
      clearTimeout(temporizadores.current.get(id));
      temporizadores.current.delete(id);
      actualizar(avisosRef.current.filter((aviso) => aviso.id !== id));
    },
    [actualizar]
  );

  const notificar = useCallback(
    ({ tipo = 'exito', mensaje }) => {
      // Una misma acción no muestra dos avisos iguales.
      if (
        avisosRef.current.some((a) => a.tipo === tipo && a.mensaje === mensaje)
      ) {
        return;
      }
      siguienteId.current += 1;
      const id = siguienteId.current;
      actualizar(
        [...avisosRef.current, { id, tipo, mensaje }].slice(-MAXIMO_VISIBLES)
      );
      if (DURACION[tipo]) {
        temporizadores.current.set(
          id,
          setTimeout(() => cerrar(id), DURACION[tipo])
        );
      }
    },
    [actualizar, cerrar]
  );

  // Devuelve el resultado de `accion` (o true) si se confirma, y false si se cancela.
  // Mientras `accion` se ejecuta, el cuadro sigue abierto y sus botones deshabilitados.
  const confirmar = useCallback(
    (opciones) =>
      new Promise((resolver, rechazar) => {
        setConfirmacion({ ...opciones, resolver, rechazar });
      }),
    []
  );

  async function handleConfirmar() {
    const { accion, resolver, rechazar } = confirmacion;
    if (!accion) {
      setConfirmacion(null);
      resolver(true);
      return;
    }
    setProcesando(true);
    try {
      const resultado = await accion();
      resolver(resultado === undefined ? true : resultado);
    } catch (error) {
      rechazar(error);
    } finally {
      setProcesando(false);
      setConfirmacion(null);
    }
  }

  function handleCancelar() {
    confirmacion.resolver(false);
    setConfirmacion(null);
  }

  useEffect(() => {
    const pendientes = temporizadores.current;
    return () =>
      pendientes.forEach((temporizador) => clearTimeout(temporizador));
  }, []);

  const valor = useMemo(
    () => ({ notificar, confirmar }),
    [notificar, confirmar]
  );

  return (
    <NotificacionesContext.Provider value={valor}>
      {children}
      <Notificaciones avisos={avisos} onCerrar={cerrar} />
      {confirmacion && (
        <ModalConfirmacion
          titulo={confirmacion.titulo}
          mensaje={confirmacion.mensaje}
          textoConfirmar={confirmacion.textoConfirmar}
          textoCancelar={confirmacion.textoCancelar}
          textoProcesando={confirmacion.textoProcesando}
          peligro={confirmacion.peligro}
          procesando={procesando}
          onConfirmar={handleConfirmar}
          onCancelar={handleCancelar}
        />
      )}
    </NotificacionesContext.Provider>
  );
}
