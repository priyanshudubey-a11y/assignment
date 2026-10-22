'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const SwaggerParser = require('@apidevtools/swagger-parser');
const { openDatabase } = require('../src/db');
const { migrate, MIGRATIONS } = require('../src/migrations');
const { createApp } = require('../src/app');
const { QuoteRepository } = require('../src/quote-repository');
const { hashPassword, verifyPassword } = require('../src/passwords');
const { makeEnv, loginAgent, assertContract, OPENAPI_PATH } = require('./helpers');

test('BE-13: openapi.yaml is a valid OpenAPI document', async () => {
  await SwaggerParser.validate(OPENAPI_PATH);
});

test('BE-02: migrations run on an empty database and can be re-run', () => {
  const db = openDatabase(':memory:');
  migrate(db);
  migrate(db);
  const n = db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n;
  assert.equal(n, MIGRATIONS.length);
  for (const t of ['organisations', 'users', 'quotes', 'quote_versions', 'quote_line_items']) {
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t), t);
  }
});

test('BE-02: constraints (email unique case-insensitively, reference unique, version unique, one current)', () => {
  const db = openDatabase(':memory:');
  db.exec("INSERT INTO organisations VALUES ('o','O','x')");
  db.exec("INSERT INTO users VALUES ('u1','o','A@x.com','h','customer')");
  assert.throws(() => db.exec("INSERT INTO users VALUES ('u2','o','a@X.COM','h','customer')"), /UNIQUE/);
  db.exec("INSERT INTO quotes VALUES ('q1','o','R1','t','issued',1,'2026-01-01T00:00:00.000Z','x')");
  assert.throws(() => db.exec("INSERT INTO quotes VALUES ('q2','o','R1','t','issued',1,'2026-01-01T00:00:00.000Z','x')"), /UNIQUE/);
  db.exec("INSERT INTO quote_versions VALUES ('v1','q1',1,'USD',0,NULL,'x',NULL,1)");
  assert.throws(() => db.exec("INSERT INTO quote_versions VALUES ('v1b','q1',1,'USD',0,NULL,'x','y',0)"), /UNIQUE/);
  assert.throws(() => db.exec("INSERT INTO quote_versions VALUES ('v2','q1',2,'USD',0,NULL,'x',NULL,1)"), /UNIQUE/);
});

test('BE-02/BE-08: repository methods refuse to run without an organisation id', async () => {
  const { db, fixtures } = await makeEnv();
  const repo = new QuoteRepository(db);
  const q = fixtures.quotes['Q-MULTI'].id;
  const args = { page: 1, pageSize: 20, sort: 'issued_at:desc' };
  for (const bad of [undefined, null, '', 5]) {
    assert.throws(() => repo.listQuotes(bad, args), /organisationId is required/);
    assert.throws(() => repo.getQuote(bad, q), /organisationId is required/);
    assert.throws(() => repo.getVersion(bad, q, 1), /organisationId is required/);
    assert.throws(() => repo.getQuoteSummary(bad, q), /organisationId is required/);
  }
  assert.equal(repo.getQuote(fixtures.orgs['ORG-B'].id, q), null);
});

test('BE-05: passwords are salted scrypt hashes', async () => {
  const a = await hashPassword('secret');
  const b = await hashPassword('secret');
  assert.notEqual(a, b);
  assert.match(a, /^scrypt\$16384\$8\$1\$/);
  assert.ok(!a.includes('secret'));
  assert.equal(await verifyPassword('secret', a), true);
  assert.equal(await verifyPassword('Secret', a), false);
});

test('BE-01: unexpected errors return INTERNAL_ERROR with no detail; broken data source is 500 not an empty list', async () => {
  const { db, app, logs } = await makeEnv();
  const agent = await loginAgent(app, 'user51@org51.example.test');
  const throwing = new QuoteRepository(db);
  throwing.listQuotes = () => { throw new Error('SQLITE_ERROR: no such table secret_table at /srv/app/stack.js:1'); };
  const app2 = createApp({ db, repository: throwing, config: { logLevel: 'silent' }, logger: (l) => logs.push(l) });
  const res = await request(app2).get('/api/quotes').set('Cookie', agent.cookie);
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.' });
  assert.ok(!res.text.includes('secret_table'));
  assert.ok(!res.text.includes('stack.js'));
  await assertContract('get', '/api/quotes', res);

  db.exec('ALTER TABLE quote_versions RENAME TO quote_versions_gone');
  const res2 = await agent.get('/api/quotes');
  assert.equal(res2.status, 500);
  assert.equal(res2.body.code, 'INTERNAL_ERROR');
  assert.ok(!('items' in res2.body));
});

test('BE-01: malformed JSON body is a 400 VALIDATION_ERROR, not a stack trace', async () => {
  const { app } = await makeEnv();
  const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'VALIDATION_ERROR');
  assert.ok(!res.text.includes('SyntaxError'));
});

test('BE-01: request logs never contain passwords or session ids', async () => {
  const { app, logs } = await makeEnv();
  const agent = await loginAgent(app, 'user51@org51.example.test', 'Test-Passw0rd!');
  await agent.get('/api/quotes?page=1');
  await request(app).post('/api/auth/login').send({ email: 'user51@org51.example.test', password: 'wrong-pass-123' });
  const all = logs.join('\n');
  assert.ok(logs.length >= 3);
  assert.ok(!all.includes('Test-Passw0rd!'));
  assert.ok(!all.includes('wrong-pass-123'));
  assert.ok(!all.includes(agent.cookie.split('=')[1]));
  assert.ok(!all.includes('qp_session'));
});

test('BE-12: health is public, returns only status, and 503 when the database is unreachable', async () => {
  const { db, app } = await makeEnv();
  const ok = await request(app).get('/api/health');
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, { status: 'ok' });
  await assertContract('get', '/api/health', ok);
  db.close();
  const down = await request(app).get('/api/health');
  assert.equal(down.status, 503);
  assert.deepEqual(down.body, { status: 'unavailable' });
  await assertContract('get', '/api/health', down);
});

test('BE-16: list queries use the organisation/sort indexes (no temp b-tree sort)', async () => {
  const { db, fixtures } = await makeEnv();
  const org = fixtures.orgs['ORG-51'].id;
  const sorts = { 'issued_at:desc': 'q.issued_at DESC, q.id DESC', 'issued_at:asc': 'q.issued_at ASC, q.id DESC', 'reference:asc': 'q.reference ASC' };
  for (const [name, order] of Object.entries(sorts)) {
    const plan = db
      .prepare(`EXPLAIN QUERY PLAN SELECT q.id FROM quotes q JOIN quote_versions v ON v.quote_id = q.id AND v.version_no = q.current_version WHERE q.organisation_id = ? ORDER BY ${order} LIMIT 20 OFFSET 0`)
      .all(org)
      .map((r) => r.detail)
      .join(' | ');
    assert.ok(!/TEMP B-TREE/.test(plan), `${name}: ${plan}`);
    assert.match(plan, /ix_quotes_org/, `${name}: ${plan}`);
  }
});
