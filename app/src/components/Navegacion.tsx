'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconoCerrar, IconoMenu } from './Iconos';

type Item = { etiqueta: string; url: string };

const activo = (ruta: string, url: string) => url !== '/' && (ruta === url || ruta.startsWith(`${url}/`));

/** Menú unificado: enlaces en escritorio; panel desplegable ☰ bajo 900 px. */
export function Navegacion({ items }: { items: Item[] }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => setAbierto(false), [ruta]);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [abierto]);

  return (
    <>
      <nav aria-label="Principal" className="hidden nav:block">
        <ul className="flex items-center gap-7">
          {items.map((i) => (
            <li key={i.url}>
              <Link href={i.url} aria-current={activo(ruta, i.url) ? 'page' : undefined}
                className={`font-ui text-[15px] font-semibold transition-colors hover:text-azul ${activo(ruta, i.url) ? 'text-azul' : 'text-texto'}`}>
                {i.etiqueta}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <button type="button" className="grid size-12 place-items-center rounded-full text-texto shadow-[inset_0_0_0_1px_var(--color-linea)] nav:hidden"
        aria-expanded={abierto} aria-controls="menu-movil" aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
        onClick={() => setAbierto((v) => !v)}>
        {abierto ? <IconoCerrar /> : <IconoMenu />}
      </button>

      <nav id="menu-movil" aria-label="Principal" hidden={!abierto}
        className="absolute inset-x-0 top-full border-b border-linea bg-white shadow-[0_12px_24px_rgb(16_24_40/0.08)] nav:hidden">
        <ul className="contenedor py-2">
          {items.map((i) => (
            <li key={i.url}>
              <Link href={i.url} aria-current={activo(ruta, i.url) ? 'page' : undefined}
                className={`flex h-[52px] items-center border-b border-linea font-ui text-[17px] font-semibold last:border-0 ${activo(ruta, i.url) ? 'text-azul' : 'text-texto'}`}>
                {i.etiqueta}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
