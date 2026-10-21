import { Link } from 'react-router-dom';
import EncabezadoPagina, { CuerpoPagina } from '../components/EncabezadoPagina';
import { Alerta } from '../components/ui';

export default function NoAutorizado() {
  return (
    <>
      <EncabezadoPagina titulo="Acceso no autorizado" />
      <CuerpoPagina>
        <Alerta role="alert">
          No tiene permisos para acceder a esta sección.
        </Alerta>
        <Link to="/">Volver al inicio</Link>
      </CuerpoPagina>
    </>
  );
}
