import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { theme } from '../styles/theme';
import Icono from '../components/Icono';
import ModalConfirmacion from '../components/ModalConfirmacion';
import {
  Boton,
  BotonAccion,
  BotonEnlace,
  BotonEnlazado,
  BotonFiltro,
  BotonIcono,
  BotonPequeno,
} from '../components/ui';

function renderConTema(contenido) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{contenido}</MemoryRouter>
    </ThemeProvider>
  );
}

// Color de fondo calculado (jsdom resuelve las reglas que inyecta styled-components).
function fondo(elemento) {
  return window.getComputedStyle(elemento).backgroundColor;
}

describe('Botones comunes', () => {
  test('el ícono es decorativo y no altera el nombre accesible', () => {
    renderConTema(
      <Boton type="button" $variante="edicion">
        <Icono nombre="editar" />
        Editar
      </Boton>
    );
    const boton = screen.getByRole('button', { name: 'Editar' });
    const svg = boton.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  test('$cargando marca el botón como ocupado sin cambiar su nombre accesible', () => {
    renderConTema(
      <>
        <Boton type="button" $cargando disabled>
          <Icono nombre="pdf" />
          Guardando…
        </Boton>
        <BotonPequeno type="button" $cargando={false}>
          Guardar
        </BotonPequeno>
      </>
    );
    const ocupado = screen.getByRole('button', { name: 'Guardando…' });
    expect(ocupado).toHaveAttribute('aria-busy', 'true');
    expect(ocupado).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar' })).not.toHaveAttribute(
      'aria-busy'
    );
  });

  test('las props de estilo no se traspasan como atributos al DOM', () => {
    renderConTema(
      <>
        <Boton type="button" $variante="informativo">
          Vista previa
        </Boton>
        <BotonIcono type="button" $pequeno aria-label="Página siguiente">
          <Icono nombre="siguiente" />
        </BotonIcono>
        <BotonAccion type="button" $peligro $soloIcono aria-label="Quitar">
          <Icono nombre="cerrar" />
        </BotonAccion>
        <BotonEnlace type="button" $peligro>
          Reintentar
        </BotonEnlace>
      </>
    );
    for (const nombre of [
      'Vista previa',
      'Página siguiente',
      'Quitar',
      'Reintentar',
    ]) {
      const boton = screen.getByRole('button', { name: nombre });
      for (const atributo of ['variante', 'peligro', 'pequeno', 'soloIcono']) {
        expect(boton).not.toHaveAttribute(atributo);
      }
    }
  });

  test('BotonIcono se identifica por su aria-label', () => {
    renderConTema(
      <BotonIcono type="button" $variante="fantasma" aria-label="Cerrar">
        <Icono nombre="cerrar" />
      </BotonIcono>
    );
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });

  test('BotonAccion responde al clic y respeta disabled', async () => {
    const user = userEvent.setup();
    const alEditar = jest.fn();
    const alEliminar = jest.fn();
    renderConTema(
      <>
        <BotonAccion type="button" onClick={alEditar}>
          <Icono nombre="editar" />
          Editar
        </BotonAccion>
        <BotonAccion type="button" $peligro disabled onClick={alEliminar}>
          <Icono nombre="eliminar" />
          Eliminar
        </BotonAccion>
      </>
    );
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(alEditar).toHaveBeenCalledTimes(1);
    expect(alEliminar).not.toHaveBeenCalled();
  });

  test('BotonEnlazado navega como enlace con su ruta', () => {
    renderConTema(
      <BotonEnlazado to="/menores/nuevo">
        <Icono nombre="agregar" />
        Nuevo menor
      </BotonEnlazado>
    );
    expect(screen.getByRole('link', { name: 'Nuevo menor' })).toHaveAttribute(
      'href',
      '/menores/nuevo'
    );
  });

  test('BotonFiltro conserva aria-pressed y responde al clic', async () => {
    const user = userEvent.setup();
    const alPulsar = jest.fn();
    renderConTema(
      <BotonFiltro type="button" $activo aria-pressed="true" onClick={alPulsar}>
        Activos
      </BotonFiltro>
    );
    const filtro = screen.getByRole('button', { name: 'Activos' });
    expect(filtro).toHaveAttribute('aria-pressed', 'true');
    await user.click(filtro);
    expect(alPulsar).toHaveBeenCalledTimes(1);
  });

  test('la confirmación destructiva se distingue de una confirmación normal', () => {
    const { unmount } = renderConTema(
      <ModalConfirmacion
        titulo="Eliminar cuenta"
        mensaje="Mensaje ficticio."
        textoConfirmar="Eliminar"
        onConfirmar={() => {}}
        onCancelar={() => {}}
      />
    );
    const destructivo = fondo(screen.getByRole('button', { name: 'Eliminar' }));
    unmount();
    renderConTema(
      <ModalConfirmacion
        titulo="Generar PDF"
        mensaje="Mensaje ficticio."
        textoConfirmar="Generar PDF"
        peligro={false}
        onConfirmar={() => {}}
        onCancelar={() => {}}
      />
    );
    const normal = fondo(screen.getByRole('button', { name: 'Generar PDF' }));
    expect(destructivo).toBe('rgb(163, 51, 51)');
    expect(normal).toBe('rgb(184, 73, 111)');
  });
});
