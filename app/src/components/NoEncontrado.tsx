import Link from 'next/link';

/** Contenido de la página 404 (diseño «Error404»). */
export function NoEncontrado() {
  return (
    <section className="contenedor grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-24" data-pagina="404">
      <div>
        <span className="franja-corta block" aria-hidden />
        <p className="mt-6 font-ui text-[15px] font-semibold text-azul-oscuro">Error 404</p>
        <h1 className="t-h1 mt-3">No encontramos esta página</h1>
        <p className="medida mt-5 text-texto-2">Es posible que el enlace haya cambiado o que la página ya no exista. Te ayudamos a volver al camino.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="boton boton-primario">Ir al inicio</Link>
          <Link href="/articulos" className="boton boton-secundario">Leer artículos</Link>
        </div>
        <p className="mt-6 flex gap-5">
          <Link href="/eventos" className="enlace">Eventos</Link>
          <Link href="/galeria" className="enlace">Galería</Link>
          <Link href="/nosotros" className="enlace">Nosotros</Link>
        </p>
      </div>
      <div aria-hidden className="relative grid aspect-[16/9] place-items-center rounded-[28px] bg-gris-claro">
        <span className="font-titulo text-[clamp(120px,18vw,240px)] font-extrabold leading-none text-transparent [-webkit-text-stroke:2px_var(--color-azul)]">404</span>
        <span className="franja-corta absolute bottom-6 left-7 !w-[88px]" />
      </div>
    </section>
  );
}
