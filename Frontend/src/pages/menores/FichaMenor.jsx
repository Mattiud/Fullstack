import { useEffect, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../context/useAuth';
import { useNotificaciones } from '../../context/useNotificaciones';
import { formatearRut } from '../../utils/rut';
import {
  cambiarEstadoMenor,
  listarDocumentos,
  obtenerMenor,
} from '../../api/menores';
import { mensajeDeError } from '../../api/client';
import { PERMISOS } from '../../constants/auth';
import { formatearDia, iniciales } from '../../utils/formato';
import EncabezadoPagina, {
  CuerpoPagina,
} from '../../components/EncabezadoPagina';
import DocumentosMenor from '../../components/documentos/DocumentosMenor';
import ProfesionalesAsignados from '../../components/menores/ProfesionalesAsignados';
import HistorialMenor from '../../components/menores/HistorialMenor';
import {
  Alerta,
  Boton,
  Cargando,
  Chip,
  CuerpoPanel,
  EncabezadoPanel,
  Panel,
  TituloSeccion,
} from '../../components/ui';

// Pantalla 1f de los mockups. Las pestañas de diagnósticos, sesiones e informes se
// agregarán con sus módulos.

const Cabecera = styled.header`
  padding: 14px 20px;
  border-bottom: 2px solid ${({ theme }) => theme.colores.primario};
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: center;
`;

const Migas = styled(Link)`
  color: #777777;
  font-size: 14px;
`;

const Avatar = styled.span`
  width: 52px;
  height: 52px;
  border: 2px solid ${({ theme }) => theme.colores.primario};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  flex: none;
`;

const Identidad = styled.div`
  flex: 1;
  min-width: 200px;

  h1 {
    margin: 0;
    font-size: 21px;
  }
`;

const Resumen = styled.p`
  margin: 0;
  color: #777777;
`;

const Acciones = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const BotonEnlazado = styled(Boton).attrs({ as: Link })`
  text-decoration: none;
`;

const Pestanas = styled.div`
  padding: 0 20px;
  border-bottom: 2px solid ${({ theme }) => theme.colores.primario};
  display: flex;
  gap: 20px;
  overflow-x: auto;
`;

const Pestana = styled.button`
  padding: 11px 2px;
  border: none;
  border-bottom: 4px solid
    ${({ theme, $activa }) => ($activa ? theme.colores.primario : 'transparent')};
  background: none;
  color: ${({ $activa }) => ($activa ? 'inherit' : '#666666')};
  font-weight: ${({ $activa }) => ($activa ? 700 : 400)};
  cursor: pointer;
  white-space: nowrap;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colores.primario};
  }
`;

const Columnas = styled.div`
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  align-items: start;
`;

const Datos = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px 20px;

  dt {
    color: #777777;
    font-size: 13.5px;
  }

  dd {
    margin: 0;
  }
`;

const Texto = styled.p`
  margin: 0;
  white-space: pre-wrap;
`;

function Dato({ etiqueta, children }) {
  return (
    <div>
      <dt>{etiqueta}</dt>
      <dd>{children || '—'}</dd>
    </div>
  );
}

const PESTANAS = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'documentos', etiqueta: 'Documentos' },
  { id: 'historial', etiqueta: 'Historial', permiso: PERMISOS.HISTORIAL_LEER },
];

export default function FichaMenor() {
  const { menorId } = useParams();
  const location = useLocation();
  const [parametros, setParametros] = useSearchParams();
  const { tienePermiso } = useAuth();
  const [menor, setMenor] = useState(null);
  const [documentos, setDocumentos] = useState(null);
  const [error, setError] = useState('');
  const { notificar, confirmar } = useNotificaciones();
  const navigate = useNavigate();
  // Se incrementa con cada cambio para refrescar el historial.
  const [version, setVersion] = useState(0);

  // Aviso enviado por el formulario al guardar: se muestra una vez y se descarta
  // del historial del navegador para que no se repita al recargar.
  const avisoRecibido = location.state?.aviso;
  useEffect(() => {
    if (!avisoRecibido) return;
    notificar({ tipo: 'exito', mensaje: avisoRecibido });
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [avisoRecibido, notificar, navigate, location.pathname, location.search]);

  const puedeEditar = tienePermiso(PERMISOS.EXPEDIENTES_ESCRIBIR);
  const pestanas = PESTANAS.filter(
    (p) => !p.permiso || tienePermiso(p.permiso)
  );
  const pestana = pestanas.some((p) => p.id === parametros.get('pestana'))
    ? parametros.get('pestana')
    : 'resumen';

  useEffect(() => {
    let vigente = true;
    setMenor(null);
    setError('');
    Promise.all([obtenerMenor(menorId), listarDocumentos(menorId)])
      .then(([datosMenor, datosDocumentos]) => {
        if (!vigente) return;
        setMenor(datosMenor);
        setDocumentos(datosDocumentos);
      })
      .catch((err) => {
        if (vigente)
          setError(mensajeDeError(err, 'No se pudo cargar el expediente'));
      });
    return () => {
      vigente = false;
    };
  }, [menorId]);

  function actualizar(menorActualizado, mensaje) {
    setMenor(menorActualizado);
    setVersion((v) => v + 1);
    if (mensaje) notificar({ tipo: 'exito', mensaje });
  }

  async function handleEstado() {
    try {
      if (menor.activo) {
        const actualizado = await confirmar({
          titulo: 'Desactivar ficha',
          mensaje: `La ficha de ${menor.nombre} quedará inactiva. Sus datos se conservarán y podrá reactivarse.`,
          textoConfirmar: 'Desactivar',
          textoProcesando: 'Desactivando…',
          accion: () => cambiarEstadoMenor(menor._id, false),
        });
        if (actualizado)
          actualizar(actualizado, 'Ficha desactivada correctamente');
      } else {
        actualizar(
          await cambiarEstadoMenor(menor._id, true),
          'Ficha reactivada correctamente'
        );
      }
    } catch (err) {
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(
          err,
          'No fue posible cambiar el estado de la ficha'
        ),
      });
    }
  }

  if (error) {
    return (
      <>
        <EncabezadoPagina titulo="Expediente no disponible" />
        <CuerpoPagina>
          <Alerta role="alert">{error}</Alerta>
          <Link to="/menores">Volver al listado de menores</Link>
        </CuerpoPagina>
      </>
    );
  }

  if (!menor || !documentos) {
    return <Cargando role="status">Cargando expediente…</Cargando>;
  }

  const resumen = [
    menor.curso,
    menor.apoderado && `Apoderado: ${menor.apoderado.nombre}`,
    menor.apoderado?.telefono,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <Cabecera>
        <Migas to="/menores">Menores ›</Migas>
        <Avatar aria-hidden="true">{iniciales(menor.nombre)}</Avatar>
        <Identidad>
          <h1>
            {menor.nombre} · {menor.edad} años
          </h1>
          <Resumen>{resumen}</Resumen>
        </Identidad>
        {!menor.activo && <Chip>Inactivo</Chip>}
        {puedeEditar && (
          <Acciones>
            <BotonEnlazado
              to={`/menores/${menor._id}/editar`}
              $variante="secundario"
            >
              Editar ficha
            </BotonEnlazado>
            <Boton
              type="button"
              $variante={menor.activo ? 'peligro' : 'secundario'}
              onClick={handleEstado}
            >
              {menor.activo ? 'Desactivar' : 'Reactivar'}
            </Boton>
          </Acciones>
        )}
      </Cabecera>

      <Pestanas role="tablist" aria-label="Secciones del expediente">
        {pestanas.map((p) => (
          <Pestana
            key={p.id}
            type="button"
            role="tab"
            id={`pestana-${p.id}`}
            aria-selected={pestana === p.id}
            aria-controls={`panel-${p.id}`}
            $activa={pestana === p.id}
            onClick={() => setParametros({ pestana: p.id }, { replace: true })}
          >
            {p.etiqueta}
            {p.id === 'documentos' && ` (${documentos.documentos.length})`}
          </Pestana>
        ))}
      </Pestanas>

      <CuerpoPagina
        role="tabpanel"
        id={`panel-${pestana}`}
        aria-labelledby={`pestana-${pestana}`}
      >
        {pestana === 'resumen' && (
          <Columnas>
            <Panel aria-labelledby="titulo-antecedentes">
              <EncabezadoPanel>
                <TituloSeccion id="titulo-antecedentes">
                  Antecedentes
                </TituloSeccion>
              </EncabezadoPanel>
              <CuerpoPanel>
                <Datos>
                  <Dato etiqueta="Fecha de nacimiento">
                    {formatearDia(menor.fechaNacimiento)}
                  </Dato>
                  <Dato etiqueta="RUT">{formatearRut(menor.rut)}</Dato>
                  <Dato etiqueta="Establecimiento">
                    {menor.establecimiento}
                  </Dato>
                  <Dato etiqueta="Curso">{menor.curso}</Dato>
                  <Dato etiqueta="Apoderado">
                    {menor.apoderado &&
                      `${menor.apoderado.nombre} (${menor.apoderado.parentesco})`}
                  </Dato>
                  <Dato etiqueta="Teléfono del apoderado">
                    {menor.apoderado?.telefono}
                  </Dato>
                  <Dato etiqueta="Ingreso">
                    {formatearDia(menor.fechaIngreso)}
                  </Dato>
                </Datos>
              </CuerpoPanel>
            </Panel>
            <Panel aria-labelledby="titulo-relevantes">
              <EncabezadoPanel>
                <TituloSeccion id="titulo-relevantes">
                  Antecedentes relevantes
                </TituloSeccion>
              </EncabezadoPanel>
              <CuerpoPanel>
                <Texto>{menor.antecedentesRelevantes}</Texto>
              </CuerpoPanel>
            </Panel>
            <ProfesionalesAsignados
              menor={menor}
              puedeAsignar={tienePermiso(PERMISOS.EXPEDIENTES_ASIGNAR)}
              onActualizado={(m) =>
                actualizar(
                  m,
                  'Profesionales asignados actualizados correctamente'
                )
              }
            />
          </Columnas>
        )}

        {pestana === 'documentos' && (
          <DocumentosMenor
            menorId={menor._id}
            documentos={documentos.documentos}
            limites={documentos.limites}
            puedeEditar={puedeEditar}
            onAgregado={(documento) => {
              setDocumentos((d) => ({
                ...d,
                documentos: [documento, ...d.documentos],
              }));
              setVersion((v) => v + 1);
            }}
            onEliminado={(id) => {
              setDocumentos((d) => ({
                ...d,
                documentos: d.documentos.filter((doc) => doc._id !== id),
              }));
              setVersion((v) => v + 1);
            }}
          />
        )}

        {pestana === 'historial' && (
          <HistorialMenor menorId={menor._id} version={version} />
        )}
      </CuerpoPagina>
    </>
  );
}
