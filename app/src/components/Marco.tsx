import Image from 'next/image';
import Link from 'next/link';
import { configuracion, menu } from '@/lib/datos';
import { IconoInstagram } from './Iconos';
import { Navegacion } from './Navegacion';

/** Nombre del movimiento según el README (no es contenido nuevo). */
export const LEMA = 'Jóvenes Unidos para Adorar a Cristo. Movimiento juvenil de la Iglesia Unida Metodista Pentecostal.';

export function usuarioInstagram(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/instagram\.com\/([^/?#]+)/);
  return m ? `@${m[1]}` : null;
}

export async function Encabezado({ acento }: { acento?: 'rojo' }) {
  const items = (await menu()).filter((i) => i.ubicacion === 'principal');
  return (
    <header className={`sticky top-0 z-40 bg-white/95 backdrop-blur ${acento === 'rojo' ? 'border-b-2 border-rojo' : 'border-b border-linea'}`}>
      <div className="contenedor relative flex h-[76px] items-center justify-between">
        <Link href="/" aria-label="JIUMP · Inicio" className="shrink-0">
          <Image src="/marca/logo-jiump.png" alt="JIUMP" width={64} height={57} priority />
        </Link>
        <Navegacion items={items.map((i) => ({ etiqueta: i.etiqueta, url: i.url }))} />
      </div>
    </header>
  );
}

export async function Pie() {
  const [items, conf] = await Promise.all([menu(), configuracion()]);
  const explora = items.filter((i) => i.ubicacion === 'principal');
  const pie = items.filter((i) => i.ubicacion === 'pie');
  const ig = usuarioInstagram(conf.instagram_url);
  const anio = new Date().getFullYear();

  return (
    <footer className="mt-auto">
      <div className="franja" />
      <div className="contenedor grid gap-10 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Image src="/marca/logo-jiump.png" alt="JIUMP" width={108} height={96} />
          <p className="mt-4 max-w-[400px] text-texto-2">{LEMA}</p>
        </div>
        <div>
          <p className="t-etiqueta text-azul-oscuro">Explora</p>
          <ul className="mt-3 space-y-1">
            {[...explora, ...pie].map((i) => (
              <li key={i.id}><Link href={i.url} className="hover:text-azul">{i.etiqueta}</Link></li>
            ))}
          </ul>
        </div>
        {conf.instagram_url && (
          <div>
            <p className="t-etiqueta text-azul-oscuro">Síguenos</p>
            <a href={conf.instagram_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 hover:text-azul">
              <IconoInstagram tam={18} /> Instagram{ig ? ` · ${ig}` : ''}
            </a>
          </div>
        )}
      </div>
      <div className="contenedor">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linea py-6 text-[14px] text-texto-2">
          <span>© JIUMP {anio}</span>
          <span>Iglesia Unida Metodista Pentecostal</span>
        </div>
      </div>
    </footer>
  );
}
