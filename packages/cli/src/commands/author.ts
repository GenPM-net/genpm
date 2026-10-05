// Comandos de autor y sesión: init, validate, publish, yank, login, logout, whoami (cli-mcp-spec §A.6).

import { hostname } from 'node:os';
import {
  detectLicense,
  fail,
  GITHUB_CLIENT_ID,
  getStored,
  getToken,
  init,
  pollDeviceFlow,
  publish,
  RegistryClient,
  removeToken,
  saveToken,
  startDeviceFlow,
  validate,
} from '@genpm/core';
import { isValidName, isValidVersion } from '@genpm/manifest';
import { defineCommand } from 'citty';
import { type Ctx, coreOptions } from '../context.js';
import { json, line, reportError, stderr } from '../output.js';
import { ask } from '../prompt.js';
import { globalArgs } from './shared.js';

const run = (ctx: Ctx, fn: () => Promise<unknown>) => async () => {
  try {
    await fn();
  } catch (e) {
    reportError(ctx, e);
  }
};

export const initCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'init', description: ctx.t.t('cli.desc.init') },
    args: {
      workflow: { type: 'boolean', description: ctx.t.t('cli.arg.workflow') },
      force: { type: 'boolean', description: ctx.t.t('cli.arg.force') },
      ...globalArgs(ctx),
    },
    run: ({ args }) =>
      run(ctx, async () => {
        const base = ctx.flags.cwd
          .split(/[\\/]/)
          .pop()!
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-');
        const yes = ctx.flags.yes;
        const n = yes
          ? `@${base}/${base}`
          : await ask(ctx, ctx.t.t('cli.init.name'), {
              initial: `@${base}/${base}`,
              flag: '--yes',
              validate: (v) => (isValidName(v) ? undefined : '@scope/name'),
            });
        const v = yes
          ? '0.1.0'
          : await ask(ctx, ctx.t.t('cli.init.version'), {
              initial: '0.1.0',
              flag: '--yes',
              validate: (x) => (isValidVersion(x) ? undefined : '1.0.0'),
            });
        const s = yes ? '' : await ask(ctx, ctx.t.t('cli.init.summary'), { initial: '', flag: '--yes' });
        const short = n.split('/')[1] ?? base;
        const d = yes
          ? `src/lib/${short}`
          : await ask(ctx, ctx.t.t('cli.init.dest'), { initial: `src/lib/${short}`, flag: '--yes' });
        const k = yes ? '' : await ask(ctx, ctx.t.t('cli.init.keywords'), { initial: '', flag: '--yes' });
        const r = await init({
          cwd: ctx.flags.cwd,
          answers: {
            n,
            v,
            d,
            ...(s ? { s } : {}),
            k: k
              ? k
                  .split(',')
                  .map((x) => x.trim().toLowerCase())
                  .filter(Boolean)
              : [],
            l: await detectLicense(ctx.flags.cwd),
          },
          workflow: args.workflow,
          force: args.force,
        });
        if (ctx.flags.json) return json({ ok: true, ...r });
        line(ctx, `${ctx.c.green('✔')} ${ctx.t.t('cli.init.done', { files: r.written.join(', ') })}`);
        line(ctx, `  ${ctx.c.dim('›')} ${ctx.t.t('cli.init.nextValidate')}`);
      })(),
  });

export const validateCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'validate', description: ctx.t.t('cli.desc.validate') },
    args: {
      path: { type: 'positional', description: ctx.t.t('cli.arg.path'), required: false },
      manifest: { type: 'string', description: ctx.t.t('cli.arg.manifest') },
      ...globalArgs(ctx),
    },
    run: ({ args }) =>
      run(ctx, async () => {
        const r = await validate({ cwd: ctx.flags.cwd, path: args.path, manifest: args.manifest });
        if (!r.ok) process.exitCode = 6;
        if (ctx.flags.json) {
          const { fileList: _f, manifest: _m, ...rest } = r;
          return json(rest);
        }
        for (const e of r.errors) stderr(`  ${ctx.c.red('✖')} ${e.code}${e.path ? ` ${e.path}` : ''}: ${e.message}`);
        for (const w of r.warnings)
          line(ctx, `  ${ctx.c.yellow('▲')} ${w.code}${w.path ? ` ${w.path}` : ''}: ${w.message}`);
        if (r.ok)
          line(ctx, `${ctx.c.green('✔')} ${ctx.t.t('cli.validate.ok', { files: r.files, tokens: r.rulesTokens })}`);
        if (r.quality) {
          // Checklist de calidad (V02-04): lo que depende del paquete; escaneo, mantenimiento y verificación los mide el registry.
          const checks = Object.entries(r.quality) as Array<[keyof typeof r.quality, boolean]>;
          line(
            ctx,
            `  ${ctx.t.t('cli.validate.quality', { passed: checks.filter(([, ok]) => ok).length, total: checks.length })}`,
          );
          for (const [id, ok] of checks)
            line(
              ctx,
              `  ${ok ? ctx.c.green('✓') : ctx.c.dim('·')} ${ctx.t.t(`cli.quality.${id}` as 'cli.quality.license')}`,
            );
        } else stderr(ctx.c.red(ctx.t.t('cli.validate.failed', { count: r.errors.length })));
      })(),
  });

export const publishCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'publish', description: ctx.t.t('cli.desc.publish') },
    args: {
      manifest: { type: 'string', description: ctx.t.t('cli.arg.manifest') },
      ref: { type: 'string', description: ctx.t.t('cli.arg.ref') },
      'dist-tag': { type: 'string', description: ctx.t.t('cli.arg.distTag') },
      'dry-run': { type: 'boolean', description: ctx.t.t('cli.arg.dryRun') },
      ...globalArgs(ctx),
    },
    run: ({ args }) =>
      run(ctx, async () => {
        const o = await coreOptions(ctx);
        if (!o.token) throw fail('E_AUTH');
        const r = await publish({
          cwd: ctx.flags.cwd,
          registry: o.registry,
          token: o.token,
          manifest: args.manifest,
          ref: args.ref,
          distTag: args['dist-tag'],
          dryRun: args['dry-run'],
          log: ctx.log,
        });
        if (ctx.flags.json) return json({ ok: true, ...r });
        const m = r.manifest;
        if (args['dry-run'])
          line(
            ctx,
            `${ctx.c.green('✔')} ${ctx.t.t('cli.publish.dryRun', { name: m.n, version: m.v, commit: m.c.slice(0, 7) })}`,
          );
        else line(ctx, `${ctx.c.green('✔')} ${ctx.t.t('cli.publish.done', { name: m.n, version: m.v, url: r.url })}`);
        line(ctx, `  ${ctx.t.t('cli.publish.scan', { status: r.scan.status })}`);
        for (const w of r.warnings) line(ctx, `  ${ctx.c.yellow('▲')} ${w.code} ${w.detail}`);
      })(),
  });

export const yankCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'yank', description: ctx.t.t('cli.desc.yank') },
    args: {
      spec: { type: 'positional', description: ctx.t.t('cli.arg.spec'), required: true },
      reason: { type: 'string', description: ctx.t.t('cli.arg.reason'), required: true },
      ...globalArgs(ctx),
    },
    run: ({ args }) =>
      run(ctx, async () => {
        const at = args.spec.lastIndexOf('@');
        const name = args.spec.slice(0, at);
        const version = args.spec.slice(at + 1);
        if (at <= 0 || !isValidName(name) || !isValidVersion(version))
          throw fail('E_USAGE', { detail: 'genpm yank @scope/name@1.2.3 --reason "…"' });
        const o = await coreOptions(ctx, name);
        if (!o.token) throw fail('E_AUTH');
        const r = await new RegistryClient({ registry: o.registry, token: o.token, log: ctx.log }).yank(
          name,
          version,
          args.reason,
        );
        if (ctx.flags.json) return json(r);
        line(ctx, `${ctx.c.green('✔')} ${ctx.t.t('cli.yank.done', { name, version })}`);
      })(),
  });

export const loginCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'login', description: ctx.t.t('cli.desc.login') },
    args: { ...globalArgs(ctx) },
    run: () =>
      run(ctx, async () => {
        const o = await coreOptions(ctx);
        const clientId = process.env['GENPM_GITHUB_CLIENT_ID'] ?? GITHUB_CLIENT_ID;
        if (!clientId) {
          stderr(ctx.t.t('cli.login.noClientId'));
          throw fail('E_AUTH');
        }
        if (!ctx.interactive) throw fail('E_CONFIRM_REQUIRED', { question: 'genpm login', flag: 'GENPM_TOKEN' });
        const code = await startDeviceFlow(clientId);
        line(
          ctx,
          ctx.t.t('cli.login.open', { url: ctx.c.cyan(code.verification_uri), code: ctx.c.bold(code.user_code) }),
        );
        line(ctx, ctx.c.dim(ctx.t.t('cli.login.waiting')));
        const githubToken = await pollDeviceFlow(clientId, code);
        const client = new RegistryClient({ registry: o.registry, log: ctx.log });
        const r = await client.exchange(githubToken, `cli@${hostname()}`.slice(0, 64));
        await saveToken(o.registry, { token: r.token, expiresAt: r.expiresAt, handle: r.account.handle });
        line(ctx, `${ctx.c.green('✔')} ${ctx.t.t('cli.login.done', { handle: r.account.handle })}`);
      })(),
  });

export const logoutCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'logout', description: ctx.t.t('cli.desc.logout') },
    args: { ...globalArgs(ctx) },
    run: () =>
      run(ctx, async () => {
        const o = await coreOptions(ctx);
        const token = await getToken(o.registry, { env: {} });
        if (token)
          await new RegistryClient({ registry: o.registry, token, log: ctx.log }).logout().catch(() => undefined);
        const removed = await removeToken(o.registry);
        if (ctx.flags.json) return json({ ok: true, removed });
        line(
          ctx,
          removed
            ? `${ctx.c.green('✔')} ${ctx.t.t('cli.logout.done', { registry: o.registry })}`
            : ctx.t.t('cli.logout.none', { registry: o.registry }),
        );
      })(),
  });

export const whoamiCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'whoami', description: ctx.t.t('cli.desc.whoami') },
    args: { ...globalArgs(ctx) },
    run: () =>
      run(ctx, async () => {
        const o = await coreOptions(ctx);
        if (!o.token) {
          if (ctx.flags.json) return json({ ok: false, account: null });
          return line(ctx, ctx.t.t('cli.whoami.none'));
        }
        const me = await new RegistryClient({ registry: o.registry, token: o.token, log: ctx.log }).me();
        if (ctx.flags.json) return json({ ok: true, account: me, stored: await getStored(o.registry) });
        line(
          ctx,
          `${ctx.c.bold(me.handle)}${me.orgs.length ? ctx.c.dim(`  (${me.orgs.map((x) => x.handle).join(', ')})`) : ''}`,
        );
      })(),
  });
