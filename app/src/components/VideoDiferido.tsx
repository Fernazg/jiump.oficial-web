'use client';

import { useState } from 'react';
import { Foto } from '@/components/Basicos';
import type { FotoFirmada } from '@/lib/tipos';

/**
 * Video de YouTube que no carga el reproductor hasta que la persona lo toca.
 *
 * Muestra la portada elegida en el panel (o, si no hay, la miniatura de
 * YouTube) con un botón de reproducir. Al tocarlo se cambia por el
 * reproductor, que empieza solo. Así la página no descarga el reproductor de
 * YouTube (cientos de KB y sus scripts) por cada video que nadie mira.
 *
 * Sin JavaScript, el mismo botón es un enlace que abre el video en YouTube.
 */
export function VideoDiferido({ youtubeId, titulo, portada }: { youtubeId: string; titulo: string; portada?: FotoFirmada }) {
  const [reproduciendo, setReproduciendo] = useState(false);

  if (reproduciendo) {
    return (
      <div className="aspect-video overflow-hidden rounded-[18px] bg-azul-profundo" data-video={youtubeId} data-video-reproductor>
        <iframe className="size-full" src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1`} title={titulo}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
    );
  }

  return (
    <a href={`https://www.youtube.com/watch?v=${youtubeId}`} target="_blank" rel="noopener noreferrer"
      onClick={(e) => { e.preventDefault(); setReproduciendo(true); }}
      aria-label={`Reproducir el video: ${titulo}`} data-video={youtubeId} data-video-portada={portada ? 'propia' : 'youtube'}
      className="group relative block aspect-video overflow-hidden rounded-[18px] bg-azul-profundo focus-visible:outline-3 focus-visible:outline-offset-2">
      {portada ? (
        <Foto foto={portada} className="size-full object-cover" tamanos="(max-width: 1024px) 90vw, 45vw" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura pública de YouTube
        <img src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      )}
      <span aria-hidden className="absolute inset-0 grid place-items-center bg-azul-profundo/15 transition-colors group-hover:bg-azul-profundo/30">
        <span className="grid size-16 place-items-center rounded-full bg-white/95 text-azul shadow-[0_8px_24px_rgba(0,0,0,.25)] transition-transform group-hover:scale-105 sm:size-[72px]">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" className="ml-1"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
        </span>
      </span>
    </a>
  );
}
