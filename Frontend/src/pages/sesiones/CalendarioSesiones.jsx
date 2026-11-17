import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../context/useAuth';
import { obtenerCalendario } from '../../api/sesiones';
import { mensajeDeError } from '../../api/client';
import { PERMISOS } from '../../constants/auth';
import { formatearDia, hoyParaCampo } from '../../utils/formato';
import {
  diaDeLaSemana,
  diasSemana,
  esFechaValida,
  inicioSemana,
  nombreMes,
  semanasMes,
  sumarDias,
  sumarMeses,
} from '../../utils/calendario';
import EncabezadoPagina, {
  CuerpoPagina,
} from '../../components/EncabezadoPagina';
import BuscadorMenor from '../../components/diagnosticos/BuscadorMenor';
import ChipSeleccionable from '../../components/sesiones/ChipSeleccionable';
import VistaSemana from '../../components/sesiones/calendario/VistaSemana';
import VistaMes from '../../components/sesiones/calendario/VistaMes';
import {
  Alerta,
  Boton,
  BotonIcono,
  BotonPequeno,
  Cargando,
  TextoAyuda,
} from '../../components/ui';
import Icono from '../../components/Icono';

// Calendario de sesiones (mockup 1i). Muestra las sesiones guardadas en el módulo de
// planificación; el backend devuelve solo las de los menores a los que se tiene
// acceso. La vista y la fecha van en la URL para conservar el período al volver.

const Barra = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  align-items: center;
`;

const Periodo = styled.h2`
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  min-width: 220px;
  text-align: center;
`;

const Espacio = styled.div`
  flex: 1;
`;

const Filtros = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: flex-start;
`;

const Opciones = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
`;

// Alineados con el campo del buscador, que tiene una etiqueta encima.
const Chips = styled(Opciones)`
  padding-top: 24px;
`;

const Buscador = styled.div`
  width: min(100%, 360px);
`;

const VISTAS = [
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
];

const DIAS_HABILES = 5;

export default function CalendarioSesiones() {
  const { tienePermiso } = useAuth();
  const navigate = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const [filtros, setFiltros] = useState({
    mias: false,
    borradores: false,
    menor: null,
  });
  const [sesiones, setSesiones] = useState(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  const puedePlanificar = tienePermiso(PERMISOS.SESIONES_EDITAR);
  const hoy = hoyParaCampo();
  const vista = parametros.get('vista') === 'mes' ? 'mes' : 'semana';
  const fecha = esFechaValida(parametros.get('fecha'))
    ? parametros.get('fecha')
    : hoy;

  // Se pide siempre la semana completa (o la grilla del mes) para saber si hay
  // sesiones en fin de semana.
  const desde =
    vista === 'semana'
      ? inicioSemana(fecha)
      : inicioSemana(sumarMeses(fecha, 0));
  const hasta = sumarDias(desde, vista === 'semana' ? 6 : 41);
  const menorId = filtros.menor?._id ?? null;

  useEffect(() => {
    let vigente = true;
    setSesiones(null);
    setError('');
    obtenerCalendario({
      desde,
      hasta,
      mias: filtros.mias,
      borradores: filtros.borradores,
      menor: menorId,
    })
      .then((datos) => {
        if (vigente) setSesiones(datos);
      })
      .catch((err) => {
        if (vigente)
          setError(mensajeDeError(err, 'No se pudo cargar el calendario'));
      });
    return () => {
      vigente = false;
    };
  }, [desde, hasta, filtros.mias, filtros.borradores, menorId, intento]);

  function ir(nuevaVista, nuevaFecha) {
    setParametros({ vista: nuevaVista, fecha: nuevaFecha });
  }

  function mover(sentido) {
    ir(
      vista,
      vista === 'semana'
        ? sumarDias(inicioSemana(fecha), sentido * 7)
        : sumarMeses(fecha, sentido)
    );
  }

  // De lunes a viernes, como el mockup; el sábado o el domingo se agregan solo si
  // tienen sesiones esa semana.
  const semana = diasSemana(fecha).filter(
    (dia) =>
      diaDeLaSemana(dia) < DIAS_HABILES ||
      (sesiones ?? []).some((s) => s.fecha.slice(0, 10) === dia)
  );
  const titulo =
    vista === 'semana'
      ? `${formatearDia(semana[0])} – ${formatearDia(semana[semana.length - 1])}`
      : nombreMes(fecha);

  return (
    <>
      <EncabezadoPagina titulo="Calendario">
        {puedePlanificar && (
          <Boton type="button" onClick={() => navigate('/sesiones/nueva')}>
            <Icono nombre="agregar" />
            Sesión
          </Boton>
        )}
      </EncabezadoPagina>
      <CuerpoPagina>
        <Barra>
          <BotonIcono
            $pequeno
            type="button"
            $variante="secundario"
            aria-label={vista === 'semana' ? 'Semana anterior' : 'Mes anterior'}
            onClick={() => mover(-1)}
          >
            <Icono nombre="anterior" />
          </BotonIcono>
          <Periodo aria-live="polite">{titulo}</Periodo>
          <BotonIcono
            $pequeno
            type="button"
            $variante="secundario"
            aria-label={
              vista === 'semana' ? 'Semana siguiente' : 'Mes siguiente'
            }
            onClick={() => mover(1)}
          >
            <Icono nombre="siguiente" />
          </BotonIcono>
          <Boton
            type="button"
            $variante="secundario"
            onClick={() => ir(vista, hoy)}
          >
            Hoy
          </Boton>
          <Espacio />
          <Opciones role="group" aria-label="Vista">
            {VISTAS.map(({ valor, etiqueta }) => (
              <ChipSeleccionable
                key={valor}
                type="button"
                $activo={vista === valor}
                aria-pressed={vista === valor}
                onClick={() => ir(valor, fecha)}
              >
                {etiqueta}
              </ChipSeleccionable>
            ))}
          </Opciones>
        </Barra>

        <Filtros>
          <Buscador>
            <BuscadorMenor
              etiqueta="Filtrar por menor (todos, si no se elige)"
              seleccionado={filtros.menor}
              onSeleccionar={(menor) => setFiltros((f) => ({ ...f, menor }))}
            />
          </Buscador>
          <Chips role="group" aria-label="Filtros">
            {puedePlanificar && (
              <ChipSeleccionable
                type="button"
                $activo={filtros.mias}
                aria-pressed={filtros.mias}
                onClick={() => setFiltros((f) => ({ ...f, mias: !f.mias }))}
              >
                Solo mis sesiones
              </ChipSeleccionable>
            )}
            <ChipSeleccionable
              type="button"
              $activo={filtros.borradores}
              aria-pressed={filtros.borradores}
              onClick={() =>
                setFiltros((f) => ({ ...f, borradores: !f.borradores }))
              }
            >
              Sin planificar
            </ChipSeleccionable>
          </Chips>
        </Filtros>

        {error && (
          <Alerta role="alert">
            {error}{' '}
            <BotonPequeno
              type="button"
              $variante="secundario"
              onClick={() => setIntento((i) => i + 1)}
            >
              <Icono nombre="recargar" />
              Reintentar
            </BotonPequeno>
          </Alerta>
        )}
        {!sesiones && !error && (
          <Cargando role="status">Cargando calendario…</Cargando>
        )}
        {sesiones && (
          <>
            {sesiones.length === 0 && (
              <TextoAyuda as="p" role="status">
                {filtros.borradores
                  ? 'No hay sesiones sin planificar en este período.'
                  : 'No hay sesiones en este período.'}
              </TextoAyuda>
            )}
            {vista === 'semana' ? (
              <VistaSemana dias={semana} sesiones={sesiones} hoy={hoy} />
            ) : (
              <VistaMes
                semanas={semanasMes(fecha)}
                referencia={fecha}
                sesiones={sesiones}
                hoy={hoy}
                onVerSemana={(dia) => ir('semana', dia)}
              />
            )}
          </>
        )}
      </CuerpoPagina>
    </>
  );
}
