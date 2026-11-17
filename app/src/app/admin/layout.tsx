import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Panel', template: '%s — Panel JIUMP' },
  robots: { index: false, follow: false },
};

/**
 * El panel se arma siempre en cada petición (depende de la sesión). Explícito
 * para que `next build` nunca intente armarlo al compilar: en Cloudflare
 * (Workers Builds) se compila sin las claves de Supabase.
 */
export const dynamic = 'force-dynamic';

/** Todo /admin: fondo gris claro del diseño y sin el encabezado del sitio. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-gris-claro" data-admin>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-azul focus:px-4 focus:py-2 focus:text-white">
        Saltar al contenido
      </a>
      {children}
    </div>
  );
}
