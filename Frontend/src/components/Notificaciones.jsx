import styled from 'styled-components';
import { BotonPequeno } from './ui';

// Avisos de éxito, advertencia y error, centrados en la pantalla. No bloquean la
// página: solo cada aviso recibe clics.

const Contenedor = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 40;
  display: grid;
  gap: 10px;
  width: min(440px, calc(100vw - 32px));
  pointer-events: none;
`;

const ESTILOS = {
  exito: { icono: '✓', color: 'exito', fondo: 'exitoFondo', borde: 'exito' },
  advertencia: {
    icono: '!',
    color: 'advertencia',
    fondo: 'advertenciaFondo',
    borde: 'advertenciaBorde',
  },
  error: { icono: '✕', color: 'error', fondo: 'errorFondo', borde: 'error' },
};

const Aviso = styled.div`
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: ${({ theme }) => theme.radio};
  border: 1.5px solid
    ${({ theme, $tipo }) => theme.colores[ESTILOS[$tipo].borde]};
  border-left-width: 6px;
  background: ${({ theme, $tipo }) => theme.colores[ESTILOS[$tipo].fondo]};
  color: ${({ theme, $tipo }) => theme.colores[ESTILOS[$tipo].color]};
  box-shadow: 0 10px 30px rgba(43, 35, 40, 0.25);
`;

const Icono = styled.span`
  font-weight: 700;
  font-size: 18px;
  line-height: 1.2;
`;

const Mensaje = styled.p`
  flex: 1;
  margin: 0;
  font-weight: 600;
`;

const TITULOS = { exito: 'Éxito', advertencia: 'Advertencia', error: 'Error' };

export default function Notificaciones({ avisos, onCerrar }) {
  return (
    <Contenedor aria-live="polite">
      {avisos.map(({ id, tipo, mensaje }) => (
        <Aviso
          key={id}
          $tipo={tipo}
          role={tipo === 'exito' ? 'status' : 'alert'}
        >
          <span className="sr-only">{TITULOS[tipo]}:</span>
          <Icono aria-hidden="true">{ESTILOS[tipo].icono}</Icono>
          <Mensaje>{mensaje}</Mensaje>
          <BotonPequeno
            type="button"
            $variante="secundario"
            aria-label="Cerrar aviso"
            onClick={() => onCerrar(id)}
          >
            Cerrar
          </BotonPequeno>
        </Aviso>
      ))}
    </Contenedor>
  );
}
