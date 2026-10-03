// Contexto global del CLI (cli-mcp-spec §A.2): flags > env > .genpmrc > defaults. Construye el traductor,
// la salida (humana o `--json`) y las opciones comunes que se pasan a @genpm/core.

import { findRoot, getToken, loadRc, registryFor, telemetryEnabled } from '@genpm/core';
import { createT, resolveCliLocale, type Translator } from '@genpm/i18n';
import { createColors } from 'picocolors';

export type GlobalFlags = {
  cwd: string;
  registry?: string;
  json: boolean;
  yes: boolean;
  lang?: string;
  verbose: boolean;
  quiet: boolean;
  color: boolean;
};

/** Pre-parseo de flags globales (antes de construir los comandos, para traducir la ayuda). */
export function parseGlobalFlags(argv: string[], env: NodeJS.ProcessEnv = process.env): GlobalFlags {
  const val = (name: string) => {
    const i = argv.findIndex((a) => a === name || a.startsWith(`${name}=`));
    if (i === -1) return undefined;
    const a = argv[i]!;
    return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1];
  };
  const has = (...names: string[]) => argv.some((a) => names.includes(a));
  const isTTY = !!process.stdout.isTTY;
  return {
    cwd: val('--cwd') ?? env['GENPM_CWD'] ?? process.cwd(),
    registry: val('--registry') ?? env['GENPM_REGISTRY'],
    json: has('--json'),
    yes: has('-y', '--yes') || env['GENPM_YES'] === '1',
    lang: val('--lang'),
    verbose: has('--verbose') || env['GENPM_DEBUG'] === '1',
    quiet: has('-q', '--quiet'),
    color: isTTY && !has('--no-color') && !env['NO_COLOR'] && !has('--json'),
  };
}

export type Ctx = {
  flags: GlobalFlags;
  t: Translator;
  locale: { locale: string; source: string };
  c: ReturnType<typeof createColors>;
  interactive: boolean;
  log: (line: string) => void;
};

export async function createContext(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<Ctx> {
  const flags = parseGlobalFlags(argv, env);
  let rcLang: string | undefined;
  try {
    rcLang = (await loadRc(await findRoot(flags.cwd).catch(() => null))).lang;
  } catch {
    rcLang = undefined;
  }
  const locale = resolveCliLocale({
    flag: flags.lang,
    env,
    rcLang,
    system: Intl.DateTimeFormat().resolvedOptions().locale,
  });
  // --json es siempre inglés (i18n §3).
  const t = await createT(flags.json ? 'en' : locale.locale);
  return {
    flags,
    t,
    locale,
    c: createColors(flags.color),
    interactive: !!process.stdin.isTTY && !!process.stdout.isTTY && !flags.json,
    log: flags.verbose ? (line) => process.stderr.write(`· ${line}\n`) : () => {},
  };
}

/** Opciones comunes para @genpm/core. */
export async function coreOptions(ctx: Ctx, name: string | null = null) {
  let root: string | null = null;
  try {
    root = await findRoot(ctx.flags.cwd);
  } catch {
    root = null;
  }
  const registry = registryFor(name, await loadRc(root), ctx.flags.registry);
  return {
    cwd: ctx.flags.cwd,
    registry,
    token: await getToken(registry).catch(() => null),
    client: 'cli' as const,
    telemetry: telemetryEnabled(),
    log: ctx.log,
  };
}
