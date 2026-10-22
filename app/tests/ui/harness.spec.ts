import { expect, test } from '@playwright/test';
import { loginUrl, ui } from '../helpers/ui';

// QA-01 harness check (not a test case).
test('harness: frontend serves the login page @harness', async ({ page }) => {
  await page.goto(loginUrl());
  await expect(ui.email(page)).toBeVisible();
});
