/**
 * Se muestra al cambiar de sección mientras llega el contenido, para que la
 * persona sepa de inmediato que su clic funcionó (sobre todo con conexión lenta).
 */
export default function CargandoPanel() {
  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col gap-6" data-cargando>
      <span className="sr-only">Cargando…</span>
      <div aria-hidden className="h-9 w-64 max-w-full animate-pulse rounded-xl bg-white" />
      <div aria-hidden className="h-5 w-96 max-w-full animate-pulse rounded-lg bg-white" />
      <div aria-hidden className="adm-caja grid min-h-[320px] place-items-center text-[15px] text-texto-3">Cargando…</div>
    </div>
  );
}
