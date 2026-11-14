import Link from 'next/link';
import { type ClaveSeccion, seccion } from '@/lib/admin/secciones';

/** Sección ya protegida por rol, cuyo contenido llega en una etapa siguiente del panel. */
export function ProximaEtapa({ clave }: { clave: ClaveSeccion }) {
  const s = seccion(clave);
  return (
    <>
      <h1 className="adm-h1">{s.nombre}</h1>
      <div data-proxima-etapa className="adm-caja mx-auto w-full max-w-[620px] px-6 py-12 text-center">
        <div aria-hidden className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-azul-claro text-[28px] text-azul">{s.icono}</div>
        <h2 className="font-titulo text-[24px] font-bold">Esta sección llega en la próxima etapa</h2>
        <p className="mx-auto mt-3 max-w-[48ch] text-texto-2">
          Ya está reservada para tu rol en el menú. Mientras tanto, el contenido se mantiene tal como está en el sitio.
        </p>
        <Link href="/admin" className="adm-boton adm-primario mt-7">Volver al escritorio</Link>
      </div>
    </>
  );
}
