// Constructor de genpm.json (web-ui-spec §5.7): formulario ↔ JSON en vivo, validado en el navegador con
// @genpm/manifest (el mismo zod que el registry) y contador de tokens de AGENTS.md.
import { canonicalObject, estimateTokens, validateSource } from '@genpm/manifest';
import { useMemo, useState } from 'preact/hooks';

type L = Record<
  | 'fName'
  | 'fVersion'
  | 'fSummary'
  | 'fDest'
  | 'fLicense'
  | 'fKeywords'
  | 'fDeps'
  | 'fNpm'
  | 'fEnv'
  | 'fMcp'
  | 'copyJson'
  | 'valid'
  | 'issues'
  | 'rulesTokens'
  | 'rulesCount'
  | 'copied'
  | 'issuesOne',
  string
>;

const pairs = (s: string) =>
  Object.fromEntries(
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const [k, v] = x.split(/\s+/);
        return [k!, v ?? '*'];
      }),
  );

export default function ManifestBuilder({ labels }: { labels: L }) {
  const [f, setF] = useState({
    n: '@acme/payments',
    v: '1.0.0',
    s: 'Stripe Checkout and webhooks for Hono',
    d: 'src/lib/payments',
    l: 'MIT',
    k: 'billing, stripe',
    g: '@core/db ^1.0.0',
    p: 'stripe ^17.0.0',
    e: 'STRIPE_SECRET_KEY',
    m: false,
  });
  const [rules, setRules] = useState('');
  const [copied, setCopied] = useState(false);
  const set = (key: keyof typeof f) => (e: Event) =>
    setF({
      ...f,
      [key]:
        (e.target as HTMLInputElement).type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : (e.target as HTMLInputElement).value,
    });
  const manifest = useMemo(() => {
    const o: Record<string, unknown> = { $: 1, n: f.n.trim(), v: f.v.trim() };
    if (f.s.trim()) o['s'] = { en: f.s.trim() };
    o['d'] = f.d.trim();
    if (f.l.trim()) o['l'] = f.l.trim();
    const k = f.k
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (k.length) o['k'] = k;
    const g = pairs(f.g);
    if (Object.keys(g).length) o['g'] = g;
    const p = pairs(f.p);
    if (Object.keys(p).length) o['p'] = p;
    const e = f.e.split(/[\s,]+/).filter(Boolean);
    if (e.length) o['e'] = e;
    if (f.m) o['m'] = [{ n: 'stripe', c: 'npx', a: ['-y', '@stripe/mcp'], e: ['STRIPE_SECRET_KEY'] }];
    return o;
  }, [f]);
  const result = validateSource(manifest);
  const issues = result.ok ? [] : result.issues;
  const errFor = (key: string) => issues.find((i) => i.path === key || i.path.startsWith(`${key}.`))?.message;
  const json = JSON.stringify(canonicalObject(manifest), null, 2);
  const field = (key: keyof typeof f, label: string, mono = true) => (
    <div class="field">
      <label for={`f-${key}`}>
        {key} <em>· {label}</em>
      </label>
      <input
        id={`f-${key}`}
        class={mono ? 'mono' : undefined}
        value={f[key] as string}
        onInput={set(key)}
        aria-invalid={errFor(key) ? 'true' : 'false'}
        aria-describedby={`e-${key}`}
      />
      <span class="err" id={`e-${key}`}>
        {errFor(key) ? `${result.ok ? '' : result.code} · ${errFor(key)}` : ''}
      </span>
    </div>
  );
  return (
    <div class="builder">
      <form onSubmit={(e) => e.preventDefault()} novalidate>
        <div class="two">
          {field('n', labels.fName)}
          {field('v', labels.fVersion)}
        </div>
        {field('s', labels.fSummary, false)}
        <div class="two">
          {field('d', labels.fDest)}
          {field('l', labels.fLicense)}
        </div>
        {field('k', labels.fKeywords)}
        {field('g', labels.fDeps)}
        {field('p', labels.fNpm)}
        {field('e', labels.fEnv)}
        <label class="check">
          <input type="checkbox" checked={f.m} onChange={set('m')} /> m · {labels.fMcp}
        </label>
        <div class="field">
          <label for="f-rules">
            AGENTS.md <em>· {labels.rulesTokens}</em>
          </label>
          <textarea
            id="f-rules"
            rows={5}
            value={rules}
            onInput={(e) => setRules((e.target as HTMLTextAreaElement).value)}
            style="border:1px solid var(--line-2);border-radius:var(--r);padding:8px;font-family:var(--f-mono);font-size:12px"
          />
          {rules && <span class="hint">{labels.rulesCount.replace('{count}', String(estimateTokens(rules)))}</span>}
        </div>
      </form>
      <div class="out">
        <div class="bar">
          <span>genpm.json</span>
          <button
            type="button"
            class="cp"
            style="border:0;padding:0;min-width:0;font-size:11.5px"
            onClick={async () => {
              await navigator.clipboard?.writeText(json).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? labels.copied : labels.copyJson}
          </button>
        </div>
        <pre>{json}</pre>
        <div class="vbar" aria-live="polite">
          {result.ok ? (
            <span style="color:var(--code-ink)">✔ {labels.valid}</span>
          ) : (
            <span style="color:var(--danger)">
              ✖ {issues.length === 1 ? labels.issuesOne : labels.issues.replace('{count}', String(issues.length))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
