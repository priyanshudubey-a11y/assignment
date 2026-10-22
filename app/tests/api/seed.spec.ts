import { expect, test } from '@playwright/test';
import { json, loginAs, walkList } from '../helpers/api';
import { orgId, quoteId, user } from '../helpers/fixtures';
import { resetSeed, reviseRaw } from '../helpers/seed';

test.describe('TC-070 group', () => {
  test.afterEach(() => resetSeed());
  test('TC-070 Parallel seed:revise runs stay consistent @TC-070 @FR-08 @AC-014', async () => {
    const id = quoteId('Q-REV');
    const [a, b] = await Promise.all([reviseRaw(id), reviseRaw(id)]);
    expect([a.code, b.code], `stderr: ${a.stderr} | ${b.stderr}`).toEqual([0, 0]);
    const ctx = await loginAs('U-51');
    const d = await json(await ctx.get(`/api/quotes/${encodeURIComponent(id)}`));
    const nos = d.versions.map((v: any) => v.versionNo).sort((x: number, y: number) => x - y);
    expect(nos).toEqual([1, 2, 3]);
    expect(new Set(nos).size).toBe(nos.length);
    expect(d.versions.filter((v: any) => v.isCurrent)).toHaveLength(1);
    expect(d.currentVersionNo).toBe(3);
  });
});

async function snapshot() {
  const out: Record<string, any> = {};
  for (const k of ['U-0', 'U-1', 'U-50', 'U-51', 'U-B']) {
    const w = await walkList(await loginAs(k), { pageSize: 100 });
    out[k] = { total: w.first.total, refs: w.pages.flat().map((i: any) => i.reference).sort() };
  }
  const d = await json(await (await loginAs('U-51')).get(`/api/quotes/${encodeURIComponent(quoteId('Q-MULTI'))}`));
  out.multiVersions = d.versions.length;
  return out;
}

// pending-decision: Q-P4 (separate orgs with exactly 0, 1, 50 and 51 quotes - accepted in BUILD-DECISIONS)
test('TC-072 Seed produces all required shapes @TC-072 @FR-08 @AC-013 @pending-decision', async () => {
  const counts: Record<string, (n: number) => boolean> = {
    'U-0': (n) => n === 0,
    'U-1': (n) => n === 1,
    'U-50': (n) => n === 50,
    'U-51': (n) => n >= 51,
  };
  for (const [k, ok] of Object.entries(counts)) {
    const ctx = await loginAs(k);
    const me = await json(await ctx.get('/api/me'));
    expect(me.user.role).toBe('customer');
    const total = (await json(await ctx.get('/api/quotes'))).total;
    expect(ok(total), `${k} has ${total} quotes`).toBe(true);
  }
  const ctx51 = await loginAs('U-51');
  const multi = await json(await ctx51.get(`/api/quotes/${encodeURIComponent(quoteId('Q-MULTI'))}`));
  expect(multi.versions).toHaveLength(3);
  expect(multi.currentVersionNo).toBe(3);
  const b = await walkList(await loginAs('U-B'), { pageSize: 100 });
  expect(b.ids.length).toBeGreaterThan(0);
  expect(b.ids).toContain(String(quoteId('Q-B1')));
  expect(orgId('ORG-B')).not.toBe(orgId('ORG-51'));
  const nolines = await json(await ctx51.get(`/api/quotes/${encodeURIComponent(quoteId('Q-NOLINES'))}`));
  expect(nolines.currentVersion.lineItems).toEqual([]);
  expect(user('U-51').email).toMatch(/@example\.test$/);
});

// pending-decision: Q-P5 (re-running the seed resets to the known state)
test('TC-073 Running the seed twice does not duplicate data @TC-073 @FR-08 @AC-013 @pending-decision', async () => {
  resetSeed();
  const first = await snapshot();
  resetSeed();
  const second = await snapshot();
  expect(second).toEqual(first);
  for (const k of ['U-0', 'U-1', 'U-50', 'U-51', 'U-B']) {
    const refs: string[] = second[k].refs;
    expect(new Set(refs).size, `${k} references unique`).toBe(refs.length);
  }
});
