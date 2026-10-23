import { useLayoutEffect, useRef } from 'react';
import CampoFormulario from './CampoFormulario';
import {
  formatearRut,
  limpiarRut,
  posicionTrasSignificativos,
} from '../utils/rut';

// Campo de RUT que se formatea mientras se escribe (21.291.454-1) sin mover el
// cursor de lugar. Entrega a onChange el valor ya formateado.
export default function CampoRut({ name, value, onChange, ...props }) {
  const entradaRef = useRef(null);
  // Caracteres significativos que deben quedar a la izquierda del cursor.
  const cursorRef = useRef(null);

  useLayoutEffect(() => {
    if (cursorRef.current === null || !entradaRef.current) return;
    const posicion = posicionTrasSignificativos(value, cursorRef.current);
    entradaRef.current.setSelectionRange(posicion, posicion);
    cursorRef.current = null;
  });

  function emitir(texto, significativosAntes) {
    cursorRef.current = significativosAntes;
    onChange({ target: { name, value: formatearRut(texto) } });
  }

  function handleChange(evento) {
    const { value: texto, selectionStart } = evento.target;
    emitir(texto, limpiarRut(texto.slice(0, selectionStart)).length);
  }

  // Retroceso justo después de un punto o guion: borra el dígito anterior, para
  // que el separador no impida seguir borrando.
  function handleKeyDown(evento) {
    const { selectionStart, selectionEnd, value: texto } = evento.target;
    if (evento.key !== 'Backspace' || selectionStart !== selectionEnd) return;
    if (!['.', '-'].includes(texto[selectionStart - 1])) return;
    evento.preventDefault();
    const antes = limpiarRut(texto.slice(0, selectionStart)).length;
    if (antes === 0) return;
    const limpio = limpiarRut(texto);
    emitir(limpio.slice(0, antes - 1) + limpio.slice(antes), antes - 1);
  }

  return (
    <CampoFormulario
      ref={entradaRef}
      name={name}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      inputMode="text"
      maxLength={12}
      autoComplete="off"
      placeholder="12.345.678-5"
      {...props}
    />
  );
}
