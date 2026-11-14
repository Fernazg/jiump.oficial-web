import { expect, test, type Page } from '@playwright/test';
import { admin } from './apoyo';
import { crearUsuario, ingresar, type Usuario } from './apoyo-admin';

/**
 * Artículos en el panel: editor por bloques, flujo Borrador → En revisión →
 * Programado / Publicado con vista previa obligatoria, programación en hora
 * de Chile, papelera, versiones, edición simultánea, series y temas, y que un
 * borrador nunca aparezca en el sitio público.
 */
const u: Record<string, Usuario> = {};
const marca = Date.now().toString(36);

test.beforeAll(async () => {
  u.editor = await crearUsuario('Elisa Redactora', ['editor']);
  u.editor2 = await crearUsuario('Esteban Corrector', ['editor']);
});

test.afterAll(async () => {
  await admin(`articulos?titulo=like.*${marca}*`, 'DELETE');
  await admin(`series?nombre=like.*${marca}*`, 'DELETE');
  await admin(`temas?nombre=like.*${marca}*`, 'DELETE');
});

type Art = { id: string; slug: string; estado: string; titulo: string; publicar_en: string | null };
const leer = async (id: string) => (await admin<Art[]>(`articulos?id=eq.${id}&select=id,slug,estado,titulo,publicar_en`))[0];
const idDe = (page: Page) => page.url().match(/articulos\/([0-9a-f-]{36})/)![1];

async function nuevo(page: Page, titulo: string): Promise<string> {
  await page.goto('/admin/articulos');
  await page.getByRole('button', { name: '+ Nuevo artículo' }).click();
  await expect(page).toHaveURL(/\/admin\/articulos\/[0-9a-f-]{36}$/);
  await page.getByLabel('Título del artículo').fill(titulo);
  await guardado(page);
  return idDe(page);
}

async function guardado(page: Page) {
  await expect(page.locator('[data-guardado]')).toHaveAttribute('data-guardado', 'al-dia', { timeout: 15_000 });
}

async function agregar(page: Page, tipo: string) {
  await page.getByRole('button', { name: '+ Bloque' }).click();
  await page.locator(`[data-agregar="${tipo}"]`).click();
  return page.locator(`[data-bloque="${tipo}"]`).last();
}

async function publicarDesdeVistaPrevia(page: Page, boton: RegExp = /Publicar (ahora|los cambios ahora)/) {
  await page.getByRole('button', { name: 'Vista previa' }).click();
  await expect(page.locator('[data-barra-vista-previa]')).toBeVisible();
  await page.getByRole('button', { name: boton }).click();
  await expect(page).toHaveURL(/aviso=(publicado|programado)/);
}

async function estadoPublico(page: Page, slug: string) {
  return (await page.request.get(`/articulos/${slug}`)).status();
}

test('flujo completo: bloques, borrador invisible, revisión, vista previa obligatoria y publicación', async ({ page }) => {
  await ingresar(page, u.editor);
  const titulo = `Prueba panel flujo ${marca}`;
  const id = await nuevo(page, titulo);
  await page.getByLabel('Bajada').fill('Una bajada para probar el editor.');
  await page.getByLabel('Autor').fill('Autor de prueba');

  // Portada solo desde la biblioteca
  await page.locator('[data-elegir-portada]').click();
  await page.locator('[data-biblioteca] [data-foto]').first().click();
  await expect(page.locator('[data-portada]')).toBeVisible();

  // Todos los tipos de bloque
  await (await agregar(page, 'entradilla')).locator('textarea').fill('Entradilla de la prueba del panel.');
  const parrafo = await agregar(page, 'parrafo');
  await parrafo.locator('textarea').fill('Texto con palabra fuerte y una cita de Juan 3:16 dentro.');
  await parrafo.locator('textarea').evaluate((el: HTMLTextAreaElement) => { el.focus(); el.setSelectionRange(10, 24); });
  await page.getByRole('button', { name: 'Negrita' }).click();
  await expect(parrafo.locator('textarea')).toHaveValue('Texto con **palabra fuerte** y una cita de Juan 3:16 dentro.');
  await (await agregar(page, 'titulo_seccion')).locator('input').fill('Primera sección');
  await (await agregar(page, 'pregunta_destacada')).locator('textarea').fill('¿Qué aprendimos hoy?');
  const vers = await agregar(page, 'versiculo');
  await vers.getByLabel('Texto del versículo').fill('Porque de tal manera amó Dios al mundo');
  await vers.getByLabel('Referencia').fill('Juan 3:16');
  await (await agregar(page, 'idea_clave')).getByLabel('Texto').fill('Una idea clave de prueba.');
  await (await agregar(page, 'para_recordar')).getByLabel('Texto').fill('Algo para recordar.');
  const lista = await agregar(page, 'lista_numerada');
  await lista.getByLabel('Punto 1', { exact: true }).fill('Primer punto');
  await lista.getByRole('button', { name: '+ Agregar punto' }).click();
  await lista.getByLabel('Punto 2', { exact: true }).fill('Segundo punto');
  const tarjetas = await agregar(page, 'tarjetas');
  await tarjetas.getByLabel('Título (opcional)').fill('Tarjetas de prueba');
  await tarjetas.getByLabel('Punto 1', { exact: true }).fill('Tarjeta uno');
  const linea = await agregar(page, 'linea_tiempo');
  await linea.getByLabel('Fecha 1', { exact: true }).fill('1517');
  await linea.getByLabel('Qué pasó 1', { exact: true }).fill('Un hito de prueba');
  const cifras = await agregar(page, 'cifras');
  await cifras.getByLabel('Cifra 1', { exact: true }).fill('+100');
  await cifras.getByLabel('Explicación 1', { exact: true }).fill('Personas de prueba');
  await agregar(page, 'imagen'); // abre la biblioteca
  await page.locator('[data-biblioteca] [data-foto]').nth(1).click();
  const video = await agregar(page, 'video');
  await video.getByLabel('Enlace de YouTube').fill('https://www.youtube.com/watch?v=XIn6jmUKxH0');
  await guardado(page);
  await expect(page.locator('[data-bloques] > li')).toHaveCount(13);

  // El borrador no aparece en el sitio público (ni URL, ni listado, ni búsqueda)
  const { slug } = await leer(id);
  expect(slug).toBe(`prueba-panel-flujo-${marca}`);
  expect(await estadoPublico(page, slug)).toBe(404);
  expect(await (await page.request.get('/articulos')).text()).not.toContain(titulo);
  expect(await (await page.request.get(`/articulos?q=${marca}`)).text()).not.toContain(titulo);

  // En revisión
  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await expect(page.locator('[data-estado-articulo]')).toHaveText('En revisión');
  expect(await estadoPublico(page, slug)).toBe(404);

  // Publicar sin vista previa: no se ofrece
  await page.locator('[data-accion="publicar"]').click();
  await expect(page.locator('[data-menu-publicar]')).toContainText('Primero revisa la vista previa');
  await expect(page.getByRole('button', { name: 'Publicar ahora' })).toHaveCount(0);

  // Vista previa igual al sitio público
  await page.getByRole('button', { name: 'Vista previa' }).first().click();
  await expect(page.locator('[data-barra-vista-previa]')).toContainText('Aún no es visible para el público');
  const previa = page.locator('[data-vista-previa-articulo] article');
  await expect(previa.getByRole('heading', { level: 1 })).toHaveText(titulo);
  await expect(previa.locator('strong', { hasText: 'palabra fuerte' })).toBeVisible();
  await expect(previa.locator('[data-ref-biblica]').first()).toHaveText('Juan 3:16');
  const textoPrevia = await previa.innerText();
  const imagenesPrevia = await previa.locator('img').count();

  await page.getByRole('button', { name: 'Publicar ahora' }).click();
  await expect(page).toHaveURL(/aviso=publicado/);
  await expect(page.locator('[data-estado-articulo]')).toHaveText('Publicado');
  expect((await leer(id)).estado).toBe('publicado');

  await page.goto(`/articulos/${slug}`);
  const publico = page.locator('main article');
  await expect(publico.getByRole('heading', { level: 1 })).toHaveText(titulo);
  // La fecha que muestra es la de hoy en ambos casos; el resto es idéntico.
  expect(await publico.innerText()).toBe(textoPrevia);
  expect(await publico.locator('img').count()).toBe(imagenesPrevia);
});

test('editar un artículo publicado: los cambios no llegan al sitio hasta revisarlos y publicarlos', async ({ page }) => {
  await ingresar(page, u.editor);
  const titulo = `Prueba panel publicado ${marca}`;
  const id = await nuevo(page, titulo);
  await (await agregar(page, 'parrafo')).locator('textarea').fill('Versión original.');
  await guardado(page);
  await publicarDesdeVistaPrevia(page);
  const { slug } = await leer(id);

  await page.getByLabel('Título del artículo').fill(`${titulo} corregido`);
  await guardado(page);
  await expect(page.locator('[data-aviso-publicado]')).toContainText('no cambia el sitio');
  await page.goto(`/articulos/${slug}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(titulo);

  await page.goto(`/admin/articulos/${id}`);
  await expect(page.getByLabel('Título del artículo')).toHaveValue(`${titulo} corregido`);
  await publicarDesdeVistaPrevia(page);
  await page.goto(`/articulos/${slug}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${titulo} corregido`);
});

test('programar en horario de Chile: no se ve antes de la fecha y sí después', async ({ page }) => {
  await ingresar(page, u.editor);
  const id = await nuevo(page, `Prueba panel programado ${marca}`);
  await (await agregar(page, 'parrafo')).locator('textarea').fill('Se publica solo.');
  await guardado(page);
  await page.getByRole('button', { name: 'Vista previa' }).click();
  await page.getByRole('link', { name: '← Volver al editor' }).click();

  // Mañana a las 10:30, hora de Chile
  const manana = new Date(Date.now() + 86_400_000);
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(manana); // AAAA-MM-DD
  await page.locator('[data-accion="publicar"]').click();
  await page.getByLabel('Programar para (hora de Chile)').fill(`${dia}T10:30`);
  await page.getByRole('button', { name: 'Programar', exact: true }).click();
  await expect(page).toHaveURL(/aviso=programado/);
  await expect(page.locator('[data-estado-articulo]')).toHaveText('Programado');
  await expect(page.locator('[data-fecha-programada]')).toContainText('10:30');

  const a = await leer(id);
  expect(a.estado).toBe('programado');
  const enChile = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(a.publicar_en!));
  expect(enChile).toBe(`${dia}, 10:30`);
  expect(await estadoPublico(page, a.slug)).toBe(404);

  // Aparece en «Próximos programados» del escritorio
  await page.goto('/admin');
  await expect(page.locator('[data-programados]')).toContainText(`Prueba panel programado ${marca}`);

  // Llega la fecha (se simula moviéndola al pasado): se publica solo.
  await admin(`articulos?id=eq.${id}`, 'PATCH', { publicar_en: new Date(Date.now() - 60_000).toISOString() });
  expect(await estadoPublico(page, a.slug)).toBe(200);
});

test('papelera: eliminar pide confirmación, se recupera, y el borrado definitivo es aparte', async ({ page }) => {
  await ingresar(page, u.editor);
  const titulo = `Prueba panel papelera ${marca}`;
  const id = await nuevo(page, titulo);
  await (await agregar(page, 'parrafo')).locator('textarea').fill('Contenido.');
  await guardado(page);
  await publicarDesdeVistaPrevia(page);
  const { slug } = await leer(id);
  expect(await estadoPublico(page, slug)).toBe(200);

  await page.goto(`/admin/articulos?q=${encodeURIComponent(titulo)}`);
  const fila = page.locator(`[data-articulo="${slug}"]`);
  await fila.getByRole('button', { name: `Eliminar ${titulo}` }).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toContainText('Podrás recuperarlo durante 30 días');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  expect((await leer(id)).estado).toBe('publicado');

  await fila.getByRole('button', { name: `Eliminar ${titulo}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page.getByText('El artículo pasó a la papelera')).toBeVisible();
  expect((await leer(id)).estado).toBe('papelera');
  expect(await estadoPublico(page, slug)).toBe(404);

  await page.goto('/admin/articulos?estado=papelera');
  const enPapelera = page.locator(`[data-articulo="${slug}"]`);
  await expect(enPapelera).toContainText('Quedan 30 días');
  await enPapelera.getByRole('button', { name: 'Restaurar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, restaurar' }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/articulos/${id}\\?aviso=restaurado`));
  expect((await leer(id)).estado).toBe('borrador'); // vuelve sin publicar: requiere vista previa otra vez
  expect(await estadoPublico(page, slug)).toBe(404);

  await page.getByRole('button', { name: 'Eliminar artículo' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page).toHaveURL(/aviso=papelera/);
  await page.goto('/admin/articulos?estado=papelera');
  await page.locator(`[data-articulo="${slug}"]`).getByRole('button', { name: /Eliminar definitivamente/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, eliminar para siempre' }).click();
  await expect(page.getByText('se eliminó definitivamente')).toBeVisible();
  expect(await leer(id)).toBeUndefined();
});

test('historial de versiones: «Restaurar» vuelve al contenido anterior', async ({ page }) => {
  await ingresar(page, u.editor);
  const titulo = `Prueba panel versiones ${marca}`;
  const id = await nuevo(page, titulo);
  await page.getByLabel('Título del artículo').fill(`${titulo} cambiado`);
  await guardado(page);
  await page.reload();
  const versiones = page.locator('[data-historial] [data-version]');
  await expect(versiones.filter({ hasText: `«${titulo}»` })).toHaveCount(1);
  await expect(versiones.first()).toContainText('Tú');
  await versiones.filter({ hasText: `«${titulo}»` }).getByRole('button', { name: 'Restaurar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, restaurar' }).click();
  await expect(page).toHaveURL(/aviso=version/);
  await expect(page.getByLabel('Título del artículo')).toHaveValue(titulo);
  expect((await leer(id)).titulo).toBe(titulo);
});

test('edición simultánea: avisa quién más tiene abierto el artículo y no pisa sus cambios', async ({ page, browser }) => {
  await ingresar(page, u.editor);
  const id = await nuevo(page, `Prueba panel simultaneo ${marca}`);

  const otro = await browser.newContext();
  const p2 = await otro.newPage();
  await ingresar(p2, u.editor2);
  await p2.goto(`/admin/articulos/${id}`);
  await expect(p2.locator('[data-aviso-simultaneo]')).toContainText('Elisa Redactora también tiene abierto este artículo');
  await page.reload();
  await expect(page.locator('[data-aviso-simultaneo]')).toContainText('Esteban Corrector también tiene abierto este artículo');

  // Ambos editan: el segundo en guardar recibe el aviso en vez de sobrescribir.
  await p2.getByLabel('Bajada').fill('Bajada de Esteban');
  await guardado(p2);
  await page.getByLabel('Bajada').fill('Bajada de Elisa');
  await expect(page.locator('[data-aviso-conflicto]')).toBeVisible({ timeout: 20_000 });
  const [a] = await admin<{ bajada: string }[]>(`articulos?id=eq.${id}&select=bajada`);
  expect(a.bajada).toBe('Bajada de Esteban');
  await otro.close();
});

test('listado: filtros por estado, serie y tema, y búsqueda', async ({ page }) => {
  await ingresar(page, u.editor);
  await page.goto('/admin/articulos');
  // Artículos del seed
  await expect(page.locator('[data-articulo="como-comenzo-la-biblia"]')).toBeVisible();
  await page.getByRole('link', { name: 'En revisión', exact: true }).click();
  await expect(page).toHaveURL(/estado=revision/);
  const filas = page.locator('[data-lista-articulos] [data-articulo]');
  for (const t of await filas.allInnerTexts()) expect(t).toContain('En revisión');

  await page.goto('/admin/articulos');
  await page.locator('select[name="serie"]').selectOption({ label: 'Octubre · Mes de la Reforma Protestante' });
  await expect(page).toHaveURL(/serie=/);
  await expect(filas.first()).toBeVisible();
  for (const t of await filas.allInnerTexts()) expect(t).toContain('Mes de la Reforma');

  await page.goto('/admin/articulos?q=imprenta');
  await expect(filas).toHaveCount(1);
  await expect(filas.first()).toContainText('De los rollos a la imprenta');
  await page.goto(`/admin/articulos?q=no-existe-${marca}`);
  await expect(page.locator('[data-sin-resultados]')).toBeVisible();

  const [tema] = await admin<{ id: string; nombre: string }[]>('temas?select=id,nombre&limit=1');
  await page.goto('/admin/articulos');
  await page.locator('select[name="tema"]').selectOption(tema.id);
  await expect(page).toHaveURL(new RegExp(`tema=${tema.id}`));
});

test('series y temas: crear, y una serie con artículos no se puede borrar', async ({ page }) => {
  await ingresar(page, u.editor);
  await page.goto('/admin/articulos/series');
  await page.getByText('+ Agregar serie').click();
  const form = page.locator('details[open] form').last();
  await form.getByLabel('Nombre').fill(`Serie prueba ${marca}`);
  await form.getByRole('button', { name: 'Crear serie' }).click();
  await expect(page.getByText('Serie creada.')).toBeVisible();
  const serie = page.locator(`[data-serie="serie-prueba-${marca}"]`);
  await expect(serie).toContainText('0 artículos');

  await page.getByPlaceholder('Nuevo tema').fill(`Tema prueba ${marca}`);
  await page.getByRole('button', { name: '+ Agregar tema' }).click();
  await expect(page.getByText('Tema creado.')).toBeVisible();

  // Un artículo en esa serie
  const id = await nuevo(page, `Prueba panel en serie ${marca}`);
  await page.locator('select[name="serie"]').selectOption({ label: `Serie prueba ${marca}` });
  await page.getByLabel('Parte').fill('1');
  await page.getByLabel('Agregar tema').selectOption({ label: `Tema prueba ${marca}` });
  await guardado(page);
  const [a] = await admin<{ serie_id: string; parte: number }[]>(`articulos?id=eq.${id}&select=serie_id,parte`);
  expect(a.parte).toBe(1);

  await page.goto('/admin/articulos/series');
  await serie.locator('summary').click();
  await expect(serie).toContainText('No se puede borrar: tiene 1 artículo');
  await expect(serie.getByRole('button', { name: 'Borrar serie' })).toHaveCount(0);
  // Y la base lo impide aunque se intente igual
  const r = await page.request.delete(`${process.env.SUPABASE_URL}/rest/v1/series?id=eq.${a.serie_id}`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  expect(r.status()).toBe(409);

  // Sin artículos sí se borra (con confirmación)
  await admin(`articulos?id=eq.${id}`, 'PATCH', { serie_id: null, parte: null });
  await page.reload();
  await serie.locator('summary').click();
  await serie.getByRole('button', { name: 'Borrar serie' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page.getByText('Serie borrada.')).toBeVisible();
  await expect(serie).toHaveCount(0);
});

test('el editor y el listado se adaptan al celular sin desborde @celular', async ({ page }) => {
  await ingresar(page, u.editor);
  const id = await nuevo(page, `Prueba panel celular ${marca}`);
  await agregar(page, 'versiculo');
  for (const ruta of [`/admin/articulos/${id}`, '/admin/articulos', `/admin/articulos/${id}/vista-previa`]) {
    await page.goto(ruta);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(ancho, ruta).toBeLessThanOrEqual(0);
  }
});
