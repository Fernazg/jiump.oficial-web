/**
 * Apoyo para las pruebas del panel /admin: crea usuarios de prueba por rol en
 * el Supabase LOCAL (con la service role del entorno; solo las pruebas la
 * usan, nunca el panel) y simula la app autenticadora (TOTP).
 */
import { expect, type Page } from '@playwright/test';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { admin, exigirLocal } from './apoyo';

const URL_API = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export type Rol = 'superadmin' | 'editor' | 'eventos' | 'multimedia';
export type Usuario = { id: string; perfil: string; nombre: string; correo: string; clave: string; secreto?: string };

async function auth<T>(ruta: string, { token = ANON, metodo = 'POST', cuerpo, servicio = false }: { token?: string; metodo?: string; cuerpo?: unknown; servicio?: boolean } = {}): Promise<T> {
  exigirLocal();
  const clave = servicio ? SERVICIO : ANON;
  const r = await fetch(`${URL_API}/auth/v1/${ruta}`, {
    method: metodo,
    headers: { apikey: clave, Authorization: `Bearer ${servicio ? SERVICIO : token}`, 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} auth/${ruta}: ${r.status} ${texto}`);
  return (texto ? JSON.parse(texto) : null) as T;
}

// ---------------------------------------------------------------------------
// TOTP (RFC 6238), como la app autenticadora
// ---------------------------------------------------------------------------
function base32(s: string) {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
export function totp(secreto: string, desfase = 0): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + desfase));
  const h = createHmac('sha1', base32(secreto)).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}

async function inscribirFactor(token: string): Promise<string> {
  const f = await auth<{ id: string; totp: { secret: string } }>('factors', { token, cuerpo: { factor_type: 'totp', friendly_name: randomUUID() } });
  const reto = await auth<{ id: string }>(`factors/${f.id}/challenge`, { token, cuerpo: {} });
  await auth(`factors/${f.id}/verify`, { token, cuerpo: { challenge_id: reto.id, code: totp(f.totp.secret) } });
  return f.totp.secret;
}

const sufijo = randomUUID().slice(0, 6);

/**
 * Crea una persona del equipo. Con `dobleFactor`, inscribe su TOTP ANTES de
 * asignarle los roles (así lo exige la base para Superadministrador).
 */
export async function crearUsuario(nombre: string, roles: Rol[], { dobleFactor = roles.includes('superadmin') } = {}): Promise<Usuario> {
  const correo = `${nombre.normalize('NFD').replace(/[^a-zA-Z ]/g, '').toLowerCase().replace(/\s+/g, '-')}-${sufijo}-${randomUUID().slice(0, 4)}@prueba.test`;
  const clave = randomBytes(18).toString('base64url');
  const u = await auth<{ id: string }>('admin/users', { servicio: true, cuerpo: { email: correo, password: clave, email_confirm: true, user_metadata: { nombre } } });
  const [perfil] = await admin<{ id: string }[]>(`perfiles?user_id=eq.${u.id}&select=id`);
  let secreto: string | undefined;
  if (dobleFactor) {
    const sesion = await auth<{ access_token: string }>('token?grant_type=password', { cuerpo: { email: correo, password: clave } });
    secreto = await inscribirFactor(sesion.access_token);
    await new Promise((r) => setTimeout(r, 1100)); // el rol se asigna DESPUÉS del factor
  }
  for (const rol of roles) await admin('perfil_roles', 'POST', { perfil_id: perfil.id, rol });
  return { id: u.id, perfil: perfil.id, nombre, correo, clave, secreto };
}

export async function desactivar(u: Usuario, activo = false) {
  await admin(`perfiles?id=eq.${u.perfil}`, 'PATCH', { activo });
}

export async function enlaceRecuperacion(correo: string): Promise<string> {
  const r = await auth<{ hashed_token: string }>('admin/generate_link', { servicio: true, cuerpo: { type: 'recovery', email: correo } });
  return `/admin/auth/confirmar?token_hash=${r.hashed_token}&type=recovery&siguiente=/admin/nueva-clave`;
}

/** Último código usado por secreto: el servidor no acepta el mismo código dos veces. */
const usados = new Map<string, string>();
export async function codigoNuevo(secreto: string): Promise<string> {
  for (;;) {
    const c = totp(secreto);
    if (usados.get(secreto) !== c) { usados.set(secreto, c); return c; }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** Inicia sesión por la interfaz (y el segundo factor si lo tiene). */
/** Espera a que los formularios de la página estén activos (JavaScript cargado). */
export async function listo(page: Page) {
  await page.locator('form[data-listo]').first().waitFor();
}

export async function ingresar(page: Page, u: Usuario, destino = '/admin') {
  await page.goto(`/admin/ingresar${destino !== '/admin' ? `?siguiente=${encodeURIComponent(destino)}` : ''}`);
  await listo(page);
  await page.getByLabel('Correo').fill(u.correo);
  await page.getByLabel('Contraseña').fill(u.clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  if (u.secreto) {
    await expect(page).toHaveURL(/\/admin\/verificar/);
    await listo(page);
    await page.getByLabel('Código').fill(await codigoNuevo(u.secreto));
    await page.getByRole('button', { name: 'Verificar' }).click();
  }
  await expect(page).not.toHaveURL(/\/admin\/(ingresar|verificar)/);
}

// ---------------------------------------------------------------------------
// Storage (fotos de prueba)
// ---------------------------------------------------------------------------
export async function listarArchivos(carpeta: string): Promise<string[]> {
  exigirLocal();
  const r = await fetch(`${URL_API}/storage/v1/object/list/fotos`, {
    method: 'POST',
    headers: { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: carpeta, limit: 1000 }),
  });
  const lista = (await r.json()) as { name: string; id: string | null }[];
  const salida: string[] = [];
  for (const x of lista) {
    if (x.id) salida.push(`${carpeta}/${x.name}`);
    else salida.push(...(await listarArchivos(`${carpeta}/${x.name}`)));
  }
  return salida;
}

/** Borra las fotos de prueba de una persona: filas y archivos (original y versiones). */
export async function borrarFotosDe(u: Usuario) {
  await admin(`fotos?creado_por=eq.${u.id}`, 'DELETE');
  const archivos = await listarArchivos(u.id);
  if (archivos.length) {
    await fetch(`${URL_API}/storage/v1/object/fotos`, {
      method: 'DELETE',
      headers: { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: archivos }),
    });
  }
}
