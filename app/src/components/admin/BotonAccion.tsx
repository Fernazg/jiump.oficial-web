'use client';

import { useActionState, type ReactNode } from 'react';
import type { EstadoFormulario } from './Formulario';

/** Botón que ejecuta una acción del servidor y muestra su error (si lo hay). */
export function BotonAccion({ accion, children, className = 'adm-boton adm-primario', disabled, titulo, ...datos }: {
  accion: () => Promise<EstadoFormulario>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  titulo?: string;
} & Record<`data-${string}`, string | boolean | undefined>) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario>(accion, null);
  return (
    <form action={enviar} className="contents">
      <button className={className} disabled={disabled || pendiente} title={titulo} {...datos}>{pendiente ? 'Un momento…' : children}</button>
      {estado?.error && <p role="alert" className="adm-error basis-full">{estado.error}</p>}
    </form>
  );
}
