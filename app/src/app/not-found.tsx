import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Encabezado, Pie } from '@/components/Marco';
import { NoEncontrado } from '@/components/NoEncontrado';

export const metadata: Metadata = { title: 'Página no encontrada' };

/** 404 para rutas que no existen (fuera del grupo del sitio). */
export default async function NoEncontradoRaiz() {
  await connection(); // se arma en cada visita: el menú viene de la base
  return (
    <>
      <Encabezado />
      <main id="contenido" className="flex-1"><NoEncontrado /></main>
      <Pie />
    </>
  );
}
