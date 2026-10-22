import { expect, test } from '@playwright/test';
import { expectIndistinguishable, json, loginAs } from '../helpers/api';
import { allQuoteRows } from '../helpers/db';
import { orgId, quoteId } from '../helpers/fixtures';
import { BAD_IDS } from '../helpers/env';

test('TC-043 Each seeded quote has exactly one current version @TC-043 @FR-01 @AC-007', async () => {
  const ctx = await loginAs('U-51');
  const list = [];
  for (let p = 1; ; p++) {
    const b = await json(await ctx.get(`/api/quotes?page=${p}&pageSize=100`));
    list.push(...b.items);
    if (p >= b.totalPages) break;
  }
  expect(list.length).toBeGreaterThanOrEqual(51);
  for (const q of list) {
    const d = await json(await ctx.get(`/api/quotes/${encodeURIComponent(q.id)}`));
    const current = d.versions.filter((v: any) => v.isCurrent);
    expect(current, `quote ${q.reference}`).toHaveLength(1);
    expect(current[0].supersededAt).toBeNull();
    expect(current[0].versionNo).toBe(d.currentVersionNo);
    const nos = d.versions.map((v: any) => v.versionNo).sort((a: number, b: number) => a - b);
    expect(nos, `quote ${q.reference}`).toEqual(nos.map((_: number, i: number) => i + 1));
  }
});

test('TC-051 Other-organisation and non-existent ids are indistinguishable @TC-051 @FR-04 @AC-009 @regression', async () => {
  const ctx = await loginAs('U-51');
  const other = await ctx.get(`/api/quotes/${encodeURIComponent(quoteId('Q-B1'))}`);
  const missing = await ctx.get('/api/quotes/does-not-exist');
  expect(other.status()).toBe(404);
  await expectIndistinguishable(other, missing);
  expect((await json(other)).message).toBe('Quote not found.');
});

test('TC-052 Versions endpoint hides other organisations @TC-052 @FR-04 @AC-009', async () => {
  const ctx = await loginAs('U-51');
  const b1 = quoteId('Q-B1');
  const other = await ctx.get(`/api/quotes/${encodeURIComponent(b1)}/versions/1`);
  const missingVersion = await ctx.get(`/api/quotes/${encodeURIComponent(quoteId('Q-MULTI'))}/versions/99`);
  const missingQuote = await ctx.get('/api/quotes/does-not-exist/versions/1');
  expect(other.status()).toBe(404);
  await expectIndistinguishable(other, missingVersion);
  await expectIndistinguishable(other, missingQuote);
});

test('TC-053 Probing neighbouring ids resolves only own quotes @TC-053 @FR-04 @AC-009', async () => {
  const ctx = await loginAs('U-51');
  const own = orgId('ORG-51');
  const rows = allQuoteRows();
  let probes: { id: string; mine: boolean }[];
  if (rows) {
    probes = rows.map((r) => ({ id: r.id, mine: r.organisation_id === own }));
  } else {
    // No database access: probe numeric neighbours of Q-MULTI and Q-B1, and decide ownership from the own list.
    const ownIds = new Set<string>();
    for (let p = 1; ; p++) {
      const b = await json(await ctx.get(`/api/quotes?page=${p}&pageSize=100`));
      b.items.forEach((i: any) => ownIds.add(String(i.id)));
      if (p >= b.totalPages) break;
    }
    const ids = new Set<string>();
    for (const k of ['Q-MULTI', 'Q-B1']) {
      const n = Number(quoteId(k));
      if (Number.isNaN(n)) test.skip(true, 'ids are not numeric and no database access: cannot probe neighbours');
      for (let d = -5; d <= 5; d++) ids.add(String(n + d));
    }
    probes = [...ids].map((id) => ({ id, mine: ownIds.has(id) }));
  }
  expect(probes.some((p) => !p.mine), 'seed holds other-organisation quotes').toBe(true);
  for (const p of probes) {
    const res = await ctx.get(`/api/quotes/${encodeURIComponent(p.id)}`);
    expect(res.status(), `id ${p.id}`).toBe(p.mine ? 200 : 404);
  }
  for (const bad of BAD_IDS) expect((await ctx.get(`/api/quotes/${encodeURIComponent(bad)}`)).status()).toBe(404);
});
