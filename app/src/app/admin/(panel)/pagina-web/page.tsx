import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditorPagina } from '@/components/admin/sitio/EditorPagina';
import { exigirSeccion } from '@/lib/admin/acceso';
import { catalogoFotos } from '@/lib/admin/galerias';
import { seccion } from '@/lib/admin/secciones';
import { listarPaginas, paginaParaEditar } from '@/lib/admin/sitio';
import { CATALOGO, PAGINAS_WEB, type ClavePaginaWeb } from '@/lib/catalogo-secciones';
import { parametros } from '@/lib/parametros';
import { Ayuda } from '@/components/admin/Ayuda';

export const metadata: Metadata = { title: seccion('pagina-web').nombre };

type Props = { searchParams: Promise<{ pagina?: string; aviso?: string }> };

/** Administrar página web (solo Superadmin): secciones, SEO y publicar o retirar cada página. */
export default async function PaginaWeb({ searchParams }: Props) {
  await exigirSeccion('pagina-web');
  const { pagina = 'inicio', aviso } = await parametros(searchParams);
  if (!(pagina in CATALOGO)) notFound();
  const clave = pagina as ClavePaginaWeb;
  const [e, paginas, catalogo] = await Promise.all([paginaParaEditar(clave), listarPaginas(), catalogoFotos()]);
  if (!e) notFound();
  const estadoDe = new Map(paginas.map((x) => [x.clave, x.estado]));
  const info = PAGINAS_WEB.find((x) => x.clave === clave)!;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="adm-h1">Páginas y secciones</h1>
        <span className="text-[15px] text-texto-3">Edita textos, fotos y botones. El diseño se mantiene solo.</span>
        <Ayuda>
          <ul>
            <li>Elige una página en las pestañas. Cada sección se puede subir o bajar (↑ ↓), ocultar y editar.</li>
            <li>Lo que guardas queda pendiente: el sitio no cambia hasta que revises la «Vista previa» y publiques.</li>
            <li>«Retirar» una página la saca del sitio y del menú; se puede volver a publicar.</li>
          </ul>
        </Ayuda>
      </div>
      <nav aria-label="Páginas del sitio" className="flex flex-wrap gap-2 border-b border-linea pb-3" data-pestanas-paginas>
        {PAGINAS_WEB.map((x) => (
          <Link key={x.clave} href={`/admin/pagina-web?pagina=${x.clave}`} aria-current={x.clave === clave} className="adm-filtro gap-2" data-pestana={x.clave}>
            {x.nombre}
            <span aria-label={estadoDe.get(x.clave) === 'publicado' ? 'publicada' : 'sin publicar'}
              className={`inline-block size-2 rounded-full ${estadoDe.get(x.clave) === 'publicado' ? 'bg-turquesa' : 'bg-[#cdd1d6]'}`} />
          </Link>
        ))}
      </nav>
      <EditorPagina key={clave} id={e.pagina.id} clave={clave} nombre={info.nombre} ruta={info.ruta} inicial={e.datos} version={e.version}
        estado={e.pagina.estado} hayCambios={e.hayCambios} previaAlDia={e.previaAlDia} catalogo={catalogo} aviso={aviso ?? null} />
    </>
  );
}
