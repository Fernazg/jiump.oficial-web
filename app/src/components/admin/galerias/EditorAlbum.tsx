'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BotonAccion } from '@/components/admin/BotonAccion';
import { Confirmar } from '@/components/admin/Confirmar';
import { SelectorFoto } from '@/components/admin/editor/SelectorFoto';
import { ListaFotos } from '@/components/admin/eventos/ListaFotos';
import { despublicar, eliminar, guardarAlbum, publicar, type DatosAlbum } from '@/lib/admin/acciones-contenido';
import type { FotoCatalogo } from '@/lib/admin/galerias';

const AVISOS: Record<string, string> = {
  publicado: 'Publicado. Ya se ve en la Galería.',
  borrador: 'El álbum volvió a borrador: ya no se ve en la Galería.',
};

/**
 * Editor de álbum (diseño AdminMedios): título, descripción, año y lugar,
 * actividad opcional, fotos ordenadas con portada. Regla 2: un álbum tiene
 * fotos de un solo evento (la base lo exige; aquí solo se ofrecen las que
 * calzan con la actividad elegida).
 */
export function EditorAlbum(p: {
  id: string;
  inicial: DatosAlbum;
  version: string;
  estado: 'borrador' | 'publicado' | 'archivado';
  previaAlDia: boolean;
  actividades: { id: string; titulo: string; anio: number; estado: string }[];
  catalogo: FotoCatalogo[];
  aviso: string | null;
}) {
  const router = useRouter();
  const [d, setD] = useState<DatosAlbum>({ ...p.inicial, titulo: p.inicial.titulo === 'Álbum sin título' ? '' : p.inicial.titulo });
  const [catalogo, setCatalogo] = useState<FotoCatalogo[]>(p.catalogo);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<{ texto: string; conflicto?: boolean } | null>(null);
  const [elegir, setElegir] = useState(false);
  const [listo, setListo] = useState(false);
  const version = useRef(p.version);
  useEffect(() => setListo(true), []);
  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => { if (sucio) e.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sucio]);

  const cambiar = (c: Partial<DatosAlbum>) => { setD((x) => ({ ...x, ...c })); setSucio(true); };
  const guardar = async () => {
    setGuardando(true);
    const r = await guardarAlbum(p.id, d, version.current);
    setGuardando(false);
    if (r.ok) { version.current = r.version; setSucio(false); setError(null); router.refresh(); return true; }
    setError({ texto: r.error, conflicto: r.conflicto });
    return false;
  };
  const irAVistaPrevia = async () => {
    if (sucio && !(await guardar())) return;
    router.push(`/admin/galerias/${p.id}/vista-previa`);
  };

  // Regla 2: fotos sin evento, o de la actividad elegida, y que no estén en otro álbum.
  const elegibles = catalogo.filter((f) =>
    !d.fotos.includes(f.id)
    && (f.album_id === null || f.album_id === p.id)
    && (f.actividad_id === null ? true : f.actividad_id === d.actividad_id));
  const publicado = p.estado === 'publicado';
  const puedePublicar = p.previaAlDia && !sucio && !publicado;

  return (
    <section className="adm-caja flex min-w-0 flex-col gap-5 p-5 sm:p-7" data-editor-album data-listo={listo || undefined} data-version={p.version}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-titulo text-[24px] font-extrabold leading-tight">{d.titulo || 'Álbum sin título'}</h2>
          <span data-estado-contenido={p.estado} className={`adm-chip ${publicado ? 'bg-[#e0f5f3] text-[#00665f]' : 'bg-[#eef0f2] text-texto-2'}`}>
            {publicado ? 'Publicado' : 'Borrador'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className="adm-boton adm-secundario" onClick={irAVistaPrevia}>Vista previa</button>
          {publicado ? (
            <Confirmar boton="Despublicar" claseBoton="adm-boton bg-white text-rojo-oscuro shadow-[inset_0_0_0_1.5px_var(--color-rojo)]" peligro={false}
              titulo="¿Retirar el álbum de la Galería?" confirmar="Sí, despublicar" accion={despublicar.bind(null, 'album', p.id)}>
              Dejará de verse en la Galería. Podrás publicarlo otra vez después de la vista previa.
            </Confirmar>
          ) : (
            <BotonAccion accion={publicar.bind(null, 'album', p.id)} disabled={!puedePublicar} data-publicar
              titulo={puedePublicar ? undefined : 'Primero guarda y revisa la vista previa'}>Publicar</BotonAccion>
          )}
          <Confirmar boton="Eliminar" claseBoton="adm-boton bg-white text-rojo-oscuro shadow-[inset_0_0_0_1.5px_var(--color-rojo)]"
            titulo={`¿Eliminar «${d.titulo || 'este álbum'}»?`} accion={eliminar.bind(null, 'album', p.id)}>
            Dejará de verse en la Galería. Las fotos quedan en la biblioteca.
          </Confirmar>
        </div>
      </div>
      {p.aviso && AVISOS[p.aviso] && <p role="status" className="adm-ok">{AVISOS[p.aviso]}</p>}
      {!publicado && !puedePublicar && <p className="adm-aviso" data-falta-previa>{sucio ? 'Tienes cambios sin guardar. ' : ''}Para publicar, guarda y revisa la vista previa.</p>}
      {publicado && <p className="adm-aviso">Este álbum está publicado: al guardar, los cambios se ven de inmediato en la Galería.</p>}
      {error && <p role="alert" className="adm-error">{error.texto}{error.conflicto && <button type="button" className="ml-2 font-semibold underline" onClick={() => window.location.reload()}>Recargar</button>}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="adm-etiqueta-campo sm:col-span-2">Título del álbum
          <input className="adm-campo" name="titulo" value={d.titulo} onChange={(e) => cambiar({ titulo: e.target.value })} />
        </label>
        <label className="adm-etiqueta-campo sm:col-span-2">Descripción (opcional) · {d.descripcion.length}/200
          <textarea className="adm-campo" name="descripcion" rows={2} maxLength={200} value={d.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} />
        </label>
        <label className="adm-etiqueta-campo">Año (opcional)
          <input className="adm-campo" name="anio" inputMode="numeric" maxLength={4} value={d.anio} onChange={(e) => cambiar({ anio: e.target.value.replace(/\D/g, '') })} />
        </label>
        <label className="adm-etiqueta-campo">Dirección (URL)
          <input className="adm-campo" name="slug" value={d.slug.startsWith('borrador-') ? '' : d.slug} placeholder="se crea desde el título"
            onChange={(e) => cambiar({ slug: e.target.value.toLowerCase() })} />
        </label>
        <label className="adm-etiqueta-campo">Ciudad (opcional)
          <input className="adm-campo" name="ciudad" value={d.ciudad} onChange={(e) => cambiar({ ciudad: e.target.value })} />
        </label>
        <label className="adm-etiqueta-campo">País (opcional)
          <input className="adm-campo" name="pais" value={d.pais} onChange={(e) => cambiar({ pais: e.target.value })} />
        </label>
        <label className="adm-etiqueta-campo sm:col-span-2">Actividad asociada (opcional)
          <select className="adm-campo" name="actividad" value={d.actividad_id ?? ''} onChange={(e) => cambiar({ actividad_id: e.target.value || null })}>
            <option value="">Sin actividad</option>
            {p.actividades.map((a) => <option key={a.id} value={a.id}>{a.titulo}{a.estado !== 'publicado' ? ' (borrador)' : ''}</option>)}
          </select>
          <span className="text-[12px]">Un álbum tiene fotos de un solo evento: si eliges una actividad, solo se ofrecen sus fotos o fotos sin evento.</span>
        </label>
      </div>

      <ListaFotos fotos={d.fotos} portada={d.portada_foto_id} catalogo={catalogo}
        alCambiar={(fotos, portada) => cambiar({ fotos, portada_foto_id: portada })} alAgregar={() => setElegir(true)}
        ayuda="Quitar una foto del álbum no la borra: queda en la biblioteca." />

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t border-linea bg-white/95 px-5 py-3 backdrop-blur sm:-mx-7 sm:px-7">
        <button type="button" className="adm-boton adm-primario" onClick={guardar} disabled={!sucio || guardando} data-guardar>{guardando ? 'Guardando…' : 'Guardar álbum'}</button>
        <span className="text-[13px] text-texto-3" data-estado-guardado={sucio ? 'sin-guardar' : 'al-dia'}>{sucio ? 'Cambios sin guardar' : 'Todo guardado'}</span>
      </div>

      <SelectorFoto fotos={elegibles} abierto={elegir} titulo="Agregar fotos al álbum" onCerrar={() => setElegir(false)}
        alSubir={(f) => setCatalogo((c) => [{ ...f, actividad_id: null, album_id: null }, ...c])}
        onElegir={(id) => { cambiar({ fotos: [...d.fotos, id], portada_foto_id: d.portada_foto_id ?? id }); setElegir(false); }} />
    </section>
  );
}
