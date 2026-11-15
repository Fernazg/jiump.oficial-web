import type { ReactNode } from 'react';

/**
 * Ayuda breve y desplegable de una sección del panel («¿Cómo funciona?»).
 * Cerrada no ocupa espacio; abierta explica los pasos en lenguaje simple.
 * Usa el mismo estilo que el desplegable de «¿No puedes escanear?».
 */
export function Ayuda({ titulo = '¿Cómo funciona?', children }: { titulo?: string; children: ReactNode }) {
  return (
    <details className="mt-1 max-w-[70ch] text-[14px] text-texto-2" data-ayuda>
      <summary className="inline-flex min-h-9 cursor-pointer items-center font-ui text-[13px] font-semibold text-azul">{titulo}</summary>
      <div className="mt-1 rounded-xl bg-white p-4 leading-relaxed [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </details>
  );
}
