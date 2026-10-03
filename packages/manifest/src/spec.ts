// Gramática de specs (cli-mcp-spec §A.4): `@scope/name[@range|@tag]`, `gh:owner/repo#<tag|sha>`, `file:<ruta>`.

import { NAME_RE } from './constants.js';
import { isValidRange } from './manifest.js';
import { checkRef } from './validators.js';

export type Spec =
  | { kind: 'registry'; name: string; range: string }
  | { kind: 'github'; owner: string; repo: string; ref: string; raw: string }
  | { kind: 'file'; path: string; raw: string };

export type SpecProblem = 'invalid_name' | 'invalid_range' | 'missing_ref' | 'invalid_ref' | 'invalid_spec';

export function parseSpec(input: string): { ok: true; spec: Spec } | { ok: false; problem: SpecProblem } {
  const s = input.trim();
  if (s.startsWith('gh:')) {
    const m = s.match(/^gh:([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})(?:#(.+))?$/);
    if (!m) return { ok: false, problem: 'invalid_spec' };
    if (!m[3]) return { ok: false, problem: 'missing_ref' };
    if (checkRef(m[3])) return { ok: false, problem: 'invalid_ref' };
    return { ok: true, spec: { kind: 'github', owner: m[1]!, repo: m[2]!, ref: m[3], raw: s } };
  }
  if (s.startsWith('file:')) {
    const path = s.slice('file:'.length);
    if (!path) return { ok: false, problem: 'invalid_spec' };
    return { ok: true, spec: { kind: 'file', path, raw: s } };
  }
  if (!s.startsWith('@')) return { ok: false, problem: 'invalid_name' };
  const at = s.indexOf('@', 1);
  const name = at === -1 ? s : s.slice(0, at);
  const range = at === -1 ? 'latest' : s.slice(at + 1).trim();
  if (!NAME_RE.test(name)) return { ok: false, problem: 'invalid_name' };
  if (!range) return { ok: false, problem: 'invalid_range' };
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(range) && !isValidRange(range)) return { ok: false, problem: 'invalid_range' };
  return { ok: true, spec: { kind: 'registry', name, range } };
}
