import { expect, test } from '@playwright/test';
import { getQuoteDetail, money } from '../helpers/api';
import { BAD_IDS } from '../helpers/env';
import { quote, quoteId } from '../helpers/fixtures';
import { APP_STACK, T, expectNoLeak, expectQuoteShows, loginViaUi, quoteKeyUrl, quotesUrl, signInViaApi, ui, versionText } from '../helpers/ui';

const bodyText = async (page: import('@playwright/test').Page) => (await page.locator('body').innerText()).replace(/,/g, '');

test('TC-040 Current version is shown and labelled @TC-040 @FR-01 @AC-007', async ({ page }) => {
  await signInViaApi(page, 'U-51');
  const d = await getQuoteDetail('U-51', 'Q-MULTI');
  await page.goto(quoteKeyUrl('Q-MULTI'));
  await expectQuoteShows(page, 3, 'current');
  await expect(page.getByText(quote('Q-MULTI').reference).first()).toBeVisible();
  await expect(page.getByText(d.quote.title).first()).toBeVisible();
  for (const li of d.currentVersion.lineItems) await expect(page.getByText(li.description).first()).toBeVisible();
  expect(await bodyText(page)).toContain(money(d.currentVersion.total));
});

test('TC-041 Single-version quote has no banner @TC-041 @FR-01 @AC-007', async ({ page }) => {
  await signInViaApi(page, 'U-51');
  await page.goto(quoteKeyUrl('Q-REV'));
  await expectQuoteShows(page, 1, 'current');
  await expect(ui.banner(page)).toHaveCount(0);
});

test('TC-042 Superseded version is labelled and read-only @TC-042 @FR-01 @FR-07 @AC-007', async ({ page }) => {
  await signInViaApi(page, 'U-51');
  await page.goto(quoteKeyUrl('Q-MULTI', 1));
  await expect(ui.superseded(page)).toBeVisible();
  await expect(page.getByText(versionText(1)).first()).toBeVisible();
  await expect(page.locator('main input:not([type=hidden]), main textarea, main select')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /edit|save|update|delete/i })).toHaveCount(0);
  const link = page.locator(`a[href*="/quotes/${encodeURIComponent(quoteId('Q-MULTI'))}"]`).filter({ hasText: /current|latest|newer|v3|version 3|view/i }).first();
  await expect(link).toBeVisible();
  await link.click();
  await expectQuoteShows(page, 3, 'current');
});

// pending-decision: Q-P5 ("No line items." and 0.00)
test('TC-044 Quote with no line items renders @TC-044 @FR-01 @AC-007 @pending-decision', async ({ page }) => {
  await signInViaApi(page, 'U-51');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(quoteKeyUrl('Q-NOLINES'));
  await expect(page.getByText(quote('Q-NOLINES').reference).first()).toBeVisible();
  await expect(page.getByText(T.noLines)).toBeVisible();
  expect(await bodyText(page)).toContain('0.00');
  expect(errors).toEqual([]);
});

test('TC-046 Data-source failure shows a retryable error @TC-046 @FR-01 @AC-008', async ({ page }) => {
  await signInViaApi(page, 'U-51');
  const id = quoteId('Q-MULTI');
  let fail = true;
  await page.route(new RegExp(`/api/quotes/${encodeURIComponent(id)}(/versions/\\d+)?$`), (route) =>
    fail ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.' }) }) : route.continue());
  await page.goto(quotesUrl(id));
  await expect(ui.retry(page)).toBeVisible();
  await expect(page.getByText(T.notFound)).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toMatch(APP_STACK);
  fail = false;
  await ui.retry(page).click();
  await expectQuoteShows(page, 3, 'current');
});

test('TC-047 Slow response shows loading, never a false not-found @TC-047 @FR-01 @AC-008', async ({ page }) => {
  await signInViaApi(page, 'U-51');
  const id = quoteId('Q-MULTI');
  await page.addInitScript(() => {
    (window as any).__sawNotFound = false;
    new MutationObserver(() => {
      if (document.body && /Quote not found\./.test(document.body.innerText)) (window as any).__sawNotFound = true;
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await page.route(new RegExp(`/api/quotes/${encodeURIComponent(id)}(/versions/\\d+)?$`), async (route) => {
    await new Promise((r) => setTimeout(r, 3000)); // injected 3 s latency (test double, not a wait in the test)
    await route.continue();
  });
  await page.goto(quotesUrl(id));
  await expect(ui.loading(page)).toBeVisible();
  await expectQuoteShows(page, 3, 'current');
  expect(await page.evaluate(() => (window as any).__sawNotFound)).toBe(false);
});

test('TC-048 Invalid quote id shows not found @TC-048 @FR-01 @AC-007', async ({ page }) => {
  await signInViaApi(page, 'U-51');
  for (const bad of BAD_IDS) {
    await page.goto(`/quotes/${encodeURIComponent(bad)}`);
    await expect(page.getByText(T.notFound), `id ${bad}`).toBeVisible();
    await expectNoLeak(page);
  }
});
