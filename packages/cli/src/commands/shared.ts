import type { Ctx } from '../context.js';

/** Flags globales declarados en cada comando (para --help); su valor real lo lee parseGlobalFlags. */
export function globalArgs(ctx: Ctx) {
  return {
    cwd: { type: 'string', description: ctx.t.t('cli.arg.cwd') },
    registry: { type: 'string', description: ctx.t.t('cli.arg.registry') },
    json: { type: 'boolean', description: ctx.t.t('cli.arg.json') },
    yes: { type: 'boolean', alias: 'y', description: ctx.t.t('cli.arg.yes') },
    lang: { type: 'string', description: ctx.t.t('cli.arg.lang') },
    verbose: { type: 'boolean', description: ctx.t.t('cli.arg.verbose') },
    quiet: { type: 'boolean', alias: 'q', description: ctx.t.t('cli.arg.quiet') },
  } as const;
}
