// `genpm registry | team | access` (V10-01): registros privados, equipos de una org y accesos por paquete. Fachada sobre
// @genpm/core: parsea, llama y formatea.

import {
  accessGrant,
  accessList,
  accessVisibility,
  registryAudit,
  registryCreate,
  registryDomain,
  registryList,
  registryMember,
  registryShow,
  registryVerifyDomain,
  teamCreate,
  teamDelete,
  teamList,
  teamMember,
} from '@genpm/core';
import { defineCommand } from 'citty';
import { type Ctx, coreOptions } from '../context.js';
import { json, line, reportError, table } from '../output.js';
import { globalArgs } from './shared.js';

const run = (ctx: Ctx, fn: () => Promise<unknown>) => async () => {
  try {
    await fn();
  } catch (e) {
    reportError(ctx, e);
  }
};

const done = (ctx: Ctx, data: unknown) =>
  ctx.flags.json
    ? json({ ok: true, ...(data as object) })
    : line(ctx, `${ctx.c.green('✔')} ${ctx.t.t('cli.rbac.done')}`);

const pos = (
  ctx: Ctx,
  key: 'slug' | 'handle' | 'org' | 'team' | 'principal' | 'name' | 'permission' | 'visibility',
) => ({
  type: 'positional' as const,
  description: ctx.t.t(`cli.arg.${key === 'name' ? 'name' : `rbac.${key}`}` as 'cli.arg.name'),
  required: true as const,
});

export const registryCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'registry', description: ctx.t.t('cli.desc.registry') },
    subCommands: {
      ls: defineCommand({
        meta: { name: 'ls', description: ctx.t.t('cli.desc.registryLs') },
        args: { ...globalArgs(ctx) },
        run: () =>
          run(ctx, async () => {
            const all = await registryList(await coreOptions(ctx));
            if (ctx.flags.json) return json({ ok: true, registries: all });
            if (!all.length) return line(ctx, ctx.t.t('cli.rbac.none'));
            for (const l of table(all.map((r) => [ctx.c.bold(r.slug), r.role, r.plan, ctx.c.dim(r.url)]))) line(ctx, l);
          })(),
      }),
      create: defineCommand({
        meta: { name: 'create', description: ctx.t.t('cli.desc.registryCreate') },
        args: {
          slug: pos(ctx, 'slug'),
          owner: { type: 'string', description: ctx.t.t('cli.arg.rbac.owner'), required: true },
          ...globalArgs(ctx),
        },
        run: ({ args }) =>
          run(ctx, async () => {
            const r = await registryCreate({ ...(await coreOptions(ctx)), slug: args.slug, owner: args.owner });
            if (ctx.flags.json) return json({ ok: true, ...r });
            line(ctx, `${ctx.c.green('✔')} ${ctx.t.t('cli.rbac.created', { slug: r.slug, url: r.url })}`);
            line(ctx, `  ${ctx.c.dim('›')} ${ctx.t.t('cli.rbac.configHint')}`);
            line(ctx, `    ${JSON.stringify({ scopes: { [args.owner.replace(/^@/, '')]: r.url } })}`);
          })(),
      }),
      show: defineCommand({
        meta: { name: 'show', description: ctx.t.t('cli.desc.registryShow') },
        args: { slug: pos(ctx, 'slug'), ...globalArgs(ctx) },
        run: ({ args }) =>
          run(ctx, async () => {
            const r = await registryShow({ ...(await coreOptions(ctx)), slug: args.slug });
            if (ctx.flags.json) return json({ ok: true, ...r });
            line(ctx, `${ctx.c.bold(r.slug)}  ${r.role} · ${r.plan} · ${ctx.c.dim(r.url)}`);
            for (const l of table((r.members ?? []).map((m) => [`  ${m.handle}`, m.kind, m.role]))) line(ctx, l);
          })(),
      }),
      add: defineCommand({
        meta: { name: 'add', description: ctx.t.t('cli.desc.registryAdd') },
        args: {
          slug: pos(ctx, 'slug'),
          handle: pos(ctx, 'handle'),
          role: { type: 'string', description: ctx.t.t('cli.arg.rbac.role'), default: 'reader' },
          ...globalArgs(ctx),
        },
        run: ({ args }) =>
          run(ctx, async () =>
            done(
              ctx,
              await registryMember({
                ...(await coreOptions(ctx)),
                slug: args.slug,
                handle: args.handle,
                role: args.role as 'reader',
              }),
            ),
          )(),
      }),
      domain: defineCommand({
        meta: { name: 'domain', description: ctx.t.t('cli.desc.registryDomain') },
        args: {
          slug: pos(ctx, 'slug'),
          domain: { type: 'positional', description: ctx.t.t('cli.arg.rbac.domain'), required: false },
          remove: { type: 'boolean', description: ctx.t.t('cli.arg.rbac.removeDomain') },
          ...globalArgs(ctx),
        },
        run: ({ args }) =>
          run(ctx, async () => {
            const o = await coreOptions(ctx);
            if (args.remove || !args.domain)
              return done(ctx, await registryDomain({ ...o, slug: args.slug, domain: null }));
            const r = await registryDomain({ ...o, slug: args.slug, domain: args.domain });
            if (ctx.flags.json) return json({ ok: true, ...r });
            if ('txt' in r && r.txt && r.cname)
              line(
                ctx,
                ctx.t.t('cli.rbac.domainSteps', {
                  txtName: r.txt.name,
                  txtValue: r.txt.value,
                  domain: r.cname.name,
                  target: r.cname.value,
                  slug: args.slug,
                }),
              );
          })(),
      }),
      audit: defineCommand({
        meta: { name: 'audit', description: ctx.t.t('cli.desc.registryAudit') },
        args: {
          slug: pos(ctx, 'slug'),
          since: { type: 'string', description: ctx.t.t('cli.arg.rbac.since') },
          action: { type: 'string', description: ctx.t.t('cli.arg.rbac.action') },
          ...globalArgs(ctx),
        },
        run: ({ args }) =>
          run(ctx, async () => {
            const events = await registryAudit({
              ...(await coreOptions(ctx)),
              slug: args.slug,
              from: args.since,
              action: args.action,
            });
            // Siempre JSON Lines (una entrada por línea): se redirige a un archivo o se procesa con jq.
            for (const e of events) process.stdout.write(`${JSON.stringify(e)}\n`);
          })(),
      }),
      verify: defineCommand({
        meta: { name: 'verify', description: ctx.t.t('cli.desc.registryVerify') },
        args: { slug: pos(ctx, 'slug'), ...globalArgs(ctx) },
        run: ({ args }) =>
          run(ctx, async () => {
            const r = await registryVerifyDomain({ ...(await coreOptions(ctx)), slug: args.slug });
            if (ctx.flags.json) return json({ ok: true, ...r });
            line(ctx, `${ctx.c.green('✔')} ${ctx.t.t('cli.rbac.domainActive', { url: r.url ?? r.domain })}`);
          })(),
      }),
      rm: defineCommand({
        meta: { name: 'rm', description: ctx.t.t('cli.desc.registryRm') },
        args: { slug: pos(ctx, 'slug'), handle: pos(ctx, 'handle'), ...globalArgs(ctx) },
        run: ({ args }) =>
          run(ctx, async () =>
            done(
              ctx,
              await registryMember({ ...(await coreOptions(ctx)), slug: args.slug, handle: args.handle, role: null }),
            ),
          )(),
      }),
    },
  });

export const teamCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'team', description: ctx.t.t('cli.desc.team') },
    subCommands: {
      ls: defineCommand({
        meta: { name: 'ls', description: ctx.t.t('cli.desc.teamLs') },
        args: { org: pos(ctx, 'org'), ...globalArgs(ctx) },
        run: ({ args }) =>
          run(ctx, async () => {
            const r = await teamList({ ...(await coreOptions(ctx)), org: args.org });
            if (ctx.flags.json) return json({ ok: true, ...r });
            if (!r.teams.length) return line(ctx, ctx.t.t('cli.rbac.none'));
            for (const t of r.teams) {
              line(ctx, ctx.c.bold(`${r.org}/${t.slug}`));
              for (const m of t.members) line(ctx, `  ${m.handle} ${ctx.c.dim(m.role)}`);
            }
          })(),
      }),
      create: defineCommand({
        meta: { name: 'create', description: ctx.t.t('cli.desc.teamCreate') },
        args: { team: pos(ctx, 'team'), ...globalArgs(ctx) },
        run: ({ args }) =>
          run(ctx, async () => done(ctx, await teamCreate({ ...(await coreOptions(ctx)), ref: args.team })))(),
      }),
      rm: defineCommand({
        meta: { name: 'rm', description: ctx.t.t('cli.desc.teamRm') },
        args: { team: pos(ctx, 'team'), ...globalArgs(ctx) },
        run: ({ args }) =>
          run(ctx, async () => done(ctx, await teamDelete({ ...(await coreOptions(ctx)), ref: args.team })))(),
      }),
      add: defineCommand({
        meta: { name: 'add', description: ctx.t.t('cli.desc.teamAdd') },
        args: {
          team: pos(ctx, 'team'),
          handle: pos(ctx, 'handle'),
          role: { type: 'string', description: ctx.t.t('cli.arg.rbac.teamRole'), default: 'member' },
          ...globalArgs(ctx),
        },
        run: ({ args }) =>
          run(ctx, async () =>
            done(
              ctx,
              await teamMember({
                ...(await coreOptions(ctx)),
                ref: args.team,
                handle: args.handle,
                role: args.role === 'maintainer' ? 'maintainer' : 'member',
              }),
            ),
          )(),
      }),
      remove: defineCommand({
        meta: { name: 'remove', description: ctx.t.t('cli.desc.teamRemove') },
        args: { team: pos(ctx, 'team'), handle: pos(ctx, 'handle'), ...globalArgs(ctx) },
        run: ({ args }) =>
          run(ctx, async () =>
            done(
              ctx,
              await teamMember({ ...(await coreOptions(ctx)), ref: args.team, handle: args.handle, role: null }),
            ),
          )(),
      }),
    },
  });

export const accessCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'access', description: ctx.t.t('cli.desc.access') },
    subCommands: {
      ls: defineCommand({
        meta: { name: 'ls', description: ctx.t.t('cli.desc.accessLs') },
        args: { name: pos(ctx, 'name'), ...globalArgs(ctx) },
        run: ({ args }) =>
          run(ctx, async () => {
            const r = await accessList({ ...(await coreOptions(ctx, args.name)), name: args.name });
            if (ctx.flags.json) return json({ ok: true, ...r });
            line(ctx, `${ctx.c.bold(r.name)}  ${r.visibility}`);
            for (const l of table(r.grants.map((g) => [`  ${g.principal}`, g.permission]))) line(ctx, l);
          })(),
      }),
      set: defineCommand({
        meta: { name: 'set', description: ctx.t.t('cli.desc.accessSet') },
        args: { name: pos(ctx, 'name'), visibility: pos(ctx, 'visibility'), ...globalArgs(ctx) },
        run: ({ args }) =>
          run(ctx, async () =>
            done(
              ctx,
              await accessVisibility({
                ...(await coreOptions(ctx, args.name)),
                name: args.name,
                visibility: args.visibility,
              }),
            ),
          )(),
      }),
      grant: defineCommand({
        meta: { name: 'grant', description: ctx.t.t('cli.desc.accessGrant') },
        args: {
          name: pos(ctx, 'name'),
          principal: pos(ctx, 'principal'),
          permission: pos(ctx, 'permission'),
          ...globalArgs(ctx),
        },
        run: ({ args }) =>
          run(ctx, async () =>
            done(
              ctx,
              await accessGrant({
                ...(await coreOptions(ctx, args.name)),
                name: args.name,
                principal: args.principal,
                permission: args.permission as 'read',
              }),
            ),
          )(),
      }),
      revoke: defineCommand({
        meta: { name: 'revoke', description: ctx.t.t('cli.desc.accessRevoke') },
        args: { name: pos(ctx, 'name'), principal: pos(ctx, 'principal'), ...globalArgs(ctx) },
        run: ({ args }) =>
          run(ctx, async () =>
            done(
              ctx,
              await accessGrant({
                ...(await coreOptions(ctx, args.name)),
                name: args.name,
                principal: args.principal,
                permission: null,
              }),
            ),
          )(),
      }),
    },
  });
