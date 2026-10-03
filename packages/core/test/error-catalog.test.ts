// D5-B-02: todos los errores tienen causa + fix, y cada `fail()` / `httpError()` del código pasa los parámetros que su
// mensaje necesita (si falta uno, el usuario vería `{detail}` literal). Análisis estático con el AST de TypeScript.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { en } from '@genpm/i18n';
import { ERRORS } from '@genpm/manifest';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../..');
const DIRS = ['packages/core/src', 'packages/cli/src', 'packages/mcp/src', 'apps/registry/src'];
const CALLEES = new Set(['fail', 'httpError']);

const sources = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((f) => f.isFile() && /\.tsx?$/.test(f.name) && !/\.(test|d)\.ts$/.test(f.name))
    .map((f) => join(f.parentPath, f.name));

/** Nombres de los argumentos ICU de un mensaje (`{name}`, `{count, plural, …}`). */
const paramsOf = (msg: string) => new Set([...msg.matchAll(/\{(\w+)(?=[,}])/g)].map((m) => m[1]!));

type Call = { where: string; code: string; keys: Set<string> | null };

function calls(): Call[] {
  const out: Call[] = [];
  for (const file of DIRS.flatMap(sources)) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        CALLEES.has(node.expression.text) &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const arg = node.arguments[1];
        const names = new Set<string>();
        // Spread, clave calculada o variable: no se puede comprobar estáticamente.
        let opaque = !!arg && !ts.isObjectLiteralExpression(arg);
        if (arg && ts.isObjectLiteralExpression(arg)) {
          for (const p of arg.properties) {
            if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) names.add(p.name.text);
            else opaque = true;
          }
        }
        const keys = opaque ? null : names;
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        out.push({ where: `${relative(ROOT, file)}:${line + 1}`, code: node.arguments[0].text, keys });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

describe('error catalog', () => {
  it('every E_* code has a message and an actionable fix in English', () => {
    for (const code of Object.keys(ERRORS)) {
      expect(en.has(`errors.${code}.message`), code).toBe(true);
      expect(en.has(`errors.${code}.fix`), code).toBe(true);
      const fix = en.raw(`errors.${code}.fix`, {});
      expect(fix.length, `${code} fix is too short`).toBeGreaterThan(10);
    }
  });

  it('every fail()/httpError() call passes the params its message and fix need', () => {
    const found = calls();
    expect(found.length).toBeGreaterThan(100);
    const problems: string[] = [];
    for (const c of found) {
      if (!(c.code in ERRORS)) {
        problems.push(`${c.where}: unknown code ${c.code}`);
        continue;
      }
      if (!c.keys) continue;
      const needed = new Set([
        ...paramsOf(en.raw(`errors.${c.code}.message`, {})),
        ...paramsOf(en.raw(`errors.${c.code}.fix`, {})),
      ]);
      const keys = c.keys;
      const missing = [...needed].filter((p) => !keys.has(p));
      if (missing.length) problems.push(`${c.where}: ${c.code} without {${missing.join(', ')}}`);
    }
    expect(problems).toEqual([]);
  });
});
