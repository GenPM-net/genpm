import { describe, expect, it } from 'vitest';
import { validateRecipe } from './recipe.js';

describe('validateRecipe (V03-05)', () => {
  it('accepts registry specs with ranges and localized summaries', () => {
    const r = validateRecipe({
      name: 'saas-starter',
      s: { en: 'DB + auth + billing', es: 'BD + auth + cobros' },
      p: ['@core/db', '@core/auth@^1.2', '@core/billing@latest'],
    });
    expect(r).toEqual({
      ok: true,
      data: {
        name: 'saas-starter',
        s: { en: 'DB + auth + billing', es: 'BD + auth + cobros' },
        p: ['@core/db', '@core/auth@^1.2', '@core/billing@latest'],
      },
    });
  });
  it('rejects git specs, duplicates, bad slugs and empty lists', () => {
    const bad = (x: unknown) => (validateRecipe(x) as { ok: false; issues: Array<{ path: string }> }).issues;
    expect(bad({ name: 'x1', p: ['gh:a/b#v1'] })[0]!.path).toBe('p.0');
    expect(bad({ name: 'x1', p: ['@a/b', '@a/b@1.0.0'] })[0]!.path).toBe('p.1');
    expect(bad({ name: 'Bad Slug', p: ['@a/b'] })[0]!.path).toBe('name');
    expect(bad({ name: 'ok-1', p: [] })[0]!.path).toBe('p');
    expect(bad({ name: 'ok-1', p: ['@a/b'], extra: 1 })[0]!.path).toBe('$');
  });
});
