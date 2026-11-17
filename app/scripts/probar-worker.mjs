#!/usr/bin/env node
/**
 * Pruebas del Worker de Cloudflare en local (`wrangler dev`) con Supabase local.
 * Comprueba lo que no cubre Playwright (que corre contra `next start`):
 * las páginas guardadas, la política de contenido con valor nuevo en cada
 * visita, que un cambio en la base se note al instante, el mantenimiento,
 * las redirecciones y las cabeceras de los archivos estáticos.
 *
 * Uso: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/probar-worker.mjs http://127.0.0.1:8787
 * Deja la base como estaba (restaura lo que cambia).
 */
import assert from 'node:assert/strict';

const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const { SUPABASE_URL: api, SUPABASE_SERVICE_ROLE_KEY: servicio } = process.env;
if (!api || !servicio) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (de `supabase status`).');
  process.exit(2);
}

const db = async (ruta, metodo, cuerpo) => {
  const r = await fetch(`${api}/rest/v1/${ruta}`, {
    method: metodo,
    headers: { apikey: servicio, Authorization: `Bearer ${servicio}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  assert.ok(r.ok, `Supabase ${metodo} ${ruta}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
};
const pedir = async (ruta, opciones = {}) => {
  const r = await fetch(new URL(ruta, base), { redirect: 'manual', ...opciones });
  return { r, html: opciones.method === 'HEAD' ? '' : await r.text(), guardada: r.headers.get('x-jiump-pagina') };
};
const nonceDe = (csp) => /'nonce-([^']+)'/.exec(csp ?? '')?.[1];

let fallas = 0;
async function prueba(nombre, fn) {
  try { await fn(); console.log(`✔ ${nombre}`); } catch (e) { fallas++; console.log(`✘ ${nombre}\n  ${e.message}`); }
}

await prueba('Una página pública se guarda y la siguiente visita la entrega guardada', async () => {
  await pedir('/nosotros');
  const { r, guardada } = await pedir('/nosotros');
  assert.equal(r.status, 200);
  assert.equal(guardada, 'HIT');
});

await prueba('Cada visita a una página guardada lleva un valor nuevo en la política de contenido, el mismo de sus scripts', async () => {
  const a = await pedir('/nosotros');
  const b = await pedir('/nosotros');
  const [na, nb] = [nonceDe(a.r.headers.get('content-security-policy')), nonceDe(b.r.headers.get('content-security-policy'))];
  assert.ok(na && nb, 'falta el valor en la política');
  assert.notEqual(na, nb, 'dos visitas con el mismo valor');
  const scripts = [...b.html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]).filter((s) => !s.includes('application/ld+json'));
  assert.ok(scripts.length > 0, 'la página no trae scripts');
  for (const s of scripts) assert.ok(s.includes(`nonce="${nb}"`), `script sin el valor de esta visita: ${s.slice(0, 120)}`);
  assert.equal(b.r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(b.r.headers.get('x-frame-options'), 'DENY');
  assert.match(b.r.headers.get('cache-control') ?? '', /no-store/);
});

await prueba('HEAD de una página guardada responde 200 sin cuerpo', async () => {
  const { r } = await pedir('/nosotros', { method: 'HEAD' });
  assert.equal(r.status, 200);
});

await prueba('Editar un artículo publicado se ve al instante (la página guardada deja de usarse)', async () => {
  const [articulo] = await db('articulos?select=id,slug,titulo&estado=eq.publicado&limit=1', 'GET');
  assert.ok(articulo, 'no hay artículos publicados en la base local');
  await pedir(`/articulos/${articulo.slug}`);
  assert.equal((await pedir(`/articulos/${articulo.slug}`)).guardada, 'HIT');
  const nuevo = `${articulo.titulo} (prueba del Worker)`;
  await db(`articulos?id=eq.${articulo.id}`, 'PATCH', { titulo: nuevo });
  try {
    const { html, guardada } = await pedir(`/articulos/${articulo.slug}`);
    assert.equal(guardada, 'MISS');
    assert.ok(html.includes('(prueba del Worker)'), 'no aparece el título nuevo');
  } finally {
    await db(`articulos?id=eq.${articulo.id}`, 'PATCH', { titulo: articulo.titulo });
  }
});

await prueba('Una redirección nueva funciona al instante, aunque la página estuviera guardada', async () => {
  await pedir('/nosotros');
  const [fila] = await db('redirecciones', 'POST', { origen: '/nosotros', destino: '/eventos' });
  try {
    const { r } = await pedir('/nosotros');
    assert.equal(r.status, 301);
    assert.match(r.headers.get('location') ?? '', /\/eventos$/);
  } finally {
    await db(`redirecciones?id=eq.${fila.id}`, 'DELETE');
  }
  assert.equal((await pedir('/nosotros')).r.status, 200);
});

await prueba('El modo mantenimiento se aplica al instante y se quita al instante', async () => {
  await pedir('/');
  await db('configuracion?id=eq.true', 'PATCH', { modo_mantenimiento: true });
  try {
    assert.equal((await pedir('/')).r.status, 503);
  } finally {
    await db('configuracion?id=eq.true', 'PATCH', { modo_mantenimiento: false });
  }
  assert.equal((await pedir('/')).r.status, 200);
});

await prueba('El panel nunca se guarda', async () => {
  await pedir('/admin/ingresar');
  const { guardada } = await pedir('/admin/ingresar');
  assert.notEqual(guardada, 'HIT');
});

await prueba('Las búsquedas no se guardan (no gastan escrituras de KV)', async () => {
  await pedir('/articulos?q=biblia');
  assert.equal((await pedir('/articulos?q=biblia')).guardada, 'BYPASS');
});

await prueba('Parámetros que no cambian la página usan la misma página guardada', async () => {
  await pedir('/eventos');
  assert.equal((await pedir('/eventos?utm_source=whatsapp')).guardada, 'HIT');
});

await prueba('Una dirección inexistente responde 404 y no se guarda', async () => {
  const { r, guardada } = await pedir('/no-existe-prueba-worker');
  assert.equal(r.status, 404);
  assert.notEqual(guardada, 'HIT');
});

await prueba('Los archivos estáticos llevan las cabeceras de seguridad (_headers)', async () => {
  const { r } = await pedir('/marca/logo-jiump.png');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
});

if (fallas) {
  console.error(`\n${fallas} prueba(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las pruebas del Worker pasaron.');
