'use client';

import type { FotoBiblioteca } from '@/components/admin/editor/SelectorFoto';

/**
 * Fotos de una actividad o un álbum (diseño AdminActividades): marcar la
 * portada con ★, ordenar con ← → y quitar con ×. Quitar no borra la foto
 * de la biblioteca.
 */
export function ListaFotos({ fotos, portada, catalogo, alCambiar, alAgregar, ayuda }: {
  fotos: string[];
  portada: string | null;
  catalogo: FotoBiblioteca[];
  alCambiar: (fotos: string[], portada: string | null) => void;
  alAgregar: () => void;
  ayuda: string;
}) {
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= fotos.length) return;
    const c = [...fotos];
    [c[i], c[j]] = [c[j], c[i]];
    alCambiar(c, portada);
  };
  const quitar = (id: string) => {
    const c = fotos.filter((x) => x !== id);
    alCambiar(c, portada === id ? (c[0] ?? null) : portada);
  };
  return (
    <div className="flex flex-col gap-3" data-fotos-contenido>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">Fotos ({fotos.length})</h3>
        <span className="text-[13px] text-texto-3">Marca la portada con ★, ordena con ← → y quita con ×</span>
      </div>
      <button type="button" onClick={alAgregar} data-agregar-fotos
        className="flex flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed border-[#9aa1a8] px-4 py-6 text-[14px] text-texto-3 hover:bg-gris-claro">
        <strong className="text-texto">Agregar fotos desde la biblioteca o subir nuevas</strong>
        JPG, PNG, WebP o AVIF · se optimizan solas
      </button>
      {fotos.length === 0 ? (
        <p className="rounded-xl bg-gris-claro p-4 text-[14px] text-texto-3">Aún no tiene fotos.</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {fotos.map((id, i) => {
            const f = catalogo.find((x) => x.id === id);
            const esPortada = id === portada;
            return (
              <li key={id} data-foto-elegida={id} data-portada-elegida={esPortada || undefined}
                className={`relative overflow-hidden rounded-xl bg-gris-claro ${esPortada ? 'ring-2 ring-rojo' : 'ring-1 ring-[#e1e3e6]'}`}>
                {esPortada && <span className="absolute left-2 top-2 rounded-full bg-rojo px-2 py-0.5 font-ui text-[11px] font-semibold text-white">Portada</span>}
                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada (bucket privado) */}
                {f ? <img src={f.url} alt={f.texto_alternativo} className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3]" />}
                <div className="flex justify-between gap-1 p-1.5">
                  <button type="button" className={`adm-mini px-2.5 ${esPortada ? 'bg-azul-claro text-azul-oscuro' : 'adm-mini-gris'}`} aria-label="Usar como portada"
                    aria-pressed={esPortada} onClick={() => alCambiar(fotos, id)}>★</button>
                  <span className="flex gap-1">
                    <button type="button" className="adm-mini adm-mini-gris px-2.5" aria-label="Mover antes" disabled={i === 0} onClick={() => mover(i, -1)}>←</button>
                    <button type="button" className="adm-mini adm-mini-gris px-2.5" aria-label="Mover después" disabled={i === fotos.length - 1} onClick={() => mover(i, 1)}>→</button>
                    <button type="button" className="adm-mini adm-mini-rojo px-2.5" aria-label="Quitar foto" onClick={() => quitar(id)}>×</button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[12.5px] text-texto-3">{ayuda}</p>
    </div>
  );
}
