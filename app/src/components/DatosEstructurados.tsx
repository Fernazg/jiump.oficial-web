/**
 * Datos estructurados (schema.org, formato JSON-LD) para buscadores. Es un
 * bloque de datos, no un script que se ejecute. «<» se escapa para que un texto
 * del contenido nunca pueda cerrar la etiqueta.
 */
export function DatosEstructurados({ datos }: { datos: Record<string, unknown> }) {
  const json = JSON.stringify({ '@context': 'https://schema.org', ...datos }).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
