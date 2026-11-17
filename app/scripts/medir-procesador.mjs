#!/usr/bin/env node
/**
 * Mide el tiempo de procesador por solicitud del Worker local (`wrangler dev`).
 *
 * El Worker local no informa el procesador de cada solicitud. Este script lee
 * el tiempo de procesador acumulado de TODOS los procesos `workerd` (el motor
 * de Cloudflare) antes y después de N solicitudes seguidas a cada página, y
 * divide.
 *
 * Dos columnas:
 *  · Total: todo el procesador de workerd. Incluye el proxy interno de
 *    `wrangler dev` y el KV simulado, que en Cloudflare no se cobran al Worker.
 *    Es una cota superior.
 *  · Neto: el total menos el «piso» de `wrangler dev` para una respuesta del
 *    mismo tamaño. El piso se mide con dos archivos estáticos de distinto
 *    tamaño (MEDIR_PISO), que en local pasan por el mismo proxy pero en
 *    Cloudflare no ejecutan el Worker, y se ajusta una recta por tamaño.
 *
 * Uso:  node scripts/medir-procesador.mjs <url-base> <ruta> [<ruta>…]
 *       MEDIR_N=40 MEDIR_LIMITE=10 MEDIR_PISO=/marca/logo-jiump.png,/_next/static/chunks/x.js \
 *         node scripts/medir-procesador.mjs http://127.0.0.1:8787 / /nosotros
 * Sale con código 1 si alguna página pasa de MEDIR_LIMITE ms (en Neto si hay
 * MEDIR_PISO; si no, en Total).
 */
import { readdirSync, readFileSync } from 'node:fs';

const [base, ...rutas] = process.argv.slice(2);
if (!base || rutas.length === 0) {
  console.error('Uso: node scripts/medir-procesador.mjs <url-base> <ruta> [<ruta>…]');
  process.exit(2);
}
const N = Number(process.env.MEDIR_N ?? 40);
const LIMITE = process.env.MEDIR_LIMITE ? Number(process.env.MEDIR_LIMITE) : undefined;
const TICS_POR_SEGUNDO = 100; // _SC_CLK_TCK en Linux

/** Procesador acumulado (ms) de todos los procesos workerd. */
function procesadorWorkerd() {
  let tics = 0;
  for (const pid of readdirSync('/proc').filter((d) => /^\d+$/.test(d))) {
    try {
      const comm = readFileSync(`/proc/${pid}/comm`, 'utf8').trim();
      if (comm !== 'workerd') continue;
      const campos = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
      tics += Number(campos[11]) + Number(campos[12]); // utime + stime
    } catch { /* el proceso terminó */ }
  }
  return (tics * 1000) / TICS_POR_SEGUNDO;
}

async function pedir(url) {
  const r = await fetch(url, { redirect: 'manual' });
  const bytes = (await r.arrayBuffer()).byteLength;
  return { estado: r.status, bytes, guardada: r.headers.get('x-jiump-pagina') ?? '' };
}

/** Procesador promedio por solicitud (ms) y la última respuesta. */
async function medir(ruta) {
  const url = new URL(ruta, base).toString();
  let r;
  for (let i = 0; i < 3; i++) r = await pedir(url); // calentar (la primera vez se arma y se guarda)
  const antes = procesadorWorkerd();
  for (let i = 0; i < N; i++) r = await pedir(url);
  return { ms: (procesadorWorkerd() - antes) / N, ...r };
}

if (procesadorWorkerd() === 0) {
  console.error('No encontré procesos workerd: ¿está corriendo `wrangler dev`?');
  process.exit(2);
}

// Piso de `wrangler dev` según el tamaño de la respuesta (recta entre dos archivos estáticos).
let piso = () => 0;
const rutasPiso = (process.env.MEDIR_PISO ?? '').split(',').filter(Boolean);
if (rutasPiso.length === 2) {
  const [a, b] = [await medir(rutasPiso[0]), await medir(rutasPiso[1])];
  const pendiente = (b.ms - a.ms) / (b.bytes - a.bytes);
  piso = (bytes) => Math.max(0, a.ms + pendiente * (bytes - a.bytes));
  console.log(`Piso de wrangler dev: ${a.ms.toFixed(1)} ms con ${a.bytes} bytes, ${b.ms.toFixed(1)} ms con ${b.bytes} bytes.\n`);
}
const conPiso = rutasPiso.length === 2;

let excedidas = 0;
console.log(`| Página | Estado | Guardada | Bytes | Total | Neto${conPiso ? '' : ' (sin piso)'} |`);
console.log('|---|---|---|---|---|---|');
for (const ruta of rutas) {
  const { ms, estado, bytes, guardada } = await medir(ruta);
  const neto = ms - piso(bytes);
  const pasa = LIMITE !== undefined && (conPiso ? neto : ms) >= LIMITE;
  if (pasa) excedidas++;
  console.log(`| \`${ruta}\` | ${estado} | ${guardada || '—'} | ${bytes} | ${ms.toFixed(1)} ms | ${conPiso ? `${neto.toFixed(1)} ms` : '—'}${pasa ? ' ❌' : ''} |`);
}
if (excedidas) {
  console.error(`${excedidas} página(s) en ${LIMITE} ms o más.`);
  process.exit(1);
}
