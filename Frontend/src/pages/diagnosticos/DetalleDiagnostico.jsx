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
import { obtenerDiagnostico } from '../../api/diagnosticos';
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
import Icono from '../../components/Icono';
import {
  Alerta,
  Boton,
  BotonAccion,
  BotonEnlace,
  Cargando,
  Chip,
  CuerpoPanel,
  EncabezadoPanel,
  Panel,
  TextoAyuda,
  TituloSeccion,
} from '../../components/ui';

// Detalle de un diagnóstico con sus versiones anteriores, que se consultan en modo de
// solo lectura (?version=n).

const Migas = styled.nav`
  padding: 12px 20px 0;
  color: #777777;
  font-size: 14px;

  a {
    color: inherit;
  }
`;

const AvisoVersion = styled.div`
  padding: 9px 12px;
  border-radius: 4px;
  border: 1.5px solid ${({ theme }) => theme.colores.bordeTarjeta};
  background: ${({ theme }) => theme.colores.lateral};
`;

const Columnas = styled.div`
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
  align-items: start;

  @media (max-width: ${({ theme }) => theme.movil}) {
    grid-template-columns: 1fr;
  }
`;

const Chips = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Datos = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px 20px;

  dt {
    color: #777777;
    font-size: 13.5px;
  }

  dd {
    margin: 0;
  }
`;

const DatoAncho = styled.div`
  grid-column: 1 / -1;
`;

const Texto = styled.dd`
  white-space: pre-wrap;
`;

const Versiones = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;

  li {
    display: grid;
    gap: 2px;
  }
`;

const Detalle = styled.span`
  color: #777777;
  font-size: 13.5px;
`;

function Dato({ etiqueta, children }) {
  return (
    <div>
      <dt>{etiqueta}</dt>
      <dd>{children || '—'}</dd>
    </div>
  );
}

export default function DetalleDiagnostico() {
  const { menorId, diagnosticoId } = useParams();
  const [parametros, setParametros] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();
  const { notificar } = useNotificaciones();
  const [diagnostico, setDiagnostico] = useState(null);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(false);

  // Aviso enviado al registrar desde el listado: se muestra una sola vez.
  const avisoRecibido = location.state?.aviso;
  useEffect(() => {
    if (!avisoRecibido) return;
    notificar({ tipo: 'exito', mensaje: avisoRecibido });
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [avisoRecibido, notificar, navigate, location.pathname, location.search]);

  useEffect(() => {
    let vigente = true;
    setDiagnostico(null);
    setError('');
    obtenerDiagnostico(menorId, diagnosticoId)
      .then((datos) => {
        if (vigente) setDiagnostico(datos);
      })
      .catch((err) => {
        if (vigente)
          setError(mensajeDeError(err, 'No se pudo cargar el diagnóstico'));
      });
    return () => {
      vigente = false;
    };
  }, [menorId, diagnosticoId]);

  if (error) {
    return (
      <>
        <EncabezadoPagina titulo="Diagnóstico no disponible" />
        <CuerpoPagina>
          <Alerta role="alert">{error}</Alerta>
          <Link to="/diagnosticos">Volver al listado de diagnósticos</Link>
        </CuerpoPagina>
      </>
    );
  }

  if (!diagnostico) {
    return <Cargando role="status">Cargando diagnóstico…</Cargando>;
  }

  // Versión anterior elegida, o la actual.
  const numeroElegido = Number(parametros.get('version'));
  const anterior = diagnostico.versiones.find(
    (v) => v.version === numeroElegido
  );
  const mostrado = anterior ?? diagnostico;
  const autor = anterior ? anterior.registradoPor : diagnostico.actualizadoPor;
  const fecha = anterior ? anterior.fecha : diagnostico.updatedAt;
  const esBorrador = diagnostico.estado === ESTADOS_DIAGNOSTICO.BORRADOR;
  const puedeEditar = tienePermiso(PERMISOS.DIAGNOSTICOS_EDITAR) && !anterior;
  const versiones = [
    ...(esBorrador
      ? []
      : [
          {
            version: diagnostico.version,
            registradoPor: diagnostico.actualizadoPor,
            fecha: diagnostico.updatedAt,
            actual: true,
          },
        ]),
    ...[...diagnostico.versiones].reverse(),
  ];

  function verVersion(numero) {
    setParametros(numero ? { version: String(numero) } : {}, { replace: true });
  }

  return (
    <>
      <Migas aria-label="Ruta">
        <Link to="/menores">Menores</Link> ›{' '}
        <Link to={`/menores/${menorId}?pestana=diagnosticos`}>
          {diagnostico.menor.nombre}
        </Link>{' '}
        › Diagnóstico
      </Migas>
      <EncabezadoPagina
        titulo={`${mostrado.tipo || 'Diagnóstico sin tipo'} — ${diagnostico.menor.nombre}`}
      >
        <Chips>
          <Chip>
            {anterior
              ? 'Versión anterior'
              : NOMBRES_ESTADOS_DIAGNOSTICO[diagnostico.estado]}
          </Chip>
          <Chip>
            {anterior ? `v${anterior.version}` : etiquetaVersion(diagnostico)}
          </Chip>
        </Chips>
        {puedeEditar && (
          <Boton
            type="button"
            $variante="edicion"
            onClick={() => setEditando(true)}
          >
            <Icono nombre="editar" />
            {esBorrador ? 'Continuar borrador' : 'Editar'}
          </Boton>
        )}
      </EncabezadoPagina>
      <CuerpoPagina>
        {anterior && (
          <AvisoVersion role="status">
            Está viendo la versión v{anterior.version}, reemplazada por una
            posterior.{' '}
            <BotonEnlace type="button" onClick={() => verVersion(null)}>
              Ver la versión actual
            </BotonEnlace>
          </AvisoVersion>
        )}
        <Columnas>
          <Panel aria-labelledby="titulo-diagnostico">
            <EncabezadoPanel>
              <TituloSeccion id="titulo-diagnostico">Diagnóstico</TituloSeccion>
            </EncabezadoPanel>
            <CuerpoPanel>
              <Datos>
                <Dato etiqueta="Tipo de diagnóstico">
                  {mostrado.tipo && (
                    <TipoDiagnostico diagnostico={mostrado} detallado />
                  )}
                </Dato>
                <Dato etiqueta="Fecha de evaluación">
                  {mostrado.fechaEvaluacion &&
                    formatearDia(mostrado.fechaEvaluacion)}
                </Dato>
                <Dato etiqueta="Instrumento aplicado">
                  {mostrado.instrumento}
                </Dato>
                <Dato etiqueta="Registrado por">
                  {autor?.nombre &&
                    `${autor.nombre} · ${formatearFecha(fecha)}`}
                </Dato>
                <DatoAncho>
                  <dt>Áreas afectadas</dt>
                  <dd>
                    {mostrado.areasAfectadas?.length > 0 ? (
                      <Chips>
                        {mostrado.areasAfectadas.map((area) => (
                          <Chip key={area}>{area}</Chip>
                        ))}
                      </Chips>
                    ) : (
                      '—'
                    )}
                  </dd>
                </DatoAncho>
                <DatoAncho>
                  <dt>Descripción y hallazgos</dt>
                  <Texto>{mostrado.descripcion || '—'}</Texto>
                </DatoAncho>
              </Datos>
            </CuerpoPanel>
          </Panel>

          <Panel aria-labelledby="titulo-versiones">
            <EncabezadoPanel>
              <TituloSeccion id="titulo-versiones">Versiones</TituloSeccion>
            </EncabezadoPanel>
            <CuerpoPanel>
              {versiones.length === 0 ? (
                <TextoAyuda as="p">
                  Borrador: las versiones se generan al guardarlo como
                  diagnóstico.
                </TextoAyuda>
              ) : (
                <Versiones>
                  {versiones.map((v) => {
                    const seleccionada = v.actual
                      ? !anterior
                      : anterior?.version === v.version;
                    return (
                      <li key={v.version}>
                        {seleccionada ? (
                          <strong aria-current="true">
                            v{v.version}
                            {v.actual && ' (actual)'}
                          </strong>
                        ) : (
                          <BotonAccion
                            type="button"
                            onClick={() =>
                              verVersion(v.actual ? null : v.version)
                            }
                          >
                            <Icono nombre="ver" />
                            Ver v{v.version}
                            {v.actual && ' (actual)'}
                          </BotonAccion>
                        )}
                        <Detalle>
                          {formatearFecha(v.fecha)}
                          {v.registradoPor && ` · ${v.registradoPor.nombre}`}
                        </Detalle>
                      </li>
                    );
                  })}
                </Versiones>
              )}
            </CuerpoPanel>
          </Panel>
        </Columnas>
      </CuerpoPagina>
      {editando && (
        <ModalDiagnostico
          menor={diagnostico.menor}
          diagnostico={diagnostico}
          onCerrar={() => setEditando(false)}
          onGuardado={(actualizado, mensaje) => {
            setEditando(false);
            setDiagnostico(actualizado);
            notificar({ tipo: 'exito', mensaje });
          }}
        />
      )}
    </>
  );
}
