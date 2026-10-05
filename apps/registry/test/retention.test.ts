// Plazos de conservación de la política de privacidad (§2): el cron diario borra o anonimiza lo caducado.
import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { purgeExpired } from '../src/cron/index.js';
import { seed } from './helpers.js';

const DAY = 86_400_000;
const now = Date.now();

beforeAll(async () => {
  await seed();
  const acc = await env.DB.prepare('SELECT id FROM accounts LIMIT 1').first<{ id: string }>();
  const pkg = await env.DB.prepare('SELECT id FROM packages LIMIT 1').first<{ id: string }>();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, ip_hash, created_at) VALUES ('aud_old', 'reg_public', ?1, 'auth.login', 'token', 't', 'h1', ?2), ('aud_new', 'reg_public', ?1, 'auth.login', 'token', 't', 'h2', ?3)",
    ).bind(acc!.id, now - 31 * DAY, now - DAY),
    env.DB.prepare(
      `INSERT INTO leads (id, kind, email, details, status, created_at) VALUES
       ('lead_ip', 'sponsor', 'a@x.dev', '{"ip":"h","team":"5"}', 'new', ?1),
       ('lead_old', 'sponsor', 'b@x.dev', '{}', 'contacted', ?2),
       ('lead_won', 'enterprise', 'c@x.dev', '{}', 'won', ?2)`,
    ).bind(now - 40 * DAY, now - 400 * DAY),
    env.DB.prepare(
      `INSERT INTO reports (id, package_id, reason, status, created_at) VALUES
       ('rep_old', ?1, 'spam', 'dismissed', ?2), ('rep_open', ?1, 'spam', 'open', ?2), ('rep_new', ?1, 'spam', 'actioned', ?3)`,
    ).bind(pkg!.id, now - 800 * DAY, now - 10 * DAY),
  ]);
});

describe('retention (privacy policy §2)', () => {
  it('anonymizes and deletes what has expired, and nothing else', async () => {
    await purgeExpired(env, now);
    await purgeExpired(env, now); // idempotente
    const ips = await env.DB.prepare(
      "SELECT id, ip_hash FROM audit_log WHERE id IN ('aud_old','aud_new') ORDER BY id",
    ).all();
    expect(ips.results).toEqual([
      { id: 'aud_new', ip_hash: 'h2' },
      { id: 'aud_old', ip_hash: null },
    ]);
    const leads = await env.DB.prepare('SELECT id, details FROM leads ORDER BY id').all<{
      id: string;
      details: string;
    }>();
    expect(leads.results.map((l) => l.id)).toEqual(['lead_ip', 'lead_won']);
    expect(JSON.parse(leads.results[0]!.details)).toEqual({ team: '5' });
    const reports = await env.DB.prepare("SELECT id FROM reports WHERE id LIKE 'rep_%' ORDER BY id").all<{
      id: string;
    }>();
    expect(reports.results.map((r) => r.id)).toEqual(['rep_new', 'rep_open']);
  });
});
