import type { Metadata } from 'next';
import Link from 'next/link';
import { EstadoVacio } from '@/components/Basicos';
import { IconoImagen } from '@/components/Iconos';
import { TarjetaAlbum } from '@/components/Tarjetas';
import { albumes, firmarFotos } from '@/lib/datos';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Galería' };

type Busqueda = { filtro?: string };

export default async function Galeria({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const { filtro } = await searchParams;
  const todos = await albumes();

  // Filtros según los datos: años y países que existen en los álbumes publicados
  const anios = [...new Set(todos.map((a) => a.anio).filter((x): x is number => Boolean(x)))].sort((a, b) => b - a);
  const paises = [...new Set(todos.map((a) => a.pais).filter((x): x is string => Boolean(x)))].sort();
  const filtros = [...anios.map(String), ...paises];
  const visibles = filtro
    ? todos.filter((a) => String(a.anio) === filtro || a.pais === filtro)
    : todos;

  const fotos = await firmarFotos(visibles.flatMap((a) => [a.portada_foto_id, ...a.fotoIds.slice(0, 4)]));

  return (
    <section className="contenedor pb-24 pt-16 sm:pt-20">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h1 className="t-h1">Momentos JIUMP</h1>
        {filtros.length > 1 && (
          <nav aria-label="Filtrar álbumes" className="flex flex-wrap gap-2">
            {[{ texto: 'Todos', valor: undefined }, ...filtros.map((f) => ({ texto: f, valor: f }))].map((f) => {
              const activo = f.valor === filtro;
              return (
                <Link key={f.texto} href={f.valor ? `/galeria?filtro=${encodeURIComponent(f.valor)}` : '/galeria'} aria-current={activo ? 'true' : undefined}
                  className={`rounded-full px-4 py-2 font-ui text-[14px] font-semibold ${activo ? 'bg-azul text-white' : 'shadow-[inset_0_0_0_1px_var(--color-linea)] hover:bg-gris-claro'}`}>
                  {f.texto}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="mt-10">
          <EstadoVacio icono={<IconoImagen />} titulo="Fotos próximamente"
            acciones={filtro ? [{ texto: 'Ver todos los álbumes', href: '/galeria' }] : [{ texto: 'Ver eventos', href: '/eventos' }]}>
            Los álbumes se publicarán cuando el equipo de Multimedia suba las fotos.
          </EstadoVacio>
        </div>
      ) : (
        <ul className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((a) => <li key={a.id}><TarjetaAlbum album={a} fotos={fotos} /></li>)}
        </ul>
      )}
    </section>
  );
}
