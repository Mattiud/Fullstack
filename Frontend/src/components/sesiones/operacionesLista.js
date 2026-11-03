// Aplica una operación de ListaEditable a la lista del formulario. `nuevo` es el
// elemento que se agrega y `editar(elemento, texto)` devuelve el elemento modificado.
export function aplicarOperacion(lista, operacion, { nuevo, editar }) {
  switch (operacion.tipo) {
    case 'agregar':
      return [...lista, nuevo];
    case 'quitar':
      return lista.filter((_, i) => i !== operacion.indice);
    case 'editar':
      return lista.map((elemento, i) =>
        i === operacion.indice ? editar(elemento, operacion.valor) : elemento
      );
    case 'mover': {
      const destino = operacion.indice + operacion.delta;
      if (destino < 0 || destino >= lista.length) return lista;
      const copia = [...lista];
      [copia[operacion.indice], copia[destino]] = [
        copia[destino],
        copia[operacion.indice],
      ];
      return copia;
    }
    default:
      return lista;
  }
}
