import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { admin } from './apoyo';
import { borrarFotosDe, crearUsuario, ingresar, type Usuario } from './apoyo-admin';

/**
 * Eventos y actividades: crear y editar con todos los campos, secciones,
 * enlaces, fotos con portada, vista previa obligatoria y publicación,
 * destacar y ordenar en Inicio, y «Próximo evento» (uno solo). Lo no
 * publicado nunca aparece en el sitio. Los textos son de prueba y se borran.
 */
const FOTO_A = fileURLToPath(new URL('../../design/fotos/41c24f60d5fa1ad39db4a22e0dca3755.jpg', import.meta.url));
const FOTO_B = fileURLToPath(new URL('../../design/fotos/c812a4cd24f206fc856b063660dee62d.jpg', import.meta.url));
const marca = Date.now().toString(36);
const u: Record<string, Usuario> = {};
let ordenOriginal: { id: string; orden_inicio: number }[] = [];

test.beforeAll(async () => {
  u.eventos = await crearUsuario('Elías Eventos', ['eventos']);
  u.multimedia = await crearUsuario('Mónica Multimedia', ['multimedia']);
  ordenOriginal = await admin('actividades?select=id,orden_inicio');
});

test.afterAll(async () => {
  await admin(`actividades?titulo=like.*${marca}*`, 'DELETE');
  await admin(`actividades?creado_por=eq.${u.eventos.id}`, 'DELETE'); // también las que quedaron sin título
  for (const a of ordenOriginal) await admin(`actividades?id=eq.${a.id}`, 'PATCH', { orden_inicio: a.orden_inicio });
  await admin('actividades?es_proximo=eq.true', 'PATCH', { es_proximo: false });
  for (const x of Object.values(u)) await borrarFotosDe(x);
});

type Act = { id: string; slug: string; estado: string; portada_foto_id: string | null; fecha_inicio: string | null; fecha_precision: string; anio: number };
const leer = async (titulo: string) => (await admin<Act[]>(`actividades?titulo=eq.${encodeURIComponent(titulo)}&select=id,slug,estado,portada_foto_id,fecha_inicio,fecha_precision,anio`))[0];

async function nueva(page: Page, titulo: string) {
  await page.goto('/admin/eventos');
  await page.getByRole('button', { name: '+ Nuevo evento' }).click();
  await expect(page).toHaveURL(/\/admin\/eventos\/[0-9a-f-]{36}$/);
  await page.locator('[data-editor-actividad][data-listo]').waitFor();
  await page.getByLabel('Título', { exact: true }).fill(titulo);
}

/** Guarda y espera a que el editor se recargue con la versión nueva. */
async function guardar(page: Page) {
  const antes = await page.locator('[data-editor-actividad]').getAttribute('data-version');
  await page.locator('[data-guardar]').click();
  await expect(page.locator('[data-editor-actividad]')).not.toHaveAttribute('data-version', antes!, { timeout: 15_000 });
  await page.locator('[data-editor-actividad][data-listo]').waitFor();
  await expect(page.locator('[data-estado-guardado]')).toHaveText('Todo guardado');
}

async function subirAlSelector(page: Page, ruta: string, alt: string) {
  const s = page.locator('[data-subir-desde-selector]');
  await s.locator('[data-subidor][data-listo]').waitFor();
  await s.getByLabel('Elegir fotos para subir').setInputFiles(ruta);
  await s.getByLabel('Texto alternativo (obligatorio)').fill(alt);
  await s.locator('[data-subir-fotos]').click();
}

test('Eventos crea una actividad completa; no se ve hasta publicarla con vista previa', async ({ page }) => {
  await ingresar(page, u.eventos);
  const titulo = `Actividad de prueba ${marca}`;
  await nueva(page, titulo);
  await page.getByLabel('Año (obligatorio)').fill('2027');
  await page.getByLabel('Solo mes y año').check();
  await page.getByLabel('Mes y año', { exact: true }).fill('2027-03');
  await page.getByLabel('Lugar').fill('Lugar de prueba');
  await page.getByRole('textbox', { name: 'Zona' }).fill('Zona de prueba');
  await page.getByLabel('Lema (opcional)').fill('Lema de prueba');
  await page.getByLabel('Abreviatura (opcional, ej.: EMJ)').fill('prb');
  await page.getByLabel('Cita bíblica: referencia (opcional)').fill('Juan 3:16');
  await page.getByLabel('Cita bíblica: texto (opcional)').fill('Texto de cita de prueba');
  await page.getByLabel('Introducción (texto oficial)').fill('Introducción de prueba.');
  // Sección con un párrafo
  await page.getByRole('button', { name: '+ Agregar sección' }).click();
  const seccion = page.locator('[data-seccion-actividad]').first();
  await seccion.getByLabel('Título de la sección').fill('Día 1');
  await seccion.locator('[data-bloque="parrafo"] textarea').fill('Resumen de prueba del día uno.');
  // Enlace
  await page.getByRole('button', { name: '+ Agregar enlace' }).click();
  await page.getByLabel('Título del enlace 1').fill('Transmisión de prueba');
  await page.getByLabel('Dirección del enlace 1').fill('https://www.youtube.com/watch?v=XIn6jmUKxH0');
  // Fotos: subir dos nuevas desde el selector; la primera queda de portada
  await page.locator('[data-agregar-fotos]').click();
  await subirAlSelector(page, FOTO_A, `Foto A de actividad ${marca}`);
  await expect(page.locator('[data-foto-elegida]')).toHaveCount(1, { timeout: 60_000 });
  await page.locator('[data-agregar-fotos]').click();
  await subirAlSelector(page, FOTO_B, `Foto B de actividad ${marca}`);
  await expect(page.locator('[data-foto-elegida]')).toHaveCount(2, { timeout: 60_000 });
  await page.locator('[data-foto-elegida]').nth(1).getByRole('button', { name: 'Usar como portada' }).click();
  await expect(page.locator('[data-foto-elegida]').nth(1)).toHaveAttribute('data-portada-elegida', 'true');
  await guardar(page);

  const a = await leer(titulo);
  expect(a).toMatchObject({ estado: 'borrador', anio: 2027, fecha_inicio: '2027-03-01', fecha_precision: 'mes' });
  expect(a.portada_foto_id).toBeTruthy();
  const [sec] = await admin<{ titulo: string }[]>(`actividad_secciones?actividad_id=eq.${a.id}&select=titulo`);
  expect(sec.titulo).toBe('Día 1');

  // En borrador: no aparece en el sitio
  expect((await page.request.get(`/eventos/${a.slug}`)).status()).toBe(404);
  expect(await (await page.request.get('/eventos')).text()).not.toContain(titulo);

  // Publicar exige vista previa
  await expect(page.locator('[data-publicar]')).toBeDisabled();
  await page.getByRole('button', { name: 'Vista previa' }).click();
  const previa = page.locator('[data-vista-previa-contenido]');
  await expect(previa.getByRole('heading', { level: 1 })).toHaveText('Lema de prueba');
  await expect(previa).toContainText('Día 1');
  await expect(previa).toContainText('Texto de cita de prueba');
  await expect(previa.locator('[data-seccion="fotos"] img')).toHaveCount(2);
  const textoPrevia = await previa.innerText();
  await page.getByRole('button', { name: 'Publicar ahora' }).click();
  await expect(page).toHaveURL(/aviso=publicado/);
  expect((await leer(titulo)).estado).toBe('publicado');

  // Publicada: igual que la vista previa
  await page.goto(`/eventos/${a.slug}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lema de prueba');
  expect(await page.locator('main').innerText()).toBe(textoPrevia);
  const [guardada] = await admin<{ abreviatura: string; lema: string; lugar: string; zona: string; cita_referencia: string }[]>(
    `actividades?id=eq.${a.id}&select=abreviatura,lema,lugar,zona,cita_referencia`);
  expect(guardada).toEqual({ abreviatura: 'PRB', lema: 'Lema de prueba', lugar: 'Lugar de prueba', zona: 'Zona de prueba', cita_referencia: 'Juan 3:16' });
});

test('validaciones: año obligatorio y coherente, cita con referencia', async ({ page }) => {
  await ingresar(page, u.eventos);
  await nueva(page, `Actividad validaciones ${marca}`);
  await page.getByLabel('Año (obligatorio)').fill('');
  await page.locator('[data-guardar]').click();
  await expect(page.locator('[data-editor-actividad] [role=alert]')).toContainText('El año es obligatorio');
  await page.getByLabel('Año (obligatorio)').fill('2026');
  await page.getByLabel('Fecha de inicio').fill('2027-05-10');
  await page.locator('[data-guardar]').click();
  await expect(page.locator('[data-editor-actividad] [role=alert]')).toContainText('El año no coincide con la fecha');
  await page.getByLabel('Fecha de inicio').fill('2026-05-10');
  await page.getByLabel('Cita bíblica: texto (opcional)').fill('Una cita sin referencia');
  await page.locator('[data-guardar]').click();
  await expect(page.locator('[data-editor-actividad] [role=alert]')).toContainText('agrega su referencia bíblica');
});

test('quitar una foto de la actividad la deja en la biblioteca; eliminar la actividad también', async ({ page }) => {
  await ingresar(page, u.eventos);
  const titulo = `Actividad fotos ${marca}`;
  await nueva(page, titulo);
  await page.locator('[data-agregar-fotos]').click();
  await subirAlSelector(page, FOTO_A, `Foto que se queda ${marca}`);
  await expect(page.locator('[data-foto-elegida]')).toHaveCount(1, { timeout: 60_000 });
  await guardar(page);
  const [foto] = await admin<{ id: string }[]>(`fotos?texto_alternativo=eq.${encodeURIComponent(`Foto que se queda ${marca}`)}&select=id`);

  await page.locator('[data-foto-elegida]').getByRole('button', { name: 'Quitar foto' }).click();
  await guardar(page);
  expect(await admin<unknown[]>(`actividad_fotos?foto_id=eq.${foto.id}`)).toHaveLength(0);
  expect(await admin<unknown[]>(`fotos?id=eq.${foto.id}&select=id`)).toHaveLength(1);

  await page.getByRole('button', { name: 'Eliminar' }).last().click();
  await expect(page.getByRole('dialog')).toContainText('Las fotos quedan en la biblioteca');
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page.getByText('Actividad eliminada. Sus fotos siguen en la biblioteca.')).toBeVisible();
  expect(await leer(titulo)).toBeUndefined();
  expect(await admin<unknown[]>(`fotos?id=eq.${foto.id}&select=id`)).toHaveLength(1);
});

test('destacar y ordenar en Inicio; «Próximo evento» es uno solo', async ({ page }) => {
  await ingresar(page, u.eventos);
  await page.goto('/admin/eventos');
  const destacadas = page.locator('[data-destacadas] [data-destacada]');
  await expect(destacadas.first()).toBeVisible();
  const antes = await destacadas.evaluateAll((xs) => xs.map((x) => x.getAttribute('data-destacada')));
  await page.locator(`[data-bajar="${antes[0]}"]`).click();
  await expect(page.getByText('Orden de Inicio actualizado.')).toBeVisible();
  const despues = await destacadas.evaluateAll((xs) => xs.map((x) => x.getAttribute('data-destacada')));
  expect(despues.slice(0, 2)).toEqual([antes[1], antes[0]]);
  // Inicio usa ese orden
  await page.goto('/');
  const enInicio = await page.locator('[data-seccion="actividades-destacadas"] [data-actividad]').evaluateAll((xs) => xs.map((x) => x.getAttribute('data-actividad')));
  expect(enInicio.slice(0, 2)).toEqual([antes[1], antes[0]]);

  // Próximo evento
  await page.goto('/admin/eventos');
  await page.locator('[data-marcar-proximo="fedi-2026"]').click();
  await expect(page.getByText('«Próximo evento» actualizado.')).toBeVisible();
  await expect(page.locator('[data-quitar-proximo="fedi-2026"]')).toBeVisible();
  await page.locator('[data-marcar-proximo="ejz-2026"]').click();
  await expect(page.locator('[data-quitar-proximo="ejz-2026"]')).toBeVisible();
  await expect(page.locator('[data-quitar-proximo]')).toHaveCount(1);
  const proximos = await admin<{ slug: string }[]>('actividades?es_proximo=eq.true&select=slug');
  expect(proximos.map((x) => x.slug)).toEqual(['ejz-2026']);
  await page.goto('/');
  await expect(page.locator('[data-barra-proximo]')).toContainText('Encuentro de Jefaturas 2026');
  await page.goto('/admin/eventos');
  await page.locator('[data-quitar-proximo="ejz-2026"]').click();
  await expect(page.getByText('Ya no hay «Próximo evento» marcado.')).toBeVisible();
});

test('Multimedia no entra a Eventos (ni por URL)', async ({ page }) => {
  await ingresar(page, u.multimedia);
  expect((await page.goto('/admin/eventos'))?.status()).toBe(403);
  const [a] = await admin<{ id: string }[]>('actividades?select=id&limit=1');
  expect((await page.goto(`/admin/eventos/${a.id}`))?.status()).toBe(403);
  expect((await page.goto(`/admin/eventos/${a.id}/vista-previa`))?.status()).toBe(403);
});

test('el editor de actividades se adapta al celular @celular', async ({ page }) => {
  await ingresar(page, u.eventos);
  await nueva(page, `Actividad celular ${marca}`);
  for (const ruta of ['/admin/eventos', page.url()]) {
    await page.goto(ruta);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(ancho, ruta).toBeLessThanOrEqual(0);
  }
});
