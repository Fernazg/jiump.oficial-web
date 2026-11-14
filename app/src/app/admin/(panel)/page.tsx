import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSeccion } from '@/lib/admin/acceso';
import { crearArticulo } from '@/lib/admin/acciones-articulos';
import { estadoInfo, estadoVisible, type EstadoArticulo } from '@/lib/admin/articulos';
import { fechaHoraChile, haceCuanto } from '@/lib/admin/hora-chile';
import { GRUPOS, NOMBRE_ROL, puedeEntrar } from '@/lib/admin/secciones';
import { clientePanel } from '@/lib/admin/supabase-panel';

export const metadata: Metadata = { title: 'Escritorio' };

type FilaResumen = { id: string; titulo: string; estado: EstadoArticulo; publicar_en: string | null; actualizado_en: string };
type Evento = { clave: string; quien: string | null; texto: string; titulo: string | null; href: string | null; fecha: string };

const VERBOS: Record<string, string> = {
  crear: 'creó', editar: 'editó', publicar: 'publicó', papelera: 'envió a la papelera', restaurar: 'restauró',
  eliminar: 'eliminó', asignar_rol: 'asignó un rol en', quitar_rol: 'quitó un rol en',
};
const COSAS: Record<string, string> = {
  articulos: 'el artículo', series: 'la serie', temas: 'el tema', actividades: 'la actividad', fotos: 'una foto',
  albumes: 'el álbum', videos: 'el video', paginas: 'la página', secciones: 'una sección', institucional: 'un texto institucional',
  menu: 'el menú', configuracion: 'la configuración', perfiles: 'el perfil', perfil_roles: 'roles',
};

export default async function Escritorio({ searchParams }: { searchParams: Promise<{ clave?: string }> }) {
  const acceso = await exigirSeccion('escritorio');
  const aviso = await searchParams;
  const supabase = await clientePanel();
  const veArticulos = puedeEntrar('articulos', acceso.efectivos);
  const esSuper = acceso.efectivos.includes('superadmin');
  const rolTexto = acceso.roles.map((r) => NOMBRE_ROL[r]).join(' y ');

  let articulos: FilaResumen[] = [];
  let eventos: Evento[] = [];
  let editando: { nombre: string; titulo: string; id: string }[] = [];
  if (veArticulos) {
    const [{ data }, { data: presencia }] = await Promise.all([
      supabase.from('articulos').select('id, titulo, estado, publicar_en, actualizado_en').order('actualizado_en', { ascending: false }),
      supabase.from('articulo_presencia').select('nombre, user_id, articulo_id, articulos(titulo)')
        .gte('visto_en', new Date(Date.now() - 60_000).toISOString()).neq('user_id', acceso.userId),
    ]);
    articulos = (data ?? []) as FilaResumen[];
    editando = ((presencia ?? []) as unknown as { nombre: string; articulo_id: string; articulos: { titulo: string } | null }[])
      .map((p) => ({ nombre: p.nombre || 'Otra persona', titulo: p.articulos?.titulo ?? 'un artículo', id: p.articulo_id }));
  }
  if (esSuper) {
    // Registro de actividad completo (solo Superadmin puede leerlo).
    const { data } = await supabase.from('registro_actividad').select('id, user_id, accion, tabla, registro_id, detalle, fecha')
      .order('fecha', { ascending: false }).limit(8);
    const filas = (data ?? []) as { id: string; user_id: string | null; accion: string; tabla: string; registro_id: string | null; detalle: Record<string, string>; fecha: string }[];
    const ids = [...new Set(filas.map((f) => f.user_id).filter((x): x is string => Boolean(x)))];
    const { data: perfiles } = ids.length ? await supabase.from('perfiles').select('user_id, nombre, correo').in('user_id', ids) : { data: [] };
    const nombres = new Map(((perfiles ?? []) as { user_id: string; nombre: string; correo: string }[]).map((p) => [p.user_id, p.nombre || p.correo]));
    eventos = filas.map((f) => ({
      clave: f.id,
      quien: f.user_id ? nombres.get(f.user_id) ?? 'Alguien del equipo' : 'El sistema',
      texto: `${VERBOS[f.accion] ?? f.accion} ${COSAS[f.tabla] ?? f.tabla}`,
      titulo: f.detalle?.titulo ?? f.detalle?.nombre ?? null,
      href: f.tabla === 'articulos' && f.registro_id && f.accion !== 'eliminar' ? `/admin/articulos/${f.registro_id}` : null,
      fecha: f.fecha,
    }));
  } else if (veArticulos) {
    // Sin acceso al registro: últimos cambios de artículos (sin nombres; los perfiles son privados).
    eventos = articulos.slice(0, 5).map((a) => ({
      clave: a.id, quien: null, texto: `${estadoInfo(estadoVisible(a)).nombre}`, titulo: a.titulo, href: `/admin/articulos/${a.id}`, fecha: a.actualizado_en,
    }));
  }

  const cuenta = (e: EstadoArticulo) => articulos.filter((a) => estadoVisible(a) === e).length;
  const pendientes = articulos.filter((a) => a.estado === 'revision' || a.estado === 'borrador')
    .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'revision' ? -1 : 1)).slice(0, 6);
  const programados = articulos.filter((a) => estadoVisible(a) === 'programado')
    .sort((a, b) => Date.parse(a.publicar_en!) - Date.parse(b.publicar_en!)).slice(0, 5);
  const tarjetas = veArticulos ? [
    { nombre: 'Artículos publicados', valor: cuenta('publicado'), detalle: 'Ver publicados →', href: '/admin/articulos?estado=publicado' },
    { nombre: 'En revisión', valor: cuenta('revision'), detalle: 'Revisar →', href: '/admin/articulos?estado=revision' },
    { nombre: 'Borradores', valor: cuenta('borrador'), detalle: 'Seguir escribiendo →', href: '/admin/articulos?estado=borrador' },
    { nombre: 'Programados', valor: cuenta('programado'), detalle: 'Ver calendario →', href: '/admin/articulos?estado=programado' },
    { nombre: 'En la papelera', valor: cuenta('papelera'), detalle: 'Recuperar →', href: '/admin/articulos?estado=papelera' },
  ] : [];
  const proximas = GRUPOS.flatMap((g) => g.secciones).filter((s) => !s.lista && puedeEntrar(s.clave, acceso.efectivos));

  return (
    <>
      {aviso.clave === 'actualizada' && <p role="status" className="adm-ok">Tu contraseña se actualizó.</p>}
      {acceso.roles.includes('superadmin') && !esSuper && (
        <p role="alert" className="adm-aviso" data-aviso-superadmin>
          Tu rol de Superadministrador aún no está activo: se activa cuando otro superadministrador te lo vuelve a asignar
          después de que inscribiste tu doble factor. Mientras tanto ves el panel con tus otros roles.
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="adm-h1 text-[34px]">Hola, {acceso.nombre}</h1>
          <span className="text-[15px] text-texto-3">Esto es lo que puedes gestionar hoy como <strong>{rolTexto}</strong>.</span>
        </div>
        {veArticulos && (
          <form action="/admin/articulos" role="search" className="flex min-h-11 w-full items-center gap-2 rounded-full border border-[#cdd1d6] bg-white px-4 sm:w-[340px]">
            <span aria-hidden className="text-texto-3">⌕</span>
            <label htmlFor="buscar-escritorio" className="sr-only">Buscar artículos</label>
            <input id="buscar-escritorio" type="search" name="q" placeholder="Buscar artículos…" className="w-full bg-transparent text-[14px] outline-none" />
          </form>
        )}
      </div>

      {veArticulos && (
        <div className="flex flex-wrap gap-2.5">
          <form action={crearArticulo}><button className="adm-boton adm-primario">+ Nuevo artículo</button></form>
          <Link href="/admin/articulos/series" className="adm-boton adm-borde-azul">Series y temas</Link>
        </div>
      )}

      {veArticulos && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-4" data-resumen>
          {tarjetas.map((t) => (
            <Link key={t.nombre} href={t.href} data-tarjeta={t.nombre}
              className="levantar flex flex-col gap-1.5 rounded-[18px] border-t-4 border-turquesa bg-white p-5 text-texto">
              <span className="text-[13px] text-texto-3">{t.nombre}</span>
              <strong className="font-titulo text-[30px] font-extrabold leading-none" data-valor>{t.valor}</strong>
              <span className="text-[13px] font-semibold text-azul">{t.detalle}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-6">
        {veArticulos ? (
          <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-6">
            <section className="adm-caja flex min-w-0 flex-col gap-3 p-6" aria-labelledby="t-pendientes">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="t-pendientes" className="adm-h2">Pendiente de revisión y borradores</h2>
                <span className="text-[13px] text-texto-3">Nada se publica sin pasar por vista previa</span>
              </div>
              {pendientes.length === 0 ? (
                <p className="py-4 text-center text-[14px] text-texto-3">No hay borradores ni artículos en revisión.</p>
              ) : (
                <ul className="divide-y divide-[#e7e9ec] text-[14px]">
                  {pendientes.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3">
                      <span className="min-w-0 flex-1 basis-[200px] font-semibold">{a.titulo}</span>
                      <span className="text-texto-2">Artículo</span>
                      <span className={`adm-chip ${estadoInfo(a.estado).chip}`}>{estadoInfo(a.estado).nombre}</span>
                      <Link href={`/admin/articulos/${a.id}`} className="w-20 text-right font-semibold text-azul underline underline-offset-2">
                        {a.estado === 'revision' ? 'Revisar' : 'Editar'}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="adm-caja flex min-w-0 flex-col gap-3 p-6" aria-labelledby="t-programados" data-programados>
              <h2 id="t-programados" className="adm-h2">Próximos programados</h2>
              {programados.length === 0 ? (
                <p className="py-2 text-[14px] text-texto-3">No hay artículos programados.</p>
              ) : (
                <ul className="divide-y divide-[#e7e9ec] text-[14px]">
                  {programados.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <Link href={`/admin/articulos/${a.id}`} className="font-semibold hover:text-azul">{a.titulo}</Link>
                      <span className="text-azul-oscuro">{fechaHoraChile(a.publicar_en!)} <span className="text-texto-3">· hora de Chile</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : (
          <section className="adm-caja flex min-w-0 flex-[2_1_520px] flex-col gap-3 p-6">
            <h2 className="adm-h2">Tus secciones</h2>
            <p className="text-[14px] leading-relaxed text-texto-2">
              Las secciones de tu rol ya aparecen en el menú y estarán disponibles en la próxima etapa del panel:
            </p>
            <ul className="flex flex-wrap gap-2">
              {proximas.map((s) => <li key={s.clave} className="adm-chip bg-gris-claro text-texto-2">{s.icono} {s.nombre}</li>)}
            </ul>
          </section>
        )}

        {(eventos.length > 0 || editando.length > 0) && (
          <section className="adm-caja flex min-w-0 flex-[1_1_280px] flex-col gap-3.5 p-6" aria-labelledby="t-actividad" data-actividad>
            <h2 id="t-actividad" className="adm-h2">{esSuper ? 'Actividad del equipo' : 'Actividad reciente'}</h2>
            {editando.map((p) => (
              <div key={`${p.id}-${p.nombre}`} className="flex gap-3 text-[14px] leading-normal">
                <span aria-hidden className="size-8 shrink-0 rounded-full bg-turquesa-claro" />
                <span><strong>{p.nombre}</strong> está editando «<Link href={`/admin/articulos/${p.id}`} className="hover:text-azul">{p.titulo}</Link>» ahora</span>
              </div>
            ))}
            {eventos.map((e) => (
              <div key={e.clave} className="flex gap-3 text-[14px] leading-normal">
                <span aria-hidden className="size-8 shrink-0 rounded-full bg-[#cdd1d6]" />
                <span>
                  {e.quien ? <><strong>{e.quien}</strong> {e.texto}</> : <span className="text-texto-2">{e.texto}:</span>}
                  {e.titulo && <> «{e.href ? <Link href={e.href} className="hover:text-azul">{e.titulo}</Link> : e.titulo}»</>}
                  <span className="block text-[12.5px] text-texto-3">{haceCuanto(e.fecha)}</span>
                </span>
              </div>
            ))}
            {esSuper && <Link href="/admin/registro" className="text-[14px] font-semibold text-azul underline underline-offset-2">Ver registro completo</Link>}
          </section>
        )}
      </div>
    </>
  );
}
