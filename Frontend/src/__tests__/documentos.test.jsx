import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authApi from '../api/auth';
import * as menoresApi from '../api/menores';
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

const menorFicticio = {
  _id: 'menor-1',
  nombre: 'Menor Ficticio Uno',
  rut: '12345678-5',
  edad: 10,
  fechaNacimiento: '2016-03-12T00:00:00.000Z',
  fechaIngreso: '2026-03-04T00:00:00.000Z',
  apoderado: {
    nombre: 'Apoderado Ficticio',
    parentesco: 'Madre',
    telefono: '+56 9 1234 5678',
  },
  antecedentesRelevantes: 'Antecedentes de ejemplo.',
  profesionalesAsignados: [],
  activo: true,
};

const pdf = {
  _id: 'doc-1',
  nombreOriginal: 'Evaluación inicial.pdf',
  tipo: 'pdf',
  mimeType: 'application/pdf',
  tamano: 25278,
  createdAt: '2026-10-21T12:00:00.000Z',
  subidoPor: { nombre: usuarioPsico.nombre },
};
const docx = {
  ...pdf,
  _id: 'doc-2',
  nombreOriginal: 'Informe escolar.docx',
  tipo: 'docx',
};

const limites = {
  maxBytes: 1024 * 1024,
  extensiones: ['.pdf', '.docx', '.doc'],
  mimes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ],
};

beforeEach(() => {
  menoresApi.obtenerMenor.mockResolvedValue(menorFicticio);
  menoresApi.listarDocumentos.mockResolvedValue({
    documentos: [pdf, docx],
    limites,
  });
});

async function abrirDocumentos(usuario = usuarioPsico) {
  authApi.obtenerSesion.mockResolvedValue(usuario);
  // applyAccept: false permite probar la validación propia con archivos no admitidos.
  const user = userEvent.setup({ applyAccept: false });
  renderApp('/menores/menor-1?pestana=documentos');
  await screen.findByRole('tab', { name: 'Documentos (2)', selected: true });
  return user;
}

describe('Documentos adjuntos', () => {
  test('lista los documentos con su tipo, tamaño y autor', async () => {
    await abrirDocumentos();
    const fila = screen
      .getByRole('cell', { name: 'Evaluación inicial.pdf' })
      .closest('tr');

    expect(within(fila).getByText('PDF')).toBeInTheDocument();
    expect(within(fila).getByText('25 KB')).toBeInTheDocument();
    expect(within(fila).getByText(usuarioPsico.nombre)).toBeInTheDocument();
    expect(screen.getByText('Arrastrar archivos aquí')).toBeInTheDocument();
  });

  test('el administrador puede ver pero no subir ni eliminar documentos', async () => {
    await abrirDocumentos(usuarioAdmin);

    expect(
      screen.getByRole('button', { name: 'Ver Evaluación inicial.pdf' })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Arrastrar archivos aquí')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Eliminar/ })
    ).not.toBeInTheDocument();
  });

  test('rechaza formatos no permitidos y archivos demasiado grandes sin enviarlos', async () => {
    const user = await abrirDocumentos();
    const entrada = screen.getByLabelText('Adjuntar documento');

    await user.upload(
      entrada,
      new File(['texto'], 'notas.txt', { type: 'text/plain' })
    );
    expect(
      screen.getByText(
        'Formato no permitido. Solo se aceptan archivos PDF, DOC y DOCX.'
      )
    ).toBeInTheDocument();

    const grande = new File(
      [new Uint8Array(limites.maxBytes + 1)],
      'grande.pdf',
      {
        type: 'application/pdf',
      }
    );
    await user.upload(entrada, grande);
    expect(
      screen.getByText('El archivo supera el tamaño máximo permitido (1,0 MB).')
    ).toBeInTheDocument();
    expect(menoresApi.subirDocumento).not.toHaveBeenCalled();
  });

  test('sube un documento y lo agrega a la lista', async () => {
    const nuevo = { ...pdf, _id: 'doc-3', nombreOriginal: 'Autorización.pdf' };
    menoresApi.subirDocumento.mockResolvedValue(nuevo);
    const user = await abrirDocumentos();
    const archivo = new File(['%PDF-1.7'], 'Autorización.pdf', {
      type: 'application/pdf',
    });

    await user.upload(screen.getByLabelText('Adjuntar documento'), archivo);

    expect(menoresApi.subirDocumento).toHaveBeenCalledWith(
      'menor-1',
      archivo,
      expect.any(Function)
    );
    expect(
      await screen.findByText('Documento adjuntado correctamente')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Documentos (3)' })
    ).toBeInTheDocument();
  });

  test('muestra el error del servidor al subir sin detalles internos', async () => {
    menoresApi.subirDocumento.mockRejectedValue(
      errorHttp(415, {
        error: 'El documento contiene macros, que no están permitidas',
      })
    );
    const user = await abrirDocumentos();
    await user.upload(
      screen.getByLabelText('Adjuntar documento'),
      new File(['x'], 'macros.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El documento contiene macros, que no están permitidas'
    );
  });
});

describe('Visualización en la página', () => {
  test('abre un PDF en el visor integrado con su contenido', async () => {
    menoresApi.obtenerVistaDocumento.mockResolvedValue({
      formato: 'pdf',
      datos: new ArrayBuffer(25278),
    });
    const user = await abrirDocumentos();

    await user.click(
      screen.getByRole('button', { name: 'Ver Evaluación inicial.pdf' })
    );

    const visor = screen.getByRole('region', {
      name: 'Vista de Evaluación inicial.pdf',
    });
    expect(
      await within(visor).findByText('PDF recibido: 25278 bytes')
    ).toBeInTheDocument();
    expect(menoresApi.obtenerVistaDocumento).toHaveBeenCalledWith(
      'menor-1',
      'doc-1'
    );
  });

  test('muestra un DOCX en un marco aislado, sin scripts', async () => {
    menoresApi.obtenerVistaDocumento.mockResolvedValue({
      formato: 'html',
      html: '<h1>Informe de prueba ficticio</h1>',
    });
    const user = await abrirDocumentos();

    await user.click(
      screen.getByRole('button', { name: 'Ver Informe escolar.docx' })
    );

    const marco = await screen.findByTitle('Contenido de Informe escolar.docx');
    expect(marco).toHaveAttribute('sandbox', '');
    expect(marco.getAttribute('srcdoc')).toContain(
      '<h1>Informe de prueba ficticio</h1>'
    );
    expect(marco.getAttribute('srcdoc')).toContain("default-src 'none'");
  });

  test('informa cuando el documento no se puede abrir', async () => {
    menoresApi.obtenerVistaDocumento.mockRejectedValue(
      errorHttp(500, { error: 'No se pudo abrir el documento' })
    );
    const user = await abrirDocumentos();

    await user.click(
      screen.getByRole('button', { name: 'Ver Evaluación inicial.pdf' })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo abrir el documento'
    );
  });

  test('amplía el visor y se cierra con Escape', async () => {
    menoresApi.obtenerVistaDocumento.mockResolvedValue({
      formato: 'pdf',
      datos: new ArrayBuffer(8),
    });
    const user = await abrirDocumentos();

    await user.click(
      screen.getByRole('button', { name: 'Ver Evaluación inicial.pdf' })
    );
    await user.click(screen.getByRole('button', { name: 'Ampliar' }));

    const dialogo = screen.getByRole('dialog', {
      name: 'Visor ampliado: Evaluación inicial.pdf',
    });
    expect(
      await within(dialogo).findByText('PDF recibido: 8 bytes')
    ).toBeInTheDocument();
    expect(
      within(dialogo).getByRole('button', { name: 'Cerrar' })
    ).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('descarga el documento original', async () => {
    menoresApi.descargarDocumento.mockResolvedValue();
    const user = await abrirDocumentos();

    await user.click(
      screen.getByRole('button', { name: 'Descargar Evaluación inicial.pdf' })
    );
    expect(menoresApi.descargarDocumento).toHaveBeenCalledWith('menor-1', pdf);
  });
});

describe('Eliminación con confirmación dentro de la aplicación', () => {
  test('muestra un modal centrado y no usa el aviso nativo del navegador', async () => {
    const confirmNativo = jest.spyOn(window, 'confirm');
    const user = await abrirDocumentos();

    await user.click(
      screen.getByRole('button', { name: 'Eliminar Evaluación inicial.pdf' })
    );

    const modal = screen.getByRole('alertdialog', {
      name: 'Eliminar documento',
    });
    expect(modal).toHaveAccessibleDescription(
      'Se eliminará definitivamente "Evaluación inicial.pdf". Esta acción no se puede deshacer.'
    );
    expect(
      within(modal).getByRole('button', { name: 'Cancelar' })
    ).toHaveFocus();
    expect(confirmNativo).not.toHaveBeenCalled();
  });

  test('cancelar conserva el documento', async () => {
    const user = await abrirDocumentos();

    await user.click(
      screen.getByRole('button', { name: 'Eliminar Evaluación inicial.pdf' })
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(menoresApi.eliminarDocumento).not.toHaveBeenCalled();
    expect(
      screen.getByRole('cell', { name: 'Evaluación inicial.pdf' })
    ).toBeInTheDocument();
  });

  test('Escape cierra el modal sin eliminar', async () => {
    const user = await abrirDocumentos();

    await user.click(
      screen.getByRole('button', { name: 'Eliminar Evaluación inicial.pdf' })
    );
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(menoresApi.eliminarDocumento).not.toHaveBeenCalled();
  });

  test('confirmar elimina una sola vez y muestra el resultado', async () => {
    let terminar;
    menoresApi.eliminarDocumento.mockReturnValue(
      new Promise((resolver) => {
        terminar = resolver;
      })
    );
    const user = await abrirDocumentos();

    await user.click(
      screen.getByRole('button', { name: 'Eliminar Evaluación inicial.pdf' })
    );
    const modal = screen.getByRole('alertdialog');
    await user.click(within(modal).getByRole('button', { name: 'Eliminar' }));

    // Mientras se procesa, los botones quedan deshabilitados.
    const procesando = within(modal).getByRole('button', {
      name: 'Eliminando…',
    });
    expect(procesando).toBeDisabled();
    await user.click(procesando);
    expect(menoresApi.eliminarDocumento).toHaveBeenCalledTimes(1);
    expect(menoresApi.eliminarDocumento).toHaveBeenCalledWith(
      'menor-1',
      'doc-1'
    );

    terminar();
    expect(
      await screen.findByText('Documento eliminado correctamente')
    ).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('cell', { name: 'Evaluación inicial.pdf' })
    ).not.toBeInTheDocument();
  });

  test('si el servidor falla, informa el error y conserva el documento', async () => {
    menoresApi.eliminarDocumento.mockRejectedValue(
      errorHttp(403, { error: 'No tiene permisos para realizar esta acción' })
    );
    const user = await abrirDocumentos();

    await user.click(
      screen.getByRole('button', { name: 'Eliminar Evaluación inicial.pdf' })
    );
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(
      await screen.findByText('No tiene permisos para realizar esta acción')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('cell', { name: 'Evaluación inicial.pdf' })
    ).toBeInTheDocument();
  });
});
