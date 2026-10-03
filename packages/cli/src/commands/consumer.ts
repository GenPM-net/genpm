// Comandos de consumidor: search, info, list, remove, outdated, audit, doctor, cache (cli-mcp-spec §A.5).

import { audit, cleanCache, defaultCacheDir, doctor, info, list, outdated, remove, search } from '@genpm/core';
import { format } from '@genpm/i18n';
import { LEGEND, pickSummary } from '@genpm/manifest';
import { defineCommand } from 'citty';
import { type Ctx, coreOptions } from '../context.js';
import { json, line, reportError, shortSha, table } from '../output.js';
import { globalArgs } from './shared.js';

const run = (ctx: Ctx, fn: () => Promise<unknown>) => async () => {
  try {
    await fn();
  } catch (e) {
    reportError(ctx, e);
  }
};

export const searchCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'search', description: ctx.t.t('cli.desc.search') },
    args: {
      query: { type: 'positional', description: ctx.t.t('cli.arg.query'), required: false },
      keyword: { type: 'string', alias: 'k', description: ctx.t.t('cli.arg.keyword') },
      mcp: { type: 'boolean', description: ctx.t.t('cli.arg.onlyMcp') },
      sort: { type: 'string', description: ctx.t.t('cli.arg.sort') },
      limit: { type: 'string', alias: 'n', description: ctx.t.t('cli.arg.limit') },
      ...globalArgs(ctx),
    },
    run: ({ args }) =>
      run(ctx, async () => {
        const query = [args.query, ...args._.filter((a) => a !== args.query)].filter(Boolean).join(' ') || undefined;
        const limit = Math.min(Number(args.limit ?? 10) || 10, 50);
        const res = await search({
          ...(await coreOptions(ctx)),
          query,
          keywords: args.keyword?.split(','),
          mcp: args.mcp,
          sort: args.sort,
          limit,
        });
        if (ctx.flags.json) return json(res);
        if (!res.r.length) return line(ctx, ctx.t.t('cli.search.empty', { query: query ?? '' }));
        const rows = res.r.map((r) => [
          `  ${ctx.c.bold(r.n)}`,
          r.v,
          r.s.length > 60 ? `${r.s.slice(0, 59)}…` : r.s,
          `${r.m ? ctx.c.magenta('mcp') : ''}${r.vf ? ` ${ctx.c.green('✓')}` : ''}`,
          ctx.c.dim(ctx.t.t('cli.search.installs', { count: format.compact(ctx.t.locale, r.i) })),
        ]);
        for (const l of table(rows)) line(ctx, l);
        if (res.nx) line(ctx, ctx.c.dim(`  ${ctx.t.t('cli.search.more', { limit: Math.min(limit * 2, 50) })}`));
      })(),
  });

export const infoCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'info', description: ctx.t.t('cli.desc.info') },
    args: {
      name: { type: 'positional', description: ctx.t.t('cli.arg.name'), required: true },
      rules: { type: 'boolean', description: ctx.t.t('cli.arg.rules') },
      ...globalArgs(ctx),
    },
    run: ({ args }) =>
      run(ctx, async () => {
        const at = args.name.indexOf('@', 1);
        const name = at === -1 ? args.name : args.name.slice(0, at);
        const range = at === -1 ? undefined : args.name.slice(at + 1);
        const pkg = await info({ ...(await coreOptions(ctx, name)), name, range, fullRules: true });
        if (ctx.flags.json) return json({ legend: LEGEND, ...pkg });
        if (args.rules) return process.stdout.write(pkg.rules.endsWith('\n') ? pkg.rules : `${pkg.rules}\n`);
        const m = pkg.manifest;
        const { t, c } = ctx;
        line(ctx, `${c.bold(m.n)} ${m.v}  ${c.dim(pickSummary(m.s, t.locale) ?? '')}`);
        const rows: string[][] = [
          [t.t('cli.label.repo'), `${m.r} ${c.dim(`#${m.t}`)}`],
          [t.t('cli.label.commit'), m.c],
          [t.t('cli.label.dest'), m.d],
          [t.t('cli.label.license'), m.l],
          [t.t('cli.label.scan'), pkg.scan],
        ];
        if (m.g && Object.keys(m.g).length)
          rows.push([
            t.t('cli.label.deps'),
            Object.entries(m.g)
              .map(([n, r]) => `${n}@${r}`)
              .join(' '),
          ]);
        if (m.p && Object.keys(m.p).length)
          rows.push([
            t.t('cli.label.npm'),
            Object.entries(m.p)
              .map(([n, r]) => `${n}@${r}`)
              .join(' '),
          ]);
        if (m.e?.length) rows.push([t.t('cli.label.env'), m.e.join(' ')]);
        for (const s of m.m ?? [])
          rows.push([
            t.t('cli.label.mcp'),
            typeof s === 'string' ? s : `${s.n}: ${s.u ?? [s.c, ...(s.a ?? [])].join(' ')}`,
          ]);
        if (pkg.installed)
          rows.push([
            t.t('cli.label.installed'),
            `${pkg.installed.v} → ${pkg.installed.d} (${t.t('cli.list.drift', { count: pkg.installed.drift })})`,
          ]);
        for (const l of table(rows.map(([a, b]) => [`  ${c.dim(a!)}`, b!]))) line(ctx, l);
        line(ctx);
        line(ctx, c.bold(t.t('cli.label.rules')));
        line(ctx, pkg.rules);
      })(),
  });

export const listCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'list', description: ctx.t.t('cli.desc.list') },
    args: { ...globalArgs(ctx) },
    run: () =>
      run(ctx, async () => {
        const pkgs = await list({ cwd: ctx.flags.cwd });
        if (ctx.flags.json) return json(pkgs);
        if (!pkgs.length) return line(ctx, ctx.t.t('cli.list.empty'));
        const rows = pkgs.map((p) => {
          const n = p.drift.modified.length + p.drift.deleted.length + p.drift.added.length;
          const drift = ctx.t.t('cli.list.drift', { count: n });
          return [
            `  ${ctx.c.bold(p.n)}`,
            p.v,
            p.d,
            ctx.c.dim(shortSha(p.c)),
            n ? ctx.c.yellow(drift) : ctx.c.dim(drift),
          ];
        });
        for (const l of table(rows)) line(ctx, l);
      })(),
  });

export const removeCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'remove', description: ctx.t.t('cli.desc.remove') },
    args: {
      name: { type: 'positional', description: ctx.t.t('cli.arg.name'), required: true },
      'keep-code': { type: 'boolean', description: ctx.t.t('cli.arg.keepCode') },
      force: { type: 'boolean', description: ctx.t.t('cli.arg.force') },
      ...globalArgs(ctx),
    },
    run: ({ args }) =>
      run(ctx, async () => {
        const r = await remove({
          ...(await coreOptions(ctx, args.name)),
          name: args.name,
          keepCode: args['keep-code'],
          force: args.force,
        });
        if (ctx.flags.json) return json(r);
        line(ctx, `${ctx.c.green('✔')} ${ctx.t.t('cli.remove.done', { name: r.removed })}`);
        if (r.keptCode) line(ctx, `  ${ctx.t.t('cli.remove.kept', { dest: r.deleted[0] ?? '' })}`);
        if (r.mcpServers.length)
          line(ctx, `  ${ctx.c.yellow('▲')} ${ctx.t.t('cli.remove.mcpLeft', { name: r.removed })}`);
      })(),
  });

export const outdatedCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'outdated', description: ctx.t.t('cli.desc.outdated') },
    args: { 'exit-code': { type: 'boolean', description: ctx.t.t('cli.arg.exitCode') }, ...globalArgs(ctx) },
    run: ({ args }) =>
      run(ctx, async () => {
        const o = await outdated(await coreOptions(ctx));
        if (args['exit-code'] && o.length) process.exitCode = 4;
        if (ctx.flags.json) return json({ o });
        if (!o.length) return line(ctx, ctx.c.green(`✔ ${ctx.t.t('cli.outdated.none')}`));
        const rows = o.map((x) => [
          `  ${ctx.c.bold(x.n)}`,
          `${x.v} → ${x.latest}`,
          x.kind === 'major' ? ctx.c.red(x.kind) : x.kind,
          ctx.c.dim(ctx.t.t('cli.list.drift', { count: x.drift })),
        ]);
        for (const l of table(rows)) line(ctx, l);
      })(),
  });

export const auditCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'audit', description: ctx.t.t('cli.desc.audit') },
    args: { ...globalArgs(ctx) },
    run: () =>
      run(ctx, async () => {
        const r = await audit(await coreOptions(ctx));
        if (!r.ok) process.exitCode = 6;
        if (ctx.flags.json) return json({ ok: r.ok, findings: r.findings.map(({ detail: _d, ...f }) => f) });
        for (const f of r.findings) {
          const icon = f.severity === 'high' || f.severity === 'critical' ? ctx.c.red('✖') : ctx.c.yellow('▲');
          line(
            ctx,
            `  ${icon} ${ctx.c.bold(f.n)} ${f.v}   ${f.id} ${f.severity}   ${f.detail}${f.fix ? ctx.c.dim(` → ${f.fix}`) : ''}`,
          );
        }
        if (r.signaturesValid) line(ctx, `  ${ctx.c.green('✔')} ${ctx.t.t('cli.audit.ok', { count: r.packages })}`);
        if (r.findings.length) line(ctx, `  ${ctx.t.t('cli.audit.problems', { count: r.findings.length })}`);
      })(),
  });

export const doctorCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'doctor', description: ctx.t.t('cli.desc.doctor') },
    args: { ...globalArgs(ctx) },
    run: () =>
      run(ctx, async () => {
        const checks = await doctor({ cwd: ctx.flags.cwd, registry: ctx.flags.registry, locale: ctx.locale });
        const bad = checks.filter((c) => c.status === 'fail');
        if (bad.length) process.exitCode = 1;
        if (ctx.flags.json) return json({ ok: bad.length === 0, checks });
        for (const ch of checks) {
          const icon =
            ch.status === 'ok' ? ctx.c.green('✔') : ch.status === 'warn' ? ctx.c.yellow('▲') : ctx.c.red('✖');
          line(ctx, `  ${icon} ${ch.id.padEnd(16)} ${ch.detail}`);
          if (ch.fix && ch.status !== 'ok') line(ctx, `    ${ctx.c.dim(`${ctx.t.t('cli.label.fix')}:`)} ${ch.fix}`);
        }
        line(
          ctx,
          bad.length
            ? ctx.c.red(ctx.t.t('cli.doctor.problems', { count: bad.length }))
            : ctx.c.green(ctx.t.t('cli.doctor.ok')),
        );
      })(),
  });

export const cacheCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'cache', description: ctx.t.t('cli.desc.cache') },
    args: {
      action: { type: 'positional', description: ctx.t.t('cli.arg.action'), required: false },
      ...globalArgs(ctx),
    },
    run: ({ args }) =>
      run(ctx, async () => {
        const dir = defaultCacheDir();
        if (args.action === 'clean') {
          await cleanCache(dir);
          return ctx.flags.json ? json({ ok: true, dir }) : line(ctx, ctx.t.t('cli.cache.cleaned', { dir }));
        }
        return ctx.flags.json ? json({ dir }) : line(ctx, dir);
      })(),
  });
