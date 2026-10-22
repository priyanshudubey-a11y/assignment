'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { makeEnv } = require('./helpers');
const { seed } = require('../src/seed');
const { reviseQuote } = require('../src/revise');
const { generateLoad } = require('../scripts/generate-load');
const { openDatabase } = require('../src/db');

const ROOT = path.join(__dirname, '..');
const NODE = ['--disable-warning=ExperimentalWarning'];
let env;
before(async () => { env = await makeEnv(); });

function assertIntegrity(db) {
  const quotes = db.prepare('SELECT id, current_version FROM quotes').all();
  for (const q of quotes) {
    const vs = db.prepare('SELECT version_no, is_current, superseded_at FROM quote_versions WHERE quote_id = ? ORDER BY version_no').all(q.id);
    assert.deepEqual(vs.map((v) => v.version_no), vs.map((_, i) => i + 1), q.id);
    const cur = vs.filter((v) => v.is_current === 1);
    assert.equal(cur.length, 1, q.id);
    assert.equal(cur[0].version_no, q.current_version);
    assert.equal(cur[0].superseded_at, null);
    assert.ok(vs.filter((v) => v.is_current === 0).every((v) => v.superseded_at));
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM quote_line_items WHERE line_total != qty * unit_price').get().n, 0);
  const badTotals = db.prepare(`SELECT COUNT(*) AS n FROM quote_versions v
    WHERE v.total != COALESCE((SELECT SUM(line_total) FROM quote_line_items WHERE quote_version_id = v.id), 0)`).get().n;
  assert.equal(badTotals, 0);
}

function seedFile(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const e = { ...process.env, DB_PATH: path.join(dir, 'a.db'), SEED_FIXTURES_PATH: path.join(dir, 'f.json') };
  const r = spawnSync('node', [...NODE, 'scripts/seed.js'], { cwd: ROOT, env: e, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return e;
}

test('BE-03: seed shape - orgs with exactly 0, 1, 50, 51 quotes plus ORG-B incl. Q-B1', () => {
  const f = env.fixtures;
  const counts = Object.fromEntries(Object.entries(f.quoteIdsByOrg).map(([k, v]) => [k, v.length]));
  assert.deepEqual(counts, { 'ORG-0': 0, 'ORG-1': 1, 'ORG-50': 50, 'ORG-51': 51, 'ORG-B': 8 });
  const orgOf = env.db.prepare('SELECT organisation_id AS o FROM quotes WHERE id = ?');
  assert.equal(orgOf.get(f.quotes['Q-B1'].id).o, f.orgs['ORG-B'].id);
  for (const k of ['Q-MULTI', 'Q-REV', 'Q-NOLINES']) assert.equal(orgOf.get(f.quotes[k].id).o, f.orgs['ORG-51'].id);
  const count = (id) => env.db.prepare('SELECT COUNT(*) AS n FROM quote_versions WHERE quote_id = ?').get(id).n;
  assert.equal(count(f.quotes['Q-MULTI'].id), 3);
  assert.equal(count(f.quotes['Q-REV'].id), 1);
  assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM quote_line_items li JOIN quote_versions v ON v.id = li.quote_version_id WHERE v.quote_id = ?').get(f.quotes['Q-NOLINES'].id).n, 0);
});

test('BE-03: at least 5 quotes share the same sort timestamp', () => {
  const r = env.db.prepare('SELECT COUNT(*) AS n FROM quotes GROUP BY organisation_id, issued_at ORDER BY n DESC LIMIT 1').get();
  assert.ok(r.n >= 5);
  assert.equal(env.fixtures.quotes['Q-TIES'].ids.length, 5);
});

test('BE-03: every quote has one current version, consecutive numbers, correct line totals', () => assertIntegrity(env.db));

test('BE-03: seeding twice resets to the same state without duplicates', async () => {
  const total = env.db.prepare('SELECT COUNT(*) AS n FROM quotes').get().n;
  const second = await seed(env.db, 'Test-Passw0rd!');
  assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM quotes').get().n, total);
  assert.equal(env.db.prepare('SELECT COUNT(DISTINCT reference) AS n FROM quotes').get().n, total);
  assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 5);
  assert.deepEqual(second.quotes, env.fixtures.quotes);
  assertIntegrity(env.db);
});

test('BE-03: fixtures shape and hashed passwords', () => {
  const f = env.fixtures;
  assert.deepEqual(Object.keys(f.orgs).sort(), ['ORG-0', 'ORG-1', 'ORG-50', 'ORG-51', 'ORG-B']);
  for (const u of Object.values(f.users)) assert.ok(u.email && u.password && f.orgs[u.orgKey]);
  for (const q of Object.values(f.quotes)) assert.ok(q.id && q.reference);
  const hashes = env.db.prepare('SELECT password_hash h FROM users').all();
  assert.ok(hashes.every((h) => h.h.startsWith('scrypt$') && !h.h.includes('Test-Passw0rd!')));
});

test('BE-03: `seed` CLI writes fixtures.json and works twice on a file database', () => {
  const e = seedFile('qp-seed-');
  assert.equal(spawnSync('node', [...NODE, 'scripts/seed.js'], { cwd: ROOT, env: e }).status, 0);
  const fx = JSON.parse(fs.readFileSync(e.SEED_FIXTURES_PATH, 'utf8'));
  assert.ok(fx.quotes['Q-MULTI'].id && fx.users['U-51'].password && fx.orgs['ORG-51'].id);
  const db = new DatabaseSync(e.DB_PATH);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM quotes').get().n, 110);
  db.close();
});

test('BE-04: reviseQuote creates n+1 with line items and supersedes the previous version', () => {
  const id = env.fixtures.quotes['Q-REV'].id;
  const r = reviseQuote(env.db, id);
  assert.equal(r.versionNo, 2);
  assert.equal(env.db.prepare('SELECT current_version v FROM quotes WHERE id = ?').get(id).v, 2);
  const v1 = env.db.prepare('SELECT is_current, superseded_at FROM quote_versions WHERE quote_id = ? AND version_no = 1').get(id);
  assert.equal(v1.is_current, 0);
  assert.ok(v1.superseded_at);
  const items = env.db.prepare('SELECT COUNT(*) AS n FROM quote_line_items li JOIN quote_versions v ON v.id = li.quote_version_id WHERE v.quote_id = ? AND v.version_no = 2').get(id).n;
  assert.ok(items > 0);
  assertIntegrity(env.db);
});

test('BE-04: unknown quote id exits non-zero with a clear message and changes nothing', () => {
  const e = seedFile('qp-rev-');
  const count = () => { const d = new DatabaseSync(e.DB_PATH); const n = d.prepare('SELECT COUNT(*) AS n FROM quote_versions').get().n; d.close(); return n; };
  const before = count();
  const r = spawnSync('node', [...NODE, 'scripts/seed-revise.js', 'no-such-quote'], { cwd: ROOT, env: e, encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Quote not found: no-such-quote/);
  assert.equal(count(), before);
  assert.notEqual(spawnSync('node', [...NODE, 'scripts/seed-revise.js'], { cwd: ROOT, env: e }).status, 0);
});

test('BE-04: parallel seed:revise runs leave consecutive versions and exactly one current', async () => {
  const e = seedFile('qp-par-');
  const id = JSON.parse(fs.readFileSync(e.SEED_FIXTURES_PATH, 'utf8')).quotes['Q-MULTI'].id;
  const runs = Array.from({ length: 4 }, () => new Promise((resolve) => {
    const p = spawn('node', [...NODE, 'scripts/seed-revise.js', id], { cwd: ROOT, env: e });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => resolve({ code, err }));
  }));
  for (const r of await Promise.all(runs)) assert.equal(r.code, 0, r.err);
  const db = new DatabaseSync(e.DB_PATH);
  const vs = db.prepare('SELECT version_no, is_current FROM quote_versions WHERE quote_id = ? ORDER BY version_no').all(id);
  assert.deepEqual(vs.map((v) => v.version_no), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(vs.filter((v) => v.is_current === 1).length, 1);
  assert.equal(db.prepare('SELECT current_version v FROM quotes WHERE id = ?').get(id).v, 7);
  assertIntegrity(db);
  db.close();
});

test('BE-16: load generator builds N quotes in one org in a separate database', async () => {
  const db = openDatabase(':memory:');
  const r = await generateLoad(db, 250);
  assert.equal(r.count, 250);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM quotes WHERE organisation_id = 'org_perf'").get().n, 250);
  assert.equal(db.prepare('SELECT COUNT(DISTINCT organisation_id) AS n FROM quotes').get().n, 1);
});
