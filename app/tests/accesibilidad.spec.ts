import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { admin } from './apoyo';
import { crearUsuario, ingresar, type Usuario } from './apoyo-admin';

/**
 * Accesibilidad (WCAG 2.2 AA): revisión automática con axe-core de todas las
 * páginas del sitio y del panel, en escritorio y en celular, más el uso con
 * teclado (saltar al contenido, menú, visor de fotos y foco siempre visible).
 */
const REGLAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

const SITIO = [
  '/', '/nosotros', '/eventos', '/eventos/convencion-nacional-2026', '/articulos', '/articulos?q=biblia', '/articulos?q=zzzz',
  '/articulos/como-comenzo-la-biblia', '/articulos/la-chispa-que-encendio-europa', '/galeria', '/no-existe', '/mantenimiento',
  '/admin/ingresar', '/admin/recuperar',
];

async function revisar(page: Page, ruta: string) {
  await page.goto(ruta);
  await page.waitForLoadState('networkidle');
  const r = await new AxeBuilder({ page })
    .withTags(REGLAS)
    .analyze();
  const problemas = r.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`));
  expect(problemas, `Problemas de accesibilidad en ${ruta}`).toEqual([]);
}

const u: Record<string, Usuario> = {};
test.beforeAll(async () => {
  u.super = await crearUsuario('Alba Accesible', ['superadmin']);
});

async function rutasDelPanel(): Promise<string[]> {
  const [[articulo], [actividad], [album]] = await Promise.all([
    admin<{ id: string }[]>('articulos?select=id&limit=1'),
    admin<{ id: string }[]>('actividades?select=id&limit=1'),
    admin<{ id: string }[]>('albumes?select=id&limit=1'),
  ]);
  return [
    '/admin', '/admin/articulos', `/admin/articulos/${articulo.id}`, '/admin/articulos/series', '/admin/eventos', `/admin/eventos/${actividad.id}`,
    '/admin/fotos', '/admin/galerias', `/admin/galerias/${album.id}`, '/admin/videos', '/admin/videos/nuevo', '/admin/pagina-web',
    '/admin/institucional', '/admin/menu', '/admin/usuarios', '/admin/usuarios/invitar', '/admin/registro', '/admin/configuracion', '/admin/cuenta',
  ];
}

test.describe('revisión automática (axe)', () => {
  for (const ruta of SITIO) {
    test(`sitio ${ruta}`, async ({ page }) => revisar(page, ruta));
    test(`sitio ${ruta} @celular`, async ({ page }) => revisar(page, ruta));
  }
  for (const etiqueta of ['', ' @celular']) {
    test(`panel: todas las secciones${etiqueta}`, async ({ page }) => {
      test.setTimeout(90_000);
      await ingresar(page, u.super);
      for (const ruta of await rutasDelPanel()) await revisar(page, ruta);
    });
  }
});

test.describe('uso con teclado', () => {
  test('la primera tecla Tab muestra «Saltar al contenido», en el sitio y en el panel', async ({ page }) => {
    await page.goto('/articulos');
    await page.keyboard.press('Tab');
    const saltar = page.getByRole('link', { name: 'Saltar al contenido' });
    await expect(saltar).toBeFocused();
    await expect(saltar).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#contenido$/);

    await ingresar(page, u.super);
    await page.goto('/admin/articulos');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  });

  test('el foco nunca queda tapado por el encabezado fijo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // desplazamiento inmediato, para medir sin esperar la animación
    await page.goto('/articulos/como-comenzo-la-biblia');
    // Baja hasta el final y vuelve hacia arriba con Mayús+Tab: cada elemento enfocado debe verse completo.
    await page.keyboard.press('End');
    await page.locator('footer a').last().focus();
    const bordeEncabezado = await page.locator('header').first().evaluate((h) => h.getBoundingClientRect().bottom);
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Shift+Tab');
      const arriba = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement | null;
        // El propio encabezado y el enlace «Saltar al contenido» (fijo, por encima de todo) no cuentan.
        if (!e || e === document.body || e.closest('header') || getComputedStyle(e).position === 'fixed') return null;
        return e.getBoundingClientRect().top;
      });
      if (arriba !== null) expect(arriba, `elemento ${i} tapado por el encabezado`).toBeGreaterThanOrEqual(bordeEncabezado - 1);
    }
  });

  test('las anclas del índice del artículo dejan el título a la vista', async ({ page }) => {
    await page.goto('/articulos/como-comenzo-la-biblia');
    const enlace = page.locator('a[href^="#"]').filter({ hasNotText: 'Saltar' }).first();
    const destino = (await enlace.getAttribute('href'))!;
    await enlace.click();
    await page.waitForTimeout(600);
    const titulo = page.locator(`[id="${destino.slice(1)}"]`);
    await expect(titulo).toBeInViewport();
    const bordeEncabezado = await page.locator('header').first().evaluate((h) => h.getBoundingClientRect().bottom);
    expect(await titulo.evaluate((t) => t.getBoundingClientRect().top)).toBeGreaterThanOrEqual(bordeEncabezado);
  });

  test('visor de fotos: se abre con Enter, se recorre con las flechas, se cierra con Escape y el foco vuelve a la foto', async ({ page }) => {
    await page.goto('/galeria/convencion-nacional-2026');
    const primera = page.getByRole('button', { name: /Ver en pantalla completa/ }).first();
    await primera.focus();
    await page.keyboard.press('Enter');
    const visor = page.getByRole('dialog', { name: 'Visor de fotos' });
    await expect(visor).toBeVisible();
    await expect(visor).toContainText(/Foto 1\s*\/?\s*de/);
    await page.keyboard.press('ArrowRight');
    await expect(visor).toContainText(/Foto 2\s*\/?\s*de/);
    await page.keyboard.press('Escape');
    await expect(visor).toBeHidden();
    await expect(primera).toBeFocused();
  });

  test('menú del celular: se abre y se cierra con el teclado @celular', async ({ page }) => {
    await page.goto('/');
    const boton = page.getByRole('button', { name: 'Abrir menú' });
    await boton.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#menu-movil')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-movil')).toBeHidden();
  });

  test('el enlace a Instagram avisa que abre otra pestaña', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Instagram.*se abre en una pestaña nueva/ })).toBeVisible();
  });
});

test('la página se puede leer a 320 px de ancho sin desplazarse a los lados', async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 320, height: 640 } });
  const page = await contexto.newPage();
  for (const ruta of ['/', '/nosotros', '/eventos', '/eventos/convencion-nacional-2026', '/articulos', '/articulos/como-comenzo-la-biblia', '/galeria', '/admin/ingresar']) {
    await page.goto(ruta);
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde, ruta).toBeLessThanOrEqual(0);
  }
  await contexto.close();
});
