import Image from 'next/image';

/** Pantallas de acceso: tarjeta centrada con el logo (sin barra lateral). */
export default function AccesoLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="contenido" className="flex flex-1 items-start justify-center px-5 py-12 sm:items-center sm:py-16">
      <div className="adm-caja w-full max-w-[440px] p-7 shadow-[var(--shadow-tarjeta)] sm:p-9">
        <div className="mb-6 flex items-center gap-3">
          <Image src="/marca/logo-jiump.png" alt="JIUMP" width={54} height={48} priority />
          <span className="font-ui text-[12px] font-semibold tracking-[0.08em] text-azul">ADMIN</span>
        </div>
        {children}
      </div>
    </main>
  );
}
