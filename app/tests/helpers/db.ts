import * as fs from 'fs';
import * as path from 'path';
import { BACKEND_DIR } from './env';
import { loadFixtures } from './fixtures';

// Read-only access to the SQLite file (Q-P1). Used only where the API cannot show the fact
// (TC-094 hashed passwords, the full list of seeded ids). Table and column names follow docs/spec.md section 2.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = () => require('node:sqlite');

function walk(dir: string, out: string[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.git')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(db|sqlite|sqlite3)$/i.test(e.name)) out.push(p);
  }
}

export function findDbPath(): string | null {
  if (process.env.QP_DB_PATH) return process.env.QP_DB_PATH;
  const found: string[] = [];
  try {
    walk(BACKEND_DIR, found);
  } catch {
    return null;
  }
  for (const p of found) {
    try {
      const db = new (sqlite().DatabaseSync)(p, { readOnly: true });
      const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      db.close();
      if (row.length) return p;
    } catch {
      /* not a sqlite file */
    }
  }
  return null;
}

export function dbAll(sql: string, params: any[] = []): any[] | null {
  const p = findDbPath();
  if (!p) return null;
  const db = new (sqlite().DatabaseSync)(p, { readOnly: true });
  try {
    return db.prepare(sql).all(...params);
  } finally {
    db.close();
  }
}

/** Ids of every quote in an organisation (fixtures first, then the database). null when neither knows. */
export function seededQuoteIds(orgKey: string): string[] | null {
  const o = loadFixtures().orgs[orgKey];
  if (o?.quoteIds) return o.quoteIds.map(String);
  try {
    const rows = dbAll('SELECT id FROM quotes WHERE organisation_id = ?', [o?.id]);
    return rows ? rows.map((r) => String(r.id)) : null;
  } catch {
    return null;
  }
}

export function allQuoteRows(): { id: string; organisation_id: string }[] | null {
  try {
    const rows = dbAll('SELECT id, organisation_id FROM quotes');
    return rows ? rows.map((r) => ({ id: String(r.id), organisation_id: String(r.organisation_id) })) : null;
  } catch {
    return null;
  }
}
