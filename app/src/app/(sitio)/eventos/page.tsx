import type { Metadata } from 'next';
import { AvisoVistaPrevia } from '@/components/AvisoVistaPrevia';
import { exigirPagina } from '@/lib/paginas';
import Link from 'next/link';
import { EstadoVacio, Etiqueta, Flecha, Foto, Pastilla } from '@/components/Basicos';
import { IconoCalendario, IconoUbicacion } from '@/components/Iconos';
import { TarjetaActividad } from '@/components/Tarjetas';
import { actividades, configuracion, firmarFotos } from '@/lib/datos';
import { etiquetaActividad, fechaActividad } from '@/lib/formato';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Eventos' };

/**
 * Eventos: el próximo evento (si hay uno marcado) y las actividades del año más
 * reciente. Por decisión de la directiva no hay sección «Realizados».
 */
export default async function Eventos() {
  const { vistaPrevia } = await exigirPagina('eventos');
  const [acts, conf] = await Promise.all([actividades(), configuracion()]);
  const proximo = acts.find((a) => a.es_proximo);
  const anio = acts.filter((a) => !a.es_proximo)[0]?.anio;
  const delAnio = acts.filter((a) => a.anio === anio && !a.es_proximo);
  const fotos = await firmarFotos([proximo?.portada_foto_id, ...delAnio.map((a) => a.portada_foto_id)]);
  const fotoProximo = fotos.get(proximo?.portada_foto_id ?? '');

  return (
    <>
      <AvisoVistaPrevia activo={vistaPrevia} />
      <section className="contenedor pb-16 pt-16 sm:pt-20">
        <h1 className="t-h1">Encuentros que nos unen</h1>
        <div className="mt-10">
          {proximo ? (
            <Link href={`/eventos/${proximo.slug}`} data-proximo
              className="tarjeta levantar grid overflow-hidden lg:grid-cols-[1.1fr_1fr]">
              <div className="relative min-h-[260px] bg-azul-profundo">
                {fotoProximo && <Foto foto={fotoProximo} prioridad className="absolute inset-0 size-full object-cover" tamanos="(max-width: 1024px) 90vw, 50vw" />}
              </div>
              <div className="p-8 sm:p-10">
                <div className="flex flex-wrap gap-2"><Pastilla tono="rojo">Próximo</Pastilla><Pastilla tono="claro">{etiquetaActividad(proximo)}</Pastilla></div>
                <h2 className="t-h2 mt-4">{proximo.titulo}</h2>
                <ul className="t-meta mt-5 space-y-2 font-normal text-texto-2">
                  {fechaActividad(proximo) && <li className="flex items-center gap-2"><IconoCalendario tam={18} />{fechaActividad(proximo)}</li>}
                  {proximo.lugar && <li className="flex items-center gap-2"><IconoUbicacion tam={18} />{proximo.lugar}</li>}
                </ul>
                {proximo.introduccion && <p className="mt-5 text-texto-2">{proximo.introduccion}</p>}
                <span className="mt-6 inline-flex gap-1 font-ui font-semibold text-azul">Ver el evento <Flecha /></span>
              </div>
            </Link>
          ) : (
            <EstadoVacio icono={<IconoCalendario />} titulo="Aún no hay eventos programados"
              acciones={[
                ...(delAnio.length > 0 ? [{ texto: `Ver actividades ${anio}`, href: '#actividades' }] : []),
                ...(conf.instagram_url ? [{ texto: 'Seguir en Instagram', href: conf.instagram_url, secundario: true }] : []),
              ]}>
              Cuando se confirme la próxima actividad la publicaremos aquí.{delAnio.length > 0 ? ' Mientras tanto, revive las actividades de este año.' : ''}
            </EstadoVacio>
          )}
        </div>
      </section>

      {delAnio.length > 0 && (
        <section id="actividades" className="scroll-mt-24 bg-gris-claro py-20" data-seccion="actividades">
          <div className="contenedor">
            <Etiqueta>{anio === new Date().getFullYear() ? 'Este año' : 'Actividades'}</Etiqueta>
            <h2 className="t-h2 mt-3">Actividades {anio}</h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {delAnio.map((a) => (
                <li key={a.id}><TarjetaActividad actividad={a} foto={fotos.get(a.portada_foto_id ?? '')} alto="h-[320px]" /></li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
