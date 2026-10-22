import { expect, test } from '@playwright/test';
import { anonymous, expectErrorShape, expectIndistinguishable, json, loginAs, rawLogin, walkList } from '../helpers/api';
import { orgId, quoteId, user } from '../helpers/fixtures';

test('TC-002 Email is matched case-insensitively @TC-002 @FR-02 @AC-001', async () => {
  const u = user('U-51');
  const { res } = await rawLogin(u.email.toUpperCase(), u.password);
  expect(res.status()).toBe(200);
  const body = await json(res);
  expect(body.user.email.toLowerCase()).toBe(u.email.toLowerCase());
});

test('TC-005 Unknown email response matches wrong password @TC-005 @FR-02 @AC-002', async () => {
  const u = user('U-51');
  const wrong = await rawLogin(u.email, 'definitely-wrong-password');
  const unknown = await rawLogin('nobody@example.test', 'definitely-wrong-password');
  expect(wrong.res.status()).toBe(401);
  expect(unknown.res.status()).toBe(401);
  await expectIndistinguishable(wrong.res, unknown.res);
  const b = await json(unknown.res);
  expect(b.code).toBe('INVALID_CREDENTIALS');
  expect(b.message).toBe('Incorrect email or password.');
  expect(b.details).toBeUndefined();
});

test('TC-008 No lockout after repeated failures @TC-008 @FR-02 @AC-002', async () => {
  const u = user('U-51');
  for (let i = 0; i < 10; i++) {
    const { res } = await rawLogin(u.email, `wrong-${i}`);
    expect(res.status()).toBe(401);
  }
  const { res } = await rawLogin(u.email, u.password);
  expect(res.status(), '11th attempt with the correct password').toBe(200);
});

test('TC-016 Protected endpoints deny anonymous access @TC-016 @FR-02 @FR-04 @AC-009 @regression', async () => {
  const ctx = await anonymous();
  const q = quoteId('Q-MULTI');
  for (const p of ['/api/me', '/api/quotes', `/api/quotes/${q}`, `/api/quotes/${q}/versions/1`]) {
    const res = await ctx.get(p);
    const body = await expectErrorShape(res, 401);
    expect(body.items, p).toBeUndefined();
    expect(body.quote, p).toBeUndefined();
    expect(body.version, p).toBeUndefined();
  }
});

test('TC-055 Client-supplied organisation data is ignored @TC-055 @FR-04 @AC-009', async () => {
  const ctx = await loginAs('U-51');
  const other = orgId('ORG-B');
  const base = await walkList(ctx, { pageSize: 100 });
  const viaQuery = await ctx.get(`/api/quotes?pageSize=100&organisationId=${encodeURIComponent(other)}&organization_id=${encodeURIComponent(other)}`);
  const viaHeader = await ctx.get('/api/quotes?pageSize=100', {
    headers: { 'X-Organisation-Id': other, 'X-Organization-Id': other, 'X-Org-Id': other },
  });
  const viaBody = await ctx.get('/api/quotes?pageSize=100', { data: { organisationId: other } });
  for (const r of [viaQuery, viaHeader, viaBody]) {
    expect(r.status()).toBe(200);
    const b = await json(r);
    expect(b.total).toBe(base.first.total);
    expect(b.items.map((i: any) => String(i.id))).toEqual(base.pages[0].map((i: any) => String(i.id)));
  }
  // organisationId in a body must not change the session's organisation either
  const u = user('U-51');
  const { ctx: c2, res } = await rawLogin(u.email, u.password, { organisationId: other });
  expect(res.status()).toBe(200);
  const me = await json(await c2.get('/api/me'));
  expect(String(me.user.organisation.id)).toBe(orgId(u.orgKey ?? 'ORG-51'));
});
