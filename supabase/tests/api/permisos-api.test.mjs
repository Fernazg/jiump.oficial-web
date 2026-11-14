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
  return { id: u.datos.id, perfil: perfil.datos[0].id, token: s.datos.access_token, refresh: s.datos.refresh_token, correo, clave };
}

async function asignarRol(usuario, rol) {
  const r = await admin('/rest/v1/perfil_roles', { metodo: 'POST', cuerpo: { perfil_id: usuario.perfil, rol } });
  assert.equal(r.estado, 201, JSON.stringify(r.datos));
}

// Inscribe y verifica un factor TOTP; devuelve el token aal2 de la misma sesión.
async function inscribirTotp(token) {
  const factor = await api('/auth/v1/factors', { token, metodo: 'POST', cuerpo: { factor_type: 'totp', friendly_name: randomUUID() } });
  assert.equal(factor.estado, 200, JSON.stringify(factor.datos));
  const reto = await api(`/auth/v1/factors/${factor.datos.id}/challenge`, { token, metodo: 'POST', cuerpo: {} });
  const verif = await api(`/auth/v1/factors/${factor.datos.id}/verify`, {
    token, metodo: 'POST', cuerpo: { challenge_id: reto.datos.id, code: totp(factor.datos.totp.secret) },
  });
  assert.equal(verif.estado, 200, JSON.stringify(verif.datos));
  return verif.datos.access_token;
}

const subir = (usuario, ruta) => api(`/storage/v1/object/fotos/${ruta}`, {
  token: usuario.token, metodo: 'POST', cuerpo: new Uint8Array(FOTO), cabeceras: { 'Content-Type': 'image/jpeg' },
});
const activarMantenimiento = (token, valor) => api('/rest/v1/configuracion?id=eq.true', {
  token, metodo: 'PATCH', cuerpo: { modo_mantenimiento: valor }, cabeceras: { Prefer: 'return=representation' },
});

before(async () => {
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

test('visitante: con el bucket privado solo obtiene fotos publicadas (URL firmadas)', async () => {
  const publicada = 'diseno/784625ac3ebfe474ed6261cca016b8df.jpg';
  const noPublicada = 'diseno/db0c2611e98a7044788aa3869a3d21f9.png'; // logo blanco: solo en la plantilla

  const urlPublica = await fetch(`${URL_API}/storage/v1/object/public/fotos/${publicada}`);
  assert.notEqual(urlPublica.status, 200, 'el bucket ya no se sirve por URL pública');

  const firmada = await api(`/storage/v1/object/sign/fotos/${publicada}`, { metodo: 'POST', cuerpo: { expiresIn: 3600 } });
  assert.equal(firmada.estado, 200, JSON.stringify(firmada.datos));
  const descarga = await fetch(`${URL_API}/storage/v1${firmada.datos.signedURL}`);
  assert.equal(descarga.status, 200, 'ejecuta antes supabase/scripts/subir-fotos-diseno.sh');

  const firmadaNo = await api(`/storage/v1/object/sign/fotos/${noPublicada}`, { metodo: 'POST', cuerpo: { expiresIn: 3600 } });
  assert.notEqual(firmadaNo.estado, 200, 'no se firma una foto no publicada');
  const directa = await api(`/storage/v1/object/authenticated/fotos/${noPublicada}`);
  assert.notEqual(directa.estado, 200, 'ni se descarga directamente');

  const l = await api('/storage/v1/object/list/fotos', { metodo: 'POST', cuerpo: { prefix: 'diseno/', limit: 1000 } });
  const listadas = l.datos.map((o) => `diseno/${o.name}`).sort();
  const publicas = (await api('/rest/v1/fotos?select=archivo')).datos.map((x) => x.archivo).sort();
  assert.ok(listadas.length > 0);
  assert.deepEqual(listadas, publicas, 'el listado coincide con las fotos usadas en contenido publicado');
  assert.ok(!listadas.includes(noPublicada));
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

  const mover = await api('/storage/v1/object/move', {
    token: editor.token, metodo: 'POST',
    cuerpo: { bucketId: 'fotos', sourceKey: propia.datos.Key.replace(/^fotos\//, ''), destinationKey: `${multimedia.id}/${randomUUID()}.jpg` },
  });
  assert.notEqual(mover.estado, 200, 'el editor no puede mover su foto a la carpeta de otra persona');

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

test('2FA: si el rol se asignó antes que el factor, quien robe la contraseña no obtiene el superadmin', async () => {
  const victima = await crearUsuario('victima', []);
  await asignarRol(victima, 'superadmin'); // rol asignado antes de inscribir el factor (flujo incorrecto)

  // El atacante solo tiene la contraseña: inicia sesión e inscribe SU factor.
  const sesion = await api('/auth/v1/token?grant_type=password', { metodo: 'POST', cuerpo: { email: victima.correo, password: victima.clave } });
  const tokenAtacante = await inscribirTotp(sesion.datos.access_token);
  const r = await activarMantenimiento(tokenAtacante, true);
  assert.deepEqual(r.datos, [], 'un factor posterior al rol no habilita al superadmin');
});

test('2FA: superadmin con factor inscrito antes del rol administra solo con sesión aal2', async () => {
  const s = await crearUsuario('super', []);
  const tokenAal2 = await inscribirTotp(s.token); // primero el factor…
  await asignarRol(s, 'superadmin');             // …después el rol

  const sesionSoloClave = await api('/auth/v1/token?grant_type=password', { metodo: 'POST', cuerpo: { email: s.correo, password: s.clave } });
  assert.deepEqual((await activarMantenimiento(sesionSoloClave.datos.access_token, true)).datos, [], 'aal1 no administra');

  const segundoFactor = await api('/auth/v1/factors', { token: sesionSoloClave.datos.access_token, metodo: 'POST', cuerpo: { factor_type: 'totp', friendly_name: 'ladron' } });
  assert.notEqual(segundoFactor.estado, 200, 'con solo la contraseña no se inscribe otro factor');

  assert.equal((await activarMantenimiento(tokenAal2, true)).datos[0]?.modo_mantenimiento, true, 'aal2 sí administra');
  const reg = await api('/rest/v1/registro_actividad?tabla=eq.configuracion&select=accion', { token: tokenAal2 });
  assert.ok(reg.datos.length >= 1, 'el cambio queda en el registro de actividad');
  await activarMantenimiento(tokenAal2, false);
});

test('cerrar sesión corta el acceso al instante, aunque el token aún no venza', async () => {
  const e = await crearUsuario('sale', ['editor']);
  assert.equal((await subir(e, `${e.id}/${randomUUID()}.jpg`)).estado, 200);
  await api('/auth/v1/logout', { token: e.token, metodo: 'POST' });
  assert.notEqual((await subir(e, `${e.id}/${randomUUID()}.jpg`)).estado, 200);
  const borradores = await api('/rest/v1/articulos?estado=eq.revision&select=id', { token: e.token });
  assert.deepEqual(borradores.datos, []);
});

test('desactivar a alguien corta su sesión abierta, su renovación y su inicio de sesión', async () => {
  const e = await crearUsuario('desactivado', ['editor']);
  assert.equal((await subir(e, `${e.id}/${randomUUID()}.jpg`)).estado, 200);

  const r = await admin(`/rest/v1/perfiles?id=eq.${e.perfil}`, { metodo: 'PATCH', cuerpo: { activo: false } });
  assert.equal(r.estado, 204, JSON.stringify(r.datos));

  assert.notEqual((await subir(e, `${e.id}/${randomUUID()}.jpg`)).estado, 200, 'el token abierto ya no sube fotos');
  const borradores = await api('/rest/v1/articulos?estado=eq.revision&select=id', { token: e.token });
  assert.deepEqual(borradores.datos, [], 'ni ve borradores');
  const renovar = await api('/auth/v1/token?grant_type=refresh_token', { metodo: 'POST', cuerpo: { refresh_token: e.refresh } });
  assert.notEqual(renovar.estado, 200, 'no puede renovar la sesión');
  const login = await api('/auth/v1/token?grant_type=password', { metodo: 'POST', cuerpo: { email: e.correo, password: e.clave } });
  assert.notEqual(login.estado, 200, 'no puede volver a entrar');

  await admin(`/rest/v1/perfiles?id=eq.${e.perfil}`, { metodo: 'PATCH', cuerpo: { activo: true } });
  const otraVez = await api('/auth/v1/token?grant_type=password', { metodo: 'POST', cuerpo: { email: e.correo, password: e.clave } });
  assert.equal(otraVez.estado, 200, 'al reactivarlo vuelve a entrar');
});
