import { expect, test, type Page } from '@playwright/test';
import { admin } from './apoyo';
import { crearUsuario, ingresar, type Usuario } from './apoyo-admin';

/**
 * Administrar página web, menú y pie, e información institucional (solo
 * Superadmin): cambios pendientes que no cambian el sitio hasta revisar la
 * vista previa y publicar; ordenar, ocultar y editar secciones; retirar una
 * página (deja de verse y sale del menú). Al final se restaura todo como estaba.
 */
const marca = Date.now().toString(36);
const u: Record<string, Usuario> = {};

type Pagina = { id: string; clave: string; estado: string; seo_titulo: string | null; seo_descripcion: string | null };
type Seccion = { pagina_id: string; tipo: string; orden: number; visible: boolean; contenido: unknown };
let paginas: Pagina[] = [];
let secciones: Seccion[] = [];
let menu: unknown[] = [];

test.beforeAll(async () => {
  u.super = await crearUsuario('Sara Sitio', ['superadmin']);
  u.editor = await crearUsuario('Elías Sitio', ['editor']);
  u.eventos = await crearUsuario('Elena Sitio', ['eventos']);
  u.multimedia = await crearUsuario('Mateo Sitio', ['multimedia']);
  // Copia de lo publicado, para dejarlo igual al terminar.
  paginas = await admin<Pagina[]>('paginas?select=id,clave,estado,seo_titulo,seo_descripcion');
  secciones = await admin<Seccion[]>('secciones?select=pagina_id,tipo,orden,visible,contenido');
  menu = await admin('menu?select=ubicacion,etiqueta,url,orden,visible');
});

test.afterAll(async () => {
  // La service role no pasa por la protección de lo publicado (solo se usa en pruebas).
  await admin('contenido_cambios?tipo=in.(pagina,menu,institucional)', 'DELETE');
  await admin('vistas_previas_contenido?tipo=in.(pagina,menu,institucional)', 'DELETE');
  for (const p of paginas) {
    await admin(`paginas?id=eq.${p.id}`, 'PATCH', { estado: p.estado, seo_titulo: p.seo_titulo, seo_descripcion: p.seo_descripcion });
  }
  await admin('secciones?id=not.is.null', 'DELETE');
  await admin('secciones', 'POST', secciones);
  await admin('menu?id=not.is.null', 'DELETE');
  await admin('menu', 'POST', menu);
  await admin('institucional?id=not.is.null', 'DELETE');
});

const RUTAS = ['/admin/pagina-web', '/admin/pagina-web?pagina=nosotros', '/admin/pagina-web/inicio/vista-previa', '/admin/menu', '/admin/menu/vista-previa',
  '/admin/institucional', '/admin/institucional/vista-previa'];

test('solo el Superadministrador entra a Página web, Menú e Institucional (también por URL)', async ({ page }) => {
  for (const r of ['editor', 'eventos', 'multimedia']) {
    await ingresar(page, u[r]);
    await expect(page.getByRole('navigation', { name: 'Menú del panel' }).first().getByText('Administrar página web')).toHaveCount(0);
    for (const ruta of RUTAS) expect((await page.goto(ruta))?.status(), `${r} ${ruta}`).toBe(403);
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
  }
  await ingresar(page, u.super);
  for (const ruta of ['/admin/pagina-web', '/admin/menu', '/admin/institucional']) expect((await page.goto(ruta))?.status(), ruta).toBe(200);
});

async function guardar(page: Page, editor: string) {
  const antes = await page.locator(editor).getAttribute('data-version');
  await page.locator('[data-guardar]').click();
  await expect(page.locator(editor)).not.toHaveAttribute('data-version', antes!, { timeout: 15_000 });
  await page.locator(`${editor}[data-listo]`).waitFor();
}

test('Inicio: editar, ordenar y ocultar secciones queda pendiente hasta la vista previa y publicar', async ({ page }) => {
  const titulo = `Portada de prueba ${marca}`;
  await ingresar(page, u.super);
  await page.goto('/admin/pagina-web');
  await page.locator('[data-editor-pagina="inicio"][data-listo]').waitFor();
  await expect(page.locator('[data-estado-contenido]')).toHaveText('Publicada');

  // Portada: título nuevo
  await page.locator('[data-seccion="portada"] button').first().click();
  await page.getByLabel(/Título principal/).fill(titulo);
  // Ocultar «Momentos JIUMP» y subir «Artículos recientes» un lugar
  await page.locator('[data-seccion="momentos"] [data-alternar-visible]').click();
  await page.getByRole('button', { name: 'Subir Artículos recientes' }).click();
  await guardar(page, '[data-editor-pagina]');
  await expect(page.locator('[data-cambios-pendientes]')).toBeVisible();
  await expect(page.locator('[data-publicar-cambios]')).toBeDisabled();

  // El sitio no cambia todavía
  await page.goto('/');
  await expect(page.getByText(titulo)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Momentos JIUMP' })).toBeVisible();

  // Vista previa: ya se ve como quedará
  await page.goto('/admin/pagina-web/inicio/vista-previa');
  const previa = page.locator('[data-vista-previa-contenido]');
  await expect(previa.getByText(titulo)).toBeVisible();
  await expect(previa.getByRole('heading', { name: 'Momentos JIUMP' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Publicar los cambios' }).click();
  await expect(page).toHaveURL(/pagina=inicio&aviso=cambios-publicados/);

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(titulo);
  await expect(page.getByRole('heading', { name: 'Momentos JIUMP' })).toHaveCount(0);
  const tipos = await admin<{ tipo: string; visible: boolean }[]>(`secciones?pagina_id=eq.${paginas.find((p) => p.clave === 'inicio')!.id}&select=tipo,visible&order=orden`);
  const i = tipos.findIndex((s) => s.tipo === 'articulos_recientes');
  expect(tipos[i + 1]?.tipo).toBe('eventos');
  expect(tipos.find((s) => s.tipo === 'momentos')?.visible).toBe(false);
});

test('retirar una página: deja de verse y sale del menú; publicarla otra vez exige la vista previa', async ({ page }) => {
  await ingresar(page, u.super);
  await page.goto('/admin/pagina-web?pagina=galeria');
  await page.locator('[data-editor-pagina="galeria"][data-listo]').waitFor();
  await page.getByRole('button', { name: 'Retirar página' }).click();
  await page.getByRole('button', { name: 'Sí, despublicar' }).click();
  await expect(page).toHaveURL(/pagina=galeria&aviso=borrador/);
  await expect(page.locator('[data-estado-contenido]')).toHaveText('Sin publicar');

  const sitio = await page.request.get('/galeria');
  expect(sitio.status()).toBe(404);
  await page.goto('/articulos');
  await expect(page.locator('header').getByRole('link', { name: 'Galería' })).toHaveCount(0);

  await page.goto('/admin/pagina-web?pagina=galeria');
  await expect(page.locator('[data-publicar]')).toBeDisabled();
  await page.getByRole('button', { name: 'Vista previa' }).click();
  await expect(page).toHaveURL(/\/admin\/pagina-web\/galeria\/vista-previa/);
  await page.getByRole('button', { name: 'Publicar página' }).click();
  await expect(page).toHaveURL(/pagina=galeria&aviso=publicado/);
  expect((await page.request.get('/galeria')).status()).toBe(200);
});

test('menú y pie: los cambios se ven en el sitio solo después de publicarlos', async ({ page }) => {
  const etiqueta = `Enlace ${marca}`;
  await ingresar(page, u.super);
  await page.goto('/admin/menu');
  await page.locator('[data-editor-menu][data-listo]').waitFor();
  await page.locator('[data-agregar-enlace="pie"]').click();
  const fila = page.locator('[data-lugar="pie"] li').last();
  await fila.getByLabel('Texto').fill(etiqueta);
  await fila.getByLabel(/Lleva a/).fill('/articulos');
  await guardar(page, '[data-editor-menu]');

  await page.goto('/eventos');
  await expect(page.locator('footer').getByText(etiqueta)).toHaveCount(0);

  await page.goto('/admin/menu');
  await page.locator('[data-editor-menu][data-listo]').waitFor();
  await page.getByRole('button', { name: 'Vista previa' }).click();
  await expect(page.locator('footer').getByText(etiqueta)).toBeVisible();
  await page.getByRole('button', { name: 'Publicar los cambios' }).click();
  await expect(page).toHaveURL(/\/admin\/menu\?aviso=cambios-publicados/);
  await page.goto('/eventos');
  await expect(page.locator('footer').getByRole('link', { name: etiqueta })).toHaveAttribute('href', '/articulos');
});

test('información institucional: vacía hasta que JIUMP entregue los textos; se publica con vista previa', async ({ page }) => {
  const valor = `+${marca}`;
  await ingresar(page, u.super);
  await page.goto('/admin/institucional');
  await page.locator('[data-editor-institucional][data-listo]').waitFor();
  // Nada inventado: los campos parten vacíos.
  for (const t of ['identidad', 'quienes_somos', 'vision', 'historia']) {
    await expect(page.locator(`[data-texto-institucional="${t}"] input`)).toHaveValue('');
    await expect(page.locator(`[data-texto-institucional="${t}"] textarea`)).toHaveValue('');
  }
  await page.locator('[data-agregar="cifra"]').click();
  const cifra = page.locator('[data-lista-institucional="cifra"] [data-item="0"]');
  await cifra.getByLabel(/Valor/).fill(valor);
  await cifra.getByLabel(/Qué cuenta/).fill(`Dato de prueba ${marca}`);
  await guardar(page, '[data-editor-institucional]');

  await page.goto('/');
  await expect(page.getByText(valor)).toHaveCount(0);

  await page.goto('/admin/institucional/vista-previa');
  await expect(page.locator('[data-vista-previa-contenido]').getByText(valor)).toBeVisible();
  await page.getByRole('button', { name: 'Publicar los cambios' }).click();
  await expect(page).toHaveURL(/\/admin\/institucional\?aviso=cambios-publicados/);
  await page.goto('/');
  await expect(page.getByText(valor)).toBeVisible();
});
