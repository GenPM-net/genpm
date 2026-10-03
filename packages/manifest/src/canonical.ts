// Forma canónica y hash del manifiesto (manifest-spec §8). Pura: usa WebCrypto (Node ≥ 20, Workers, navegador).

import { KEY_ORDER, MCP_KEY_ORDER } from './constants.js';
import type { McpServerEntry } from './schema.js';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function sortedObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out;
}

function canonicalMcp(m: McpServerEntry): McpServerEntry {
  if (typeof m === 'string') return m;
  const out: Record<string, unknown> = {};
  for (const k of MCP_KEY_ORDER) if (m[k] !== undefined) out[k] = m[k];
  return out as McpServerEntry;
}

/**
 * Reordena las claves: `$ n v s r t c d i x l k g p e m`, luego `_*` alfabético.
 * Dentro de `g`, `p` y `s` (mapa): alfabético. Dentro de cada `m[]`: `n c a u e`.
 * `sg` (firma) nunca forma parte de la forma canónica.
 */
export function canonicalObject(manifest: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of KEY_ORDER) {
    const v = manifest[k];
    if (v === undefined) continue;
    if ((k === 'g' || k === 'p') && typeof v === 'object' && v !== null)
      out[k] = sortedObject(v as Record<string, unknown>);
    else if (k === 's' && typeof v === 'object' && v !== null) out[k] = sortedObject(v as Record<string, unknown>);
    else if (k === 'm' && Array.isArray(v)) out[k] = v.map((e) => canonicalMcp(e as McpServerEntry));
    else out[k] = v;
  }
  for (const k of Object.keys(manifest)
    .filter((k) => k.startsWith('_'))
    .sort()) {
    out[k] = manifest[k];
  }
  return out;
}

/** JSON minificado canónico (UTF-8, sin espacios). */
export function canonicalize(manifest: Record<string, unknown>): string {
  return JSON.stringify(canonicalObject(manifest) as Json);
}

export function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u8) s += b.toString(16).padStart(2, '0');
  return s;
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return toHex(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}

/** `manifest_hash` = sha256 hex de la forma canónica. */
export async function manifestHash(manifest: Record<string, unknown>): Promise<string> {
  return sha256Hex(canonicalize(manifest));
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
