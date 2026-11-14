'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconoCerrar, IconoMenu } from '@/components/Iconos';
import { GRUPOS, NOMBRE_ROL, puedeEntrar, seccionDeRuta, type Rol } from '@/lib/admin/secciones';

type Props = { nombre: string; roles: Rol[]; efectivos: Rol[] };

/**
 * Barra lateral del diseño (AdminSidebar): cada persona ve solo las secciones
 * de sus roles. En pantallas angostas se abre con ☰ (enlaces de 52 px).
 * Ocultar enlaces es solo comodidad: el servidor responde 403 igual.
 */
export function BarraLateral({ nombre, roles, efectivos }: Props) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const activa = seccionDeRuta(ruta);
  useEffect(() => setAbierto(false), [ruta]);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [abierto]);

  const grupos = GRUPOS
    .map((g) => ({ ...g, secciones: g.secciones.filter((s) => puedeEntrar(s.clave, efectivos, roles)) }))
    .filter((g) => g.secciones.length > 0);
  const rolTexto = roles.map((r) => NOMBRE_ROL[r]).join(' · ');

  const contenido = (
    <>
      {grupos.map((g) => (
        <div key={g.titulo} className="flex flex-col gap-0.5">
          <span className="px-3 pb-1.5 pt-3.5 font-ui text-[11.5px] font-semibold uppercase tracking-[0.1em] text-texto-3">{g.titulo}</span>
          {g.secciones.map((s) => {
            const on = s.clave === activa;
            return (
              <Link key={s.clave} href={s.ruta} aria-current={on ? 'page' : undefined} data-seccion={s.clave}
                className={`flex min-h-[52px] items-center gap-2.5 rounded-xl px-3 text-[14.5px] nav:min-h-[42px] ${on
                  ? 'bg-azul-claro font-semibold text-azul-oscuro shadow-[inset_3px_0_0_var(--color-turquesa)]'
                  : 'text-texto hover:bg-gris-claro'}`}>
                <span aria-hidden className="w-[18px] text-center opacity-85">{s.icono}</span>
                {s.nombre}
                {!s.lista && <span className="sr-only"> (próxima etapa)</span>}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="mt-auto flex flex-col gap-1 border-t border-linea px-3 pt-3.5 text-[13px]">
        <strong className="text-[14px]" data-usuario>{nombre}</strong>
        <span className="text-texto-3">Rol: {rolTexto}</span>
        <Link href="/admin/cuenta" className="mt-1 font-semibold text-azul">Mi cuenta</Link>
        <form method="post" action="/admin/salir">
          <button className="min-h-11 font-semibold text-azul nav:min-h-0">Cerrar sesión</button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Escritorio y tablet ancha: barra fija de 260 px */}
      <nav aria-label="Menú del panel"
        className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col gap-0.5 overflow-y-auto bg-white px-3.5 py-[22px] shadow-[inset_-1px_0_0_#e1e3e6] nav:flex">
        <Link href="/admin" className="flex items-center gap-2.5 px-2.5 pb-[18px]">
          <Image src="/marca/logo-jiump.png" alt="JIUMP" width={54} height={48} priority />
          <span className="font-ui text-[12px] font-semibold tracking-[0.08em] text-azul">ADMIN</span>
        </Link>
        {contenido}
      </nav>

      {/* Celular: barra superior con ☰ */}
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-linea bg-white px-5 nav:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/marca/logo-jiump.png" alt="JIUMP" width={42} height={37} priority />
          <span className="font-ui text-[12px] font-semibold tracking-[0.08em] text-azul">ADMIN</span>
        </Link>
        <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} aria-controls="menu-panel-movil"
          aria-label={abierto ? 'Cerrar menú del panel' : 'Abrir menú del panel'} className="grid size-11 place-items-center rounded-xl text-texto">
          {abierto ? <IconoCerrar /> : <IconoMenu />}
        </button>
      </div>
      {abierto && (
        <nav id="menu-panel-movil" aria-label="Menú del panel"
          className="fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col gap-0.5 overflow-y-auto bg-white px-4 pb-6 nav:hidden">
          {contenido}
        </nav>
      )}
    </>
  );
}
