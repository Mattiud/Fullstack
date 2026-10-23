import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../context/useAuth';
import { listarMenores } from '../../api/menores';
import { mensajeDeError } from '../../api/client';
import { PERMISOS } from '../../constants/auth';
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
  Entrada,
  Tabla,
  TextoAyuda,
} from '../../components/ui';

// Pantalla 1e de los mockups. Las columnas de diagnóstico, sesión e informe se
// agregarán con sus módulos.

const Busqueda = styled(Entrada)`
  width: 230px;
  max-width: 100%;
`;

const Filtros = styled.div`
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
`;

const Filtro = styled.button`
  border: 1.5px solid
    ${({ theme, $activo }) => ($activo ? theme.colores.primario : '#8c8c8c')};
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 13.5px;
  background: ${({ theme }) => theme.colores.superficie};
  color: ${({ $activo }) => ($activo ? '#222222' : '#555555')};
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colores.primario};
    outline-offset: 2px;
  }
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

const BotonNuevo = styled(Boton).attrs({ as: Link })`
  text-decoration: none;
`;

const FILTROS = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'activos', etiqueta: 'Activos' },
];

export default function ListadoMenores() {
  const { tienePermiso } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [consulta, setConsulta] = useState({
    q: '',
    estado: 'todos',
    pagina: 1,
  });
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  // La búsqueda se envía tras una breve pausa al escribir.
  useEffect(() => {
    const espera = setTimeout(() => {
      setConsulta((anterior) =>
        anterior.q === busqueda
          ? anterior
          : { ...anterior, q: busqueda, pagina: 1 }
      );
    }, 300);
    return () => clearTimeout(espera);
  }, [busqueda]);

  useEffect(() => {
    let vigente = true;
    listarMenores(consulta)
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
  }, [consulta]);

  const totalPaginas = resultado
    ? Math.max(1, Math.ceil(resultado.total / resultado.limite))
    : 1;
  const filtrando = consulta.q || consulta.estado !== 'todos';

  return (
    <>
      <EncabezadoPagina
        titulo={
          <>
            Menores{' '}
            {resultado && (
              <TextoAyuda as="span">({resultado.total})</TextoAyuda>
            )}
          </>
        }
      >
        <Busqueda
          type="search"
          placeholder="Buscar por nombre o RUT"
          aria-label="Buscar por nombre o RUT"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
        />
        {tienePermiso(PERMISOS.EXPEDIENTES_ESCRIBIR) && (
          <BotonNuevo to="/menores/nuevo">+ Nuevo menor</BotonNuevo>
        )}
      </EncabezadoPagina>
      <CuerpoPagina>
        <Filtros role="group" aria-label="Filtrar por estado">
          {FILTROS.map(({ valor, etiqueta }) => (
            <Filtro
              key={valor}
              type="button"
              $activo={consulta.estado === valor}
              aria-pressed={consulta.estado === valor}
              onClick={() =>
                setConsulta((anterior) => ({
                  ...anterior,
                  estado: valor,
                  pagina: 1,
                }))
              }
            >
              {etiqueta}
            </Filtro>
          ))}
        </Filtros>

        {error && <Alerta role="alert">{error}</Alerta>}
        {!resultado && !error && (
          <Cargando role="status">Cargando menores…</Cargando>
        )}
        {resultado && resultado.menores.length === 0 && (
          <TextoAyuda as="p">
            {filtrando
              ? 'Ningún menor coincide con la búsqueda.'
              : 'Aún no hay menores registrados.'}
          </TextoAyuda>
        )}
        {resultado && resultado.menores.length > 0 && (
          <>
            <ContenedorTabla>
              <Tabla>
                <thead>
                  <tr>
                    <th scope="col">Menor</th>
                    <th scope="col">Edad</th>
                    <th scope="col">Apoderado</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.menores.map((menor) => (
                    <tr key={menor._id}>
                      <td>
                        <EnlaceMenor to={`/menores/${menor._id}`}>
                          {menor.nombre}
                        </EnlaceMenor>
                      </td>
                      <td>{menor.edad}</td>
                      <td>{menor.apoderado?.nombre ?? '—'}</td>
                      <td>
                        <Chip>{menor.activo ? 'Activo' : 'Inactivo'}</Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            </ContenedorTabla>
            <Pie>
              <span>
                Mostrando {resultado.menores.length} de {resultado.total}
              </span>
              <Paginas>
                <BotonPequeno
                  type="button"
                  $variante="secundario"
                  aria-label="Página anterior"
                  disabled={consulta.pagina <= 1}
                  onClick={() =>
                    setConsulta((a) => ({ ...a, pagina: a.pagina - 1 }))
                  }
                >
                  ‹
                </BotonPequeno>
                <span>
                  {consulta.pagina} / {totalPaginas}
                </span>
                <BotonPequeno
                  type="button"
                  $variante="secundario"
                  aria-label="Página siguiente"
                  disabled={consulta.pagina >= totalPaginas}
                  onClick={() =>
                    setConsulta((a) => ({ ...a, pagina: a.pagina + 1 }))
                  }
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
