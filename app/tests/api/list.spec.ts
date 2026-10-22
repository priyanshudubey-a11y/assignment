import { expect, test } from '@playwright/test';
import { expectErrorShape, json, loginAs, walkList } from '../helpers/api';
import { seededQuoteIds } from '../helpers/db';
import { orgId, tiesIds, user } from '../helpers/fixtures';
import { resetSeed, reviseQuote } from '../helpers/seed';

const sizes = (w: { pages: any[][] }) => w.pages.map((p) => p.length);
const distinct = (ids: string[]) => new Set(ids).size;
const sorted = (a: string[]) => [...a].sort();

test('TC-022 Exactly 50 quotes with pageSize=50 @TC-022 @FR-03 @AC-005', async () => {
  const ctx = await loginAs('U-50');
  const w = await walkList(ctx, { pageSize: 50 });
  expect(sizes(w)).toEqual([50]);
  expect(w.first.total).toBe(50);
  expect(w.first.totalPages).toBe(1);
  const p2 = await ctx.get('/api/quotes?page=2&pageSize=50');
  if (p2.status() === 200) expect((await json(p2)).items).toEqual([]);
});

test('TC-023 50 quotes at default page size @TC-023 @FR-03 @AC-005', async () => {
  const w = await walkList(await loginAs('U-50'));
  expect(w.first.totalPages).toBe(3);
  expect(sizes(w)).toEqual([20, 20, 10]);
  expect(distinct(w.ids)).toBe(50);
});

test('TC-024 51 quotes with pageSize=50 (the >50 rows bug) @TC-024 @FR-03 @AC-004 @regression', async () => {
  const w = await walkList(await loginAs('U-51'), { pageSize: 50 });
  expect(w.first.total).toBe(51);
  expect(w.first.totalPages).toBe(2);
  expect(sizes(w)).toEqual([50, 1]);
  expect(distinct(w.ids)).toBe(51);
  const seeded = seededQuoteIds('ORG-51');
  if (seeded) expect(sorted(w.ids)).toEqual(sorted(seeded));
});

test('TC-025 51 or more quotes at default page size @TC-025 @FR-03 @AC-004 @regression', async () => {
  const w = await walkList(await loginAs('U-51'));
  const total = w.first.total;
  expect(total).toBeGreaterThanOrEqual(51);
  if (total === 51) expect(sizes(w)).toEqual([20, 20, 11]);
  expect(w.ids.length).toBe(total);
  expect(distinct(w.ids)).toBe(total);
  const seeded = seededQuoteIds('ORG-51');
  if (seeded) expect(sorted(w.ids)).toEqual(sorted(seeded));
});

test('TC-026 pageSize=1 walked twice gives the same order @TC-026 @FR-03 @AC-004', async () => {
  const ctx = await loginAs('U-51');
  const a = await walkList(ctx, { pageSize: 1 });
  const b = await walkList(ctx, { pageSize: 1 });
  expect(a.pages.length).toBe(51);
  expect(a.ids).toEqual(b.ids);
  expect(distinct(a.ids)).toBe(51);
});

test('TC-027 Identical sort timestamps are not duplicated or skipped @TC-027 @FR-03 @AC-004 @regression', async () => {
  const ctx = await loginAs('U-51');
  const w = await walkList(ctx, { pageSize: 3 });
  expect(distinct(w.ids)).toBe(w.ids.length);
  const ties = tiesIds();
  expect(ties.length).toBeGreaterThanOrEqual(5);
  for (const id of ties) expect(w.ids.filter((x) => x === id), `tie quote ${id}`).toHaveLength(1);
  // ties break on id descending (compare numerically when ids are numeric, else as strings)
  const items = w.pages.flat().filter((i: any) => ties.includes(String(i.id)));
  const stamps = new Set(items.map((i: any) => i.issuedAt));
  expect(stamps.size, 'Q-TIES share one issuedAt').toBe(1);
  const ids = items.map((i: any) => String(i.id));
  const numeric = ids.every((x) => /^\d+$/.test(x));
  const expected = [...ids].sort((a, b) => (numeric ? Number(b) - Number(a) : a < b ? 1 : a > b ? -1 : 0));
  expect(ids).toEqual(expected);
});

// pending-decision: Q-P3 (BUILD-DECISIONS: issued_at = date version 1 was issued; a revision never moves a quote)
test.describe('TC-028 group', () => {
  test.afterEach(() => resetSeed());
  test('TC-028 Revision while paging through the list @TC-028 @FR-03 @AC-004 @pending-decision', async () => {
    const ctx = await loginAs('U-51');
    const before = await walkList(ctx, { pageSize: 20 });
    const firstPageQuote = String(before.pages[0][0].id);
    const newVersion = await reviseQuote(firstPageQuote);
    const after = await walkList(ctx, { pageSize: 20 });
    expect(after.ids, 'same order after the revision').toEqual(before.ids);
    expect(distinct(after.ids)).toBe(51);
    const row = after.pages.flat().find((i: any) => String(i.id) === firstPageQuote);
    expect(row.currentVersionNo).toBe(newVersion);
  });
});

test('TC-029 Invalid page number is rejected @TC-029 @FR-03 @AC-004', async () => {
  const ctx = await loginAs('U-51');
  for (const p of ['0', '-1', 'abc']) {
    const res = await ctx.get(`/api/quotes?page=${p}`);
    await expectErrorShape(res, 400);
  }
});

test('TC-030 Invalid page size is rejected @TC-030 @FR-03 @AC-004 @pending-decision', async () => {
  const ctx = await loginAs('U-51');
  for (const s of ['0', 'abc', '101', '100000']) {
    await expectErrorShape(await ctx.get(`/api/quotes?pageSize=${s}`), 400);
  }
  const ok = await ctx.get('/api/quotes?pageSize=100');
  expect(ok.status()).toBe(200);
});

test('TC-031 Page beyond the last page @TC-031 @FR-03 @AC-004 @pending-decision', async () => {
  const res = await (await loginAs('U-51')).get('/api/quotes?page=999');
  expect(res.status()).toBe(200);
  const b = await json(res);
  expect(b.items).toEqual([]);
  expect(b.total).toBeGreaterThanOrEqual(51);
  expect(b.totalPages).toBe(Math.ceil(b.total / b.pageSize));
});

test('TC-033 Unsupported sort value is rejected @TC-033 @FR-03 @AC-004', async () => {
  const res = await (await loginAs('U-51')).get('/api/quotes?sort=password:asc');
  const body = await expectErrorShape(res, 400);
  expect(JSON.stringify(body)).not.toMatch(/password_hash|\$2[aby]\$/);
});

test('TC-034 List never contains another organisation\'s quotes @TC-034 @FR-03 @FR-04 @AC-009', async () => {
  const w = await walkList(await loginAs('U-51'), { pageSize: 100 });
  const bIds = new Set((await walkList(await loginAs('U-B'), { pageSize: 100 })).ids);
  expect(bIds.size).toBeGreaterThan(0);
  for (const id of w.ids) expect(bIds.has(id), `ORG-B quote ${id} leaked`).toBe(false);
  expect(w.first.total).toBe(w.ids.length);
  const seeded = seededQuoteIds('ORG-51');
  if (seeded) expect(w.first.total).toBe(seeded.length);
  expect(user('U-51').orgKey ?? 'ORG-51').toBe('ORG-51');
  expect(orgId('ORG-51')).not.toBe(orgId('ORG-B'));
});
