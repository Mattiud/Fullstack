import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { listarInformes } from '../../api/informes';
import { mensajeDeError } from '../../api/client';
import { estadoInforme } from '../../constants/informes';
import { formatearDia, formatearFecha } from '../../utils/formato';
import EncabezadoPagina, {
  CuerpoPagina,
} from '../../components/EncabezadoPagina';
import {
  Alerta,
  Boton,
  BotonPequeno,
  Cargando,
  Chip,
  ContenedorTabla,
  Tabla,
  TextoAyuda,
} from '../../components/ui';

// Listado general de informes psicopedagógicos. El backend devuelve solo los de los
// menores a los que el profesional tiene acceso, sin el contenido de los informes.

const BotonEnlazado = styled(Boton).attrs({ as: Link })`
  text-decoration: none;
`;

const EnlaceMenor = styled(Link)`
  font-weight: 700;
  color: inherit;
`;

const Pie = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  color: #777777;
`;

const Paginas = styled.div`
  display: flex;
  gap: 8px;
`;

export default function ListadoInformes() {
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    listarInformes({ pagina })
      .then((datos) => {
        if (!vigente) return;
        setResultado(datos);
        setError('');
      })
      .catch((err) => {
        if (vigente)
          setError(mensajeDeError(err, 'No se pudo cargar el listado'));
      });
    return () => {
      vigente = false;
    };
  }, [pagina]);

  const totalPaginas = resultado
    ? Math.max(1, Math.ceil(resultado.total / resultado.limite))
    : 1;

  return (
    <>
      <EncabezadoPagina
        titulo={
          <>
            Informes{' '}
            {resultado && (
              <TextoAyuda as="span">({resultado.total})</TextoAyuda>
            )}
          </>
        }
      >
        <BotonEnlazado to="/informes/nuevo">+ Nuevo informe</BotonEnlazado>
      </EncabezadoPagina>
      <CuerpoPagina>
        {error && <Alerta role="alert">{error}</Alerta>}
        {!resultado && !error && (
          <Cargando role="status">Cargando informes…</Cargando>
        )}
        {resultado?.informes.length === 0 && (
          <TextoAyuda as="p">Aún no hay informes registrados.</TextoAyuda>
        )}
        {resultado?.informes.length > 0 && (
          <>
            <ContenedorTabla>
              <Tabla>
                <thead>
                  <tr>
                    <th scope="col">Menor</th>
                    <th scope="col">Fecha del informe</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Última modificación</th>
                    <th scope="col">Profesional</th>
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.informes.map((informe) => (
                    <tr key={informe._id}>
                      <td>
                        <EnlaceMenor
                          to={`/menores/${informe.menor._id}?pestana=informes`}
                        >
                          {informe.menor.nombre}
                        </EnlaceMenor>
                      </td>
                      <td>{formatearDia(informe.fechaInforme)}</td>
                      <td>
                        <Chip>{estadoInforme(informe)}</Chip>
                      </td>
                      <td>{formatearFecha(informe.contenidoActualizadoEn)}</td>
                      <td>{informe.creadoPor?.nombre ?? '—'}</td>
                      <td>
                        <Link
                          to={`/menores/${informe.menor._id}/informes/${informe._id}`}
                          aria-label={`Abrir informe de ${informe.menor.nombre} del ${formatearDia(informe.fechaInforme)}`}
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            </ContenedorTabla>
            <Pie>
              <span>
                Mostrando {resultado.informes.length} de {resultado.total}
              </span>
              <Paginas>
                <BotonPequeno
                  type="button"
                  $variante="secundario"
                  aria-label="Página anterior"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => p - 1)}
                >
                  ‹
                </BotonPequeno>
                <span>
                  {pagina} / {totalPaginas}
                </span>
                <BotonPequeno
                  type="button"
                  $variante="secundario"
                  aria-label="Página siguiente"
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  ›
                </BotonPequeno>
              </Paginas>
            </Pie>
          </>
        )}
      </CuerpoPagina>
    </>
  );
}
