'use client';

import { ErrorGeneral } from '@/components/ErrorGeneral';

/** Una sección del panel no se pudo armar: la barra lateral sigue visible. */
export default function ErrorPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorGeneral error={error} reintentar={reset} panel />;
}
