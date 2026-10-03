// Esquemas zod de los tres documentos (manifest-spec §2–§3, §6) y de la entrada MCP (§3.3).

import { z } from 'zod';
import {
  DIST_TAG_RE,
  ENV_RE,
  KEYWORD_RE,
  LIMITS,
  LOCALE_RE,
  MCP_NAME_RE,
  NAME_RE,
  SHA_RE,
  VERSION_RE,
} from './constants.js';
import { checkContextPath, checkDest, checkInclude, checkRef } from './validators.js';

const name = z.string().regex(NAME_RE, 'invalid package name: expected @scope/name in lowercase');
const version = z.string().regex(VERSION_RE, 'invalid version: expected strict SemVer without "v" or build metadata');
const sha = z.string().regex(SHA_RE, 'invalid commit: expected a full 40-hex SHA');
const env = z.string().regex(ENV_RE, 'invalid env var name: expected ^[A-Z][A-Z0-9_]{1,63}$');

const oneLine = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((s) => !/[\r\n]/.test(s), 'must be a single line');

export const Summary = z.union([
  oneLine(LIMITS.summary),
  z
    .record(z.string().regex(LOCALE_RE, 'invalid BCP 47 locale'), oneLine(LIMITS.summary))
    .refine((m) => Object.hasOwn(m, 'en'), 'localized summary must include "en"')
    .refine((m) => Object.keys(m).length <= LIMITS.summaryLocales, `at most ${LIMITS.summaryLocales} locales`),
]);
export type Summary = z.infer<typeof Summary>;

const dest = z
  .string()
  .min(1)
  .max(LIMITS.pathLength)
  .superRefine((d, ctx) => {
    const problem = checkDest(d);
    if (problem)
      ctx.addIssue({ code: 'custom', message: `unsafe path (${problem})`, params: { genpm: 'E_PATH_UNSAFE' } });
  });

const include = z.string().superRefine((i, ctx) => {
  const problem = checkInclude(i);
  if (problem)
    ctx.addIssue({ code: 'custom', message: `unsafe path (${problem})`, params: { genpm: 'E_PATH_UNSAFE' } });
});

const context = z.string().superRefine((x, ctx) => {
  const problem = checkContextPath(x);
  if (problem)
    ctx.addIssue({ code: 'custom', message: `unsafe path (${problem})`, params: { genpm: 'E_PATH_UNSAFE' } });
});

const ref = z.string().superRefine((t, ctx) => {
  const problem = checkRef(t);
  if (problem)
    ctx.addIssue({ code: 'custom', message: `invalid ref (${problem})`, params: { genpm: 'E_REF_MUTABLE' } });
});

const repo = z
  .string()
  .max(300)
  .regex(/^https:\/\/[a-z0-9.-]+(?::\d+)?\/[A-Za-z0-9._~/-]+$/, 'repo must be an https Git URL')
  .refine((r) => !r.endsWith('.git') && !r.endsWith('/'), 'repo URL must not end with ".git" or "/"');

export const McpServerObject = z
  .strictObject({
    n: z.string().regex(MCP_NAME_RE, 'invalid MCP server name'),
    c: z.string().min(1).max(64).optional(),
    a: z.array(z.string().max(512)).max(32).optional(),
    u: z
      .string()
      .regex(/^https:\/\//, 'MCP url must be https')
      .max(512)
      .optional(),
    e: z.array(env).max(LIMITS.env).optional(),
  })
  .refine(
    (m) => (m.c === undefined) !== (m.u === undefined),
    'MCP server needs exactly one of "c" (command) or "u" (url)',
  );
export type McpServerObject = z.infer<typeof McpServerObject>;

/** Forma abreviada: `"@stripe/mcp"` (paquete npm ejecutado con npx). */
export const McpServerShorthand = z
  .string()
  .min(1)
  .max(214)
  .regex(/^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/, 'MCP shorthand must be an npm package name');

export const McpServerEntry = z.union([McpServerShorthand, McpServerObject]);
export type McpServerEntry = z.infer<typeof McpServerEntry>;

const coreShape = {
  $: z.literal(1).optional(),
  n: name,
  v: version,
  s: Summary.optional(),
  r: repo.optional(),
  t: ref.optional(),
  d: dest,
  i: include.optional(),
  x: context.optional(),
  l: z.string().min(1).max(128).optional(),
  k: z
    .array(z.string().regex(KEYWORD_RE, 'invalid keyword'))
    .max(LIMITS.keywords)
    .refine((k) => new Set(k).size === k.length, 'keywords must be unique')
    .optional(),
  g: z
    .record(name, z.string().min(1).max(64))
    .refine((g) => Object.keys(g).length <= LIMITS.genpmDeps, `at most ${LIMITS.genpmDeps} GenPM deps`)
    .optional(),
  p: z
    .record(z.string().min(1).max(214), z.string().min(1).max(64))
    .refine((p) => Object.keys(p).length <= LIMITS.npmDeps, `at most ${LIMITS.npmDeps} npm deps`)
    .optional(),
  e: z
    .array(env)
    .max(LIMITS.env)
    .refine((e) => new Set(e).size === e.length, 'env vars must be unique')
    .optional(),
  m: z.array(McpServerEntry).max(LIMITS.mcp).optional(),
};

/** Solo se aceptan claves conocidas o extensiones `_*` (manifest-spec §3.2). */
function rejectUnknownKeys(known: readonly string[]) {
  return (obj: Record<string, unknown>, ctx: z.RefinementCtx) => {
    for (const key of Object.keys(obj)) {
      if (!known.includes(key) && !key.startsWith('_')) {
        ctx.addIssue({ code: 'custom', path: [key], message: `unknown key "${key}"` });
      }
    }
  };
}

/** `x` debe quedar dentro de `i` (manifest-spec §5.4) — garantizado porque `x` no admite `..`. */
const SOURCE_KEYS = Object.keys(coreShape);

export const SourceManifest = z
  .object(coreShape)
  .catchall(z.unknown())
  .superRefine((m, ctx) => {
    if (Object.hasOwn(m, 'c')) {
      ctx.addIssue({ code: 'custom', path: ['c'], message: 'source manifest must not contain its own commit "c"' });
    }
    rejectUnknownKeys(SOURCE_KEYS)(m, ctx);
  });
export type SourceManifest = z.infer<typeof SourceManifest>;

const RESOLVED_KEYS = [...SOURCE_KEYS, 'c', 'sg'];

export const ResolvedManifest = z
  .object({
    ...coreShape,
    $: z.literal(1),
    r: repo,
    t: ref,
    c: sha,
    i: include,
    x: context,
    l: z.string().min(1).max(128),
    /** Firma `<keyid>:<base64url>` adjunta en respuestas compactas; no forma parte de la forma canónica. */
    sg: z.string().max(200).optional(),
  })
  .catchall(z.unknown())
  .superRefine(rejectUnknownKeys(RESOLVED_KEYS));
export type ResolvedManifest = z.infer<typeof ResolvedManifest>;

export const LockEntry = z.strictObject({
  v: version,
  r: z.string().min(1).max(300),
  t: z.string().min(1).max(300),
  c: z.string().min(1).max(64),
  d: dest,
  x: context,
  h: z.string().regex(/^sha256-[A-Za-z0-9+/=_-]+$/, 'invalid integrity hash'),
  sg: z.string().max(200).optional(),
  m: z.union([z.literal(0), z.literal(1)]),
  by: z.enum(['cli', 'mcp']),
  /** Dependencias GenPM declaradas (`g`), para `E_REQUIRED_BY` sin red. */
  g: z.record(name, z.string()).optional(),
});
export type LockEntry = z.infer<typeof LockEntry>;

export const LockFile = z.strictObject({
  $: z.literal(1),
  p: z.record(name, LockEntry),
});
export type LockFile = z.infer<typeof LockFile>;

/** `.genpm/files/<slug>.json` (manifest-spec §6.2). */
export const FilesIndex = z.strictObject({
  c: z.string().min(1).max(64),
  f: z.record(z.string(), z.string().regex(/^sha256-[A-Za-z0-9+/=_-]+$/)),
});
export type FilesIndex = z.infer<typeof FilesIndex>;

export const DistTag = z.string().regex(DIST_TAG_RE);
