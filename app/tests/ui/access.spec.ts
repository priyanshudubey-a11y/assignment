import { expect, test } from '@playwright/test';
import { quote, quoteId } from '../helpers/fixtures';
import { expectNoLeak, fillLogin, isLoginUrl, loginUrl, loginViaUi, quotesUrl, trackNavigations, ui } from '../helpers/ui';

test('TC-014 Logout ends the session @TC-014 @FR-06 @AC-none', async ({ page }) => {
  await loginViaUi(page, 'U-51');
  await ui.logout(page).click();
  await expect(page).toHaveURL(/\/login/);
  const me = await page.context().request.get('/api/me', { failOnStatusCode: false });
  expect(me.status()).toBe(401);
});

test('TC-015 Back button after logout shows no data @TC-015 @FR-06 @AC-none', async ({ page }) => {
  await loginViaUi(page, 'U-51');
  await page.goto(quotesUrl(quoteId('Q-MULTI')));
  await expect(page.getByText(quote('Q-MULTI').reference).first()).toBeVisible();
  await ui.logout(page).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goBack();
  await page.waitForLoadState('networkidle');
  const onLogin = isLoginUrl(page.url());
  if (!onLogin) await expectNoLeak(page, quote('Q-MULTI').reference);
  await expect(page.getByText(quote('Q-MULTI').reference)).toHaveCount(0);
  for (const p of ['/api/quotes', `/api/quotes/${quoteId('Q-MULTI')}`]) {
    expect((await page.context().request.get(p, { failOnStatusCode: false })).status()).toBe(401);
  }
});

test('TC-017 Invalid session sends user to login with return path @TC-017 @FR-01 @FR-02 @AC-008', async ({ page }) => {
  await loginViaUi(page, 'U-51', loginUrl(quotesUrl(quoteId('Q-MULTI'))));
  await expect(page.getByText(quote('Q-MULTI').reference).first()).toBeVisible();
  // "Delete cookie server-side": the browser's session cookie no longer maps to a session.
  await page.context().clearCookies();
  // The page notices on its next API call: simulate the refocus that triggers one.
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page).toHaveURL(/\/login/, { timeout: 75_000 });
  expect(decodeURIComponent(page.url())).toContain(`/quotes/${quoteId('Q-MULTI')}`);
  const navs = trackNavigations(page);
  await fillLogin(page, 'U-51');
  await ui.submit(page).click();
  await expect(page).toHaveURL(new RegExp(`/quotes/${encodeURIComponent(quoteId('Q-MULTI'))}`));
  expect(navs.length).toBeLessThanOrEqual(1);
});
