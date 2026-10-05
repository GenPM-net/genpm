// `genpm upgrade [version] [--check]` (ADR-025): actualiza el binario nativo desde GitHub Releases verificando su SHA-256.
// Las copias instaladas con npm/npx solo pueden consultar (`--check`); para actualizarlas se indica el comando de su gestor.

import { assetName, checkUpgrade, fail, installMethod, upgradeBinary } from '@genpm/core';
import { defineCommand } from 'citty';
import type { Ctx } from '../context.js';
import { json, line, reportError } from '../output.js';
import { globalArgs } from './shared.js';

export const upgradeCmd = (ctx: Ctx) =>
  defineCommand({
    meta: { name: 'upgrade', description: ctx.t.t('cli.desc.upgrade') },
    args: {
      version: { type: 'positional', description: ctx.t.t('cli.arg.targetVersion'), required: false },
      check: { type: 'boolean', description: ctx.t.t('cli.arg.check') },
      ...globalArgs(ctx),
    },
    async run({ args }) {
      try {
        const method = installMethod();
        const res = await checkUpgrade({ method, version: args.version });
        const { current, latest, upToDate } = res;
        if (upToDate || args.check) {
          if (ctx.flags.json) return json({ ok: true, current, latest, upToDate, method: method.kind });
          return line(
            ctx,
            upToDate
              ? ctx.t.t('cli.upgrade.upToDate', { version: current })
              : ctx.t.t('cli.upgrade.available', { latest, current }),
          );
        }
        if (method.kind !== 'binary')
          throw fail('E_UPGRADE_UNSUPPORTED', { via: method.kind, command: method.command });
        if (method.manager) throw fail('E_UPGRADE_UNSUPPORTED', method.manager);
        line(ctx, ctx.c.dim(ctx.t.t('cli.upgrade.downloading', { version: latest, asset: assetName(method.target) })));
        const { sha256 } = await upgradeBinary({ version: latest, target: method.target, path: method.path });
        if (ctx.flags.json) return json({ ok: true, from: current, to: latest, path: method.path, sha256 });
        line(ctx, `${ctx.c.green('✔')} ${ctx.t.t('cli.upgrade.done', { from: current, to: latest })}`);
      } catch (e) {
        reportError(ctx, e);
      }
    },
  });
