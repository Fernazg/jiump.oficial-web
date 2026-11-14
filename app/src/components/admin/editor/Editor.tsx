'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { Confirmar } from '@/components/admin/Confirmar';
import type { EstadoFormulario } from '@/components/admin/Formulario';
import {
  descartarCambios, enviarARevision, guardarArticulo, latido, moverAPapelera, publicarArticulo, restaurarVersion,
  salirDelEditor, volverABorrador, type DatosEditor,
} from '@/lib/admin/acciones-articulos';
import type { EstadoArticulo, Version } from '@/lib/admin/articulos';
import { bloqueVacio, nombreBloque, slugDesde, TIPOS_BLOQUE, type TipoBloque } from '@/lib/admin/bloques';
import { fechaHoraChile, haceCuanto, utcAChileLocal } from '@/lib/admin/hora-chile';
import type { Bloque } from '@/lib/tipos';
import { type BloqueEditable, CamposBloque } from './CamposBloque';
import { type FotoBiblioteca, SelectorFoto } from './SelectorFoto';

type Inicial = Omit<DatosEditor, 'cuerpo'> & { cuerpo: Bloque[] };
type Props = {
  id: string;
  inicial: Inicial;
  version: string;
  estado: EstadoArticulo;
  estadoVisible: EstadoArticulo;
  publicarEn: string | null;
  publicarEnIso: string | null;
  hayCambiosPendientes: boolean;
  previaAlDia: boolean;
  series: { id: string; nombre: string }[];
  temas: { id: string; nombre: string }[];
  fotos: FotoBiblioteca[];
  historial: Version[];
  aviso: string | null;
  slugPublico: string;
};

const NOMBRE_ESTADO: Record<EstadoArticulo, { nombre: string; chip: string }> = {
  borrador: { nombre: 'Borrador', chip: 'bg-[#eef0f2] text-texto-2' },
  revision: { nombre: 'En revisión', chip: 'bg-[#fff1d6] text-[#7a4b00]' },
  programado: { nombre: 'Programado', chip: 'bg-azul-claro text-azul-oscuro' },
  publicado: { nombre: 'Publicado', chip: 'bg-[#e0f5f3] text-[#00665f]' },
  papelera: { nombre: 'Papelera', chip: 'bg-rojo-claro text-rojo-oscuro' },
};

const AVISOS: Record<string, string> = {
  revision: 'Enviado a revisión.',
  borrador: 'El artículo volvió a borrador: ya no se ve en el sitio.',
  publicado: 'Publicado. Ya se ve en el sitio.',
  programado: 'Programado. Se publicará solo en la fecha indicada.',
  descartados: 'Se descartaron los cambios sin publicar.',
  restaurado: 'Artículo restaurado desde la papelera, como borrador.',
  version: 'Versión restaurada. Revísala y, si el artículo está publicado, publícala con vista previa.',
};

const RAPIDOS: TipoBloque[] = ['titulo_seccion', 'lista_numerada', 'versiculo', 'imagen', 'video'];
const ETIQUETA_RAPIDA: Partial<Record<TipoBloque, string>> = { titulo_seccion: 'Título', lista_numerada: 'Lista', versiculo: 'Versículo', imagen: 'Imagen', video: 'Video' };

let contador = 0;
const nuevaClave = () => `b${++contador}`;

type Guardado = 'al-dia' | 'pendiente' | 'guardando' | 'error' | 'conflicto';

export function Editor(p: Props) {
  const router = useRouter();
  const publico = p.estado === 'publicado' || p.estado === 'programado';

  // --- Contenido ------------------------------------------------------------
  const [titulo, setTitulo] = useState(p.inicial.titulo === 'Artículo sin título' ? '' : p.inicial.titulo);
  const [bajada, setBajada] = useState(p.inicial.bajada);
  const [autor, setAutor] = useState(p.inicial.autor);
  const [slug, setSlug] = useState(p.inicial.slug);
  const [slugManual, setSlugManual] = useState(!p.inicial.slug.startsWith('borrador-'));
  const [serie, setSerie] = useState<string | null>(p.inicial.serie_id);
  const [parte, setParte] = useState<number | null>(p.inicial.parte);
  const [portada, setPortada] = useState<string | null>(p.inicial.portada_foto_id);
  const [destacado, setDestacado] = useState(p.inicial.destacado_inicio);
  const [temas, setTemas] = useState<string[]>(p.inicial.temas);
  const [fotos, setFotos] = useState<FotoBiblioteca[]>(p.fotos);
  const [bloques, setBloques] = useState<{ k: string; b: BloqueEditable }[]>(
    () => p.inicial.cuerpo.map((b) => ({ k: nuevaClave(), b: structuredClone(b) as BloqueEditable })),
  );

  // --- Guardado automático ----------------------------------------------------
  const [guardado, setGuardado] = useState<Guardado>('al-dia');
  const [error, setError] = useState<string | null>(null);
  const [ultimoGuardado, setUltimoGuardado] = useState<string | null>(null);
  const [previaAlDia, setPreviaAlDia] = useState(p.previaAlDia);
  const [cambiosPendientes, setCambiosPendientes] = useState(p.hayCambiosPendientes);
  const version = useRef(p.version);
  const primera = useRef(true);
  const enCurso = useRef<Promise<boolean> | null>(null);
  const [, refrescar] = useState(0);

  const datos = useCallback((): DatosEditor => ({
    titulo: titulo.trim() || 'Artículo sin título', bajada, autor, slug: publico ? p.slugPublico : slug,
    serie_id: serie, parte: serie ? parte : null, portada_foto_id: portada, destacado_inicio: destacado, temas,
    cuerpo: bloques.map((x) => x.b),
  }), [titulo, bajada, autor, slug, serie, parte, portada, destacado, temas, bloques, publico, p.slugPublico]);

  // Lo último que se guardó con éxito (para saber, sin esperar a los efectos, si hay cambios).
  const ultimoEnviado = useRef<string | null>(null);
  const guardar = useCallback(async (): Promise<boolean> => {
    if (enCurso.current) await enCurso.current;
    const tarea = (async () => {
      setGuardado('guardando');
      const enviado = datos();
      const r = await guardarArticulo(p.id, enviado, version.current);
      if (r.ok) {
        ultimoEnviado.current = JSON.stringify(enviado);
        version.current = r.version;
        setUltimoGuardado(r.guardadoEn);
        setGuardado('al-dia');
        setError(null);
        setPreviaAlDia(false);
        if (r.enCambios) setCambiosPendientes(true);
        return true;
      }
      setGuardado(r.conflicto ? 'conflicto' : 'error');
      setError(r.error);
      return false;
    })();
    enCurso.current = tarea;
    try { return await tarea; } finally { enCurso.current = null; }
  }, [datos, p.id]);

  useEffect(() => {
    if (primera.current) { primera.current = false; ultimoEnviado.current = JSON.stringify(datos()); return; }
    if (guardado === 'conflicto') return;
    setGuardado('pendiente');
    const t = setTimeout(() => { void guardar(); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se guarda cuando cambia el contenido
  }, [titulo, bajada, autor, slug, serie, parte, portada, destacado, temas, bloques]);

  // Título → dirección automática mientras no esté publicada ni escrita a mano.
  useEffect(() => {
    if (!publico && !slugManual && titulo.trim()) setSlug(slugDesde(titulo));
  }, [titulo, publico, slugManual]);

  // Aviso al salir con cambios sin guardar.
  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => { if (guardado === 'pendiente' || guardado === 'guardando') e.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [guardado]);

  const [activo, setActivo] = useState(false);
  useEffect(() => { setActivo(true); const t = setInterval(() => refrescar((n) => n + 1), 5000); return () => clearInterval(t); }, []);

  // --- Edición simultánea -------------------------------------------------------
  const [otros, setOtros] = useState<string[]>([]);
  const [remoto, setRemoto] = useState(false);
  useEffect(() => {
    let vivo = true;
    const latir = async () => {
      const r = await latido(p.id).catch(() => null);
      if (!vivo || !r) return;
      setOtros(r.otros);
      if (r.version && !enCurso.current && Date.parse(r.version) !== Date.parse(version.current)) setRemoto(true);
    };
    void latir();
    const t = setInterval(latir, 15_000);
    return () => { vivo = false; clearInterval(t); void salirDelEditor(p.id); };
  }, [p.id]);

  // --- Bloques ---------------------------------------------------------------
  const foco = useRef<{ k: string | null; campo: string; item?: number; el: HTMLTextAreaElement | HTMLInputElement } | null>(null);
  const [menuBloques, setMenuBloques] = useState(false);
  const [elegirFoto, setElegirFoto] = useState<null | { para: 'portada' } | { para: 'bloque'; k: string }>(null);

  const agregar = (tipo: TipoBloque) => {
    const nuevo = { k: nuevaClave(), b: bloqueVacio(tipo) as BloqueEditable };
    setBloques((xs) => {
      const i = foco.current?.k ? xs.findIndex((x) => x.k === foco.current!.k) : -1;
      return i >= 0 ? [...xs.slice(0, i + 1), nuevo, ...xs.slice(i + 1)] : [...xs, nuevo];
    });
    setMenuBloques(false);
    if (tipo === 'imagen') setElegirFoto({ para: 'bloque', k: nuevo.k });
    setTimeout(() => document.querySelector<HTMLElement>(`[data-bloque-clave="${nuevo.k}"] textarea, [data-bloque-clave="${nuevo.k}"] input`)?.focus(), 50);
  };
  const cambiarBloque = (k: string, campos: Record<string, unknown>) =>
    setBloques((xs) => xs.map((x) => (x.k === k ? { ...x, b: { ...x.b, ...campos } } : x)));
  const mover = (i: number, d: -1 | 1) => setBloques((xs) => {
    const j = i + d;
    if (j < 0 || j >= xs.length) return xs;
    const c = [...xs];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  });
  const quitar = (k: string) => setBloques((xs) => xs.filter((x) => x.k !== k));

  /** Botón B: envuelve en **negrita** lo seleccionado en el último campo de texto. */
  const negrita = () => {
    const f = foco.current;
    if (!f?.k) return;
    const { el } = f;
    const a = el.selectionStart ?? 0, z = el.selectionEnd ?? 0;
    if (a === z) return;
    const v = el.value;
    const nuevo = `${v.slice(0, a)}**${v.slice(a, z)}**${v.slice(z)}`;
    const bloque = bloques.find((x) => x.k === f.k)?.b;
    if (!bloque) return;
    if (f.campo === 'items' && f.item !== undefined && Array.isArray(bloque.items)) {
      const items = bloque.items as unknown[];
      cambiarBloque(f.k, { items: items.map((it, j) => (j !== f.item ? it : typeof it === 'string' ? nuevo : { ...(it as object), texto: nuevo })) });
    } else {
      cambiarBloque(f.k, { [f.campo]: nuevo });
    }
  };

  // --- Publicación -------------------------------------------------------------
  const [estadoPublicar, publicar, publicando] = useActionState<EstadoFormulario, FormData>(publicarArticulo, null);
  const [menuPublicar, setMenuPublicar] = useState(false);
  const [fechaProgramada, setFechaProgramada] = useState(p.publicarEn ?? '');
  const sinGuardar = guardado !== 'al-dia';
  const puedePublicar = previaAlDia && !sinGuardar && !remoto;
  const haySinGuardar = () => ultimoEnviado.current !== null
    ? JSON.stringify(datos()) !== ultimoEnviado.current
    : guardado === 'pendiente' || guardado === 'guardando';
  const irAVistaPrevia = async () => {
    if (enCurso.current) await enCurso.current;
    if (haySinGuardar() || guardado === 'pendiente') { if (!(await guardar())) return; }
    router.push(`/admin/articulos/${p.id}/vista-previa`);
  };

  const portadaFoto = fotos.find((f) => f.id === portada);
  const estadoInfo = NOMBRE_ESTADO[p.estadoVisible];
  const textoGuardado = {
    'al-dia': ultimoGuardado ? `Guardado automáticamente ${haceCuanto(ultimoGuardado)}` : 'Todo guardado',
    pendiente: 'Cambios sin guardar…',
    guardando: 'Guardando…',
    error: 'No se pudo guardar',
    conflicto: 'Otra persona guardó cambios',
  }[guardado];

  return (
    <div className="flex min-h-dvh flex-1 flex-col" data-editor-listo={activo || undefined}>
      <header className="sticky top-0 z-30 border-b border-[#e1e3e6] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <Link href="/admin/articulos" className="text-[14px] font-semibold text-azul">← Artículos</Link>
            <span className={`adm-chip ${estadoInfo.chip}`} data-estado-articulo={p.estadoVisible}>{estadoInfo.nombre}</span>
            {p.estadoVisible === 'programado' && p.publicarEnIso && <span className="text-[13px] text-azul-oscuro" data-fecha-programada>{fechaHoraChile(p.publicarEnIso)} · hora de Chile</span>}
            <span className={`text-[13px] ${guardado === 'error' || guardado === 'conflicto' ? 'font-semibold text-rojo-oscuro' : 'text-texto-3'}`} data-guardado={guardado} aria-live="polite">{textoGuardado}</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" className="adm-boton adm-secundario" onClick={irAVistaPrevia} data-accion="vista-previa">Vista previa</button>
            {p.estado === 'borrador' && (
              <form action={async () => { await guardar(); await enviarARevision(p.id); }}>
                <button className="adm-boton adm-secundario" disabled={guardado === 'conflicto'}>Enviar a revisión</button>
              </form>
            )}
            {p.estado === 'revision' && (
              <form action={async () => { await guardar(); await volverABorrador(p.id); }}>
                <button className="adm-boton adm-secundario">Volver a borrador</button>
              </form>
            )}
            <div className="relative">
              <button type="button" className="adm-boton adm-primario" aria-expanded={menuPublicar} aria-haspopup="true"
                onClick={() => setMenuPublicar((v) => !v)} data-accion="publicar">
                {publico && cambiosPendientes ? 'Publicar cambios ▾' : 'Publicar ▾'}
              </button>
              {menuPublicar && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(340px,calc(100vw-40px))] rounded-2xl bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,.2)]" data-menu-publicar>
                  {!puedePublicar ? (
                    <div className="flex flex-col gap-3 text-[14px]">
                      <p className="font-semibold">Primero revisa la vista previa</p>
                      <p className="text-texto-2">Nada se publica sin verlo antes tal como quedará en el sitio. {sinGuardar ? 'Hay cambios sin guardar.' : ''}</p>
                      <button type="button" className="adm-boton adm-primario" onClick={irAVistaPrevia}>Abrir vista previa</button>
                    </div>
                  ) : (
                    <form action={publicar} className="flex flex-col gap-3 text-[14px]">
                      <input type="hidden" name="id" value={p.id} />
                      {estadoPublicar?.error && <p role="alert" className="adm-error">{estadoPublicar.error}</p>}
                      <button name="modo" value="ahora" className="adm-boton adm-primario" disabled={publicando}>
                        {publico && cambiosPendientes ? 'Publicar los cambios ahora' : 'Publicar ahora'}
                      </button>
                      <div className="border-t border-linea pt-3">
                        <label className="adm-etiqueta-campo">Programar para (hora de Chile)
                          <input type="datetime-local" name="fecha" className="adm-campo" value={fechaProgramada}
                            min={utcAChileLocal(new Date())} onChange={(e) => setFechaProgramada(e.target.value)} />
                        </label>
                        <button name="modo" value="programar" className="adm-boton adm-borde-azul mt-2 w-full" disabled={publicando || !fechaProgramada}>Programar</button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {otros.length > 0 && (
          <p role="status" data-aviso-simultaneo className="border-t border-[#f1e2b8] bg-[#fff6e0] px-5 py-2.5 text-[13px] text-[#6b4a00] sm:px-8">
            {otros.join(', ')} también {otros.length === 1 ? 'tiene' : 'tienen'} abierto este artículo. Tus cambios no sobrescribirán los suyos: si ambos guardan, verás un aviso para recargar.
          </p>
        )}
        {(guardado === 'conflicto' || remoto) && (
          <p role="alert" data-aviso-conflicto className="flex flex-wrap items-center gap-3 border-t border-[#f1e2b8] bg-rojo-claro px-5 py-2.5 text-[13px] text-rojo-oscuro sm:px-8">
            Otra persona guardó cambios en este artículo. Recarga para ver la última versión (los cambios que no alcanzaste a guardar se perderán).
            <button type="button" className="adm-mini bg-white text-rojo-oscuro" onClick={() => window.location.reload()}>Recargar</button>
          </p>
        )}
      </header>

      <div className="flex flex-1 flex-wrap gap-6 px-4 py-6 sm:px-8 sm:py-7">
        <main id="contenido" className="adm-caja flex min-w-0 flex-[999_1_560px] flex-col gap-5 px-5 py-6 sm:px-14 sm:py-10">
          {p.aviso && AVISOS[p.aviso] && <p role="status" className="adm-ok">{AVISOS[p.aviso]}</p>}
          {error && guardado === 'error' && <p role="alert" className="adm-error">{error}</p>}
          {publico && (
            <p className="adm-aviso" data-aviso-publicado>
              Este artículo está {p.estadoVisible === 'programado' ? 'programado' : 'publicado'}. Lo que edites se guarda aparte y
              {' '}<strong>no cambia el sitio</strong> hasta que revises la vista previa y publiques los cambios.
              {cambiosPendientes && (
                <span className="ml-1 inline-flex">
                  <Confirmar boton="Descartar cambios" claseBoton="font-semibold underline" titulo="¿Descartar los cambios sin publicar?"
                    confirmar="Sí, descartar" accion={descartarCambios.bind(null, p.id)}>
                    El artículo vuelve a quedar como está publicado.
                  </Confirmar>
                </span>
              )}
            </p>
          )}

          {/* Barra de herramientas */}
          <div role="toolbar" aria-label="Agregar bloques y formato" className="z-20 flex flex-wrap sm:sticky sm:top-[76px] gap-1 self-start rounded-xl bg-white p-1.5 shadow-[0_0_0_1px_rgba(0,0,0,.08),0_1px_3px_rgba(0,0,0,.06)]">
            <button type="button" aria-label="Negrita" title="Negrita: selecciona texto en un bloque y presiona B" onMouseDown={(e) => e.preventDefault()} onClick={negrita}
              className="size-10 rounded-lg font-extrabold hover:bg-gris-claro">B</button>
            {RAPIDOS.map((t) => (
              <button key={t} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => agregar(t)} className="h-10 rounded-lg px-2.5 text-[14px] hover:bg-azul-claro hover:text-azul-oscuro">
                {ETIQUETA_RAPIDA[t]}
              </button>
            ))}
            <div className="relative">
              <button type="button" aria-expanded={menuBloques} onClick={() => setMenuBloques((v) => !v)} className="h-10 rounded-lg px-2.5 text-[14px] font-semibold text-azul hover:bg-azul-claro">
                + Bloque
              </button>
              {menuBloques && (
                <ul className="absolute left-0 top-12 z-30 max-h-[min(60vh,520px)] w-[300px] max-w-[calc(100vw-48px)] overflow-y-auto rounded-2xl bg-white p-2 shadow-[0_20px_50px_rgba(0,0,0,.2)]" data-menu-bloques>
                  {TIPOS_BLOQUE.map((t) => (
                    <li key={t.tipo}>
                      <button type="button" onClick={() => agregar(t.tipo)} data-agregar={t.tipo} className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-gris-claro">
                        <span className="text-[14px] font-semibold">{t.nombre}</span>
                        <span className="text-[12px] text-texto-3">{t.ayuda}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Portada: solo desde la biblioteca existente */}
          {portadaFoto ? (
            <figure className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada (bucket privado) */}
              <img src={portadaFoto.url} alt={portadaFoto.texto_alternativo} className="max-h-[320px] w-full rounded-2xl object-cover" data-portada />
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button type="button" className="adm-mini bg-white shadow" onClick={() => setElegirFoto({ para: 'portada' })}>Cambiar portada</button>
                <button type="button" className="adm-mini bg-white text-rojo-oscuro shadow" onClick={() => setPortada(null)}>Quitar</button>
              </div>
            </figure>
          ) : (
            <button type="button" onClick={() => setElegirFoto({ para: 'portada' })} data-elegir-portada
              className="flex h-[180px] flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-[#9aa1a8] text-[14px] text-texto-3 hover:bg-gris-claro sm:h-[220px]">
              <strong className="text-texto">Elegir la imagen de portada</strong>
              Desde la biblioteca de fotos de JIUMP
            </button>
          )}

          <label className="sr-only" htmlFor="titulo">Título del artículo</label>
          <textarea id="titulo" rows={1} value={titulo} onChange={(e) => setTitulo(e.target.value.replace(/\n/g, ' '))} placeholder="Título del artículo"
            className="field-sizing-content resize-none bg-transparent font-titulo text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] outline-none placeholder:text-[#9aa1a8] sm:text-[44px]" />
          <label className="sr-only" htmlFor="bajada">Bajada</label>
          <textarea id="bajada" rows={2} value={bajada} onChange={(e) => setBajada(e.target.value)} placeholder="Bajada: una o dos frases que resumen el artículo."
            className="field-sizing-content resize-none bg-transparent text-[18px] leading-[1.7] text-texto-2 outline-none placeholder:text-[#9aa1a8]" />

          {/* Bloques del cuerpo */}
          <ol className="flex flex-col gap-4" aria-label="Bloques del artículo" data-bloques>
            {bloques.map(({ k, b }, i) => (
              <li key={k} data-bloque-clave={k} data-bloque={b.tipo} className="rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--color-linea)] focus-within:shadow-[inset_0_0_0_2px_var(--color-azul)]">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="t-etiqueta text-azul-oscuro">{nombreBloque(b.tipo)}</span>
                  <span className="flex gap-1">
                    <button type="button" className="adm-mini adm-mini-gris px-2.5" aria-label={`Subir bloque ${i + 1}`} disabled={i === 0} onClick={() => mover(i, -1)}>↑</button>
                    <button type="button" className="adm-mini adm-mini-gris px-2.5" aria-label={`Bajar bloque ${i + 1}`} disabled={i === bloques.length - 1} onClick={() => mover(i, 1)}>↓</button>
                    <button type="button" className="adm-mini adm-mini-gris px-2.5 text-rojo-oscuro" aria-label={`Quitar bloque ${i + 1}`} onClick={() => quitar(k)}>✕</button>
                  </span>
                </div>
                <CamposBloque b={b} cambiar={(c) => cambiarBloque(k, c)} fotos={fotos}
                  alEnfocar={(el, campo, item) => { foco.current = { k, campo, item, el }; }}
                  elegirFoto={() => setElegirFoto({ para: 'bloque', k })} />
              </li>
            ))}
          </ol>
          {bloques.length === 0 && (
            <p className="rounded-2xl bg-gris-claro p-5 text-center text-[15px] text-texto-3">
              Escribe el contenido agregando bloques: empieza con un <button type="button" className="enlace" onClick={() => agregar('parrafo')}>párrafo</button>.
            </p>
          )}
          <button type="button" className="adm-boton adm-secundario self-start" onClick={() => { foco.current = null; agregar('parrafo'); }}>+ Párrafo</button>
        </main>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 lg:max-w-[360px]">
          <section className="adm-caja flex flex-col gap-3.5 p-[22px]">
            <h2 className="text-[15px] font-semibold">Publicación</h2>
            <p className="text-[13px] text-texto-3">Estado: <span className={`adm-chip ${estadoInfo.chip}`}>{estadoInfo.nombre}</span></p>
            <p className="text-[13px] leading-relaxed text-texto-3">
              Borrador → En revisión → Programado o Publicado. Usa «Publicar ▾» para publicar ahora o programar una fecha (hora de Chile).
            </p>
            {publico && !cambiosPendientes && !sinGuardar ? (
              <p className="text-[13px] font-semibold text-[#00665f]">✓ Sin cambios pendientes</p>
            ) : (
              <p className={`text-[13px] font-semibold ${previaAlDia && !sinGuardar ? 'text-[#00665f]' : 'text-[#7a4b00]'}`} data-previa-al-dia={previaAlDia && !sinGuardar}>
                {previaAlDia && !sinGuardar ? '✓ Vista previa revisada' : 'Falta revisar la vista previa de lo último que guardaste'}
              </p>
            )}
            <label className="flex items-center gap-2.5 text-[14px]">
              <input type="checkbox" className="size-5" checked={destacado} onChange={(e) => setDestacado(e.target.checked)} /> Destacar en la portada
            </label>
          </section>

          <section className="adm-caja flex flex-col gap-3.5 p-[22px]">
            <h2 className="text-[15px] font-semibold">Clasificación</h2>
            <div className="grid grid-cols-[1fr_88px] gap-2.5">
              <label className="adm-etiqueta-campo">Serie
                <select className="adm-campo" value={serie ?? ''} onChange={(e) => setSerie(e.target.value || null)} name="serie">
                  <option value="">Sin serie</option>
                  {p.series.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </label>
              <label className="adm-etiqueta-campo">Parte
                <input className="adm-campo" type="number" min={1} max={999} value={parte ?? ''} disabled={!serie}
                  onChange={(e) => setParte(e.target.value ? Number(e.target.value) : null)} />
              </label>
            </div>
            <div className="adm-etiqueta-campo">Temas
              <div className="flex flex-wrap gap-1.5">
                {temas.map((id) => (
                  <button key={id} type="button" onClick={() => setTemas((t) => t.filter((x) => x !== id))} aria-label={`Quitar tema ${p.temas.find((t) => t.id === id)?.nombre}`}
                    className="rounded-full bg-azul-claro px-2.5 py-1.5 font-ui text-[12px] font-semibold text-azul-oscuro">
                    {p.temas.find((t) => t.id === id)?.nombre ?? 'Tema'} ×
                  </button>
                ))}
                <select aria-label="Agregar tema" className="rounded-full border border-dashed border-[#9aa1a8] bg-white px-2.5 py-1 text-[12px]" value=""
                  onChange={(e) => e.target.value && setTemas((t) => [...t, e.target.value])}>
                  <option value="">+ Agregar</option>
                  {p.temas.filter((t) => !temas.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
            </div>
            <label className="adm-etiqueta-campo">Autor
              <input className="adm-campo" value={autor} onChange={(e) => setAutor(e.target.value)} placeholder="Nombre de quien escribió" />
            </label>
            <label className="adm-etiqueta-campo">Dirección en el sitio
              <span className="flex items-center gap-1 text-[12.5px]">/articulos/</span>
              <input className="adm-campo" value={publico ? p.slugPublico : slug} disabled={publico} name="slug"
                onChange={(e) => { setSlugManual(true); setSlug(e.target.value.toLowerCase()); }} />
              {publico && <span className="text-[12px]">Ya está publicado: la dirección no se cambia para no romper enlaces.</span>}
            </label>
          </section>

          <section className="adm-caja flex flex-col gap-2.5 p-[22px] text-[14px]" data-historial>
            <h2 className="text-[15px] font-semibold">Historial</h2>
            {p.historial.length === 0 && <span className="text-texto-3">Aún no hay versiones anteriores.</span>}
            <ol className="flex max-h-[280px] flex-col gap-2 overflow-y-auto">
              {p.historial.map((v) => (
                <li key={v.id} className="flex items-start justify-between gap-2 border-t border-[#e7e9ec] pt-2" data-version>
                  <span className="text-texto-3"><span className="text-texto">{fechaHoraChile(v.guardado_en)}</span> · {v.quien} — «{v.titulo}»</span>
                  <Confirmar boton="Restaurar" claseBoton="shrink-0 font-semibold text-azul underline underline-offset-2" peligro={false}
                    titulo="¿Restaurar esta versión?" confirmar="Sí, restaurar" accion={restaurarVersion.bind(null, p.id, v.id)}>
                    El contenido vuelve a como estaba el {fechaHoraChile(v.guardado_en)}. La versión actual queda guardada en el historial.
                    {publico ? ' Como el artículo está publicado, la versión queda como cambio sin publicar hasta que revises la vista previa.' : ''}
                  </Confirmar>
                </li>
              ))}
            </ol>
          </section>

          <section className="adm-caja flex flex-col gap-2.5 p-[22px] text-[14px]">
            {publico && (
              <Confirmar boton="Retirar del sitio (volver a borrador)" claseBoton="adm-mini adm-mini-gris self-start" peligro={false}
                titulo="¿Retirar el artículo del sitio?" confirmar="Sí, retirar" accion={volverABorrador.bind(null, p.id)}>
                Deja de verse en el sitio y vuelve a borrador. Podrás publicarlo otra vez después de la vista previa.
              </Confirmar>
            )}
            <Confirmar boton="Eliminar artículo" claseBoton="adm-mini adm-mini-rojo self-start" titulo={`¿Eliminar «${titulo || 'este artículo'}»?`}
              accion={moverAPapelera.bind(null, p.id, '/admin/articulos')}>
              El artículo dejará de verse en la web y pasará a la papelera. Podrás recuperarlo durante 30 días.
            </Confirmar>
          </section>
        </aside>
      </div>

      <SelectorFoto fotos={fotos} alSubir={(f) => setFotos((xs) => [f, ...xs])} abierto={elegirFoto !== null} onCerrar={() => setElegirFoto(null)}
        titulo={elegirFoto?.para === 'portada' ? 'Elegir portada' : 'Elegir foto'}
        onElegir={(id) => {
          if (elegirFoto?.para === 'portada') setPortada(id);
          else if (elegirFoto?.para === 'bloque') cambiarBloque(elegirFoto.k, { foto_id: id });
          setElegirFoto(null);
        }} />
    </div>
  );
}
