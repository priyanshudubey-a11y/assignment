import { expect, test } from '@playwright/test';
import { getQuoteDetail, json, loginAs, money } from '../helpers/api';
import { quoteId } from '../helpers/fixtures';
import { resetSeed, reviseRaw } from '../helpers/seed';

// "Unit" level here = logic checks on seed/repository behaviour and money maths, no browser.

test('TC-045 Line and version amounts are consistent @TC-045 @FR-01 @AC-007', async () => {
  const ctx = await loginAs('U-51');
  const d = await getQuoteDetail('U-51', 'Q-MULTI');
  const versions: any[] = d.versions;
  expect(versions.length).toBe(3);
  for (const vs of versions) {
    const res = await ctx.get(`/api/quotes/${encodeURIComponent(quoteId('Q-MULTI'))}/versions/${vs.versionNo}`);
    const { version } = await json(res);
    expect(version.lineItems.length).toBeGreaterThan(0);
    for (const li of version.lineItems) {
      expect(Number.isInteger(li.qty)).toBe(true);
      expect(Number.isInteger(li.unitPrice)).toBe(true);
      expect(li.lineTotal).toBe(li.qty * li.unitPrice);
    }
    const sum = version.lineItems.reduce((s: number, li: any) => s + li.lineTotal, 0);
    expect(version.total).toBe(sum);
    expect(vs.total).toBe(version.total);
    expect(money(version.total)).toMatch(/^\d+\.\d{2}$/);
  }
  expect(d.currentVersion.total).toBe(versions.find((v) => v.isCurrent).total);
});

test.describe('seed:revise', () => {
  test.beforeEach(() => resetSeed());
  test.afterEach(() => resetSeed());

  test('TC-069 seed:revise issues a new current version @TC-069 @FR-08 @AC-014 @regression', async () => {
    const id = quoteId('Q-REV');
    const before = await getQuoteDetail('U-51', id);
    const prevNo = before.currentVersionNo;
    const r = await reviseRaw(id);
    expect(r.code, r.stderr).toBe(0);
    const after = await getQuoteDetail('U-51', id);
    expect(after.currentVersionNo).toBe(prevNo + 1);
    const prev = after.versions.find((v: any) => v.versionNo === prevNo);
    expect(prev.supersededAt).not.toBeNull();
    expect(prev.isCurrent).toBe(false);
    const current = after.versions.filter((v: any) => v.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0].versionNo).toBe(prevNo + 1);
    expect(current[0].supersededAt).toBeNull();
  });

  test('TC-071 seed:revise with an unknown quote fails cleanly @TC-071 @FR-08 @AC-014', async () => {
    const snap = async () => JSON.stringify([await getQuoteDetail('U-51', 'Q-REV'), await getQuoteDetail('U-51', 'Q-MULTI')]);
    const before = await snap();
    const r = await reviseRaw('does-not-exist');
    expect(r.code).not.toBe(0);
    expect(`${r.stdout}\n${r.stderr}`).toMatch(/not found|unknown|does not exist|no such quote|does-not-exist/i);
    expect(`${r.stdout}\n${r.stderr}`).not.toMatch(/\bat\s+\S+\s+\(.*:\d+:\d+\)/);
    expect(await snap()).toBe(before);
  });
});
