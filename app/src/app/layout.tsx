import type { Metadata, Viewport } from 'next';
import { Montserrat, Open_Sans } from 'next/font/google';
import './globals.css';

// Tipografías del manual: Montserrat (títulos) y Open Sans (botones, menú, etiquetas).
// next/font las descarga al compilar y las sirve desde el propio sitio.
const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-montserrat', display: 'swap' });
const openSans = Open_Sans({ subsets: ['latin'], weight: ['600'], variable: '--font-open-sans', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'JIUMP', template: '%s — JIUMP' },
  description: 'Jóvenes Unidos para Adorar a Cristo. Movimiento juvenil de la Iglesia Unida Metodista Pentecostal.',
  icons: { icon: '/marca/logo-jiump.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${montserrat.variable} ${openSans.variable}`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
