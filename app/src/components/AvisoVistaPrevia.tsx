/** Aviso visible solo en la vista previa local de una página en borrador. */
export function AvisoVistaPrevia({ activo }: { activo: boolean }) {
  if (!activo) return null;
  return (
    <div role="status" data-vista-previa className="bg-rojo-claro text-rojo-oscuro">
      <p className="contenedor py-2.5 font-ui text-[14px] font-semibold">
        Vista previa local: esta página está en borrador y no se muestra en el sitio publicado.
      </p>
    </div>
  );
}
