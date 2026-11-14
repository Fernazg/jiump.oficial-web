import Link from 'next/link';
import type { ReactNode } from 'react';
import type { FotoFirmada } from '@/lib/tipos';

/** Estado vacío del diseño: ícono + título + explicación + botones. */
export function EstadoVacio({
  icono, titulo, children, acciones, compacto = false, id,
}: {
  icono: ReactNode;
  titulo: string;
  children?: ReactNode;
  acciones?: { texto: string; href: string; secundario?: boolean }[];
  compacto?: boolean;
  id?: string;
}) {
  return (
    <div id={id} data-estado-vacio
      className={`rounded-[28px] bg-gris-claro text-center ${compacto ? 'px-6 py-10' : 'px-6 py-14 sm:py-16'}`}>
      <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-azul-claro text-azul">{icono}</div>
      <h2 className="font-titulo text-[24px] font-bold leading-tight sm:text-[26px]">{titulo}</h2>
      {children && <div className="medida mx-auto mt-3 text-texto-2">{children}</div>}
      {acciones && acciones.length > 0 && (
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {acciones.map((a) => (
            <Link key={a.href + a.texto} href={a.href} className={`boton ${a.secundario ? 'boton-secundario' : 'boton-primario'}`}>
              {a.texto}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Etiqueta de sección (MAYÚSCULAS) con línea turquesa opcional. */
export function Etiqueta({ children, linea = false, className = '', clara = false }: {
  children: ReactNode; linea?: boolean; className?: string; clara?: boolean;
}) {
  return (
    <p className={`t-etiqueta flex items-center gap-3 ${clara ? 'text-turquesa-claro' : 'text-azul-oscuro'} ${className}`}>
      {linea && <span aria-hidden className={`inline-block h-px w-8 ${clara ? 'bg-turquesa-claro' : 'bg-turquesa'}`} />}
      {children}
    </p>
  );
}

/** Pastilla (ej.: «Convención · 2026»). */
export function Pastilla({ children, tono = 'azul' }: { children: ReactNode; tono?: 'azul' | 'rojo' | 'claro' }) {
  const estilos = {
    azul: 'bg-azul text-white',
    rojo: 'bg-rojo text-white',
    claro: 'bg-azul-claro text-azul-oscuro',
  }[tono];
  return <span className={`inline-flex items-center rounded-full px-3 py-1 font-ui text-[12px] font-semibold leading-none ${estilos}`}>{children}</span>;
}

/**
 * Foto de la biblioteca con su URL firmada. Usa ancho/alto reales para no
 * provocar saltos de diseño; nunca recorta el original (solo «object-cover»
 * dentro de su marco, como en el diseño).
 */
export function Foto({ foto, className = '', prioridad = false, tamanos }: {
  foto: FotoFirmada; className?: string; prioridad?: boolean; tamanos?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Supabase (bucket privado)
    <img
      src={foto.url}
      alt={foto.texto_alternativo}
      width={foto.ancho ?? undefined}
      height={foto.alto ?? undefined}
      loading={prioridad ? 'eager' : 'lazy'}
      fetchPriority={prioridad ? 'high' : undefined}
      decoding="async"
      sizes={tamanos}
      className={className}
    />
  );
}

export function Flecha() {
  return <span aria-hidden>→</span>;
}
