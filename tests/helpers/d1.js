// A D1-compatible binding over Node's built-in SQLite (node:sqlite), for testing the Worker without wrangler.
// Implements what the Worker uses: prepare().bind().run/first/all, and batch().
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function createD1(migrationsDir) {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) db.exec(readFileSync(join(migrationsDir, f), 'utf8'));
  // D1 numbers parameters ?1, ?2 ...; node:sqlite accepts the same positional form
  const stmt = (sql, params = []) => ({
    bind: (...p) => stmt(sql, p),
    run: async () => {
      const r = db.prepare(sql).run(...params);
      return { success: true, meta: { changes: r.changes } };
    },
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params), success: true }),
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (list) => {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of list) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    raw: db,
  };
}
