import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authApi from '../api/auth';
import * as configuracionApi from '../api/configuracionInformes';
import {
  ALINEACIONES,
  POSICIONES_LOGO,
  TAMANOS_LOGO,
  LIMITES_CONFIGURACION,
  LIMITES_LOGO,
  VALORES_POR_DEFECTO,
} from '../constants/configuracionInformes';
import { ajustarLogo } from '../utils/logoInformes';
import {
  errorHttp,
  renderApp,
  usuarioAdmin,
  usuarioPsico,
} from '../test-utils';

jest.mock('../api/auth');
jest.mock('../api/users');
jest.mock('../api/audit');
jest.mock('../api/configuracionInformes');
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
const configuracionGuardada = {
  ...VALORES_POR_DEFECTO,
  nombreInstitucion: 'Centro Ficticio',
  textoPie: 'Av. Ficticia 123',
  logo: null,
};

const logoGuardado = {
  mimeType: 'image/png',
  ancho: 400,
  alto: 100,
  tamano: 2048,
  actualizadoEn: '2026-11-09T10:00:00.000Z',
};

let contadorUrl = 0;

beforeEach(() => {
  contadorUrl = 0;
  URL.createObjectURL = jest.fn(() => {
    contadorUrl += 1;
    return `blob:ficticio-${contadorUrl}`;
  });
  URL.revokeObjectURL = jest.fn();
  configuracionApi.obtenerConfiguracionInformes.mockResolvedValue({
    configuracion: configuracionGuardada,
    limitesLogo: LIMITES_LOGO,
  });
  configuracionApi.obtenerLogoInformes.mockResolvedValue(
    new Blob(['png'], { type: 'image/png' })
  );
  jest.spyOn(window, 'alert').mockImplementation(() => {});
  jest.spyOn(window, 'confirm').mockImplementation(() => true);
});

afterEach(() => {
  expect(window.alert).not.toHaveBeenCalled();
  expect(window.confirm).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

async function abrir(usuario = usuarioAdmin) {
  authApi.obtenerSesion.mockResolvedValue(usuario);
  const user = userEvent.setup({ applyAccept: false });
  renderApp('/configuracion-informes');
  await screen.findByLabelText('Nombre del centro o empresa');
  return user;
}

function vistaPrevia() {
  return screen.getByRole('figure', { name: 'Vista previa del informe' });
}

describe('Acceso a la configuración de informes', () => {
  test('el administrador ve la opción en el menú y la configuración guardada', async () => {
    await abrir();
    expect(
      screen.getByRole('link', { name: 'Configuración de informes' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del centro o empresa')).toHaveValue(
      'Centro Ficticio'
    );
    expect(screen.getByLabelText('Texto institucional')).toHaveValue(
      'Av. Ficticia 123'
    );
    expect(screen.getByRole('checkbox', { name: /Numerar/ })).toBeChecked();
    expect(
      within(vistaPrevia()).getByText('Centro Ficticio')
    ).toBeInTheDocument();
    expect(screen.getByText(/No hay un logo configurado/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Guardar cambios' })
    ).toBeDisabled();
  });

  test('el psicopedagogo no ve la opción y la ruta lo redirige', async () => {
    authApi.obtenerSesion.mockResolvedValue(usuarioPsico);
    renderApp('/configuracion-informes');
    expect(
      await screen.findByRole('heading', { name: 'Acceso no autorizado' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Configuración de informes' })
    ).not.toBeInTheDocument();
    expect(
      configuracionApi.obtenerConfiguracionInformes
    ).not.toHaveBeenCalled();
  });

  test('muestra el error si no se puede cargar la configuración', async () => {
    configuracionApi.obtenerConfiguracionInformes.mockRejectedValue(
      errorHttp(500, { error: 'Error interno del servidor' })
    );
    authApi.obtenerSesion.mockResolvedValue(usuarioAdmin);
    renderApp('/configuracion-informes');
    expect(
      await screen.findByText('Error interno del servidor')
    ).toBeInTheDocument();
  });
});

describe('Encabezado, pie y vista previa', () => {
  test('la vista previa se actualiza al editar sin guardar', async () => {
    const user = await abrir();
    const nombre = screen.getByLabelText('Nombre del centro o empresa');
    await user.clear(nombre);
    await user.type(nombre, 'Centro Renombrado');
    const pie = screen.getByLabelText('Texto institucional');
    await user.clear(pie);
    await user.type(pie, 'Calle Ficticia 9{Enter}contacto@ficticio.cl');
    await user.click(screen.getByRole('checkbox', { name: /Numerar/ }));

    const hoja = vistaPrevia();
    expect(within(hoja).getByText('Centro Renombrado')).toBeInTheDocument();
    expect(within(hoja).getByTestId('pie-vista-previa')).toHaveTextContent(
      'Calle Ficticia 9 contacto@ficticio.cl'
    );
    expect(within(hoja).queryByText('Página 1 de 2')).not.toBeInTheDocument();
    expect(
      configuracionApi.guardarConfiguracionInformes
    ).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Guardar cambios' })
    ).toBeEnabled();
  });

  test('sin pie ni numeración no se muestra el pie en la vista previa', async () => {
    const user = await abrir();
    await user.clear(screen.getByLabelText('Texto institucional'));
    await user.click(screen.getByRole('checkbox', { name: /Numerar/ }));
    expect(
      within(vistaPrevia()).queryByTestId('pie-vista-previa')
    ).not.toBeInTheDocument();
  });

  test('guarda la configuración y muestra el aviso de éxito', async () => {
    configuracionApi.guardarConfiguracionInformes.mockImplementation(
      async (opciones) => ({ ...opciones, logo: null })
    );
    const user = await abrir();
    await user.selectOptions(
      screen.getByLabelText('Alineación del encabezado'),
      'centro'
    );
    await user.selectOptions(
      screen.getByLabelText('Tamaño del logo'),
      'grande'
    );
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(configuracionApi.guardarConfiguracionInformes).toHaveBeenCalledWith({
      nombreInstitucion: 'Centro Ficticio',
      alineacionEncabezado: 'centro',
      posicionLogo: 'derecha',
      tamanoLogo: 'grande',
      textoPie: 'Av. Ficticia 123',
      numeracionPaginas: true,
    });
    expect(
      await screen.findByText(/Configuración guardada/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Guardar cambios' })
    ).toBeDisabled();
  });

  test('valida el pie antes de guardar y muestra los errores del servidor', async () => {
    const user = await abrir();
    const pie = screen.getByLabelText('Texto institucional');
    await user.clear(pie);
    await user.type(pie, 'a{Enter}b{Enter}c{Enter}d');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(
      screen.getByText(
        `El texto del pie de página admite como máximo ${LIMITES_CONFIGURACION.lineasPie} líneas`
      )
    ).toBeInTheDocument();
    expect(
      configuracionApi.guardarConfiguracionInformes
    ).not.toHaveBeenCalled();

    configuracionApi.guardarConfiguracionInformes.mockRejectedValue(
      errorHttp(400, {
        error: 'Datos inválidos',
        detalles: {
          nombreInstitucion:
            'El nombre de la institución contiene caracteres que no se pueden imprimir en el PDF (por ejemplo, emojis)',
        },
      })
    );
    await user.clear(pie);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(
      await screen.findByText(/contiene caracteres que no se pueden imprimir/)
    ).toBeInTheDocument();
  });

  test('genera la vista previa en PDF con las opciones sin guardar', async () => {
    configuracionApi.generarVistaPreviaInforme.mockResolvedValue(
      new ArrayBuffer(8)
    );
    const user = await abrir();
    await user.selectOptions(
      screen.getByLabelText('Posición del logo'),
      'izquierda'
    );
    await user.click(screen.getByRole('button', { name: 'Vista previa PDF' }));

    expect(configuracionApi.generarVistaPreviaInforme).toHaveBeenCalledWith(
      expect.objectContaining({ posicionLogo: 'izquierda' })
    );
    const modal = await screen.findByRole('dialog', {
      name: 'Vista previa del informe PDF',
    });
    expect(within(modal).getByText(/datos ficticios/)).toBeInTheDocument();
    expect(
      await within(modal).findByText('PDF recibido: 8 bytes')
    ).toBeInTheDocument();
    expect(
      configuracionApi.guardarConfiguracionInformes
    ).not.toHaveBeenCalled();
  });
});

describe('Logo institucional', () => {
  test('rechaza formatos no permitidos y archivos demasiado grandes sin subirlos', async () => {
    const user = await abrir();
    const entrada = screen.getByLabelText('Seleccionar logo');

    await user.upload(
      entrada,
      new File(['gif'], 'logo.gif', { type: 'image/gif' })
    );
    expect(
      screen.getByText(
        'Formato no permitido. Solo se aceptan imágenes PNG, JPG y JPEG'
      )
    ).toBeInTheDocument();

    await user.upload(
      entrada,
      new File([new Uint8Array(LIMITES_LOGO.maxBytes + 1)], 'logo.png', {
        type: 'image/png',
      })
    );
    expect(
      screen.getByText(/El logo supera el tamaño máximo permitido/)
    ).toBeInTheDocument();
    expect(configuracionApi.subirLogoInformes).not.toHaveBeenCalled();
  });

  test('muestra la imagen antes de guardarla y la sube al confirmar', async () => {
    configuracionApi.subirLogoInformes.mockResolvedValue({
      ...configuracionGuardada,
      logo: logoGuardado,
    });
    const user = await abrir();
    const archivo = new File(['png'], 'logo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Seleccionar logo'), archivo);

    expect(
      screen.getByRole('img', { name: 'Vista previa del logo seleccionado' })
    ).toHaveAttribute('src', 'blob:ficticio-1');
    expect(
      within(vistaPrevia()).getByRole('img', { name: 'Logo institucional' })
    ).toHaveAttribute('src', 'blob:ficticio-1');
    expect(configuracionApi.subirLogoInformes).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Guardar logo' }));
    expect(configuracionApi.subirLogoInformes).toHaveBeenCalledWith(
      archivo,
      expect.any(Function)
    );
    expect(
      await screen.findByText('Logo guardado correctamente')
    ).toBeInTheDocument();
    expect(screen.getByText('PNG · 400 × 100 px · 2 KB')).toBeInTheDocument();
    expect(screen.getByLabelText('Reemplazar logo')).toBeInTheDocument();
  });

  test('descarta la imagen pendiente sin subirla', async () => {
    const user = await abrir();
    await user.upload(
      screen.getByLabelText('Seleccionar logo'),
      new File(['png'], 'logo.png', { type: 'image/png' })
    );
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:ficticio-1');
    expect(within(vistaPrevia()).queryByRole('img')).not.toBeInTheDocument();
    expect(configuracionApi.subirLogoInformes).not.toHaveBeenCalled();
  });

  test('muestra el error del servidor si la imagen está dañada', async () => {
    configuracionApi.subirLogoInformes.mockRejectedValue(
      errorHttp(422, { error: 'La imagen está dañada o no se puede leer' })
    );
    const user = await abrir();
    await user.upload(
      screen.getByLabelText('Seleccionar logo'),
      new File(['dañada'], 'logo.png', { type: 'image/png' })
    );
    await user.click(screen.getByRole('button', { name: 'Guardar logo' }));
    expect(
      await screen.findAllByText('La imagen está dañada o no se puede leer')
    ).not.toHaveLength(0);
  });

  test('rechaza imágenes que superan las dimensiones máximas', async () => {
    const ImagenOriginal = window.Image;
    window.Image = class {
      set src(_url) {
        this.naturalWidth = LIMITES_LOGO.maxPx + 1;
        this.naturalHeight = 10;
        setTimeout(() => this.onload());
      }
    };
    try {
      const user = await abrir();
      await user.upload(
        screen.getByLabelText('Seleccionar logo'),
        new File(['png'], 'logo.png', { type: 'image/png' })
      );
      expect(
        await screen.findByText(/La imagen no puede superar/)
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Guardar logo' })
      ).not.toBeInTheDocument();
    } finally {
      window.Image = ImagenOriginal;
    }
  });

  test('muestra el logo guardado en la vista previa', async () => {
    configuracionApi.obtenerConfiguracionInformes.mockResolvedValue({
      configuracion: { ...configuracionGuardada, logo: logoGuardado },
      limitesLogo: LIMITES_LOGO,
    });
    await abrir();
    expect(
      await within(vistaPrevia()).findByRole('img', {
        name: 'Logo institucional',
      })
    ).toHaveAttribute('src', 'blob:ficticio-1');
  });

  test.each(Object.keys(TAMANOS_LOGO))(
    'ajusta el logo a la caja %s sin deformarlo',
    (tamano) => {
      const caja = TAMANOS_LOGO[tamano];
      for (const logo of [
        { ancho: 400, alto: 100 },
        { ancho: 100, alto: 400 },
        { ancho: 60, alto: 60 },
      ]) {
        const medidas = ajustarLogo(caja, logo);
        expect(medidas.ancho / medidas.alto).toBeCloseTo(
          logo.ancho / logo.alto,
          6
        );
        expect(medidas.ancho).toBeLessThanOrEqual(caja.ancho + 1e-9);
        expect(medidas.alto).toBeLessThanOrEqual(caja.alto + 1e-9);
      }
    }
  );

  test('elimina el logo tras confirmar en el cuadro de la aplicación', async () => {
    configuracionApi.obtenerConfiguracionInformes.mockResolvedValue({
      configuracion: { ...configuracionGuardada, logo: logoGuardado },
      limitesLogo: LIMITES_LOGO,
    });
    configuracionApi.eliminarLogoInformes.mockResolvedValue();
    const user = await abrir();
    await screen.findByRole('img', { name: 'Logo institucional guardado' });

    await user.click(screen.getByRole('button', { name: 'Eliminar logo' }));
    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo).toHaveTextContent('Los informes ya emitidos no cambian');
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() =>
      expect(configuracionApi.eliminarLogoInformes).toHaveBeenCalled()
    );
    expect(await screen.findByText('Logo eliminado')).toBeInTheDocument();
    expect(screen.getByText(/No hay un logo configurado/)).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:ficticio-1');
  });
});

describe('Constantes sincronizadas con el backend', () => {
  test('mismas opciones, límites y valores por defecto', () => {
    expect(ALINEACIONES.map((a) => a.valor)).toEqual([...backend.ALINEACIONES]);
    expect(POSICIONES_LOGO.map((p) => p.valor)).toEqual([
      ...backend.POSICIONES_LOGO,
    ]);
    expect(
      Object.fromEntries(
        Object.entries(TAMANOS_LOGO).map(([clave, { ancho, alto }]) => [
          clave,
          { ancho, alto },
        ])
      )
    ).toEqual(backend.TAMANOS_LOGO);
    expect(LIMITES_CONFIGURACION).toEqual({
      nombreInstitucion: backend.MAX_NOMBRE,
      textoPie: backend.MAX_PIE,
      lineasPie: backend.MAX_LINEAS_PIE,
    });
    expect(LIMITES_LOGO.maxBytes).toBe(backend.LOGO_MAX_BYTES);
    expect(LIMITES_LOGO.maxPx).toBe(backend.LOGO_MAX_PX);
    expect(VALORES_POR_DEFECTO).toEqual(backend.VALORES_POR_DEFECTO);
  });
});
