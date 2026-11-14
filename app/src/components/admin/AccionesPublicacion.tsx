'use client';

import { BotonAccion } from '@/components/admin/BotonAccion';
import { Confirmar } from '@/components/admin/Confirmar';
import { descartarCambios, despublicar, eliminar, publicar } from '@/lib/admin/acciones-contenido';

type Tipo = 'actividad' | 'album';
const NOMBRE: Record<Tipo, { cosa: string; donde: string }> = {
  actividad: { cosa: 'la actividad', donde: 'Su página y su tarjeta en Inicio dejarán de verse.' },
  album: { cosa: 'el álbum', donde: 'Dejará de verse en la Galería.' },
};

/**
 * Botones y avisos de publicación (igual que en los artículos):
 *  · Borrador: «Publicar» se activa después de guardar y revisar la vista previa.
 *  · Publicado: lo que se edita queda como cambio pendiente; el sitio no cambia
 *    hasta revisar la vista previa y «Publicar cambios».
 */
export function AccionesPublicacion({ tipo, id, titulo, publicado, hayCambios, previaAlDia, sucio, alVerPrevia }: {
  tipo: Tipo; id: string; titulo: string; publicado: boolean; hayCambios: boolean; previaAlDia: boolean; sucio: boolean;
  alVerPrevia: () => void;
}) {
  const n = NOMBRE[tipo];
  const listo = previaAlDia && !sucio;
  const borde = 'adm-boton bg-white text-rojo-oscuro shadow-[inset_0_0_0_1.5px_var(--color-rojo)]';
  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" className="adm-boton adm-secundario" onClick={alVerPrevia}>Vista previa</button>
        {publicado ? (
          <>
            {hayCambios && (
              <BotonAccion accion={publicar.bind(null, tipo, id)} disabled={!listo} data-publicar-cambios
                titulo={listo ? undefined : 'Primero guarda y revisa la vista previa'}>Publicar cambios</BotonAccion>
            )}
            <Confirmar boton="Despublicar" claseBoton={borde} peligro={false} titulo={`¿Retirar ${n.cosa} del sitio?`} confirmar="Sí, despublicar"
              accion={despublicar.bind(null, tipo, id)}>
              {n.donde} Podrás publicarlo otra vez después de la vista previa.{hayCambios ? ' Los cambios sin publicar quedan en el borrador.' : ''}
            </Confirmar>
          </>
        ) : (
          <BotonAccion accion={publicar.bind(null, tipo, id)} disabled={!listo} data-publicar
            titulo={listo ? undefined : 'Primero guarda y revisa la vista previa'}>Publicar</BotonAccion>
        )}
        <Confirmar boton="Eliminar" claseBoton={borde} titulo={`¿Eliminar «${titulo || n.cosa}»?`} accion={eliminar.bind(null, tipo, id)}>
          {n.donde} Las fotos quedan en la biblioteca.
        </Confirmar>
      </div>
      {!publicado && !listo && (
        <p className="adm-aviso basis-full" data-falta-previa>
          {sucio ? 'Tienes cambios sin guardar. ' : ''}Para publicar, guarda y revisa la vista previa: nada se publica sin verlo antes.
        </p>
      )}
      {publicado && !hayCambios && (
        <p className="adm-aviso basis-full" data-aviso-publicado>
          Está publicado. Lo que edites se guarda aparte y <strong>no cambia el sitio</strong> hasta que revises la vista previa y publiques los cambios.
        </p>
      )}
      {publicado && hayCambios && (
        <p className="adm-aviso basis-full flex flex-wrap items-center gap-x-2" data-cambios-pendientes>
          <span><strong>Hay cambios sin publicar.</strong> El sitio sigue mostrando la versión publicada. {listo ? 'Ya revisaste la vista previa: puedes publicarlos.' : 'Revisa la vista previa para poder publicarlos.'}</span>
          <Confirmar boton="Descartar cambios" claseBoton="font-semibold underline" titulo="¿Descartar los cambios sin publicar?" confirmar="Sí, descartar"
            accion={descartarCambios.bind(null, tipo, id)}>
            Vuelve a quedar como está publicado.
          </Confirmar>
        </p>
      )}
    </>
  );
}
