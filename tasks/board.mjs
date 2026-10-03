#!/usr/bin/env node
// Tablero de tareas de GenPM. Lee tasks/*.md, cambia estados y regenera el resumen de tasks/README.md.
// Uso: node tasks/board.mjs [status|next|list|set|done|start|block|cut|todo|sync|check|help]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const README = join(DIR, 'README.md');
const SKIP = new Set(['README.md', 'PLAN.md']);
const STATUSES = ['TODO', 'DOING', 'DONE', 'BLOCKED', 'CUT'];
const CLOSED = new Set(['DONE', 'CUT']);
// - [ ] `D1-A-01` **TODO** Título · A · 3h · deps: D0-11, D1-B-01
const LINE =
  /^- \[( |x)\] `([A-Z0-9-]+)` \*\*(TODO|DOING|DONE|BLOCKED|CUT)\*\* (.+?) · ([A-Z+]+) · (\d+(?:\.\d+)?)h · deps: (.+)$/;
const LOOSE = /^- \[[ x]\] `[A-Z0-9-]+`/;

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = paint('32');
const dim = paint('2');
const bold = paint('1');
const amber = paint('33');
const red = paint('31');
const violet = paint('35');

function load() {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith('.md') && !SKIP.has(f))
    .sort();
  const tasks = [];
  const malformed = [];
  const docs = {};
  for (const file of files) {
    const lines = readFileSync(join(DIR, file), 'utf8').split('\n');
    const heading = lines.find((l) => l.startsWith('# '));
    docs[file] = { lines, title: heading ? heading.slice(2).trim() : file };
    lines.forEach((l, i) => {
      const m = l.match(LINE);
      if (m) {
        tasks.push({
          file,
          line: i,
          box: m[1],
          id: m[2],
          status: m[3],
          text: m[4],
          track: m[5],
          hoursRaw: m[6],
          hours: Number(m[6]),
          deps:
            m[7].trim() === '—'
              ? []
              : m[7]
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
        });
      } else if (LOOSE.test(l)) {
        malformed.push(`${file}:${i + 1}  ${l.slice(0, 90)}`);
      }
    });
  }
  return { tasks, malformed, docs, files };
}

function render(t) {
  const box = t.status === 'DONE' ? 'x' : ' ';
  const deps = t.deps.length ? t.deps.join(', ') : '—';
  return `- [${box}] \`${t.id}\` **${t.status}** ${t.text} · ${t.track} · ${t.hoursRaw}h · deps: ${deps}`;
}

function save(docs, tasks) {
  const touched = new Set();
  for (const t of tasks) {
    const next = render(t);
    if (docs[t.file].lines[t.line] !== next) {
      docs[t.file].lines[t.line] = next;
      touched.add(t.file);
    }
  }
  for (const f of touched) writeFileSync(join(DIR, f), docs[f].lines.join('\n'));
  return touched;
}

// La casilla marcada gana: si alguien marca [x] a mano, la tarea pasa a DONE.
function normalize(tasks) {
  for (const t of tasks) if (t.box === 'x' && t.status !== 'DONE') t.status = 'DONE';
}

const bar = (done, total, w = 12) => {
  const n = total ? Math.round((done / total) * w) : 0;
  return '▓'.repeat(n) + '░'.repeat(w - n);
};
const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0);
const fmtH = (h) => `${Math.round(h * 10) / 10}h`;

function available(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return tasks.filter((t) => t.status === 'TODO' && t.deps.every((d) => byId.has(d) && CLOSED.has(byId.get(d).status)));
}

function groups(tasks, files, docs) {
  return files
    .map((f) => {
      const ts = tasks.filter((t) => t.file === f);
      const closed = ts.filter((t) => CLOSED.has(t.status)).length;
      const left = ts.filter((t) => !CLOSED.has(t.status)).reduce((a, t) => a + t.hours, 0);
      return { file: f, title: docs[f].title, total: ts.length, closed, left };
    })
    .filter((g) => g.total);
}

function boardMarkdown({ tasks, docs, files }) {
  const gs = groups(tasks, files, docs);
  const total = tasks.length;
  const closed = tasks.filter((t) => CLOSED.has(t.status)).length;
  const left = tasks.filter((t) => !CLOSED.has(t.status)).reduce((a, t) => a + t.hours, 0);
  const count = (s) => tasks.filter((t) => t.status === s).length;
  const out = [];
  out.push(`**${pct(closed, total)} %** completado · ${closed}/${total} tareas · ${fmtH(left)} estimadas pendientes`);
  out.push('');
  out.push(
    `TODO ${count('TODO')} · DOING ${count('DOING')} · DONE ${count('DONE')} · BLOCKED ${count('BLOCKED')} · CUT ${count('CUT')}`,
  );
  out.push('');
  out.push('| Fase | Progreso | Hechas | Pendiente |');
  out.push('|---|---|---|---|');
  for (const g of gs) {
    out.push(
      `| [${g.title}](${g.file}) | \`${bar(g.closed, g.total)}\` ${pct(g.closed, g.total)} % | ${g.closed}/${g.total} | ${fmtH(g.left)} |`,
    );
  }
  const doing = tasks.filter((t) => t.status === 'DOING');
  const blocked = tasks.filter((t) => t.status === 'BLOCKED');
  const next = available(tasks).slice(0, 10);
  const item = (t) => `- \`${t.id}\` ${t.text} · ${t.track} · ${t.hoursRaw}h ([${t.file}](${t.file}))`;
  out.push('');
  out.push('**En curso**');
  out.push('');
  out.push(doing.length ? doing.map(item).join('\n') : '_Nada en curso._');
  out.push('');
  out.push('**Bloqueadas**');
  out.push('');
  out.push(blocked.length ? blocked.map(item).join('\n') : '_Nada bloqueado._');
  out.push('');
  out.push('**Siguientes disponibles** (TODO con todas sus dependencias cerradas)');
  out.push('');
  out.push(next.length ? next.map(item).join('\n') : '_Ninguna: revisa bloqueos._');
  return out.join('\n');
}

function sync(state) {
  const start = '<!-- board:start -->';
  const end = '<!-- board:end -->';
  const src = readFileSync(README, 'utf8');
  const a = src.indexOf(start);
  const b = src.indexOf(end);
  if (a < 0 || b < 0) return false;
  const stamp = new Date().toISOString().slice(0, 10);
  const body = `${start}\n<!-- Generado por \`pnpm tasks sync\` · ${stamp}. No editar a mano. -->\n\n${boardMarkdown(state)}\n\n${end}`;
  const next = src.slice(0, a) + body + src.slice(b + end.length);
  if (next !== src) writeFileSync(README, next);
  return true;
}

function printStatus(state) {
  const { tasks, docs, files } = state;
  const gs = groups(tasks, files, docs);
  const total = tasks.length;
  const closed = tasks.filter((t) => CLOSED.has(t.status)).length;
  console.log(`${green('◆')} ${bold('genpm tasks')}  ${pct(closed, total)} % · ${closed}/${total}\n`);
  const w = Math.max(...gs.map((g) => g.title.length));
  for (const g of gs) {
    const p = pct(g.closed, g.total);
    const b = bar(g.closed, g.total, 16);
    console.log(
      `  ${g.title.padEnd(w)}  ${p === 100 ? green(b) : b}  ${String(p).padStart(3)} %  ${dim(`${g.closed}/${g.total} · ${fmtH(g.left)}`)}`,
    );
  }
  const doing = tasks.filter((t) => t.status === 'DOING');
  const blocked = tasks.filter((t) => t.status === 'BLOCKED');
  if (doing.length) {
    console.log(`\n  ${bold('En curso')}`);
    for (const t of doing) console.log(`  ${amber('◇')} ${violet(t.id)}  ${t.text}`);
  }
  if (blocked.length) {
    console.log(`\n  ${bold('Bloqueadas')}`);
    for (const t of blocked) console.log(`  ${red('✖')} ${violet(t.id)}  ${t.text}`);
  }
  const next = available(tasks).slice(0, 5);
  if (next.length) {
    console.log(`\n  ${bold('Siguientes')}`);
    for (const t of next)
      console.log(`  ${dim('›')} ${violet(t.id)}  ${t.text} ${dim(`· ${t.track} · ${t.hoursRaw}h`)}`);
  }
  console.log('');
}

function printList(tasks) {
  for (const t of tasks) {
    const mark =
      t.status === 'DONE'
        ? green('✔')
        : t.status === 'DOING'
          ? amber('◇')
          : t.status === 'BLOCKED'
            ? red('✖')
            : t.status === 'CUT'
              ? dim('–')
              : dim('○');
    console.log(
      `${mark} ${violet(t.id.padEnd(10))} ${t.status.padEnd(7)} ${t.text} ${dim(`· ${t.track} · ${t.hoursRaw}h`)}`,
    );
  }
  console.log(dim(`\n${tasks.length} tareas`));
}

function check({ tasks, malformed }) {
  const errors = [];
  const seen = new Map();
  for (const t of tasks) {
    if (seen.has(t.id)) errors.push(`ID duplicado ${t.id} (${seen.get(t.id)} y ${t.file})`);
    seen.set(t.id, t.file);
  }
  for (const t of tasks) {
    for (const d of t.deps) if (!seen.has(d)) errors.push(`${t.id}: dependencia desconocida ${d}`);
    if ((t.box === 'x') !== (t.status === 'DONE')) errors.push(`${t.id}: casilla y estado no coinciden (ejecuta sync)`);
  }
  // Ciclos de dependencias
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const state = new Map();
  const visit = (id, path) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      errors.push(`Ciclo de dependencias: ${[...path, id].join(' → ')}`);
      return;
    }
    state.set(id, 1);
    for (const d of byId.get(id)?.deps ?? []) if (byId.has(d)) visit(d, [...path, id]);
    state.set(id, 2);
  };
  for (const t of tasks) visit(t.id, []);
  for (const m of malformed) errors.push(`Línea con formato inválido: ${m}`);
  return errors;
}

function help() {
  console.log(`${green('◆')} ${bold('genpm tasks')}

  pnpm tasks                      Resumen por fase, en curso, bloqueadas y siguientes
  pnpm tasks next [n]             Tareas TODO listas para empezar (deps cerradas)
  pnpm tasks list [filtro…]       Lista. Filtros: estado (todo, doing…), track (A, B, C, F…), archivo o prefijo de ID (D3)
  pnpm tasks start <ID…>          Pasa a DOING
  pnpm tasks done <ID…>           Pasa a DONE y marca la casilla
  pnpm tasks block <ID…>          Pasa a BLOCKED
  pnpm tasks cut <ID…>            Pasa a CUT (recortada del alcance)
  pnpm tasks todo <ID…>           Vuelve a TODO
  pnpm tasks set <ID…> <ESTADO>   Estado explícito: ${STATUSES.join(' | ')}
  pnpm tasks sync                 Alinea casillas y estados y regenera el tablero de tasks/README.md
  pnpm tasks check                Valida IDs, dependencias, ciclos y formato (exit 1 si hay errores)
`);
}

function setStatus(ids, status) {
  const state = load();
  normalize(state.tasks);
  const byId = new Map(state.tasks.map((t) => [t.id, t]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    console.error(`${red('✖')} No existe: ${missing.join(', ')}  ${dim('fix: pnpm tasks list para ver los IDs')}`);
    process.exit(1);
  }
  for (const id of ids) {
    const t = byId.get(id);
    const before = t.status;
    t.status = status;
    const pending = t.deps.filter((d) => byId.has(d) && !CLOSED.has(byId.get(d).status));
    const warn =
      status !== 'TODO' && status !== 'CUT' && pending.length ? amber(`  ▲ deps abiertas: ${pending.join(', ')}`) : '';
    console.log(`${green('✔')} ${violet(id)} ${dim(before)} → ${bold(status)}  ${t.text}${warn}`);
  }
  save(state.docs, state.tasks);
  sync(load());
}

const [cmd = 'status', ...args] = process.argv.slice(2);
const shorthands = { start: 'DOING', done: 'DONE', block: 'BLOCKED', cut: 'CUT', todo: 'TODO' };

if (cmd === 'help' || cmd === '--help' || cmd === '-h') help();
else if (shorthands[cmd]) {
  if (!args.length) {
    console.error(`${red('✖')} Falta el ID.  ${dim(`fix: pnpm tasks ${cmd} D1-A-01`)}`);
    process.exit(1);
  }
  setStatus(
    args.map((a) => a.toUpperCase()),
    shorthands[cmd],
  );
} else if (cmd === 'set') {
  const status = (args.at(-1) ?? '').toUpperCase();
  if (!STATUSES.includes(status) || args.length < 2) {
    console.error(`${red('✖')} Uso: pnpm tasks set <ID…> <${STATUSES.join('|')}>`);
    process.exit(1);
  }
  setStatus(
    args.slice(0, -1).map((a) => a.toUpperCase()),
    status,
  );
} else if (cmd === 'sync') {
  const state = load();
  normalize(state.tasks);
  const touched = save(state.docs, state.tasks);
  sync(load());
  console.log(`${green('✔')} Tablero actualizado${touched.size ? ` · normalizados: ${[...touched].join(', ')}` : ''}`);
} else if (cmd === 'check') {
  const errors = check(load());
  if (errors.length) {
    for (const e of errors) console.error(`${red('✖')} ${e}`);
    process.exit(1);
  }
  console.log(`${green('✔')} ${load().tasks.length} tareas válidas`);
} else if (cmd === 'next') {
  const n = Number(args[0]) || 15;
  printList(available(load().tasks).slice(0, n));
} else if (cmd === 'list') {
  let ts = load().tasks;
  for (const raw of args) {
    const f = raw.toUpperCase();
    if (STATUSES.includes(f)) ts = ts.filter((t) => t.status === f);
    else if (/^[A-Z+]{1,3}$/.test(f) && !/^D\d$/.test(f)) ts = ts.filter((t) => t.track === f);
    else if (raw.endsWith('.md')) ts = ts.filter((t) => t.file === raw);
    else ts = ts.filter((t) => t.id.startsWith(f));
  }
  printList(ts);
} else if (cmd === 'status') printStatus(load());
else {
  console.error(`${red('✖')} Comando desconocido: ${cmd}`);
  help();
  process.exit(1);
}
