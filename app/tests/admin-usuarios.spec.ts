import { expect, test } from '@playwright/test';
import { admin } from './apoyo';
import { crearUsuario, ingresar, type Usuario } from './apoyo-admin';

/**
 * Usuarios y roles, Registro de actividad y Configuración (solo Superadmin):
 * invitar por correo (Mailpit local), asignar y quitar roles con las reglas
 * de la base, desactivar (corta la sesión al instante), modo mantenimiento y
 * redirecciones desde Wix.
 */
const MAILPIT = 'http://127.0.0.1:54324';
const marca = Date.now().toString(36);
const u: Record<string, Usuario> = {};
const invitado = { nombre: `Inés Invitada ${marca}`, correo: `ines-${marca}@prueba.test` };
const origenWix = `/post/prueba-${marca}`;

test.beforeAll(async () => {
  u.super = await crearUsuario('Sofía Usuarios', ['superadmin']);
  u.editor = await crearUsuario('Esteban Usuarios', ['editor']);
  u.eventos = await crearUsuario('Elsa Usuarios', ['eventos']);
  u.multimedia = await crearUsuario('Marcos Usuarios', ['multimedia']);
});

test.afterAll(async () => {
  await admin('configuracion?id=eq.true', 'PATCH', { modo_mantenimiento: false });
  await admin(`redirecciones?origen=eq.${encodeURIComponent(origenWix)}`, 'DELETE');
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' }).catch(() => undefined);
  // La cuenta invitada (@prueba.test) la borra la limpieza global.
});

const RUTAS = ['/admin/usuarios', '/admin/usuarios/invitar', '/admin/registro', '/admin/configuracion'];

test('solo el Superadministrador entra a Usuarios, Registro y Configuración (también por URL)', async ({ page }) => {
  const [perfil] = await admin<{ id: string }[]>(`perfiles?user_id=eq.${u.super.id}&select=id`);
  for (const r of ['editor', 'eventos', 'multimedia']) {
    await ingresar(page, u[r]);
    for (const ruta of [...RUTAS, `/admin/usuarios/${perfil.id}`]) expect((await page.goto(ruta))?.status(), `${r} ${ruta}`).toBe(403);
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
  }
});

async function enlaceInvitacion(correo: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const r = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${correo}`)}`)).json() as { messages: { ID: string }[] };
    if (r.messages?.length) {
      const m = await (await fetch(`${MAILPIT}/api/v1/message/${r.messages[0].ID}`)).json() as { HTML: string; Text: string };
      const enlace = /href="([^"]+)"/.exec(m.HTML)?.[1] ?? /(http\S+verify\S+)/.exec(m.Text)?.[1];
      if (enlace) return enlace.replace(/&amp;/g, '&');
    }
    await new Promise((x) => setTimeout(x, 500));
  }
  throw new Error(`No llegó la invitación a ${correo}`);
}

test('invitar por correo: la persona crea su contraseña y entra con los roles asignados', async ({ page, browser }) => {
  await ingresar(page, u.super);
  await page.goto('/admin/usuarios');
  await page.getByRole('link', { name: '+ Invitar usuario' }).click();
  await page.locator('form#invitar[data-listo]').waitFor();
  await expect(page.getByRole('checkbox', { name: /Superadministrador/ })).toHaveCount(0); // primero debe inscribir su doble factor
  await page.getByLabel('Nombre').fill(invitado.nombre);
  await page.getByLabel('Correo').fill(invitado.correo);
  await page.getByRole('checkbox', { name: /Editor/ }).check();
  await page.getByRole('button', { name: 'Enviar invitación' }).click();
  await expect(page).toHaveURL(/\/admin\/usuarios\?aviso=invitado/);
  const fila = page.locator(`[data-usuario="${invitado.correo}"]`);
  await expect(fila.getByText('Invitación pendiente')).toBeVisible();
  await expect(fila.locator('[data-rol="editor"]')).toBeVisible();

  // La persona abre el enlace del correo en su propio navegador.
  const enlace = await enlaceInvitacion(invitado.correo);
  const contexto = await browser.newContext();
  const nueva = await contexto.newPage();
  await nueva.goto(enlace);
  await expect(nueva).toHaveURL(/\/admin\/nueva-clave/, { timeout: 15_000 });
  await nueva.locator('form[data-listo]').waitFor();
  const clave = `Clave-${marca}-segura`;
  await nueva.getByLabel('Contraseña nueva').fill(clave);
  await nueva.getByLabel('Repite la contraseña').fill(clave);
  await nueva.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(nueva).toHaveURL(/\/admin(\?|$)/);
  await expect(nueva.getByRole('navigation', { name: 'Menú del panel' }).first().getByText('Artículos')).toBeVisible();
  expect((await nueva.goto('/admin/usuarios'))?.status()).toBe(403);
  await contexto.close();

  await page.reload();
  await expect(fila.getByText('Invitación pendiente')).toHaveCount(0);
});

test('roles: asignar y quitar; Superadministrador exige doble factor; desactivar corta la sesión', async ({ page, browser }) => {
  const persona = await crearUsuario('Pablo Roles', ['editor']);
  const [perfil] = await admin<{ id: string }[]>(`perfiles?user_id=eq.${persona.id}&select=id`);

  // La persona está trabajando en el panel.
  const contexto = await browser.newContext();
  const suya = await contexto.newPage();
  await ingresar(suya, persona);
  expect((await suya.goto('/admin/eventos'))?.status()).toBe(403);

  await ingresar(page, u.super);
  await page.goto(`/admin/usuarios/${perfil.id}`);
  // Sin doble factor no se puede hacer Superadministrador.
  await expect(page.locator('[data-asignar="superadmin"]')).toBeDisabled();
  await expect(page.getByText('Primero debe inscribir su doble factor')).toBeVisible();

  await page.locator('[data-asignar="eventos"]').click();
  await expect(page).toHaveURL(/aviso=rol-asignado/);
  await expect(page.locator('[data-rol-fila="eventos"]')).toHaveAttribute('data-tiene', 'true');
  expect((await suya.goto('/admin/eventos'))?.status()).toBe(200);

  await page.locator('[data-rol-fila="editor"]').getByRole('button', { name: 'Quitar' }).click();
  await page.getByRole('button', { name: 'Sí, quitar' }).click();
  await expect(page).toHaveURL(/aviso=rol-quitado/);
  expect((await suya.goto('/admin/articulos'))?.status()).toBe(403);
  const roles = await admin<{ rol: string }[]>(`perfil_roles?perfil_id=eq.${perfil.id}&select=rol`);
  expect(roles.map((r) => r.rol)).toEqual(['eventos']);

  // No se puede desactivar a uno mismo.
  const [mio] = await admin<{ id: string }[]>(`perfiles?user_id=eq.${u.super.id}&select=id`);
  await page.goto(`/admin/usuarios/${mio.id}`);
  await expect(page.getByText('No puedes desactivarte a ti mismo.')).toBeVisible();
  await expect(page.locator('[data-rol-fila="superadmin"] button')).toHaveCount(0);
  await expect(page.getByText('Pídeselo a otro Superadministrador.')).toBeVisible();

  // Desactivar: su sesión se corta al instante.
  await page.goto(`/admin/usuarios/${perfil.id}`);
  await page.getByRole('button', { name: 'Desactivar' }).click();
  await page.getByRole('button', { name: 'Sí, desactivar' }).click();
  await expect(page).toHaveURL(/aviso=desactivado/);
  await suya.goto('/admin/eventos');
  await expect(suya).toHaveURL(/\/admin\/ingresar/);
  await contexto.close();

  await page.getByRole('button', { name: 'Reactivar' }).click();
  await page.getByRole('button', { name: 'Sí, reactivar' }).click();
  await expect(page).toHaveURL(/aviso=reactivado/);

  // Todo queda en el registro de actividad (solo lectura, con filtros).
  await page.goto(`/admin/registro?accion=quitar_rol`);
  await expect(page.locator('[data-lista-registro] [data-registro]').first()).toContainText('Sofía Usuarios quitó el rol «editor»');
  await expect(page.locator('[data-lista-registro] [data-registro]:not([data-registro="quitar_rol"])')).toHaveCount(0);
});

test('modo mantenimiento: el sitio responde 503 y el panel sigue funcionando', async ({ page }) => {
  await ingresar(page, u.super);
  await page.goto('/admin/configuracion');
  await page.getByRole('button', { name: 'Activar mantenimiento' }).click();
  await page.getByRole('button', { name: 'Sí, activar' }).click();
  await expect(page).toHaveURL(/aviso=mantenimiento-on/);
  await expect(page.locator('[data-mantenimiento="activo"]')).toBeVisible();

  const r = await page.request.get('/eventos');
  expect(r.status()).toBe(503);
  expect(await r.text()).toContain('Estamos mejorando nuestro sitio');
  expect((await page.goto('/admin/articulos'))?.status()).toBe(200);

  await page.goto('/admin/configuracion');
  await page.locator('[data-apagar-mantenimiento]').click();
  await expect(page).toHaveURL(/aviso=mantenimiento-off/);
  expect((await page.request.get('/eventos')).status()).toBe(200);
});

test('redirecciones desde las URL antiguas de Wix', async ({ page }) => {
  await ingresar(page, u.super);
  await page.goto('/admin/configuracion');
  const form = page.locator('form#nueva-redireccion[data-listo]');
  await form.getByLabel('Dirección antigua').fill(`https://www.jiump.cl${origenWix}`);
  await form.getByLabel(/Lleva a/).fill('/articulos');
  await form.getByRole('button', { name: 'Agregar' }).click();
  await expect(page).toHaveURL(/aviso=redireccion/);
  await expect(page.locator(`[data-redireccion="${origenWix}"]`)).toBeVisible();

  const r = await page.request.get(origenWix, { maxRedirects: 0 });
  expect(r.status()).toBe(301);
  expect(r.headers().location).toMatch(/\/articulos$/);

  await page.getByRole('button', { name: `Eliminar redirección ${origenWix}` }).click();
  await page.getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page).toHaveURL(/aviso=redireccion-eliminada/);
  expect((await page.request.get(origenWix, { maxRedirects: 0 })).status()).toBe(404);
});
