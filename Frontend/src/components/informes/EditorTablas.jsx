import styled from 'styled-components';
import { useNotificaciones } from '../../context/useNotificaciones';
import { COLUMNAS_REFERENCIA, LIMITES_INFORME } from '../../constants/informes';
import CampoFormulario from '../CampoFormulario';
import {
  BotonEnlace,
  BotonPequeno,
  ContenedorTabla,
  Entrada,
  ErrorCampo,
  TextoAyuda,
} from '../ui';
import { tablaNueva } from './claves';
import {
  columnasDeLogro,
  esColumnaEntera,
  porcentajeCalculado,
} from '../../utils/porcentajeLogro';

// Tablas de resultados cuantitativos con columnas y filas definidas por el profesional.
// Las celdas son texto libre: el sistema no calcula totales ni porcentajes.

const Lista = styled.div`
  display: grid;
  gap: 16px;
`;

const TarjetaTabla = styled.section`
  border: 1.5px solid ${({ theme }) => theme.colores.bordeTarjeta};
  border-radius: ${({ theme }) => theme.radio};
  padding: 12px;
  display: grid;
  gap: 12px;
`;

const Cabecera = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;

  h3 {
    margin: 0;
    font-size: 15px;
  }
`;

const Acciones = styled.div`
  display: flex;
  gap: 6px 12px;
  flex-wrap: wrap;
  align-items: center;
`;

const Grilla = styled.table`
  border-collapse: collapse;
  min-width: 100%;

  th,
  td {
    padding: 4px;
    vertical-align: top;
  }

  th {
    background: ${({ theme }) => theme.colores.lateral};
  }

  input {
    min-width: 110px;
  }
`;

const CeldaEncabezado = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;

  input {
    font-weight: 700;
  }
`;

const BotonQuitar = styled.button`
  border: none;
  background: none;
  color: ${({ theme }) => theme.colores.error};
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 4px;

  &:disabled {
    color: ${({ theme }) => theme.colores.deshabilitado};
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colores.primario};
  }
`;

function tieneContenido(textos) {
  return textos.some((texto) => texto && texto.trim());
}

export default function EditorTablas({ tablas, onChange, error }) {
  const { confirmar } = useNotificaciones();
  const L = LIMITES_INFORME;

  function actualizar(indice, transformar) {
    onChange(tablas.map((t, i) => (i === indice ? transformar(t) : t)));
  }

  async function confirmarSi(condicion, opciones) {
    return !condicion || (await confirmar(opciones));
  }

  function mover(indice, delta) {
    const destino = indice + delta;
    if (destino < 0 || destino >= tablas.length) return;
    const copia = [...tablas];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    onChange(copia);
  }

  async function eliminarTabla(indice) {
    const tabla = tablas[indice];
    const conDatos =
      tieneContenido([tabla.titulo, tabla.descripcion, ...tabla.columnas]) ||
      tabla.filas.some((fila) => tieneContenido(fila));
    const eliminar = await confirmarSi(conDatos, {
      titulo: 'Eliminar tabla',
      mensaje: `Se eliminará la tabla ${indice + 1} con todo su contenido.`,
      textoConfirmar: 'Eliminar',
    });
    if (eliminar) onChange(tablas.filter((_, i) => i !== indice));
  }

  async function eliminarColumna(indice, columna) {
    const tabla = tablas[indice];
    const conDatos = tieneContenido([
      tabla.columnas[columna],
      ...tabla.filas.map((fila) => fila[columna]),
    ]);
    const eliminar = await confirmarSi(conDatos, {
      titulo: 'Eliminar columna',
      mensaje: `Se eliminará la columna «${tabla.columnas[columna] || columna + 1}» y sus datos.`,
      textoConfirmar: 'Eliminar',
    });
    if (!eliminar) return;
    actualizar(indice, (t) => ({
      ...t,
      columnas: t.columnas.filter((_, c) => c !== columna),
      filas: t.filas.map((fila) => fila.filter((_, c) => c !== columna)),
    }));
  }

  async function eliminarFila(indice, numeroFila) {
    const eliminar = await confirmarSi(
      tieneContenido(tablas[indice].filas[numeroFila]),
      {
        titulo: 'Eliminar fila',
        mensaje: `Se eliminará la fila ${numeroFila + 1} y sus datos.`,
        textoConfirmar: 'Eliminar',
      }
    );
    if (!eliminar) return;
    actualizar(indice, (t) => ({
      ...t,
      filas: t.filas.filter((_, f) => f !== numeroFila),
    }));
  }

  return (
    <Lista>
      {tablas.length === 0 && (
        <TextoAyuda as="p">
          Aún no hay tablas. Agregue una tabla vacía o una con las columnas de
          referencia y complete los datos de la evaluación.
        </TextoAyuda>
      )}

      {tablas.map((tabla, indice) => {
        const n = indice + 1;
        const logro = columnasDeLogro(tabla.columnas);
        return (
          <TarjetaTabla key={tabla.clave} aria-label={`Tabla ${n}`}>
            <Cabecera>
              <h3>Tabla {n}</h3>
              <Acciones>
                <BotonEnlace
                  type="button"
                  aria-label={`Subir tabla ${n}`}
                  disabled={indice === 0}
                  onClick={() => mover(indice, -1)}
                >
                  ↑ Subir
                </BotonEnlace>
                <BotonEnlace
                  type="button"
                  aria-label={`Bajar tabla ${n}`}
                  disabled={indice === tablas.length - 1}
                  onClick={() => mover(indice, 1)}
                >
                  ↓ Bajar
                </BotonEnlace>
                <BotonEnlace
                  type="button"
                  $peligro
                  aria-label={`Eliminar tabla ${n}`}
                  onClick={() => eliminarTabla(indice)}
                >
                  Eliminar tabla
                </BotonEnlace>
              </Acciones>
            </Cabecera>

            <CampoFormulario
              etiqueta={`Título de la tabla ${n}`}
              maxLength={L.tituloTabla}
              value={tabla.titulo}
              onChange={(e) =>
                actualizar(indice, (t) => ({ ...t, titulo: e.target.value }))
              }
            />
            <CampoFormulario
              as="textarea"
              rows={2}
              etiqueta={`Descripción de la tabla ${n} (opcional)`}
              maxLength={L.descripcionTabla}
              value={tabla.descripcion}
              onChange={(e) =>
                actualizar(indice, (t) => ({
                  ...t,
                  descripcion: e.target.value,
                }))
              }
            />

            <ContenedorTabla>
              <Grilla>
                <thead>
                  <tr>
                    {tabla.columnas.map((columna, c) => (
                      <th key={c} scope="col">
                        <CeldaEncabezado>
                          <Entrada
                            aria-label={`Encabezado de la columna ${c + 1} (tabla ${n})`}
                            placeholder={`Columna ${c + 1}`}
                            maxLength={L.celda}
                            value={columna}
                            onChange={(e) =>
                              actualizar(indice, (t) => ({
                                ...t,
                                columnas: t.columnas.map((valor, i) =>
                                  i === c ? e.target.value : valor
                                ),
                              }))
                            }
                          />
                          <BotonQuitar
                            type="button"
                            aria-label={`Eliminar columna ${c + 1} de la tabla ${n}`}
                            disabled={tabla.columnas.length === 1}
                            onClick={() => eliminarColumna(indice, c)}
                          >
                            ×
                          </BotonQuitar>
                        </CeldaEncabezado>
                      </th>
                    ))}
                    <th>
                      <span className="sr-only">Acciones de la fila</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tabla.filas.map((fila, f) => (
                    <tr key={f}>
                      {fila.map((celda, c) => {
                        const etiqueta = `Fila ${f + 1}, ${tabla.columnas[c] || `columna ${c + 1}`} (tabla ${n})`;
                        const calculado =
                          logro && c === logro.porcentaje
                            ? porcentajeCalculado(fila, logro)
                            : null;
                        // % de logro calculable: se muestra el resultado, sin editar.
                        if (calculado !== null) {
                          return (
                            <td key={c}>
                              <Entrada
                                aria-label={etiqueta}
                                title="Calculado: Logrados ÷ Total de ítems"
                                value={calculado}
                                readOnly
                                disabled
                              />
                            </td>
                          );
                        }
                        const entero = esColumnaEntera(tabla.columnas[c]);
                        return (
                          <td key={c}>
                            <Entrada
                              aria-label={etiqueta}
                              maxLength={L.celda}
                              inputMode={entero ? 'numeric' : undefined}
                              value={celda}
                              onChange={(e) => {
                                // «Total de ítems» y «Logrados»: solo dígitos.
                                const valorNuevo = entero
                                  ? e.target.value.replace(/\D/g, '')
                                  : e.target.value;
                                actualizar(indice, (t) => ({
                                  ...t,
                                  filas: t.filas.map((filaActual, i) =>
                                    i === f
                                      ? filaActual.map((valor, j) =>
                                          j === c ? valorNuevo : valor
                                        )
                                      : filaActual
                                  ),
                                }));
                              }}
                            />
                          </td>
                        );
                      })}
                      <td>
                        <BotonQuitar
                          type="button"
                          aria-label={`Eliminar fila ${f + 1} de la tabla ${n}`}
                          onClick={() => eliminarFila(indice, f)}
                        >
                          ×
                        </BotonQuitar>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Grilla>
            </ContenedorTabla>

            <Acciones>
              <BotonPequeno
                type="button"
                $variante="secundario"
                disabled={tabla.filas.length >= L.filas}
                aria-label={`Agregar fila a la tabla ${n}`}
                onClick={() =>
                  actualizar(indice, (t) => ({
                    ...t,
                    filas: [...t.filas, t.columnas.map(() => '')],
                  }))
                }
              >
                + Fila
              </BotonPequeno>
              <BotonPequeno
                type="button"
                $variante="secundario"
                disabled={tabla.columnas.length >= L.columnas}
                aria-label={`Agregar columna a la tabla ${n}`}
                onClick={() =>
                  actualizar(indice, (t) => ({
                    ...t,
                    columnas: [...t.columnas, ''],
                    filas: t.filas.map((filaActual) => [...filaActual, '']),
                  }))
                }
              >
                + Columna
              </BotonPequeno>
              <TextoAyuda>
                {tabla.filas.length} fila{tabla.filas.length === 1 ? '' : 's'} ·{' '}
                {tabla.columnas.length} columna
                {tabla.columnas.length === 1 ? '' : 's'} (máximo {L.filas} y{' '}
                {L.columnas})
              </TextoAyuda>
            </Acciones>
          </TarjetaTabla>
        );
      })}

      {error && <ErrorCampo role="alert">{error}</ErrorCampo>}

      <Acciones>
        <BotonPequeno
          type="button"
          disabled={tablas.length >= L.tablas}
          onClick={() => onChange([...tablas, tablaNueva()])}
        >
          + Tabla vacía
        </BotonPequeno>
        <BotonPequeno
          type="button"
          $variante="secundario"
          disabled={tablas.length >= L.tablas}
          onClick={() => onChange([...tablas, tablaNueva(COLUMNAS_REFERENCIA)])}
        >
          + Tabla con columnas de referencia
        </BotonPequeno>
      </Acciones>
      <TextoAyuda>
        Las columnas de referencia son solo encabezados (Área de evaluación ·
        Total de ítems · Logrados · % de logro); puede renombrarlas, eliminarlas
        o agregar otras. «Total de ítems» y «Logrados» solo admiten números
        enteros, y si la tabla tiene ambas columnas y «% de logro», el
        porcentaje se calcula automáticamente (Logrados ÷ Total de ítems,
        redondeado). Si una fila no permite el cálculo, el % se escribe a mano.
      </TextoAyuda>
    </Lista>
  );
}
