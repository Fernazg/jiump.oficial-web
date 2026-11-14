import { Encabezado, Pie } from '@/components/Marco';

export default function SitioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-azul focus:px-4 focus:py-2 focus:text-white">
        Saltar al contenido
      </a>
      <Encabezado />
      <main id="contenido" className="flex-1">{children}</main>
      <Pie />
    </>
  );
}
