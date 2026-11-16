'use client';

import { ErrorGeneral } from '@/components/ErrorGeneral';

/** Falló el panel completo (o un editor a pantalla completa). */
export default function ErrorAdmin({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="contenido" className="flex flex-1 items-center px-5 py-10"><ErrorGeneral error={error} reintentar={reset} panel /></main>;
}
