// Asistente de publicación (web-ui-spec §5.7): elige un repo de GitHub, ve qué le falta, edita el genpm.json generado
// y arregla cada punto con un enlace a GitHub con el archivo ya prerrellenado (GenPM nunca escribe en el repo).
import { agentsTemplate, canonicalObject, validateSource } from '@genpm/manifest';
import { useEffect, useMemo, useState } from 'preact/hooks';

export type WizardLabels = Record<
  | 'reposTitle'
  | 'reposFilter'
  | 'reposEmpty'
  | 'loading'
  | 'publishedAs'
  | 'back'
  | 'recheck'
  | 'formTitle'
  | 'fName'
  | 'fVersion'
  | 'fSummary'
  | 'fDest'
  | 'fLicense'
  | 'fKeywords'
  | 'hintName'
  | 'hintDest'
  | 'listTitle'
  | 'commitHint'
  | 'itemManifest'
  | 'manifestMissing'
  | 'manifestDiffers'
  | 'manifestInvalid'
  | 'manifestOk'
  | 'actionCreate'
  | 'actionUpdate'
  | 'copiedOpen'
  | 'itemRules'
  | 'rulesOk'
  | 'rulesMissing'
  | 'itemLicense'
  | 'licenseMissing'
  | 'actionLicense'
  | 'itemTag'
  | 'tagMissing'
  | 'tagWaiting'
  | 'actionTag'
  | 'versionTaken'
  | 'actionBump'
  | 'done'
  | 'optional'
  | 'publish'
  | 'publishing'
  | 'notReady'
  | 'success'
  | 'viewPackage'
  | 'failed'
  | 'formIssues',
  string
>;

type Repo = { owner: string; name: string; description: string | null; pushedAt: string; package: string | null };
type Check = {
  repo: { owner: string; name: string; url: string; branch: string; sha: string; description: string | null };
  manifest: {
    status: 'missing' | 'invalid' | 'ok';
    data?: Record<string, unknown>;
    issues?: Array<{ path: string; message: string }>;
  };
  rules: { path: string; status: 'ok' | 'missing' | 'too_large'; tokens?: number };
  license: string | null;
  tags: string[];
  package: { name: string; versions: string[] } | null;
  suggested: Record<string, unknown>;
};
type Problem = { code: string; message: string; fix: string };

const fill = (s: string, p: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in p ? String(p[k]) : m));

const nextPatch = (v: string) => {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? `${m[1]}.${m[2]}.${Number(m[3]) + 1}` : '1.0.0';
};

const pretty = (o: unknown) => `${JSON.stringify(canonicalObject(o as Record<string, unknown>), null, 2)}\n`;

function Item(props: { ok: boolean | null; title: string; text: string; children?: preact.ComponentChildren }) {
  const mark = props.ok === true ? '✔' : props.ok === false ? '✖' : '○';
  return (
    <li class={`wz-item ${props.ok === true ? 'ok' : props.ok === false ? 'todo' : 'opt'}`}>
      <span class="wz-mark" aria-hidden="true">
        {mark}
      </span>
      <div>
        <b>{props.title}</b>
        <p>{props.text}</p>
        {props.children && <div class="wz-actions">{props.children}</div>}
      </div>
    </li>
  );
}

export default function PublishWizard({ labels: L, locale }: { labels: WizardLabels; locale: string }) {
  const prefix = locale === 'en' ? '' : `/${locale}`;
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [owners, setOwners] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [sel, setSel] = useState<{ owner: string; name: string } | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [form, setForm] = useState({ n: '', v: '', s: '', d: '', l: '', k: '' });
  const [copied, setCopied] = useState('');
  const [state, setState] = useState<'idle' | 'publishing' | 'done'>('idle');

  useEffect(() => {
    fetch('/publish/repos.json')
      .then(async (r) => {
        const b = (await r.json()) as { owners: string[]; repos: Repo[] };
        if (!r.ok) throw b;
        setOwners(b.owners);
        setRepos(b.repos);
      })
      .catch((e: Problem) => {
        setProblem(e);
        setRepos([]);
      });
  }, []);

  const load = async (target: { owner: string; name: string }, keepForm = false) => {
    setLoading(true);
    setProblem(null);
    try {
      const r = await fetch(
        `/publish/check.json?owner=${encodeURIComponent(target.owner)}&repo=${encodeURIComponent(target.name)}`,
      );
      const b = await r.json();
      if (!r.ok) throw b;
      const c = b as Check;
      setCheck(c);
      if (!keepForm) {
        const s = c.suggested;
        const summary = (s['s'] as Record<string, string> | undefined)?.['en'] ?? '';
        setForm({
          n: String(s['n'] ?? ''),
          v: String(s['v'] ?? '1.0.0'),
          s: summary,
          d: String(s['d'] ?? ''),
          l: String(s['l'] ?? ''),
          k: Array.isArray(s['k']) ? (s['k'] as string[]).join(', ') : '',
        });
        setState('idle');
      }
    } catch (e) {
      setProblem(e as Problem);
    } finally {
      setLoading(false);
    }
  };

  // Al volver de GitHub (tras hacer commit o crear el release) se vuelve a comprobar el repo sin perder el formulario.
  useEffect(() => {
    if (!sel) return;
    const onFocus = () => {
      if (document.visibilityState === 'visible' && state !== 'publishing') void load(sel, true);
    };
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [sel, state]);

  const manifest = useMemo(() => {
    if (!check) return null;
    const o: Record<string, unknown> = {
      ...check.suggested,
      $: 1,
      n: form.n.trim(),
      v: form.v.trim(),
      d: form.d.trim(),
    };
    const base = (check.suggested['s'] as Record<string, string> | undefined) ?? {};
    if (form.s.trim()) o['s'] = { ...base, en: form.s.trim() };
    else delete o['s'];
    if (form.l.trim()) o['l'] = form.l.trim();
    else delete o['l'];
    const k = form.k
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    if (k.length) o['k'] = k;
    else delete o['k'];
    if (!o['x']) o['x'] = 'AGENTS.md';
    return o;
  }, [check, form]);

  if (!sel) {
    const q = filter.trim().toLowerCase();
    const list = (repos ?? []).filter(
      (r) => !q || `${r.owner}/${r.name} ${r.description ?? ''}`.toLowerCase().includes(q),
    );
    return (
      <div class="wz">
        <h2 class="h3">{L.reposTitle}</h2>
        {problem && (
          <div class="banner" style="--c:var(--danger)">
            <b>!</b>
            <span>
              {problem.message} {problem.fix}
            </span>
          </div>
        )}
        {repos === null ? (
          <p class="wz-muted">{L.loading}</p>
        ) : (
          <>
            <input
              class="wz-filter"
              type="search"
              placeholder={L.reposFilter}
              aria-label={L.reposFilter}
              value={filter}
              onInput={(e) => setFilter((e.target as HTMLInputElement).value)}
            />
            {list.length === 0 ? (
              <p class="wz-muted">{fill(L.reposEmpty, { owners: owners.join(', ') })}</p>
            ) : (
              <ul class="wz-repos">
                {list.map((r) => (
                  <li key={`${r.owner}/${r.name}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSel({ owner: r.owner, name: r.name });
                        void load({ owner: r.owner, name: r.name });
                      }}
                    >
                      <span class="wz-repo-name">
                        {r.owner}/<b>{r.name}</b>
                      </span>
                      {r.package && <span class="wz-badge">{fill(L.publishedAs, { name: r.package })}</span>}
                      {r.description && <span class="wz-muted">{r.description}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    );
  }

  const header = (
    <div class="wz-head">
      <div>
        <a href={`https://github.com/${sel.owner}/${sel.name}`} rel="noopener" target="_blank" class="wz-repo-name">
          {sel.owner}/<b>{sel.name}</b>
        </a>
      </div>
      <div class="row">
        <button
          type="button"
          class="btn sm ghost"
          onClick={() => {
            setSel(null);
            setCheck(null);
            setProblem(null);
          }}
        >
          ← {L.back}
        </button>
        <button type="button" class="btn sm" disabled={loading} onClick={() => load(sel, true)}>
          {loading ? L.loading : L.recheck}
        </button>
      </div>
    </div>
  );

  if (!check || !manifest) {
    return (
      <div class="wz">
        {header}
        {problem ? (
          <div class="banner" style="--c:var(--danger)">
            <b>!</b>
            <span>
              {problem.message} {problem.fix}
            </span>
          </div>
        ) : (
          <p class="wz-muted">{L.loading}</p>
        )}
      </div>
    );
  }

  const { repo } = check;
  const gh = `https://github.com/${repo.owner}/${repo.name}`;
  const valid = validateSource(manifest);
  const issues = valid.ok ? [] : valid.issues;
  const errFor = (key: string) => issues.find((i) => i.path === key || i.path.startsWith(`${key}.`))?.message;
  const json = pretty(manifest);
  const inRepo = check.manifest.status === 'ok' && check.manifest.data ? pretty(check.manifest.data) : null;
  const manifestOk = inRepo !== null && inRepo === json;
  const rulesOk = check.rules.status === 'ok';
  const version = form.v.trim();
  const tag = check.tags.find((t) => t === `v${version}` || t === version) ?? null;
  const taken = !!check.package?.versions.includes(version);
  const ready = valid.ok && manifestOk && rulesOk && !!tag && !taken;
  const newFile = (path: string, content: string, message: string) =>
    `${gh}/new/${encodeURIComponent(repo.branch)}?filename=${encodeURIComponent(path)}&value=${encodeURIComponent(content)}&message=${encodeURIComponent(message)}`;

  const copyThenOpen = async (text: string, url: string) => {
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(url);
    window.open(url, '_blank', 'noopener');
  };

  const publish = async () => {
    setState('publishing');
    setProblem(null);
    const r = await fetch('/publish/submit.json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: manifest['n'], version, repo: gh, ref: tag }),
    });
    const b = await r.json().catch(() => ({ code: 'E_INTERNAL', message: '', fix: '' }));
    if (r.ok) setState('done');
    else {
      setProblem(b as Problem);
      setState('idle');
    }
  };

  const field = (key: keyof typeof form, label: string, hint?: string) => (
    <div class="field">
      <label for={`wz-${key}`}>{label}</label>
      <input
        id={`wz-${key}`}
        class={key === 's' ? undefined : 'mono'}
        value={form[key]}
        onInput={(e) => setForm({ ...form, [key]: (e.target as HTMLInputElement).value })}
        aria-invalid={errFor(key) ? 'true' : 'false'}
        aria-describedby={`wz-e-${key}`}
      />
      <span class="err" id={`wz-e-${key}`}>
        {errFor(key) ?? ''}
      </span>
      {hint && !errFor(key) && <span class="wz-hintline">{hint}</span>}
    </div>
  );

  if (state === 'done') {
    const name = String(manifest['n']);
    return (
      <div class="wz">
        {header}
        <div class="banner" style="--c:var(--code-ink)">
          <b>✔</b>
          <span>
            {fill(L.success, { name, version })} <a href={`${prefix}/p/${name}`}>{L.viewPackage}</a>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div class="wz">
      {header}
      <div class="wz-grid">
        <form class="wz-form" onSubmit={(e) => e.preventDefault()} novalidate>
          <h3 class="h3">{L.formTitle}</h3>
          <div class="two">
            {field('n', L.fName, fill(L.hintName, { scope: `@${repo.owner.toLowerCase()}/` }))}
            {field('v', L.fVersion)}
          </div>
          {field('s', L.fSummary)}
          <div class="two">
            {field('d', L.fDest, L.hintDest)}
            {field('l', L.fLicense)}
          </div>
          {field('k', L.fKeywords)}
          <details class="wz-json">
            <summary>genpm.json</summary>
            <pre>{json}</pre>
          </details>
        </form>
        <div class="wz-side">
          <h3 class="h3">{L.listTitle}</h3>
          <ol class="wz-list">
            <Item
              ok={manifestOk}
              title={L.itemManifest}
              text={
                !valid.ok
                  ? L.formIssues
                  : manifestOk
                    ? L.manifestOk
                    : check.manifest.status === 'missing'
                      ? L.manifestMissing
                      : check.manifest.status === 'invalid'
                        ? fill(L.manifestInvalid, { detail: check.manifest.issues?.[0]?.message ?? '' })
                        : L.manifestDiffers
              }
            >
              {!manifestOk &&
                valid.ok &&
                (check.manifest.status === 'missing' ? (
                  <a
                    class="btn sm primary"
                    href={newFile('genpm.json', json, 'Add genpm.json')}
                    target="_blank"
                    rel="noopener"
                  >
                    {L.actionCreate}
                  </a>
                ) : (
                  <button
                    type="button"
                    class="btn sm primary"
                    onClick={() => copyThenOpen(json, `${gh}/edit/${encodeURIComponent(repo.branch)}/genpm.json`)}
                  >
                    {copied === `${gh}/edit/${encodeURIComponent(repo.branch)}/genpm.json`
                      ? L.copiedOpen
                      : L.actionUpdate}
                  </button>
                ))}
            </Item>
            <Item
              ok={rulesOk}
              title={L.itemRules}
              text={rulesOk ? fill(L.rulesOk, { tokens: check.rules.tokens ?? 0 }) : L.rulesMissing}
            >
              {!rulesOk && (
                <a
                  class="btn sm primary"
                  href={newFile(check.rules.path, agentsTemplate(String(manifest['n'])), `Add ${check.rules.path}`)}
                  target="_blank"
                  rel="noopener"
                >
                  {L.actionCreate}
                </a>
              )}
            </Item>
            <Item
              ok={check.license ? true : null}
              title={`${L.itemLicense}${check.license ? ` · ${check.license}` : ` · ${L.optional}`}`}
              text={check.license ? L.done : L.licenseMissing}
            >
              {!check.license && (
                <a
                  class="btn sm"
                  href={`${gh}/community/license/new?branch=${encodeURIComponent(repo.branch)}`}
                  target="_blank"
                  rel="noopener"
                >
                  {L.actionLicense}
                </a>
              )}
            </Item>
            <Item
              ok={taken ? false : !!tag}
              title={fill(L.itemTag, { tag: tag ?? `v${version}` })}
              text={taken ? fill(L.versionTaken, { version }) : tag ? L.done : manifestOk ? L.tagMissing : L.tagWaiting}
            >
              {taken ? (
                <button
                  type="button"
                  class="btn sm primary"
                  onClick={() => setForm({ ...form, v: nextPatch(version) })}
                >
                  {fill(L.actionBump, { version: nextPatch(version) })}
                </button>
              ) : (
                !tag &&
                manifestOk && (
                  <a
                    class="btn sm primary"
                    href={`${gh}/releases/new?tag=${encodeURIComponent(`v${version}`)}&target=${encodeURIComponent(repo.branch)}&title=${encodeURIComponent(`v${version}`)}`}
                    target="_blank"
                    rel="noopener"
                  >
                    {L.actionTag}
                  </a>
                )
              )}
            </Item>
          </ol>
          <p class="wz-muted wz-hint">{L.commitHint}</p>
          {problem && (
            <div class="banner" style="--c:var(--danger)">
              <b>!</b>
              <span>
                {fill(L.failed, { message: problem.message })} {problem.fix}
              </span>
            </div>
          )}
          <button
            type="button"
            class="btn primary wz-publish"
            disabled={!ready || state === 'publishing'}
            onClick={publish}
          >
            {state === 'publishing' ? L.publishing : fill(L.publish, { name: String(manifest['n']), version })}
          </button>
          {!ready && <p class="wz-muted">{L.notReady}</p>}
        </div>
      </div>
    </div>
  );
}
