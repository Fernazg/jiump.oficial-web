import { expect, test } from '@playwright/test';
import { crearUsuario, ingresar, type Usuario } from './apoyo-admin';

/**
 * Errores: direcciones mal formadas (no deben dar 500) y qué se ve cuando la
 * base de datos no responde (un aviso claro en español, no una pantalla rota).
 */
const u: Record<string, Usuario> = {};
test.beforeAll(async () => {
  u.editor = await crearUsuario('Elsa Errores', ['editor', 'eventos', 'multimedia']);
});

test.describe('direcciones mal formadas en el sitio', () => {
  const casos: [string, number][] = [
    ['/articulos?q=%00', 200],                 // carácter nulo en la búsqueda
    ['/articulos?q=a&q=b', 200],               // parámetro repetido
    ['/articulos?q=%00%00%00', 200],           // solo caracteres de control: como sin búsqueda
    ['/articulos?serie=a&serie=b&tema=%00', 200],
    ['/galeria?filtro=a&filtro=b', 200],
    [`/articulos?q=${'a'.repeat(5000)}`, 200], // búsqueda enorme: se recorta
    ['/articulos/%E0%A4%A', 400],              // codificación inválida
    ['/eventos/%E0%A4%A', 400],
    ['/galeria/%E0%A4%A', 400],
    ['/%E0%A4%A', 400],
    ['/articulos/%00', 404],
  ];
  for (const [ruta, esperado] of casos) {
    test(`${ruta.slice(0, 60)} responde ${esperado}`, async ({ request }) => {
      expect((await request.get(ruta, { maxRedirects: 0 })).status()).toBe(esperado);
    });
  }

  test('la búsqueda con caracteres de control o repetida sigue funcionando', async ({ page }) => {
    await page.goto('/articulos?q=imprenta%00');
    await expect(page.locator('[data-resultado] [data-articulo="de-los-rollos-a-la-imprenta"]')).toBeVisible();
    await page.goto('/articulos?q=imprenta&q=otra');
    await expect(page.locator('[data-resultado] [data-articulo="de-los-rollos-a-la-imprenta"]')).toBeVisible();
  });
});

test('direcciones mal formadas en el panel: sin errores 500', async ({ page }) => {
  await ingresar(page, u.editor);
  const rutas = [
    '/admin/articulos?q=a&q=b', '/admin/articulos?q=%00&estado=x&estado=y', '/admin/fotos?q=a&q=b&filtro=x&album=%00',
    '/admin/articulos/no-es-un-id', '/admin/eventos/no-es-un-id', '/admin/galerias/no-es-un-id', '/admin/videos/no-es-un-id',
    '/admin/articulos/no-es-un-id/vista-previa', '/admin/eventos/00000000-0000-4000-8000-000000000000',
  ];
  for (const ruta of rutas) {
    const r = await page.goto(ruta);
    expect(r?.status(), ruta).toBeLessThan(500);
  }
  expect((await page.request.get('/admin/articulos/%E0%A4%A')).status()).toBe(400);
});

test.describe('con la base de datos caída', () => {
  // Segundo servidor de playwright.config.ts: el mismo sitio apuntando a una base que no responde.
  const CAIDO = 'http://localhost:3101';

  test('el sitio muestra un aviso claro en español, con «Reintentar»', async ({ page }) => {
    for (const ruta of ['/', '/articulos', '/eventos/convencion-nacional-2026']) {
      const r = await page.goto(CAIDO + ruta);
      expect(r?.status(), ruta).toBe(500);
      const aviso = page.locator('[data-pagina="error"]');
      await expect(aviso.getByRole('heading', { name: 'No pudimos cargar esta página' })).toBeVisible();
      await expect(aviso.getByRole('button', { name: 'Reintentar' })).toBeVisible();
      await expect(aviso.getByRole('link', { name: 'Ir al inicio' })).toBeVisible();
      // Sin detalles técnicos a la vista.
      await expect(page.locator('body')).not.toContainText(/supabase|fetch failed|ECONNREFUSED|stack|Application error/i);
    }
  });

  test('el panel no se rompe: lleva a «Ingresar» y avisa si no se puede entrar', async ({ page }) => {
    const r = await page.goto(`${CAIDO}/admin/articulos`);
    expect(r?.status()).toBe(200);
    await expect(page).toHaveURL(/\/admin\/ingresar/);
    await page.locator('form[data-listo]').first().waitFor();
    await page.getByLabel('Correo').fill('alguien@prueba.test');
    await page.getByLabel('Contraseña').fill('una-clave-cualquiera');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.locator('p[role=alert]')).toContainText('No pudimos conectar');
  });
});
