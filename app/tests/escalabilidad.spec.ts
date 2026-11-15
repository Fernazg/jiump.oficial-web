import { expect, test } from '@playwright/test';
import { leerTodo } from '../src/lib/leer-todo';
import { admin } from './apoyo';
import { crearUsuario, ingresar, type Usuario } from './apoyo-admin';

/**
 * Escalabilidad: las listas no se cortan en 1.000 filas y la biblioteca de
 * fotos se pagina (solo se firman y dibujan las fotos de la página).
 */
test.describe('leerTodo: lectura completa por tramos', () => {
  const tabla = Array.from({ length: 2350 }, (_, i) => ({ id: i }));
  const consulta = (filas: { id: number }[]) => async (desde: number, hasta: number) => ({ data: filas.slice(desde, hasta + 1), error: null });

  test('junta todos los tramos (2.350 filas, más que el tope de 1.000 por consulta)', async () => {
    const todo = await leerTodo<{ id: number }>(consulta(tabla));
    expect(todo).toHaveLength(2350);
    expect(todo[2349].id).toBe(2349);
  });
  test('con menos de 1.000 filas hace una sola consulta', async () => {
    let llamadas = 0;
    const todo = await leerTodo<{ id: number }>(async (d, h) => { llamadas++; return { data: tabla.slice(0, 10).slice(d, h + 1), error: null }; });
    expect(todo).toHaveLength(10);
    expect(llamadas).toBe(1);
  });
  test('un múltiplo exacto de 1.000 no pierde ni repite filas', async () => {
    expect(await leerTodo(consulta(tabla.slice(0, 2000)))).toHaveLength(2000);
  });
  test('si un tramo falla, avisa en vez de entregar una lista incompleta', async () => {
    await expect(leerTodo(async (d) => (d === 0 ? { data: tabla.slice(0, 1000), error: null } : { data: null, error: { message: 'sin conexión' } }), 'las fotos'))
      .rejects.toThrow('No se pudo leer las fotos: sin conexión');
  });
});

test.describe('biblioteca de fotos paginada', () => {
  const marca = Date.now().toString(36);
  const u: Record<string, Usuario> = {};
  test.beforeAll(async () => {
    u.multimedia = await crearUsuario('Paz Paginada', ['multimedia']);
    // 70 fotos de prueba (solo las filas; sus miniaturas no importan aquí).
    await admin('fotos', 'POST', Array.from({ length: 70 }, (_, i) => ({
      archivo: `paginacion-${marca}/foto-${String(i).padStart(2, '0')}.jpg`, ancho: 1200, alto: 800, texto_alternativo: `Paginada ${marca} número ${i}`,
    })));
  });
  test.afterAll(async () => {
    await admin(`fotos?archivo=like.paginacion-${marca}/*`, 'DELETE');
  });

  test('muestra 60 por página, permite avanzar y conserva la página al elegir una foto', async ({ page }) => {
    await ingresar(page, u.multimedia);
    await page.goto(`/admin/fotos?q=${encodeURIComponent(`Paginada ${marca}`)}`);
    await expect(page.getByText('70 fotos · página 1 de 2')).toBeVisible();
    await expect(page.locator('[data-foto]')).toHaveCount(60);

    const paginas = page.locator('[data-paginas-fotos]');
    await expect(paginas.getByRole('link', { name: /Más recientes/ })).toHaveCount(0);
    await paginas.getByRole('link', { name: /Anteriores/ }).click();
    await expect(page).toHaveURL(/pagina=2/);
    await expect(page.getByText('70 fotos · página 2 de 2')).toBeVisible();
    await expect(page.locator('[data-foto]')).toHaveCount(10);
    await expect(paginas.getByRole('link', { name: /Anteriores/ })).toHaveCount(0);

    // Elegir una foto de la página 2 no devuelve a la página 1.
    await page.locator('[data-foto]').first().click();
    await expect(page).toHaveURL(/pagina=2/);
    await expect(page).toHaveURL(/foto=/);
    await expect(page.locator('[data-foto]')).toHaveCount(10);

    // Cambiar el filtro vuelve a la primera página.
    await page.getByRole('navigation', { name: 'Filtrar fotos' }).getByRole('link', { name: 'Sin usar' }).click();
    await expect(page).not.toHaveURL(/pagina=/);
    await expect(page.getByText('70 fotos · página 1 de 2')).toBeVisible();
  });

  test('una página que no existe muestra la última, sin error', async ({ page }) => {
    await ingresar(page, u.multimedia);
    const r = await page.goto(`/admin/fotos?q=${encodeURIComponent(`Paginada ${marca}`)}&pagina=99`);
    expect(r?.status()).toBe(200);
    await expect(page.getByText('70 fotos · página 2 de 2')).toBeVisible();
    await page.goto(`/admin/fotos?q=${encodeURIComponent(`Paginada ${marca}`)}&pagina=abc`);
    await expect(page.getByText('70 fotos · página 1 de 2')).toBeVisible();
  });
});
