'use client';

import type { ReactNode } from 'react';

/** <select> que envía su formulario al cambiar (filtros del listado). */
export function SelectorAuto({ name, defaultValue, children, etiqueta }: {
  name: string; defaultValue?: string; children: ReactNode; etiqueta: string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[13px] text-texto-3">{etiqueta}
      <select name={name} defaultValue={defaultValue ?? ''} onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="adm-campo min-h-11 w-auto max-w-[220px] rounded-xl text-texto">
        {children}
      </select>
    </label>
  );
}
