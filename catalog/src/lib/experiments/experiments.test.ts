import { beforeEach, describe, expect, it } from 'vitest';
import { recordConsent } from '../consent/index.js';
import * as consentSchema from '../consent/schema.js';
import type { AdminContext } from '../contracts/index.js';
import { testDb } from '../db/__fixtures__/pglite.js';
import type { Db } from '../db/index.js';
import * as jobsSchema from '../jobs/schema.js';
import * as schema from './schema.js';
import {
  compare,
  experimentParticipants,
  experimentResults,
  experimentsAdminResource,
  getVariant,
  normalCdf,
  pickVariant,
  pruneParticipants,
  recordConversion,
  setExperimentStatus,
  upsertExperiment,
} from './index.js';

let db: Db;
const visitor = async (analytics: boolean) => {
  const { setCookies } = await recordConsent({ choices: { analytics, marketing: false, preferences: false }, action: 'banner' });
  return setCookies[0]!.split(';')[0]!;
};
const admin: AdminContext = { user: { id: 'u', email: null, name: null }, can: async () => true };

beforeEach(async () => {
  db = await testDb(consentSchema, jobsSchema, schema);
  process.env.EXPERIMENTS_SECRET = 'e'.repeat(40);
});

describe('statistics (reference values)', () => {
  it('normal CDF', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 5);
    expect(normalCdf(-1.644854)).toBeCloseTo(0.05, 5);
  });

  it('two-proportion z-test: 20% vs 25% with 1000 each', () => {
    const c = compare({ n: 1000, conversions: 200 }, { n: 1000, conversions: 250 });
    expect(c.z).toBeCloseTo(2.6774, 3);
    expect(c.pValue).toBeCloseTo(0.00742, 4);
    expect(c.lift).toBeCloseTo(0.25, 6);
    expect(c.ci95[0]).toBeCloseTo(0.01346, 4);
    expect(c.ci95[1]).toBeCloseTo(0.08654, 4);
    expect(c.significant).toBe(true);
  });

  it('small or equal samples are not significant', () => {
    expect(compare({ n: 50, conversions: 5 }, { n: 50, conversions: 15 }).significant).toBe(false); // muestra mínima
    expect(compare({ n: 1000, conversions: 200 }, { n: 1000, conversions: 205 }).significant).toBe(false);
    expect(compare({ n: 0, conversions: 0 }, { n: 0, conversions: 0 })).toMatchObject({ pValue: 1, lift: null });
  });

  it('splits traffic by weight', () => {
    const v = [
      { key: 'a', weight: 80 },
      { key: 'b', weight: 20 },
    ];
    expect([0, 7999, 8000, 9999].map((b) => pickVariant(v, b))).toEqual(['a', 'a', 'b', 'b']);
  });
});

describe('assignment and conversions', () => {
  it('without analytics consent everyone sees the control and nothing is stored', async () => {
    const e = await upsertExperiment({ key: 'hero', name: 'Hero', goal: 'lead', variants: [{ key: 'a' }, { key: 'b' }] });
    expect(await getVariant('hero', null)).toEqual({ variant: 'a', control: true, tracked: false }); // borrador
    await setExperimentStatus(e.id, 'running');
    expect(await getVariant('hero', await visitor(false))).toMatchObject({ variant: 'a', tracked: false });
    expect(await getVariant('missing', null)).toMatchObject({ control: true, tracked: false });
    expect(await recordConversion('lead', await visitor(false))).toBe(0);
    expect(await db.select().from(experimentParticipants)).toEqual([]);
  });

  it('assigns stably, splits roughly by weight and counts one conversion per visitor', async () => {
    const e = await upsertExperiment({ key: 'hero', name: 'Hero', goal: 'lead', variants: [{ key: 'a', weight: 50 }, { key: 'b', weight: 50 }] });
    await setExperimentStatus(e.id, 'running');
    const cookies = await Promise.all(Array.from({ length: 200 }, () => visitor(true)));
    const first = await Promise.all(cookies.map((c) => getVariant('hero', c)));
    const again = await Promise.all(cookies.map((c) => getVariant('hero', c)));
    expect(again.map((a) => a.variant)).toEqual(first.map((a) => a.variant)); // estable
    const b = first.filter((a) => a.variant === 'b').length;
    expect(b).toBeGreaterThan(60);
    expect(b).toBeLessThan(140);
    // Convierten todos los de B y ninguno de A; repetir la conversión no cuenta dos veces.
    for (const [i, c] of cookies.entries()) if (first[i]!.variant === 'b') await recordConversion('lead', c);
    for (const [i, c] of cookies.entries()) if (first[i]!.variant === 'b') expect(await recordConversion('lead', c)).toBe(0);
    expect(await recordConversion('purchase', cookies[0]!)).toBe(0); // otro objetivo
    const r = await experimentResults(e.id);
    expect(r.map((x) => [x.variant, x.participants, x.conversions])).toEqual([
      ['a', 200 - b, 0],
      ['b', b, b],
    ]);
    expect(r[1]!.vsControl).toMatchObject({ controlRate: 0, variantRate: 1, lift: null });
  });

  it('freezes results when stopped and prunes participants later', async () => {
    const e = await upsertExperiment({ key: 'cta', name: 'CTA', goal: 'lead', variants: [{ key: 'a' }, { key: 'b' }] });
    await setExperimentStatus(e.id, 'running');
    const c = await visitor(true);
    await getVariant('cta', c);
    await recordConversion('lead', c);
    await expect(upsertExperiment({ key: 'cta', name: 'CTA', goal: 'lead', variants: [{ key: 'a', weight: 90 }, { key: 'b', weight: 10 }] }, e.id)).rejects.toMatchObject({ code: 'invalid_state' });
    const stopped = await setExperimentStatus(e.id, 'stopped');
    expect(stopped.results).toHaveLength(2);
    expect(await getVariant('cta', c)).toMatchObject({ variant: 'a', tracked: false }); // parado: control
    expect(await pruneParticipants(30)).toBe(0);
    expect(await pruneParticipants(-1)).toBe(1);
    expect((await experimentResults(e.id)).reduce((s, x) => s + x.participants, 0)).toBe(1); // congelados
    await expect(setExperimentStatus(e.id, 'running')).rejects.toMatchObject({ code: 'invalid_state' });
  });
});

describe('admin', () => {
  it('creates, starts and summarizes experiments', async () => {
    const created = await experimentsAdminResource.create!({ key: 'hero', name: 'Hero test', goal: 'lead', variants: [{ key: 'a' }, { key: 'b' }] }, admin);
    expect(created.summary).toBe('Not started');
    const start = experimentsAdminResource.actions!.find((a) => a.name === 'start')!;
    expect(start.available!(created)).toBe(true);
    const running = await start.run(created.id, {}, admin);
    expect(running.summary).toBe('a (control): 0.0% (0/0)\nb: 0.0% (0/0) · — · p=1.000 · not significant yet');
    await expect(experimentsAdminResource.list({ page: 1, pageSize: 10 }, { ...admin, can: async () => false })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(experimentsAdminResource.create!({ key: 'x', name: 'x', goal: 'lead', variants: [{ key: 'a' }] }, admin)).rejects.toThrow();
  });
});
