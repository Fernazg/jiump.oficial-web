'use client';

import { useState } from 'react';
import { BotonEnviar, Formulario } from '@/components/admin/Formulario';
import { guardarVideo } from '@/lib/admin/acciones-contenido';
import { idYoutube } from '@/lib/formato';

/** Alta y edición de un video de YouTube, con la miniatura como referencia. */
export function FormularioVideo({ video, destinos }: {
  video: { id: string; url: string; titulo: string; descripcion: string; destino: string; version: string } | null;
  destinos: { valor: string; nombre: string }[];
}) {
  const [url, setUrl] = useState(video?.url ?? '');
  const [titulo, setTitulo] = useState(video?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(video?.descripcion ?? '');
  const id = idYoutube(url.trim());
  const valida = /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(url.trim()) && id;
  return (
    <Formulario accion={guardarVideo} className="flex flex-col gap-4">
      {video && <><input type="hidden" name="id" value={video.id} /><input type="hidden" name="version" value={video.version} /></>}
      <label className="adm-etiqueta-campo">Enlace de YouTube
        <input className="adm-campo" name="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" required />
      </label>
      {url && !valida && <p className="text-[13px] font-semibold text-rojo-oscuro">El enlace no parece de YouTube. Pega uno como https://www.youtube.com/watch?v=…</p>}
      <label className="adm-etiqueta-campo">Título · {titulo.length}/90
        <input className="adm-campo" name="titulo" value={titulo} maxLength={90} onChange={(e) => setTitulo(e.target.value)} required />
      </label>
      <label className="adm-etiqueta-campo">Descripción (opcional) · {descripcion.length}/200
        <textarea className="adm-campo" name="descripcion" rows={3} maxLength={200} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </label>
      <label className="adm-etiqueta-campo">Dónde aparece
        <select className="adm-campo" name="destino" defaultValue={video?.destino ?? ''}>
          <option value="">Sin asignar (no aparece en ninguna página)</option>
          {destinos.map((d) => <option key={d.valor} value={d.valor}>{d.nombre}</option>)}
        </select>
      </label>
      {valida && (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura pública de YouTube
        <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="Miniatura del video en YouTube" className="w-full max-w-[360px] rounded-xl" />
      )}
      <BotonEnviar className="adm-boton adm-primario self-start">{video ? 'Guardar cambios' : 'Agregar video'}</BotonEnviar>
    </Formulario>
  );
}
