// Serializador y parser de `genpm.lock` (manifest-spec §6). Una línea por paquete para diffs limpios.

import { GenpmError, type Issue } from './errors.js';
import { type LockEntry, LockFile } from './schema.js';

const LOCK_ENTRY_ORDER = ['v', 'r', 't', 'c', 'd', 'x', 'h', 'sg', 'm', 'by', 'g'] as const;

function orderedEntry(e: LockEntry): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of LOCK_ENTRY_ORDER) {
    const v = e[k];
    if (v === undefined) continue;
    if (k === 'g' && typeof v === 'object') {
      const sorted: Record<string, string> = {};
      for (const name of Object.keys(v).sort()) sorted[name] = (v as Record<string, string>)[name]!;
      out[k] = sorted;
    } else out[k] = v;
  }
  return out;
}

export function emptyLock(): LockFile {
  return { $: 1, p: {} };
}

/** Primera línea `{"$":1,`, segunda `"p":{`, una línea por paquete (orden alfabético), cierre `}}`. */
export function serializeLock(lock: LockFile): string {
  const names = Object.keys(lock.p).sort();
  const lines = names.map((n, i) => {
    const sep = i === names.length - 1 ? '' : ',';
    return `${JSON.stringify(n)}:${JSON.stringify(orderedEntry(lock.p[n]!))}${sep}`;
  });
  return ['{"$":1,', '"p":{', ...lines, '}}', ''].join('\n');
}

export function lockIssues(raw: unknown): Issue[] {
  const parsed = LockFile.safeParse(raw);
  if (parsed.success) return [];
  return parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/** Parsea y valida un lockfile. Lanza `E_LOCK_INVALID` con `details.issues`. */
export function parseLock(text: string, messages: { message: string; fix: string }): LockFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new GenpmError('E_LOCK_INVALID', messages.message, messages.fix, {
      issues: [{ path: '', message: 'invalid JSON' }],
    });
  }
  const parsed = LockFile.safeParse(raw);
  if (!parsed.success) {
    throw new GenpmError('E_LOCK_INVALID', messages.message, messages.fix, { issues: lockIssues(raw) });
  }
  return parsed.data;
}
