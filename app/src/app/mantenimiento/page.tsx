import type { Metadata } from 'next';
import Image from 'next/image';
import { IconoHerramienta, IconoInstagram } from '@/components/Iconos';
import { usuarioInstagram } from '@/components/Marco';
import { configuracion } from '@/lib/datos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sitio en mantenimiento', robots: { index: false } };

/**
 * Página independiente que se muestra (con estado 503) cuando el superadmin
 * activa el modo mantenimiento. Ver src/proxy.ts.
 */
export default async function Mantenimiento() {
  const conf = await configuracion().catch(() => null);
  const ig = conf?.instagram_url ?? null;
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="franja" />
      <main className="contenedor grid flex-1 items-center gap-12 py-16 lg:grid-cols-2">
        <div>
          <Image src="/marca/logo-jiump.png" alt="JIUMP" width={92} height={82} priority />
          <p className="mt-7 inline-flex items-center gap-2 rounded-full bg-azul-claro px-3 py-1.5 font-ui text-[14px] font-semibold text-azul-oscuro">
            <IconoHerramienta tam={14} /> Sitio en mantenimiento
          </p>
          <h1 className="t-h1 mt-5 max-w-[12ch]">Estamos mejorando nuestro sitio</h1>
          <p className="t-entradilla mt-5 max-w-[36ch] text-texto-2">Estamos realizando trabajos para ofrecerte una mejor experiencia. Vuelve a visitarnos en unos momentos.</p>
          {ig && (
            <>
              <p className="t-etiqueta mt-8 text-azul-oscuro">Mientras tanto, síguenos en Instagram</p>
              <a href={ig} target="_blank" rel="noopener noreferrer" className="boton boton-primario mt-4">
                <IconoInstagram tam={18} /> {usuarioInstagram(ig) ?? 'Instagram'}
              </a>
            </>
          )}
        </div>
        <div className="relative flex aspect-[11/10] items-end overflow-hidden rounded-[28px] bg-azul-profundo p-8 max-lg:hidden">
          <span className="franja-corta absolute left-8 top-8" aria-hidden />
          <p className="font-titulo text-[30px] font-extrabold leading-tight text-white">Jóvenes unidos para adorar a Cristo</p>
        </div>
      </main>
      <footer className="border-t border-linea">
        <div className="contenedor flex flex-wrap justify-between gap-3 py-6 text-[14px] text-texto-2">
          <span>© JIUMP {new Date().getFullYear()} · Jóvenes Unidos para Adorar a Cristo</span>
          <span>Iglesia Unida Metodista Pentecostal</span>
        </div>
      </footer>
    </div>
  );
}
