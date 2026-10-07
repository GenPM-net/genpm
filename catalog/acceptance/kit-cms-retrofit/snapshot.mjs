// Prueba de aceptación de kit-cms (CAT-CMS-15): ver README.md.
// Uso: node snapshot.mjs <proyecto> <dirSalida>  — build de producción, arranca, guarda el HTML visible normalizado de 5 rutas.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [dir, out] = process.argv.slice(2);
execFileSync('npx', ['next', 'build'], { cwd: dir, stdio: 'ignore', env: process.env });
const srv = spawn('npx', ['next', 'start', '-p', '3200'], { cwd: dir, env: process.env, stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-srv.pid); } catch {} };
try {
  for (let i = 0; ; i++) { try { if ((await fetch('http://localhost:3200/')).status) break; } catch {} if (i > 60) throw new Error('no server'); await new Promise((r) => setTimeout(r, 500)); }
  mkdirSync(out, { recursive: true });
  for (const p of ['/', '/about', '/services', '/pricing', '/contact']) {
    const html = await (await fetch(`http://localhost:3200${p}`)).text();
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1]
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<link[^>]*>/g, '');
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    writeFileSync(join(out, `${p === '/' ? 'home' : p.slice(1)}.html`), `title: ${title}\ndescription: ${desc}\n${body.replace(/></g, '>\n<')}\n`);
  }
  console.log('snapshots in', out);
} finally { stop(); }
process.exit(0);
