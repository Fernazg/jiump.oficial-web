'use client';

import { useEffect } from 'react';

/**
 * Aviso de error (sigue el «estado vacío» del diseño: ícono, título,
 * explicación y botones). Se muestra cuando una página no se puede armar, por
 * ejemplo si la base de datos no responde. No muestra detalles técnicos: el
 * detalle queda en el registro del servidor, identificado por `digest`.
 */
export function ErrorGeneral({ error, reintentar, panel = false }: {
  error: Error & { digest?: string }; reintentar: () => void; panel?: boolean;
}) {
  useEffect(() => { console.error(error); }, [error]);
  const boton = panel ? 'adm-boton' : 'boton';
  return (
    <section className={panel ? 'w-full' : 'contenedor py-20'} data-pagina="error">
      <div role="alert" className={`mx-auto max-w-[720px] rounded-[28px] px-6 py-14 text-center ${panel ? 'bg-white' : 'bg-gris-claro'}`}>
        <div aria-hidden className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-azul-claro font-titulo text-[30px] font-extrabold text-azul">!</div>
        <h1 className="font-titulo text-[24px] font-bold leading-tight sm:text-[26px]">No pudimos cargar esta página</h1>
        <p className="medida mx-auto mt-3 text-texto-2">
          Algo falló de nuestro lado. Vuelve a intentarlo en un momento{panel ? '; lo que ya guardaste no se pierde.' : '.'}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reintentar} className={`${boton} ${panel ? 'adm-primario' : 'boton-primario'}`}>Reintentar</button>
          {/* Enlace normal (no <Link>): recarga todo desde cero, por si falló algo compartido. */}
          <a href={panel ? '/admin' : '/'} className={`${boton} ${panel ? 'adm-secundario' : 'boton-secundario'}`}>{panel ? 'Volver al escritorio' : 'Ir al inicio'}</a>
        </div>
        {error.digest && <p className="mt-6 text-[13px] text-texto-3">Código para soporte: {error.digest}</p>}
      </div>
    </section>
  );
}
