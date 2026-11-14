// Prueba de integración contra el Supabase LOCAL: inicio de sesión real,
// doble factor (TOTP), API REST y Storage.
//
// Uso (después de `supabase start` y `supabase db reset`):
//   eval "$(supabase status -o env)"   # exporta API_URL, ANON_KEY, SERVICE_ROLE_KEY
//   node --test supabase/tests/api/
//
// Las claves se leen del entorno; nunca se escriben en el repositorio.
// Crea usuarios ficticios con correos aleatorios; `supabase db reset` los elimina.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const URL_API = process.env.API_URL ?? process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const SERVICIO = process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_API)) {
  throw new Error(`Esta prueba es solo para el entorno local (${URL_API}).`);
}
if (!ANON || !SERVICIO) throw new Error('Faltan ANON_KEY y SERVICE_ROLE_KEY (ver: supabase status -o env).');

const FOTO = readFileSync(fileURLToPath(new URL('../../../design/fotos/05238004edcc733d035cca963adbfdec.jpg', import.meta.url)));

async function api(ruta, { token = ANON, metodo = 'GET', cuerpo, cabeceras = {} } = {}) {
  const r = await fetch(URL_API + ruta, {
    method: metodo,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      ...(cuerpo && !(cuerpo instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}),
      ...cabeceras,
    },
    body: cuerpo instanceof Uint8Array ? cuerpo : cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  let datos;
  try { datos = JSON.parse(texto); } catch { datos = texto; }
  return { estado: r.status, datos };
}

const admin = (ruta, op = {}) => api(ruta, { ...op, token: SERVICIO, cabeceras: { apikey: SERVICIO, ...(op.cabeceras ?? {}) } });

// TOTP (RFC 6238) para simular la app autenticadora.
function base32(s) {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secreto) {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac('sha1', base32(secreto)).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}

const sufijo = randomUUID().slice(0, 8);
const usuarios = {};

async function crearUsuario(nombre, roles) {
  const correo = `${nombre}-${sufijo}@prueba.test`;
  const clave = randomBytes(18).toString('base64url');
  const u = await admin('/auth/v1/admin/users', {
    metodo: 'POST',
    cuerpo: { email: correo, password: clave, email_confirm: true, user_metadata: { nombre } },
  });
  assert.equal(u.estado, 200, JSON.stringify(u.datos));
  const perfil = await admin(`/rest/v1/perfiles?user_id=eq.${u.datos.id}&select=id`);
  assert.equal(perfil.datos.length, 1, 'el trigger crea el perfil');
  for (const rol of roles) {
    const r = await admin('/rest/v1/perfil_roles', { metodo: 'POST', cuerpo: { perfil_id: perfil.datos[0].id, rol } });
    assert.equal(r.estado, 201, JSON.stringify(r.datos));
  }
  const s = await api('/auth/v1/token?grant_type=password', { metodo: 'POST', cuerpo: { email: correo, password: clave } });
  assert.equal(s.estado, 200, JSON.stringify(s.datos));
  return { id: u.datos.id, token: s.datos.access_token };
}

before(async () => {
  usuarios.super = await crearUsuario('super', ['superadmin']);
  usuarios.editor = await crearUsuario('editor', ['editor']);
  usuarios.multimedia = await crearUsuario('multimedia', ['multimedia']);
});

test('el registro público de cuentas está desactivado', async () => {
  const r = await api('/auth/v1/signup', { metodo: 'POST', cuerpo: { email: `x-${sufijo}@prueba.test`, password: randomBytes(18).toString('base64url') } });
  assert.notEqual(r.estado, 200);
});

test('visitante: lee lo publicado y no escribe', async () => {
  const a = await api('/rest/v1/articulos?select=slug,estado');
  assert.equal(a.estado, 200);
  assert.ok(a.datos.length >= 6);
  assert.ok(a.datos.every((x) => x.estado === 'publicado' || x.estado === 'programado'));

  const c = await api('/rest/v1/configuracion?select=modo_mantenimiento,instagram_url');
  assert.equal(c.datos[0].instagram_url, 'https://www.instagram.com/jiump.oficial');

  const w = await api('/rest/v1/articulos', { metodo: 'POST', cuerpo: { titulo: 'x', slug: `x-${sufijo}` } });
  assert.ok([401, 403].includes(w.estado), `esperaba 401/403, llegó ${w.estado}`);

  const reg = await api('/rest/v1/registro_actividad?select=id');
  assert.ok([401, 403].includes(reg.estado));

  const b = await api('/rest/v1/rpc/buscar_articulos', { metodo: 'POST', cuerpo: { q: 'imprenta' } });
  assert.deepEqual(b.datos.map((x) => x.slug), ['de-los-rollos-a-la-imprenta']);
});

test('visitante: descarga fotos publicadas y al listar el bucket solo ve las publicadas', async () => {
  const f = await fetch(`${URL_API}/storage/v1/object/public/fotos/diseno/784625ac3ebfe474ed6261cca016b8df.jpg`);
  assert.equal(f.status, 200, 'ejecuta antes supabase/scripts/subir-fotos-diseno.sh');

  const l = await api('/storage/v1/object/list/fotos', { metodo: 'POST', cuerpo: { prefix: 'diseno/', limit: 1000 } });
  const listadas = l.datos.map((o) => `diseno/${o.name}`).sort();
  const publicas = (await api('/rest/v1/fotos?select=archivo')).datos.map((x) => x.archivo).sort();
  assert.ok(listadas.length > 0);
  assert.deepEqual(listadas, publicas, 'el listado coincide con las fotos usadas en contenido publicado');
  // El logo blanco (solo en la plantilla) no está en contenido publicado.
  assert.ok(!listadas.includes('diseno/db0c2611e98a7044788aa3869a3d21f9.png'));

  const todas = (await admin('/rest/v1/fotos?select=archivo&archivo=like.diseno/*')).datos;
  assert.ok(todas.length > publicas.length, 'hay fotos de la biblioteca que el visitante no ve');
});

test('editor: sube a su carpeta, no a la ajena, y no borra fotos de otros', async () => {
  const { editor, multimedia } = usuarios;
  const propia = await api(`/storage/v1/object/fotos/${editor.id}/${randomUUID()}.jpg`, {
    token: editor.token, metodo: 'POST', cuerpo: new Uint8Array(FOTO), cabeceras: { 'Content-Type': 'image/jpeg' },
  });
  assert.equal(propia.estado, 200, JSON.stringify(propia.datos));

  const ajena = await api(`/storage/v1/object/fotos/${multimedia.id}/${randomUUID()}.jpg`, {
    token: editor.token, metodo: 'POST', cuerpo: new Uint8Array(FOTO), cabeceras: { 'Content-Type': 'image/jpeg' },
  });
  assert.notEqual(ajena.estado, 200);

  const deMultimedia = `${multimedia.id}/${randomUUID()}.jpg`;
  const subida = await api(`/storage/v1/object/fotos/${deMultimedia}`, {
    token: multimedia.token, metodo: 'POST', cuerpo: new Uint8Array(FOTO), cabeceras: { 'Content-Type': 'image/jpeg' },
  });
  assert.equal(subida.estado, 200, JSON.stringify(subida.datos));

  const borrar = await api('/storage/v1/object/fotos', { token: editor.token, metodo: 'DELETE', cuerpo: { prefixes: [deMultimedia] } });
  assert.deepEqual(borrar.datos, [], 'el editor no debería poder borrar la foto de multimedia');

  const borrarPropia = await api('/storage/v1/object/fotos', { token: multimedia.token, metodo: 'DELETE', cuerpo: { prefixes: [deMultimedia] } });
  assert.equal(borrarPropia.datos.length, 1);
});

test('solo se aceptan imágenes en el bucket', async () => {
  const r = await api(`/storage/v1/object/fotos/${usuarios.editor.id}/${randomUUID()}.txt`, {
    token: usuarios.editor.token, metodo: 'POST', cuerpo: new TextEncoder().encode('hola'), cabeceras: { 'Content-Type': 'text/plain' },
  });
  assert.notEqual(r.estado, 200);
});

test('superadmin: sin doble factor no administra; con TOTP verificado sí', async () => {
  const { super: s } = usuarios;
  const sin2fa = await api('/rest/v1/configuracion?id=eq.true', {
    token: s.token, metodo: 'PATCH', cuerpo: { modo_mantenimiento: true }, cabeceras: { Prefer: 'return=representation' },
  });
  assert.deepEqual(sin2fa.datos, [], 'sin aal2 no debe modificar nada');

  const factor = await api('/auth/v1/factors', { token: s.token, metodo: 'POST', cuerpo: { factor_type: 'totp', friendly_name: 'prueba' } });
  assert.equal(factor.estado, 200, JSON.stringify(factor.datos));
  const reto = await api(`/auth/v1/factors/${factor.datos.id}/challenge`, { token: s.token, metodo: 'POST', cuerpo: {} });
  const verif = await api(`/auth/v1/factors/${factor.datos.id}/verify`, {
    token: s.token, metodo: 'POST', cuerpo: { challenge_id: reto.datos.id, code: totp(factor.datos.totp.secret) },
  });
  assert.equal(verif.estado, 200, JSON.stringify(verif.datos));
  const tokenAal2 = verif.datos.access_token;

  const con2fa = await api('/rest/v1/configuracion?id=eq.true', {
    token: tokenAal2, metodo: 'PATCH', cuerpo: { modo_mantenimiento: true }, cabeceras: { Prefer: 'return=representation' },
  });
  assert.equal(con2fa.datos[0]?.modo_mantenimiento, true);

  const reg = await api('/rest/v1/registro_actividad?tabla=eq.configuracion&select=accion', { token: tokenAal2 });
  assert.ok(reg.datos.length >= 1, 'el cambio queda en el registro de actividad');

  // Dejar el sitio como estaba.
  await api('/rest/v1/configuracion?id=eq.true', { token: tokenAal2, metodo: 'PATCH', cuerpo: { modo_mantenimiento: false } });
});
