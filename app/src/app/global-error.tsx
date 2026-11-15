'use client';

/**
 * Último recurso: falló la estructura base del sitio. Esta página reemplaza
 * todo (por eso trae su propio <html>) y no depende de estilos ni de datos.
 */
export default function ErrorGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'Helvetica, Arial, sans-serif', color: '#1c1e21', background: '#f2f4f5' }}>
        <main style={{ maxWidth: 520, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 26, lineHeight: 1.2 }}>No pudimos cargar el sitio</h1>
          <p style={{ color: '#43474d', lineHeight: 1.6 }}>Algo falló de nuestro lado. Vuelve a intentarlo en un momento.</p>
          <button type="button" onClick={reset}
            style={{ marginTop: 12, minHeight: 48, padding: '0 24px', border: 0, borderRadius: 999, background: '#0073b1', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
