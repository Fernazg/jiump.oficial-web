'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * Botón que pide confirmación antes de un cambio en el formulario (no en el
 * servidor): por ejemplo, quitar un enlace antes de guardar. Mismo diálogo
 * que «Confirmar» (que sí ejecuta una acción del servidor).
 */
export function ConfirmarLocal({ boton, claseBoton = 'adm-mini adm-mini-rojo', etiqueta, titulo, children, confirmar = 'Sí, quitar', alConfirmar }: {
  boton: ReactNode;
  claseBoton?: string;
  etiqueta?: string;
  titulo: string;
  children: ReactNode;
  confirmar?: string;
  alConfirmar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
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
        <div className="mt-5 flex flex-wrap justify-end gap-2.5">
          <button type="button" className="adm-boton adm-secundario" onClick={() => setAbierto(false)}>Cancelar</button>
          <button type="button" className="adm-boton adm-peligro" autoFocus onClick={() => { setAbierto(false); alConfirmar(); }}>{confirmar}</button>
        </div>
      </dialog>
    </>
  );
}
