// Preguntas interactivas (cli-mcp-spec §A.2): en modo no interactivo (sin TTY o --json) cualquier pregunta sin
// respuesta por flag ⇒ E_CONFIRM_REQUIRED (exit 2). INV-5: nada se escribe sin consentimiento.

import * as p from '@clack/prompts';
import { fail } from '@genpm/core';
import type { Ctx } from './context.js';

export async function confirm(
  ctx: Ctx,
  question: string,
  opts: { answer?: boolean; flag: string; initial?: boolean },
): Promise<boolean> {
  if (opts.answer !== undefined) return opts.answer;
  if (!ctx.interactive) throw fail('E_CONFIRM_REQUIRED', { question, flag: opts.flag });
  const r = await p.confirm({ message: question, initialValue: opts.initial ?? true });
  if (p.isCancel(r)) return false;
  return r;
}

export async function ask(
  ctx: Ctx,
  message: string,
  opts: { initial?: string; flag: string; validate?: (v: string) => string | undefined },
): Promise<string> {
  if (!ctx.interactive) {
    if (opts.initial !== undefined) return opts.initial;
    throw fail('E_CONFIRM_REQUIRED', { question: message, flag: opts.flag });
  }
  const r = await p.text({
    message,
    ...(opts.initial !== undefined ? { initialValue: opts.initial } : {}),
    validate: opts.validate ? (v) => opts.validate!(v ?? '') : undefined,
  });
  if (p.isCancel(r)) throw fail('E_CONFIRM_REQUIRED', { question: message, flag: opts.flag });
  return r;
}
