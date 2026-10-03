// Resaltado de código con Shiki en el edge (motor de regex JS, sin WASM ni JS en el cliente). Los colores salen de
// variables CSS (`--shiki-*`) mapeadas a los tokens de marca en site.css: el modo oscuro funciona sin otro tema.
import { createCssVariablesTheme, createHighlighterCoreSync } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import bash from 'shiki/langs/bash.mjs';
import css from 'shiki/langs/css.mjs';
import html from 'shiki/langs/html.mjs';
import javascript from 'shiki/langs/javascript.mjs';
import json from 'shiki/langs/json.mjs';
import markdown from 'shiki/langs/markdown.mjs';
import powershell from 'shiki/langs/powershell.mjs';
import sql from 'shiki/langs/sql.mjs';
import toml from 'shiki/langs/toml.mjs';
import tsx from 'shiki/langs/tsx.mjs';
import typescript from 'shiki/langs/typescript.mjs';
import yaml from 'shiki/langs/yaml.mjs';

const theme = createCssVariablesTheme({ name: 'genpm', variablePrefix: '--shiki-' });
let hl: ReturnType<typeof createHighlighterCoreSync> | null = null;

function highlighter() {
  hl ??= createHighlighterCoreSync({
    themes: [theme],
    langs: [bash, css, html, javascript, json, markdown, powershell, sql, toml, tsx, typescript, yaml],
    engine: createJavaScriptRegexEngine(),
  });
  return hl;
}

const EXT: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'tsx',
  json: 'json',
  md: 'markdown',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  shell: 'bash',
  ps1: 'powershell',
  powershell: 'powershell',
  pwsh: 'powershell',
  sql: 'sql',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  css: 'css',
  html: 'html',
  typescript: 'typescript',
  javascript: 'javascript',
};

export function langFor(nameOrLang: string): string | null {
  const key = nameOrLang.toLowerCase().split('.').pop() ?? '';
  return EXT[key] ?? null;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** HTML resaltado (o escapado si el lenguaje no está soportado), con números de línea opcionales. */
export function highlight(code: string, lang: string | null, opts: { lines?: boolean } = {}): string {
  if (code.length > 200_000) lang = null;
  let html: string;
  try {
    html = lang
      ? highlighter().codeToHtml(code, { lang, theme: 'genpm' })
      : `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  } catch {
    html = `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
  return opts.lines ? html.replace('<pre class="shiki', '<pre class="shiki ln-on') : html;
}
