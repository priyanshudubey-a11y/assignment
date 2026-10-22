'use strict';
// Generates a load-test database (BE-16): one organisation with N quotes (default 10,000).
// Writes to its own DB file (default data/perf.db), so the standard seed/dev database is never touched.
const path = require('node:path');
const { openDatabase, inTransaction } = require('../src/db');
const { hashPassword } = require('../src/passwords');

const PERF_EMAIL = 'perf@perf.example.test';
const PERF_PASSWORD = 'Perf-Passw0rd!';

async function generateLoad(db, count = 10000) {
  const hash = await hashPassword(PERF_PASSWORD);
  inTransaction(db, () => {
    for (const t of ['sessions', 'quote_line_items', 'quote_versions', 'quotes', 'users', 'organisations']) db.exec(`DELETE FROM ${t}`);
    db.prepare('INSERT INTO organisations (id, name, created_at) VALUES (?, ?, ?)').run('org_perf', 'Perf Org', new Date().toISOString());
    db.prepare('INSERT INTO users (id, organisation_id, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run('usr_perf', 'org_perf', PERF_EMAIL, hash, 'customer');
    const q = db.prepare('INSERT INTO quotes (id, organisation_id, reference, title, status, current_version, issued_at, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)');
    const v = db.prepare('INSERT INTO quote_versions (id, quote_id, version_no, currency, total, valid_until, issued_at, superseded_at, is_current) VALUES (?, ?, 1, ?, ?, ?, ?, NULL, 1)');
    const li = db.prepare('INSERT INTO quote_line_items (id, quote_version_id, position, description, qty, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const base = Date.parse('2024-01-01T00:00:00.000Z');
    for (let n = 0; n < count; n++) {
      const issued = new Date(base + Math.floor(n / 3) * 3600 * 1000).toISOString(); // groups of 3 share a timestamp
      q.run(`qt_perf_${n}`, 'org_perf', `PERF-${String(n).padStart(6, '0')}`, `Load test quote ${n}`, 'issued', issued, issued);
      const total = 2 * 10000 + 3 * 5000;
      v.run(`ver_perf_${n}`, `qt_perf_${n}`, 'USD', total, '2030-01-01', issued);
      li.run(`li_perf_${n}_0`, `ver_perf_${n}`, 0, 'Item A', 2, 10000, 20000);
      li.run(`li_perf_${n}_1`, `ver_perf_${n}`, 1, 'Item B', 3, 5000, 15000);
    }
  });
  return { email: PERF_EMAIL, password: PERF_PASSWORD, count };
}

module.exports = { generateLoad, PERF_EMAIL, PERF_PASSWORD };

if (require.main === module) {
  const dbPath = process.env.PERF_DB_PATH || path.join(__dirname, '..', 'data', 'perf.db');
  const count = Number(process.argv[2] || 10000);
  const db = openDatabase(dbPath);
  generateLoad(db, count).then((r) => {
    console.log(`Generated ${r.count} quotes in one organisation at ${dbPath} (login ${r.email} / ${r.password})`);
    db.close();
  });
}
