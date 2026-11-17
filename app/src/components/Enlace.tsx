import type { AnchorHTMLAttributes } from 'react';

/**
 * Enlace del sitio público: un <a> normal, con el mismo aspecto que el
 * <Link> de Next.js pero sin su navegación interna.
 *
 * <Link> pide a Next.js una versión especial de cada página (al pasar el
 * cursor y al hacer clic) que se arma en cada petición y no se puede guardar.
 * En Cloudflare eso pasaría los 10 ms de procesador del plan gratuito. Con un
 * <a> normal, cada página llega completa desde las páginas guardadas
 * (ver lib/paginas-guardadas.ts).
 *
 * Acepta (y descarta) las opciones propias de <Link> para poder reemplazarlo sin más cambios.
 */
type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean | null; scroll?: boolean; replace?: boolean };

export default function Enlace({ prefetch: _p, scroll: _s, replace: _r, ...props }: Props) {
  return <a {...props} />;
}
