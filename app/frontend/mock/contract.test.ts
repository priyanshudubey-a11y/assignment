// @vitest-environment node
// Conformance: every mock response validates against the schemas in plans/openapi.yaml (guards against mock/contract drift, R-3).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import { createMockServer } from './server.mjs';

const doc = parse(readFileSync(new URL('../../../plans/openapi.yaml', import.meta.url), 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ $id: 'contract', ...doc });
const validate = (name: string, data: unknown) => {
  const v = ajv.getSchema(`contract#/components/schemas/${name}`)!;
  const ok = v(data);
  expect(ok, JSON.stringify(v.errors)).toBe(true);
};

let base = '';
let cookie = '';
const server = createMockServer();
beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((r) => server.close(r)));

const call = (path: string, init: RequestInit = {}) =>
  fetch(base + path, { ...init, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) } });

describe('mock server matches plans/openapi.yaml', () => {
  it('health', async () => {
    const r = await call('/api/health');
    expect(r.status).toBe(200);
    validate('Health', await r.json());
  });
  it('401 before login, with the Error shape', async () => {
    for (const p of ['/api/me', '/api/quotes', '/api/quotes/q-multi']) {
      const r = await call(p);
      expect(r.status).toBe(401);
      validate('Error', await r.json());
    }
  });
  it('login: wrong password and unknown email are identical', async () => {
    const a = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'acme@example.test', password: 'nope' }) });
    const b = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'nobody@example.test', password: 'nope' }) });
    expect(a.status).toBe(401);
    expect(await a.json()).toEqual(await b.json());
  });
  it('login: malformed email is a 400 VALIDATION_ERROR', async () => {
    const r = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'bad', password: 'x' }) });
    expect(r.status).toBe(400);
    validate('Error', await r.json());
  });
  it('login (case-insensitive) then me, list, detail, version', async () => {
    const r = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'ACME@example.test', password: 'Passw0rd!' }) });
    expect(r.status).toBe(200);
    cookie = /qp_session=[^;]+/.exec(r.headers.get('set-cookie')!)![0];
    validate('LoginResponse', await r.json());
    validate('LoginResponse', await (await call('/api/me')).json());

    const l1 = await (await call('/api/quotes?page=1&pageSize=20')).json();
    validate('QuoteListResponse', l1);
    expect(l1).toMatchObject({ total: 51, totalPages: 3, page: 1 });
    const ids = new Set<string>();
    for (let p = 1; p <= 3; p++) {
      const l = await (await call(`/api/quotes?page=${p}&pageSize=20`)).json();
      l.items.forEach((q: { id: string }) => ids.add(q.id));
    }
    expect(ids.size).toBe(51);
    const beyond = await (await call('/api/quotes?page=9')).json();
    expect(beyond.items).toEqual([]);
    validate('QuoteListResponse', beyond);

    const d = await (await call('/api/quotes/q-multi')).json();
    validate('QuoteDetailResponse', d);
    expect(d.currentVersionNo).toBe(2);
    const v1 = await (await call('/api/quotes/q-multi/versions/1')).json();
    validate('QuoteVersionResponse', v1);
    expect(v1).toMatchObject({ isCurrent: false, superseded: true, currentVersionNo: 2 });
    validate('QuoteDetailResponse', await (await call('/api/quotes/q-noitems')).json());
  });
  it('400 for bad paging, 404 for unknown, malformed, other-org and missing version', async () => {
    for (const q of ['page=0', 'pageSize=101', 'sort=nope']) {
      const r = await call(`/api/quotes?${q}`);
      expect(r.status).toBe(400);
      validate('Error', await r.json());
    }
    for (const p of ['/api/quotes/nope', '/api/quotes/q-other-org', '/api/quotes/q-multi/versions/9', '/api/quotes/q-other-org/versions/1']) {
      const r = await call(p);
      expect(r.status).toBe(404);
      const body = await r.json();
      validate('Error', body);
      expect(body).toEqual({ code: 'NOT_FOUND', message: 'Quote not found.' });
    }
  });
  it('logout returns 204 and ends the session', async () => {
    const r = await call('/api/auth/logout', { method: 'POST' });
    expect(r.status).toBe(204);
    cookie = '';
    expect((await call('/api/me')).status).toBe(401);
  });
});
