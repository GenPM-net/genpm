// Salida del CLI: humana (traducida, con color) o `--json` (una sola línea, inglés). Errores con `fix` y exit codes
// del catálogo único (cli-mcp-spec §A.3).

import { en, errorText } from '@genpm/i18n';
import { exitCode, GenpmError, isGenpmError } from '@genpm/manifest';
import type { Ctx } from './context.js';

export function json(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

export function line(ctx: Ctx, text = ''): void {
  if (!ctx.flags.quiet && !ctx.flags.json) process.stdout.write(`${text}\n`);
}

export function stderr(text: string): void {
  process.stderr.write(`${text}\n`);
}

/** Alinea columnas de una tabla simple (sin dependencias; respeta caracteres de doble ancho de forma aproximada). */
export function table(rows: string[][], gap = 2): string[] {
  const visible = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
  const width = (s: string) =>
    [...visible(s)].reduce((n, ch) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1), 0);
  const cols = Math.max(0, ...rows.map((r) => r.length));
  const widths = Array.from({ length: cols }, (_, i) => Math.max(0, ...rows.map((r) => width(r[i] ?? ''))));
  return rows.map((r) =>
    r
      .map((cell, i) => (i === r.length - 1 ? cell : cell + ' '.repeat(widths[i]! - width(cell) + gap)))
      .join('')
      .trimEnd(),
  );
}

export function toGenpmError(e: unknown): GenpmError {
  if (e instanceof GenpmError) return e;
  if (isGenpmError(e)) {
    const x = e as unknown as {
      code: GenpmError['code'];
      message: string;
      fix: string;
      details?: Record<string, unknown>;
    };
    return new GenpmError(x.code, x.message, x.fix ?? '', x.details);
  }
  return new GenpmError('E_INTERNAL', e instanceof Error ? e.message : String(e), en.t('errors.E_INTERNAL.fix'));
}

/** Imprime el error (traducido en modo humano) y fija el código de salida. */
export function reportError(ctx: Ctx, e: unknown): void {
  const err = toGenpmError(e);
  process.exitCode = exitCode(err.code);
  if (ctx.flags.json) {
    json({ ok: false, error: err.toJSON() });
    return;
  }
  const params = (err.details?.['params'] as Record<string, unknown> | undefined) ?? {};
  // Se re-renderiza en el idioma del usuario salvo que falte algún parámetro (quedaría un `{name}` literal).
  const local = ctx.t.has(`errors.${err.code}.message`) ? errorText(ctx.t, err.code, params) : null;
  const complete = local && !/\{\w+\}/.test(local.message + local.fix);
  const text = complete ? local : { message: err.message, fix: err.fix };
  stderr(`${ctx.c.red('✖')} ${ctx.c.bold(err.code)} ${text.message}`);
  if (text.fix) stderr(`  ${ctx.c.dim(`${ctx.t.t('cli.label.fix')}:`)} ${text.fix}`);
  const issues = err.details?.['issues'] as Array<{ path: string; message: string }> | undefined;
  for (const i of issues ?? []) stderr(`  ${ctx.c.dim('·')} ${i.path}: ${i.message}`);
  const conflicts = err.details?.['conflicts'] as Array<{ detail?: string; n?: string; ranges?: unknown }> | undefined;
  for (const c of conflicts ?? []) stderr(`  ${ctx.c.dim('·')} ${c.detail ?? JSON.stringify(c)}`);
  if (ctx.flags.verbose && err.details?.['cause']) stderr(`  ${ctx.c.dim(String(err.details['cause']))}`);
}

export const shortSha = (c: string) => c.slice(0, 7);
