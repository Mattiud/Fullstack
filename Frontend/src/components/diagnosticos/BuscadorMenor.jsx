import { useEffect, useId, useState } from 'react';
import styled from 'styled-components';
import { buscarMenores } from '../../api/menores';
import { mensajeDeError } from '../../api/client';
import { formatearRut } from '../../utils/rut';
import {
  BotonPequeno,
  Campo,
  Entrada,
  ErrorCampo,
  Etiqueta,
  TextoAyuda,
} from '../ui';

// Selección del menor cuando el diagnóstico se registra desde el listado general.
// Combobox: al escribir un nombre o RUT se despliegan los menores accesibles que
// coinciden. La lista va dentro del flujo del formulario para que el contenedor con
// desplazamiento del modal no la recorte.

const ESPERA_MS = 300;

const Lista = styled.ul`
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 240px;
  overflow-y: auto;
  border: 1.5px solid ${({ theme }) => theme.colores.borde};
  border-radius: 3px;
  background: ${({ theme }) => theme.colores.superficie};
`;

const Opcion = styled.li`
  padding: 6px 10px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  background: ${({ theme, $activa }) =>
    $activa ? theme.colores.lateralActivo : 'transparent'};

  &:hover {
    background: ${({ theme }) => theme.colores.lateral};
  }

  span {
    color: ${({ theme }) => theme.colores.textoSuave};
    white-space: nowrap;
  }
`;

const Mensaje = styled.p`
  margin: 0;
  padding: 7px 10px;
  border: 1.5px dashed ${({ theme }) => theme.colores.bordeSuave};
  border-radius: 3px;
  color: ${({ theme }) => theme.colores.textoSuave};
  font-size: 14px;
`;

const Elegido = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 7px 10px;
  border: 1.5px solid
    ${({ theme, $invalido }) =>
      $invalido ? theme.colores.error : theme.colores.bordeTarjeta};
  border-radius: 3px;
  background: ${({ theme }) => theme.colores.lateral};
`;

function textoMenor(menor) {
  return `${menor.nombre} · RUT ${formatearRut(menor.rut)}`;
}

export default function BuscadorMenor({
  seleccionado,
  onSeleccionar,
  error,
  etiqueta = 'Menor *',
  // Para usos compactos (buscador del inicio): etiqueta solo para lectores de pantalla.
  etiquetaOculta = false,
  placeholder = 'Buscar por nombre o RUT',
}) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const [abierta, setAbierta] = useState(false);
  // null mientras no hay una búsqueda terminada para el texto actual.
  const [resultados, setResultados] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [activa, setActiva] = useState(-1);
  // Tras "Cambiar", el foco vuelve al campo de búsqueda.
  const [enfocar, setEnfocar] = useState(false);
  const consulta = texto.trim();

  // Los resultados se actualizan mientras se escribe; una respuesta que llega
  // después de otra búsqueda se descarta.
  useEffect(() => {
    if (!consulta) return undefined;
    let vigente = true;
    const espera = setTimeout(() => {
      buscarMenores(consulta)
        .then((menores) => {
          if (!vigente) return;
          setResultados(menores);
          setCargando(false);
        })
        .catch((err) => {
          if (!vigente) return;
          setErrorBusqueda(
            mensajeDeError(err, 'No se pudo realizar la búsqueda de menores')
          );
          setCargando(false);
        });
    }, ESPERA_MS);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [consulta]);

  function handleChange(evento) {
    const valor = evento.target.value;
    setTexto(valor);
    setAbierta(true);
    setActiva(-1);
    setResultados(null);
    setErrorBusqueda('');
    setCargando(Boolean(valor.trim()));
  }

  function elegir(menor) {
    onSeleccionar(menor);
    setAbierta(false);
    setTexto('');
    setResultados(null);
  }

  function handleKeyDown(evento) {
    const opciones = abierta ? (resultados ?? []) : [];
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!abierta) {
        setAbierta(Boolean(consulta));
        return;
      }
      if (opciones.length === 0) return;
      const paso = evento.key === 'ArrowDown' ? 1 : -1;
      setActiva((i) => (i + paso + opciones.length) % opciones.length);
    } else if (evento.key === 'Enter') {
      // Enter no envía el formulario desde el buscador.
      evento.preventDefault();
      if (opciones[activa]) elegir(opciones[activa]);
    } else if (evento.key === 'Escape' && abierta) {
      // Cierra solo la lista, no el modal.
      evento.stopPropagation();
      setAbierta(false);
    }
  }

  if (seleccionado) {
    return (
      <Campo>
        <Etiqueta as="span">{etiqueta}</Etiqueta>
        <Elegido $invalido={Boolean(error)}>
          <strong>{textoMenor(seleccionado)}</strong>
          <BotonPequeno
            type="button"
            $variante="secundario"
            aria-label={`Cambiar menor (${seleccionado.nombre})`}
            onClick={() => {
              setEnfocar(true);
              onSeleccionar(null);
            }}
          >
            Cambiar
          </BotonPequeno>
        </Elegido>
        {error && <ErrorCampo>{error}</ErrorCampo>}
      </Campo>
    );
  }

  const mostrarLista = abierta && Boolean(consulta);
  const idLista = `${id}-lista`;
  const idOpcion = (indice) => `${id}-opcion-${indice}`;

  return (
    <Campo>
      <Etiqueta
        htmlFor={`${id}-entrada`}
        className={etiquetaOculta ? 'sr-only' : undefined}
      >
        {etiqueta}
      </Etiqueta>
      <Entrada
        id={`${id}-entrada`}
        type="text"
        role="combobox"
        autoComplete="off"
        autoFocus={enfocar}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-expanded={mostrarLista}
        aria-controls={idLista}
        aria-activedescendant={
          mostrarLista && activa >= 0 ? idOpcion(activa) : undefined
        }
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        $invalido={Boolean(error)}
        value={texto}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setAbierta(true)}
        onBlur={() => setAbierta(false)}
      />
      {mostrarLista && cargando && <Mensaje role="status">Buscando…</Mensaje>}
      {mostrarLista && errorBusqueda && (
        <ErrorCampo role="alert">{errorBusqueda}</ErrorCampo>
      )}
      {mostrarLista && resultados?.length === 0 && (
        <Mensaje role="status">No se encontraron menores</Mensaje>
      )}
      <Lista
        id={idLista}
        role="listbox"
        aria-label="Menores que coinciden"
        hidden={!mostrarLista || !resultados?.length}
      >
        {mostrarLista &&
          resultados?.map((menor, indice) => (
            <Opcion
              key={menor._id}
              id={idOpcion(indice)}
              role="option"
              aria-selected={indice === activa}
              $activa={indice === activa}
              // Evita que el campo pierda el foco (y cierre la lista) antes del clic.
              onMouseDown={(evento) => evento.preventDefault()}
              onClick={() => elegir(menor)}
            >
              <strong>{menor.nombre}</strong>{' '}
              <span>RUT {formatearRut(menor.rut)}</span>
            </Opcion>
          ))}
      </Lista>
      {!mostrarLista && !error && (
        <TextoAyuda>Escriba el nombre o RUT del menor.</TextoAyuda>
      )}
      {error && <ErrorCampo id={`${id}-error`}>{error}</ErrorCampo>}
    </Campo>
  );
}
