'use client';

import { ErrorGeneral } from '@/components/ErrorGeneral';

/**
 * Falló algo compartido por todo el sitio (por ejemplo, no se pudo leer el menú
 * porque la base de datos no responde): se muestra el aviso solo, sin encabezado.
 */
export default function ErrorRaiz({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="contenido" className="flex-1"><ErrorGeneral error={error} reintentar={reset} /></main>;
}
