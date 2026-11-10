const PDFDocument = require('pdfkit');
const { TAMANOS_LOGO, VALORES_POR_DEFECTO } = require('../config/informes');

// Maquetación de los informes psicopedagógicos en PDF (mockup 1j): encabezado con el
// nombre del centro, el título y el logo; contenido; y pie con el texto institucional
// y la numeración en cada página.
//
// Contrato para el módulo de informes: obtener la configuración con
// ConfiguracionInforme.obtenerVigente({ conLogo: true }), generar el PDF con
// generarInformePdf() y GUARDAR el Buffer resultante (por ejemplo con guardarCifrado).
// Así cada informe emitido es una copia fija: cambiar la configuración después solo
// afecta a los informes nuevos, nunca a los ya almacenados.

const PAGINA = Object.freeze({ ancho: 595.28, alto: 841.89 }); // A4 en puntos
const MARGEN_LATERAL = 56;
const MARGEN_SUPERIOR = 36;
const MARGEN_INFERIOR = 30;
// Margen inferior del contenido cuando no hay pie de página.
const MARGEN_INFERIOR_SIN_PIE = 50;
const SEPARACION_LOGO = 16;
const SEPARACION_NOMBRE = 3;
const ESPACIO_BAJO_LINEA = 18;
const ESPACIO_SOBRE_PIE = 14;

const COLORES = Object.freeze({
  acento: '#b8496f',
  texto: '#2b2328',
  suave: '#666666',
  separador: '#d2d2d2',
});
const FUENTE = 'Helvetica';
const FUENTE_NEGRITA = 'Helvetica-Bold';
const FUENTE_CURSIVA = 'Helvetica-Oblique';
const ESTILOS = Object.freeze({
  nombre: { fuente: FUENTE_NEGRITA, tamano: 10, color: COLORES.suave },
  titulo: { fuente: FUENTE_NEGRITA, tamano: 16, color: COLORES.texto },
  pie: { fuente: FUENTE, tamano: 8, color: COLORES.suave },
  pieProfesional: { fuente: FUENTE_NEGRITA, tamano: 8, color: COLORES.suave },
});
const ALINEACION_PDF = Object.freeze({ izquierda: 'left', centro: 'center', derecha: 'right' });

// Las fuentes estándar de PDF solo admiten la codificación WinAnsi (Latin-1 con
// comillas tipográficas, guiones, €, etc.). Otros caracteres no se pueden imprimir.
const NO_IMPRIMIBLE =
  /[^\n\t\x20-\x7E -ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/u;

function esImprimible(texto) {
  return !NO_IMPRIMIBLE.test(texto);
}

function imprimible(texto) {
  return String(texto ?? '').replace(new RegExp(NO_IMPRIMIBLE.source, 'gu'), '?');
}

function aplicarEstilo(doc, { fuente, tamano, color }) {
  doc.font(fuente).fontSize(tamano);
  if (color) doc.fillColor(color);
  return doc;
}

function palabraMasAncha(doc, texto) {
  return Math.max(0, ...texto.split(/\s+/).map((palabra) => doc.widthOfString(palabra)));
}

// Geometría del encabezado, el pie y el área de contenido. El logo se escala dentro de
// la caja del tamaño elegido conservando su proporción, y el texto ocupa el resto del
// ancho: nunca se superponen. Sin logo ni pie no se reserva espacio para ellos.
function disenar(doc, configuracion, titulo, pieProfesional = '') {
  const opciones = { ...VALORES_POR_DEFECTO, ...configuracion };
  const anchoUtil = PAGINA.ancho - 2 * MARGEN_LATERAL;
  const logoIzquierda = opciones.posicionLogo === 'izquierda';

  let logo = null;
  const { ancho: anchoPx, alto: altoPx } = configuracion.logo ?? {};
  if (anchoPx > 0 && altoPx > 0) {
    const caja = TAMANOS_LOGO[opciones.tamanoLogo] ?? TAMANOS_LOGO.mediano;
    const escala = Math.min(caja.ancho / anchoPx, caja.alto / altoPx);
    const ancho = anchoPx * escala;
    logo = {
      ancho,
      alto: altoPx * escala,
      x: logoIzquierda ? MARGEN_LATERAL : PAGINA.ancho - MARGEN_LATERAL - ancho,
      y: 0,
    };
  }

  const nombre = imprimible(opciones.nombreInstitucion).trim();
  const tituloImprimible = imprimible(titulo);

  // Con alineación centrada se reserva el espacio del logo a ambos lados, para que el
  // texto quede centrado respecto de la página, siempre que ninguna palabra deba
  // cortarse; si no cabe, el texto usa todo el ancho que deja libre el logo.
  const reservaLogo = logo ? logo.ancho + SEPARACION_LOGO : 0;
  const anchoSimetrico = anchoUtil - 2 * reservaLogo;
  const simetrico =
    logo &&
    opciones.alineacionEncabezado === 'centro' &&
    palabraMasAncha(aplicarEstilo(doc, ESTILOS.titulo), tituloImprimible) <= anchoSimetrico &&
    palabraMasAncha(aplicarEstilo(doc, ESTILOS.nombre), nombre) <= anchoSimetrico;
  const anchoTexto = simetrico ? anchoSimetrico : anchoUtil - reservaLogo;
  const xTexto = MARGEN_LATERAL + (logoIzquierda || simetrico ? reservaLogo : 0);

  const altoNombre = nombre
    ? aplicarEstilo(doc, ESTILOS.nombre).heightOfString(nombre, { width: anchoTexto })
    : 0;
  const altoTitulo = aplicarEstilo(doc, ESTILOS.titulo).heightOfString(tituloImprimible, {
    width: anchoTexto,
  });
  const altoTexto = altoNombre + (nombre ? SEPARACION_NOMBRE : 0) + altoTitulo;
  const altoBanda = Math.max(altoTexto, logo?.alto ?? 0);
  if (logo) logo.y = MARGEN_SUPERIOR + (altoBanda - logo.alto) / 2;
  const yLinea = MARGEN_SUPERIOR + altoBanda + 8;

  // Pie: datos del profesional (si se indican), texto institucional y numeración.
  const profesional = imprimible(pieProfesional).trim();
  const altoProfesional = profesional
    ? aplicarEstilo(doc, ESTILOS.pieProfesional).heightOfString(profesional, {
        width: anchoUtil,
        align: 'center',
      })
    : 0;
  const textoPie = imprimible(opciones.textoPie).trim();
  aplicarEstilo(doc, ESTILOS.pie);
  const altoTextoPie = textoPie
    ? doc.heightOfString(textoPie, { width: anchoUtil, align: 'center' })
    : 0;
  const altoNumeracion = opciones.numeracionPaginas
    ? doc.heightOfString('Página 99 de 99', { width: anchoUtil })
    : 0;
  const alturas = [altoProfesional, altoTextoPie, altoNumeracion].filter((a) => a > 0);
  const altoPie =
    alturas.reduce((a, b) => a + b, 0) + Math.max(0, alturas.length - 1) * SEPARACION_NOMBRE;

  let pie = null;
  if (altoPie > 0) {
    const y = PAGINA.alto - MARGEN_INFERIOR - altoPie;
    pie = {
      y,
      alto: altoPie,
      yLinea: y - 6,
      profesional,
      altoProfesional,
      altoTexto: altoTextoPie,
      texto: textoPie,
    };
  }

  return {
    pagina: PAGINA,
    margenLateral: MARGEN_LATERAL,
    anchoUtil,
    alineacion: ALINEACION_PDF[opciones.alineacionEncabezado] ?? 'left',
    numeracion: Boolean(opciones.numeracionPaginas),
    logo,
    texto: {
      x: xTexto,
      y: MARGEN_SUPERIOR + (altoBanda - altoTexto) / 2,
      ancho: anchoTexto,
      alto: altoTexto,
      nombre,
      altoNombre,
      titulo: tituloImprimible,
    },
    yLinea,
    pie,
    contenido: {
      superior: yLinea + ESPACIO_BAJO_LINEA,
      inferior: pie ? PAGINA.alto - pie.yLinea + ESPACIO_SOBRE_PIE : MARGEN_INFERIOR_SIN_PIE,
    },
  };
}

// Calcula el diseño sin generar el PDF (se usa en las pruebas).
function calcularDiseno(
  configuracion,
  { titulo = 'Informe psicopedagógico', pieProfesional } = {}
) {
  return disenar(new PDFDocument({ size: 'A4' }), configuracion, titulo, pieProfesional);
}

function dibujarEncabezado(doc, diseno, imagenLogo) {
  const { logo, texto, alineacion } = diseno;
  if (logo && imagenLogo) {
    doc.image(imagenLogo, logo.x, logo.y, { fit: [logo.ancho, logo.alto] });
  }
  let y = texto.y;
  if (texto.nombre) {
    aplicarEstilo(doc, ESTILOS.nombre).text(texto.nombre, texto.x, y, {
      width: texto.ancho,
      align: alineacion,
    });
    y += texto.altoNombre + SEPARACION_NOMBRE;
  }
  aplicarEstilo(doc, ESTILOS.titulo).text(texto.titulo, texto.x, y, {
    width: texto.ancho,
    align: alineacion,
  });
  doc
    .moveTo(MARGEN_LATERAL, diseno.yLinea)
    .lineTo(PAGINA.ancho - MARGEN_LATERAL, diseno.yLinea)
    .lineWidth(1.5)
    .strokeColor(COLORES.acento)
    .stroke();
}

function dibujarPie(doc, diseno, numero, total) {
  const { pie } = diseno;
  if (!pie) return;
  doc
    .moveTo(MARGEN_LATERAL, pie.yLinea)
    .lineTo(PAGINA.ancho - MARGEN_LATERAL, pie.yLinea)
    .lineWidth(0.6)
    .strokeColor(COLORES.separador)
    .stroke();
  const opciones = { width: diseno.anchoUtil, align: 'center' };
  let y = pie.y;
  if (pie.profesional) {
    aplicarEstilo(doc, ESTILOS.pieProfesional).text(pie.profesional, MARGEN_LATERAL, y, opciones);
    y += pie.altoProfesional + SEPARACION_NOMBRE;
  }
  aplicarEstilo(doc, ESTILOS.pie);
  if (pie.texto) {
    doc.text(pie.texto, MARGEN_LATERAL, y, opciones);
    y += pie.altoTexto + SEPARACION_NOMBRE;
  }
  if (diseno.numeracion) {
    doc.text(`Página ${numero} de ${total}`, MARGEN_LATERAL, y, opciones);
  }
}

function dibujarMarcaAgua(doc, texto) {
  const centro = [PAGINA.ancho / 2, PAGINA.alto / 2];
  doc.save();
  doc.rotate(-35, { origin: centro });
  aplicarEstilo(doc, { fuente: FUENTE_NEGRITA, tamano: 38, color: COLORES.acento });
  doc.fillOpacity(0.13);
  doc.text(imprimible(texto), 0, centro[1] - 20, {
    width: PAGINA.ancho,
    align: 'center',
    lineBreak: false,
  });
  doc.restore();
}

function limiteInferior(doc) {
  return doc.page.height - doc.page.margins.bottom;
}

function asegurarEspacio(doc, alto) {
  if (doc.y + alto > limiteInferior(doc)) doc.addPage();
}

// Bloques del texto ingresado por el profesional, línea a línea: viñetas («- », «• »,
// «* »), listas numeradas («1. », «1) », «a) ») y párrafos. El texto no se modifica.
function bloquesDeTexto(texto) {
  const bloques = [];
  for (const linea of String(texto ?? '').split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia) continue;
    let coincidencia = /^[-•*]\s+(.+)$/.exec(limpia);
    if (coincidencia) {
      bloques.push({ tipo: 'vineta', texto: coincidencia[1] });
      continue;
    }
    coincidencia = /^(\d{1,3}[.)]|[a-z]\))\s+(.+)$/.exec(limpia);
    if (coincidencia) {
      bloques.push({ tipo: 'numerado', marca: coincidencia[1], texto: coincidencia[2] });
      continue;
    }
    bloques.push({ tipo: 'parrafo', texto: limpia });
  }
  return bloques;
}

// Texto de una sección o subsección (`texto` con listas, o `parrafos` ya separados).
// Con `atenuado` (vista previa de una sección sin completar) va en gris y cursiva.
function dibujarTexto(doc, diseno, { texto, parrafos, atenuado = false }, sangria = 0) {
  const bloques =
    texto !== undefined
      ? bloquesDeTexto(texto)
      : (parrafos ?? []).map((p) => ({ tipo: 'parrafo', texto: p }));
  const x = MARGEN_LATERAL + sangria;
  const ancho = diseno.anchoUtil - sangria;
  const estilo = {
    fuente: atenuado ? FUENTE_CURSIVA : FUENTE,
    tamano: 10,
    color: atenuado ? COLORES.suave : COLORES.texto,
  };

  bloques.forEach((bloque, indice) => {
    aplicarEstilo(doc, estilo);
    if (bloque.tipo === 'parrafo') {
      doc.text(imprimible(bloque.texto), x, doc.y, { width: ancho, align: 'justify', lineGap: 2 });
      doc.moveDown(0.5);
      return;
    }
    const marca = bloque.tipo === 'vineta' ? '•' : bloque.marca;
    const anchoMarca = Math.max(12, doc.widthOfString(marca) + 6);
    asegurarEspacio(doc, doc.currentLineHeight(true) + 2);
    const y = doc.y;
    doc.text(marca, x + 6, y, { width: anchoMarca, lineBreak: false });
    doc.text(imprimible(bloque.texto), x + 6 + anchoMarca, y, {
      width: ancho - 6 - anchoMarca,
      lineGap: 2,
    });
    const siguiente = bloques[indice + 1];
    doc.moveDown(siguiente && siguiente.tipo !== 'parrafo' ? 0.2 : 0.5);
  });
}

// Ancho de cada columna: como mínimo el de su palabra más larga (para no cortar
// palabras) y el espacio restante en proporción a la cantidad de texto que contiene.
function anchosColumnas(doc, columnas, filas, ancho) {
  if (columnas.every((c) => c.ancho)) return columnas.map((c) => c.ancho * ancho);
  const palabraMasLarga = (texto, fuente) => {
    aplicarEstilo(doc, { fuente, tamano: 9 });
    return Math.max(0, ...imprimible(texto).split(/\s+/).map((p) => doc.widthOfString(p)));
  };
  const minimos = columnas.map((columna, i) =>
    Math.max(
      24,
      palabraMasLarga(columna.titulo, FUENTE_NEGRITA),
      ...filas.map((fila) => palabraMasLarga(fila[i], FUENTE))
    ) + 10
  );
  const sumaMinimos = minimos.reduce((a, b) => a + b, 0);
  // Si ni siquiera los mínimos caben, se reparten proporcionalmente.
  if (sumaMinimos >= ancho) return minimos.map((m) => (m / sumaMinimos) * ancho);
  const pesos = columnas.map((columna, i) =>
    Math.max(
      1,
      ...[columna.titulo, ...filas.map((fila) => fila[i])].map((t) =>
        Math.min(String(t ?? '').length, 60)
      )
    )
  );
  const totalPesos = pesos.reduce((a, b) => a + b, 0);
  const sobrante = ancho - sumaMinimos;
  return minimos.map((m, i) => m + (pesos[i] / totalPesos) * sobrante);
}

// Tabla con encabezado. Si continúa en otra página, el encabezado se repite; el título,
// la descripción, el encabezado y la primera fila no se separan.
function dibujarTabla(doc, diseno, tabla, sangria = 0) {
  const x0 = MARGEN_LATERAL + sangria;
  const ancho = diseno.anchoUtil - sangria;
  const columnas = tabla.columnas.map((c) => (typeof c === 'string' ? { titulo: c } : c));
  if (columnas.length === 0) return;
  const filas = (tabla.filas ?? []).map((fila) => columnas.map((_, i) => fila[i] ?? ''));
  const anchos = anchosColumnas(doc, columnas, filas, ancho);
  const encabezado = columnas.map((c) => c.titulo);

  function estiloFila(esEncabezado) {
    aplicarEstilo(doc, {
      fuente: esEncabezado ? FUENTE_NEGRITA : FUENTE,
      tamano: 9,
      color: COLORES.texto,
    });
  }

  function altoFila(celdas, esEncabezado) {
    estiloFila(esEncabezado);
    return (
      Math.max(
        doc.currentLineHeight(true),
        ...celdas.map((t, i) => doc.heightOfString(imprimible(t), { width: anchos[i] - 8 }))
      ) + 8
    );
  }

  function fila(celdas, esEncabezado) {
    const alto = altoFila(celdas, esEncabezado);
    const y = doc.y;
    if (esEncabezado) {
      doc.save().rect(x0, y, ancho, alto).fill('#fdf1f5').restore();
    }
    estiloFila(esEncabezado);
    let x = x0;
    celdas.forEach((t, i) => {
      doc.text(imprimible(t), x + 4, y + 4, { width: anchos[i] - 8 });
      x += anchos[i];
    });
    doc
      .moveTo(x0, y + alto)
      .lineTo(x0 + ancho, y + alto)
      .lineWidth(esEncabezado ? 1.2 : 0.6)
      .strokeColor(esEncabezado ? COLORES.acento : COLORES.separador);
    if (!esEncabezado) doc.dash(2, { space: 2 });
    doc.stroke().undash();
    doc.x = MARGEN_LATERAL;
    doc.y = y + alto;
  }

  const altoInicio =
    altoFila(encabezado, true) + (filas.length > 0 ? altoFila(filas[0], false) : 0);
  if (tabla.titulo) {
    asegurarEspacio(doc, 18 + altoInicio);
    aplicarEstilo(doc, { fuente: FUENTE_NEGRITA, tamano: 10, color: COLORES.texto });
    doc.text(imprimible(tabla.titulo), x0, doc.y, { width: ancho });
    doc.moveDown(0.3);
  }
  if (tabla.descripcion) dibujarTexto(doc, diseno, { texto: tabla.descripcion }, sangria);
  asegurarEspacio(doc, altoInicio);
  fila(encabezado, true);
  for (const celdas of filas) {
    if (doc.y + altoFila(celdas, false) > limiteInferior(doc)) {
      doc.addPage();
      fila(encabezado, true);
    }
    fila(celdas, false);
  }
  doc.moveDown(0.8);
}

// Pares «Etiqueta: valor» (por ejemplo, los antecedentes personales).
function dibujarCampos(doc, diseno, campos = []) {
  for (const { etiqueta, valor } of campos) {
    aplicarEstilo(doc, { fuente: FUENTE_NEGRITA, tamano: 10, color: COLORES.texto });
    doc.text(`${imprimible(etiqueta)}: `, MARGEN_LATERAL, doc.y, {
      width: diseno.anchoUtil,
      continued: true,
      lineGap: 2,
    });
    aplicarEstilo(doc, { fuente: FUENTE, tamano: 10 });
    doc.text(imprimible(valor), { lineGap: 2 });
  }
  if (campos.length > 0) doc.moveDown(0.5);
}

const ESTILOS_SUBTITULO = Object.freeze([
  { fuente: FUENTE_NEGRITA, tamano: 10.5, color: COLORES.texto },
  { fuente: FUENTE_NEGRITA, tamano: 10, color: COLORES.suave },
]);
const SANGRIA_NIVEL = 12;

// Contenido común de secciones y subsecciones: campos, texto, tablas y subsecciones
// anidadas (por ejemplo, áreas con sus apartados).
function dibujarCuerpo(doc, diseno, bloque, nivel, sangria) {
  dibujarCampos(doc, diseno, bloque.campos);
  dibujarTexto(doc, diseno, bloque, sangria);
  const tablas = bloque.tablas ?? (bloque.tabla ? [bloque.tabla] : []);
  for (const tabla of tablas) dibujarTabla(doc, diseno, tabla, sangria);
  for (const subseccion of bloque.subsecciones ?? []) {
    dibujarSubseccion(doc, diseno, subseccion, nivel + 1, sangria + (nivel > 0 ? SANGRIA_NIVEL : 0));
  }
}

function dibujarSubseccion(doc, diseno, subseccion, nivel, sangria) {
  // El subtítulo no queda solo al final de la página: se reserva espacio para algunas
  // líneas de su contenido (o para el subtítulo de su primer apartado).
  asegurarEspacio(doc, subseccion.subsecciones?.length ? 70 : 46);
  if (subseccion.titulo) {
    aplicarEstilo(doc, ESTILOS_SUBTITULO[Math.min(nivel - 1, ESTILOS_SUBTITULO.length - 1)]);
    doc.text(imprimible(subseccion.titulo), MARGEN_LATERAL + sangria, doc.y, {
      width: diseno.anchoUtil - sangria,
    });
    doc.moveDown(0.25);
  }
  dibujarCuerpo(doc, diseno, subseccion, nivel, sangria);
}

function dibujarContenido(doc, diseno, { datosCabecera = [], secciones = [] }) {
  doc.x = MARGEN_LATERAL;
  if (datosCabecera.length > 0) {
    aplicarEstilo(doc, { fuente: FUENTE, tamano: 10, color: COLORES.suave });
    datosCabecera.forEach((linea) => doc.text(imprimible(linea), { width: diseno.anchoUtil }));
    doc.moveDown(0.8);
  }
  for (const seccion of secciones) {
    // Evita dejar el título de una sección solo al final de la página.
    asegurarEspacio(doc, seccion.subsecciones?.length || seccion.tablas?.length ? 76 : 48);
    aplicarEstilo(doc, { fuente: FUENTE_NEGRITA, tamano: 11, color: COLORES.texto });
    doc.text(imprimible(seccion.titulo), MARGEN_LATERAL, doc.y, { width: diseno.anchoUtil });
    doc.moveDown(0.3);
    dibujarCuerpo(doc, diseno, seccion, 0, 0);
    doc.moveDown(0.6);
  }
}

// Genera el informe y devuelve el PDF completo como Buffer. `configuracion` es la que
// entrega ConfiguracionInforme.obtenerVigente({ conLogo: true }); el logo solo se
// dibuja si trae sus bytes (`logo.datos`).
function generarInformePdf({
  configuracion = {},
  titulo = 'Informe psicopedagógico',
  datosCabecera,
  secciones,
  marcaAgua,
  pieProfesional,
}) {
  return new Promise((resolve, reject) => {
    try {
      const conLogo = configuracion.logo?.datos ? configuracion : { ...configuracion, logo: null };
      const diseno = disenar(new PDFDocument({ size: 'A4' }), conLogo, titulo, pieProfesional);
      const doc = new PDFDocument({
        size: 'A4',
        bufferPages: true,
        margins: {
          top: diseno.contenido.superior,
          bottom: diseno.contenido.inferior,
          left: MARGEN_LATERAL,
          right: MARGEN_LATERAL,
        },
        info: { Title: imprimible(titulo), Creator: 'SGP', Producer: 'SGP' },
      });

      const partes = [];
      doc.on('data', (parte) => partes.push(parte));
      doc.on('end', () => resolve(Buffer.concat(partes)));
      doc.on('error', reject);

      // Se abre una sola vez para que la imagen se incruste una vez en el archivo.
      const imagenLogo = conLogo.logo ? doc.openImage(conLogo.logo.datos) : null;
      dibujarContenido(doc, diseno, { datosCabecera, secciones });

      // Encabezado y pie se dibujan al final para conocer el total de páginas.
      const { start, count } = doc.bufferedPageRange();
      for (let i = start; i < start + count; i += 1) {
        doc.switchToPage(i);
        // Sin margen inferior, el pie no provoca saltos de página automáticos.
        doc.page.margins.bottom = 0;
        if (marcaAgua) dibujarMarcaAgua(doc, marcaAgua);
        dibujarEncabezado(doc, diseno, imagenLogo);
        dibujarPie(doc, diseno, i - start + 1, count);
      }
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Informe de prueba con datos ficticios, generado en memoria: no lee ni guarda
// información de menores.
const MARCA_VISTA_PREVIA = 'DATOS FICTICIOS · VISTA PREVIA';
const MARCA_AGUA_VISTA_PREVIA = 'DATOS FICTICIOS';

function generarVistaPreviaPdf(configuracion) {
  const sesiones = [
    ['05 Nov', 'Ampliar vocabulario temático', 'Logrado'],
    ['12 Nov', 'Comprensión de textos breves', 'Parcialmente logrado'],
    ['19 Nov', 'Fluidez lectora', 'Parcialmente logrado'],
    ['26 Nov', 'Secuencias narrativas', 'Logrado'],
  ];
  const parrafo =
    'Texto de ejemplo para la vista previa. No corresponde a ningún menor ni a información ' +
    'registrada en el sistema; solo permite revisar la presentación del encabezado, el logo ' +
    'y el pie de página en un documento de varias páginas.';
  return generarInformePdf({
    configuracion,
    marcaAgua: MARCA_AGUA_VISTA_PREVIA,
    // Cada psicopedagogo define sus datos; aquí se muestra un ejemplo ficticio.
    pieProfesional: 'Profesional Ficticio · Título profesional · Registro: 0000 (ejemplo)',
    datosCabecera: [
      MARCA_VISTA_PREVIA,
      'Menor Ficticio 01 · 9 años · 4° básico',
      'Profesional: Profesional Ficticio · Período: Noviembre 2026',
    ],
    secciones: [
      { titulo: '1. Antecedentes', parrafos: [parrafo, parrafo] },
      { titulo: '2. Diagnóstico', parrafos: [parrafo] },
      {
        titulo: '3. Sesiones realizadas',
        tabla: {
          columnas: [
            { titulo: 'Fecha', ancho: 0.18 },
            { titulo: 'Objetivo', ancho: 0.52 },
            { titulo: 'Logro', ancho: 0.3 },
          ],
          filas: sesiones,
        },
      },
      { titulo: '4. Avance por objetivo', parrafos: [parrafo, parrafo, parrafo] },
      {
        titulo: '5. Conclusiones y sugerencias',
        parrafos: [parrafo, parrafo, parrafo, parrafo, parrafo],
      },
    ],
  });
}

module.exports = {
  PAGINA,
  bloquesDeTexto,
  MARCA_VISTA_PREVIA,
  esImprimible,
  calcularDiseno,
  generarInformePdf,
  generarVistaPreviaPdf,
};
