import { eq, sql } from 'drizzle-orm';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { testDb } from './__fixtures__/pglite.js';
import { createDb, getDb, newId, primaryId, timestamps, ulid, ulidTime, withTransaction } from './index.js';

const notes = pgTable('notes', { id: primaryId('note'), body: text('body').notNull(), ...timestamps });

describe('ulid', () => {
  it('is 26 Crockford chars, time-ordered and unique', () => {
    const a = ulid(1_700_000_000_000);
    const b = ulid(1_700_000_000_001);
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(a < b).toBe(true);
    expect(ulidTime(a)).toBe(1_700_000_000_000);
    expect(new Set(Array.from({ length: 1000 }, () => ulid())).size).toBe(1000);
  });
  it('adds a readable prefix', () => {
    const id = newId('usr');
    expect(id).toMatch(/^usr_[0-9A-Z]{26}$/);
    expect(Math.abs(ulidTime(id) - Date.now())).toBeLessThan(1000);
  });
});

describe('database helpers', () => {
  it('creates ids and timestamps, and bumps updatedAt on update', async () => {
    const db = await testDb({ notes });
    const [row] = await db.insert(notes).values({ body: 'hi' }).returning();
    expect(row!.id).toMatch(/^note_/);
    expect(row!.createdAt).toBeInstanceOf(Date);
    await new Promise((r) => setTimeout(r, 5));
    const [after] = await db.update(notes).set({ body: 'bye' }).where(eq(notes.id, row!.id)).returning();
    expect(after!.updatedAt.getTime()).toBeGreaterThan(row!.updatedAt.getTime());
  });

  it('withTransaction commits, or rolls everything back on error', async () => {
    const db = await testDb({ notes });
    await withTransaction(async (tx) => {
      await tx.insert(notes).values({ body: 'kept' });
    });
    await expect(
      withTransaction(async (tx) => {
        await tx.insert(notes).values({ body: 'lost' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const rows = await db.select().from(notes);
    expect(rows.map((r) => r.body)).toEqual(['kept']);
    expect(getDb()).toBe(db);
    const res = (await db.execute(sql`select 1 as n`)) as unknown as { rows: Array<{ n: number }> };
    expect(res.rows[0]?.n).toBe(1);
  });

  it('createDb needs DATABASE_URL', () => {
    expect(() => createDb(undefined)).toThrow(/DATABASE_URL/);
    expect(createDb('postgres://u:p@localhost:5432/x')).toBeTruthy();
  });
});
