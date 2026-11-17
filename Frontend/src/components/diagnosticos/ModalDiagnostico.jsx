import { useEffect, useId, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  actualizarDiagnostico,
  crearDiagnostico,
  listarTiposDiagnostico,
} from '../../api/diagnosticos';
import { erroresDeCampos, mensajeDeError } from '../../api/client';
import { useNotificaciones } from '../../context/useNotificaciones';
import { useCambiosSinGuardar } from '../../hooks/useCambiosSinGuardar';
import {
  AREAS_SUGERIDAS,
  ESTADOS_DIAGNOSTICO,
  LIMITES_DIAGNOSTICO as LIMITES,
  MENSAJE_TIPO_LISTADO,
  TIPO_OTRO,
} from '../../constants/diagnosticos';
import { fechaParaCampo } from '../../utils/formato';
import {
  soloErrores,
  validarFecha,
  validarTexto,
} from '../../utils/validacion';
import Modal from '../Modal';
import CampoFormulario from '../CampoFormulario';
import BuscadorMenor from './BuscadorMenor';
import {
  Alerta,
  Boton,
  BotonEnlace,
  BotonFiltro,
  BotonPequeno,
  Campo,
  Entrada,
  ErrorCampo,
  Etiqueta,
  Formulario,
  Selector,
} from '../ui';

// Registro y edición de diagnósticos (mockup 1g). Un borrador puede guardarse
// incompleto; al guardarlo como diagnóstico queda vigente y cada edición posterior
// crea una versión nueva en el servidor.

const Columnas = styled.div`
  display: grid;
  gap: 15px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`;

const Areas = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
`;

const OtraArea = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;

  input {
    width: 200px;
  }
`;

const Botones = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
`;

const MENSAJE_OBLIGATORIOS =
  'Debes completar los campos obligatorios (*) antes de guardar.';
const OBLIGATORIOS = ['tipo', 'fechaEvaluacion', 'descripcion'];

// El tipo se elige entre las categorías del administrador o con «Otro», que pide
// escribirlo (tipoSeleccionado = TIPO_OTRO y el texto en tipoOtro).
function valoresDesde(diagnostico) {
  const personalizado = Boolean(diagnostico?.tipoPersonalizado);
  return {
    tipoSeleccionado: personalizado ? TIPO_OTRO : (diagnostico?.tipo ?? ''),
    tipoOtro: personalizado ? diagnostico.tipo : '',
    fechaEvaluacion: fechaParaCampo(diagnostico?.fechaEvaluacion),
    instrumento: diagnostico?.instrumento ?? '',
    descripcion: diagnostico?.descripcion ?? '',
    areasAfectadas: diagnostico?.areasAfectadas ?? [],
  };
}

function datosParaApi(valores) {
  const otro = valores.tipoSeleccionado === TIPO_OTRO;
  return {
    tipo: otro ? valores.tipoOtro.trim() : valores.tipoSeleccionado,
    tipoPersonalizado: otro,
    fechaEvaluacion: valores.fechaEvaluacion,
    instrumento: valores.instrumento.trim(),
    descripcion: valores.descripcion.trim(),
    areasAfectadas: valores.areasAfectadas,
  };
}

function cambiosParaApi(originales, valores) {
  const antes = datosParaApi(originales);
  const datos = datosParaApi(valores);
  const cambios = Object.fromEntries(
    Object.entries(datos).filter(
      ([campo, valor]) => JSON.stringify(valor) !== JSON.stringify(antes[campo])
    )
  );
  // El tipo y su origen («Otro» o categoría) se envían siempre juntos.
  if ('tipo' in cambios || 'tipoPersonalizado' in cambios) {
    cambios.tipo = datos.tipo;
    cambios.tipoPersonalizado = datos.tipoPersonalizado;
  }
  return cambios;
}

const normalizar = (texto) => texto.trim().replace(/\s+/g, ' ').toLowerCase();

function incluyeArea(areas, area) {
  return areas.some((a) => a.toLowerCase() === area.toLowerCase());
}

// Validación equivalente a la del backend (diagnosticos.controller.js).
function validar(valores, estado, tipos) {
  const vigente = estado === ESTADOS_DIAGNOSTICO.VIGENTE;
  let errorOtro = null;
  if (valores.tipoSeleccionado === TIPO_OTRO) {
    errorOtro = validarTexto(valores.tipoOtro, {
      etiqueta: 'El tipo de diagnóstico',
      obligatorio: vigente,
      max: LIMITES.tipo,
    });
    // «Otro» no puede repetir una categoría del administrador.
    const repetido = (tipos ?? []).some(
      (t) => normalizar(t.nombre) === normalizar(valores.tipoOtro)
    );
    if (!errorOtro && valores.tipoOtro.trim() && repetido) {
      errorOtro = MENSAJE_TIPO_LISTADO;
    }
  }
  return soloErrores({
    tipo:
      vigente && !valores.tipoSeleccionado
        ? 'El tipo de diagnóstico es obligatorio'
        : null,
    tipoOtro: errorOtro,
    fechaEvaluacion: validarFecha(valores.fechaEvaluacion, {
      etiqueta: 'La fecha de evaluación',
      obligatorio: vigente,
    }),
    instrumento: validarTexto(valores.instrumento, {
      etiqueta: 'El instrumento aplicado',
      obligatorio: false,
      max: LIMITES.instrumento,
    }),
    descripcion: validarTexto(valores.descripcion, {
      etiqueta: 'El campo de descripción y hallazgos',
      obligatorio: vigente,
      max: LIMITES.descripcion,
    }),
  });
}

function hayContenido(valores) {
  // tipoPersonalizado solo indica el origen del tipo: no es un dato por sí mismo.
  const datos = { ...datosParaApi(valores), tipoPersonalizado: false };
  return Object.values(datos).some((valor) =>
    Array.isArray(valor) ? valor.length > 0 : Boolean(valor)
  );
}

export default function ModalDiagnostico({
  menor,
  diagnostico,
  onCerrar,
  onGuardado,
}) {
  const esEdicion = Boolean(diagnostico);
  const esBorrador =
    !esEdicion || diagnostico.estado === ESTADOS_DIAGNOSTICO.BORRADOR;
  const { notificar, confirmar } = useNotificaciones();
  const idTipos = useId();
  const [originales] = useState(() => valoresDesde(diagnostico));
  const [valores, setValores] = useState(originales);
  const [menorElegido, setMenorElegido] = useState(menor ?? null);
  // null mientras cargan las categorías.
  const [tipos, setTipos] = useState(null);
  const [errorTipos, setErrorTipos] = useState('');
  const [intentoTipos, setIntentoTipos] = useState(0);
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState('');
  const [otraArea, setOtraArea] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const guardadoRef = useRef(false);

  // Las categorías activas se piden cada vez que se abre el formulario, así reflejan
  // los cambios del administrador. Si no cargan, «Otro» sigue disponible.
  useEffect(() => {
    let vigente = true;
    listarTiposDiagnostico()
      .then((datos) => {
        if (vigente) setTipos(datos);
      })
      .catch((err) => {
        if (vigente)
          setErrorTipos(
            mensajeDeError(
              err,
              'No se pudieron cargar los tipos de diagnóstico'
            )
          );
      });
    return () => {
      vigente = false;
    };
  }, [intentoTipos]);

  function reintentarTipos() {
    setErrorTipos('');
    setIntentoTipos((n) => n + 1);
  }

  const hayCambios =
    JSON.stringify(valores) !== JSON.stringify(originales) ||
    (!menor && Boolean(menorElegido));
  useCambiosSinGuardar(hayCambios, guardadoRef);

  function handleChange(evento) {
    const { name, value } = evento.target;
    setValores((anteriores) => ({ ...anteriores, [name]: value }));
  }

  function alternarArea(area) {
    setValores((anteriores) => {
      const areas = anteriores.areasAfectadas;
      if (incluyeArea(areas, area)) {
        return {
          ...anteriores,
          areasAfectadas: areas.filter(
            (a) => a.toLowerCase() !== area.toLowerCase()
          ),
        };
      }
      return { ...anteriores, areasAfectadas: [...areas, area] };
    });
  }

  function agregarOtraArea() {
    const area = otraArea.trim().replace(/\s+/g, ' ');
    let error = null;
    if (!area) error = 'Escriba el nombre del área';
    else if (area.length > LIMITES.area)
      error = `Cada área admite como máximo ${LIMITES.area} caracteres`;
    else if (incluyeArea(valores.areasAfectadas, area))
      error = 'El área ya está seleccionada';
    setErrores((anteriores) => ({ ...anteriores, areasAfectadas: error }));
    if (error) return;
    alternarArea(area);
    setOtraArea(null);
  }

  async function handleCerrar() {
    if (enviando) return;
    if (
      hayCambios &&
      !(await confirmar({
        titulo: 'Cambios sin guardar',
        mensaje: 'Tiene cambios sin guardar. Si cierra ahora, se perderán.',
        textoConfirmar: 'Descartar cambios',
        textoCancelar: 'Seguir editando',
      }))
    ) {
      return;
    }
    onCerrar();
  }

  async function guardar(estado) {
    const nuevosErrores = validar(valores, estado, tipos);
    if (!menorElegido) nuevosErrores.menor = 'Seleccione el menor';
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) {
      const faltanObligatorios =
        estado === ESTADOS_DIAGNOSTICO.VIGENTE &&
        OBLIGATORIOS.some((campo) => !datosParaApi(valores)[campo]);
      setAviso(
        faltanObligatorios || nuevosErrores.menor
          ? MENSAJE_OBLIGATORIOS
          : 'Revise los campos marcados antes de guardar.'
      );
      return;
    }
    if (estado === ESTADOS_DIAGNOSTICO.BORRADOR && !hayContenido(valores)) {
      setAviso('Complete al menos un campo para guardar el borrador.');
      return;
    }

    const publica =
      esEdicion && esBorrador && estado === ESTADOS_DIAGNOSTICO.VIGENTE;
    const cambios = esEdicion
      ? cambiosParaApi(originales, valores)
      : { ...datosParaApi(valores), estado };
    if (publica) cambios.estado = estado;
    if (esEdicion && Object.keys(cambios).length === 0) {
      setAviso('');
      notificar({
        tipo: 'advertencia',
        mensaje: 'No hay cambios para guardar.',
      });
      return;
    }

    setAviso('');
    setEnviando(true);
    try {
      const guardado = esEdicion
        ? await actualizarDiagnostico(
            menorElegido._id,
            diagnostico._id,
            cambios,
            diagnostico.updatedAt
          )
        : await crearDiagnostico(menorElegido._id, cambios);
      guardadoRef.current = true;
      let mensaje = 'Borrador guardado correctamente';
      if (guardado.estado === ESTADOS_DIAGNOSTICO.VIGENTE) {
        mensaje =
          esEdicion && !publica
            ? `Diagnóstico actualizado (v${guardado.version})`
            : 'Diagnóstico registrado correctamente';
      }
      onGuardado(guardado, mensaje);
    } catch (error) {
      // El formulario conserva los datos para reintentar (por ejemplo, sin conexión).
      const deCampos = erroresDeCampos(error);
      if (deCampos.tipo && valores.tipoSeleccionado === TIPO_OTRO) {
        deCampos.tipoOtro = deCampos.tipo;
        delete deCampos.tipo;
      }
      setErrores(deCampos);
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(error, 'No fue posible guardar el diagnóstico'),
      });
      setEnviando(false);
    }
  }

  const titulo = esEdicion
    ? `Editar diagnóstico — ${menorElegido.nombre}`
    : `Nuevo diagnóstico${menor ? ` — ${menor.nombre}` : ''}`;
  let pie =
    'El borrador puede guardarse incompleto. Al guardar el diagnóstico queda vigente (v1) y se registra en el historial (usuario + fecha).';
  if (!esBorrador) {
    pie = `Al guardar se crea la versión v${diagnostico.version + 1} y queda registro en el historial (usuario + fecha).`;
  }

  const campo = (nombre) => ({
    name: nombre,
    value: valores[nombre],
    onChange: handleChange,
    error: errores[nombre],
  });
  // Un tipo guardado cuya categoría ya no está activa se conserva como opción.
  const tipoOriginal = originales.tipoSeleccionado;
  const tipoNoListado =
    Boolean(tipoOriginal) &&
    tipoOriginal !== TIPO_OTRO &&
    !(tipos ?? []).some((t) => t.nombre === tipoOriginal);
  const areasMostradas = [
    ...AREAS_SUGERIDAS,
    ...valores.areasAfectadas.filter((a) => !incluyeArea(AREAS_SUGERIDAS, a)),
  ];

  return (
    <Modal titulo={titulo} pie={pie} onCerrar={handleCerrar}>
      <Formulario
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          guardar(ESTADOS_DIAGNOSTICO.VIGENTE);
        }}
      >
        {!menor && (
          <BuscadorMenor
            seleccionado={menorElegido}
            onSeleccionar={setMenorElegido}
            error={errores.menor}
          />
        )}
        <Columnas>
          <Campo>
            <Etiqueta htmlFor={`${idTipos}-tipo`}>
              Tipo de diagnóstico *
            </Etiqueta>
            <Selector
              id={`${idTipos}-tipo`}
              name="tipoSeleccionado"
              value={valores.tipoSeleccionado}
              onChange={handleChange}
              aria-busy={!tipos && !errorTipos}
              aria-invalid={Boolean(errores.tipo)}
              aria-describedby={
                errores.tipo ? `${idTipos}-tipo-error` : undefined
              }
              $invalido={Boolean(errores.tipo)}
            >
              <option value="">
                {tipos || errorTipos ? 'Seleccionar…' : 'Cargando tipos…'}
              </option>
              {tipoNoListado && (
                <option value={tipoOriginal}>
                  {tipos
                    ? `${tipoOriginal} (ya no está en la lista)`
                    : tipoOriginal}
                </option>
              )}
              {(tipos ?? []).map((tipo) => (
                <option key={tipo._id} value={tipo.nombre}>
                  {tipo.nombre}
                </option>
              ))}
              <option value={TIPO_OTRO}>Otro</option>
            </Selector>
            {errorTipos && (
              <ErrorCampo role="alert">
                {errorTipos}.{' '}
                <BotonEnlace type="button" onClick={reintentarTipos}>
                  Reintentar
                </BotonEnlace>
              </ErrorCampo>
            )}
            {errores.tipo && (
              <ErrorCampo id={`${idTipos}-tipo-error`}>
                {errores.tipo}
              </ErrorCampo>
            )}
          </Campo>
          <CampoFormulario
            etiqueta="Fecha de evaluación *"
            type="date"
            {...campo('fechaEvaluacion')}
          />
        </Columnas>
        {valores.tipoSeleccionado === TIPO_OTRO && (
          <CampoFormulario
            etiqueta="Especifique el tipo de diagnóstico *"
            autoComplete="off"
            maxLength={LIMITES.tipo}
            placeholder="Tipo que no está en la lista"
            autoFocus={originales.tipoSeleccionado !== TIPO_OTRO}
            {...campo('tipoOtro')}
          />
        )}
        <CampoFormulario
          etiqueta="Instrumento aplicado"
          placeholder="Ej. Prueba de comprensión lectora…"
          autoComplete="off"
          maxLength={LIMITES.instrumento}
          {...campo('instrumento')}
        />
        <CampoFormulario
          etiqueta="Descripción y hallazgos *"
          as="textarea"
          rows={5}
          maxLength={LIMITES.descripcion}
          ayuda={`${valores.descripcion.length} / ${LIMITES.descripcion}`}
          {...campo('descripcion')}
        />
        <Campo role="group" aria-labelledby={`${idTipos}-areas`}>
          <Etiqueta as="span" id={`${idTipos}-areas`}>
            Áreas afectadas
          </Etiqueta>
          <Areas>
            {areasMostradas.map((area) => {
              const activa = incluyeArea(valores.areasAfectadas, area);
              return (
                <BotonFiltro
                  key={area}
                  type="button"
                  $activo={activa}
                  aria-pressed={activa}
                  disabled={
                    !activa && valores.areasAfectadas.length >= LIMITES.areas
                  }
                  onClick={() => alternarArea(area)}
                >
                  {area}
                </BotonFiltro>
              );
            })}
            {otraArea === null ? (
              <BotonFiltro
                type="button"
                disabled={valores.areasAfectadas.length >= LIMITES.areas}
                onClick={() => setOtraArea('')}
              >
                + otra
              </BotonFiltro>
            ) : (
              <OtraArea>
                <Entrada
                  aria-label="Nombre de la otra área"
                  maxLength={LIMITES.area}
                  value={otraArea}
                  autoFocus
                  onChange={(evento) => setOtraArea(evento.target.value)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter') {
                      evento.preventDefault();
                      agregarOtraArea();
                    }
                  }}
                />
                <BotonPequeno
                  type="button"
                  $variante="secundario"
                  onClick={agregarOtraArea}
                >
                  Agregar
                </BotonPequeno>
                <BotonPequeno
                  type="button"
                  $variante="secundario"
                  onClick={() => {
                    setOtraArea(null);
                    setErrores((e) => ({ ...e, areasAfectadas: null }));
                  }}
                >
                  Cancelar
                </BotonPequeno>
              </OtraArea>
            )}
          </Areas>
          {errores.areasAfectadas && (
            <ErrorCampo>{errores.areasAfectadas}</ErrorCampo>
          )}
        </Campo>

        {aviso && <Alerta role="alert">✕ {aviso}</Alerta>}

        <Botones>
          <Boton
            type="button"
            $variante="secundario"
            onClick={handleCerrar}
            disabled={enviando}
          >
            Cancelar
          </Boton>
          {esBorrador && (
            <Boton
              type="button"
              $variante="secundario"
              disabled={enviando}
              onClick={() => guardar(ESTADOS_DIAGNOSTICO.BORRADOR)}
            >
              Guardar borrador
            </Boton>
          )}
          <Boton type="submit" disabled={enviando} $cargando={enviando}>
            {enviando ? 'Guardando…' : 'Guardar diagnóstico'}
          </Boton>
        </Botones>
      </Formulario>
    </Modal>
  );
}
