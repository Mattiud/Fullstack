import styled from 'styled-components';
import { useNotificaciones } from '../../context/useNotificaciones';
import {
  AYUDA_LISTAS,
  LETRAS,
  LIMITES_INFORME,
} from '../../constants/informes';
import CampoFormulario from '../CampoFormulario';
import {
  BotonAccion,
  BotonPequeno,
  ErrorCampo,
  GrupoAcciones,
  TextoAyuda,
} from '../ui';
import { apartadoNuevo, areaNueva } from './claves';
import Icono from '../Icono';

// Análisis cualitativo por áreas numeradas (1., 2., …), cada una con apartados o
// subáreas identificados por letra (a), b), …). El profesional redacta todo el texto.

const Lista = styled.div`
  display: grid;
  gap: 16px;
`;

const TarjetaArea = styled.section`
  border: 1.5px solid ${({ theme }) => theme.colores.bordeTarjeta};
  border-radius: ${({ theme }) => theme.radio};
  padding: 12px;
  display: grid;
  gap: 12px;
`;

const Apartado = styled.div`
  border-left: 3px solid ${({ theme }) => theme.colores.lateralActivo};
  padding: 4px 0 4px 12px;
  margin-left: 6px;
  display: grid;
  gap: 10px;
`;

const Cabecera = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;

  h3,
  h4 {
    margin: 0;
    font-size: 15px;
  }

  h4 {
    font-size: 14px;
    color: ${({ theme }) => theme.colores.textoSuave};
  }
`;

const Acciones = styled.div`
  display: flex;
  gap: 6px 12px;
  flex-wrap: wrap;
  align-items: center;
`;

function intercambiar(lista, indice, delta) {
  const destino = indice + delta;
  if (destino < 0 || destino >= lista.length) return lista;
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

function tieneTexto(texto) {
  return Boolean(texto && texto.trim());
}

export default function EditorAreas({ areas, onChange, error }) {
  const { confirmar } = useNotificaciones();
  const L = LIMITES_INFORME;

  function actualizarArea(indice, transformar) {
    onChange(areas.map((a, i) => (i === indice ? transformar(a) : a)));
  }

  function actualizarApartado(indice, j, cambios) {
    actualizarArea(indice, (area) => ({
      ...area,
      apartados: area.apartados.map((ap, k) =>
        k === j ? { ...ap, ...cambios } : ap
      ),
    }));
  }

  async function eliminarArea(indice) {
    const area = areas[indice];
    const conDatos =
      tieneTexto(area.titulo) ||
      area.apartados.some(
        (ap) => tieneTexto(ap.titulo) || tieneTexto(ap.texto)
      );
    if (
      conDatos &&
      !(await confirmar({
        titulo: 'Eliminar área',
        mensaje: `Se eliminará el área ${indice + 1} con todos sus apartados.`,
        textoConfirmar: 'Eliminar',
      }))
    ) {
      return;
    }
    onChange(areas.filter((_, i) => i !== indice));
  }

  async function eliminarApartado(indice, j) {
    const apartado = areas[indice].apartados[j];
    if (
      (tieneTexto(apartado.titulo) || tieneTexto(apartado.texto)) &&
      !(await confirmar({
        titulo: 'Eliminar apartado',
        mensaje: `Se eliminará el apartado ${LETRAS[j]}) del área ${indice + 1}.`,
        textoConfirmar: 'Eliminar',
      }))
    ) {
      return;
    }
    actualizarArea(indice, (area) => ({
      ...area,
      apartados: area.apartados.filter((_, k) => k !== j),
    }));
  }

  return (
    <Lista>
      {areas.length === 0 && (
        <TextoAyuda as="p">
          Aún no hay áreas. Agregue las áreas evaluadas y, dentro de cada una,
          los apartados o subáreas que correspondan.
        </TextoAyuda>
      )}

      {areas.map((area, indice) => {
        const n = indice + 1;
        return (
          <TarjetaArea key={area.clave} aria-label={`Área ${n}`}>
            <Cabecera>
              <h3>Área {n}</h3>
              <GrupoAcciones>
                <BotonAccion
                  type="button"
                  aria-label={`Subir área ${n}`}
                  disabled={indice === 0}
                  onClick={() => onChange(intercambiar(areas, indice, -1))}
                >
                  <Icono nombre="subir" />
                  Subir
                </BotonAccion>
                <BotonAccion
                  type="button"
                  aria-label={`Bajar área ${n}`}
                  disabled={indice === areas.length - 1}
                  onClick={() => onChange(intercambiar(areas, indice, 1))}
                >
                  <Icono nombre="bajar" />
                  Bajar
                </BotonAccion>
                <BotonAccion
                  type="button"
                  $peligro
                  aria-label={`Eliminar área ${n}`}
                  onClick={() => eliminarArea(indice)}
                >
                  <Icono nombre="eliminar" />
                  Eliminar área
                </BotonAccion>
              </GrupoAcciones>
            </Cabecera>

            <CampoFormulario
              etiqueta={`Nombre del área ${n} *`}
              maxLength={L.tituloArea}
              value={area.titulo}
              onChange={(e) =>
                actualizarArea(indice, (a) => ({
                  ...a,
                  titulo: e.target.value,
                }))
              }
            />

            {area.apartados.map((apartado, j) => {
              const letra = LETRAS[j] ?? j + 1;
              return (
                <Apartado key={apartado.clave}>
                  <Cabecera>
                    <h4>
                      Apartado {letra}) del área {n}
                    </h4>
                    <GrupoAcciones>
                      <BotonAccion
                        type="button"
                        $soloIcono
                        aria-label={`Subir apartado ${letra}) del área ${n}`}
                        disabled={j === 0}
                        onClick={() =>
                          actualizarArea(indice, (a) => ({
                            ...a,
                            apartados: intercambiar(a.apartados, j, -1),
                          }))
                        }
                      >
                        <Icono nombre="subir" />
                      </BotonAccion>
                      <BotonAccion
                        type="button"
                        $soloIcono
                        aria-label={`Bajar apartado ${letra}) del área ${n}`}
                        disabled={j === area.apartados.length - 1}
                        onClick={() =>
                          actualizarArea(indice, (a) => ({
                            ...a,
                            apartados: intercambiar(a.apartados, j, 1),
                          }))
                        }
                      >
                        <Icono nombre="bajar" />
                      </BotonAccion>
                      <BotonAccion
                        type="button"
                        $peligro
                        aria-label={`Eliminar apartado ${letra}) del área ${n}`}
                        onClick={() => eliminarApartado(indice, j)}
                      >
                        <Icono nombre="eliminar" />
                        Eliminar
                      </BotonAccion>
                    </GrupoAcciones>
                  </Cabecera>
                  <CampoFormulario
                    etiqueta={`Subtítulo del apartado ${letra}) del área ${n} (opcional)`}
                    maxLength={L.tituloApartado}
                    value={apartado.titulo}
                    onChange={(e) =>
                      actualizarApartado(indice, j, { titulo: e.target.value })
                    }
                  />
                  <CampoFormulario
                    as="textarea"
                    rows={7}
                    etiqueta={`Texto del apartado ${letra}) del área ${n} *`}
                    maxLength={L.textoApartado}
                    value={apartado.texto}
                    ayuda={`Observaciones, fortalezas, dificultades, desempeños y aspectos en proceso. ${AYUDA_LISTAS} ${apartado.texto.length}/${L.textoApartado} caracteres.`}
                    onChange={(e) =>
                      actualizarApartado(indice, j, { texto: e.target.value })
                    }
                  />
                </Apartado>
              );
            })}

            <Acciones>
              <BotonPequeno
                type="button"
                $variante="secundario"
                disabled={area.apartados.length >= L.apartados}
                aria-label={`Agregar apartado al área ${n}`}
                onClick={() =>
                  actualizarArea(indice, (a) => ({
                    ...a,
                    apartados: [...a.apartados, apartadoNuevo()],
                  }))
                }
              >
                <Icono nombre="agregar" />
                Apartado
              </BotonPequeno>
            </Acciones>
          </TarjetaArea>
        );
      })}

      {error && <ErrorCampo role="alert">{error}</ErrorCampo>}

      <Acciones>
        <BotonPequeno
          type="button"
          disabled={areas.length >= L.areas}
          onClick={() => onChange([...areas, areaNueva()])}
        >
          <Icono nombre="agregar" />
          Área
        </BotonPequeno>
        <TextoAyuda>
          Las áreas se numeran (1., 2., …) y los apartados se identifican con
          letras (a), b), …) en el PDF.
        </TextoAyuda>
      </Acciones>
    </Lista>
  );
}
