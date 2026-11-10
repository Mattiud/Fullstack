const {
  bloquesDeTexto,
  calcularDiseno,
  generarInformePdf,
  generarVistaPreviaPdf,
  PAGINA,
} = require('../src/utils/informePdf');
const { TAMANOS_LOGO } = require('../src/config/informes');
const { crearPng } = require('./imagenes');
const { textoDelPdf, totalPaginas, tieneImagen, dimensionesImagenes } = require('./pdf');

// Datos ficticios: el contenido del informe no corresponde a ningún menor.
const PNG_ANCHO = crearPng(400, 100);
const logoAncho = { ancho: 400, alto: 100, datos: PNG_ANCHO };
const parrafo = 'Párrafo ficticio de prueba para completar varias páginas del informe. '.repeat(8);
const contenidoLargo = {
  datosCabecera: ['Menor Ficticio 99'],
  secciones: Array.from({ length: 8 }, (_, i) => ({
    titulo: `${i + 1}. Sección ficticia`,
    parrafos: [parrafo, parrafo],
  })),
};

function seCruzan(a, b) {
  return a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;
}

describe('Diseño del encabezado y pie del informe', () => {
  test.each(Object.keys(TAMANOS_LOGO))(
    'el logo conserva su proporción y cabe en la caja del tamaño %s',
    (tamanoLogo) => {
      const caja = TAMANOS_LOGO[tamanoLogo];
      for (const logo of [
        { ancho: 400, alto: 100 },
        { ancho: 100, alto: 400 },
        { ancho: 50, alto: 50 },
      ]) {
        const { logo: rect } = calcularDiseno({ tamanoLogo, logo });
        expect(rect.ancho / rect.alto).toBeCloseTo(logo.ancho / logo.alto, 6);
        expect(rect.ancho).toBeLessThanOrEqual(caja.ancho + 1e-9);
        expect(rect.alto).toBeLessThanOrEqual(caja.alto + 1e-9);
        // Ocupa todo el espacio disponible en al menos una dimensión.
        expect(
          Math.abs(rect.ancho - caja.ancho) < 1e-6 || Math.abs(rect.alto - caja.alto) < 1e-6
        ).toBe(true);
      }
    }
  );

  test.each([
    ['izquierda', 'izquierda'],
    ['izquierda', 'derecha'],
    ['centro', 'izquierda'],
    ['centro', 'derecha'],
    ['derecha', 'izquierda'],
    ['derecha', 'derecha'],
  ])(
    'con alineación %s y logo a la %s, el logo no se superpone con el texto ni con el contenido',
    (alineacionEncabezado, posicionLogo) => {
      for (const tamanoLogo of Object.keys(TAMANOS_LOGO)) {
        const diseno = calcularDiseno({
          alineacionEncabezado,
          posicionLogo,
          tamanoLogo,
          nombreInstitucion: 'Centro Psicopedagógico Ficticio de Prueba',
          logo: { ancho: 400, alto: 100 },
        });
        const { logo, texto } = diseno;
        expect(seCruzan(logo, texto)).toBe(false);
        expect(logo.x).toBeGreaterThanOrEqual(diseno.margenLateral);
        expect(logo.x + logo.ancho).toBeLessThanOrEqual(PAGINA.ancho - diseno.margenLateral + 1e-9);
        expect(posicionLogo === 'izquierda' ? logo.x < texto.x : logo.x > texto.x).toBe(true);
        expect(logo.y + logo.alto).toBeLessThan(diseno.yLinea);
        expect(texto.y + texto.alto).toBeLessThan(diseno.yLinea);
        expect(diseno.contenido.superior).toBeGreaterThan(diseno.yLinea);
      }
    }
  );

  test('el pie queda dentro de la página y bajo el área de contenido', () => {
    const diseno = calcularDiseno({
      textoPie: 'Dirección ficticia 123\nTeléfono +56 9 0000 0000\ncontacto@ficticio.cl',
      numeracionPaginas: true,
    });
    const limiteContenido = PAGINA.alto - diseno.contenido.inferior;
    expect(diseno.pie.yLinea).toBeGreaterThan(limiteContenido);
    expect(diseno.pie.y + diseno.pie.alto).toBeLessThanOrEqual(PAGINA.alto);
  });

  test('sin logo ni pie no se reserva espacio para ellos', () => {
    const conLogo = calcularDiseno({ tamanoLogo: 'grande', logo: { ancho: 100, alto: 100 } });
    const sinNada = calcularDiseno({ textoPie: '', numeracionPaginas: false });
    expect(sinNada.logo).toBeNull();
    expect(sinNada.pie).toBeNull();
    expect(sinNada.texto.ancho).toBe(sinNada.anchoUtil);
    expect(sinNada.texto.x).toBe(sinNada.margenLateral);
    // Sin logo, la banda del encabezado mide solo lo que ocupa el texto.
    expect(sinNada.contenido.superior).toBeLessThan(conLogo.contenido.superior);
    const soloNumeracion = calcularDiseno({ textoPie: '', numeracionPaginas: true });
    expect(sinNada.contenido.inferior).toBeLessThan(soloNumeracion.contenido.inferior);
  });
});

describe('Generación del PDF', () => {
  test('incorpora encabezado, pie y numeración en todas las páginas', async () => {
    const pdf = await generarInformePdf({
      configuracion: {
        nombreInstitucion: 'Centro Ficticio',
        textoPie: 'Av. Ficticia 123 · contacto@ficticio.cl',
        numeracionPaginas: true,
        logo: logoAncho,
      },
      ...contenidoLargo,
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const paginas = totalPaginas(pdf);
    expect(paginas).toBeGreaterThan(1);

    const texto = textoDelPdf(pdf);
    for (let i = 1; i <= paginas; i += 1) {
      expect(texto).toContain(`Página ${i} de ${paginas}`);
    }
    expect(texto.match(/Av\. Ficticia 123 · contacto@ficticio\.cl/g)).toHaveLength(paginas);
    expect(texto.match(/Centro Ficticio/g)).toHaveLength(paginas);
    expect(texto.match(/Informe psicopedagógico/g)).toHaveLength(paginas);

    // El logo se dibuja en cada página con la proporción original (4:1).
    const imagenes = dimensionesImagenes(pdf);
    expect(imagenes).toHaveLength(paginas);
    for (const { ancho, alto } of imagenes) expect(ancho / alto).toBeCloseTo(4, 3);
  });

  test('sin numeración no se imprime "Página"', async () => {
    const pdf = await generarInformePdf({
      configuracion: { numeracionPaginas: false, textoPie: 'Pie ficticio' },
      ...contenidoLargo,
    });
    const texto = textoDelPdf(pdf);
    expect(texto).not.toMatch(/Página \d+ de \d+/);
    expect(texto.match(/Pie ficticio/g)).toHaveLength(totalPaginas(pdf));
  });

  test('se genera sin logo ni pie configurados', async () => {
    const pdf = await generarInformePdf({
      configuracion: { textoPie: '', numeracionPaginas: false },
      ...contenidoLargo,
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(tieneImagen(pdf)).toBe(false);
    expect(textoDelPdf(pdf)).toContain('Informe psicopedagógico');
  });

  test('ignora un logo sin datos (configuración consultada sin los bytes)', async () => {
    const pdf = await generarInformePdf({
      configuracion: { logo: { ancho: 400, alto: 100 } },
      ...contenidoLargo,
    });
    expect(tieneImagen(pdf)).toBe(false);
  });

  test('reconoce viñetas, listas numeradas y párrafos sin alterar el texto', () => {
    expect(
      bloquesDeTexto('Párrafo.\n\n- Uno\n• Dos\n* Tres\n1. Cuatro\n2) Cinco\na) Seis\nA. Siete')
    ).toEqual([
      { tipo: 'parrafo', texto: 'Párrafo.' },
      { tipo: 'vineta', texto: 'Uno' },
      { tipo: 'vineta', texto: 'Dos' },
      { tipo: 'vineta', texto: 'Tres' },
      { tipo: 'numerado', marca: '1.', texto: 'Cuatro' },
      { tipo: 'numerado', marca: '2)', texto: 'Cinco' },
      { tipo: 'numerado', marca: 'a)', texto: 'Seis' },
      // Una mayúscula con punto (por ejemplo, una inicial) sigue siendo un párrafo.
      { tipo: 'parrafo', texto: 'A. Siete' },
    ]);
  });

  test('el pie con datos profesionales reserva su espacio sin invadir el contenido', () => {
    const sinProfesional = calcularDiseno({ textoPie: 'Pie ficticio', numeracionPaginas: true });
    const conProfesional = calcularDiseno(
      { textoPie: 'Pie ficticio', numeracionPaginas: true },
      { pieProfesional: 'Profesional Ficticio · Título ficticio · Registro: 0000' }
    );
    expect(conProfesional.pie.alto).toBeGreaterThan(sinProfesional.pie.alto);
    expect(conProfesional.contenido.inferior).toBeGreaterThan(sinProfesional.contenido.inferior);
    expect(conProfesional.pie.y + conProfesional.pie.alto).toBeLessThanOrEqual(PAGINA.alto);
    // Solo con los datos profesionales también hay pie.
    expect(
      calcularDiseno({ numeracionPaginas: false }, { pieProfesional: 'Profesional Ficticio' }).pie
    ).not.toBeNull();
  });

  test('dibuja pares etiqueta-valor y subsecciones', async () => {
    const pdf = await generarInformePdf({
      secciones: [
        {
          titulo: 'ANTECEDENTES PERSONALES',
          campos: [
            { etiqueta: 'Nombre', valor: 'Menor Ficticio' },
            { etiqueta: 'Curso', valor: '4° básico' },
          ],
        },
        {
          titulo: 'SUGERENCIAS',
          subsecciones: [
            { titulo: 'Familia', parrafos: ['Texto ficticio para la familia.'] },
            { titulo: 'Niño', parrafos: ['(Sección sin completar)'], atenuado: true },
          ],
        },
      ],
    });
    const lineas = textoDelPdf(pdf).split('\n');
    for (const esperado of [
      'Nombre: ',
      'Menor Ficticio',
      'Curso: ',
      '4° básico',
      'Familia',
      'Niño',
      '(Sección sin completar)',
    ]) {
      expect(lineas).toContain(esperado);
    }
    expect(lineas.indexOf('Familia')).toBeLessThan(lineas.indexOf('Niño'));
  });

  test('la vista previa usa datos ficticios identificados', async () => {
    const pdf = await generarVistaPreviaPdf({ numeracionPaginas: true });
    const texto = textoDelPdf(pdf);
    expect(texto).toContain('DATOS FICTICIOS · VISTA PREVIA');
    expect(texto).toContain('Menor Ficticio 01');
    expect(texto).toContain(`Página 1 de ${totalPaginas(pdf)}`);
  });
});
