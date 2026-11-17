import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../context/useAuth';
import { listarDiagnosticos } from '../../api/diagnosticos';
import { mensajeDeError } from '../../api/client';
import { PERMISOS } from '../../constants/auth';
import {
  ESTADOS_DIAGNOSTICO,
  NOMBRES_ESTADOS_DIAGNOSTICO,
  etiquetaVersion,
} from '../../constants/diagnosticos';
import { formatearDia, formatearFecha } from '../../utils/formato';
import EncabezadoPagina, {
  CuerpoPagina,
} from '../../components/EncabezadoPagina';
import ModalDiagnostico from '../../components/diagnosticos/ModalDiagnostico';
import TipoDiagnostico from '../../components/diagnosticos/TipoDiagnostico';
import {
  Alerta,
  Boton,
  BotonFiltro,
  BotonIcono,
  Cargando,
  Chip,
  ContenedorTabla,
  Tabla,
  TextoAyuda,
} from '../../components/ui';
import Icono from '../../components/Icono';

// Listado general de diagnósticos. El backend devuelve solo los de los menores a los
// que el usuario tiene acceso.

const Filtros = styled.div`
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
`;

const EnlaceMenor = styled(Link)`
  font-weight: 700;
  color: inherit;
`;

const Autor = styled.span`
  display: block;
  color: #777777;
  font-size: 13.5px;
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
  align-items: center;
`;

const FILTROS = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: ESTADOS_DIAGNOSTICO.VIGENTE, etiqueta: 'Vigentes' },
  { valor: ESTADOS_DIAGNOSTICO.BORRADOR, etiqueta: 'Borradores' },
];

export default function ListadoDiagnosticos() {
  const { tienePermiso } = useAuth();
  const navigate = useNavigate();
  const [consulta, setConsulta] = useState({ estado: 'todos', pagina: 1 });
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [registrando, setRegistrando] = useState(false);

  useEffect(() => {
    let vigente = true;
    listarDiagnosticos(consulta)
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

  return (
    <>
      <EncabezadoPagina
        titulo={
          <>
            Diagnósticos{' '}
            {resultado && (
              <TextoAyuda as="span">({resultado.total})</TextoAyuda>
            )}
          </>
        }
      >
        {tienePermiso(PERMISOS.DIAGNOSTICOS_EDITAR) && (
          <Boton type="button" onClick={() => setRegistrando(true)}>
            <Icono nombre="agregar" />
            Nuevo diagnóstico
          </Boton>
        )}
      </EncabezadoPagina>
      <CuerpoPagina>
        <Filtros role="group" aria-label="Filtrar por estado">
          {FILTROS.map(({ valor, etiqueta }) => (
            <BotonFiltro
              key={valor}
              type="button"
              $activo={consulta.estado === valor}
              aria-pressed={consulta.estado === valor}
              onClick={() => setConsulta({ estado: valor, pagina: 1 })}
            >
              {etiqueta}
            </BotonFiltro>
          ))}
        </Filtros>

        {error && <Alerta role="alert">{error}</Alerta>}
        {!resultado && !error && (
          <Cargando role="status">Cargando diagnósticos…</Cargando>
        )}
        {resultado && resultado.diagnosticos.length === 0 && (
          <TextoAyuda as="p">
            {consulta.estado === 'todos'
              ? 'Aún no hay diagnósticos registrados.'
              : 'Ningún diagnóstico coincide con el filtro.'}
          </TextoAyuda>
        )}
        {resultado && resultado.diagnosticos.length > 0 && (
          <>
            <ContenedorTabla>
              <Tabla>
                <thead>
                  <tr>
                    <th scope="col">Menor</th>
                    <th scope="col">Tipo de diagnóstico</th>
                    <th scope="col">Fecha de evaluación</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Versión</th>
                    <th scope="col">Última modificación</th>
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.diagnosticos.map((diagnostico) => (
                    <tr key={diagnostico._id}>
                      <td>
                        <EnlaceMenor to={`/menores/${diagnostico.menor._id}`}>
                          {diagnostico.menor.nombre}
                        </EnlaceMenor>
                      </td>
                      <td>
                        <TipoDiagnostico diagnostico={diagnostico} />
                      </td>
                      <td>{formatearDia(diagnostico.fechaEvaluacion)}</td>
                      <td>
                        <Chip>
                          {NOMBRES_ESTADOS_DIAGNOSTICO[diagnostico.estado]}
                        </Chip>
                      </td>
                      <td>{etiquetaVersion(diagnostico)}</td>
                      <td>
                        {formatearFecha(diagnostico.updatedAt)}
                        <Autor>{diagnostico.actualizadoPor?.nombre}</Autor>
                      </td>
                      <td>
                        <Link
                          to={`/menores/${diagnostico.menor._id}/diagnosticos/${diagnostico._id}`}
                          aria-label={`Ver diagnóstico de ${diagnostico.menor.nombre}`}
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            </ContenedorTabla>
            <Pie>
              <span>
                Mostrando {resultado.diagnosticos.length} de {resultado.total}
              </span>
              <Paginas>
                <BotonIcono
                  $pequeno
                  type="button"
                  $variante="secundario"
                  aria-label="Página anterior"
                  disabled={consulta.pagina <= 1}
                  onClick={() =>
                    setConsulta((a) => ({ ...a, pagina: a.pagina - 1 }))
                  }
                >
                  <Icono nombre="anterior" />
                </BotonIcono>
                <span>
                  {consulta.pagina} / {totalPaginas}
                </span>
                <BotonIcono
                  $pequeno
                  type="button"
                  $variante="secundario"
                  aria-label="Página siguiente"
                  disabled={consulta.pagina >= totalPaginas}
                  onClick={() =>
                    setConsulta((a) => ({ ...a, pagina: a.pagina + 1 }))
                  }
                >
                  <Icono nombre="siguiente" />
                </BotonIcono>
              </Paginas>
            </Pie>
          </>
        )}
      </CuerpoPagina>
      {registrando && (
        <ModalDiagnostico
          onCerrar={() => setRegistrando(false)}
          onGuardado={(diagnostico, mensaje) =>
            navigate(
              `/menores/${diagnostico.menor._id}/diagnosticos/${diagnostico._id}`,
              { state: { aviso: mensaje } }
            )
          }
        />
      )}
    </>
  );
}
