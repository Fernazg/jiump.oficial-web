'use client';

import { ErrorGeneral } from '@/components/ErrorGeneral';

/** Una página del sitio no se pudo armar: el encabezado y el pie siguen visibles. */
export default function ErrorSitio({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorGeneral error={error} reintentar={reset} />;
}
