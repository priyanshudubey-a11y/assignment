'use strict';

// Ordered, idempotent migrations. Re-running on an up-to-date database is a no-op (BE-02).
const MIGRATIONS = [
  {
    id: 1,
    name: 'initial schema',
    sql: `
      CREATE TABLE organisations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        organisation_id TEXT NOT NULL REFERENCES organisations(id),
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer'))
      );
      CREATE UNIQUE INDEX ux_users_email_ci ON users (lower(email));
      CREATE TABLE quotes (
        id TEXT PRIMARY KEY,
        organisation_id TEXT NOT NULL REFERENCES organisations(id),
        reference TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        current_version INTEGER NOT NULL,
        issued_at TEXT NOT NULL,   -- date version 1 was issued (Q-P3); revisions never change it
        created_at TEXT NOT NULL
      );
      CREATE TABLE quote_versions (
        id TEXT PRIMARY KEY,
        quote_id TEXT NOT NULL REFERENCES quotes(id),
        version_no INTEGER NOT NULL CHECK (version_no >= 1),
        currency TEXT NOT NULL,
        total INTEGER NOT NULL CHECK (total >= 0),   -- integer minor units
        valid_until TEXT,
        issued_at TEXT NOT NULL,
        superseded_at TEXT,
        is_current INTEGER NOT NULL CHECK (is_current IN (0, 1)),
        UNIQUE (quote_id, version_no)
      );
      CREATE UNIQUE INDEX ux_quote_versions_one_current ON quote_versions (quote_id) WHERE is_current = 1;
      CREATE TABLE quote_line_items (
        id TEXT PRIMARY KEY,
        quote_version_id TEXT NOT NULL REFERENCES quote_versions(id),
        position INTEGER NOT NULL,
        description TEXT NOT NULL,
        qty INTEGER NOT NULL CHECK (qty >= 1),
        unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
        line_total INTEGER NOT NULL CHECK (line_total >= 0)
      );
      CREATE INDEX ix_line_items_version ON quote_line_items (quote_version_id, position);
      CREATE TABLE sessions (
        id_hash TEXT PRIMARY KEY,   -- sha256 of the cookie value; the raw id is never stored
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL
      );
      CREATE INDEX ix_sessions_user ON sessions (user_id);
    `,
  },
  {
    id: 2,
    name: 'list indexes (organisation, sort field, id)',
    sql: `
      CREATE INDEX ix_quotes_org_issued_desc ON quotes (organisation_id, issued_at DESC, id DESC);
      CREATE INDEX ix_quotes_org_issued_asc ON quotes (organisation_id, issued_at ASC, id DESC);
      CREATE INDEX ix_quotes_org_reference ON quotes (organisation_id, reference);
    `,
  },
];

function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
  for (const m of MIGRATIONS) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const done = db.prepare('SELECT 1 AS x FROM schema_migrations WHERE id = ?').get(m.id);
      if (!done) {
        db.exec(m.sql);
        db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)').run(m.id, m.name, new Date().toISOString());
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

module.exports = { migrate, MIGRATIONS };
