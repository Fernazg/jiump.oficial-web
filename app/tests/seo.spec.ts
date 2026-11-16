import { expect, test, type Page } from '@playwright/test';
import { admin } from './apoyo';

/**
 * SEO: idioma, dirección canónica, Open Graph, datos estructurados, mapa del
 * sitio, robots y redirección de las direcciones antiguas del blog de Wix.
 */
const marca = Date.now().toString(36);
const slug = `seo-prueba-${marca}`;
const borrador = `seo-borrador-${marca}`;
const actividad = `seo-actividad-${marca}`;

test.beforeAll(async () => {
  await admin('articulos', 'POST', [
    { titulo: `Artículo SEO ${marca}`, slug, estado: 'publicado', publicado_en: '2026-09-01T12:00:00Z', autor: 'Persona de Prueba',
      cuerpo: [{ tipo: 'titulo_seccion', texto: 'Sección' }, { tipo: 'parrafo', texto: 'Primer párrafo **del artículo** que sirve de descripción </script><script>alert(1)</script>.' }] },
    { titulo: `Borrador SEO ${marca}`, slug: borrador, estado: 'borrador', publicado_en: null, autor: null, cuerpo: [] },
  ]);
  await admin('actividades', 'POST', {
    titulo: `Actividad SEO ${marca}`, slug: actividad, tipo: 'encuentro', anio: 2026, estado: 'publicado',
    fecha_inicio: '2026-10-10', fecha_fin: '2026-10-11', fecha_precision: 'dia', lugar: 'Lugar de prueba', introduccion: 'Introducción de prueba.',
  });
});
test.afterAll(async () => {
  await admin(`articulos?slug=in.(${slug},${borrador})`, 'DELETE');
  await admin(`actividades?slug=eq.${actividad}`, 'DELETE');
});

const meta = (page: Page, selector: string) => page.locator(selector).first().getAttribute('content');
async function datosEstructurados(page: Page): Promise<Record<string, unknown>[]> {
  const textos = await page.locator('script[type="application/ld+json"]').allTextContents();
  return textos.map((t) => JSON.parse(t) as Record<string, unknown>);
}

test('todas las páginas declaran el idioma es-CL, su dirección canónica y cómo se ven al compartirlas', async ({ page, baseURL }) => {
  for (const ruta of ['/', '/nosotros', '/eventos', '/articulos', '/galeria', `/articulos/${slug}`, '/eventos/convencion-nacional-2026', '/galeria/convencion-nacional-2026']) {
    await page.goto(ruta);
    await expect(page.locator('html'), ruta).toHaveAttribute('lang', 'es-CL');
    await expect(page.locator('link[rel="canonical"]'), ruta).toHaveAttribute('href', `${baseURL}${ruta === '/' ? '' : ruta}`);
    expect(await meta(page, 'meta[name="description"]'), ruta).toBeTruthy();
    expect(await meta(page, 'meta[property="og:title"]'), ruta).toBeTruthy();
    expect(await meta(page, 'meta[property="og:url"]'), ruta).toBe(`${baseURL}${ruta === '/' ? '' : ruta}`);
    expect(await meta(page, 'meta[property="og:site_name"]'), ruta).toBe('JIUMP');
    expect(await meta(page, 'meta[property="og:locale"]'), ruta).toBe('es_CL');
    expect(await page.locator('h1').count(), ruta).toBe(1);
  }
});

test('artículo: descripción tomada de su propio texto y datos estructurados «Article»', async ({ page, baseURL }) => {
  await page.goto(`/articulos/${slug}`);
  expect(await meta(page, 'meta[name="description"]')).toContain('Primer párrafo del artículo que sirve de descripción');
  expect(await meta(page, 'meta[property="og:type"]')).toBe('article');
  const [articulo] = (await datosEstructurados(page)).filter((d) => d['@type'] === 'Article');
  expect(articulo).toMatchObject({
    headline: `Artículo SEO ${marca}`, url: `${baseURL}/articulos/${slug}`, inLanguage: 'es-CL',
    author: { '@type': 'Person', name: 'Persona de Prueba' }, publisher: { '@type': 'Organization', name: 'JIUMP' },
  });
  expect(String(articulo.datePublished)).toContain('2026-09-01');
  // Un texto del contenido no puede cerrar el bloque de datos ni ejecutar nada.
  expect(await page.evaluate(() => document.querySelectorAll('script[type="application/ld+json"]').length)).toBe(1);
});

test('artículo sin autor en la base: no se inventa una persona', async ({ page }) => {
  await page.goto('/articulos/como-comenzo-la-biblia');
  const [articulo] = (await datosEstructurados(page)).filter((d) => d['@type'] === 'Article');
  expect(articulo.author).toMatchObject({ '@type': 'Organization', name: 'JIUMP' });
});

test('actividad: «Event» solo cuando tiene fecha en la base, con sus datos reales', async ({ page }) => {
  await page.goto(`/eventos/${actividad}`);
  const [evento] = (await datosEstructurados(page)).filter((d) => d['@type'] === 'Event');
  expect(evento).toMatchObject({
    name: `Actividad SEO ${marca}`, startDate: '2026-10-10', endDate: '2026-10-11', description: 'Introducción de prueba.',
    location: { '@type': 'Place', name: 'Lugar de prueba' },
  });
  // La Convención del seed no tiene fecha: no se publica un evento con datos incompletos.
  await page.goto('/eventos/convencion-nacional-2026');
  expect((await datosEstructurados(page)).filter((d) => d['@type'] === 'Event')).toEqual([]);
  // Sí lleva su foto de portada para compartir.
  expect(await meta(page, 'meta[property="og:image"]')).toContain('/storage/v1/object/sign/fotos/');
  expect(await meta(page, 'meta[property="og:image:alt"]')).toBeTruthy();
});

test('Inicio: datos estructurados «Organization» con el Instagram oficial', async ({ page, baseURL }) => {
  await page.goto('/');
  const [org] = (await datosEstructurados(page)).filter((d) => d['@type'] === 'Organization');
  expect(org).toMatchObject({ name: 'JIUMP', url: baseURL, logo: `${baseURL}/marca/logo-jiump.png`, sameAs: ['https://www.instagram.com/jiump.oficial'] });
});

test('las búsquedas y filtros de Artículos no se indexan y apuntan a la página canónica', async ({ page, baseURL }) => {
  await page.goto('/articulos?q=biblia');
  expect(await meta(page, 'meta[name="robots"]')).toContain('noindex');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${baseURL}/articulos`);
  await page.goto('/articulos');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test('el panel y las páginas que no existen no se indexan', async ({ page }) => {
  await page.goto('/admin/ingresar');
  expect(await meta(page, 'meta[name="robots"]')).toContain('noindex');
  await page.goto('/articulos/no-existe');
  expect(await meta(page, 'meta[name="robots"]')).toContain('noindex');
});

test('sitemap.xml lista solo lo publicado, y robots.txt lo anuncia y excluye el panel', async ({ request, baseURL }) => {
  const mapa = await request.get('/sitemap.xml');
  expect(mapa.status()).toBe(200);
  expect(mapa.headers()['content-type']).toContain('xml');
  const xml = await mapa.text();
  for (const ruta of ['', '/nosotros', '/eventos', '/articulos', '/galeria', `/articulos/${slug}`, `/eventos/${actividad}`, '/galeria/convencion-nacional-2026']) {
    expect(xml, ruta).toContain(`<loc>${baseURL}${ruta}</loc>`);
  }
  expect(xml).not.toContain(borrador);
  expect(xml).not.toContain('/admin');
  expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}/);

  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /admin');
  expect(robots).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
});

test('una página retirada sale del mapa del sitio junto con su contenido', async ({ request, baseURL }) => {
  const [pagina] = await admin<{ id: string }[]>('paginas?clave=eq.galeria&select=id');
  await admin(`paginas?id=eq.${pagina.id}`, 'PATCH', { estado: 'borrador' });
  try {
    const xml = await (await request.get('/sitemap.xml')).text();
    expect(xml).not.toContain(`${baseURL}/galeria`);
    expect(xml).toContain(`<loc>${baseURL}/articulos</loc>`);
  } finally {
    await admin(`paginas?id=eq.${pagina.id}`, 'PATCH', { estado: 'publicado' });
  }
});

test('direcciones antiguas del blog de Wix (/post/…) redirigen de forma permanente al artículo', async ({ request }) => {
  const r = await request.get(`/post/${slug}`, { maxRedirects: 0 });
  expect(r.status()).toBe(308);
  expect(r.headers().location).toMatch(new RegExp(`/articulos/${slug}$`));
  expect((await request.get(`/post/${borrador}`, { maxRedirects: 0 })).status()).toBe(404); // un borrador no se revela
  expect((await request.get('/post/no-existe', { maxRedirects: 0 })).status()).toBe(404);
});
