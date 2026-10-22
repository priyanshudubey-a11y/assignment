import { expect, test } from '@playwright/test';
import { anonymous, expectErrorShape, json, rawLogin, STACK_TRACE } from '../helpers/api';
import { BACKEND_URL, DEFAULT_PASSWORD } from '../helpers/env';
import { dbAll, findDbPath } from '../helpers/db';
import { quoteId, user } from '../helpers/fixtures';
import { loginAs } from '../helpers/api';

test('TC-080 Health endpoint reports healthy @TC-080 @NFR-01 @AC-010 @regression', async () => {
  const ctx = await anonymous(); // no session, no auth
  const res = await ctx.get('/api/health');
  expect(res.status()).toBe(200);
  const text = await res.text();
  const body = JSON.parse(text);
  expect(body.status).toBe('ok');
  expect(Object.keys(body)).toEqual(['status']);
  expect(text).not.toMatch(/password|secret|token|cookie|\.db|\/home\/|@example/i);
});

test('TC-094 Baseline security hygiene @TC-094 @NFR-02 @AC-none', async () => {
  // 1. passwords hashed (database dump)
  const dbPath = findDbPath();
  test.info().annotations.push({ type: 'db', description: String(dbPath) });
  if (!dbPath) test.fail(true, 'No SQLite file found under app/backend; set QP_DB_PATH to run the hash check');
  const tables = (dbAll("SELECT name FROM sqlite_master WHERE type='table'") ?? []).map((r) => r.name as string);
  let checked = 0;
  for (const t of tables) {
    const cols = (dbAll(`PRAGMA table_info("${t}")`) ?? []).map((c) => c.name as string);
    if (!cols.includes('password_hash')) continue;
    const rows = dbAll(`SELECT * FROM "${t}"`) ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const h = String(r.password_hash);
      expect(h).not.toBe(DEFAULT_PASSWORD);
      expect(h).not.toContain(DEFAULT_PASSWORD);
      expect(h.length).toBeGreaterThanOrEqual(30);
      expect(JSON.stringify(r)).not.toContain(DEFAULT_PASSWORD);
    }
    checked++;
  }
  expect(checked, 'a users table with password_hash').toBeGreaterThan(0);

  // 2. session cookie flags
  const u = user('U-51');
  const { res } = await rawLogin(u.email, u.password);
  const setCookie = res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value);
  const sess = setCookie.find((c) => c.startsWith('qp_session='));
  expect(sess, 'qp_session cookie set').toBeTruthy();
  expect(sess!).toMatch(/httponly/i);
  if (BACKEND_URL.startsWith('https://')) expect(sess!).toMatch(/;\s*secure/i);

  // 3. no stack traces in error bodies
  const anon = await anonymous();
  const ctx = await loginAs('U-51');
  const errors = [
    await rawLogin(u.email, 'wrong').then((r) => r.res),
    await rawLogin('not-an-email', 'x').then((r) => r.res),
    await anon.get('/api/me'),
    await ctx.get('/api/quotes?page=0'),
    await ctx.get('/api/quotes?sort=password:asc'),
    await ctx.get(`/api/quotes/${encodeURIComponent("' OR 1=1 --")}`),
    await ctx.get('/api/quotes/does-not-exist'),
    await ctx.get(`/api/quotes/${quoteId('Q-MULTI')}/versions/abc`),
  ];
  for (const e of errors) {
    expect(e.status()).toBeGreaterThanOrEqual(400);
    expect(e.status()).toBeLessThan(500);
    expect(await e.text()).not.toMatch(STACK_TRACE);
    expect(Object.keys(await json(e))).toEqual(expect.arrayContaining(['code', 'message']));
  }
  await expectErrorShape(await anon.get('/api/quotes'), 401);
});
