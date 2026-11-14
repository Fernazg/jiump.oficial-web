import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Panel', template: '%s — Panel JIUMP' },
  robots: { index: false, follow: false },
};

/** Todo /admin: fondo gris claro del diseño y sin el encabezado del sitio. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-1 flex-col bg-gris-claro" data-admin>{children}</div>;
}
