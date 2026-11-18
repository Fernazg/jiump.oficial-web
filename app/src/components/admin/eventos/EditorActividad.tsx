'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AccionesPublicacion } from '@/components/admin/AccionesPublicacion';
import { ConfirmarLocal } from '@/components/admin/ConfirmarLocal';
import { type BloqueEditable, CamposBloque } from '@/components/admin/editor/CamposBloque';
import { type FotoBiblioteca, SelectorFoto } from '@/components/admin/editor/SelectorFoto';
import { guardarActividad, type DatosActividad } from '@/lib/admin/acciones-contenido';
import { bloqueVacio, nombreBloque, TIPOS_BLOQUE, type TipoBloque } from '@/lib/admin/bloques';
import { idYoutube } from '@/lib/formato';
import type { Bloque } from '@/lib/tipos';
import { ListaFotos } from './ListaFotos';

type Seccion = { k: string; titulo: string; bloques: { k: string; b: BloqueEditable }[] };
type Enlace = { k: string; titulo: string; url: string; portada: string | null };

let n = 0;
const clave = () => `c${++n}`;

const AVISOS: Record<string, string> = {
  publicado: 'Publicada. Ya se ve en el sitio.',
  borrador: 'La actividad volvió a borrador: ya no se ve en el sitio.',
  'cambios-publicados': 'Cambios publicados. Ya se ven en el sitio.',
  descartados: 'Se descartaron los cambios sin publicar.',
};

export function EditorActividad(p: {
  id: string;
  inicial: Omit<DatosActividad, 'secciones' | 'enlaces'> & { secciones: { titulo: string; contenido: Bloque[] }[]; enlaces: { titulo: string; url: string; portada_foto_id?: string | null }[] };
  version: string;
  estado: 'borrador' | 'publicado' | 'archivado';
  previaAlDia: boolean;
  tipos: { clave: string; nombre: string }[];
  fotosElegidas: FotoBiblioteca[];
  fotosLibres: FotoBiblioteca[];
  aviso: string | null;
  hayCambios: boolean;
}) {
  const router = useRouter();
  const desdeInicial = () => {
    const { secciones: s0, enlaces: e0, ...resto } = p.inicial;
    return {
      d: { ...resto, titulo: resto.titulo === 'Actividad sin título' ? '' : resto.titulo },
      secciones: s0.map((s) => ({
        k: clave(), titulo: s.titulo, bloques: (Array.isArray(s.contenido) ? s.contenido : []).map((b) => ({ k: clave(), b: b as BloqueEditable })),
      })) as Seccion[],
      enlaces: e0.map((e) => ({ k: clave(), titulo: e.titulo, url: e.url, portada: e.portada_foto_id ?? null })) as Enlace[],
    };
  };
  const [d, setD] = useState(() => desdeInicial().d);
  const [secciones, setSecciones] = useState<Seccion[]>(() => desdeInicial().secciones);
  const [enlaces, setEnlaces] = useState<Enlace[]>(() => desdeInicial().enlaces);
  const [catalogo, setCatalogo] = useState<FotoBiblioteca[]>(() => [...p.fotosElegidas, ...p.fotosLibres.filter((f) => !p.inicial.fotos.includes(f.id))]);
  const [sucio, setSucio] = useState(false);
  const [estadoGuardar, setEstadoGuardar] = useState<'al-dia' | 'guardando' | 'error' | 'conflicto'>('al-dia');
  const [error, setError] = useState<string | null>(null);
  const [elegir, setElegir] = useState<null | { para: 'actividad' } | { para: 'bloque'; seccion: string; bloque: string } | { para: 'enlace'; enlace: string }>(null);
  const [listo, setListo] = useState(false);
  const version = useRef(p.version);
  // Si lo guardado cambia (publicar, descartar, guardar), el formulario vuelve a lo guardado.
  const guardadoMostrado = useRef(JSON.stringify([p.version, p.inicial]));
  const guardadoActual = JSON.stringify([p.version, p.inicial]);
  useEffect(() => {
    if (guardadoMostrado.current === guardadoActual) return;
    guardadoMostrado.current = guardadoActual;
    const x = desdeInicial();
    setD(x.d); setSecciones(x.secciones); setEnlaces(x.enlaces); setSucio(false);
    version.current = p.version;
  }, [guardadoActual]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setListo(true), []);
  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => { if (sucio) e.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sucio]);

  const cambiar = (c: Partial<typeof d>) => { setD((x) => ({ ...x, ...c })); setSucio(true); };
  const cambiarSecciones = (f: (s: Seccion[]) => Seccion[]) => { setSecciones(f); setSucio(true); };
  const cambiarEnlaces = (f: (e: Enlace[]) => Enlace[]) => { setEnlaces(f); setSucio(true); };

  const guardar = async (): Promise<boolean> => {
    setEstadoGuardar('guardando');
    const r = await guardarActividad(p.id, {
      ...d,
      secciones: secciones.map((s) => ({ titulo: s.titulo, contenido: s.bloques.map((x) => x.b) })),
      enlaces: enlaces.map(({ titulo, url, portada }) => ({ titulo, url, portada_foto_id: portada })),
    }, version.current);
    if (r.ok) {
      version.current = r.version;
      setSucio(false); setError(null); setEstadoGuardar('al-dia');
      router.refresh();
      return true;
    }
    setError(r.error); setEstadoGuardar(r.conflicto ? 'conflicto' : 'error');
    return false;
  };
  const irAVistaPrevia = async () => {
    if (sucio && !(await guardar())) return;
    router.push(`/admin/eventos/${p.id}/vista-previa`);
  };

  const publicada = p.estado === 'publicado';

  return (
    <section className="adm-caja flex min-w-0 flex-col gap-5 p-5 sm:p-7" data-editor-actividad data-listo={listo || undefined} data-version={p.version}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-titulo text-[24px] font-extrabold leading-tight">{d.titulo || 'Actividad sin título'}</h2>
          <span data-estado-contenido={p.estado} className={`adm-chip ${publicada ? 'bg-[#e0f5f3] text-[#00665f]' : 'bg-[#eef0f2] text-texto-2'}`}>
            {publicada ? 'Publicada' : p.estado === 'archivado' ? 'Archivada' : 'Borrador'}
          </span>
        </div>
      </div>
      <AccionesPublicacion tipo="actividad" id={p.id} titulo={d.titulo} publicado={publicada} hayCambios={p.hayCambios}
        previaAlDia={p.previaAlDia} sucio={sucio} alVerPrevia={irAVistaPrevia} />
      {p.aviso && AVISOS[p.aviso] && <p role="status" className="adm-ok">{AVISOS[p.aviso]}</p>}
      {error && <p role="alert" className="adm-error">{error}{estadoGuardar === 'conflicto' && <button type="button" className="ml-2 font-semibold underline" onClick={() => window.location.reload()}>Recargar</button>}</p>}

      {/* Datos */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="adm-etiqueta-campo sm:col-span-2">Título
          <input className="adm-campo" name="titulo" value={d.titulo} onChange={(e) => cambiar({ titulo: e.target.value })} placeholder="Nombre oficial de la actividad" />
        </label>
        <label className="adm-etiqueta-campo">Dirección (URL)
          <input className="adm-campo" name="slug" value={d.slug.startsWith('borrador-') ? '' : d.slug} placeholder="se crea desde el título"
            onChange={(e) => cambiar({ slug: e.target.value.toLowerCase() })} />
        </label>
        <label className="adm-etiqueta-campo">Tipo
          <select className="adm-campo" name="tipo" value={d.tipo} onChange={(e) => cambiar({ tipo: e.target.value })}>
            {p.tipos.map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}
          </select>
        </label>
        <label className="adm-etiqueta-campo">Año (obligatorio)
          <input className="adm-campo" name="anio" inputMode="numeric" maxLength={4} value={d.anio} onChange={(e) => cambiar({ anio: e.target.value.replace(/\D/g, '') })} />
        </label>
        <fieldset className="adm-etiqueta-campo">
          <legend className="mb-1.5">Fecha (opcional)</legend>
          <div className="flex flex-wrap gap-3 text-[13px] text-texto">
            <label className="flex items-center gap-1.5"><input type="radio" name="precision" checked={d.fecha_precision === 'dia'}
              onChange={() => cambiar({ fecha_precision: 'dia', fecha_inicio: '' })} /> Día exacto</label>
            <label className="flex items-center gap-1.5"><input type="radio" name="precision" checked={d.fecha_precision === 'mes'}
              onChange={() => cambiar({ fecha_precision: 'mes', fecha_inicio: '', fecha_fin: '' })} /> Solo mes y año</label>
          </div>
          {d.fecha_precision === 'mes' ? (
            <input className="adm-campo mt-1.5" type="month" aria-label="Mes y año" value={d.fecha_inicio.slice(0, 7)} onChange={(e) => cambiar({ fecha_inicio: e.target.value })} />
          ) : (
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <input className="adm-campo" type="date" aria-label="Fecha de inicio" value={d.fecha_inicio} onChange={(e) => cambiar({ fecha_inicio: e.target.value })} />
              <input className="adm-campo" type="date" aria-label="Fecha de término (opcional)" value={d.fecha_fin} min={d.fecha_inicio || undefined}
                onChange={(e) => cambiar({ fecha_fin: e.target.value })} />
            </div>
          )}
        </fieldset>
        <label className="adm-etiqueta-campo">Lugar
          <input className="adm-campo" name="lugar" value={d.lugar} placeholder="Por confirmar" onChange={(e) => cambiar({ lugar: e.target.value })} />
        </label>
        <label className="adm-etiqueta-campo">Zona
          <input className="adm-campo" name="zona" value={d.zona} onChange={(e) => cambiar({ zona: e.target.value })} />
        </label>
        <label className="adm-etiqueta-campo">Lema (opcional)
          <input className="adm-campo" name="lema" value={d.lema} maxLength={80} onChange={(e) => cambiar({ lema: e.target.value })} />
        </label>
        <label className="adm-etiqueta-campo">Abreviatura (opcional, ej.: EMJ)
          <input className="adm-campo uppercase" name="abreviatura" value={d.abreviatura} maxLength={10} onChange={(e) => cambiar({ abreviatura: e.target.value.toUpperCase() })} />
        </label>
        <label className="adm-etiqueta-campo">Cita bíblica: referencia (opcional)
          <input className="adm-campo" name="cita_referencia" value={d.cita_referencia} maxLength={60} placeholder="Ej.: 1 Samuel 3:8"
            onChange={(e) => cambiar({ cita_referencia: e.target.value })} />
        </label>
        <label className="adm-etiqueta-campo">Cita bíblica: texto (opcional)
          <textarea className="adm-campo" name="cita_texto" rows={2} value={d.cita_texto} onChange={(e) => cambiar({ cita_texto: e.target.value })} />
        </label>
        <label className="flex items-center gap-2.5 rounded-xl bg-gris-claro p-3.5 text-[14px] sm:col-span-2">
          <input type="checkbox" className="size-5" checked={d.destacar_inicio} onChange={(e) => cambiar({ destacar_inicio: e.target.checked })} />
          Destacar en Inicio (Actividades destacadas)
        </label>
        <label className="adm-etiqueta-campo sm:col-span-2">Introducción (texto oficial)
          <textarea className="adm-campo" name="introduccion" rows={5} value={d.introduccion} onChange={(e) => cambiar({ introduccion: e.target.value })} />
        </label>
      </div>

      {/* Secciones (Día 1, Día 2…) */}
      <div className="flex flex-col gap-3" data-secciones>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold">Secciones ({secciones.length})</h3>
          <button type="button" className="adm-mini adm-mini-azul" onClick={() => cambiarSecciones((s) => [...s, { k: clave(), titulo: '', bloques: [{ k: clave(), b: bloqueVacio('parrafo') as BloqueEditable }] }])}>
            + Agregar sección
          </button>
        </div>
        {secciones.length === 0 && <p className="rounded-xl bg-gris-claro p-4 text-[14px] text-texto-3">Sin secciones. Agrega una por cada parte (ej.: Día 1, Día 2) con el resumen oficial.</p>}
        {secciones.map((s, i) => (
          <div key={s.k} className="rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--color-linea)]" data-seccion-actividad>
            <div className="flex flex-wrap items-end gap-2">
              <label className="adm-etiqueta-campo min-w-0 flex-1">Título de la sección
                <input className="adm-campo font-semibold" value={s.titulo} placeholder="Ej.: Día 1"
                  onChange={(e) => cambiarSecciones((xs) => xs.map((x) => (x.k === s.k ? { ...x, titulo: e.target.value } : x)))} />
              </label>
              <button type="button" className="adm-mini adm-mini-gris" aria-label={`Subir sección ${i + 1}`} disabled={i === 0}
                onClick={() => cambiarSecciones((xs) => { const c = [...xs]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })}>↑</button>
              <button type="button" className="adm-mini adm-mini-gris" aria-label={`Bajar sección ${i + 1}`} disabled={i === secciones.length - 1}
                onClick={() => cambiarSecciones((xs) => { const c = [...xs]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; return c; })}>↓</button>
              <button type="button" className="adm-mini adm-mini-rojo" aria-label={`Quitar sección ${i + 1}`} onClick={() => cambiarSecciones((xs) => xs.filter((x) => x.k !== s.k))}>✕</button>
            </div>
            <ol className="mt-3 flex flex-col gap-3">
              {s.bloques.map((x) => (
                <li key={x.k} className="rounded-xl bg-gris-claro/60 p-3" data-bloque={x.b.tipo}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="t-etiqueta text-azul-oscuro">{nombreBloque(x.b.tipo)}</span>
                    <button type="button" className="adm-mini adm-mini-gris" aria-label="Quitar bloque"
                      onClick={() => cambiarSecciones((xs) => xs.map((y) => (y.k === s.k ? { ...y, bloques: y.bloques.filter((z) => z.k !== x.k) } : y)))}>✕</button>
                  </div>
                  <CamposBloque b={x.b} fotos={catalogo} alEnfocar={() => undefined}
                    elegirFoto={() => setElegir({ para: 'bloque', seccion: s.k, bloque: x.k })}
                    cambiar={(c) => cambiarSecciones((xs) => xs.map((y) => (y.k === s.k ? { ...y, bloques: y.bloques.map((z) => (z.k === x.k ? { ...z, b: { ...z.b, ...c } } : z)) } : y)))} />
                </li>
              ))}
            </ol>
            <label className="mt-3 flex items-center gap-2 text-[13px] text-texto-3">Agregar bloque
              <select className="adm-campo w-auto" value="" aria-label="Agregar bloque a la sección"
                onChange={(e) => {
                  const tipo = e.target.value as TipoBloque;
                  if (tipo) cambiarSecciones((xs) => xs.map((y) => (y.k === s.k ? { ...y, bloques: [...y.bloques, { k: clave(), b: bloqueVacio(tipo) as BloqueEditable }] } : y)));
                }}>
                <option value="">Elegir…</option>
                {TIPOS_BLOQUE.map((tb) => <option key={tb.tipo} value={tb.tipo}>{tb.nombre}</option>)}
              </select>
            </label>
          </div>
        ))}
      </div>

      {/* Fotos */}
      <ListaFotos fotos={d.fotos} portada={d.portada_foto_id} catalogo={catalogo}
        alCambiar={(fotos, portada) => cambiar({ fotos, portada_foto_id: portada })}
        alAgregar={() => setElegir({ para: 'actividad' })}
        ayuda="Quitar una foto de la actividad no la borra: queda en la biblioteca." />

      {/* Videos y enlaces */}
      <div className="flex flex-col gap-3" data-enlaces>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold">Videos y transmisiones ({enlaces.length})</h3>
          <button type="button" className="adm-mini adm-mini-azul" onClick={() => cambiarEnlaces((e) => [...e, { k: clave(), titulo: '', url: '', portada: null }])}>+ Agregar enlace</button>
        </div>
        {enlaces.map((e, i) => {
          const foto = e.portada ? catalogo.find((f) => f.id === e.portada) : undefined;
          const yt = idYoutube(e.url.trim());
          const cambiarEste = (c: Partial<Enlace>) => cambiarEnlaces((xs) => xs.map((x) => (x.k === e.k ? { ...x, ...c } : x)));
          return (
            <div key={e.k} className="flex flex-col gap-2.5 rounded-[14px] border border-linea p-3.5" data-enlace>
              <div className="flex items-center gap-2">
                <input className="adm-campo min-w-0 flex-1" aria-label={`Título del enlace ${i + 1}`} placeholder="Ej.: Transmisión Día 1" value={e.titulo}
                  onChange={(ev) => cambiarEste({ titulo: ev.target.value })} />
                <ConfirmarLocal boton="Quitar" claseBoton="adm-mini adm-mini-rojo shrink-0" etiqueta={`Quitar enlace ${i + 1}`}
                  titulo={`¿Quitar «${e.titulo.trim() || `enlace ${i + 1}`}»?`}
                  alConfirmar={() => cambiarEnlaces((xs) => xs.filter((x) => x.k !== e.k))}>
                  Deja de aparecer en la actividad cuando guardes. El video sigue en YouTube.
                </ConfirmarLocal>
              </div>
              <input className="adm-campo" aria-label={`Dirección del enlace ${i + 1}`} placeholder="https://youtube.com/…" value={e.url}
                onChange={(ev) => cambiarEste({ url: ev.target.value })} />
              <div className="flex flex-wrap items-center gap-3" data-portada-enlace={e.portada ? 'propia' : yt ? 'youtube' : 'ninguna'}>
                {foto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada (bucket privado)
                  <img src={foto.url} alt={foto.texto_alternativo} className="aspect-video w-[128px] rounded-[10px] object-cover" />
                ) : e.portada ? (
                  <span className="grid aspect-video w-[128px] place-items-center rounded-[10px] bg-gris-claro text-[12px] text-texto-3">Foto elegida</span>
                ) : yt ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura pública de YouTube
                  <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="Miniatura de YouTube" className="aspect-video w-[128px] rounded-[10px] object-cover" />
                ) : (
                  <span className="grid aspect-video w-[128px] place-items-center rounded-[10px] bg-gris-claro text-[12px] text-texto-3">Sin portada</span>
                )}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-texto-2">{e.portada ? 'Portada elegida' : yt ? 'Portada: miniatura de YouTube' : 'Portada (opcional)'}</span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="adm-mini adm-mini-azul" aria-label={`${e.portada ? 'Cambiar' : 'Elegir'} portada del enlace ${i + 1}`}
                      onClick={() => setElegir({ para: 'enlace', enlace: e.k })}>{e.portada ? 'Cambiar portada' : 'Elegir portada'}</button>
                    {e.portada && (
                      <button type="button" className="adm-mini adm-mini-gris" aria-label={`Quitar portada del enlace ${i + 1}`}
                        onClick={() => cambiarEste({ portada: null })}>Quitar portada</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t border-linea bg-white/95 px-5 py-3 backdrop-blur sm:-mx-7 sm:px-7">
        <button type="button" className="adm-boton adm-primario" onClick={guardar} disabled={!sucio || estadoGuardar === 'guardando'} data-guardar>
          {estadoGuardar === 'guardando' ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <span className="text-[13px] text-texto-3" data-estado-guardado={sucio ? 'sin-guardar' : estadoGuardar}>
          {sucio ? 'Cambios sin guardar' : estadoGuardar === 'al-dia' ? 'Todo guardado' : ''}
        </span>
        <span className="ml-auto hidden text-[12px] text-texto-3 sm:inline">Solo Superadministrador y Eventos editan actividades. Se valida en el servidor.</span>
      </div>

      <SelectorFoto fotos={elegir?.para === 'actividad' ? catalogo.filter((f) => !d.fotos.includes(f.id)) : catalogo} abierto={elegir !== null}
        titulo={elegir?.para === 'actividad' ? 'Agregar fotos a la actividad' : elegir?.para === 'enlace' ? 'Portada del video' : 'Elegir foto'}
        alSubir={(f) => setCatalogo((c) => [f, ...c])}
        onCerrar={() => setElegir(null)}
        onElegir={(fotoId) => {
          if (elegir?.para === 'actividad') {
            if (!d.fotos.includes(fotoId)) cambiar({ fotos: [...d.fotos, fotoId], portada_foto_id: d.portada_foto_id ?? fotoId });
          } else if (elegir?.para === 'enlace') {
            const { enlace } = elegir;
            cambiarEnlaces((xs) => xs.map((x) => (x.k === enlace ? { ...x, portada: fotoId } : x)));
          } else if (elegir?.para === 'bloque') {
            const { seccion, bloque } = elegir;
            cambiarSecciones((xs) => xs.map((y) => (y.k === seccion ? { ...y, bloques: y.bloques.map((z) => (z.k === bloque ? { ...z, b: { ...z.b, foto_id: fotoId } } : z)) } : y)));
          }
          setElegir(null);
        }} />
    </section>
  );
}
