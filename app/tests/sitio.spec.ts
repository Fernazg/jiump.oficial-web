import { expect, test, type Page } from '@playwright/test';
import { admin, PROHIBIDO } from './apoyo';

const PAGINAS = ['/', '/articulos', '/nosotros', '/eventos', '/galeria'];

async function textoVisible(page: Page) {
  return page.locator('body').innerText();
}

// ---------------------------------------------------------------------------
// Las páginas cargan y respetan las reglas del README
// ---------------------------------------------------------------------------
test.describe('páginas públicas', () => {
  for (const ruta of PAGINAS) {
    test(`${ruta} carga sin errores y sin secciones prohibidas`, async ({ page }) => {
      const errores: string[] = [];
      page.on('pageerror', (e) => errores.push(e.message));
      const r = await page.goto(ruta);
      expect(r?.status()).toBe(200);
      await expect(page.getByRole('navigation', { name: 'Principal' }).first()).toBeVisible();
      expect(await textoVisible(page)).not.toMatch(PROHIBIDO);
      expect(errores).toEqual([]);
    });
  }

  test('el menú es el unificado: Nosotros · Eventos · Artículos · Galería', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Principal' }).first();
    await expect(nav.getByRole('link')).toHaveText(['Nosotros', 'Eventos', 'Artículos', 'Galería']);
  });

  test('Inicio muestra las actividades destacadas y los artículos publicados', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-seccion="actividades-destacadas"] [data-actividad]')).toHaveCount(4);
    await expect(page.locator('[data-seccion="articulos-recientes"] [data-articulo]').first()).toBeVisible();
    // Sin eventos próximos en la base: estado vacío del diseño
    await expect(page.locator('[data-seccion="eventos"]')).toContainText('Aún no hay eventos programados');
  });

  test('página de artículo, de actividad y de álbum', async ({ page }) => {
    expect((await page.goto('/articulos/por-que-fue-necesaria-la-reforma'))?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('¿Por qué fue necesaria la Reforma?');
    await expect(page.locator('[data-siguiente]')).toContainText('Una Reforma que todavía nos habla');

    expect((await page.goto('/eventos/convencion-nacional-2026'))?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Convención Nacional JIUMP 2026');
    await expect(page.locator('[data-seccion="videos"]')).toHaveCount(0); // sin videos: la sección se oculta

    await page.goto('/galeria');
    await expect(page.locator('[data-album="convencion-nacional-2026"]')).toContainText('10 fotos'); // las 10 del álbum en el seed

    expect((await page.goto('/galeria/convencion-nacional-2026'))?.status()).toBe(200);
    await page.getByRole('button', { name: /Ver en pantalla completa/ }).first().click();
    await expect(page.getByRole('dialog', { name: 'Visor de fotos' })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('dialog')).toContainText('2 /');
    await page.getByRole('button', { name: 'Cerrar visor' }).click();
  });

  test('una ruta inexistente responde 404 con la página del diseño', async ({ page }) => {
    const r = await page.goto('/no-existe-esta-pagina');
    expect(r?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('No encontramos esta página');
  });
});

// ---------------------------------------------------------------------------
// Fotos: solo publicadas y con URL firmada (bucket privado)
// ---------------------------------------------------------------------------
test('las fotos usan URL firmadas, cargan y tienen texto alternativo', async ({ page }) => {
  await page.goto('/eventos/fedi-2026');
  const imgs = page.locator('main img');
  expect(await imgs.count()).toBeGreaterThan(3);
  for (const img of await imgs.all()) {
    await img.scrollIntoViewIfNeeded();
    const src = (await img.getAttribute('src')) ?? '';
    if (src.startsWith('/_next/') || src.startsWith('/marca/')) continue;
    expect(src).toContain('/storage/v1/object/sign/fotos/');
    expect(src).not.toContain('/object/public/');
    expect((await img.getAttribute('alt'))?.trim()).toBeTruthy();
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  }
});

test('el HTML no expone claves de Supabase', async ({ page }) => {
  await page.goto('/');
  const html = await page.content();
  // Las URL firmadas llevan su propio token de corta duración; las claves del proyecto, nunca.
  for (const clave of [process.env.SUPABASE_ANON_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]) {
    if (clave) expect(html).not.toContain(clave);
  }
  expect(html).not.toMatch(/sb_secret_|sb_publishable_|service_role/);
});

// ---------------------------------------------------------------------------
// Un borrador nunca aparece
// ---------------------------------------------------------------------------
test.describe('contenido no publicado', () => {
  const marca = `zz${Date.now()}`;
  let ids: string[] = [];

  test.beforeAll(async () => {
    const creados = await admin<{ id: string }[]>('articulos', 'POST', [
      { titulo: `Borrador de prueba ${marca}`, slug: `borrador-${marca}`, estado: 'borrador', publicar_en: null, cuerpo: [{ tipo: 'parrafo', texto: `texto ${marca}` }] },
      { titulo: `En revisión ${marca}`, slug: `revision-${marca}`, estado: 'revision', publicar_en: null, cuerpo: [] },
      { titulo: `Programado ${marca}`, slug: `programado-${marca}`, estado: 'programado', publicar_en: new Date(Date.now() + 86_400_000).toISOString(), cuerpo: [] },
    ]);
    ids = creados.map((c) => c.id);
  });

  test.afterAll(async () => {
    if (ids.length) await admin(`articulos?id=in.(${ids.join(',')})`, 'DELETE');
  });

  test('no aparece en Inicio, en el listado ni en la búsqueda, y su URL da 404', async ({ page }) => {
    for (const ruta of ['/', '/articulos']) {
      await page.goto(ruta);
      expect(await page.content()).not.toContain(marca);
    }
    // La búsqueda repite lo buscado, pero no devuelve ningún artículo
    await page.goto(`/articulos?q=${marca}`);
    await expect(page.locator('[data-resultado] [data-articulo]')).toHaveCount(0);
    await expect(page.locator('[data-estado-vacio]')).toContainText(`No encontramos artículos con «${marca}»`);
    for (const slug of [`borrador-${marca}`, `revision-${marca}`, `programado-${marca}`]) {
      expect((await page.goto(`/articulos/${slug}`))?.status()).toBe(404);
    }
    expect((await page.goto('/articulos/cuando-la-verdad-tuvo-un-precio'))?.status()).toBe(404); // «en revisión» en el seed
  });

  test('una actividad en borrador no aparece y su URL da 404', async ({ page }) => {
    const [a] = await admin<{ id: string }[]>('actividades', 'POST', { titulo: `Actividad ${marca}`, slug: `actividad-${marca}`, tipo: 'zonal', anio: 2026, estado: 'borrador', destacar_inicio: true, es_proximo: false });
    try {
      for (const ruta of ['/', '/eventos']) {
        await page.goto(ruta);
        expect(await page.content()).not.toContain(marca);
      }
      expect((await page.goto(`/eventos/actividad-${marca}`))?.status()).toBe(404);
    } finally {
      await admin(`actividades?id=eq.${a.id}`, 'DELETE');
    }
  });
});

// ---------------------------------------------------------------------------
// Cuerpo de artículo: bloques, índice, referencias bíblicas y tamaño de texto
// ---------------------------------------------------------------------------
test('el cuerpo de un artículo publicado se muestra con sus bloques', async ({ page }) => {
  const marca = `zz${Date.now()}`;
  const [a] = await admin<{ id: string }[]>('articulos', 'POST', {
    titulo: `Artículo de prueba ${marca}`, slug: `bloques-${marca}`, estado: 'publicado',
    cuerpo: [
      { tipo: 'entradilla', texto: 'Texto de prueba para la entradilla.' },
      { tipo: 'titulo_seccion', texto: 'Primera sección de prueba' },
      { tipo: 'parrafo', texto: 'Un párrafo con **negrita** que cita Romanos 1:17 en el texto.' },
      { tipo: 'versiculo', texto: 'Texto de prueba del versículo.', referencia: 'Efesios 2:8-9' },
      { tipo: 'titulo_seccion', texto: 'Segunda sección de prueba' },
      { tipo: 'tarjetas', items: ['Uno', 'Dos'] },
      { tipo: 'para_recordar', texto: 'Texto de prueba para recordar.' },
    ],
  });
  try {
    await page.goto(`/articulos/bloques-${marca}`);
    await expect(page.locator('#cuerpo-articulo strong')).toHaveText('negrita');
    await expect(page.locator('[data-ref-biblica]')).toHaveText('Romanos 1:17');
    await expect(page.getByRole('navigation', { name: 'En este artículo' }).getByRole('link')).toHaveCount(2);
    await expect(page.getByRole('progressbar', { name: 'Progreso de lectura' })).toBeAttached();
    await page.getByRole('button', { name: 'Agrandar el texto' }).click();
    await expect.poll(() => page.locator('#cuerpo-articulo').evaluate((e) => e.style.getPropertyValue('--escala-texto'))).toBe('1.12');
  } finally {
    await admin(`articulos?id=eq.${a.id}`, 'DELETE');
  }
});

// ---------------------------------------------------------------------------
// Mantenimiento y redirecciones (proxy)
// ---------------------------------------------------------------------------
test('el modo mantenimiento responde 503 en todo el sitio', async ({ page }) => {
  await admin('configuracion?id=eq.true', 'PATCH', { modo_mantenimiento: true });
  try {
    const r = await page.goto('/articulos');
    expect(r?.status()).toBe(503);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Estamos mejorando nuestro sitio');
  } finally {
    await admin('configuracion?id=eq.true', 'PATCH', { modo_mantenimiento: false });
  }
  expect((await page.goto('/articulos'))?.status()).toBe(200);
});

test('las URL antiguas de Wix redirigen con 301', async ({ request }) => {
  const [r] = await admin<{ id: string }[]>('redirecciones', 'POST', { origen: '/post/prueba-antigua-é', destino: '/articulos', codigo: 301 });
  try {
    const res = await request.get('/post/prueba-antigua-%C3%A9', { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers().location).toMatch(/\/articulos$/);
  } finally {
    await admin(`redirecciones?id=eq.${r.id}`, 'DELETE');
  }
});

// ---------------------------------------------------------------------------
// Celular (390 px): sin desborde horizontal y menú ☰
// ---------------------------------------------------------------------------
test.describe('celular @celular', () => {
  for (const ruta of [...PAGINAS, '/articulos/por-que-fue-necesaria-la-reforma', '/eventos/convencion-nacional-2026', '/galeria/convencion-nacional-2026']) {
    test(`${ruta} no se desborda a lo ancho @celular`, async ({ page }) => {
      await page.goto(ruta);
      // Recorre la página para que carguen las imágenes diferidas antes de medir
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) {
          window.scrollTo({ top: y, behavior: 'instant' });
          await new Promise((r) => setTimeout(r, 50));
        }
        await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
      });
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(desborde).toBeLessThanOrEqual(0);
    });
  }

  test('el menú ☰ abre el panel con enlaces de 52 px @celular', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    const enlace = page.locator('#menu-movil').getByRole('link', { name: 'Artículos' });
    await expect(enlace).toBeVisible();
    expect((await enlace.boundingBox())?.height).toBe(52);
    await enlace.click();
    await expect(page).toHaveURL(/\/articulos$/);
    await expect(page.locator('#menu-movil')).toBeHidden();
  });
});
