// Escáner v1 determinista (security §3.1). Puro y compartido: lo ejecutan el registry en publish y el cliente
// sobre lo descargado (`genpm add`) y en `genpm validate`. Doble verificación: un registry comprometido no basta.

import { LIMITS } from './constants.js';
import { checkRelativePath } from './validators.js';

export type ScanFile = {
  /** Ruta POSIX relativa a `i`. */
  path: string;
  size: number;
  /** Contenido; `undefined` si no se descargó (p. ej. archivos grandes en publish). */
  content?: Uint8Array | string;
  isSymlink?: boolean;
  /** Modo POSIX (para avisar de ejecutables, INV-4). */
  mode?: number;
};

export type Severity = 'fail' | 'flag' | 'warn';
export type ScanStatus = 'passed' | 'flagged' | 'failed';

export type ScanRule =
  | 'rules.override'
  | 'rules.exfiltration'
  | 'rules.pipe_shell'
  | 'rules.encoded_blob'
  | 'rules.invisible_chars'
  | 'rules.shortener'
  | 'rules.too_large'
  | 'rules.tokens'
  | 'autorun'
  | 'trojan_source.bidi'
  | 'trojan_source.homoglyph'
  | 'secret'
  | 'code.eval_decoded'
  | 'code.ip_literal'
  | 'code.minified'
  | 'code.binary'
  | 'path.unsafe'
  | 'path.symlink'
  | 'path.collision'
  | 'size.files'
  | 'size.total'
  | 'size.file'
  | 'perm.executable'
  | 'typosquat';

export type Finding = { rule: ScanRule; severity: Severity; path?: string; line?: number; detail: string };

export type ScanReport = {
  status: ScanStatus;
  findings: Finding[];
  files: number;
  bytes: number;
  rulesTokens: number;
};

// ───────────── Patrones ─────────────

/** Frases de override en los 8 idiomas soportados (en, es, pt-BR, fr, de, ja, zh-CN, ko). */
const OVERRIDE = [
  /\b(ignore|disregard|forget|override)\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|system)\s+(instructions?|prompts?|rules?|messages?)/i,
  /\bdo\s+not\s+(tell|inform|show|mention\s+(this\s+)?to)\s+the\s+user\b/i,
  /\b(don't|never)\s+(tell|inform)\s+the\s+user\b/i,
  /\byou\s+are\s+now\s+(in\s+)?(developer|dan|jailbreak|god)\s*mode\b/i,
  /\bnew\s+system\s+prompt\b/i,
  /\bignora\s+(todas\s+)?las\s+instrucciones\s+(anteriores|previas)/i,
  /\bno\s+(le\s+)?(digas|cuentes|informes)\s+(nada\s+)?al\s+usuario\b/i,
  /\bignore\s+(todas\s+)?as\s+instru[çc][õo]es\s+(anteriores|pr[ée]vias)/i,
  /\bn[ãa]o\s+(conte|diga|informe)\s+(nada\s+)?ao\s+usu[áa]rio\b/i,
  /\bignore[zr]?\s+(toutes\s+)?les\s+instructions\s+(pr[ée]c[ée]dentes|ant[ée]rieures)/i,
  /\bne\s+(le\s+)?dis\s+(rien\s+)?[àa]\s+l'utilisateur\b/i,
  /\bignorier(e|en)?\s+(alle\s+)?(vorherigen|bisherigen)\s+(anweisungen|instruktionen)/i,
  /\bsag(e)?\s+(dem\s+)?(benutzer|nutzer)\s+nichts\b/i,
  /(以前|前|上記)の(指示|命令)を(すべて)?無視/,
  /ユーザーに(は)?(言わ|伝え|知らせ)ないで/,
  /忽略(之前|以上|先前|所有)(的)?(所有)?(指令|指示|说明)/,
  /不要(告诉|通知)用户/,
  /(이전|위의)\s*(모든\s*)?(지시|명령)(를|을)?\s*무시/,
  /사용자에게\s*(알리지|말하지)\s*(마|말)/,
];

const EXFIL_VERB = /\b(send|post|upload|exfiltrate|transmit|forward|curl|wget|fetch)\b/i;
const URL_RE = /\bhttps?:\/\/[^\s)>\]"'`]+/gi;
const PIPE_SHELL =
  /\b(curl|wget|iwr|Invoke-WebRequest)\b[^\n|]*\|\s*(sudo\s+)?(sh|bash|zsh|pwsh|powershell|iex|python3?|node)\b/i;
const BASE64_BLOB = /[A-Za-z0-9+/]{200,}={0,2}/;
const HEX_BLOB = /\b(?:[0-9a-fA-F]{2}){100,}\b/;
const SHORTENERS =
  /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|ow\.ly|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|rb\.gy|tiny\.cc)\//i;

/** Unicode Tags, zero-width y otros invisibles (no bidi: ese tiene su propia regla). */
const INVISIBLE = /[­᠎​-‍⁠-⁤﻿\u{E0000}-\u{E007F}]/u;
/** Controles bidi de Trojan Source (CVE-2021-42574). */
const BIDI = /[؜‎‏‪-‮⁦-⁩]/;
/** Letras cirílicas o griegas que se confunden con latinas, pegadas a un identificador ASCII. */
const HOMOGLYPH = /[A-Za-z_$][A-Za-z0-9_$]*[Α-ωЀ-ӿ]|[Α-ωЀ-ӿ][A-Za-z0-9_$]+/;

const SECRETS: Array<[string, RegExp]> = [
  ['aws_access_key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['stripe_live_key', /\b(sk|rk)_live_[0-9a-zA-Z]{20,}\b/],
  ['github_token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
  ['genpm_token', /\bgpm_[A-Za-z0-9]{40,}\b/],
  ['private_key', /-----BEGIN ((RSA|EC|DSA|OPENSSH|PGP|ENCRYPTED) )?PRIVATE KEY( BLOCK)?-----/],
  ['slack_token', /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/],
  ['google_api_key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['openai_key', /\bsk-(proj-)?[A-Za-z0-9_-]{40,}\b/],
  ['anthropic_key', /\bsk-ant-[A-Za-z0-9_-]{40,}\b/],
];

const EVAL_DECODED =
  /\b(eval|Function)\s*\(\s*[^)]*\b(atob|Buffer\.from\([^)]*['"](base64|hex)['"]|decodeURIComponent|unescape|String\.fromCharCode)/;
const IP_LITERAL =
  /\b(fetch|axios|request|got|http\.get|https\.get|XMLHttpRequest|WebSocket)\s*\(?[^)\n]*['"`](https?|wss?):\/\/\d{1,3}(\.\d{1,3}){3}/;

const CODE_EXT = /\.(c|m)?[jt]sx?$|\.(py|rb|go|rs|java|kt|swift|php|sh|bash|zsh|ps1|vue|svelte|astro)$/i;

const AUTORUN_EXACT = new Set([
  '.npmrc',
  'bunfig.toml',
  '.envrc',
  '.vscode/settings.json',
  'lefthook.yml',
  'lefthook.yaml',
  '.lefthook.yml',
  '.pre-commit-config.yaml',
  '.gitattributes',
  '.gitmodules',
]);
const AUTORUN_PREFIX = ['.devcontainer/', '.husky/'];
const LIFECYCLE = ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'preprepare', 'postprepare'];

// ───────────── Utilidades ─────────────

function text(f: ScanFile): string | null {
  if (f.content === undefined) return null;
  if (typeof f.content === 'string') return f.content;
  const head = f.content.subarray(0, 8000);
  if (head.includes(0)) return null;
  return new TextDecoder('utf-8', { fatal: false }).decode(f.content);
}

function isBinary(f: ScanFile): boolean {
  return f.content instanceof Uint8Array && f.content.subarray(0, 8000).includes(0);
}

function lineOf(s: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < s.length; i++) if (s.charCodeAt(i) === 10) line++;
  return line;
}

/** Estimación de tokens (≈ 4 caracteres por token en inglés; suficiente para límites y avisos). */
export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

/** Nombre base (sin directorio) en minúsculas y NFC: clave de colisión en sistemas de archivos insensibles. */
function collisionKey(p: string): string {
  return p.normalize('NFC').toLowerCase();
}

export function isAutorunFile(path: string, content?: string | null): boolean {
  const p = path.toLowerCase();
  const base = p.split('/').pop()!;
  if (AUTORUN_EXACT.has(p) || AUTORUN_EXACT.has(base)) return true;
  if (base.startsWith('.yarnrc')) return true;
  if (AUTORUN_PREFIX.some((pre) => p.startsWith(pre) || p.includes(`/${pre}`))) return true;
  if (base === 'tasks.json' && p.includes('.vscode/')) {
    return content == null || /"runOn"\s*:\s*"folderOpen"/.test(content);
  }
  if (base === 'package.json' && content) {
    try {
      const scripts = (JSON.parse(content) as { scripts?: Record<string, unknown> }).scripts ?? {};
      return LIFECYCLE.some((s) => Object.hasOwn(scripts, s));
    } catch {
      return false;
    }
  }
  return false;
}

// ───────────── Reglas IA (x) ─────────────

export function scanRules(rules: string, path = 'AGENTS.md'): Finding[] {
  const out: Finding[] = [];
  const bytes = new TextEncoder().encode(rules).length;
  if (bytes > LIMITS.contextBytes) {
    out.push({ rule: 'rules.too_large', severity: 'fail', path, detail: `${bytes} bytes > ${LIMITS.contextBytes}` });
  }
  const tokens = estimateTokens(rules);
  if (tokens > LIMITS.rulesTokensWarn) {
    out.push({ rule: 'rules.tokens', severity: 'warn', path, detail: `~${tokens} tokens > ${LIMITS.rulesTokensWarn}` });
  }
  for (const re of OVERRIDE) {
    const m = re.exec(rules);
    if (m)
      out.push({
        rule: 'rules.override',
        severity: 'flag',
        path,
        line: lineOf(rules, m.index),
        detail: m[0].slice(0, 80),
      });
  }
  const lines = rules.split('\n');
  lines.forEach((l, i) => {
    const urls = l.match(URL_RE);
    if (urls && EXFIL_VERB.test(l)) {
      out.push({ rule: 'rules.exfiltration', severity: 'flag', path, line: i + 1, detail: urls[0]!.slice(0, 80) });
    }
    if (PIPE_SHELL.test(l))
      out.push({ rule: 'rules.pipe_shell', severity: 'flag', path, line: i + 1, detail: l.trim().slice(0, 80) });
    if (SHORTENERS.test(l))
      out.push({ rule: 'rules.shortener', severity: 'flag', path, line: i + 1, detail: l.trim().slice(0, 80) });
  });
  const blob = BASE64_BLOB.exec(rules) ?? HEX_BLOB.exec(rules);
  if (blob)
    out.push({
      rule: 'rules.encoded_blob',
      severity: 'flag',
      path,
      line: lineOf(rules, blob.index),
      detail: `${blob[0].length} chars`,
    });
  const inv = INVISIBLE.exec(rules) ?? BIDI.exec(rules);
  if (inv) {
    const cp = inv[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
    out.push({
      rule: 'rules.invisible_chars',
      severity: 'flag',
      path,
      line: lineOf(rules, inv.index),
      detail: `U+${cp}`,
    });
  }
  return out;
}

// ───────────── Árbol de archivos ─────────────

export type ScanOptions = {
  /** Ruta de `x` relativa a `i` (default `AGENTS.md`). */
  contextPath?: string;
  maxFiles?: number;
  maxBytes?: number;
};

export function scanTree(files: readonly ScanFile[], opts: ScanOptions = {}): ScanReport {
  const findings: Finding[] = [];
  const maxFiles = opts.maxFiles ?? LIMITS.files;
  const maxBytes = opts.maxBytes ?? LIMITS.packageBytes;
  const contextPath = opts.contextPath ?? 'AGENTS.md';
  let bytes = 0;
  let rulesTokens = 0;
  const seen = new Map<string, string>();

  if (files.length > maxFiles) {
    findings.push({ rule: 'size.files', severity: 'fail', detail: `${files.length} files > ${maxFiles}` });
  }

  for (const f of files) {
    bytes += f.size;
    const problem = checkRelativePath(f.path);
    if (problem) {
      findings.push({ rule: 'path.unsafe', severity: 'fail', path: f.path, detail: problem });
      continue;
    }
    if (f.isSymlink) {
      findings.push({ rule: 'path.symlink', severity: 'fail', path: f.path, detail: 'symlink' });
      continue;
    }
    const key = collisionKey(f.path);
    const prev = seen.get(key);
    if (prev !== undefined) findings.push({ rule: 'path.collision', severity: 'fail', path: f.path, detail: prev });
    else seen.set(key, f.path);

    if (f.size > LIMITS.fileBytes)
      findings.push({ rule: 'size.file', severity: 'warn', path: f.path, detail: `${f.size} bytes` });
    if (f.mode !== undefined && (f.mode & 0o111) !== 0) {
      findings.push({ rule: 'perm.executable', severity: 'warn', path: f.path, detail: (f.mode & 0o777).toString(8) });
    }

    const body = text(f);
    if (isAutorunFile(f.path, body)) {
      findings.push({ rule: 'autorun', severity: 'fail', path: f.path, detail: f.path });
    }
    if (isBinary(f)) {
      findings.push({ rule: 'code.binary', severity: 'flag', path: f.path, detail: 'binary file' });
      continue;
    }
    if (body === null) continue;

    if (f.path === contextPath) {
      rulesTokens = estimateTokens(body);
      findings.push(...scanRules(body, f.path));
    }
    for (const [kind, re] of SECRETS) {
      const m = re.exec(body);
      if (m)
        findings.push({ rule: 'secret', severity: 'fail', path: f.path, line: lineOf(body, m.index), detail: kind });
    }
    if (CODE_EXT.test(f.path)) {
      const bidi = BIDI.exec(body);
      if (bidi)
        findings.push({
          rule: 'trojan_source.bidi',
          severity: 'fail',
          path: f.path,
          line: lineOf(body, bidi.index),
          detail: 'bidi control',
        });
      const homo = scanHomoglyphs(body);
      if (homo)
        findings.push({
          rule: 'trojan_source.homoglyph',
          severity: 'fail',
          path: f.path,
          line: homo.line,
          detail: homo.token,
        });
      const ev = EVAL_DECODED.exec(body);
      if (ev)
        findings.push({
          rule: 'code.eval_decoded',
          severity: 'flag',
          path: f.path,
          line: lineOf(body, ev.index),
          detail: ev[0].slice(0, 60),
        });
      const ip = IP_LITERAL.exec(body);
      if (ip)
        findings.push({
          rule: 'code.ip_literal',
          severity: 'flag',
          path: f.path,
          line: lineOf(body, ip.index),
          detail: ip[0].slice(0, 60),
        });
      if (/\.(c|m)?js$/.test(f.path) && body.split('\n').some((l) => l.length > 1000)) {
        findings.push({ rule: 'code.minified', severity: 'flag', path: f.path, detail: 'line > 1000 chars' });
      }
    }
  }

  if (bytes > maxBytes) findings.push({ rule: 'size.total', severity: 'fail', detail: `${bytes} bytes > ${maxBytes}` });

  return { status: statusOf(findings), findings, files: files.length, bytes, rulesTokens };
}

/** Homoglifos fuera de comentarios y cadenas: busca tokens que mezclan alfabetos en el código. */
function scanHomoglyphs(body: string): { line: number; token: string } | null {
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    // Las líneas enormes (minificado) ya se marcan aparte; aquí se acotan para que la regex siga siendo lineal.
    if (lines[i]!.length > 2000) continue;
    const code = lines[i]!.replace(/\/\/.*$/, '').replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
    const m = HOMOGLYPH.exec(code);
    if (m) return { line: i + 1, token: m[0].slice(0, 40) };
  }
  return null;
}

export function statusOf(findings: readonly Finding[]): ScanStatus {
  if (findings.some((f) => f.severity === 'fail')) return 'failed';
  if (findings.some((f) => f.severity === 'flag')) return 'flagged';
  return 'passed';
}

// ───────────── Typosquatting (registry) ─────────────

const CONFUSABLE: Record<string, string> = {
  '0': 'o',
  '1': 'l',
  '3': 'e',
  '5': 's',
  '7': 't',
  rn: 'm',
  vv: 'w',
  i: 'l',
};

function skeleton(s: string): string {
  let out = s.toLowerCase();
  for (const [from, to] of Object.entries(CONFUSABLE)) out = out.split(from).join(to);
  return out.replace(/[-_.]/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/**
 * Paquetes populares de otro scope a distancia ≤ 1 o con el mismo esqueleto de confusables (security §3.1).
 * Resultado no vacío ⇒ `flagged` (cuarentena, revisión humana).
 */
export function typosquatMatches(name: string, popular: readonly string[]): string[] {
  const scope = name.split('/')[0];
  return popular.filter((p) => {
    if (p === name || p.split('/')[0] === scope) return false;
    return levenshtein(p, name) <= 1 || skeleton(p) === skeleton(name);
  });
}
