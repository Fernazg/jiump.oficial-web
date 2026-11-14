import Link from 'next/link';

/** 403: la sección no corresponde a los roles de la persona. */
export function SinPermiso() {
  return (
    <div data-sin-permiso className="adm-caja mx-auto mt-6 w-full max-w-[560px] px-6 py-12 text-center sm:px-10">
      <div aria-hidden className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-rojo-claro text-[28px] text-rojo-oscuro">⚿</div>
      <h1 className="adm-h1">No tienes permiso para entrar aquí</h1>
      <p className="mx-auto mt-3 max-w-[44ch] text-texto-2">
        Esta sección no corresponde a tu rol. Si crees que deberías tener acceso, pídeselo a un superadministrador.
      </p>
      <Link href="/admin" className="adm-boton adm-primario mt-7">Volver al escritorio</Link>
    </div>
  );
}
