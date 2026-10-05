// `genpm diff <name>` y `genpm update <name>` (cli-mcp-spec §A.5, architecture §6.6): diff upstream remapeado a `<d>`
// y actualización con merge de 3 vías. Los conflictos quedan con marcadores estándar y salen con exit 4.

import { apply, diff, plan } from '@genpm/core';
import { format } from '@genpm/i18n';
import { defineCommand } from 'citty';
import { type Ctx, coreOptions } from '../context.js';
import { json, line, reportError } from '../output.js';
import { confirm } from '../prompt.js';
import { renderPlan } from './add.js';
import { globalArgs } from './shared.js';

/** Mensajes para la persona en stderr: stdout queda solo para el parche. */
const note = (text: string) => process.stderr.write(`${text}\n`);

const registryName = (spec: string | undefined) => spec?.match(/^(@[^/]+\/[^@]+)/)?.[1] ?? null;

export const diffCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'diff', description: ctx.t.t('cli.desc.diff') },
    args: {
      name: { type: 'positional', description: ctx.t.t('cli.arg.name'), required: true },
      to: { type: 'string', description: ctx.t.t('cli.arg.to') },
      local: { type: 'boolean', description: ctx.t.t('cli.arg.local') },
      ...globalArgs(ctx),
    },
    async run({ args }) {
      try {
        const opts = await coreOptions(ctx, registryName(args.name));
        // Ver un diff no es instalar: no suma al contador (ADR-027).
        const d = await diff({ ...opts, telemetry: false, name: args.name, to: args.to });
        if (ctx.flags.json) return json(d);
        if (d.from === d.to)
          return line(ctx, ctx.c.green(`✔ ${ctx.t.t('cli.diff.upToDate', { name: d.n, version: d.to })}`));
        // stdout = el parche tal cual (para `genpm diff x > u.patch && git apply --3way u.patch`); el resto a stderr.
        note(ctx.t.t('cli.diff.header', { name: d.n, from: d.from, to: d.to, count: d.files.length }));
        process.stdout.write(d.patch);
        if (args.local) {
          const local = [...d.drift.modified, ...d.drift.deleted, ...d.drift.added];
          note(
            local.length
              ? ctx.t.t('cli.diff.drift', { files: format.list(ctx.t.locale, local) })
              : ctx.t.t('cli.diff.clean'),
          );
        }
      } catch (e) {
        reportError(ctx, e);
      }
    },
  });

export const updateCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'update', description: ctx.t.t('cli.desc.update') },
    args: {
      name: { type: 'positional', description: ctx.t.t('cli.arg.name'), required: true },
      to: { type: 'string', description: ctx.t.t('cli.arg.to') },
      'dry-run': { type: 'boolean', description: ctx.t.t('cli.arg.dryRun') },
      mcp: { type: 'boolean', description: ctx.t.t('cli.arg.mcp'), negativeDescription: ctx.t.t('cli.arg.noMcp') },
      'install-deps': {
        type: 'boolean',
        description: ctx.t.t('cli.arg.installDeps'),
        negativeDescription: ctx.t.t('cli.arg.noInstallDeps'),
      },
      clients: { type: 'string', description: ctx.t.t('cli.arg.clients') },
      ...globalArgs(ctx),
    },
    async run({ args }) {
      try {
        const names = [args.name, ...args._.filter((a) => a !== args.name)].filter(Boolean) as string[];
        const opts = await coreOptions(ctx, registryName(names[0]));
        const pl = await plan({
          ...opts,
          telemetry: opts.telemetry && !args['dry-run'],
          specs: names.map((n) => (n.slice(1).includes('@') ? n : `${n}@${args.to ?? 'latest'}`)),
          update: true,
          clients: args.clients?.split(',').map((s) => s.trim()),
        });
        const changes = pl.packages.filter((p) => p.action === 'update' || p.action === 'install');
        if (!ctx.flags.json) {
          line(ctx, `${ctx.c.cyan('◆')} genpm update ${names.join(' ')}`);
          line(ctx);
          for (const l of renderPlan(ctx, pl)) line(ctx, l);
          line(ctx);
        }
        if (args['dry-run']) {
          if (ctx.flags.json) return json({ ok: true, plan: pl });
          return line(ctx, ctx.c.dim(ctx.t.t('cli.add.dryRun')));
        }
        if (!changes.length) {
          if (ctx.flags.json) return json({ ok: true, plan: pl, result: null });
          return line(ctx, ctx.c.green(`✔ ${ctx.t.t('cli.update.nothing')}`));
        }
        const ok = await confirm(ctx, ctx.t.t('cli.update.confirm', { count: changes.length }), {
          answer: ctx.flags.yes ? true : undefined,
          flag: '--yes',
        });
        if (!ok) return line(ctx, ctx.c.dim(ctx.t.t('cli.add.cancelled')));
        let allowMcp = false;
        for (const m of pl.mcp) {
          const yes = await confirm(ctx, ctx.t.t('cli.add.mcpConsent', { name: m.n, targets: m.targets.join(', ') }), {
            answer: args.mcp === undefined ? (ctx.interactive ? undefined : false) : args.mcp,
            flag: '--mcp',
            initial: false,
          });
          allowMcp = allowMcp || yes;
        }
        let installNpmDeps = false;
        if (pl.npm.command) {
          installNpmDeps = await confirm(ctx, ctx.t.t('cli.add.npmConsent', { command: pl.npm.command }), {
            answer: args['install-deps'] === undefined ? (ctx.interactive ? undefined : false) : args['install-deps'],
            flag: '--install-deps',
          });
        }
        const result = await apply(pl, { allowMcp, installNpmDeps, by: 'cli', log: ctx.log });
        const conflicts = result.updated.flatMap((u) => u.conflicts.map((f) => `${u.d}/${f}`));
        if (conflicts.length) process.exitCode = 4;
        if (ctx.flags.json) return json({ ok: true, plan: pl, result });
        for (const u of result.updated) {
          line(ctx, `${ctx.c.green('✔')} ${ctx.t.t('cli.update.done', { name: u.n, from: u.from, to: u.v })}`);
          const files = (xs: string[]) =>
            format.list(
              ctx.t.locale,
              xs.map((f) => `${u.d}/${f}`),
            );
          if (u.merged.length) line(ctx, `  ${ctx.t.t('cli.update.merged', { files: files(u.merged) })}`);
          if (u.orphaned.length)
            line(ctx, `  ${ctx.c.yellow('▲')} ${ctx.t.t('cli.update.orphaned', { files: files(u.orphaned) })}`);
          if (u.conflicts.length)
            line(ctx, `  ${ctx.c.red('✖')} ${ctx.t.t('cli.update.conflicts', { files: files(u.conflicts) })}`);
        }
        for (const it of result.installed)
          line(ctx, `${ctx.c.green('✔')} ${ctx.t.t('cli.update.installed', { name: it.n, version: it.v })}`);
        if (pl.npm.command && !result.npmRan)
          line(ctx, `  ${ctx.c.dim('›')} ${ctx.t.t('cli.next.npm', { command: pl.npm.command })}`);
      } catch (e) {
        reportError(ctx, e);
      }
    },
  });
