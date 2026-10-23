import { useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { actualizarMenor, crearMenor, obtenerMenor } from '../../api/menores';
import { erroresDeCampos, mensajeDeError } from '../../api/client';
import { useNotificaciones } from '../../context/useNotificaciones';
import { fechaParaCampo, hoyParaCampo } from '../../utils/formato';
import { formatearRut, validarRut } from '../../utils/rut';
import {
  edadDesde,
  soloErrores,
  validarFecha,
  validarFechaNacimiento,
  validarTelefono,
  validarTexto,
} from '../../utils/validacion';
import EncabezadoPagina, {
  CuerpoPagina,
} from '../../components/EncabezadoPagina';
import CampoFormulario from '../../components/CampoFormulario';
import CampoRut from '../../components/CampoRut';
import {
  Alerta,
  Boton,
  Cargando,
  CuerpoPanel,
  EncabezadoPanel,
  Formulario,
  Panel,
  TextoAyuda,
  TituloSeccion,
} from '../../components/ui';

const Columnas = styled.div`
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`;

const Botones = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
`;

const MAX_ANTECEDENTES = 5000;
const CAMPOS_APODERADO = {
  apoderadoNombre: 'nombre',
  apoderadoParentesco: 'parentesco',
  apoderadoTelefono: 'telefono',
};

function valoresIniciales() {
  return {
    nombre: '',
    rut: '',
    fechaNacimiento: '',
    establecimiento: '',
    curso: '',
    fechaIngreso: hoyParaCampo(),
    apoderadoNombre: '',
    apoderadoParentesco: '',
    apoderadoTelefono: '',
    antecedentesRelevantes: '',
  };
}

function valoresDesdeMenor(menor) {
  return {
    nombre: menor.nombre,
    rut: formatearRut(menor.rut),
    fechaNacimiento: fechaParaCampo(menor.fechaNacimiento),
    establecimiento: menor.establecimiento ?? '',
    curso: menor.curso ?? '',
    fechaIngreso: fechaParaCampo(menor.fechaIngreso),
    apoderadoNombre: menor.apoderado?.nombre ?? '',
    apoderadoParentesco: menor.apoderado?.parentesco ?? '',
    apoderadoTelefono: menor.apoderado?.telefono ?? '',
    antecedentesRelevantes: menor.antecedentesRelevantes,
  };
}

function hayDatosDeApoderado(valores) {
  return Object.keys(CAMPOS_APODERADO).some((campo) => valores[campo].trim());
}

// Obligatorio para menores de 18 años; mientras no haya fecha válida se exige.
function apoderadoObligatorio(valores) {
  const edad = edadDesde(valores.fechaNacimiento);
  return edad === null || edad < 18;
}

function datosParaApi(valores) {
  return {
    nombre: valores.nombre.trim(),
    rut: valores.rut.trim(),
    fechaNacimiento: valores.fechaNacimiento,
    establecimiento: valores.establecimiento.trim(),
    curso: valores.curso.trim(),
    fechaIngreso: valores.fechaIngreso,
    // null indica que la persona (mayor de edad) no tiene apoderado registrado.
    apoderado: hayDatosDeApoderado(valores)
      ? Object.fromEntries(
          Object.entries(CAMPOS_APODERADO).map(([campo, api]) => [
            api,
            valores[campo].trim(),
          ])
        )
      : null,
    antecedentesRelevantes: valores.antecedentesRelevantes.trim(),
  };
}

// Solo los campos que cambiaron; el apoderado se envía completo si cambió alguno.
function cambiosParaApi(originales, valores) {
  const antes = datosParaApi(originales);
  const despues = datosParaApi(valores);
  return Object.fromEntries(
    Object.entries(despues).filter(
      ([campo, valor]) => JSON.stringify(valor) !== JSON.stringify(antes[campo])
    )
  );
}

// Los errores del servidor usan "apoderado.nombre"; el formulario, "apoderadoNombre".
function erroresDelServidor(error) {
  return Object.fromEntries(
    Object.entries(erroresDeCampos(error)).map(([campo, mensaje]) => {
      const local = Object.entries(CAMPOS_APODERADO).find(
        ([, api]) => `apoderado.${api}` === campo
      );
      return [local ? local[0] : campo, mensaje];
    })
  );
}

function validar(valores) {
  // Si se completa algún dato del apoderado, se validan los tres.
  const validarApoderado =
    apoderadoObligatorio(valores) || hayDatosDeApoderado(valores);
  return soloErrores({
    nombre: validarTexto(valores.nombre, { etiqueta: 'El nombre', max: 100 }),
    rut: validarRut(valores.rut),
    fechaNacimiento: validarFechaNacimiento(valores.fechaNacimiento),
    establecimiento: validarTexto(valores.establecimiento, {
      etiqueta: 'El establecimiento',
      obligatorio: false,
      max: 150,
    }),
    curso: validarTexto(valores.curso, {
      etiqueta: 'El curso',
      obligatorio: false,
      max: 50,
    }),
    fechaIngreso: validarFecha(valores.fechaIngreso, {
      etiqueta: 'La fecha de ingreso',
    }),
    apoderadoNombre:
      validarApoderado &&
      validarTexto(valores.apoderadoNombre, {
        etiqueta: 'El nombre del apoderado',
        max: 100,
      }),
    apoderadoParentesco:
      validarApoderado &&
      validarTexto(valores.apoderadoParentesco, {
        etiqueta: 'El parentesco',
        max: 50,
      }),
    apoderadoTelefono:
      validarApoderado && validarTelefono(valores.apoderadoTelefono),
    antecedentesRelevantes: validarTexto(valores.antecedentesRelevantes, {
      etiqueta: 'El campo de antecedentes relevantes',
      max: MAX_ANTECEDENTES,
    }),
  });
}

// "RUT no válido" solo cuando se escribió un RUT; si está vacío basta el aviso general.
function mensajeDeValidacion(errores, valores) {
  if (!errores.rut || !valores.rut.trim()) {
    return {
      tipo: 'advertencia',
      mensaje: 'Revise los campos marcados antes de guardar.',
    };
  }
  return {
    tipo: 'error',
    mensaje:
      Object.keys(errores).length === 1
        ? 'El RUT ingresado no es válido'
        : 'El RUT ingresado no es válido. Revise también los demás campos marcados.',
  };
}

export default function FormularioMenor() {
  const { menorId } = useParams();
  const esEdicion = Boolean(menorId);
  const navigate = useNavigate();
  const { notificar, confirmar } = useNotificaciones();
  const [originales, setOriginales] = useState(
    esEdicion ? null : valoresIniciales
  );
  const [valores, setValores] = useState(esEdicion ? null : valoresIniciales);
  const [errores, setErrores] = useState({});
  const [errorCarga, setErrorCarga] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Permite salir sin aviso después de guardar.
  const guardadoRef = useRef(false);

  useEffect(() => {
    if (!esEdicion) return undefined;
    let vigente = true;
    obtenerMenor(menorId)
      .then((menor) => {
        if (!vigente) return;
        const cargados = valoresDesdeMenor(menor);
        setOriginales(cargados);
        setValores(cargados);
      })
      .catch((err) => {
        if (vigente)
          setErrorCarga(mensajeDeError(err, 'No se pudo cargar la ficha'));
      });
    return () => {
      vigente = false;
    };
  }, [esEdicion, menorId]);

  const hayCambios =
    Boolean(valores) && JSON.stringify(valores) !== JSON.stringify(originales);

  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hayCambios &&
      !guardadoRef.current &&
      currentLocation.pathname !== nextLocation.pathname
  );
  const bloqueoRef = useRef(bloqueo);
  bloqueoRef.current = bloqueo;

  // Al intentar salir con cambios pendientes se pide confirmación en un modal.
  useEffect(() => {
    if (bloqueo.state !== 'blocked') return;
    confirmar({
      titulo: 'Cambios sin guardar',
      mensaje: 'Tiene cambios sin guardar. Si sale ahora, se perderán.',
      textoConfirmar: 'Salir sin guardar',
      textoCancelar: 'Seguir editando',
    }).then((salir) =>
      salir ? bloqueoRef.current.proceed() : bloqueoRef.current.reset()
    );
  }, [bloqueo.state, confirmar]);

  // Aviso del navegador al cerrar o recargar la pestaña con cambios pendientes.
  useEffect(() => {
    if (!hayCambios) return undefined;
    const avisar = (evento) => {
      evento.preventDefault();
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [hayCambios]);

  function handleChange(evento) {
    const { name, value } = evento.target;
    setValores((anteriores) => ({ ...anteriores, [name]: value }));
  }

  async function handleSubmit(evento) {
    evento.preventDefault();
    const nuevosErrores = validar(valores);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) {
      notificar(mensajeDeValidacion(nuevosErrores, valores));
      return;
    }

    const cambios = esEdicion
      ? cambiosParaApi(originales, valores)
      : datosParaApi(valores);
    if (esEdicion && Object.keys(cambios).length === 0) {
      notificar({
        tipo: 'advertencia',
        mensaje: 'No hay cambios para guardar.',
      });
      return;
    }

    setEnviando(true);
    try {
      const menor = esEdicion
        ? await actualizarMenor(menorId, cambios)
        : await crearMenor(cambios);
      guardadoRef.current = true;
      navigate(`/menores/${menor._id}`, {
        replace: !esEdicion,
        state: {
          aviso: esEdicion
            ? 'Cambios guardados correctamente'
            : 'Menor registrado correctamente',
        },
      });
    } catch (error) {
      setErrores(erroresDelServidor(error));
      notificar({
        tipo: 'error',
        mensaje: mensajeDeError(error, 'No fue posible guardar los cambios'),
      });
      setEnviando(false);
    }
  }

  const titulo = esEdicion
    ? `Editar ficha${originales ? ` — ${originales.nombre}` : ''}`
    : 'Nuevo menor';

  if (errorCarga) {
    return (
      <>
        <EncabezadoPagina titulo={titulo} />
        <CuerpoPagina>
          <Alerta role="alert">{errorCarga}</Alerta>
        </CuerpoPagina>
      </>
    );
  }

  if (!valores) {
    return (
      <>
        <EncabezadoPagina titulo={titulo} />
        <Cargando role="status">Cargando ficha…</Cargando>
      </>
    );
  }

  const campo = (nombre) => ({
    name: nombre,
    value: valores[nombre],
    onChange: handleChange,
    error: errores[nombre],
  });
  const marcaApoderado = apoderadoObligatorio(valores) ? ' *' : '';

  return (
    <>
      <EncabezadoPagina titulo={titulo} />
      <CuerpoPagina>
        <Formulario onSubmit={handleSubmit} noValidate>
          <Panel aria-labelledby="seccion-menor">
            <EncabezadoPanel>
              <TituloSeccion id="seccion-menor">Datos del menor</TituloSeccion>
            </EncabezadoPanel>
            <CuerpoPanel>
              <Columnas>
                <CampoFormulario
                  etiqueta="Nombre completo *"
                  autoComplete="off"
                  {...campo('nombre')}
                />
                <CampoRut etiqueta="RUT *" {...campo('rut')} />
                <CampoFormulario
                  etiqueta="Fecha de nacimiento *"
                  type="date"
                  {...campo('fechaNacimiento')}
                />
                <CampoFormulario
                  etiqueta="Establecimiento"
                  autoComplete="off"
                  {...campo('establecimiento')}
                />
                <CampoFormulario
                  etiqueta="Curso"
                  placeholder="Ej.: 4° básico"
                  autoComplete="off"
                  {...campo('curso')}
                />
                <CampoFormulario
                  etiqueta="Fecha de ingreso *"
                  type="date"
                  {...campo('fechaIngreso')}
                />
              </Columnas>
            </CuerpoPanel>
          </Panel>

          <Panel aria-labelledby="seccion-apoderado">
            <EncabezadoPanel>
              <TituloSeccion id="seccion-apoderado">Apoderado</TituloSeccion>
              <TextoAyuda>Obligatorio para menores de 18 años</TextoAyuda>
            </EncabezadoPanel>
            <CuerpoPanel>
              {errores.apoderado && (
                <Alerta role="alert">{errores.apoderado}</Alerta>
              )}
              <Columnas>
                <CampoFormulario
                  etiqueta={`Nombre del apoderado${marcaApoderado}`}
                  autoComplete="off"
                  {...campo('apoderadoNombre')}
                />
                <CampoFormulario
                  etiqueta={`Parentesco${marcaApoderado}`}
                  placeholder="Ej.: madre"
                  autoComplete="off"
                  {...campo('apoderadoParentesco')}
                />
                <CampoFormulario
                  etiqueta={`Teléfono${marcaApoderado}`}
                  type="tel"
                  placeholder="+56 9 1234 5678"
                  autoComplete="off"
                  {...campo('apoderadoTelefono')}
                />
              </Columnas>
            </CuerpoPanel>
          </Panel>

          <Panel aria-labelledby="seccion-antecedentes">
            <EncabezadoPanel>
              <TituloSeccion id="seccion-antecedentes">
                Antecedentes relevantes
              </TituloSeccion>
              <TextoAyuda>
                {valores.antecedentesRelevantes.length} / {MAX_ANTECEDENTES}
              </TextoAyuda>
            </EncabezadoPanel>
            <CuerpoPanel>
              <CampoFormulario
                etiqueta="Antecedentes relevantes *"
                as="textarea"
                rows={6}
                maxLength={MAX_ANTECEDENTES}
                {...campo('antecedentesRelevantes')}
              />
            </CuerpoPanel>
          </Panel>

          <TextoAyuda as="p">
            Los campos marcados con * son obligatorios.
          </TextoAyuda>
          <Botones>
            <Boton
              type="button"
              $variante="secundario"
              onClick={() =>
                navigate(esEdicion ? `/menores/${menorId}` : '/menores')
              }
            >
              Cancelar
            </Boton>
            <Boton type="submit" disabled={enviando}>
              {enviando
                ? 'Guardando…'
                : esEdicion
                  ? 'Guardar cambios'
                  : 'Registrar menor'}
            </Boton>
          </Botones>
        </Formulario>
      </CuerpoPagina>
    </>
  );
}
