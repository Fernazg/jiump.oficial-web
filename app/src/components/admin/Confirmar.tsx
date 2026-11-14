'use client';

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { EstadoFormulario } from './Formulario';

/**
 * Botón que pide confirmación antes de ejecutar una acción del servidor
 * (diálogo del diseño: «¿Eliminar «…»?» · Cancelar · Sí, eliminar).
 */
export function Confirmar({
  boton, claseBoton = 'adm-mini adm-mini-rojo', titulo, children, confirmar = 'Sí, eliminar', accion, peligro = true, etiqueta,
}: {
  boton: ReactNode;
  claseBoton?: string;
  titulo: string;
  children: ReactNode;
  confirmar?: string;
  accion: () => Promise<EstadoFormulario>;
  peligro?: boolean;
  etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario>(accion, null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <>
      <button type="button" className={claseBoton} onClick={() => setAbierto(true)} aria-label={etiqueta}>{boton}</button>
      <dialog ref={dialogo} aria-labelledby={idTitulo} onClose={() => setAbierto(false)}
        className="m-auto w-[calc(100%-40px)] max-w-[460px] rounded-[22px] bg-white p-7 text-texto shadow-[0_30px_60px_rgba(0,0,0,.35)] backdrop:bg-azul-profundo/55">
        <h2 id={idTitulo} className="font-titulo text-[22px] font-extrabold leading-tight">{titulo}</h2>
        <div className="mt-3.5 text-[15px] leading-relaxed text-texto-2">{children}</div>
        {estado?.error && <p role="alert" className="adm-error mt-4">{estado.error}</p>}
        <form action={enviar} className="mt-5 flex flex-wrap justify-end gap-2.5">
          <button type="button" className="adm-boton adm-secundario" onClick={() => setAbierto(false)}>Cancelar</button>
          <button type="submit" className={`adm-boton ${peligro ? 'adm-peligro' : 'adm-primario'}`} disabled={pendiente} autoFocus>
            {pendiente ? 'Un momento…' : confirmar}
          </button>
        </form>
      </dialog>
    </>
  );
}
