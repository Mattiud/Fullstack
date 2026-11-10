import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authApi from '../api/auth';
import * as menoresApi from '../api/menores';
import * as diagnosticosApi from '../api/diagnosticos';
import * as sesionesApi from '../api/sesiones';
import * as informesApi from '../api/informes';
import {
  APARTADOS_SUGERENCIAS,
  CAMPOS_OBLIGATORIOS_PDF,
  CAMPOS_TEXTO_INFORME,
  LIMITES_DATOS_PROFESIONALES,
  LIMITES_INFORME,
} from '../constants/informes';
import { edadCronologica, formatearEdadCronologica } from '../utils/edad';
import {
  errorHttp,
  renderApp,
  usuarioAdmin,
  usuarioPsico,
} from '../test-utils';

jest.mock('../api/auth');
jest.mock('../api/users');
jest.mock('../api/audit');
jest.mock('../api/menores');
jest.mock('../api/diagnosticos');
jest.mock('../api/sesiones');
jest.mock('../api/informes');
// pdf.js no funciona en jsdom: se reemplaza el visor por uno que muestra lo recibido.
jest.mock('../components/documentos/VisorPdf', () => ({
  __esModule: true,
  default: ({ datos }) =>
    require('react').createElement(
      'div',
      null,
      `PDF recibido: ${datos.byteLength} bytes`
    ),
}));

const backend = require('../../../Backend/src/config/informes.js');

// Datos ficticios.
const menorFicticio = {
  _id: 'menor-1',
  nombre: 'Menor Ficticio Uno',
  rut: '12345678-5',
  fechaNacimiento: '2016-03-12T00:00:00.000Z',
  fechaIngreso: '2026-03-04T00:00:00.000Z',
  curso: '4° básico',
  establecimiento: 'Escuela Ficticia',
  antecedentesRelevantes: 'Antecedentes del perfil ficticio.',
  apoderado: {
    nombre: 'Apoderado Ficticio',
    parentesco: 'Madre',
    telefono: '+56 9 1234 5678',
  },
  profesionalesAsignados: [],
  activo: true,
};

const tablaFicticia = {
  titulo: 'Tabla ficticia',
  descripcion: '',
  columnas: ['Área de evaluación', 'Logrados'],
  filas: [['Área ficticia', '5']],
};

const areaFicticia = {
  titulo: 'Área ficticia',
  apartados: [{ titulo: 'Apartado ficticio', texto: 'Texto ficticio.' }],
};

const contenidoCompleto = {
  fechaInforme: '2026-11-02T00:00:00.000Z',
  curso: '4° básico',
  establecimiento: 'Escuela Ficticia',
  antecedentesRelevantes: 'Antecedentes ficticios.',
  motivoConsulta: 'Derivación ficticia.',
  instrumentoEvaluativo: 'Instrumento ficticio.',
  areasEvaluacion: 'Áreas ficticias.',
  analisisCuantitativo: '',
  tablasCuantitativas: [tablaFicticia],
  objetivoEvaluacion: 'Objetivo ficticio.',
  analisisCualitativo: '',
  areasCualitativas: [areaFicticia],
  conclusion: 'Conclusión ficticia.',
  sugerencias: {
    familia: 'Familia ficticia.',
    escuela: 'Escuela ficticia.',
    nino: 'Niño ficticio.',
  },
};

function informeFicticio(cambios = {}) {
  return {
    _id: 'informe-1',
    menor: {
      _id: 'menor-1',
      nombre: 'Menor Ficticio Uno',
      fechaNacimiento: '2016-03-12T00:00:00.000Z',
    },
    ...contenidoCompleto,
    pdfs: [],
    ultimoPdf: null,
    pdfDesactualizado: false,
    creadoPor: { _id: 'psico-1', nombre: 'Profesional Ficticio' },
    actualizadoPor: { _id: 'psico-1', nombre: 'Profesional Ficticio' },
    contenidoActualizadoEn: '2026-11-02T13:00:00.000Z',
    createdAt: '2026-11-02T12:00:00.000Z',
    updatedAt: '2026-11-02T13:00:00.000Z',
    ...cambios,
  };
}

beforeEach(() => {
  menoresApi.obtenerMenor.mockResolvedValue(menorFicticio);
  menoresApi.listarDocumentos.mockResolvedValue({
    documentos: [],
    limites: { maxBytes: 1024, extensiones: ['.pdf'], mimes: [] },
  });
  diagnosticosApi.listarDiagnosticosMenor.mockResolvedValue([]);
  sesionesApi.listarSesionesMenor.mockResolvedValue([]);
  informesApi.listarInformesMenor.mockResolvedValue([]);
  informesApi.obtenerInforme.mockResolvedValue(informeFicticio());
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  jest.spyOn(window, 'confirm').mockImplementation(() => true);
});

afterEach(() => {
  expect(window.alert).not.toHaveBeenCalled();
  expect(window.confirm).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

function iniciar(usuario = usuarioPsico, ruta = '/') {
  authApi.obtenerSesion.mockResolvedValue(usuario);
  const user = userEvent.setup();
  renderApp(ruta);
  return user;
}

async function abrirInforme(informe = informeFicticio()) {
  informesApi.obtenerInforme.mockResolvedValue(informe);
  const user = iniciar(usuarioPsico, '/menores/menor-1/informes/informe-1');
  await screen.findByLabelText('Fecha del informe *');
  return user;
}

function indice() {
  return screen.getByRole('navigation', { name: 'Secciones del informe' });
}

async function irASeccion(user, nombre) {
  await user.click(
    within(indice()).getByRole('button', { name: new RegExp(nombre) })
  );
}

describe('Acceso', () => {
  test('el psicopedagogo ve «Informes» en el menú y en la ficha', async () => {
    informesApi.listarInformesMenor.mockResolvedValue([
      informeFicticio({ ultimoPdf: { version: 1 } }),
    ]);
    const user = iniciar(usuarioPsico, '/menores/menor-1');
    const menu = await screen.findByRole('navigation', { name: 'Principal' });
    expect(
      within(menu).getByRole('link', { name: 'Informes' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Datos profesionales' })
    ).toBeInTheDocument();

    await user.click(await screen.findByRole('tab', { name: 'Informes (1)' }));
    expect(screen.getByText('PDF v1')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '+ Nuevo informe' })
    ).toHaveAttribute('href', '/informes/nuevo?menor=menor-1');
  });

  test('el administrador no ve los informes ni puede abrirlos', async () => {
    iniciar(usuarioAdmin, '/menores/menor-1');
    const menu = await screen.findByRole('navigation', { name: 'Principal' });
    await screen.findByRole('tab', { name: /Resumen/ });
    expect(
      within(menu).queryByRole('link', { name: 'Informes' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Datos profesionales' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: /Informes/ })
    ).not.toBeInTheDocument();
    expect(informesApi.listarInformesMenor).not.toHaveBeenCalled();
  });

  test('las rutas de informes y datos profesionales redirigen al administrador', async () => {
    iniciar(usuarioAdmin, '/informes');
    expect(
      await screen.findByRole('heading', { name: 'Acceso no autorizado' })
    ).toBeInTheDocument();
    expect(informesApi.listarInformes).not.toHaveBeenCalled();
  });
});

describe('Listado de informes', () => {
  test('muestra el menor, la fecha y el estado del PDF', async () => {
    informesApi.listarInformes.mockResolvedValue({
      informes: [
        informeFicticio({ _id: 'a' }),
        informeFicticio({ _id: 'b', ultimoPdf: { version: 2 } }),
        informeFicticio({
          _id: 'c',
          ultimoPdf: { version: 1 },
          pdfDesactualizado: true,
        }),
      ],
      total: 3,
      pagina: 1,
      limite: 20,
    });
    iniciar(usuarioPsico, '/informes');
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getAllByText('Menor Ficticio Uno')).toHaveLength(3);
    expect(within(tabla).getByText('Borrador')).toBeInTheDocument();
    expect(within(tabla).getByText('PDF v2')).toBeInTheDocument();
    expect(
      within(tabla).getByText('Modificado después del PDF')
    ).toBeInTheDocument();
  });
});

describe('Nuevo informe', () => {
  test('recupera los datos del perfil y calcula la edad a la fecha del informe', async () => {
    const user = iniciar(usuarioPsico, '/informes/nuevo?menor=menor-1');
    const datos = await screen.findByLabelText('Datos del perfil del menor');
    expect(within(datos).getByText('Menor Ficticio Uno')).toBeInTheDocument();
    expect(within(datos).getByText('12/03/2016')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /^Nombre/ })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Curso')).toHaveValue('4° básico');
    expect(screen.getByLabelText('Establecimiento')).toHaveValue(
      'Escuela Ficticia'
    );

    const fecha = screen.getByLabelText('Fecha del informe *');
    fireEvent.change(fecha, { target: { value: '2026-11-02' } });
    expect(screen.getByTestId('edad-cronologica')).toHaveTextContent(
      '10 años y 7 meses'
    );
    fireEvent.change(fecha, { target: { value: '2026-03-11' } });
    expect(screen.getByTestId('edad-cronologica')).toHaveTextContent(
      '9 años y 11 meses'
    );

    // Antecedentes relevantes se proponen desde el perfil; el resto parte vacío.
    await irASeccion(user, 'Antecedentes relevantes');
    expect(screen.getByLabelText('Antecedentes relevantes *')).toHaveValue(
      'Antecedentes del perfil ficticio.'
    );
    await irASeccion(user, 'Derivación y motivo');
    expect(
      screen.getByLabelText('Derivación y motivo de consulta *')
    ).toHaveValue('');
    await irASeccion(user, 'Resultados cuantitativos');
    expect(screen.getByText(/Aún no hay tablas/)).toBeInTheDocument();
    await irASeccion(user, 'Análisis cualitativo');
    expect(screen.getByText(/Aún no hay áreas/)).toBeInTheDocument();
  });

  test('el formulario se recorre por secciones con anterior y siguiente', async () => {
    const user = iniciar(usuarioPsico, '/informes/nuevo?menor=menor-1');
    await screen.findByLabelText('Fecha del informe *');
    expect(
      within(indice()).getByRole('button', { current: 'step' })
    ).toHaveTextContent('1. Antecedentes personales');
    expect(within(indice()).getAllByRole('button')).toHaveLength(9);

    await user.click(
      screen.getByRole('button', { name: /Siguiente: Antecedentes relevantes/ })
    );
    expect(
      screen.getByRole('heading', { name: 'Antecedentes relevantes' })
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /Anterior: Antecedentes personales/ })
    );
    expect(screen.getByLabelText('Fecha del informe *')).toBeInTheDocument();
  });

  test('guarda el avance con todos los campos y abre el informe guardado', async () => {
    informesApi.crearInforme.mockResolvedValue(informeFicticio());
    const user = iniciar(usuarioPsico, '/informes/nuevo?menor=menor-1');
    fireEvent.change(await screen.findByLabelText('Fecha del informe *'), {
      target: { value: '2026-11-02' },
    });
    await irASeccion(user, 'Derivación y motivo');
    await user.type(
      screen.getByLabelText('Derivación y motivo de consulta *'),
      'Derivación escrita por el profesional.'
    );
    expect(
      screen.queryByRole('button', { name: 'Generar PDF' })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Guardar avance' }));
    expect(informesApi.crearInforme).toHaveBeenCalledWith('menor-1', {
      fechaInforme: '2026-11-02',
      curso: '4° básico',
      establecimiento: 'Escuela Ficticia',
      antecedentesRelevantes: 'Antecedentes del perfil ficticio.',
      motivoConsulta: 'Derivación escrita por el profesional.',
      instrumentoEvaluativo: '',
      areasEvaluacion: '',
      analisisCuantitativo: '',
      tablasCuantitativas: [],
      objetivoEvaluacion: '',
      analisisCualitativo: '',
      areasCualitativas: [],
      conclusion: '',
      sugerencias: { familia: '', escuela: '', nino: '' },
    });
    expect(
      await screen.findByText('Informe guardado como borrador')
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(informesApi.obtenerInforme).toHaveBeenCalledWith(
        'menor-1',
        'informe-1'
      )
    );
  });

  test('desde el listado se elige el menor con el buscador', async () => {
    menoresApi.buscarMenores.mockResolvedValue([
      { _id: 'menor-1', nombre: 'Menor Ficticio Uno', rut: '12345678-5' },
    ]);
    const user = iniciar(usuarioPsico, '/informes/nuevo');
    await user.type(await screen.findByRole('combobox'), 'Menor');
    await user.click(
      await screen.findByRole('option', { name: /Menor Ficticio Uno/ })
    );
    expect(await screen.findByLabelText('Curso')).toHaveValue('4° básico');
    expect(menoresApi.obtenerMenor).toHaveBeenCalledWith('menor-1');
  });
});

describe('Tablas de resultados cuantitativos', () => {
  test('agrega tablas, filas y columnas, y guarda los datos tal como se ingresan', async () => {
    informesApi.actualizarInforme.mockImplementation(async (_m, _i, datos) =>
      informeFicticio(datos)
    );
    const user = await abrirInforme(
      informeFicticio({ tablasCuantitativas: [] })
    );
    await irASeccion(user, 'Resultados cuantitativos');
    await user.click(
      screen.getByRole('button', { name: '+ Tabla con columnas de referencia' })
    );
    const tabla = screen.getByRole('region', { name: 'Tabla 1' });
    expect(
      within(tabla).getByLabelText('Encabezado de la columna 1 (tabla 1)')
    ).toHaveValue('Área de evaluación');
    // Las celdas parten vacías: el sistema no completa ni calcula resultados.
    expect(
      within(tabla).getByLabelText('Fila 1, % de logro (tabla 1)')
    ).toHaveValue('');

    await user.type(
      within(tabla).getByLabelText('Fila 1, Área de evaluación (tabla 1)'),
      'Área uno'
    );
    await user.type(
      within(tabla).getByLabelText('Fila 1, % de logro (tabla 1)'),
      '80%'
    );
    await user.click(
      within(tabla).getByRole('button', { name: 'Agregar fila a la tabla 1' })
    );
    await user.type(
      within(tabla).getByLabelText('Fila 2, Área de evaluación (tabla 1)'),
      'Área dos'
    );
    await user.click(
      within(tabla).getByRole('button', {
        name: 'Agregar columna a la tabla 1',
      })
    );
    await user.type(
      within(tabla).getByLabelText('Encabezado de la columna 5 (tabla 1)'),
      'Nivel'
    );
    // La columna tiene encabezado: se pide confirmación antes de eliminarla.
    await user.click(
      within(tabla).getByRole('button', {
        name: 'Eliminar columna 3 de la tabla 1',
      })
    );
    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo).toHaveTextContent('«Logrados»');
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    await user.click(screen.getByRole('button', { name: 'Guardar avance' }));
    expect(informesApi.actualizarInforme).toHaveBeenCalledWith(
      'menor-1',
      'informe-1',
      expect.objectContaining({
        tablasCuantitativas: [
          {
            titulo: '',
            descripcion: '',
            columnas: [
              'Área de evaluación',
              'Total de ítems',
              '% de logro',
              'Nivel',
            ],
            filas: [
              ['Área uno', '', '80%', ''],
              ['Área dos', '', '', ''],
            ],
          },
        ],
      }),
      '2026-11-02T13:00:00.000Z'
    );
  });

  test('«Total de ítems» y «Logrados» solo aceptan enteros y el % se calcula', async () => {
    const user = await abrirInforme(
      informeFicticio({ tablasCuantitativas: [] })
    );
    await irASeccion(user, 'Resultados cuantitativos');
    await user.click(
      screen.getByRole('button', { name: '+ Tabla con columnas de referencia' })
    );
    const tabla = screen.getByRole('region', { name: 'Tabla 1' });
    const total = within(tabla).getByLabelText(
      'Fila 1, Total de ítems (tabla 1)'
    );
    const logrados = within(tabla).getByLabelText('Fila 1, Logrados (tabla 1)');
    const area = within(tabla).getByLabelText(
      'Fila 1, Área de evaluación (tabla 1)'
    );

    // Solo se conservan los dígitos; las demás columnas aceptan texto.
    await user.type(total, '1a2,x');
    expect(total).toHaveValue('12');
    await user.type(logrados, 'siete7');
    expect(logrados).toHaveValue('7');
    await user.type(area, 'Área 1, lectura');
    expect(area).toHaveValue('Área 1, lectura');

    // 7 de 12 = 58 %, calculado y sin edición.
    let porcentaje = within(tabla).getByLabelText(
      'Fila 1, % de logro (tabla 1)'
    );
    expect(porcentaje).toHaveValue('58%');
    expect(porcentaje).toBeDisabled();

    // Si Logrados supera el total no hay cálculo: el % se escribe a mano.
    await user.clear(logrados);
    await user.type(logrados, '13');
    porcentaje = within(tabla).getByLabelText('Fila 1, % de logro (tabla 1)');
    expect(porcentaje).toBeEnabled();
    expect(porcentaje).toHaveValue('');
  });

  test('pide confirmación dentro de la aplicación para eliminar datos', async () => {
    const user = await abrirInforme();
    await irASeccion(user, 'Resultados cuantitativos');
    const tabla = screen.getByRole('region', { name: 'Tabla 1' });

    await user.click(
      within(tabla).getByRole('button', {
        name: 'Eliminar fila 1 de la tabla 1',
      })
    );
    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo).toHaveTextContent('Se eliminará la fila 1');
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(
      within(tabla).getByLabelText('Fila 1, Área de evaluación (tabla 1)')
    ).toHaveValue('Área ficticia');

    await user.click(screen.getByRole('button', { name: 'Eliminar tabla 1' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Eliminar',
      })
    );
    expect(
      screen.queryByRole('region', { name: 'Tabla 1' })
    ).not.toBeInTheDocument();
  });
});

describe('Análisis cualitativo por áreas', () => {
  test('agrega, ordena y elimina áreas y apartados', async () => {
    informesApi.actualizarInforme.mockImplementation(async (_m, _i, datos) =>
      informeFicticio(datos)
    );
    const user = await abrirInforme(informeFicticio({ areasCualitativas: [] }));
    await irASeccion(user, 'Análisis cualitativo');

    await user.click(screen.getByRole('button', { name: '+ Área' }));
    await user.type(screen.getByLabelText('Nombre del área 1 *'), 'Lenguaje');
    await user.type(
      screen.getByLabelText('Subtítulo del apartado a) del área 1 (opcional)'),
      'Comprensión'
    );
    await user.type(
      screen.getByLabelText('Texto del apartado a) del área 1 *'),
      'Observación del profesional.'
    );
    await user.click(
      screen.getByRole('button', { name: 'Agregar apartado al área 1' })
    );
    await user.type(
      screen.getByLabelText('Texto del apartado b) del área 1 *'),
      'Segundo apartado.'
    );

    await user.click(screen.getByRole('button', { name: '+ Área' }));
    await user.type(screen.getByLabelText('Nombre del área 2 *'), 'Matemática');
    await user.type(
      screen.getByLabelText('Texto del apartado a) del área 2 *'),
      'Texto de matemática.'
    );
    await user.click(screen.getByRole('button', { name: 'Subir área 2' }));
    expect(screen.getByLabelText('Nombre del área 1 *')).toHaveValue(
      'Matemática'
    );

    // Eliminar un apartado con texto pide confirmación.
    await user.click(
      screen.getByRole('button', { name: 'Eliminar apartado b) del área 2' })
    );
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Eliminar',
      })
    );

    await user.click(screen.getByRole('button', { name: 'Guardar avance' }));
    expect(informesApi.actualizarInforme).toHaveBeenCalledWith(
      'menor-1',
      'informe-1',
      expect.objectContaining({
        areasCualitativas: [
          {
            titulo: 'Matemática',
            apartados: [{ titulo: '', texto: 'Texto de matemática.' }],
          },
          {
            titulo: 'Lenguaje',
            apartados: [
              {
                titulo: 'Comprensión',
                texto: 'Observación del profesional.',
              },
            ],
          },
        ],
      }),
      '2026-11-02T13:00:00.000Z'
    );
  });
});

describe('Vista previa y PDF', () => {
  test('no genera el PDF si faltan secciones y muestra la primera incompleta', async () => {
    const user = await abrirInforme(
      informeFicticio({
        motivoConsulta: '',
        tablasCuantitativas: [{ ...tablaFicticia, filas: [['', '']] }],
        sugerencias: { familia: 'x', escuela: '', nino: '' },
      })
    );
    await user.click(screen.getByRole('button', { name: 'Generar PDF' }));
    expect(informesApi.generarPdfInforme).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: 'Derivación y motivo de consulta' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Complete la derivación y motivo de consulta')
    ).toBeInTheDocument();
    expect(
      within(indice()).getByRole('button', {
        name: /Resultados cuantitativos \(con errores\)/,
      })
    ).toBeInTheDocument();
    await irASeccion(user, 'Resultados cuantitativos');
    expect(
      screen.getByText('La tabla 1 no tiene datos; complétela o elimínela')
    ).toBeInTheDocument();
  });

  test('genera el PDF tras confirmar y muestra la nueva versión', async () => {
    const pdf = {
      version: 1,
      tamano: 4096,
      fecha: '2026-11-02T14:00:00.000Z',
      generadoPor: { nombre: 'Profesional Ficticio' },
    };
    informesApi.generarPdfInforme.mockResolvedValue({
      version: 1,
      informe: informeFicticio({ pdfs: [pdf], ultimoPdf: pdf }),
    });
    const user = await abrirInforme();
    // Todas las secciones aparecen completas.
    expect(
      within(indice()).getAllByRole('button', { name: /\(completa\)/ })
    ).toHaveLength(9);
    await user.click(screen.getByRole('button', { name: 'Generar PDF' }));
    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo).toHaveTextContent('datos profesionales');
    await user.click(
      within(dialogo).getByRole('button', { name: 'Generar PDF' })
    );
    expect(informesApi.generarPdfInforme).toHaveBeenCalledWith(
      'menor-1',
      'informe-1',
      '2026-11-02T13:00:00.000Z'
    );
    expect(
      await screen.findByText('PDF generado (versión 1)')
    ).toBeInTheDocument();
    const versiones = screen.getByRole('list', { name: 'Versiones del PDF' });
    expect(within(versiones).getByText('Versión 1')).toBeInTheDocument();
  });

  test('con cambios sin guardar, guarda antes de generar', async () => {
    const editado = informeFicticio({
      conclusion: 'Nueva conclusión.',
      updatedAt: '2026-11-02T15:00:00.000Z',
    });
    informesApi.actualizarInforme.mockResolvedValue(editado);
    informesApi.generarPdfInforme.mockResolvedValue({
      version: 1,
      informe: editado,
    });
    const user = await abrirInforme();
    await irASeccion(user, 'Conclusión');
    const conclusion = screen.getByLabelText('Conclusión psicopedagógica *');
    await user.clear(conclusion);
    await user.type(conclusion, 'Nueva conclusión.');
    await user.click(screen.getByRole('button', { name: 'Generar PDF' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Generar PDF',
      })
    );
    expect(informesApi.actualizarInforme).toHaveBeenCalled();
    expect(informesApi.generarPdfInforme).toHaveBeenCalledWith(
      'menor-1',
      'informe-1',
      '2026-11-02T15:00:00.000Z'
    );
  });

  test('la vista previa usa el contenido sin guardar y no guarda', async () => {
    informesApi.vistaPreviaInforme.mockResolvedValue(new ArrayBuffer(16));
    const user = await abrirInforme();
    await irASeccion(user, 'Derivación y motivo');
    await user.type(
      screen.getByLabelText('Derivación y motivo de consulta *'),
      ' Agregado.'
    );
    await user.click(screen.getByRole('button', { name: 'Vista previa' }));
    expect(informesApi.vistaPreviaInforme).toHaveBeenCalledWith(
      'menor-1',
      'informe-1',
      expect.objectContaining({
        motivoConsulta: 'Derivación ficticia. Agregado.',
        tablasCuantitativas: [tablaFicticia],
        areasCualitativas: [areaFicticia],
      })
    );
    const modal = await screen.findByRole('dialog', {
      name: 'Vista previa del informe',
    });
    expect(
      await within(modal).findByText('PDF recibido: 16 bytes')
    ).toBeInTheDocument();
    expect(informesApi.actualizarInforme).not.toHaveBeenCalled();
  });

  test('muestra y descarga las versiones generadas', async () => {
    const pdfs = [1, 2].map((version) => ({
      version,
      tamano: 2048,
      fecha: `2026-11-0${version}T10:00:00.000Z`,
      generadoPor: { nombre: 'Profesional Ficticio' },
    }));
    informesApi.obtenerPdfInforme.mockResolvedValue(new ArrayBuffer(32));
    informesApi.descargarPdfInforme.mockResolvedValue();
    const user = await abrirInforme(
      informeFicticio({ pdfs, ultimoPdf: pdfs[1], pdfDesactualizado: true })
    );
    await irASeccion(user, 'PDF generados');
    expect(
      screen.getByText(/se modificó después del último PDF/)
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver versión 1' }));
    expect(informesApi.obtenerPdfInforme).toHaveBeenCalledWith(
      'menor-1',
      'informe-1',
      1
    );
    expect(
      await screen.findByText('PDF recibido: 32 bytes')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    await user.click(
      screen.getByRole('button', { name: 'Descargar versión 2' })
    );
    expect(informesApi.descargarPdfInforme).toHaveBeenCalledWith(
      'menor-1',
      expect.objectContaining({ _id: 'informe-1' }),
      2
    );
  });

  test('informa si otra persona modificó el informe', async () => {
    informesApi.actualizarInforme.mockRejectedValue(
      errorHttp(409, {
        error:
          'El informe fue modificado por otra persona. Recargue la página para ver la versión actual.',
      })
    );
    const user = await abrirInforme();
    await user.type(screen.getByLabelText('Curso'), ' A');
    await user.click(screen.getByRole('button', { name: 'Guardar avance' }));
    expect(
      await screen.findByText(/modificado por otra persona/)
    ).toBeInTheDocument();
  });
});

describe('Datos profesionales', () => {
  const conDatos = {
    ...usuarioPsico,
    datosProfesionales: { tituloProfesional: 'Psicopedagoga' },
  };

  test('muestra cómo quedará el pie y guarda los datos', async () => {
    authApi.guardarDatosProfesionales.mockResolvedValue({
      ...conDatos,
      datosProfesionales: {
        tituloProfesional: 'Psicopedagoga',
        registro: '0000-F',
      },
    });
    const user = iniciar(conDatos, '/datos-profesionales');
    expect(await screen.findByLabelText('Título profesional')).toHaveValue(
      'Psicopedagoga'
    );
    await user.type(screen.getByLabelText('N.º de registro'), '0000-F');
    expect(screen.getByTestId('vista-pie-profesional')).toHaveTextContent(
      'Profesional Ficticio · Psicopedagoga · Registro: 0000-F'
    );
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(authApi.guardarDatosProfesionales).toHaveBeenCalledWith({
      tituloProfesional: 'Psicopedagoga',
      registro: '0000-F',
      correo: '',
      telefono: '',
    });
    expect(
      await screen.findByText(/Datos profesionales guardados/)
    ).toBeInTheDocument();
  });

  test('valida el correo antes de guardar', async () => {
    const user = iniciar(usuarioPsico, '/datos-profesionales');
    await user.type(
      await screen.findByLabelText('Correo de contacto'),
      'no-es-correo'
    );
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText('Ingrese un correo válido')).toBeInTheDocument();
    expect(authApi.guardarDatosProfesionales).not.toHaveBeenCalled();
  });

  test('el administrador no accede a la página', async () => {
    iniciar(usuarioAdmin, '/datos-profesionales');
    expect(
      await screen.findByRole('heading', { name: 'Acceso no autorizado' })
    ).toBeInTheDocument();
  });
});

describe('Edad cronológica', () => {
  test.each([
    ['2016-03-12', '2026-11-02', '10 años y 7 meses'],
    ['2016-03-12', '2026-03-12', '10 años'],
    ['2025-10-20', '2026-11-20', '1 año y 1 mes'],
    ['2026-05-01', '2026-11-02', '6 meses'],
    ['2016-02-29', '2026-02-28', '10 años'],
  ])('de %s a %s', (nacimiento, referencia, esperado) => {
    expect(
      formatearEdadCronologica(edadCronologica(nacimiento, referencia))
    ).toBe(esperado);
  });
});

describe('Constantes sincronizadas con el backend', () => {
  test('mismos límites, campos y obligatorios', () => {
    expect(LIMITES_INFORME).toEqual(backend.LIMITES_INFORME);
    expect(CAMPOS_TEXTO_INFORME).toEqual([...backend.CAMPOS_TEXTO_INFORME]);
    expect(APARTADOS_SUGERENCIAS).toEqual([...backend.APARTADOS_SUGERENCIAS]);
    expect(CAMPOS_OBLIGATORIOS_PDF).toEqual([
      ...backend.CAMPOS_OBLIGATORIOS_PDF,
    ]);
    expect(LIMITES_DATOS_PROFESIONALES).toEqual(
      backend.LIMITES_DATOS_PROFESIONALES
    );
  });
});
