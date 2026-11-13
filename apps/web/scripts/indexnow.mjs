/**
 * Avisa a los buscadores de URLs nuevas o cambiadas de genpm.net, vía IndexNow.
 *
 * Por qué hace falta aquí: Google no participa en IndexNow, pero Bing y Yandex
 * aceptan el POST al instante, y Bing es el índice que alimenta las respuestas
 * de ChatGPT y Copilot. Para una sección de contenido recién publicada eso es
 * la diferencia entre aparecer hoy en los asistentes o esperar al rastreo.
 * Google se pide aparte desde Search Console.
 *
 * El registro ya avisa de las páginas de paquete desde el Worker
 * (apps/registry/src/services/indexnow.ts). Esto cubre lo que publica la web:
 * sin argumentos envía el índice de guías y todas las guías.
 *
 * Uso:
 *   node scripts/indexnow.mjs                      # /guides y todas las guías
 *   node scripts/indexnow.mjs /guides/mi-guia      # rutas sueltas
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = 'genpm.net';
const SITE = `https://${HOST}`;

// La clave es pública por diseño: el buscador la lee de la raíz del sitio para
// comprobar que quien envía las URLs controla el dominio.
const PUBLIC_DIR = resolve(HERE, '../public');
const keyFile = readdirSync(PUBLIC_DIR).find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) {
  console.error('No encuentro el fichero de clave de IndexNow en apps/web/public/.');
  process.exit(1);
}
const key = readFileSync(join(PUBLIC_DIR, keyFile), 'utf8').trim();

/** Las guías salen de los propios ficheros de contenido, no de una lista a mano. */
function rutasDeGuias() {
  const dir = resolve(HERE, '../src/content/guides/en');
  const slugs = readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
  return ['/guides', ...slugs.map((s) => `/guides/${s}`)];
}

const rutas = process.argv.slice(2).length ? process.argv.slice(2) : rutasDeGuias();
const urlList = rutas.map((p) => (p.startsWith('http') ? p : `${SITE}${p}`));

const res = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `${SITE}/${keyFile}`, urlList }),
});

// 200 y 202 son aceptación; 422 suele ser clave o host que no cuadran.
console.log(`IndexNow: ${res.status} ${res.statusText} — ${urlList.length} URLs`);
for (const u of urlList) console.log(`  ${u}`);
if (!res.ok) {
  console.error(await res.text());
  process.exit(1);
}
