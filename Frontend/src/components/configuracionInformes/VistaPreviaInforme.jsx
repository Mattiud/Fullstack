import styled from 'styled-components';
import {
  PAGINA_PDF,
  TAMANOS_LOGO,
} from '../../constants/configuracionInformes';
import { ajustarLogo } from '../../utils/logoInformes';

// Representación a escala de la primera página del informe PDF: misma geometría que
// Backend/src/utils/informePdf.js (medidas en puntos convertidas a unidades del
// contenedor). Se actualiza con cada cambio del formulario, sin guardar.

const SEPARACION_LOGO = 16;
const ALINEACION_CSS = {
  izquierda: 'left',
  centro: 'center',
  derecha: 'right',
};

// Puntos del PDF → porcentaje del ancho de la hoja.
function pt(valor) {
  return `${(valor * 100) / PAGINA_PDF.ancho}cqw`;
}

const Marco = styled.div`
  background: #f5e6ec;
  border-radius: ${({ theme }) => theme.radio};
  padding: 12px;
`;

const Hoja = styled.figure`
  margin: 0;
  container-type: inline-size;
  position: relative;
  aspect-ratio: ${PAGINA_PDF.ancho} / ${PAGINA_PDF.alto};
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  color: #2b2328;
  overflow: hidden;
  font-family: Helvetica, Arial, sans-serif;
`;

const Encabezado = styled.div`
  position: absolute;
  top: ${pt(36)};
  left: ${pt(PAGINA_PDF.margenLateral)};
  right: ${pt(PAGINA_PDF.margenLateral)};
  display: flex;
  flex-direction: ${({ $logoIzquierda }) =>
    $logoIzquierda ? 'row' : 'row-reverse'};
  align-items: center;
  gap: ${pt(SEPARACION_LOGO)};
  padding-bottom: ${pt(8)};
  border-bottom: ${pt(1.5)} solid #b8496f;
`;

const CajaLogo = styled.div`
  flex: none;
  width: ${({ $ancho }) => pt($ancho)};
  height: ${({ $alto }) => pt($alto)};

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
`;

const Textos = styled.div`
  flex: 1;
  min-width: 0;
  text-align: ${({ $alineacion }) => $alineacion};
  overflow-wrap: break-word;
  /* Con alineación centrada se compensa el logo para centrar respecto de la hoja. */
  ${({ $compensacion, $logoIzquierda }) =>
    $compensacion
      ? `${$logoIzquierda ? 'margin-right' : 'margin-left'}: ${pt($compensacion)};`
      : ''}
`;

const Nombre = styled.div`
  font-weight: 700;
  font-size: ${pt(10)};
  color: #666666;
  margin-bottom: ${pt(3)};
`;

const TituloInforme = styled.div`
  font-weight: 700;
  font-size: ${pt(16)};
`;

const Contenido = styled.div`
  position: absolute;
  top: ${({ $superior }) => pt($superior)};
  left: ${pt(PAGINA_PDF.margenLateral)};
  right: ${pt(PAGINA_PDF.margenLateral)};
  display: grid;
  gap: ${pt(7)};
`;

const Marca = styled.div`
  font-size: ${pt(10)};
  color: #666666;
`;

const TituloSeccionPdf = styled.div`
  font-weight: 700;
  font-size: ${pt(11)};
  margin-top: ${pt(6)};
`;

const Linea = styled.div`
  height: ${pt(6)};
  width: ${({ $ancho = 100 }) => $ancho}%;
  background: #e4e4e4;
  border-radius: 2px;
`;

const Pie = styled.div`
  position: absolute;
  bottom: ${pt(30)};
  left: ${pt(PAGINA_PDF.margenLateral)};
  right: ${pt(PAGINA_PDF.margenLateral)};
  border-top: ${pt(0.6)} solid #d2d2d2;
  padding-top: ${pt(6)};
  text-align: center;
  font-size: ${pt(8)};
  color: #666666;
  white-space: pre-line;
  overflow-wrap: break-word;
  display: grid;
  gap: ${pt(3)};
`;

const PieInstitucional = styled.div`
  display: grid;
  gap: ${pt(3)};
`;

const PARRAFO = [100, 100, 96, 100, 62];

export default function VistaPreviaInforme({ valores, logo }) {
  const caja = TAMANOS_LOGO[valores.tamanoLogo] ?? TAMANOS_LOGO.mediano;
  const medidas = logo?.url ? ajustarLogo(caja, logo) : null;
  const logoIzquierda = valores.posicionLogo === 'izquierda';
  const nombre = valores.nombreInstitucion.trim();
  const textoPie = valores.textoPie
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean)
    .join('\n');
  const hayPie = Boolean(textoPie) || valores.numeracionPaginas;
  const compensacion =
    medidas && valores.alineacionEncabezado === 'centro'
      ? medidas.ancho + SEPARACION_LOGO
      : 0;
  // Alto aproximado del encabezado, para ubicar el contenido bajo la línea.
  const altoTexto = (nombre ? 15 : 0) + 19;
  const superior = 36 + Math.max(altoTexto, medidas?.alto ?? 0) + 8 + 18;

  return (
    <Marco>
      <Hoja aria-label="Vista previa del informe">
        <Encabezado $logoIzquierda={logoIzquierda}>
          {medidas && (
            <CajaLogo $ancho={medidas.ancho} $alto={medidas.alto}>
              <img src={logo.url} alt="Logo institucional" />
            </CajaLogo>
          )}
          <Textos
            $alineacion={ALINEACION_CSS[valores.alineacionEncabezado]}
            $compensacion={compensacion}
            $logoIzquierda={logoIzquierda}
          >
            {nombre && <Nombre>{nombre}</Nombre>}
            <TituloInforme>Informe psicopedagógico</TituloInforme>
          </Textos>
        </Encabezado>

        <Contenido $superior={superior} aria-hidden="true">
          <Marca>DATOS FICTICIOS · VISTA PREVIA</Marca>
          <TituloSeccionPdf>1. Antecedentes</TituloSeccionPdf>
          {PARRAFO.map((ancho, i) => (
            <Linea key={`a${i}`} $ancho={ancho} />
          ))}
          <TituloSeccionPdf>2. Diagnóstico</TituloSeccionPdf>
          {PARRAFO.map((ancho, i) => (
            <Linea key={`b${i}`} $ancho={ancho} />
          ))}
          <TituloSeccionPdf>3. Sesiones realizadas</TituloSeccionPdf>
          {PARRAFO.slice(0, 4).map((ancho, i) => (
            <Linea key={`c${i}`} $ancho={ancho} />
          ))}
        </Contenido>

        <Pie>
          {/* Cada psicopedagogo define sus datos en «Datos profesionales». */}
          <strong data-testid="pie-profesional-ejemplo">
            Datos profesionales del psicopedagogo (ejemplo)
          </strong>
          {hayPie && (
            <PieInstitucional data-testid="pie-vista-previa">
              {textoPie && <span>{textoPie}</span>}
              {valores.numeracionPaginas && <span>Página 1 de 2</span>}
            </PieInstitucional>
          )}
        </Pie>
      </Hoja>
    </Marco>
  );
}
