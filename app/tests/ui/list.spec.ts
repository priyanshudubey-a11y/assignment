import { expect, test } from '@playwright/test';
import { json, loginAs } from '../helpers/api';
import { APP_STACK, T, loginViaUi, ui } from '../helpers/ui';

// pending-decision: Q-P5 (totalPages 0 for an empty list)
test('TC-020 Zero quotes shows the empty state @TC-020 @FR-03 @AC-006 @pending-decision', async ({ page }) => {
  await loginViaUi(page, 'U-0');
  await expect(page.getByText(/no quotes|nothing here|don'?t have any quotes/i).first()).toBeVisible();
  await expect(page.getByText(T.listError)).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  const body = await json(await (await loginAs('U-0')).get('/api/quotes'));
  expect(body.items).toEqual([]);
  expect(body.total).toBe(0);
  expect(body.totalPages).toBe(0);
});

test('TC-021 Exactly one quote @TC-021 @FR-03 @AC-005', async ({ page }) => {
  await loginViaUi(page, 'U-1');
  await expect(ui.rows(page)).toHaveCount(1);
  const body = await json(await (await loginAs('U-1')).get('/api/quotes'));
  expect(body.total).toBe(1);
  expect(body.totalPages).toBe(1);
  const next = ui.nextPage(page);
  if ((await next.count()) > 0) await expect(next.first()).toBeDisabled();
});

test('TC-032 List error state is not an empty state @TC-032 @FR-03 @AC-none', async ({ page }) => {
  await loginViaUi(page, 'U-51');
  let fail = true;
  await page.route(/\/api\/quotes(\?.*)?$/, (route) => (fail ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.' }) }) : route.continue()));
  await page.reload();
  await expect(page.getByText(T.listError)).toBeVisible();
  await expect(ui.retry(page)).toBeVisible();
  await expect(page.getByText(/no quotes/i)).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toMatch(APP_STACK);
  fail = false; // recovery
  await ui.retry(page).click();
  await expect(ui.rows(page).first()).toBeVisible();
  await expect(page.getByText(T.listError)).toHaveCount(0);
});
