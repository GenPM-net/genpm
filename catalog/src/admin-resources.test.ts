// Contrato entre el panel y cada AdminResource exportado por los módulos: el panel envía los campos por su `name`, así
// que cada campo obligatorio y editable tiene que validarse en `input` con ese mismo nombre (y al revés).
import { readdirSync } from 'node:fs';
import { expect, it } from 'vitest';

type Resource = {
  name: string;
  fields: Array<{ name: string; required?: boolean; readOnly?: boolean }>;
  input?: { safeParse(x: unknown): { error?: { issues: Array<{ path: PropertyKey[] }> } } };
};

it('every required editable field of every admin resource is the key its input validates', async () => {
  const resources: Array<[string, Resource]> = [];
  for (const m of readdirSync(new URL('./lib', import.meta.url))) {
    const mod = (await import(`./lib/${m}/index.ts`)) as Record<string, unknown>;
    for (const [k, v] of Object.entries(mod)) {
      const r = v as Resource;
      if (r && typeof r === 'object' && Array.isArray(r.fields) && typeof r.input?.safeParse === 'function') resources.push([`${m}.${k}`, r]);
    }
  }
  expect(resources.length).toBeGreaterThan(10);
  const problems = resources.flatMap(([id, r]) => {
    const validated = new Set((r.input!.safeParse({}).error?.issues ?? []).map((i) => String(i.path[0])));
    const top = (f: { name: string }) => f.name.split('.')[0]!;
    const unvalidated = r.fields.filter((f) => f.required && !f.readOnly && !validated.has(top(f))).map(top);
    const unknown = [...validated].filter((p) => p !== 'undefined' && !r.fields.some((f) => top(f) === p));
    return unvalidated.length || unknown.length ? [`${id}: fields without validation [${unvalidated}] · validated but not a field [${unknown}]`] : [];
  });
  expect(problems).toEqual([]);
});
