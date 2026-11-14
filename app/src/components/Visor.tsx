'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FotoFirmada } from '@/lib/tipos';
import { IconoCerrar, IconoDerecha, IconoIzquierda } from './Iconos';

/**
 * Cuadrícula de fotos + visor a pantalla completa (flechas, teclado y
 * deslizamiento en celular). Cada foto lleva su texto alternativo.
 * «mosaico»: rejilla del diseño de Galería; «columnas»: columnas a lo alto (actividades).
 */
export function GaleriaFotos({ fotos, diseno = 'columnas' }: { fotos: FotoFirmada[]; diseno?: 'mosaico' | 'columnas' }) {
  const [actual, setActual] = useState<number | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const toque = useRef<number | null>(null);

  const abrir = (i: number) => { setActual(i); dialogo.current?.showModal(); };
  const cerrar = useCallback(() => { dialogo.current?.close(); setActual(null); }, []);
  const mover = useCallback((d: number) => setActual((i) => (i === null ? i : (i + d + fotos.length) % fotos.length)), [fotos.length]);

  useEffect(() => {
    if (actual === null) return;
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') mover(1);
      if (e.key === 'ArrowLeft') mover(-1);
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  }, [actual, mover]);

  const foto = actual !== null ? fotos[actual] : null;
  const btn = 'grid size-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20';

  return (
    <>
      <ul className={diseno === 'mosaico'
        ? 'grid grid-flow-row-dense auto-rows-[150px] grid-cols-2 gap-2 sm:auto-rows-[200px] sm:gap-3 lg:grid-cols-4'
        : 'columns-1 gap-3 sm:columns-2 lg:columns-3 [&>li]:mb-3'}>
        {fotos.map((f, i) => (
          <li key={f.id}
            className={diseno === 'mosaico'
              // Patrón del diseño: una foto alta, una ancha y el resto normales
              ? `${i % 6 === 0 ? 'row-span-2' : ''} ${i % 6 === 2 ? 'lg:col-span-2' : ''}`
              : 'break-inside-avoid'}>
            <button type="button" onClick={() => abrir(i)}
              className={`levantar block w-full overflow-hidden rounded-[16px] ${diseno === 'mosaico' ? 'h-full' : ''}`}
              aria-label={`Ver en pantalla completa: ${f.texto_alternativo}`}>
              {/* Miniatura recortada solo en pantalla; el visor muestra la foto completa */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.texto_alternativo} width={f.ancho ?? undefined} height={f.alto ?? undefined}
                loading="lazy" decoding="async" className={diseno === 'mosaico' ? 'size-full object-cover' : 'w-full'} />
            </button>
          </li>
        ))}
      </ul>

      <dialog ref={dialogo} onClose={() => setActual(null)} aria-label="Visor de fotos"
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-azul-profundo/95 p-0 backdrop:bg-black/60"
        onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (toque.current === null) return;
          const d = e.changedTouches[0].clientX - toque.current;
          if (Math.abs(d) > 50) mover(d < 0 ? 1 : -1);
          toque.current = null;
        }}>
        {foto && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between p-4 text-white">
              <span className="t-meta">{(actual ?? 0) + 1} / {fotos.length}</span>
              <button type="button" className={btn} onClick={cerrar} aria-label="Cerrar visor"><IconoCerrar /></button>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto.url} alt={foto.texto_alternativo} className="max-h-full max-w-full rounded-xl object-contain" />
              {fotos.length > 1 && (
                <>
                  <button type="button" className={`${btn} absolute left-4 top-1/2 -translate-y-1/2 max-sm:hidden`} onClick={() => mover(-1)} aria-label="Foto anterior"><IconoIzquierda /></button>
                  <button type="button" className={`${btn} absolute right-4 top-1/2 -translate-y-1/2 max-sm:hidden`} onClick={() => mover(1)} aria-label="Foto siguiente"><IconoDerecha /></button>
                </>
              )}
            </div>
            <p className="px-6 py-5 text-center text-[15px] text-white/85">
              {foto.texto_alternativo}{foto.credito ? ` · Foto: ${foto.credito}` : ''}
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
