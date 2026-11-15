import type { Metadata } from 'next';
import { EditorMenu } from '@/components/admin/sitio/EditorMenu';
import { exigirSeccion } from '@/lib/admin/acceso';
import { seccion } from '@/lib/admin/secciones';
import { menuParaEditar } from '@/lib/admin/sitio';

export const metadata: Metadata = { title: seccion('menu').nombre };

export default async function Menu({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  await exigirSeccion('menu');
  const [{ aviso }, m] = await Promise.all([searchParams, menuParaEditar()]);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="adm-h1">Menú, enlaces y pie</h1>
        <span className="text-[15px] text-texto-3">Los cambios quedan pendientes hasta revisar la vista previa y publicarlos.</span>
      </div>
      <EditorMenu inicial={m.items} version={m.version} hayCambios={m.hayCambios} previaAlDia={m.previaAlDia} aviso={aviso ?? null} />
    </>
  );
}
