import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { tam?: number };

function Base({ tam = 24, children, ...props }: P & { children: React.ReactNode }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const IconoBuscar = (p: P) => <Base {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Base>;
export const IconoImagen = (p: P) => <Base {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></Base>;
export const IconoCalendario = (p: P) => <Base {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></Base>;
export const IconoVideo = (p: P) => <Base {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3z" /></Base>;
export const IconoLibro = (p: P) => <Base {...p}><path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5Z" /><path d="M12 6v13" /></Base>;
export const IconoAntorcha = (p: P) => <Base {...p}><path d="M12 3c2 2 2.5 4 0 6-2.5-2-2-4 0-6Z" /><path d="M8.5 10h7l-2 4h-3Z" /><path d="M12 14v7" /></Base>;
export const IconoTexto = (p: P) => <Base {...p}><path d="M5 6h14M5 12h14M5 18h9" /></Base>;
export const IconoInstagram = (p: P) => <Base {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></Base>;
export const IconoMenu = (p: P) => <Base {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Base>;
export const IconoCerrar = (p: P) => <Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>;
export const IconoHerramienta = (p: P) => <Base {...p}><path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.6-.6-2.4Z" /></Base>;
export const IconoIzquierda = (p: P) => <Base {...p}><path d="m15 18-6-6 6-6" /></Base>;
export const IconoDerecha = (p: P) => <Base {...p}><path d="m9 18 6-6-6-6" /></Base>;
export const IconoUbicacion = (p: P) => <Base {...p}><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></Base>;
