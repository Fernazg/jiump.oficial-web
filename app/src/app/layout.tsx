import type { Metadata, Viewport } from 'next';
import { Montserrat, Open_Sans } from 'next/font/google';
import { preconnect } from 'react-dom';
import { IDIOMA, NOMBRE_SITIO, urlSitio } from '@/lib/seo';
import './globals.css';

// Tipografías del manual: Montserrat (títulos) y Open Sans (botones, menú, etiquetas).
// next/font las descarga al compilar y las sirve desde el propio sitio.
const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-montserrat', display: 'swap' });
const openSans = Open_Sans({ subsets: ['latin'], weight: ['600'], variable: '--font-open-sans', display: 'swap' });

/** Metadatos comunes. `metadataBase` vuelve absolutas las direcciones (canónica, Open Graph). */
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(await urlSitio()),
    title: { default: NOMBRE_SITIO, template: `%s — ${NOMBRE_SITIO}` },
    description: 'Jóvenes Unidos para Adorar a Cristo. Movimiento juvenil de la Iglesia Unida Metodista Pentecostal.',
    icons: { icon: '/marca/logo-jiump.png' },
    openGraph: { siteName: NOMBRE_SITIO, locale: 'es_CL', type: 'website' },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };

/** Dirección del almacenamiento de fotos (Supabase), para conectar antes de que haga falta. */
function origenDeFotos(): string | null {
  try { return new URL(process.env.SUPABASE_URL ?? '').origin; } catch { return null; }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Las fotos vienen de otro dominio: abrir la conexión desde el principio
  // ahorra varios cientos de milisegundos en la primera foto (la portada).
  const fotos = origenDeFotos();
  if (fotos) preconnect(fotos);
  return (
    <html lang={IDIOMA} className={`${montserrat.variable} ${openSans.variable}`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
