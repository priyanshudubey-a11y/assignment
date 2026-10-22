'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { makeEnv, loginAgent, assertContract } = require('./helpers');
const { reviseQuote } = require('../src/revise');

let env;
const agents = {};
before(async () => {
  env = await makeEnv();
  for (const [k, u] of Object.entries(env.fixtures.users)) agents[k] = await loginAgent(env.app, u.email);
});

async function walk(agent, pageSize, sort = 'issued_at:desc') {
  const ids = [];
  const first = await agent.get(`/api/quotes?page=1&pageSize=${pageSize}&sort=${encodeURIComponent(sort)}`);
  assert.equal(first.status, 200);
  for (let p = 1; p <= first.body.totalPages; p++) {
    const r = await agent.get(`/api/quotes?page=${p}&pageSize=${pageSize}&sort=${encodeURIComponent(sort)}`);
    assert.equal(r.status, 200);
    ids.push(...r.body.items.map((i) => i.id));
  }
  return { ids, first: first.body };
}

test('BE-09: defaults are page 1, pageSize 20, issued_at:desc; contract holds', async () => {
  const r = await agents['U-51'].get('/api/quotes');
  assert.equal(r.status, 200);
  assert.equal(r.body.page, 1);
  assert.equal(r.body.pageSize, 20);
  assert.equal(r.body.total, 51);
  assert.equal(r.body.totalPages, 3);
  assert.equal(r.body.items.length, 20);
  const dates = r.body.items.map((i) => i.issuedAt);
  assert.deepEqual(dates, [...dates].sort().reverse());
  await assertContract('get', '/api/quotes', r);
});

for (const [key, count] of [['U-0', 0], ['U-1', 1], ['U-50', 50], ['U-51', 51]]) {
  for (const pageSize of [1, 20, 50, 100]) {
    test(`BE-09: org with ${count} quotes, pageSize=${pageSize}: totals correct, every seeded id exactly once`, async () => {
      const orgKey = env.fixtures.users[key].orgKey;
      const expected = env.fixtures.quoteIdsByOrg[orgKey];
      assert.equal(expected.length, count);
      const { ids, first } = await walk(agents[key], pageSize);
      assert.equal(first.total, count);
      assert.equal(first.totalPages, Math.ceil(count / pageSize));
      assert.equal(ids.length, count);
      assert.deepEqual([...ids].sort(), [...expected].sort());
      assert.equal(new Set(ids).size, count);
    });
  }
}

test('BE-09: empty org has empty items and totalPages 0; page beyond last is 200 empty', async () => {
  const r = await agents['U-0'].get('/api/quotes');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.items, []);
  assert.equal(r.body.total, 0);
  assert.equal(r.body.totalPages, 0);
  await assertContract('get', '/api/quotes', r);
  const beyond = await agents['U-51'].get('/api/quotes?page=99&pageSize=20');
  assert.equal(beyond.status, 200);
  assert.deepEqual(beyond.body.items, []);
  assert.equal(beyond.body.total, 51);
  assert.equal(beyond.body.page, 99);
});

test('BE-09: quotes sharing a sort timestamp are neither duplicated nor skipped, in every sort', async () => {
  const ties = env.fixtures.quotes['Q-TIES'].ids;
  assert.equal(ties.length, 5);
  for (const sort of ['issued_at:desc', 'issued_at:asc', 'reference:asc', 'reference:desc']) {
    const { ids } = await walk(agents['U-51'], 1, sort);
    assert.equal(new Set(ids).size, 51, sort);
    assert.ok(ties.every((t) => ids.includes(t)), sort);
  }
  const all = await agents['U-51'].get('/api/quotes?pageSize=100&sort=issued_at:desc');
  const tieIdsInOrder = all.body.items.filter((i) => ties.includes(i.id)).map((i) => i.id);
  assert.deepEqual(tieIdsInOrder, [...ties].sort().reverse());
});

test('BE-09: sort orders', async () => {
  const asc = await agents['U-50'].get('/api/quotes?pageSize=100&sort=issued_at:asc');
  const dates = asc.body.items.map((i) => i.issuedAt);
  assert.deepEqual(dates, [...dates].sort());
  const ref = await agents['U-50'].get('/api/quotes?pageSize=100&sort=reference:desc');
  const refs = ref.body.items.map((i) => i.reference);
  assert.deepEqual(refs, [...refs].sort().reverse());
});

test('BE-09: invalid page, pageSize and sort are 400 VALIDATION_ERROR with the list message', async () => {
  const bad = [
    'page=0', 'page=-1', 'page=abc', 'page=1.5', 'page=', 'page=1&page=2', 'page[a]=1',
    'pageSize=0', 'pageSize=101', 'pageSize=-5', 'pageSize=x', 'pageSize=2.5', 'pageSize=',
    'sort=bogus', 'sort=issued_at', 'sort=issued_at:desc;DROP TABLE quotes', 'sort=', 'sort=id:desc', 'sort=ISSUED_AT:DESC',
    'page=99999999999999999999',
  ];
  for (const qs of bad) {
    const r = await agents['U-51'].get('/api/quotes?' + qs);
    assert.equal(r.status, 400, qs);
    assert.deepEqual(r.body, { code: 'VALIDATION_ERROR', message: 'Could not load quotes. Try again.' }, qs);
    await assertContract('get', '/api/quotes', r);
  }
  const edge = await agents['U-51'].get('/api/quotes?pageSize=100&page=1');
  assert.equal(edge.status, 200);
});

test('BE-09: only the caller organisation quotes are returned and counted', async () => {
  const b = await agents['U-B'].get('/api/quotes?pageSize=100');
  assert.equal(b.body.total, 8);
  const mine = new Set(env.fixtures.quoteIdsByOrg['ORG-B']);
  assert.ok(b.body.items.every((i) => mine.has(i.id)));
  assert.ok(b.body.items.some((i) => i.id === env.fixtures.quotes['Q-B1'].id));
});

test('BE-09: a revision does not reorder the list (issued_at is the version 1 date, Q-P3)', async () => {
  const ids = async () => (await agents['U-51'].get('/api/quotes?pageSize=100')).body.items;
  const before = (await ids()).map((i) => i.id);
  reviseQuote(env.db, env.fixtures.quotes['Q-REV'].id);
  const afterItems = await ids();
  assert.deepEqual(afterItems.map((i) => i.id), before);
  assert.equal(afterItems.find((i) => i.id === env.fixtures.quotes['Q-REV'].id).currentVersionNo, 2);
});

test('BE-10: quote detail returns current version with line items and versions newest first', async () => {
  const id = env.fixtures.quotes['Q-MULTI'].id;
  const r = await agents['U-51'].get(`/api/quotes/${id}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.currentVersionNo, 3);
  assert.equal(r.body.quote.id, id);
  assert.equal(r.body.currentVersion.versionNo, 3);
  assert.equal(r.body.currentVersion.isCurrent, true);
  assert.equal(r.body.currentVersion.supersededAt, null);
  assert.deepEqual(r.body.versions.map((v) => v.versionNo), [3, 2, 1]);
  assert.deepEqual(r.body.versions.map((v) => v.isCurrent), [true, false, false]);
  for (const li of r.body.currentVersion.lineItems) assert.equal(li.lineTotal, li.qty * li.unitPrice);
  const sum = r.body.currentVersion.lineItems.reduce((s, i) => s + i.lineTotal, 0);
  assert.equal(r.body.currentVersion.total, sum);
  assert.equal(r.body.quote.total, sum);
  assert.ok(Number.isInteger(r.body.quote.total));
  await assertContract('get', '/api/quotes/{id}', r);
});

test('BE-10: no line items gives an empty array', async () => {
  const r = await agents['U-51'].get(`/api/quotes/${env.fixtures.quotes['Q-NOLINES'].id}`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.currentVersion.lineItems, []);
  await assertContract('get', '/api/quotes/{id}', r);
});

test('BE-10: other-org, unknown and malformed ids give an identical 404', async () => {
  const ids = [env.fixtures.quotes['Q-B1'].id, 'does-not-exist', 'abc', encodeURIComponent("' OR 1=1 --"), encodeURIComponent('../etc/passwd'), '%E0%A4%A', 'x'.repeat(200), '0', '-1'];
  const results = [];
  for (const id of ids) {
    const r = await agents['U-51'].get(`/api/quotes/${id}`);
    assert.equal(r.status, 404, id);
    results.push(JSON.stringify(r.body));
    await assertContract('get', '/api/quotes/{id}', r);
  }
  assert.equal(new Set(results).size, 1);
  assert.deepEqual(JSON.parse(results[0]), { code: 'NOT_FOUND', message: 'Quote not found.' });
  const slash = await agents['U-51'].get('/api/quotes/../etc/passwd');
  assert.equal(slash.status, 404);
  assert.equal(JSON.stringify(slash.body), results[0]);
  assert.equal(env.db.prepare('SELECT COUNT(*) AS n FROM quotes').get().n, 110);
});

test('BE-10: after a revision the next call returns the higher currentVersionNo', async () => {
  const id = env.fixtures.quotes['Q-MULTI'].id;
  const before = await agents['U-51'].get(`/api/quotes/${id}`);
  reviseQuote(env.db, id);
  const after = await agents['U-51'].get(`/api/quotes/${id}`);
  assert.equal(after.body.currentVersionNo, before.body.currentVersionNo + 1);
  assert.equal(after.body.versions.length, before.body.versions.length + 1);
  assert.equal(after.body.versions.filter((v) => v.isCurrent).length, 1);
});

test('BE-11: version endpoint returns isCurrent/superseded/currentVersionNo', async () => {
  const id = env.fixtures.quotes['Q-MULTI'].id;
  const cur = (await agents['U-51'].get(`/api/quotes/${id}`)).body.currentVersionNo;
  const old = await agents['U-51'].get(`/api/quotes/${id}/versions/1`);
  assert.equal(old.status, 200);
  assert.equal(old.body.isCurrent, false);
  assert.equal(old.body.superseded, true);
  assert.equal(old.body.currentVersionNo, cur);
  assert.notEqual(old.body.version.supersededAt, null);
  await assertContract('get', '/api/quotes/{id}/versions/{versionNo}', old);
  const current = await agents['U-51'].get(`/api/quotes/${id}/versions/${cur}`);
  assert.equal(current.body.isCurrent, true);
  assert.equal(current.body.superseded, false);
  assert.equal(current.body.version.supersededAt, null);
  await assertContract('get', '/api/quotes/{id}/versions/{versionNo}', current);
});

test('BE-11: nonexistent version numbers and other-org quotes share one 404', async () => {
  const id = env.fixtures.quotes['Q-MULTI'].id;
  const bodies = [];
  const urls = [`/api/quotes/${id}/versions/0`, `/api/quotes/${id}/versions/999`, `/api/quotes/${id}/versions/abc`, `/api/quotes/${id}/versions/-1`,
    `/api/quotes/${id}/versions/1.5`, `/api/quotes/${id}/versions/99999999999999999999`, '/api/quotes/nope/versions/1', `/api/quotes/${env.fixtures.quotes['Q-B1'].id}/versions/1`];
  for (const url of urls) {
    const r = await agents['U-51'].get(url);
    assert.equal(r.status, 404, url);
    bodies.push(JSON.stringify(r.body));
    await assertContract('get', '/api/quotes/{id}/versions/{versionNo}', r);
  }
  assert.equal(new Set(bodies).size, 1);
});

test('BE-13: 401 responses on quote endpoints match the contract', async () => {
  const pairs = [['/api/quotes', '/api/quotes'], ['/api/quotes/{id}', '/api/quotes/x'], ['/api/quotes/{id}/versions/{versionNo}', '/api/quotes/x/versions/1']];
  for (const [tpl, url] of pairs) {
    const r = await request(env.app).get(url);
    assert.equal(r.status, 401);
    await assertContract('get', tpl, r);
  }
});

test('BE-09/BE-10: org B user cannot read org 51 quotes by id', async () => {
  const id = env.fixtures.quotes['Q-MULTI'].id;
  assert.equal((await agents['U-B'].get(`/api/quotes/${id}`)).status, 404);
  assert.equal((await agents['U-B'].get(`/api/quotes/${id}/versions/1`)).status, 404);
});
