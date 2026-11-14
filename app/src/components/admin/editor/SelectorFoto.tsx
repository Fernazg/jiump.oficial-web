'use client';

import { useEffect, useRef, useState } from 'react';

export type FotoBiblioteca = { id: string; url: string; texto_alternativo: string; ancho: number | null; alto: number | null };

/**
 * Elegir una foto de la biblioteca existente (la subida de fotos llega en la
 * próxima etapa). Muestra miniaturas con búsqueda por texto alternativo.
 */
export function SelectorFoto({ fotos, abierto, onCerrar, onElegir, titulo }: {
  fotos: FotoBiblioteca[]; abierto: boolean; onCerrar: () => void; onElegir: (id: string) => void; titulo: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const lista = fotos.filter((f) => n(f.texto_alternativo).includes(n(q)));

  return (
    <dialog ref={ref} onClose={onCerrar} aria-label={titulo}
      className="m-auto h-[min(760px,calc(100dvh-40px))] w-[calc(100%-24px)] max-w-[960px] rounded-[22px] bg-white p-0 text-texto shadow-[0_30px_60px_rgba(0,0,0,.35)] backdrop:bg-azul-profundo/55">
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linea p-5">
          <div>
            <h2 className="font-titulo text-[20px] font-extrabold">{titulo}</h2>
            <p className="text-[13px] text-texto-3">Biblioteca de fotos de JIUMP · subir fotos nuevas llega en la próxima etapa.</p>
          </div>
          <button type="button" className="adm-boton adm-secundario" onClick={onCerrar}>Cerrar</button>
        </div>
        <div className="p-5 pb-0">
          <label className="sr-only" htmlFor="buscar-foto">Buscar foto</label>
          <input id="buscar-foto" type="search" className="adm-campo" placeholder="Buscar por descripción…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ul className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(140px,1fr))] content-start gap-3 overflow-y-auto p-5" data-biblioteca>
          {lista.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => onElegir(f.id)} data-foto={f.id}
                className="group block w-full overflow-hidden rounded-xl text-left shadow-[inset_0_0_0_1px_var(--color-linea)] focus-visible:outline-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada (bucket privado) */}
                <img src={f.url} alt={f.texto_alternativo} loading="lazy" className="aspect-[4/3] w-full object-cover transition-opacity group-hover:opacity-85" />
                <span className="line-clamp-2 block p-2 text-[12px] leading-snug text-texto-2">{f.texto_alternativo}</span>
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className="col-span-full p-6 text-center text-texto-3">No hay fotos que coincidan.</li>}
        </ul>
      </div>
    </dialog>
  );
}
