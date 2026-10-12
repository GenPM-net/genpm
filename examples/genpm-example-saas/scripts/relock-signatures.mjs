#!/usr/bin/env node
// Refreshes the registry signature (`sg`) of every entry in genpm.lock from the registry, keeping everything else.
// Only needed if the lockfile was produced against another registry (e.g. a local mirror). Run `genpm audit` after:
// it re-verifies each signature against the registry's pinned public keys, so a wrong value cannot slip through.
import { readFileSync, writeFileSync } from 'node:fs';

const registry = process.env.GENPM_REGISTRY ?? 'https://api.genpm.net';
const lock = JSON.parse(readFileSync('genpm.lock', 'utf8'));
for (const [n, e] of Object.entries(lock.p)) {
  const res = await fetch(`${registry}/v1/packages/${n}/versions/${e.v}?fmt=c`);
  if (!res.ok) {
    // Quién responde (Worker o la capa de seguridad de Cloudflare) para diagnosticar bloqueos desde CI.
    const who = ['server', 'cf-mitigated', 'cf-ray'].map((h) => `${h}=${res.headers.get(h)}`).join(' ');
    const body = (await res.text()).slice(0, 200).replace(/\s+/g, ' ');
    throw new Error(`${n}@${e.v}: HTTP ${res.status} (${who}) ${body}`);
  }
  const remote = await res.json();
  if (remote.c !== e.c) throw new Error(`${n}@${e.v}: commit ${remote.c} on the registry, ${e.c} in genpm.lock`);
  e.sg = remote.sg;
  console.log(`${n}@${e.v} ${e.c.slice(0, 7)} ${remote.sg.split(':')[0]}`);
}
// Same layout genpm writes: one package per line.
const body = Object.entries(lock.p).map(([n, e]) => `${JSON.stringify(n)}:${JSON.stringify(e)}`).join(',\n');
writeFileSync('genpm.lock', `{"$":${lock.$},\n"p":{\n${body}\n}}\n`);
