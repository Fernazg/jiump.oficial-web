import { expect, test, type Page } from '@playwright/test';
import { admin } from './apoyo';
import { crearUsuario, ingresar, type Usuario } from './apoyo-admin';

/**
 * Seguridad en el navegador: cabeceras, política de contenido (CSP), cierre de
 * sesión por enlace, redirecciones y columnas que ve el visitante.
 */
const u: Record<string, Usuario> = {};
test.beforeAll(async () => {
  u.super = await crearUsuario('Selma Seguridad', ['superadmin']);
  u.multimedia = await crearUsuario('Mateo Seguridad', ['multimedia']);
});

/** Junta lo que el navegador bloquea por la política de contenido. */
function vigilarCsp(page: Page): string[] {
  const bloqueos: string[] = [];
  page.on('console', (m) => { if (/Content Security Policy|Content-Security-Policy/i.test(m.text())) bloqueos.push(m.text()); });
  page.on('pageerror', (e) => bloqueos.push(e.message));
  return bloqueos;
}

test('todas las respuestas llevan las cabeceras de seguridad', async ({ request }) => {
  for (const ruta of ['/', '/articulos/como-comenzo-la-biblia', '/admin/ingresar', '/marca/logo-jiump.png', '/no-existe']) {
    const h = (await request.get(ruta)).headers();
    expect(h['x-content-type-options'], ruta).toBe('nosniff');
    expect(h['x-frame-options'], ruta).toBe('DENY');
    expect(h['referrer-policy'], ruta).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy'], ruta).toContain('geolocation=()');
    expect(h['strict-transport-security'], ruta).toContain('max-age=31536000');
    expect(h['x-powered-by'], ruta).toBeUndefined();
  }
});

test('la política de contenido usa un valor distinto en cada visita y no permite scripts en línea', async ({ request }) => {
  const csp = async (ruta: string) => (await request.get(ruta)).headers()['content-security-policy'];
  const a = await csp('/');
  const b = await csp('/');
  const nonce = (x: string) => x.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce(a)).toBeTruthy();
  expect(nonce(a)).not.toBe(nonce(b));
  expect(a).toContain("frame-ancestors 'none'");
  expect(a).toContain("object-src 'none'");
  expect(a).toContain("form-action 'self'");
  const scripts = a.match(/script-src [^;]+/)![0];
  expect(scripts).not.toContain("'unsafe-inline'");
  expect(scripts).not.toContain("'unsafe-eval'");
  // WebAssembly solo en el panel (optimiza las fotos al subirlas).
  expect(scripts).not.toContain('wasm-unsafe-eval');
  expect((await csp('/admin/ingresar')).match(/script-src [^;]+/)![0]).toContain("'wasm-unsafe-eval'");
  // También la página 404 y la de mantenimiento salen con la política.
  expect(await csp('/no-existe')).toContain("frame-ancestors 'none'");
});

test('código inyectado en el HTML (un atributo onerror) no se ejecuta', async ({ page }) => {
  await page.goto('/');
  // Así se vería una inyección en un texto del sitio: una imagen rota con código en «onerror».
  const ejecutado = await page.evaluate(() => new Promise<boolean>((resolver) => {
    document.addEventListener('securitypolicyviolation', () => resolver(false), { once: true });
    const caja = document.createElement('div');
    caja.innerHTML = '<img src="/no-existe.png" onerror="window.__inyectado = true">';
    document.body.appendChild(caja);
    setTimeout(() => resolver((window as unknown as { __inyectado?: boolean }).__inyectado === true), 1500);
  }));
  expect(ejecutado).toBe(false);
});

test('el sitio público funciona completo con la política de contenido (fotos, menú, video)', async ({ page }) => {
  const bloqueos = vigilarCsp(page);
  for (const ruta of ['/', '/nosotros', '/eventos', '/eventos/convencion-nacional-2026', '/articulos', '/articulos/como-comenzo-la-biblia', '/galeria', '/no-existe']) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
  }
  // Las fotos firmadas cargan (la política permite el almacenamiento de Supabase).
  await page.goto('/eventos/convencion-nacional-2026');
  const foto = page.locator('main img').first();
  await expect(foto).toBeVisible();
  expect(await foto.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  expect(bloqueos).toEqual([]);
});

test('el panel funciona completo con la política de contenido (también al subir fotos)', async ({ page }) => {
  const bloqueos = vigilarCsp(page);
  await ingresar(page, u.super);
  for (const ruta of ['/admin', '/admin/articulos', '/admin/eventos', '/admin/fotos', '/admin/galerias', '/admin/pagina-web', '/admin/usuarios', '/admin/configuracion', '/admin/cuenta']) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
  }
  expect(bloqueos).toEqual([]);
});

test('abrir /admin/salir como enlace no cierra la sesión de quien tiene su acceso al día', async ({ page }) => {
  await ingresar(page, u.multimedia);
  // Un enlace o una imagen en otra página provoca un GET; no debe sacar a la persona del panel.
  await page.goto('/admin/salir');
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/salir?motivo=inactivo');
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/galerias');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // El botón «Cerrar sesión» (POST) sigue funcionando.
  await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
  await expect(page).toHaveURL(/\/admin\/ingresar\?motivo=salida/);
});

test('redirecciones: un destino «//otro-sitio» se rechaza en el panel y en la base', async ({ page }) => {
  await ingresar(page, u.super);
  await page.goto('/admin/configuracion');
  const form = page.locator('form#nueva-redireccion[data-listo]');
  const origen = `/seguridad-${Date.now().toString(36)}`;
  for (const destino of ['//otro-sitio.example', '/\\otro-sitio.example']) {
    await form.getByLabel('Dirección antigua').fill(origen);
    await form.getByLabel(/Lleva a/).fill(destino);
    await form.getByRole('button', { name: 'Agregar' }).click();
    await expect(form.locator('p[role=alert]')).toContainText('El destino debe empezar con /');
  }
  expect(await admin<unknown[]>(`redirecciones?origen=eq.${origen}&select=id`)).toEqual([]);
});

test('el visitante no puede pedir columnas internas con la clave pública', async ({ request }) => {
  const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const clave = process.env.SUPABASE_ANON_KEY ?? '';
  const pedir = (consulta: string) => request.get(`${url}/rest/v1/${consulta}`, { headers: { apikey: clave, Authorization: `Bearer ${clave}` } });
  for (const consulta of ['articulos?select=creado_por', 'articulos?select=*', 'fotos?select=actualizado_por', 'actividades?select=*']) {
    expect((await pedir(consulta)).status(), consulta).toBe(401);
  }
  const ok = await pedir('articulos?select=titulo,slug&limit=1');
  expect(ok.status()).toBe(200);
});
