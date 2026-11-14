'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

export type EstadoFormulario = { error?: string; ok?: string } | null;
type Accion = (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

/** Formulario que envía a una acción del servidor y muestra su error o éxito. */
export function Formulario({ accion, children, className = '', id }: {
  accion: Accion; children: ReactNode; className?: string; id?: string;
}) {
  const [estado, enviar] = useActionState(accion, null);
  // Marca el formulario cuando ya está activo en el navegador (lo usan las pruebas).
  const [listo, setListo] = useState(false);
  useEffect(() => setListo(true), []);
  return (
    <form action={enviar} className={className} id={id} data-listo={listo || undefined}>
      {estado?.error && <p role="alert" className="adm-error">{estado.error}</p>}
      {estado?.ok && <p role="status" className="adm-ok">{estado.ok}</p>}
      {children}
    </form>
  );
}

/** Botón de envío que se desactiva mientras la acción está en curso. */
export function BotonEnviar({ children, className = 'adm-boton adm-primario', pendiente, ...resto }: {
  children: ReactNode; className?: string; pendiente?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || resto.disabled} aria-busy={pending} {...resto}>
      {pending && pendiente ? pendiente : children}
    </button>
  );
}
