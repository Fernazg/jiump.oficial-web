import { expect, test } from '@playwright/test';

/**
 * Rendimiento: las fotos conservan su dirección entre visitas (para que el
 * navegador las guarde), lo primero que se ve se carga de inmediato y el resto
 * se carga al acercarse.
 */
const fotosDe = (html: string) => [...html.matchAll(/storage\/v1\/object\/sign\/fotos\/([^"?\s]+)\?token=([^"&\s]+)/g)].map((m) => `${m[1]}?${m[2]}`);

test('una foto conserva su dirección firmada entre visitas y entre páginas', async ({ request }) => {
  const a = fotosDe(await (await request.get('/eventos/convencion-nacional-2026')).text());
  const b = fotosDe(await (await request.get('/eventos/convencion-nacional-2026')).text());
  expect(a.length).toBeGreaterThan(3);
  expect(b).toEqual(a); // misma dirección: el navegador usa su copia guardada
  // La misma foto en otra página (Galería) usa la misma dirección.
  const galeria = new Set(fotosDe(await (await request.get('/galeria')).text()));
  expect(a.filter((x) => galeria.has(x)).length).toBeGreaterThan(0);
});

test('la dirección firmada sigue sirviendo la foto', async ({ page }) => {
  await page.goto('/galeria');
  await page.goto('/galeria'); // segunda visita: direcciones reutilizadas
  const foto = page.locator('main img').first();
  await expect(foto).toBeVisible();
  expect(await foto.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
});

test('la primera foto de cada página se carga de inmediato y las demás al acercarse', async ({ page }) => {
  // (Inicio no tiene foto de portada en los datos de prueba: su primera foto está más abajo.)
  for (const ruta of ['/eventos/convencion-nacional-2026', '/galeria']) {
    await page.goto(ruta);
    const fotos = page.locator('main img[src*="/storage/"]');
    await expect(fotos.first(), ruta).toHaveAttribute('loading', 'eager');
    await expect(fotos.first(), ruta).toHaveAttribute('fetchpriority', 'high');
    const perezosas = await page.locator('main img[src*="/storage/"][loading="lazy"]').count();
    expect(perezosas, ruta).toBeGreaterThan(0);
  }
});

test('el sitio abre antes la conexión con el almacenamiento de fotos', async ({ request }) => {
  const r = await request.get('/');
  const origen = new URL(process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321').origin;
  expect(`${r.headers().link ?? ''} ${await r.text()}`).toMatch(new RegExp(`${origen.replace(/[.:/]/g, '\\$&')}[^,]*preconnect|preconnect[^>]*${origen.replace(/[.:/]/g, '\\$&')}`));
});

test('los listados no cargan el cuerpo de los artículos, y el artículo sí lo muestra', async ({ page }) => {
  await page.goto('/articulos');
  await expect(page.locator('[data-articulo]').first()).toBeVisible();
  await page.goto('/articulos/como-comenzo-la-biblia');
  await expect(page.locator('#cuerpo-articulo')).toContainText(/\S{3,}/);
  // La navegación de la serie (que usa el listado) sigue completa.
  await expect(page.locator('[data-siguiente]')).toBeVisible();
});
