import { useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { formatearTamano } from '../../utils/formato';
import { BotonPequeno, TextoAyuda } from '../ui';

const Zona = styled.div`
  border: 1.5px dashed
    ${({ theme, $activa }) => ($activa ? theme.colores.primario : '#b5b5b5')};
  background: ${({ theme, $activa }) =>
    $activa
      ? theme.colores.lateral
      : 'repeating-linear-gradient(45deg, #ececec, #ececec 5px, #f7f7f6 5px, #f7f7f6 11px)'};
  border-radius: ${({ theme }) => theme.radio};
  padding: 18px;
  display: grid;
  justify-items: center;
  gap: 8px;
  text-align: center;
  color: #6b6b6b;
`;

// Zona "arrastrar archivos aquí" del mockup 1f, con selector de archivo accesible.
export default function ZonaCarga({ limites, subiendo, progreso, onArchivo }) {
  const id = useId();
  const entradaRef = useRef(null);
  const [activa, setActiva] = useState(false);

  function recibir(archivos) {
    const [archivo] = archivos;
    if (archivo) onArchivo(archivo);
    if (entradaRef.current) entradaRef.current.value = '';
  }

  return (
    <Zona
      $activa={activa}
      onDragOver={(evento) => {
        evento.preventDefault();
        setActiva(true);
      }}
      onDragLeave={() => setActiva(false)}
      onDrop={(evento) => {
        evento.preventDefault();
        setActiva(false);
        if (!subiendo) recibir(evento.dataTransfer.files);
      }}
    >
      {subiendo ? (
        <span role="status">Subiendo documento… {progreso}%</span>
      ) : (
        <>
          <span>Arrastrar archivos aquí</span>
          <BotonPequeno
            type="button"
            $variante="secundario"
            onClick={() => entradaRef.current?.click()}
          >
            Seleccionar archivo
          </BotonPequeno>
        </>
      )}
      <input
        ref={entradaRef}
        id={id}
        type="file"
        hidden
        aria-label="Adjuntar documento"
        accept={[...limites.extensiones, ...limites.mimes].join(',')}
        onChange={(evento) => recibir(evento.target.files)}
      />
      <TextoAyuda>
        PDF, DOC o DOCX · máximo {formatearTamano(limites.maxBytes)}
      </TextoAyuda>
    </Zona>
  );
}
