'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AccionesPublicacion } from '@/components/admin/AccionesPublicacion';
import { SelectorFoto, type FotoBiblioteca } from '@/components/admin/editor/SelectorFoto';
import { guardarPagina, type DatosPagina, type SeccionEditable } from '@/lib/admin/acciones-sitio';
import { CATALOGO, DESTINOS, type Campo, type ClavePaginaWeb } from '@/lib/catalogo-secciones';

const AVISOS: Record<string, string> = {
  publicado: 'Página publicada. Ya se ve en el sitio.',
  borrador: 'La página se retiró: ya no se ve en el sitio.',
  'cambios-publicados': 'Cambios publicados. Ya se ven en el sitio.',
  descartados: 'Se descartaron los cambios sin publicar.',
};

type Contenido = Record<string, unknown>;
type Tarjeta = { titulo?: string; foto_id?: string };
type Boton = { texto?: string; url?: string };

/**
 * Editor de una página (diseño AdminSitio): a la izquierda las secciones en
 * el orden en que aparecen (↑ ↓ y mostrar/ocultar); al centro los campos de
 * la sección elegida. El diseño de cada sección es fijo: aquí solo se cambian
 * textos, botones, fotos y tarjetas. Lo publicado no cambia hasta revisar la
 * vista previa y publicar.
 */
export function EditorPagina(p: {
  id: string; clave: ClavePaginaWeb; nombre: string; ruta: string;
  inicial: DatosPagina; version: string; estado: 'borrador' | 'publicado' | 'archivado';
  hayCambios: boolean; previaAlDia: boolean; catalogo: FotoBiblioteca[]; aviso: string | null;
}) {
  const router = useRouter();
  const tipos = CATALOGO[p.clave];
  const [d, setD] = useState<DatosPagina>(p.inicial);
  const [elegida, setElegida] = useState(p.inicial.secciones.find((s) => tipos.find((t) => t.tipo === s.tipo)?.campos.length)?.tipo ?? p.inicial.secciones[0]?.tipo ?? '');
  const [catalogo, setCatalogo] = useState(p.catalogo);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<{ texto: string; conflicto?: boolean } | null>(null);
  const [elegirFoto, setElegirFoto] = useState<null | ((id: string) => void)>(null);
  const [listo, setListo] = useState(false);
  const version = useRef(p.version);
  const guardadoMostrado = useRef(JSON.stringify([p.version, p.inicial]));
  const guardadoActual = JSON.stringify([p.version, p.inicial]);
  useEffect(() => {
    if (guardadoMostrado.current === guardadoActual) return;
    guardadoMostrado.current = guardadoActual;
    setD(p.inicial); setSucio(false); version.current = p.version;
  }, [guardadoActual]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setListo(true), []);
  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => { if (sucio) e.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sucio]);

  const cambiarSecciones = (f: (xs: SeccionEditable[]) => SeccionEditable[]) => { setD((x) => ({ ...x, secciones: f(x.secciones) })); setSucio(true); };
  const mover = (i: number, dir: -1 | 1) => cambiarSecciones((xs) => {
    const j = i + dir;
    if (j < 0 || j >= xs.length) return xs;
    const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });
  const alternar = (i: number) => cambiarSecciones((xs) => xs.map((s, k) => (k === i ? { ...s, visible: !s.visible } : s)));
  const campo = (tipo: string, clave: string, valor: unknown) =>
    cambiarSecciones((xs) => xs.map((s) => (s.tipo === tipo ? { ...s, contenido: { ...s.contenido, [clave]: valor } } : s)));

  const guardar = async () => {
    setGuardando(true);
    const r = await guardarPagina(p.id, p.clave, d, version.current);
    setGuardando(false);
    if (r.ok) { version.current = r.version; setSucio(false); setError(null); router.refresh(); return true; }
    setError({ texto: r.error, conflicto: r.conflicto });
    return false;
  };
  const irAVistaPrevia = async () => {
    if (sucio && !(await guardar())) return;
    router.push(`/admin/pagina-web/${p.clave}/vista-previa`);
  };

  const publicado = p.estado === 'publicado';
  const seleccion = d.secciones.find((s) => s.tipo === elegida);
  const def = tipos.find((t) => t.tipo === elegida);
  const urlFoto = (id: unknown) => catalogo.find((f) => f.id === id)?.url;

  return (
    <div className="flex min-w-0 flex-col gap-5" data-editor-pagina={p.clave} data-listo={listo || undefined} data-version={p.version}>
      <section className="adm-caja flex flex-col gap-4 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-titulo text-[24px] font-extrabold leading-tight">{p.nombre}</h2>
          <span data-estado-contenido={p.estado} className={`adm-chip ${publicado ? 'bg-[#e0f5f3] text-[#00665f]' : 'bg-[#eef0f2] text-texto-2'}`}>
            {publicado ? 'Publicada' : 'Sin publicar'}
          </span>
          {publicado && <a href={p.ruta} target="_blank" rel="noopener" className="text-[14px] font-semibold text-azul underline">Ver página pública</a>}
        </div>
        <AccionesPublicacion tipo="pagina" id={p.id} titulo={p.nombre} publicado={publicado} hayCambios={p.hayCambios}
          previaAlDia={p.previaAlDia} sucio={sucio} alVerPrevia={irAVistaPrevia} />
        {p.aviso && AVISOS[p.aviso] && <p role="status" className="adm-ok">{AVISOS[p.aviso]}</p>}
        {error && <p role="alert" className="adm-error">{error.texto}{error.conflicto && <button type="button" className="ml-2 font-semibold underline" onClick={() => window.location.reload()}>Recargar</button>}</p>}
      </section>

      {tipos.length > 0 && (
        <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <section className="adm-caja flex flex-col gap-3 p-5" aria-label="Secciones" data-lista-secciones>
            <p className="text-[13px] text-texto-3">Secciones de {p.nombre} en el orden en que aparecen</p>
            <ol className="flex flex-col gap-1.5">
              {d.secciones.map((s, i) => {
                const t = tipos.find((x) => x.tipo === s.tipo)!;
                return (
                  <li key={s.tipo} data-seccion={s.tipo} data-visible={s.visible}
                    className={`flex flex-col gap-1.5 rounded-[14px] p-2.5 ${elegida === s.tipo ? 'bg-azul-claro/60' : ''}`}>
                    <button type="button" onClick={() => setElegida(s.tipo)} aria-current={elegida === s.tipo}
                      className={`text-left font-ui text-[14px] font-semibold ${s.visible ? '' : 'text-texto-3 line-through'}`}>
                      {i + 1}. {t.nombre}
                    </button>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" className="adm-mini adm-mini-gris" aria-label={`Subir ${t.nombre}`} disabled={i === 0} onClick={() => mover(i, -1)}>↑</button>
                      <button type="button" className="adm-mini adm-mini-gris" aria-label={`Bajar ${t.nombre}`} disabled={i === d.secciones.length - 1} onClick={() => mover(i, 1)}>↓</button>
                      <button type="button" className={`adm-mini ${s.visible ? 'adm-mini-azul' : 'adm-mini-gris'}`} onClick={() => alternar(i)} data-alternar-visible>
                        {s.visible ? 'Visible · ocultar' : 'Oculta · mostrar'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="text-[13px] text-texto-3">Las secciones se ordenan y ocultan, pero no se diseñan desde aquí: así la página siempre se ve bien.</p>
          </section>

          <section className="adm-caja flex min-w-0 flex-col gap-4 p-5 sm:p-7" data-campos-seccion={elegida}>
            {def && seleccion ? (
              <>
                <div>
                  <h3 className="adm-h2">{def.nombre}</h3>
                  <p className="text-[14px] text-texto-2">{def.resumen}</p>
                  {!seleccion.visible && <p className="adm-aviso mt-2">Esta sección está oculta: no aparece en la página.</p>}
                </div>
                {def.campos.length === 0 && <p className="text-[14px] text-texto-2">Esta sección se llena sola: aquí solo se ordena o se oculta.</p>}
                {def.campos.map((c) => (
                  <CampoSeccion key={c.clave} campo={c} valor={seleccion.contenido[c.clave]} urlFoto={urlFoto}
                    alCambiar={(v) => campo(def.tipo, c.clave, v)} elegirFoto={(fn) => setElegirFoto(() => fn)} />
                ))}
              </>
            ) : <p className="text-texto-2">Elige una sección.</p>}
          </section>
        </div>
      )}

      <section className="adm-caja flex flex-col gap-4 p-5 sm:p-7" data-seo>
        <h3 className="adm-h2">Buscadores y redes (SEO)</h3>
        <p className="text-[14px] text-texto-2">Si se dejan vacíos, se usan los de Configuración.</p>
        <label className="adm-etiqueta-campo">Título para buscadores · {d.seo_titulo.length}/70
          <input className="adm-campo" name="seo_titulo" maxLength={70} value={d.seo_titulo} onChange={(e) => { setD({ ...d, seo_titulo: e.target.value }); setSucio(true); }} />
        </label>
        <label className="adm-etiqueta-campo">Descripción para buscadores · {d.seo_descripcion.length}/170
          <textarea className="adm-campo" name="seo_descripcion" rows={2} maxLength={170} value={d.seo_descripcion} onChange={(e) => { setD({ ...d, seo_descripcion: e.target.value }); setSucio(true); }} />
        </label>
      </section>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-[20px] border border-linea bg-white/95 px-5 py-3 backdrop-blur">
        <button type="button" className="adm-boton adm-primario" onClick={guardar} disabled={!sucio || guardando} data-guardar>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        <span className="text-[13px] text-texto-3" data-estado-guardado={sucio ? 'sin-guardar' : 'al-dia'}>{sucio ? 'Cambios sin guardar' : 'Todo guardado'}</span>
      </div>

      <datalist id="destinos-sitio">{DESTINOS.map((x) => <option key={x.url} value={x.url}>{x.nombre}</option>)}</datalist>
      <SelectorFoto fotos={catalogo} abierto={Boolean(elegirFoto)} titulo="Elegir foto" onCerrar={() => setElegirFoto(null)}
        alSubir={(f) => setCatalogo((c) => [f, ...c])}
        onElegir={(id) => { elegirFoto?.(id); setElegirFoto(null); }} />
    </div>
  );
}

function Miniatura({ url, alt }: { url?: string; alt: string }) {
  return url
    ? <img src={url} alt={alt} className="h-[72px] w-[108px] shrink-0 rounded-[10px] object-cover" /> // eslint-disable-line @next/next/no-img-element
    : <span className="grid h-[72px] w-[108px] shrink-0 place-items-center rounded-[10px] bg-gris-claro text-[12px] text-texto-3">Sin foto</span>;
}

function CampoSeccion({ campo: c, valor, alCambiar, elegirFoto, urlFoto }: {
  campo: Campo; valor: unknown; alCambiar: (v: unknown) => void; elegirFoto: (fn: (id: string) => void) => void; urlFoto: (id: unknown) => string | undefined;
}) {
  if (c.tipo === 'texto') {
    const v = typeof valor === 'string' ? valor : '';
    const props = { className: 'adm-campo', name: c.clave, maxLength: c.max, value: v, onChange: (e: { target: { value: string } }) => alCambiar(e.target.value) };
    return (
      <label className="adm-etiqueta-campo">{c.nombre} · {v.length}/{c.max}
        {c.largo ? <textarea rows={3} {...props} /> : <input {...props} />}
      </label>
    );
  }
  if (c.tipo === 'boton') {
    const b = (valor ?? {}) as Boton;
    return (
      <fieldset className="grid gap-3 rounded-[14px] bg-gris-claro/60 p-4 sm:grid-cols-2" data-campo-boton={c.clave}>
        <legend className="sr-only">{c.nombre}</legend>
        <label className="adm-etiqueta-campo">{c.nombre}: texto · {(b.texto ?? '').length}/40
          <input className="adm-campo" maxLength={40} value={b.texto ?? ''} onChange={(e) => alCambiar({ ...b, texto: e.target.value })} />
        </label>
        <label className="adm-etiqueta-campo">Lleva a… (página del sitio o https://)
          <input className="adm-campo" list="destinos-sitio" value={b.url ?? ''} placeholder="/eventos" onChange={(e) => alCambiar({ ...b, url: e.target.value })} />
        </label>
      </fieldset>
    );
  }
  if (c.tipo === 'foto') {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-[14px] bg-gris-claro/60 p-4" data-campo-foto={c.clave}>
        <Miniatura url={urlFoto(valor)} alt={c.nombre} />
        <div className="flex flex-col gap-2">
          <strong className="font-ui text-[15px]">{c.nombre}</strong>
          <span className="text-[13px] text-texto-2">Se recorta y oscurece sola para que el texto se lea.</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="adm-boton adm-borde-azul" onClick={() => elegirFoto((id) => alCambiar(id))}>{valor ? 'Cambiar desde la biblioteca' : 'Elegir de la biblioteca'}</button>
            {Boolean(valor) && <button type="button" className="adm-mini adm-mini-rojo" onClick={() => alCambiar(undefined)}>Quitar</button>}
          </div>
        </div>
      </div>
    );
  }
  if (c.tipo === 'fotos') {
    const xs = Array.isArray(valor) ? (valor as string[]) : [];
    return (
      <div className="flex flex-col gap-2" data-campo-fotos={c.clave}>
        <strong className="font-ui text-[15px]">{c.nombre} ({xs.length}/{c.max})</strong>
        <div className="flex flex-wrap gap-3">
          {xs.map((id, i) => (
            <div key={`${id}-${i}`} className="flex flex-col gap-1.5">
              <Miniatura url={urlFoto(id)} alt={`Foto ${i + 1}`} />
              <div className="flex gap-1">
                <button type="button" className="adm-mini adm-mini-gris" aria-label="Mover a la izquierda" disabled={i === 0}
                  onClick={() => { const c2 = [...xs]; [c2[i - 1], c2[i]] = [c2[i], c2[i - 1]]; alCambiar(c2); }}>←</button>
                <button type="button" className="adm-mini adm-mini-gris" aria-label="Mover a la derecha" disabled={i === xs.length - 1}
                  onClick={() => { const c2 = [...xs]; [c2[i + 1], c2[i]] = [c2[i], c2[i + 1]]; alCambiar(c2); }}>→</button>
                <button type="button" className="adm-mini adm-mini-rojo" aria-label="Quitar foto" onClick={() => alCambiar(xs.filter((_, k) => k !== i))}>×</button>
              </div>
            </div>
          ))}
          {xs.length < c.max && (
            <button type="button" className="grid h-[72px] w-[108px] place-items-center rounded-[10px] border-2 border-dashed border-[#cdd1d6] text-[13px] font-semibold text-azul"
              onClick={() => elegirFoto((id) => alCambiar([...xs, id]))}>+ Agregar foto</button>
          )}
        </div>
      </div>
    );
  }
  // Tarjetas
  const xs = Array.isArray(valor) ? (valor as Tarjeta[]) : [];
  const cambiar = (i: number, t: Tarjeta) => alCambiar(xs.map((k, j) => (j === i ? t : k)));
  return (
    <div className="flex flex-col gap-3" data-campo-tarjetas={c.clave}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="font-ui text-[15px]">{c.nombre} ({xs.length}/{c.max})</strong>
        {xs.length < c.max && <button type="button" className="adm-boton adm-borde-azul" onClick={() => alCambiar([...xs, { titulo: '' }])} data-agregar-tarjeta>+ Agregar tarjeta</button>}
      </div>
      {xs.map((k, i) => (
        <div key={i} className="flex flex-wrap items-center gap-3 rounded-[14px] bg-gris-claro/60 p-3" data-tarjeta={i}>
          <button type="button" onClick={() => elegirFoto((id) => cambiar(i, { ...k, foto_id: id }))} aria-label="Elegir foto de la tarjeta"><Miniatura url={urlFoto(k.foto_id)} alt={k.titulo || 'Tarjeta'} /></button>
          <label className="adm-etiqueta-campo min-w-[180px] flex-1">Título · {(k.titulo ?? '').length}/60
            <input className="adm-campo" maxLength={60} value={k.titulo ?? ''} onChange={(e) => cambiar(i, { ...k, titulo: e.target.value })} />
          </label>
          <div className="flex gap-1">
            <button type="button" className="adm-mini adm-mini-gris" aria-label="Subir tarjeta" disabled={i === 0}
              onClick={() => { const c2 = [...xs]; [c2[i - 1], c2[i]] = [c2[i], c2[i - 1]]; alCambiar(c2); }}>↑</button>
            <button type="button" className="adm-mini adm-mini-gris" aria-label="Bajar tarjeta" disabled={i === xs.length - 1}
              onClick={() => { const c2 = [...xs]; [c2[i + 1], c2[i]] = [c2[i], c2[i + 1]]; alCambiar(c2); }}>↓</button>
            <button type="button" className="adm-mini adm-mini-rojo" aria-label="Quitar tarjeta" onClick={() => alCambiar(xs.filter((_, j) => j !== i))}>×</button>
          </div>
        </div>
      ))}
    </div>
  );
}
