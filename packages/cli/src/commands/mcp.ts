// `genpm mcp setup | add | remove` (cli-mcp-spec §A.5, §B.7).

import {
  fail,
  findRoot,
  mcpAdd,
  mcpRemove,
  mcpSetupApply,
  mcpSetupPreview,
  packageMcpServers,
  type SetupClient,
  setupTarget,
} from '@genpm/core';
import { defineCommand } from 'citty';
import { type Ctx, coreOptions } from '../context.js';
import { json, line, reportError } from '../output.js';
import { confirm } from '../prompt.js';
import { globalArgs } from './shared.js';

const CLIENTS: SetupClient[] = ['claude', 'cursor', 'vscode', 'windsurf', 'codex', 'gemini'];

export const mcpCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'mcp', description: ctx.t.t('cli.desc.mcp') },
    subCommands: {
      // Servidor MCP por stdio dentro del propio CLI (ADR-025): con el binario nativo, el agente no necesita Node ni npx.
      serve: defineCommand({
        meta: { name: 'serve', description: ctx.t.t('cli.desc.mcpServe') },
        async run() {
          // Solo el binario lleva el servidor dentro; en el paquete de npm es un import externo que no se instala.
          let serve: typeof import('@genpm/mcp/serve');
          try {
            serve = await import('@genpm/mcp/serve');
          } catch {
            return reportError(ctx, fail('E_MCP_SERVE_UNAVAILABLE'));
          }
          await serve.serveStdio();
        },
      }),
      setup: defineCommand({
        meta: { name: 'setup', description: ctx.t.t('cli.desc.mcpSetup') },
        args: {
          client: { type: 'string', description: ctx.t.t('cli.arg.client') },
          scope: { type: 'string', description: ctx.t.t('cli.arg.scope') },
          ...globalArgs(ctx),
        },
        async run({ args }) {
          try {
            const root = await findRoot(ctx.flags.cwd).catch(() => ctx.flags.cwd);
            const clients = args.client
              ? (args.client.split(',') as SetupClient[]).filter((c) => CLIENTS.includes(c))
              : (['claude', 'cursor'] as SetupClient[]);
            const scope = args.scope === 'user' ? 'user' : 'project';
            const results: Array<{ client: string; file: string | null; command: string | null; written: boolean }> =
              [];
            for (const client of clients) {
              const target = setupTarget(client, scope, root);
              if (!target.file) {
                results.push({ client, file: null, command: target.command, written: false });
                if (!ctx.flags.json) line(ctx, ctx.t.t('cli.mcp.setupManual', { command: target.command ?? '' }));
                continue;
              }
              const preview = await mcpSetupPreview(target);
              if (!preview.changed) {
                results.push({ client, file: target.file, command: null, written: false });
                continue;
              }
              if (!ctx.flags.json) line(ctx, ctx.c.dim(preview.after.trimEnd()));
              const ok = await confirm(ctx, ctx.t.t('cli.mcp.setupConfirm', { file: target.file }), {
                answer: ctx.flags.yes ? true : undefined,
                flag: '--yes',
              });
              const written = ok ? await mcpSetupApply(target, root) : false;
              results.push({ client, file: target.file, command: null, written });
              if (written && !ctx.flags.json)
                line(ctx, `${ctx.c.green('✔')} ${ctx.t.t('cli.mcp.setupDone', { file: target.file })}`);
            }
            if (ctx.flags.json) json({ ok: true, results });
          } catch (e) {
            reportError(ctx, e);
          }
        },
      }),
      add: defineCommand({
        meta: { name: 'add', description: ctx.t.t('cli.desc.mcpAdd') },
        args: {
          name: { type: 'positional', description: ctx.t.t('cli.arg.name'), required: true },
          ...globalArgs(ctx),
        },
        async run({ args }) {
          try {
            const o = await coreOptions(ctx, args.name);
            const { servers, targets } = await packageMcpServers({
              cwd: ctx.flags.cwd,
              name: args.name,
              registry: o.registry,
            });
            if (!servers.length)
              return ctx.flags.json
                ? json({ ok: true, files: [], servers: [] })
                : line(ctx, ctx.t.t('cli.mcp.nothing', { name: args.name }));
            for (const s of servers) {
              const yes = await confirm(
                ctx,
                ctx.t.t('cli.add.mcpConsent', {
                  name: `${s.n}: ${s.u ?? [s.c, ...(s.a ?? [])].join(' ')}`,
                  targets: targets.join(', '),
                }),
                {
                  answer: ctx.flags.yes ? true : undefined,
                  flag: '--yes',
                  initial: false,
                },
              );
              if (!yes) return;
            }
            const r = await mcpAdd({ cwd: ctx.flags.cwd, name: args.name, registry: o.registry });
            if (ctx.flags.json) return json({ ok: true, ...r });
            line(ctx, `${ctx.c.green('✔')} ${ctx.t.t('cli.mcp.addDone', { files: r.files.join(', ') || '—' })}`);
          } catch (e) {
            reportError(ctx, e);
          }
        },
      }),
      remove: defineCommand({
        meta: { name: 'remove', description: ctx.t.t('cli.desc.mcpRemove') },
        args: {
          name: { type: 'positional', description: ctx.t.t('cli.arg.name'), required: true },
          ...globalArgs(ctx),
        },
        async run({ args }) {
          try {
            const o = await coreOptions(ctx, args.name);
            const r = await mcpRemove({ cwd: ctx.flags.cwd, name: args.name, registry: o.registry });
            if (ctx.flags.json) return json({ ok: true, ...r });
            line(
              ctx,
              `${ctx.c.green('✔')} ${ctx.t.t('cli.mcp.removeDone', { count: r.removed.length, files: r.files.join(', ') || '—' })}`,
            );
          } catch (e) {
            reportError(ctx, e);
          }
        },
      }),
    },
  });
