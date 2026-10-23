import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { useAuth } from '../../context/useAuth';
import { useNotificaciones } from '../../context/useNotificaciones';
import { listarUsuarios } from '../../api/users';
import { mensajeDeError } from '../../api/client';
import { PERMISOS } from '../../constants/auth';
import EncabezadoPagina, {
  CuerpoPagina,
} from '../../components/EncabezadoPagina';
import FormularioNuevoUsuario from '../../components/usuarios/FormularioNuevoUsuario';
import FilaUsuario from '../../components/usuarios/FilaUsuario';
import MatrizPermisos from '../../components/usuarios/MatrizPermisos';
import RegistroAccesos from '../../components/usuarios/RegistroAccesos';
import {
  Alerta,
  Boton,
  Cargando,
  ContenedorTabla,
  Entrada,
  Tabla,
  TextoAyuda,
} from '../../components/ui';

// Pantalla 1k de los mockups: listado de cuentas, matriz de permisos y registro de accesos.

const Busqueda = styled(Entrada)`
  width: 210px;
  max-width: 100%;
`;

const Paneles = styled.div`
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  margin-top: 6px;
`;

function ordenarPorNombre(usuarios) {
  return [...usuarios].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function coincide(usuario, busqueda) {
  const texto = busqueda.trim().toLowerCase();
  return (
    !texto ||
    usuario.nombre.toLowerCase().includes(texto) ||
    usuario.email.toLowerCase().includes(texto)
  );
}

export default function Usuarios() {
  const { usuario: usuarioActual, tienePermiso } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const { notificar } = useNotificaciones();
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);
  // Se incrementa tras cada cambio para refrescar el registro de accesos.
  const [versionRegistro, setVersionRegistro] = useState(0);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setUsuarios(ordenarPorNombre(await listarUsuarios()));
      setError('');
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo cargar la lista de usuarios'));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function handleCreado(usuario) {
    setUsuarios((anteriores) => ordenarPorNombre([...anteriores, usuario]));
    notificar({
      tipo: 'exito',
      mensaje: `Se registró la cuenta de ${usuario.nombre}.`,
    });
    setCreando(false);
    setVersionRegistro((version) => version + 1);
  }

  function handleActualizado(usuario) {
    setUsuarios((anteriores) =>
      anteriores.map((existente) =>
        existente._id === usuario._id ? usuario : existente
      )
    );
    setVersionRegistro((version) => version + 1);
  }

  const visibles = usuarios.filter((usuario) => coincide(usuario, busqueda));

  return (
    <>
      <EncabezadoPagina titulo="Usuarios y roles">
        <Busqueda
          type="search"
          placeholder="Buscar usuario"
          aria-label="Buscar usuario"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
        />
        <Boton
          type="button"
          onClick={() => setCreando(true)}
          aria-expanded={creando}
        >
          + Nuevo usuario
        </Boton>
      </EncabezadoPagina>
      <CuerpoPagina>
        {creando && (
          <FormularioNuevoUsuario
            onCreado={handleCreado}
            onCancelar={() => setCreando(false)}
          />
        )}
        {error && <Alerta role="alert">{error}</Alerta>}
        {cargando ? (
          <Cargando role="status">Cargando usuarios…</Cargando>
        ) : (
          <ContenedorTabla>
            <Tabla>
              <thead>
                <tr>
                  <th scope="col">Usuario</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Último acceso</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((usuario) => (
                  <FilaUsuario
                    key={usuario._id}
                    usuario={usuario}
                    esPropio={usuario._id === usuarioActual._id}
                    onActualizado={handleActualizado}
                  />
                ))}
              </tbody>
            </Tabla>
            {visibles.length === 0 && (
              <TextoAyuda as="p">
                No hay usuarios que coincidan con la búsqueda.
              </TextoAyuda>
            )}
          </ContenedorTabla>
        )}
        <Paneles>
          <MatrizPermisos />
          {tienePermiso(PERMISOS.AUDITORIA_LEER) && (
            <RegistroAccesos usuarios={usuarios} version={versionRegistro} />
          )}
        </Paneles>
      </CuerpoPagina>
    </>
  );
}
