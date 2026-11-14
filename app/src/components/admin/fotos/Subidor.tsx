'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { subirFoto } from '@/lib/admin/acciones-fotos';
import type { FotoElegible } from '@/lib/admin/fotos';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const LIMITE = 10 * 1024 * 1024;

type Pendiente = { clave: string; archivo: File; vista: string; alt: string; credito: string; estado: 'lista' | 'subiendo' | 'error'; error?: string };

/**
 * Subir fotos arrastrando o eligiendo archivos. Cada foto necesita su texto
 * alternativo antes de subirse (accesibilidad); el crédito es opcional. El
 * servidor vuelve a validar todo y crea las versiones optimizadas.
 */
export function Subidor({ alSubir, una = false, compacto = false }: {
  alSubir: (fotos: FotoElegible[]) => void;
  /** Solo una foto (p. ej. portada desde el editor). */
  una?: boolean;
  compacto?: boolean;
}) {
  const [lista, setLista] = useState<Pendiente[]>([]);
  const [rechazos, setRechazos] = useState<string[]>([]);
  const [encima, setEncima] = useState(false);
  const [listo, setListo] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => setListo(true), []);
  useEffect(() => () => lista.forEach((p) => URL.revokeObjectURL(p.vista)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const agregar = (archivos: FileList | File[]) => {
    const nuevos: Pendiente[] = [];
    const malos: string[] = [];
    for (const a of Array.from(archivos).slice(0, una ? 1 : 30)) {
      if (!TIPOS.includes(a.type)) malos.push(`«${a.name}» no es JPG, PNG, WebP ni AVIF.`);
      else if (a.size > LIMITE) malos.push(`«${a.name}» pesa más de 10 MB.`);
      else nuevos.push({ clave: crypto.randomUUID(), archivo: a, vista: URL.createObjectURL(a), alt: '', credito: '', estado: 'lista' });
    }
    setRechazos(malos);
    setLista((l) => (una ? nuevos : [...l, ...nuevos]));
  };
  const cambiar = (clave: string, c: Partial<Pendiente>) => setLista((l) => l.map((p) => (p.clave === clave ? { ...p, ...c } : p)));
  const quitar = (clave: string) => setLista((l) => l.filter((p) => p.clave !== clave));

  const faltanAlt = lista.some((p) => !p.alt.trim());
  const subiendo = lista.some((p) => p.estado === 'subiendo');

  const subirTodas = async () => {
    const hechas: FotoElegible[] = [];
    for (const p of lista) {
      cambiar(p.clave, { estado: 'subiendo', error: undefined });
      const d = new FormData();
      d.set('archivo', p.archivo);
      d.set('texto_alternativo', p.alt);
      d.set('credito', p.credito);
      const r = await subirFoto(d).catch(() => ({ ok: false as const, error: `No se pudo subir «${p.archivo.name}».` }));
      if (r.ok) {
        hechas.push(r.foto);
        URL.revokeObjectURL(p.vista);
        quitar(p.clave);
      } else {
        cambiar(p.clave, { estado: 'error', error: r.error });
      }
    }
    if (hechas.length) alSubir(hechas);
  };

  return (
    <div className="flex flex-col gap-3" data-subidor data-listo={listo || undefined}>
      <div
        onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => { e.preventDefault(); setEncima(false); agregar(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed text-center text-[14px] text-texto-3 transition-colors ${compacto ? 'px-4 py-6' : 'px-5 py-10'} ${encima ? 'border-azul bg-azul-claro' : 'border-[#9aa1a8] bg-white'}`}>
        <strong className="text-texto">{una ? 'Arrastra una foto aquí o' : 'Arrastra fotos aquí o'}{' '}
          <button type="button" className="enlace" onClick={() => entrada.current?.click()}>elige {una ? 'un archivo' : 'archivos'}</button>
        </strong>
        <span>JPG, PNG, WebP o AVIF · hasta 10 MB · se optimizan y se crean versiones para celular automáticamente</span>
        <label htmlFor={id} className="sr-only">Elegir fotos para subir</label>
        <input ref={entrada} id={id} type="file" accept={TIPOS.join(',')} multiple={!una} className="sr-only"
          onChange={(e) => { if (e.target.files) agregar(e.target.files); e.target.value = ''; }} />
      </div>
      {rechazos.length > 0 && <ul role="alert" className="adm-error">{rechazos.map((r) => <li key={r}>{r}</li>)}</ul>}

      {lista.length > 0 && (
        <div className="adm-caja flex flex-col gap-3 p-4 shadow-[inset_0_0_0_1px_var(--color-linea)]" data-por-subir>
          <ul className="flex flex-col gap-3">
            {lista.map((p) => (
              <li key={p.clave} className="grid gap-3 sm:grid-cols-[112px_1fr]" data-pendiente={p.archivo.name}>
                {/* eslint-disable-next-line @next/next/no-img-element -- vista local del archivo elegido */}
                <img src={p.vista} alt="" className="h-[84px] w-full rounded-xl object-cover sm:w-[112px]" />
                <div className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
                  <label className="adm-etiqueta-campo">Texto alternativo (obligatorio)
                    <input className="adm-campo" value={p.alt} required maxLength={300} placeholder="Describe lo que se ve en la foto"
                      onChange={(e) => cambiar(p.clave, { alt: e.target.value })} disabled={p.estado === 'subiendo'} />
                  </label>
                  <label className="adm-etiqueta-campo">Crédito (opcional)
                    <input className="adm-campo" value={p.credito} maxLength={120} onChange={(e) => cambiar(p.clave, { credito: e.target.value })}
                      disabled={p.estado === 'subiendo'} />
                  </label>
                  <button type="button" className="adm-mini adm-mini-gris self-end" onClick={() => quitar(p.clave)} disabled={p.estado === 'subiendo'}
                    aria-label={`No subir ${p.archivo.name}`}>Quitar</button>
                  <span className="text-[12.5px] text-texto-3 sm:col-span-3">
                    {p.archivo.name} · {(p.archivo.size / 1024 / 1024).toFixed(1)} MB
                    {p.estado === 'subiendo' && ' · subiendo y optimizando…'}
                    {p.error && <span className="ml-1 font-semibold text-rojo-oscuro">· {p.error}</span>}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="adm-boton adm-primario" onClick={subirTodas} disabled={faltanAlt || subiendo} data-subir-fotos>
              {subiendo ? 'Subiendo…' : lista.length === 1 ? 'Subir foto' : `Subir ${lista.length} fotos`}
            </button>
            {faltanAlt && <span className="text-[13px] text-[#7a4b00]">Falta el texto alternativo de {lista.filter((p) => !p.alt.trim()).length === 1 ? 'una foto' : 'algunas fotos'}.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
