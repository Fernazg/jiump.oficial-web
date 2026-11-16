import { expect, test } from '@playwright/test';
import { crearUsuario, ingresar, type Usuario } from './apoyo-admin';

/**
 * Experiencia del panel para personas no técnicas: ayudas breves en cada
 * sección y aviso de carga al cambiar de sección.
 */
const u: Record<string, Usuario> = {};
test.beforeAll(async () => {
  u.super = await crearUsuario('Aurora Ayuda', ['superadmin']);
});

const AYUDAS: [string, RegExp][] = [
  ['/admin/articulos', /Vista previa.*obligatoria/s],
  ['/admin/eventos', /Solo el título y el año son obligatorios/],
  ['/admin/fotos', /texto alternativo es obligatorio/],
  ['/admin/galerias', /fotos de un solo evento/],
  ['/admin/videos', /dirección del video en YouTube/],
  ['/admin/usuarios', /primero la persona activa su doble factor/],
  ['/admin/configuracion', /Modo mantenimiento/],
  ['/admin/pagina-web', /queda pendiente/],
];

test('cada sección tiene una ayuda breve que se abre y se cierra, también con el teclado', async ({ page }) => {
  test.setTimeout(60_000);
  await ingresar(page, u.super);
  for (const [ruta, texto] of AYUDAS) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle'); // la página terminó de activarse
    const ayuda = page.locator('[data-ayuda]').first();
    const boton = ayuda.locator('summary');
    await expect(boton, ruta).toHaveText('¿Cómo funciona?');
    await expect(ayuda.locator('> div'), ruta).toBeHidden(); // cerrada: no estorba
    await boton.press('Enter');
    await expect(ayuda.locator('> div'), ruta).toBeVisible();
    await expect(ayuda, ruta).toContainText(texto);
    await boton.press('Enter');
    await expect(ayuda.locator('> div'), ruta).toBeHidden();
  }
});

test('la ayuda no menciona nada prohibido ni secciones eliminadas', async ({ page }) => {
  await ingresar(page, u.super);
  for (const [ruta] of AYUDAS) {
    await page.goto(ruta);
    await page.locator('[data-ayuda] summary').first().click();
    expect(await page.locator('[data-ayuda]').first().innerText(), ruta).not.toMatch(/ofrenda|donaci[oó]n|diezmo|podcast|directorio/i);
  }
});

test('al cambiar de sección con conexión lenta aparece «Cargando…» de inmediato', async ({ page }) => {
  await ingresar(page, u.super);
  await page.goto('/admin');
  // Conexión lenta simulada: la respuesta de la sección siguiente tarda 1,5 s.
  await page.route('**/admin/eventos**', async (ruta) => { await new Promise((r) => setTimeout(r, 1500)); await ruta.continue(); });
  await page.locator('nav[aria-label="Menú del panel"]').first().getByRole('link', { name: 'Eventos y actividades' }).click();
  await expect(page.locator('[data-cargando]')).toBeVisible({ timeout: 1200 });
  await expect(page.getByRole('heading', { level: 1, name: 'Eventos y actividades' })).toBeVisible();
  await expect(page.locator('[data-cargando]')).toHaveCount(0);
});

test('una sección sin permiso sigue respondiendo 403 y una dirección inexistente no rompe el panel', async ({ page }) => {
  const editor = await crearUsuario('Emilio Experiencia', ['editor']);
  await ingresar(page, editor);
  expect((await page.goto('/admin/usuarios'))?.status()).toBe(403);
  await expect(page.locator('[data-sin-permiso]')).toBeVisible();
  const r = await page.goto('/admin/articulos/00000000-0000-4000-8000-000000000000');
  expect(r?.status()).toBeLessThan(500);
});
