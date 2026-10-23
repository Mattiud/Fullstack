import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Alerta, TextoAyuda } from '../ui';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const Paginas = styled.div`
  display: grid;
  justify-items: center;
  gap: 12px;

  canvas {
    max-width: 100%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    background: #ffffff;
  }
`;

// Dibuja el PDF almacenado en canvas con pdf.js. La API no ejecuta los scripts
// que pueda contener el documento; además se desactiva la evaluación dinámica.
export default function VisorPdf({ datos }) {
  const contenedorRef = useRef(null);
  const [estado, setEstado] = useState({ cargando: true, error: '' });

  useEffect(() => {
    let cancelado = false;
    // pdf.js transfiere el buffer al worker: se entrega una copia.
    const tarea = pdfjs.getDocument({
      data: new Uint8Array(datos.slice(0)),
      isEvalSupported: false,
      enableXfa: false,
    });

    (async () => {
      try {
        const documento = await tarea.promise;
        const contenedor = contenedorRef.current;
        if (cancelado || !contenedor) return;
        contenedor.replaceChildren();
        const ancho = Math.max(contenedor.clientWidth - 16, 320);
        const densidad = window.devicePixelRatio || 1;

        for (let numero = 1; numero <= documento.numPages; numero += 1) {
          const pagina = await documento.getPage(numero);
          if (cancelado) return;
          const escala = Math.min(
            2,
            ancho / pagina.getViewport({ scale: 1 }).width
          );
          const viewport = pagina.getViewport({ scale: escala * densidad });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / densidad}px`;
          canvas.setAttribute('role', 'img');
          canvas.setAttribute(
            'aria-label',
            `Página ${numero} de ${documento.numPages}`
          );
          contenedor.appendChild(canvas);
          await pagina.render({
            canvas,
            canvasContext: canvas.getContext('2d'),
            viewport,
          }).promise;
        }
        if (!cancelado) setEstado({ cargando: false, error: '' });
      } catch {
        if (!cancelado) {
          setEstado({
            cargando: false,
            error:
              'No se pudo mostrar el PDF. Es posible que el archivo esté dañado.',
          });
        }
      }
    })();

    return () => {
      cancelado = true;
      tarea.destroy();
    };
  }, [datos]);

  return (
    <>
      {estado.cargando && (
        <TextoAyuda role="status">Preparando el documento…</TextoAyuda>
      )}
      {estado.error && <Alerta role="alert">{estado.error}</Alerta>}
      <Paginas ref={contenedorRef} />
    </>
  );
}
