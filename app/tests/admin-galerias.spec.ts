import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { admin } from './apoyo';
import { borrarFotosDe, crearUsuario, ingresar, type Usuario } from './apoyo-admin';

/**
 * Galerías, álbumes y videos (Multimedia): crear álbumes, agregar y ordenar
 * fotos, portada, actividad asociada, regla 2 (un evento por álbum), videos
 * de YouTube, vista previa obligatoria y que lo no publicado no se vea.
 */
const FOTO_A = fileURLToPath(new URL('../../design/fotos/6eebca653ff6c5f7ec503ead1f64b43d.jpg', import.meta.url));
const FOTO_B = fileURLToPath(new URL('../../design/fotos/1c1556616113621811b72f1a72d9521e.jpg', import.meta.url));
const marca = Date.now().toString(36);
const u: Record<string, Usuario> = {};

test.beforeAll(async () => {
  u.multimedia = await crearUsuario('Marta Galerías', ['multimedia']);
  u.eventos = await crearUsuario('Emilio Galerías', ['eventos']);
  u.editor = await crearUsuario('Eva Galerías', ['editor']);
});

test.afterAll(async () => {
  await admin(`videos?titulo=like.*${marca}*`, 'DELETE');
  await admin(`albumes?titulo=like.*${marca}*`, 'DELETE');
  await admin(`albumes?creado_por=eq.${u.multimedia.id}`, 'DELETE');
  await admin(`videos?creado_por=eq.${u.multimedia.id}`, 'DELETE');
  for (const x of Object.values(u)) await borrarFotosDe(x);
});

type Alb = { id: string; slug: string; estado: string; portada_foto_id: string | null; actividad_id: string | null };
const leerAlbum = async (titulo: string) =>
  (await admin<Alb[]>(`albumes?titulo=eq.${encodeURIComponent(titulo)}&select=id,slug,estado,portada_foto_id,actividad_id`))[0];

async function guardarAlbum(page: Page) {
  const antes = await page.locator('[data-editor-album]').getAttribute('data-version');
  await page.locator('[data-guardar]').click();
  await expect(page.locator('[data-editor-album]')).not.toHaveAttribute('data-version', antes!, { timeout: 15_000 });
  await page.locator('[data-editor-album][data-listo]').waitFor();
}

async function subirAlSelector(page: Page, ruta: string, alt: string) {
  const s = page.locator('[data-subir-desde-selector]');
  await s.locator('[data-subidor][data-listo]').waitFor();
  await s.getByLabel('Elegir fotos para subir').setInputFiles(ruta);
  await s.getByLabel('Texto alternativo (obligatorio)').fill(alt);
  await s.locator('[data-subir-fotos]').click();
}

test('Multimedia crea un álbum con fotos ordenadas y portada; solo se ve al publicarlo con vista previa', async ({ page }) => {
  await ingresar(page, u.multimedia);
  await page.goto('/admin/galerias');
  await page.getByRole('button', { name: '+ Nuevo álbum' }).click();
  await expect(page).toHaveURL(/\/admin\/galerias\/[0-9a-f-]{36}$/);
  await page.locator('[data-editor-album][data-listo]').waitFor();
  const titulo = `Álbum de prueba ${marca}`;
  await page.getByLabel('Título del álbum').fill(titulo);
  await page.getByLabel('Año (opcional)').fill('2026');
  await page.getByLabel('País (opcional)').fill('País de prueba');

  // Regla 2: sin actividad, no se ofrecen fotos que ya son de una actividad (p. ej. la Convención).
  await page.locator('[data-agregar-fotos]').click();
  const [deConvencion] = await admin<{ foto_id: string }[]>('actividad_fotos?select=foto_id&limit=1');
  await expect(page.locator(`[data-biblioteca] [data-foto="${deConvencion.foto_id}"]`)).toHaveCount(0);
  await subirAlSelector(page, FOTO_A, `Foto A de álbum ${marca}`);
  await expect(page.locator('[data-foto-elegida]')).toHaveCount(1, { timeout: 60_000 });
  await page.locator('[data-agregar-fotos]').click();
  await subirAlSelector(page, FOTO_B, `Foto B de álbum ${marca}`);
  await expect(page.locator('[data-foto-elegida]')).toHaveCount(2, { timeout: 60_000 });
  // Ordenar: la segunda pasa primero y queda de portada
  await page.locator('[data-foto-elegida]').nth(1).getByRole('button', { name: 'Mover antes' }).click();
  await page.locator('[data-foto-elegida]').first().getByRole('button', { name: 'Usar como portada' }).click();
  await guardarAlbum(page);

  const a = await leerAlbum(titulo);
  expect(a.estado).toBe('borrador');
  const orden = await admin<{ foto_id: string; fotos: { texto_alternativo: string } }[]>(`album_fotos?album_id=eq.${a.id}&select=foto_id,fotos(texto_alternativo)&order=orden`);
  expect(orden.map((x) => x.fotos.texto_alternativo)).toEqual([`Foto B de álbum ${marca}`, `Foto A de álbum ${marca}`]);
  expect(a.portada_foto_id).toBe(orden[0].foto_id);

  // En borrador no se ve en la Galería
  expect((await page.request.get(`/galeria/${a.slug}`)).status()).toBe(404);
  expect(await (await page.request.get('/galeria')).text()).not.toContain(titulo);

  await expect(page.locator('[data-publicar]')).toBeDisabled();
  await page.getByRole('button', { name: 'Vista previa' }).click();
  const previa = page.locator('[data-vista-previa-contenido]');
  await expect(previa.getByRole('heading', { level: 1 })).toHaveText(titulo);
  await expect(previa).toContainText('2 fotos');
  await page.getByRole('button', { name: 'Publicar ahora' }).click();
  await expect(page).toHaveURL(/aviso=publicado/);

  await page.goto(`/galeria/${a.slug}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(titulo);
  await page.goto('/galeria');
  await expect(page.locator(`[data-album="${a.slug}"]`).first()).toBeVisible();
});

test('videos: solo YouTube, quedan ocultos hasta la vista previa y se ven en su álbum', async ({ page }) => {
  await ingresar(page, u.multimedia);
  await page.goto('/admin/videos/nuevo');
  await page.locator('form[data-listo]').waitFor();
  await page.getByLabel('Enlace de YouTube').fill('https://vimeo.com/123');
  await expect(page.getByText('El enlace no parece de YouTube')).toBeVisible();
  const titulo = `Video de prueba ${marca}`;
  await page.getByLabel(/^Título/).fill(titulo);
  await page.getByRole('button', { name: 'Agregar video' }).click();
  await expect(page.locator('form [role=alert]')).toContainText('no parece de YouTube');

  await page.getByLabel('Enlace de YouTube').fill('https://www.youtube.com/watch?v=XIn6jmUKxH0');
  await page.getByLabel('Dónde aparece').selectOption({ label: 'Galería › Convención Nacional 2026' });
  await page.getByRole('button', { name: 'Agregar video' }).click();
  await expect(page.getByText('Video agregado. Está oculto')).toBeVisible();
  const [v] = await admin<{ id: string; estado: string }[]>(`videos?titulo=eq.${encodeURIComponent(titulo)}&select=id,estado`);
  expect(v.estado).toBe('borrador');
  expect(await (await page.request.get('/galeria/convencion-nacional-2026')).text()).not.toContain(titulo);

  await expect(page.locator('[data-publicar]')).toBeDisabled();
  await page.getByRole('link', { name: 'Vista previa' }).click();
  await expect(page.locator('[data-vista-previa-contenido]')).toContainText(titulo);
  await page.getByRole('button', { name: 'Publicar ahora' }).click();
  await expect(page.getByText('Video publicado en el sitio.')).toBeVisible();
  await page.goto('/galeria/convencion-nacional-2026');
  await expect(page.locator('main')).toContainText(titulo);

  // Eliminar pide confirmación
  await page.goto(`/admin/videos/${v.id}`);
  await page.getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.getByRole('dialog')).toContainText('El video sigue en YouTube');
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page.getByText('Video eliminado del sitio.')).toBeVisible();
});

test('videos con portada: se elige de la biblioteca; el sitio muestra la portada (o la miniatura de YouTube) y carga el reproductor solo al tocarla', async ({ page }) => {
  // Sin depender de YouTube: no se descarga nada de ahí durante la prueba.
  await page.route(/youtube-nocookie\.com|ytimg\.com/, (r) => r.abort());
  await ingresar(page, u.multimedia);

  // Video del álbum, con portada elegida desde la biblioteca
  const conPortada = `Video con portada ${marca}`;
  await page.goto('/admin/videos/nuevo');
  await page.locator('form[data-listo]').waitFor();
  await page.getByLabel('Enlace de YouTube').fill('https://www.youtube.com/watch?v=XIn6jmUKxH0');
  await page.getByLabel(/^Título/).fill(conPortada);
  await page.getByLabel('Dónde aparece').selectOption({ label: 'Galería › Convención Nacional 2026' });
  const campo = page.locator('[data-campo-foto="portada_foto_id"]');
  await expect(campo).toContainText('Sin foto');
  await campo.getByRole('button', { name: 'Elegir de la biblioteca' }).click();
  const elegida = page.getByRole('dialog').locator('[data-biblioteca] button[data-foto]').first();
  const fotoId = await elegida.getAttribute('data-foto');
  await elegida.click();
  await expect(campo.locator(':scope > img')).toBeVisible();
  await page.getByRole('button', { name: 'Agregar video' }).click();
  await expect(page.getByText('Video agregado. Está oculto')).toBeVisible();
  const [v1] = await admin<{ id: string; portada_foto_id: string | null }[]>(`videos?titulo=eq.${encodeURIComponent(conPortada)}&select=id,portada_foto_id`);
  expect(v1.portada_foto_id).toBe(fotoId);
  await expect(page.locator('[data-campo-foto="portada_foto_id"] > img')).toBeVisible(); // al volver a editar sigue elegida

  // La vista previa ya muestra la portada, sin reproductor
  await page.getByRole('link', { name: 'Vista previa' }).click();
  await expect(page.locator('[data-vista-previa-contenido] [data-video-portada="propia"]')).toBeVisible();
  await expect(page.locator('[data-vista-previa-contenido] iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Publicar ahora' }).click();
  await expect(page.getByText('Video publicado en el sitio.')).toBeVisible();

  // Video de una actividad, sin portada: se usa la miniatura de YouTube
  const sinPortada = `Video sin portada ${marca}`;
  await page.goto('/admin/videos/nuevo');
  await page.locator('form[data-listo]').waitFor();
  await page.getByLabel('Enlace de YouTube').fill('https://youtu.be/dQw4w9WgXcQ');
  await page.getByLabel(/^Título/).fill(sinPortada);
  await page.getByLabel('Dónde aparece').selectOption({ label: 'Eventos › Convención Nacional JIUMP 2026' });
  await page.getByRole('button', { name: 'Agregar video' }).click();
  await expect(page.getByText('Video agregado. Está oculto')).toBeVisible();
  await page.getByRole('link', { name: 'Vista previa' }).click();
  await page.getByRole('button', { name: 'Publicar ahora' }).click();
  await expect(page.getByText('Video publicado en el sitio.')).toBeVisible();

  // En el sitio (sin sesión): portada propia, firmada y visible para el visitante
  const visitante = await page.context().browser()!.newPage();
  await visitante.route(/youtube-nocookie\.com|ytimg\.com/, (r) => r.abort());
  await visitante.goto('/galeria/convencion-nacional-2026');
  const video = visitante.locator('[data-video="XIn6jmUKxH0"]');
  await expect(video).toHaveAttribute('data-video-portada', 'propia');
  await expect(video).toHaveAttribute('href', 'https://www.youtube.com/watch?v=XIn6jmUKxH0'); // sin JavaScript abre YouTube
  await expect(video).toHaveAccessibleName(`Reproducir el video: ${conPortada}`);
  const img = video.locator('img');
  await expect(img).toHaveJSProperty('complete', true);
  expect(await img.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(0);
  await expect(visitante.locator('main iframe')).toHaveCount(0); // el reproductor no se carga hasta tocar
  await video.click();
  const reproductor = visitante.locator('[data-video-reproductor] iframe');
  await expect(reproductor).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/XIn6jmUKxH0?autoplay=1');
  await expect(reproductor).toHaveAttribute('title', conPortada);

  // Actividad: miniatura de YouTube; el teclado también lo inicia
  await visitante.goto('/eventos/convencion-nacional-2026');
  const otro = visitante.locator('[data-video="dQw4w9WgXcQ"]');
  await expect(otro).toHaveAttribute('data-video-portada', 'youtube');
  await expect(otro.locator('img')).toHaveAttribute('src', 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  await expect(visitante.locator('main iframe')).toHaveCount(0);
  await otro.focus();
  await visitante.keyboard.press('Enter');
  await expect(visitante.locator('[data-video-reproductor] iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?autoplay=1$/);
  await visitante.close();

  // Quitar la portada de un video publicado queda pendiente hasta publicar los cambios
  await page.goto(`/admin/videos/${v1.id}`);
  await page.locator('form[data-listo]').waitFor();
  await page.locator('[data-campo-foto="portada_foto_id"]').getByRole('button', { name: 'Quitar' }).click();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('[data-cambios-pendientes]')).toBeVisible();
  expect((await admin<{ portada_foto_id: string | null }[]>(`videos?id=eq.${v1.id}&select=portada_foto_id`))[0].portada_foto_id).toBe(fotoId);
  await page.getByRole('link', { name: 'Vista previa' }).click();
  await expect(page.locator('[data-vista-previa-contenido] [data-video-portada="youtube"]')).toBeVisible();
  await page.getByRole('button', { name: 'Publicar los cambios' }).click();
  await expect(page.getByText('Cambios publicados en el sitio.')).toBeVisible();
  expect((await admin<{ portada_foto_id: string | null }[]>(`videos?id=eq.${v1.id}&select=portada_foto_id`))[0].portada_foto_id).toBeNull();
});

test('Eventos y Editor no entran a Galerías ni Videos (ni por URL)', async ({ page }) => {
  const [al] = await admin<{ id: string }[]>('albumes?select=id&limit=1');
  for (const x of [u.eventos, u.editor]) {
    await ingresar(page, x);
    for (const ruta of ['/admin/galerias', `/admin/galerias/${al.id}`, `/admin/galerias/${al.id}/vista-previa`, '/admin/videos', '/admin/videos/nuevo']) {
      expect((await page.goto(ruta))?.status(), `${x.nombre} ${ruta}`).toBe(403);
    }
    // Pero sí usan la biblioteca de fotos
    expect((await page.goto('/admin/fotos'))?.status()).toBe(200);
    await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
  }
});

test('Galerías se adapta al celular @celular', async ({ page }) => {
  await ingresar(page, u.multimedia);
  const [al] = await admin<{ id: string }[]>('albumes?select=id&slug=eq.convencion-nacional-2026');
  for (const ruta of ['/admin/galerias', `/admin/galerias/${al.id}`, '/admin/videos', '/admin/fotos']) {
    await page.goto(ruta);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(ancho, ruta).toBeLessThanOrEqual(0);
  }
});

test('álbum y video publicados: los cambios quedan pendientes hasta la vista previa', async ({ page }) => {
  await ingresar(page, u.multimedia);
  // Álbum publicado del diseño: se edita una copia de prueba
  await page.goto('/admin/galerias');
  await page.getByRole('button', { name: '+ Nuevo álbum' }).click();
  await page.locator('[data-editor-album][data-listo]').waitFor();
  const titulo = `Álbum publicado ${marca}`;
  await page.getByLabel('Título del álbum').fill(titulo);
  await guardarAlbum(page);
  await page.getByRole('button', { name: 'Vista previa' }).click();
  await page.getByRole('button', { name: 'Publicar ahora' }).click();
  await expect(page).toHaveURL(/aviso=publicado/);
  const a = await leerAlbum(titulo);
  await page.locator('[data-editor-album][data-listo]').waitFor();

  await page.getByLabel('Descripción (opcional) · 0/200').fill('Descripción nueva');
  await guardarAlbum(page);
  await expect(page.locator('[data-cambios-pendientes]')).toBeVisible();
  expect(await (await page.request.get(`/galeria/${a.slug}`)).text()).not.toContain('Descripción nueva');
  await page.goto(`/admin/galerias/${a.id}/vista-previa`);
  await expect(page.locator('[data-vista-previa-contenido]')).toContainText('Descripción nueva');
  await page.getByRole('button', { name: 'Publicar los cambios' }).click();
  await expect(page).toHaveURL(/aviso=cambios-publicados/);
  expect(await (await page.request.get(`/galeria/${a.slug}`)).text()).toContain('Descripción nueva');

  // Video publicado
  await page.goto('/admin/videos/nuevo');
  await page.locator('form[data-listo]').waitFor();
  const tv = `Video publicado ${marca}`;
  await page.getByLabel('Enlace de YouTube').fill('https://www.youtube.com/watch?v=XIn6jmUKxH0');
  await page.getByLabel(/^Título/).fill(tv);
  await page.getByLabel('Dónde aparece').selectOption({ label: `Galería › ${titulo}` });
  await page.getByRole('button', { name: 'Agregar video' }).click();
  await expect(page.getByText('Video agregado.')).toBeVisible();
  await page.getByRole('link', { name: 'Vista previa' }).click();
  await page.getByRole('button', { name: 'Publicar ahora' }).click();
  await expect(page.getByText('Video publicado en el sitio.')).toBeVisible();

  await page.locator('form[data-listo]').waitFor();
  await page.getByLabel(/^Título/).fill(`${tv} corregido`);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('[data-cambios-pendientes]')).toBeVisible();
  await expect(page.locator('[data-publicar-cambios]')).toBeDisabled();
  expect(await (await page.request.get(`/galeria/${a.slug}`)).text()).not.toContain(`${tv} corregido`);
  await page.getByRole('link', { name: 'Vista previa' }).click();
  await expect(page.locator('[data-vista-previa-contenido]')).toContainText(`${tv} corregido`);
  await page.getByRole('button', { name: 'Publicar los cambios' }).click();
  await expect(page.getByText('Cambios publicados en el sitio.')).toBeVisible();
  expect(await (await page.request.get(`/galeria/${a.slug}`)).text()).toContain(`${tv} corregido`);
});
