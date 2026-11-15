import Link from 'next/link';
import { Fragment } from 'react';
import { EstadoVacio, Etiqueta, Flecha, Foto } from '@/components/Basicos';
import { IconoLibro } from '@/components/Iconos';
import { Cifras, QueHacemos } from '@/components/SeccionesPagina';
import { bloquesVisibles } from '@/lib/catalogo-secciones';
import type { FotoFirmada, Institucional, SeccionPagina } from '@/lib/tipos';

/**
 * Nosotros: todo el texto viene de `institucional` (textos oficiales de JIUMP,
 * copiados sin cambios) y de las secciones de la página «nosotros», en su
 * orden y visibilidad. Si aún no están cargados, se muestra el estado vacío:
 * el sitio no completa con textos propios. La usan el sitio y la vista previa.
 */
export function NosotrosCompleto({ secs, inst, fotos }: { secs: SeccionPagina[]; inst: Institucional[]; fotos: Map<string, FotoFirmada> }) {
  const identidad = inst.filter((i) => i.tipo === 'identidad' || i.tipo === 'quienes_somos');
  const cifras = inst.filter((i) => i.tipo === 'cifra');
  const fe = inst.filter((i) => i.tipo === 'declaracion_fe');
  const historia = inst.filter((i) => i.tipo === 'vision' || i.tipo === 'historia');
  const sinTextos = identidad.length + cifras.length + fe.length + historia.length === 0;

  return (
    <>
      {bloquesVisibles('nosotros', secs).map((sec) => {
        switch (sec.tipo) {
          case 'portada': {
            const fotoPortada = fotos.get(String(sec.contenido.foto_id ?? ''));
            return (
              <section key={sec.id} className="relative isolate overflow-hidden bg-azul-profundo text-white">
                {fotoPortada && <Foto foto={fotoPortada} prioridad className="absolute inset-0 -z-10 size-full object-cover" tamanos="100vw" />}
                <div className="velo absolute inset-0 -z-10" />
                <div className={`contenedor flex flex-col justify-end pb-14 ${fotoPortada ? 'min-h-[560px]' : 'min-h-[320px]'} pt-24`}>
                  <nav aria-label="Ruta" className="t-meta font-normal text-white/85">
                    <Link href="/" className="underline underline-offset-2">Inicio</Link> / Nosotros
                  </nav>
                  <span className="franja-corta mt-4" aria-hidden />
                  <h1 className="t-h1 mt-5">Quiénes somos</h1>
                </div>
              </section>
            );
          }
          case 'identidad':
            if (sinTextos) {
              return (
                <section key={sec.id} className="contenedor py-20">
                  <EstadoVacio icono={<IconoLibro />} titulo="Contenido en preparación"
                    acciones={[{ texto: 'Ver eventos', href: '/eventos' }, { texto: 'Leer artículos', href: '/articulos', secundario: true }]}>
                    Esta página mostrará los textos oficiales de JIUMP cuando se publiquen desde el panel.
                  </EstadoVacio>
                </section>
              );
            }
            return (identidad.length > 0 || cifras.length > 0) ? (
              <section key={sec.id} className="contenedor grid gap-12 py-20 lg:grid-cols-2" data-seccion="identidad">
                <div className="space-y-6">
                  {identidad.map((i) => (
                    <div key={i.id}>
                      <Etiqueta linea>{i.tipo === 'identidad' ? 'Nuestra identidad' : 'Quiénes somos'}</Etiqueta>
                      <p className="mt-4 font-titulo text-[26px] font-bold leading-snug">{i.titulo}</p>
                      {i.texto && <p className="medida mt-4 whitespace-pre-line text-texto-2">{i.texto}</p>}
                    </div>
                  ))}
                </div>
                <Cifras cifras={cifras} />
              </section>
            ) : null;
          case 'historia':
            return (
              <Fragment key={sec.id}>
                {historia.map((h) => (
                  <section key={h.id} className="contenedor pb-16">
                    <h2 className="t-h3">{h.titulo}</h2>
                    {h.texto && <p className="medida mt-4 whitespace-pre-line text-texto-2">{h.texto}</p>}
                  </section>
                ))}
              </Fragment>
            );
          case 'que_hacemos':
            return <QueHacemos key={sec.id} seccion={sec} fotos={fotos} />;
          case 'que_creemos':
            return fe.length > 0 ? (
              <section key={sec.id} className="bg-gris-claro py-20" data-seccion="que-creemos">
                <div className="contenedor">
                  <Etiqueta linea>Qué creemos</Etiqueta>
                  <h2 className="t-h2 mt-3">Nuestra fe</h2>
                  <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {fe.map((d) => (
                      <li key={d.id} className="tarjeta p-6">
                        <h3 className="t-h4">{d.titulo}</h3>
                        {d.texto && <p className="mt-3 whitespace-pre-line text-[15px] text-texto-2">{d.texto}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null;
          case 'invitacion':
            return (
              <section key={sec.id} className="contenedor py-20">
                <div className="flex flex-col items-start justify-between gap-6 rounded-[28px] bg-azul px-8 py-12 text-white sm:px-12 lg:flex-row lg:items-center">
                  <h2 className="t-h2 max-w-[14ch]">Encuentros que nos unen</h2>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/eventos" className="boton boton-claro">Próximos eventos <Flecha /></Link>
                    <Link href="/articulos" className="boton boton-borde-claro">Leer artículos</Link>
                  </div>
                </div>
              </section>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
