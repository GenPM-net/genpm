// V03-05: recetas compose en core (archivo local o slug del registry).
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listRecipes, loadRecipe } from '../src/ops.js';
import { FakeRegistry, REGISTRY } from './fake-registry.js';

describe('loadRecipe', () => {
  it('reads and validates a local recipe file', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'genpm-recipe-'));
    await writeFile(
      join(cwd, 'saas.json'),
      JSON.stringify({ name: 'saas', s: { en: 'SaaS', es: 'SaaS (es)' }, p: ['@core/db', '@core/auth@^1'] }),
    );
    const r = await loadRecipe({ cwd, recipe: './saas.json', locale: 'es', home: cwd });
    expect(r).toEqual({ name: 'saas', summary: 'SaaS (es)', specs: ['@core/db', '@core/auth@^1'], source: 'file' });
    await writeFile(join(cwd, 'bad.json'), JSON.stringify({ name: 'bad', p: ['gh:a/b#v1'] }));
    await expect(loadRecipe({ cwd, recipe: 'bad.json', home: cwd })).rejects.toMatchObject({
      code: 'E_MANIFEST_INVALID',
    });
    await expect(loadRecipe({ cwd, recipe: './missing.json', home: cwd })).rejects.toMatchObject({
      code: 'E_NOT_FOUND',
    });
  });

  it('fetches a recipe by slug from the registry and revalidates it', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'genpm-recipe-'));
    const reg = new FakeRegistry();
    reg.recipes['saas-starter'] = { summary: 'Starter', p: ['@core/db', '@core/auth'] };
    reg.recipes['evil'] = { summary: null, p: ['gh:evil/x#v1'] };
    const base = { cwd, home: cwd, registry: REGISTRY, fetchImpl: reg.fetch as typeof fetch };
    expect(await loadRecipe({ ...base, recipe: 'saas-starter' })).toMatchObject({
      specs: ['@core/db', '@core/auth'],
      source: 'registry',
    });
    await expect(loadRecipe({ ...base, recipe: 'evil' })).rejects.toMatchObject({ code: 'E_MANIFEST_INVALID' });
    await expect(loadRecipe({ ...base, recipe: 'Not A Slug' })).rejects.toMatchObject({ code: 'E_USAGE' });
    expect((await listRecipes(base)).map((r) => r.name)).toEqual(['saas-starter', 'evil']);
  });
});
