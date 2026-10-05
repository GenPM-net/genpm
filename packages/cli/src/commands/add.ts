// `genpm add <spec...>` (cli-mcp-spec §A.5): plan visual, 3 preguntas (código, MCP, npm), --dry-run, --dest, --force.

import { apply, type InstallPlan, plan } from '@genpm/core';
import { format } from '@genpm/i18n';
import { parseSpec } from '@genpm/manifest';
import { defineCommand } from 'citty';
import { type Ctx, coreOptions } from '../context.js';
import { json, line, reportError, shortSha, table } from '../output.js';
import { confirm } from '../prompt.js';
import { globalArgs } from './shared.js';

function registryName(spec: string | undefined): string | null {
  const p = spec ? parseSpec(spec) : null;
  return p?.ok && p.spec.kind === 'registry' ? p.spec.name : null;
}

export function renderPlan(ctx: Ctx, pl: InstallPlan): string[] {
  const { c, t } = ctx;
  const out: string[] = [`  ${c.bold(t.t('cli.label.resolved'))}`];
  const rows = pl.packages.map((p, i) => {
    const branch = i === pl.packages.length - 1 ? '└─' : '├─';
    const target = p.action === 'skip' ? `→ ${t.t('cli.label.skip')}` : `→ ${p.d}`;
    const note =
      p.action === 'conflict'
        ? c.red(p.reason ?? '')
        : p.action === 'skip'
          ? c.dim(p.reason ?? '')
          : p.role === 'dep'
            ? c.dim(t.t('cli.label.dependency'))
            : '';
    return [`  ${c.dim(branch)} ${p.n}`, p.v, c.dim(shortSha(p.c)), target, note];
  });
  out.push(...table(rows));
  out.push('');
  const files = pl.rulesPreview.length;
  const tokens = pl.rulesPreview.reduce((n, r) => n + r.tokens, 0);
  const flagged = pl.rulesPreview.some((r) => r.scan === 'flagged');
  const sections: string[][] = [];
  if (files) {
    const scan = flagged ? 'flagged' : 'passed';
    const summary = t.t('cli.add.rulesSummary', { files, tokens: format.compact(t.locale, tokens), scan });
    sections.push([t.t('cli.label.rules'), `${summary}  ${c.dim(t.t('cli.add.rulesHint'))}`]);
  }
  if (pl.context.length)
    sections.push([
      t.t('cli.label.context'),
      t.t('cli.add.contextSummary', {
        count: pl.context.length,
        files:
          pl.context
            .slice(0, 4)
            .map((x) => x.file)
            .join(' · ') + (pl.context.length > 4 ? ' …' : ''),
      }),
    ]);
  if (pl.npm.command)
    sections.push([
      t.t('cli.label.npm'),
      `${Object.entries(pl.npm.add)
        .map(([n, r]) => `${n}@${r}`)
        .join(' ')}  ${c.dim(`→ ${pl.npm.command}`)}`,
    ]);
  if (pl.env.length) sections.push([t.t('cli.label.env'), `${pl.env.join(' ')}  ${c.dim('→ .env.example')}`]);
  for (const m of pl.mcp)
    sections.push([
      t.t('cli.label.mcp'),
      `${m.n}: ${m.command}${m.env.length ? c.dim(`  (env: ${m.env.join(', ')})`) : ''}`,
    ]);
  out.push(...table(sections.map(([a, b]) => [`  ${a}`, b!])));
  if (flagged) out.push('', `  ${c.red('▲')} ${c.red(t.t('cli.add.flagged'))}`);
  if (pl.warnings.length) {
    out.push('', `  ${c.yellow(t.t('cli.label.warnings'))}`);
    for (const w of pl.warnings) out.push(`  ${c.yellow('▲')} ${w.code} ${c.dim(w.detail)}`);
  }
  if (pl.conflicts.length) {
    out.push('', `  ${c.red(t.t('cli.label.conflicts'))}`);
    for (const x of pl.conflicts)
      out.push(`  ${c.red('✖')} ${x.code} ${x.detail}`, `    ${c.dim(`${t.t('cli.label.fix')}:`)} ${x.fix}`);
  }
  return out;
}

export const add = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'add', description: ctx.t.t('cli.desc.add') },
    args: {
      spec: { type: 'positional', description: ctx.t.t('cli.arg.spec'), required: true },
      dest: { type: 'string', description: ctx.t.t('cli.arg.dest') },
      'dry-run': { type: 'boolean', description: ctx.t.t('cli.arg.dryRun') },
      mcp: { type: 'boolean', description: ctx.t.t('cli.arg.mcp'), negativeDescription: ctx.t.t('cli.arg.noMcp') },
      'install-deps': {
        type: 'boolean',
        description: ctx.t.t('cli.arg.installDeps'),
        negativeDescription: ctx.t.t('cli.arg.noInstallDeps'),
      },
      clients: { type: 'string', description: ctx.t.t('cli.arg.clients') },
      force: { type: 'boolean', description: ctx.t.t('cli.arg.force') },
      'allow-autorun': { type: 'boolean', description: ctx.t.t('cli.arg.allowAutorun') },
      'max-size': { type: 'string', description: ctx.t.t('cli.arg.maxSize') },
      ...globalArgs(ctx),
    },
    async run({ args }) {
      // Tiempo total que ve el usuario: resolver, descargar, verificar y escribir (no solo la escritura).
      const started = Date.now();
      try {
        const specs = [args.spec, ...args._.filter((a) => a !== args.spec)].filter(Boolean) as string[];
        const pl = await plan({
          specs,
          ...(await coreOptions(ctx, registryName(specs[0]))),
          dest: args.dest,
          clients: args.clients?.split(',').map((s) => s.trim()),
          force: args.force,
          allowAutorun: args['allow-autorun'],
          maxSize: args['max-size'] ? Number(args['max-size']) * 1024 * 1024 : undefined,
        });
        const toInstall = pl.packages.filter((p) => p.action === 'install');
        if (args['dry-run']) {
          if (ctx.flags.json) return json({ ok: true, plan: pl });
          line(ctx, `${ctx.c.cyan('◆')} genpm add ${specs.join(' ')}`);
          line(ctx);
          for (const l of renderPlan(ctx, pl)) line(ctx, l);
          line(ctx);
          line(ctx, ctx.c.dim(ctx.t.t('cli.add.dryRun')));
          if (pl.conflicts.length && !args.force) process.exitCode = 4;
          return;
        }
        if (!ctx.flags.json) {
          line(ctx, `${ctx.c.cyan('◆')} genpm add ${specs.join(' ')}`);
          line(ctx);
          for (const l of renderPlan(ctx, pl)) line(ctx, l);
          line(ctx);
        }
        if (pl.conflicts.length && !args.force) {
          const first = pl.conflicts[0]!;
          const { fail } = await import('@genpm/core');
          throw fail(
            first.code,
            { name: first.n ?? '', path: first.path ?? '', version: '', detail: first.detail },
            { conflicts: pl.conflicts },
          );
        }
        if (!toInstall.length) {
          // Rotación de clave: mismo commit, firma nueva ya verificada → solo se actualiza `sg` en el lock.
          const result = pl.resign.length
            ? await apply(pl, { allowMcp: false, installNpmDeps: false, by: 'cli', log: ctx.log })
            : null;
          if (ctx.flags.json) return json({ ok: true, plan: pl, result });
          if (result) line(ctx, ctx.c.green(`✔ ${ctx.t.t('cli.add.resigned', { names: pl.resign.join(', ') })}`));
          line(ctx, ctx.c.green(`✔ ${ctx.t.t('cli.add.nothing')}`));
          return;
        }
        const files = toInstall.reduce((n, p) => n + p.files, 0);
        const bytes = toInstall.reduce((n, p) => n + p.bytes, 0);
        const ok = await confirm(
          ctx,
          ctx.t.t('cli.add.confirm', { count: toInstall.length, files, size: format.bytes(ctx.t.locale, bytes) }),
          {
            answer: ctx.flags.yes ? true : undefined,
            flag: '--yes',
          },
        );
        if (!ok) {
          line(ctx, ctx.c.dim(ctx.t.t('cli.add.cancelled')));
          return;
        }
        let allowMcp = false;
        if (pl.mcp.length) {
          for (const m of pl.mcp) {
            const yes = await confirm(
              ctx,
              ctx.t.t('cli.add.mcpConsent', { name: m.n, targets: m.targets.join(', ') }),
              {
                answer: args.mcp === undefined ? (ctx.interactive ? undefined : false) : args.mcp,
                flag: '--mcp',
                initial: false,
              },
            );
            allowMcp = allowMcp || yes;
          }
        }
        let installNpmDeps = false;
        if (pl.npm.command) {
          installNpmDeps = await confirm(ctx, ctx.t.t('cli.add.npmConsent', { command: pl.npm.command }), {
            // --install-deps / --no-install-deps deciden sin preguntar (también con --yes); sin ninguno, se pregunta.
            answer: args['install-deps'] === undefined ? (ctx.interactive ? undefined : false) : args['install-deps'],
            flag: '--install-deps',
          });
        }
        const result = await apply(pl, { allowMcp, installNpmDeps, by: 'cli', log: ctx.log });
        if (ctx.flags.json) return json({ ok: true, plan: pl, result });
        line(ctx);
        line(
          ctx,
          `${ctx.c.green('✔')} ${ctx.t.t('cli.add.injected', { count: result.installed.length, seconds: (Date.now() - started) / 1000 })}`,
        );
        if (result.mcpWritten.length)
          line(ctx, `  ${ctx.t.t('cli.add.mcpWritten', { files: result.mcpWritten.join(', ') })}`);
        const next: string[] = [];
        if (pl.env.length) next.push(ctx.t.t('cli.next.env', { vars: format.list(ctx.t.locale, pl.env) }));
        for (const it of result.installed) next.push(ctx.t.t('cli.next.integration', { file: `${it.d}/AGENTS.md` }));
        if (pl.npm.command && !result.npmRan) next.push(ctx.t.t('cli.next.npm', { command: pl.npm.command }));
        if (pl.mcp.length && !allowMcp)
          next.push(ctx.t.t('cli.next.mcp', { names: [...new Set(pl.mcp.map((m) => m.from))].join(' ') }));
        if (next.length) {
          line(ctx, `  ${ctx.c.bold(ctx.t.t('cli.label.next'))}`);
          for (const n of next) line(ctx, `  ${ctx.c.dim('›')} ${n}`);
        }
      } catch (e) {
        reportError(ctx, e);
      }
    },
  });
