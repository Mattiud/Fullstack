import { useAuth } from '../context/useAuth';
import EncabezadoPagina, { CuerpoPagina } from '../components/EncabezadoPagina';
import { Tarjeta, Subtitulo, TextoAyuda } from '../components/ui';

// Panel de inicio provisorio: los indicadores del mockup 1a dependen de los módulos
// de menores, sesiones e informes, que aún no están implementados.
export default function Inicio() {
  const { usuario } = useAuth();

  return (
    <>
      <EncabezadoPagina titulo="Panel de inicio" />
      <CuerpoPagina>
        <Tarjeta>
          <Subtitulo>Hola, {usuario.nombre}</Subtitulo>
          <TextoAyuda as="p">
            Los módulos de diagnósticos, sesiones e informes se incorporarán en
            las siguientes etapas del proyecto.
          </TextoAyuda>
        </Tarjeta>
      </CuerpoPagina>
    </>
  );
}
