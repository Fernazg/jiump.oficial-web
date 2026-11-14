import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { admin } from './apoyo';
import { borrarFotosDe, crearUsuario, ingresar, listarArchivos, type Usuario } from './apoyo-admin';

/**
 * Biblioteca de fotos: subir (arrastrando o eligiendo), optimizar, texto
 * alternativo obligatorio, buscar y filtrar, dónde se usa cada foto,
 * permisos ◐ por rol y eliminar con confirmación. Solo fotos reales de JIUMP
 * (design/fotos); todo se borra al terminar.
 */
const FOTO = (n: string) => fileURLToPath(new URL(`../../design/fotos/${n}`, import.meta.url));
const FOTO_A = FOTO('784625ac3ebfe474ed6261cca016b8df.jpg');
const FOTO_B = FOTO('25b550f1411f6c261cc0d42a3945ea92.jpg');
const marca = Date.now().toString(36);
const u: Record<string, Usuario> = {};

test.beforeAll(async () => {
  u.editor = await crearUsuario('Elsa Fotos', ['editor']);
  u.eventos = await crearUsuario('Evaristo Fotos', ['eventos']);
  u.multimedia = await crearUsuario('Matilde Fotos', ['multimedia']);
});

test.afterAll(async () => {
  if (process.env.CONSERVAR) return;
  await admin(`articulos?titulo=like.*${marca}*`, 'DELETE');
  for (const x of Object.values(u)) await borrarFotosDe(x);
});

type FilaFoto = { id: string; archivo: string; anchos: number[]; texto_alternativo: string; credito: string | null; creado_por: string };
const fotosDe = (x: Usuario) => admin<FilaFoto[]>(`fotos?creado_por=eq.${x.id}&select=id,archivo,anchos,texto_alternativo,credito,creado_por&order=creado_en`);

async function listoSubidor(page: Page) {
  await page.locator('[data-subidor][data-listo]').first().waitFor();
}

async function subir(page: Page, rutas: string[], alts: string[]) {
  await listoSubidor(page);
  await page.getByLabel('Elegir fotos para subir').setInputFiles(rutas);
  const pendientes = page.locator('[data-por-subir] [data-pendiente]');
  await expect(pendientes).toHaveCount(rutas.length);
  for (let i = 0; i < alts.length; i++) await pendientes.nth(i).getByLabel('Texto alternativo (obligatorio)').fill(alts[i]);
}

test('subir fotos: texto alternativo obligatorio, se optimizan en WebP y AVIF sin tocar el original', async ({ page }) => {
  await ingresar(page, u.editor);
  await page.goto('/admin/fotos');
  await subir(page, [FOTO_A, FOTO_B], [`Escenario de prueba ${marca}`]);
  // Falta el texto alternativo de la segunda: no se puede subir
  await expect(page.locator('[data-subir-fotos]')).toBeDisabled();
  await page.locator('[data-por-subir] [data-pendiente]').nth(1).getByLabel('Texto alternativo (obligatorio)').fill(`Jóvenes adorando ${marca}`);
  await page.locator('[data-por-subir] [data-pendiente]').nth(1).getByLabel('Crédito (opcional)').fill('Equipo Multimedia JIUMP');
  await page.locator('[data-subir-fotos]').click();
  await expect(page.locator('[data-aviso-subida]')).toHaveText('2 fotos subidas y optimizadas.', { timeout: 60_000 });

  const fotos = await fotosDe(u.editor);
  expect(fotos).toHaveLength(2);
  expect(fotos[1].credito).toBe('Equipo Multimedia JIUMP');
  for (const f of fotos) {
    expect(f.archivo.startsWith(`${u.editor.id}/`)).toBe(true); // en su propia carpeta
    expect(f.anchos).toEqual([480, 960, 1600]);
  }
  const archivos = await listarArchivos(u.editor.id);
  const base = fotos[0].archivo.replace(/\.jpg$/, '');
  expect(archivos.sort()).toEqual(expect.arrayContaining([
    fotos[0].archivo, `${base}/480.webp`, `${base}/480.avif`, `${base}/960.webp`, `${base}/960.avif`, `${base}/1600.webp`, `${base}/1600.avif`,
  ]));
  // El original se guarda sin cambios (mismo tamaño en bytes)
  const r = await page.request.get(`/admin/fotos?q=${marca}`);
  expect(r.status()).toBe(200);
  const original = readFileSync(FOTO_A);
  const { data } = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/info/fotos/${fotos[0].archivo}`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  }).then(async (x) => ({ data: (await x.json()) as { size: number } }));
  expect(data.size).toBe(original.length);

  // Buscar y filtrar
  await page.goto(`/admin/fotos?q=${encodeURIComponent(`Escenario de prueba ${marca}`)}`);
  await expect(page.locator('[data-lista-fotos] [data-foto]')).toHaveCount(1);
  await page.goto('/admin/fotos?filtro=mias');
  await expect(page.locator('[data-lista-fotos] [data-foto]')).toHaveCount(2);
});

test('archivos no válidos: más de 10 MB, o que no son imágenes', async ({ page }) => {
  await ingresar(page, u.eventos);
  await page.goto('/admin/fotos');
  await listoSubidor(page);
  await page.getByLabel('Elegir fotos para subir').setInputFiles({ name: 'enorme.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(11 * 1024 * 1024, 1) });
  await expect(page.locator('[data-subidor] [role=alert]')).toContainText('pesa más de 10 MB');
  await page.getByLabel('Elegir fotos para subir').setInputFiles({ name: 'falsa.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('esto no es una imagen') });
  await page.locator('[data-por-subir] [data-pendiente]').getByLabel('Texto alternativo (obligatorio)').fill('No es una foto');
  await page.locator('[data-subir-fotos]').click();
  await expect(page.locator('[data-por-subir]')).toContainText('no es una imagen válida');
  expect(await fotosDe(u.eventos)).toHaveLength(0);
});

test('permisos ◐: Editor y Eventos solo editan o borran sus fotos; Multimedia, todas', async ({ page }) => {
  // Eventos sube una foto propia
  await ingresar(page, u.eventos);
  await page.goto('/admin/fotos');
  await subir(page, [FOTO_A], [`Foto de Evaristo ${marca}`]);
  await page.locator('[data-subir-fotos]').click();
  await expect(page.locator('[data-aviso-subida]')).toBeVisible({ timeout: 60_000 });
  const [propia] = await fotosDe(u.eventos);

  // Una foto del diseño (no la subió él): solo lectura
  const [ajena] = await admin<{ id: string }[]>('fotos?creado_por=is.null&select=id&limit=1');
  await page.goto(`/admin/fotos?foto=${ajena.id}`);
  await expect(page.locator('[data-detalle-foto] [data-solo-lectura]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Eliminar foto' })).toHaveCount(0);

  // La suya sí la edita
  await page.goto(`/admin/fotos?foto=${propia.id}`);
  const detalle = page.locator('[data-detalle-foto]');
  await detalle.getByLabel('Crédito (opcional)').fill('Crédito editado');
  await detalle.getByRole('button', { name: 'Guardar' }).click();
  await expect(detalle.getByRole('status')).toHaveText('Foto guardada.');
  expect((await fotosDe(u.eventos))[0].credito).toBe('Crédito editado');
  await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();

  // Multimedia edita la foto de otra persona
  await ingresar(page, u.multimedia);
  await page.goto(`/admin/fotos?foto=${propia.id}`);
  await expect(page.locator('[data-detalle-foto] [data-solo-lectura]')).toHaveCount(0);
  await page.locator('[data-detalle-foto]').getByLabel('Texto alternativo (obligatorio, para accesibilidad)').fill(`Descripción corregida ${marca}`);
  await page.locator('[data-detalle-foto]').getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('[data-detalle-foto]').getByRole('status')).toHaveText('Foto guardada.');
  expect((await fotosDe(u.eventos))[0].texto_alternativo).toBe(`Descripción corregida ${marca}`);
});

test('dónde se usa cada foto, y eliminar pide confirmación y avisa si está en uso', async ({ page }) => {
  await ingresar(page, u.multimedia);
  // Portada de un artículo publicado del diseño
  const [art] = await admin<{ portada_foto_id: string; titulo: string }[]>('articulos?slug=eq.por-que-fue-necesaria-la-reforma&select=portada_foto_id,titulo');
  await page.goto(`/admin/fotos?foto=${art.portada_foto_id}`);
  await expect(page.locator('[data-usos]')).toContainText(`Artículo: ${art.titulo}`);
  await page.getByRole('button', { name: 'Eliminar foto' }).click();
  await expect(page.getByRole('dialog')).toContainText('Esta foto está en uso');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  expect(await admin<unknown[]>(`fotos?id=eq.${art.portada_foto_id}&select=id`)).toHaveLength(1);

  // Una foto propia sin usar: se elimina con su original y versiones
  await page.goto('/admin/fotos');
  await subir(page, [FOTO_B], [`Para borrar ${marca}`]);
  await page.locator('[data-subir-fotos]').click();
  await expect(page.locator('[data-aviso-subida]')).toBeVisible({ timeout: 60_000 });
  const [nueva] = await fotosDe(u.multimedia);
  await page.goto(`/admin/fotos?foto=${nueva.id}`);
  await expect(page.locator('[data-usos]')).toContainText('ningún contenido');
  await page.getByRole('button', { name: 'Eliminar foto' }).click();
  await expect(page.getByRole('dialog')).toContainText('No se usa en ningún contenido');
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page.getByText('Foto eliminada de la biblioteca.')).toBeVisible();
  expect(await fotosDe(u.multimedia)).toHaveLength(0);
  expect(await listarArchivos(u.multimedia.id)).toEqual([]);
});

test('en el editor de artículos se puede subir una foto nueva como portada, y el sitio usa sus versiones optimizadas', async ({ page }) => {
  await ingresar(page, u.editor);
  await page.goto('/admin/articulos');
  await page.getByRole('button', { name: '+ Nuevo artículo' }).click();
  await page.locator('[data-editor-listo]').waitFor();
  await page.getByLabel('Título del artículo').fill(`Prueba fotos portada ${marca}`);
  await page.locator('[data-elegir-portada]').click();
  const selector = page.locator('[data-subir-desde-selector]');
  await selector.locator('[data-subidor][data-listo]').waitFor();
  await selector.getByLabel('Elegir fotos para subir').setInputFiles(FOTO_B);
  await selector.getByLabel('Texto alternativo (obligatorio)').fill(`Portada nueva ${marca}`);
  await selector.locator('[data-subir-fotos]').click();
  await expect(page.locator('[data-portada]')).toHaveAttribute('alt', `Portada nueva ${marca}`, { timeout: 60_000 });
  await expect(page.locator('[data-guardado]')).toHaveAttribute('data-guardado', 'al-dia', { timeout: 15_000 });

  // Publicar (con vista previa) y ver la foto optimizada en el sitio
  await page.getByRole('button', { name: 'Vista previa' }).click();
  await page.getByRole('button', { name: 'Publicar ahora' }).click();
  await expect(page).toHaveURL(/aviso=publicado/);
  const [a] = await admin<{ slug: string }[]>(`articulos?titulo=eq.${encodeURIComponent(`Prueba fotos portada ${marca}`)}&select=slug`);
  await page.goto(`/articulos/${a.slug}`);
  const picture = page.locator('header picture');
  await expect(picture.locator('source[type="image/avif"]')).toHaveAttribute('srcset', /\/storage\/v1\/object\/sign\/fotos\/.+\/480\.avif.+ 480w/);
  await expect(picture.locator('img')).toHaveAttribute('alt', `Portada nueva ${marca}`);
  expect(await picture.locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
});
