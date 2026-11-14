import 'server-only';
import { actividadesVisibles, listarAlbumes } from './galerias';

/** Dónde puede aparecer un video: un álbum o una actividad (Multimedia ve solo las publicadas). */
export async function destinosVideo(): Promise<{ valor: string; nombre: string }[]> {
  const [albumes, actividades] = await Promise.all([listarAlbumes(), actividadesVisibles()]);
  return [
    ...albumes.map((a) => ({ valor: `album:${a.id}`, nombre: `Galería › ${a.titulo}` })),
    ...actividades.map((a) => ({ valor: `actividad:${a.id}`, nombre: `Eventos › ${a.titulo}` })),
  ];
}
