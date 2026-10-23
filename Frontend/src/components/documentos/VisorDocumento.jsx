import { Suspense, lazy, useEffect, useState } from 'react';
import styled from 'styled-components';
import { obtenerVistaDocumento } from '../../api/menores';
import { mensajeDeError } from '../../api/client';
import { Alerta, Cargando } from '../ui';

// pdf.js solo se descarga cuando se abre un PDF.
const VisorPdf = lazy(() => import('./VisorPdf'));

const Marco = styled.div`
  height: ${({ $alto }) => $alto};
  overflow: auto;
  background: #f5e6ec;
  padding: 12px;
  border-radius: ${({ theme }) => theme.radio};
`;

const MarcoHtml = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  background: #ffffff;
`;

// El HTML del documento se muestra en un iframe aislado: sin scripts, sin acceso a
// la aplicación y sin recursos externos (solo imágenes incrustadas).
function paginaHtml(html) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<style>body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;color:#2b2328;margin:24px;line-height:1.5}
img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #c9c9c7;padding:4px 8px}</style>
</head><body>${html}</body></html>`;
}

export default function VisorDocumento({ menorId, documento, alto = '560px' }) {
  const [vista, setVista] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    setVista(null);
    setError('');
    obtenerVistaDocumento(menorId, documento._id)
      .then((datos) => {
        if (vigente) setVista(datos);
      })
      .catch((err) => {
        if (vigente)
          setError(mensajeDeError(err, 'No se pudo abrir el documento'));
      });
    return () => {
      vigente = false;
    };
  }, [menorId, documento._id]);

  if (error) return <Alerta role="alert">{error}</Alerta>;
  if (!vista) return <Cargando role="status">Abriendo documento…</Cargando>;

  return (
    <Marco $alto={alto}>
      {vista.formato === 'pdf' ? (
        <Suspense fallback={<Cargando role="status">Cargando visor…</Cargando>}>
          <VisorPdf datos={vista.datos} />
        </Suspense>
      ) : (
        <MarcoHtml
          title={`Contenido de ${documento.nombreOriginal}`}
          sandbox=""
          srcDoc={paginaHtml(vista.html)}
        />
      )}
    </Marco>
  );
}
