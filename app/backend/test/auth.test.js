'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { makeEnv, loginAgent, assertContract } = require('./helpers');
const { UserStore } = require('../src/user-store');
const { createApp } = require('../src/app');

let env;
before(async () => { env = await makeEnv(); });

const EMAIL = 'user51@org51.example.test';

test('BE-06: correct credentials return 200 + user, cookie flags, no redirect', async () => {
  const res = await request(env.app).post('/api/auth/login').send({ email: EMAIL, password: 'Test-Passw0rd!' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.location, undefined);
  assert.equal(res.body.user.email, EMAIL);
  assert.equal(res.body.user.role, 'customer');
  assert.equal(res.body.user.organisation.name, 'Fifty-One Quotes Ltd');
  assert.ok(!JSON.stringify(res.body).includes('password'));
  const cookie = res.headers['set-cookie'][0];
  assert.match(cookie, /^qp_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /Secure/);
  await assertContract('post', '/api/auth/login', res);
});

test('BE-05: cookie is Secure when the request is HTTPS (trust proxy) or forced', async () => {
  const app = createApp({ db: env.db, config: { logLevel: 'silent', trustProxy: true } });
  const res = await request(app).post('/api/auth/login').set('X-Forwarded-Proto', 'https').send({ email: EMAIL, password: 'Test-Passw0rd!' });
  assert.match(res.headers['set-cookie'][0], /; Secure/);
  const forced = createApp({ db: env.db, config: { logLevel: 'silent', cookieSecure: 'true' } });
  const r2 = await request(forced).post('/api/auth/login').send({ email: EMAIL, password: 'Test-Passw0rd!' });
  assert.match(r2.headers['set-cookie'][0], /; Secure/);
});

test('BE-06: wrong password and unknown email give identical 401', async () => {
  const wrong = await request(env.app).post('/api/auth/login').send({ email: EMAIL, password: 'nope' });
  const unknown = await request(env.app).post('/api/auth/login').send({ email: 'nobody@nowhere.example.test', password: 'nope' });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(wrong.body, { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' });
  assert.deepEqual(unknown.body, wrong.body);
  assert.equal(wrong.headers['set-cookie'], undefined);
  await assertContract('post', '/api/auth/login', wrong);
});

test('BE-06: empty or malformed input is 400 VALIDATION_ERROR with field messages and no session', async () => {
  const cases = [
    [{ email: '', password: 'x' }, 'email'],
    [{ email: 'not-an-email', password: 'x' }, 'email'],
    [{ email: EMAIL, password: '' }, 'password'],
    [{ email: EMAIL }, 'password'],
    [{}, 'email'],
    [{ email: 123, password: 'x' }, 'email'],
  ];
  for (const [body, field] of cases) {
    const res = await request(env.app).post('/api/auth/login').send(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.body.code, 'VALIDATION_ERROR');
    assert.ok(res.body.details.some((d) => d.field === field));
    assert.equal(res.headers['set-cookie'], undefined);
    await assertContract('post', '/api/auth/login', res);
  }
  const noBody = await request(env.app).post('/api/auth/login');
  assert.equal(noBody.status, 400);
});

test('BE-06: email matching is case-insensitive', async () => {
  const res = await request(env.app).post('/api/auth/login').send({ email: 'USER51@ORG51.Example.TEST', password: 'Test-Passw0rd!' });
  assert.equal(res.status, 200);
});

test('BE-06: ten wrong passwords then the correct one still succeeds (no lockout)', async () => {
  for (let i = 0; i < 10; i++) {
    const r = await request(env.app).post('/api/auth/login').send({ email: EMAIL, password: 'bad' + i });
    assert.equal(r.status, 401);
  }
  const ok = await request(env.app).post('/api/auth/login').send({ email: EMAIL, password: 'Test-Passw0rd!' });
  assert.equal(ok.status, 200);
});

test('BE-06: two simultaneous identical logins both succeed with distinct sessions', async () => {
  const [a, b] = await Promise.all([
    request(env.app).post('/api/auth/login').send({ email: EMAIL, password: 'Test-Passw0rd!' }),
    request(env.app).post('/api/auth/login').send({ email: EMAIL, password: 'Test-Passw0rd!' }),
  ]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.notEqual(a.headers['set-cookie'][0], b.headers['set-cookie'][0]);
});

test('BE-05: database holds only hashes, and only a hash of the session id', async () => {
  const hashes = env.db.prepare('SELECT password_hash FROM users').all();
  assert.ok(hashes.length >= 5);
  for (const h of hashes) {
    assert.match(h.password_hash, /^scrypt\$/);
    assert.ok(!h.password_hash.includes('Test-Passw0rd!'));
  }
  const agent = await loginAgent(env.app, EMAIL);
  const sid = agent.cookie.split('=')[1];
  const rows = env.db.prepare('SELECT id_hash FROM sessions').all();
  assert.ok(rows.every((r) => r.id_hash !== sid));
});

test('BE-07: /api/me returns the user with organisation, or 401', async () => {
  const agent = await loginAgent(env.app, EMAIL);
  const me = await agent.get('/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.organisation.id, env.fixtures.orgs['ORG-51'].id);
  await assertContract('get', '/api/me', me);
  const anon = await request(env.app).get('/api/me');
  assert.equal(anon.status, 401);
  assert.deepEqual(anon.body, { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' });
  await assertContract('get', '/api/me', anon);
});

test('BE-07: logout returns 204, clears the cookie, and a replayed cookie no longer works', async () => {
  const agent = await loginAgent(env.app, EMAIL);
  const out = await request(env.app).post('/api/auth/logout').set('Cookie', agent.cookie);
  assert.equal(out.status, 204);
  assert.match(out.headers['set-cookie'][0], /qp_session=;/);
  assert.match(out.headers['set-cookie'][0], /Max-Age=0/);
  await assertContract('post', '/api/auth/logout', out);
  for (const url of ['/api/me', '/api/quotes', `/api/quotes/${env.fixtures.quotes['Q-MULTI'].id}`]) {
    const r = await agent.get(url);
    assert.equal(r.status, 401, url);
    assert.equal(r.body.code, 'UNAUTHENTICATED');
  }
});

test('BE-07: logout with no session (or garbage cookie) is also 204', async () => {
  const a = await request(env.app).post('/api/auth/logout');
  assert.equal(a.status, 204);
  const b = await request(env.app).post('/api/auth/logout').set('Cookie', 'qp_session=garbage');
  assert.equal(b.status, 204);
});

test('BE-05: a session can be invalidated server-side', async () => {
  const agent = await loginAgent(env.app, EMAIL);
  assert.equal((await agent.get('/api/me')).status, 200);
  const store = new UserStore(env.db);
  store.destroyUserSessions(store.findByEmail(EMAIL).id);
  assert.equal((await agent.get('/api/me')).status, 401);
});

test('BE-08: every /api route except login, logout and health needs a session', async () => {
  const q = env.fixtures.quotes['Q-MULTI'].id;
  for (const url of ['/api/me', '/api/quotes', `/api/quotes/${q}`, `/api/quotes/${q}/versions/1`, '/api/unknown']) {
    const r = await request(env.app).get(url);
    assert.equal(r.status, 401, url);
    assert.equal(r.body.code, 'UNAUTHENTICATED');
  }
  const r = await request(env.app).get('/api/quotes').set('Cookie', 'qp_session=abc');
  assert.equal(r.status, 401);
});

test('BE-08: organisation id comes only from the session (query, header and body are ignored)', async () => {
  const agent = await loginAgent(env.app, 'user1@org1.example.test');
  const other = env.fixtures.orgs['ORG-51'].id;
  const res = await request(env.app)
    .get(`/api/quotes?organisationId=${other}&organization_id=${other}`)
    .set('Cookie', agent.cookie)
    .set('X-Organisation-Id', other)
    .set('X-Organization-Id', other);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 1);
  const mine = await agent.get('/api/me');
  assert.equal(mine.body.user.organisation.id, env.fixtures.orgs['ORG-1'].id);
  const login = await request(env.app).post('/api/auth/login').send({ email: 'user1@org1.example.test', password: 'Test-Passw0rd!', organisationId: other });
  assert.equal(login.body.user.organisation.id, env.fixtures.orgs['ORG-1'].id);
});
