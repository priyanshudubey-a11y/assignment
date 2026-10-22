import { APIRequestContext, APIResponse, expect, request } from '@playwright/test';
import { BACKEND_URL } from './env';
import { quoteId, user } from './fixtures';

// ---- sessions (QA-03): one login per user, reused until the seed is reset ----
let generation = 0;
const sessions = new Map<string, APIRequestContext>();

export function bumpSessionGeneration() {
  generation++;
  for (const ctx of sessions.values()) ctx.dispose().catch(() => undefined);
  sessions.clear();
}

export async function anonymous(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BACKEND_URL });
}

export async function rawLogin(email: string, password: string, extra: Record<string, unknown> = {}) {
  const ctx = await anonymous();
  const res = await ctx.post('/api/auth/login', { data: { email, password, ...extra } });
  return { ctx, res };
}

/** Session for a named seeded user (fixtures key such as "U-51"). */
export async function loginAs(userKey: string): Promise<APIRequestContext> {
  const cached = sessions.get(`${generation}:${userKey}`);
  if (cached) return cached;
  const u = user(userKey);
  const { ctx, res } = await rawLogin(u.email, u.password);
  expect(res.status(), `login as ${userKey}`).toBe(200);
  sessions.set(`${generation}:${userKey}`, ctx);
  return ctx;
}

// ---- body helpers ----
export async function json(res: APIResponse): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Response is not JSON (status ${res.status()}): ${text.slice(0, 200)}`);
  }
}

export const STACK_TRACE = /\bat\s+[\w$.<>]+\s*\(.*:\d+:\d+\)|node_modules|\.js:\d+:\d+|SQLITE_|SqliteError|Traceback|stack/i;

/** Error body is {code, message} with no stack trace. */
export async function expectErrorShape(res: APIResponse, status: number, code?: string) {
  expect(res.status()).toBe(status);
  expect(res.headers()['content-type'] ?? '').toContain('application/json');
  const text = await res.text();
  const body = JSON.parse(text);
  expect(typeof body.code).toBe('string');
  expect(typeof body.message).toBe('string');
  if (code) expect(body.code).toBe(code);
  expect(text).not.toMatch(STACK_TRACE);
  return body;
}

/** Two responses are indistinguishable: same status, same body keys and same code and message. */
export async function expectIndistinguishable(a: APIResponse, b: APIResponse) {
  expect(a.status()).toBe(b.status());
  const [ba, bb] = [await json(a), await json(b)];
  expect(Object.keys(ba).sort()).toEqual(Object.keys(bb).sort());
  expect(ba.code).toBe(bb.code);
  expect(ba.message).toBe(bb.message);
}

// ---- list walker (QA-03) ----
export interface Walk {
  pages: any[][];
  ids: string[];
  first: any;
  last: any;
}
export async function walkList(ctx: APIRequestContext, opts: { pageSize?: number; sort?: string } = {}): Promise<Walk> {
  const pages: any[][] = [];
  let first: any = null;
  let last: any = null;
  let page = 1;
  for (;;) {
    const q = new URLSearchParams({ page: String(page) });
    if (opts.pageSize !== undefined) q.set('pageSize', String(opts.pageSize));
    if (opts.sort) q.set('sort', opts.sort);
    const res = await ctx.get(`/api/quotes?${q}`);
    expect(res.status(), `GET /api/quotes?${q}`).toBe(200);
    const body = await json(res);
    first ??= body;
    last = body;
    pages.push(body.items);
    if (page >= body.totalPages || page > 5000) break;
    page++;
  }
  return { pages, ids: pages.flat().map((i: any) => String(i.id)), first, last };
}

export async function getQuoteDetail(userKey: string, idOrKey: string) {
  const ctx = await loginAs(userKey);
  let id = idOrKey;
  try {
    id = quoteId(idOrKey);
  } catch {
    /* raw id */
  }
  const res = await ctx.get(`/api/quotes/${encodeURIComponent(id)}`);
  expect(res.status()).toBe(200);
  return json(res);
}

export function money(minor: number): string {
  return (minor / 100).toFixed(2);
}
