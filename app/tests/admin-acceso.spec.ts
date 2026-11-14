import { expect, test } from '@playwright/test';
import { admin } from './apoyo';
import { codigoNuevo, crearUsuario, desactivar, enlaceRecuperacion, ingresar, listo, totp, type Usuario } from './apoyo-admin';

/**
 * Panel /admin: inicio de sesión, doble factor, cierre de sesión y permisos
 * por rol (en la interfaz y entrando por URL: el servidor responde 403).
 */
const u: Record<string, Usuario> = {};

test.beforeAll(async () => {
  u.super = await crearUsuario('Sara Super', ['superadmin']);
  u.editor = await crearUsuario('Elena Editora', ['editor']);
  u.eventos = await crearUsuario('Ernesto Eventos', ['eventos']);
  u.multimedia = await crearUsuario('Mara Multimedia', ['multimedia']);
  u.eventosMultimedia = await crearUsuario('Pía Dos Roles', ['eventos', 'multimedia']);
});

const SECCIONES_SOLO_SUPER = ['/admin/pagina-web', '/admin/institucional', '/admin/menu', '/admin/usuarios', '/admin/registro', '/admin/configuracion'];

test.describe('inicio de sesión', () => {
  test('sin sesión, todo /admin lleva a «Ingresar» (también el editor y la vista previa)', async ({ page, request }) => {
    for (const ruta of ['/admin', '/admin/articulos', '/admin/articulos/series', '/admin/usuarios']) {
      const r = await request.get(ruta, { maxRedirects: 0 });
      expect(r.status(), ruta).toBe(307);
      expect(r.headers().location).toContain('/admin/ingresar');
    }
    await page.goto('/admin/articulos');
    await expect(page).toHaveURL(/\/admin\/ingresar\?siguiente=%2Fadmin%2Farticulos/);
    await expect(page.getByRole('heading', { name: 'Ingresar al panel' })).toBeVisible();
    // Sin registro público
    await expect(page.getByText(/registr(ar|o) (una )?cuenta|crear cuenta/i)).toHaveCount(0);
    await expect(page.getByText('No hay registro público')).toBeVisible();
  });

  test('contraseña incorrecta: mensaje genérico', async ({ page }) => {
    await page.goto('/admin/ingresar');
    await listo(page);
    await page.getByLabel('Correo').fill(u.editor.correo);
    await page.getByLabel('Contraseña').fill('no-es-la-clave');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.locator('p[role=alert]')).toHaveText('El correo o la contraseña no son correctos.');
  });

  test('cerrar sesión corta el acceso al instante, también con las cookies anteriores', async ({ page, browser }) => {
    await ingresar(page, u.editor);
    const estado = await page.context().storageState();
    await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
    await expect(page).toHaveURL(/\/admin\/ingresar\?motivo=salida/);
    await expect(page.getByText('Cerraste sesión.')).toBeVisible();

    // Alguien que copió las cookies anteriores ya no entra.
    const otro = await browser.newContext({ storageState: estado });
    const p2 = await otro.newPage();
    await p2.goto('/admin/articulos');
    await expect(p2).toHaveURL(/\/admin\/ingresar/);
    await otro.close();
  });

  test('desactivar a una persona la saca del panel en su siguiente paso', async ({ page }) => {
    const temporal = await crearUsuario('Tomás Temporal', ['editor']);
    await ingresar(page, temporal);
    await expect(page.getByRole('heading', { name: /Hola, Tomás Temporal/ })).toBeVisible();
    await desactivar(temporal);
    await page.goto('/admin/articulos');
    await expect(page).toHaveURL(/\/admin\/ingresar\?.*motivo=inactivo/);
    await listo(page);
    // Y no puede volver a ingresar
    await page.getByLabel('Correo').fill(temporal.correo);
    await page.getByLabel('Contraseña').fill(temporal.clave);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.locator('p[role=alert]')).toContainText('desactivado');
  });

  test('recuperar la contraseña: mensaje genérico y enlace para crear una nueva', async ({ page }) => {
    const olvidadiza = await crearUsuario('Olga Olvido', ['editor']);
    await page.goto('/admin/ingresar');
    await listo(page);
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
    await expect(page).toHaveURL(/\/admin\/recuperar/);
    await listo(page);
    await page.getByLabel('Correo').fill('nadie-existe@prueba.test');
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByRole('status')).toContainText('Si ese correo tiene acceso al panel', { timeout: 20_000 });

    await page.goto(await enlaceRecuperacion(olvidadiza.correo));
    await expect(page).toHaveURL(/\/admin\/nueva-clave/);
    await listo(page);
    const nueva = `Nueva-${Date.now()}-clave`;
    await page.getByLabel('Contraseña nueva').fill(nueva);
    await page.getByLabel('Repite la contraseña').fill(nueva);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByText('Tu contraseña se actualizó.')).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
    await ingresar(page, { ...olvidadiza, clave: nueva });
    await expect(page.getByRole('heading', { name: /Hola, Olga Olvido/ })).toBeVisible();
  });
});

test.describe('doble factor', () => {
  test('Superadministrador: sin el código no entra; con el código sí', async ({ page }) => {
    await page.goto('/admin/ingresar');
    await listo(page);
    await page.getByLabel('Correo').fill(u.super.correo);
    await page.getByLabel('Contraseña').fill(u.super.clave);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/admin\/verificar/);
    await listo(page);

    // Sin verificar, ninguna sección: vuelve a pedir el código.
    await page.goto('/admin/usuarios');
    await expect(page).toHaveURL(/\/admin\/verificar/);
    await listo(page);

    await page.getByLabel('Código').fill(totp(u.super.secreto!, -5) === totp(u.super.secreto!) ? '000000' : totp(u.super.secreto!, -5));
    await page.getByRole('button', { name: 'Verificar' }).click();
    await expect(page.locator('p[role=alert]')).toContainText('El código no es correcto');

    await page.getByLabel('Código').fill(await codigoNuevo(u.super.secreto!));
    await page.getByRole('button', { name: 'Verificar' }).click();
    await expect(page).toHaveURL(/\/admin\/usuarios$/);
    await expect(page.locator('[data-proxima-etapa]')).toBeVisible();
  });

  test('Superadministrador sin factor: debe inscribirlo antes de entrar', async ({ page }) => {
    const nuevo = await crearUsuario('Samuel Sinfactor', ['superadmin'], { dobleFactor: false });
    await page.goto('/admin/ingresar');
    await listo(page);
    await page.getByLabel('Correo').fill(nuevo.correo);
    await page.getByLabel('Contraseña').fill(nuevo.clave);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/admin\/doble-factor/);
    await listo(page);
    await expect(page.getByText('Para Superadministrador es obligatorio')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ahora no' })).toHaveCount(0);

    await page.goto('/admin/articulos');
    await expect(page).toHaveURL(/\/admin\/doble-factor/);
    await listo(page);

    await page.getByText('¿No puedes escanear?').click();
    const secreto = (await page.locator('[data-secreto-totp]').innerText()).trim();
    await page.getByLabel('Código de la app').fill(await codigoNuevo(secreto));
    await page.getByRole('button', { name: 'Activar doble factor' }).click();
    await expect(page).toHaveURL(/\/admin\/cuenta\?doble-factor=activado/);
    // El rol se asignó ANTES del factor: la base no lo reconoce hasta reasignarlo.
    await page.goto('/admin');
    await expect(page.locator('[data-aviso-superadmin]')).toBeVisible();
    expect((await page.goto('/admin/usuarios'))?.status()).toBe(403);
  });

  test('opcional para Editor: lo activa desde «Mi cuenta» y desde entonces se le pide', async ({ page }) => {
    const ed = await crearUsuario('Edgar Opcional', ['editor']);
    await ingresar(page, ed);
    await page.getByRole('link', { name: 'Mi cuenta' }).first().click();
    await expect(page.locator('[data-doble-factor="inactivo"]')).toBeVisible();
    await page.getByRole('link', { name: 'Activar doble factor' }).click();
    await expect(page.getByText('Es opcional para tu rol')).toBeVisible();
    await listo(page);
    await page.getByText('¿No puedes escanear?').click();
    const secreto = (await page.locator('[data-secreto-totp]').innerText()).trim();
    await page.getByLabel('Código de la app').fill(await codigoNuevo(secreto));
    await page.getByRole('button', { name: 'Activar doble factor' }).click();
    await expect(page.locator('[data-doble-factor="activo"]')).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
    await ingresar(page, { ...ed, secreto });
    await expect(page.getByRole('heading', { name: /Hola, Edgar Opcional/ })).toBeVisible();
  });
});

test.describe('permisos por rol', () => {
  test('Editor: ve solo sus secciones y el resto da 403 entrando por URL', async ({ page }) => {
    await ingresar(page, u.editor);
    const menu = page.getByRole('navigation', { name: 'Menú del panel' }).first();
    await expect(menu.locator('[data-seccion]')).toHaveText([/Escritorio/, /Artículos/, /Series y categorías/, /Biblioteca de fotos/]);
    for (const ruta of ['/admin/eventos', ...SECCIONES_SOLO_SUPER, '/admin/galerias', '/admin/videos']) {
      const r = await page.goto(ruta);
      expect(r?.status(), ruta).toBe(403);
      await expect(page.locator('[data-sin-permiso]')).toBeVisible();
    }
    expect((await page.goto('/admin/articulos'))?.status()).toBe(200);
  });

  test('Eventos: sin Artículos (ni el listado, ni el editor, ni series)', async ({ page }) => {
    await ingresar(page, u.eventos);
    const menu = page.getByRole('navigation', { name: 'Menú del panel' }).first();
    await expect(menu.locator('[data-seccion]')).toHaveText([/Escritorio/, /Eventos y actividades/, /Biblioteca de fotos/]);
    const [a] = await admin<{ id: string }[]>('articulos?select=id&limit=1');
    for (const ruta of ['/admin/articulos', '/admin/articulos/series', `/admin/articulos/${a.id}`, `/admin/articulos/${a.id}/vista-previa`, ...SECCIONES_SOLO_SUPER]) {
      expect((await page.goto(ruta))?.status(), ruta).toBe(403);
    }
    expect((await page.goto('/admin/eventos'))?.status()).toBe(200);
  });

  test('Multimedia y una persona con dos roles ven la unión de sus secciones', async ({ page }) => {
    await ingresar(page, u.multimedia);
    const menu = page.getByRole('navigation', { name: 'Menú del panel' }).first();
    await expect(menu.locator('[data-seccion]')).toHaveText([/Escritorio/, /Biblioteca de fotos/, /Galerías y álbumes/, /Videos/]);
    expect((await page.goto('/admin/articulos'))?.status()).toBe(403);
    expect((await page.goto('/admin/eventos'))?.status()).toBe(403);
    await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();

    await ingresar(page, u.eventosMultimedia);
    await expect(page.getByRole('navigation', { name: 'Menú del panel' }).first().locator('[data-seccion]'))
      .toHaveText([/Escritorio/, /Eventos y actividades/, /Biblioteca de fotos/, /Galerías y álbumes/, /Videos/]);
    await expect(page.getByText('Rol: Eventos · Multimedia')).toBeVisible();
  });

  test('Superadministrador ve todas las secciones', async ({ page }) => {
    await ingresar(page, u.super);
    await expect(page.getByRole('navigation', { name: 'Menú del panel' }).first().locator('[data-seccion]')).toHaveCount(13);
    for (const ruta of ['/admin/articulos', '/admin/eventos', ...SECCIONES_SOLO_SUPER]) {
      expect((await page.goto(ruta))?.status(), ruta).toBe(200);
    }
  });

  test('una acción del servidor enviada sin permiso responde 403 y no cambia nada', async ({ page }) => {
    // Eventos envía a mano una acción del servidor a la página de Artículos.
    await ingresar(page, u.eventos);
    const antes = (await admin<unknown[]>('articulos?select=id')).length;
    const r = await page.request.post('/admin/articulos', { headers: { 'Next-Action': '7f'.padEnd(42, '0') }, data: '[]', maxRedirects: 0 });
    expect(r.status()).toBe(403);
    expect((await admin<unknown[]>('articulos?select=id')).length).toBe(antes);
  });
});

test.describe('celular', () => {
  test('el panel se adapta: menú ☰ con enlaces de 52 px y sin desborde horizontal @celular', async ({ page }) => {
    await ingresar(page, u.editor);
    await expect(page.getByRole('button', { name: 'Abrir menú del panel' })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir menú del panel' }).click();
    const enlace = page.locator('#menu-panel-movil [data-seccion="articulos"]');
    await expect(enlace).toBeVisible();
    expect((await enlace.boundingBox())!.height).toBeGreaterThanOrEqual(52);
    await enlace.click();
    await expect(page).toHaveURL(/\/admin\/articulos$/);
    for (const ruta of ['/admin', '/admin/articulos', '/admin/articulos/series', '/admin/cuenta']) {
      await page.goto(ruta);
      const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(ancho, ruta).toBeLessThanOrEqual(0);
    }
  });
});
