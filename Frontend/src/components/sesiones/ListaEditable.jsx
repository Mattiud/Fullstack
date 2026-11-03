import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  BotonEnlace,
  BotonPequeno,
  CuerpoPanel,
  EncabezadoPanel,
  Entrada,
  ErrorCampo,
  Panel,
  TextoAyuda,
  TituloSeccion,
} from '../ui';

// Lista de textos con "+ agregar" y ✕ del mockup 1h (objetivos y actividades). Las
// actividades se reordenan con ↑ ↓ en lugar de arrastrar, para poder usar el teclado.

const Elementos = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
`;

const Fila = styled.li`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const Numero = styled.span`
  color: #999999;
  min-width: 20px;
  text-align: right;
`;

const Contenido = styled.div`
  display: grid;
  gap: 10px;
`;

export default function ListaEditable({
  id,
  titulo,
  nombreElemento,
  textos,
  max,
  maxLargo,
  ordenable = false,
  editable = true,
  error,
  onOperacion,
}) {
  const entradas = useRef([]);
  const [enfocarUltimo, setEnfocarUltimo] = useState(false);

  // Al agregar un elemento se enfoca su campo.
  useEffect(() => {
    if (!enfocarUltimo) return;
    entradas.current[textos.length - 1]?.focus();
    setEnfocarUltimo(false);
  }, [enfocarUltimo, textos.length]);

  function agregar() {
    onOperacion({ tipo: 'agregar' });
    setEnfocarUltimo(true);
  }

  return (
    <Panel aria-labelledby={`titulo-${id}`}>
      <EncabezadoPanel>
        <TituloSeccion id={`titulo-${id}`}>{titulo} *</TituloSeccion>
        {editable && (
          <BotonEnlace
            type="button"
            onClick={agregar}
            disabled={textos.length >= max}
          >
            + agregar
          </BotonEnlace>
        )}
      </EncabezadoPanel>
      <CuerpoPanel>
        <Contenido>
          {textos.length === 0 ? (
            <TextoAyuda as="p">Aún no hay {titulo.toLowerCase()}.</TextoAyuda>
          ) : (
            <Elementos>
              {textos.map((texto, i) => (
                // El índice identifica la posición: los textos pueden repetirse.
                <Fila key={i}>
                  {ordenable && <Numero aria-hidden="true">{i + 1}.</Numero>}
                  <Entrada
                    ref={(elemento) => {
                      entradas.current[i] = elemento;
                    }}
                    aria-label={`${nombreElemento} ${i + 1}`}
                    aria-invalid={Boolean(error) && !texto.trim()}
                    $invalido={Boolean(error) && !texto.trim()}
                    value={texto}
                    maxLength={maxLargo}
                    readOnly={!editable}
                    onChange={(e) =>
                      onOperacion({
                        tipo: 'editar',
                        indice: i,
                        valor: e.target.value,
                      })
                    }
                  />
                  {editable && ordenable && (
                    <>
                      <BotonPequeno
                        type="button"
                        $variante="secundario"
                        aria-label={`Subir ${nombreElemento.toLowerCase()} ${i + 1}`}
                        disabled={i === 0}
                        onClick={() =>
                          onOperacion({ tipo: 'mover', indice: i, delta: -1 })
                        }
                      >
                        ↑
                      </BotonPequeno>
                      <BotonPequeno
                        type="button"
                        $variante="secundario"
                        aria-label={`Bajar ${nombreElemento.toLowerCase()} ${i + 1}`}
                        disabled={i === textos.length - 1}
                        onClick={() =>
                          onOperacion({ tipo: 'mover', indice: i, delta: 1 })
                        }
                      >
                        ↓
                      </BotonPequeno>
                    </>
                  )}
                  {editable && (
                    <BotonPequeno
                      type="button"
                      $variante="secundario"
                      aria-label={`Quitar ${nombreElemento.toLowerCase()} ${i + 1}`}
                      onClick={() => onOperacion({ tipo: 'quitar', indice: i })}
                    >
                      ✕
                    </BotonPequeno>
                  )}
                </Fila>
              ))}
            </Elementos>
          )}
          {error && <ErrorCampo role="alert">{error}</ErrorCampo>}
        </Contenido>
      </CuerpoPanel>
    </Panel>
  );
}
