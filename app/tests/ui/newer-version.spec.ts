import { expect, Page, test } from '@playwright/test';
import { POLL_MS } from '../helpers/env';
import { quoteId } from '../helpers/fixtures';
import { resetSeed, reviseQuote } from '../helpers/seed';
import { expectQuoteShows, quoteKeyUrl, quotesUrl, signInViaApi, trackErrors, ui, versionText } from '../helpers/ui';

// Data-changing tests: reset the seed before and after (QA-02) so order does not matter.
test.beforeEach(() => resetSeed());
test.afterEach(() => resetSeed());

const WITHIN = POLL_MS + 15_000;
const quotePoll = (id: string) => new RegExp(`/api/quotes/${encodeURIComponent(id)}$`);
const isQuotePoll = (id: string) => (r: import('@playwright/test').Response) => quotePoll(id).test(new URL(r.url()).pathname) && r.request().method() === 'GET';

async function openRev(page: Page, versionNo = 1) {
  await signInViaApi(page, 'U-51');
  await page.goto(quoteKeyUrl('Q-REV', versionNo));
  await expectQuoteShows(page, 1, 'current');
}

async function expectReadOnly(page: Page) {
  await expect(page.locator('main input:not([type=hidden]), main textarea, main select')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /edit|save|update|delete/i })).toHaveCount(0);
}

test('TC-060 Banner appears within the polling interval @TC-060 @FR-07 @AC-012 @regression', async ({ page }) => {
  test.setTimeout(WITHIN + 60_000);
  await openRev(page);
  await expect(ui.banner(page)).toHaveCount(0);
  await reviseQuote('Q-REV');
  await expect(ui.banner(page)).toBeVisible({ timeout: WITHIN });
  await expect(page.getByText(versionText(1)).first()).toBeVisible();
  await expectReadOnly(page);
  await ui.bannerLink(page).click();
  await expectQuoteShows(page, 2, 'current');
});

test('TC-061 Banner appears promptly on refocus @TC-061 @FR-07 @AC-012', async ({ page }) => {
  await openRev(page);
  await reviseQuote('Q-REV');
  // Simulate returning to the tab: the app listens for focus / visibilitychange.
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(ui.banner(page)).toBeVisible({ timeout: 5_000 });
});

test('TC-062 Two revisions link to the latest version @TC-062 @FR-07 @AC-012', async ({ page }) => {
  test.setTimeout(WITHIN + 60_000);
  await openRev(page);
  await reviseQuote('Q-REV');
  await reviseQuote('Q-REV');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(ui.banner(page)).toBeVisible({ timeout: WITHIN });
  await ui.bannerLink(page).click();
  await expectQuoteShows(page, 3, 'current');
  await expect(page).not.toHaveURL(/versions\/2$/);
});

test('TC-063 No false banner when nothing changes @TC-063 @FR-07 @AC-012', async ({ page }) => {
  test.setTimeout(2 * POLL_MS + 90_000);
  const errors = trackErrors(page);
  await signInViaApi(page, 'U-51');
  await page.goto(quoteKeyUrl('Q-MULTI'));
  await expectQuoteShows(page, 3, 'current');
  const id = quoteId('Q-MULTI');
  // wait (event-driven) for two polling requests, i.e. two intervals
  await page.waitForResponse(isQuotePoll(id), { timeout: POLL_MS + 30_000 });
  await page.waitForResponse(isQuotePoll(id), { timeout: POLL_MS + 30_000 });
  await expect(ui.banner(page)).toHaveCount(0);
  expect(errors.filter((e) => !/favicon/i.test(e))).toEqual([]);
});

test('TC-064 Following the banner link shows the current version @TC-064 @FR-07 @AC-012', async ({ page }) => {
  await signInViaApi(page, 'U-51');
  await page.goto(quoteKeyUrl('Q-MULTI', 1));
  await expect(ui.banner(page)).toBeVisible();
  await ui.bannerLink(page).click();
  await expectQuoteShows(page, 3, 'current');
  await expect(ui.banner(page)).toHaveCount(0);
});

test('TC-065 Banner shows on load for a superseded version @TC-065 @FR-07 @AC-012', async ({ page }) => {
  await signInViaApi(page, 'U-51');
  await page.goto(quoteKeyUrl('Q-MULTI', 1));
  await expect(ui.banner(page)).toBeVisible();
  await expect(ui.superseded(page)).toBeVisible();
});

test('TC-066 Revision between list load and open @TC-066 @FR-07 @AC-012', async ({ page }) => {
  await signInViaApi(page, 'U-51');
  await page.goto('/quotes?pageSize=100');
  await expect(ui.rows(page).first()).toBeVisible();
  const { reference } = (await import('../helpers/fixtures')).quote('Q-REV');
  const row = page.getByText(reference).first();
  await expect(row).toBeVisible();
  await reviseQuote('Q-REV');
  await row.click();
  await expectQuoteShows(page, 2, 'current');
  await expect(ui.banner(page)).toHaveCount(0);
});

test('TC-067 Network drop during polling @TC-067 @FR-07 @AC-012', async ({ page, context }) => {
  test.setTimeout(3 * POLL_MS + 120_000);
  await openRev(page);
  const id = quoteId('Q-REV');
  let failed = 0;
  page.on('requestfailed', (r) => quotePoll(id).test(new URL(r.url()).pathname) && failed++);
  await context.setOffline(true);
  await expect.poll(() => failed, { timeout: 2 * POLL_MS + 30_000, intervals: [1_000] }).toBeGreaterThanOrEqual(2);
  await expect(ui.banner(page)).toHaveCount(0);
  expect(await page.getByRole('alert').count(), 'no repeated error toasts').toBeLessThanOrEqual(1);
  await context.setOffline(false);
  await reviseQuote('Q-REV');
  await expect(ui.banner(page)).toBeVisible({ timeout: WITHIN }); // polling resumed online
});

test('TC-068 Banner is announced to screen readers @TC-068 @FR-07 @AC-012', async ({ page }) => {
  await signInViaApi(page, 'U-51');
  await page.goto(quotesUrl(quoteId('Q-MULTI'), 1));
  await expect(ui.bannerRegion(page)).toBeVisible();
  const live = await ui.bannerRegion(page).first().evaluate((el) => ({
    role: el.getAttribute('role'),
    live: el.closest('[aria-live]')?.getAttribute('aria-live') ?? el.getAttribute('aria-live'),
    hasFocus: el.contains(document.activeElement),
  }));
  expect(live.role).toBe('status');
  expect(live.live ?? 'polite').not.toBe('assertive');
  expect(live.hasFocus, 'banner must not steal focus').toBe(false);
});
