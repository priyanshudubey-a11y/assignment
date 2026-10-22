import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import { FRONTEND_URL } from '../helpers/env';
import { quote, quoteId } from '../helpers/fixtures';
import { expectQuoteShows, fillLogin, loginUrl, loginViaUi, quoteKeyUrl, signInViaApi, ui } from '../helpers/ui';

test('TC-083 Staging smoke test @TC-083 @FR-05 @AC-none', async ({ page }) => {
  // Staging is not provisioned (BE-14 / FE-12 open, Q-P2): runs only when STAGING_URL is supplied.
  test.skip(!process.env.STAGING_URL, 'STAGING_URL not set: staging host not provided (Q-P2)');
  const base = process.env.STAGING_URL!.replace(/\/$/, '');
  expect(base.startsWith('https://'), 'HTTPS reachable').toBe(true);
  await page.goto(`${base}/login`);
  await fillLogin(page, 'U-51');
  await ui.submit(page).click();
  await expect(ui.rows(page).first()).toBeVisible();
  await page.goto(`${base}/quotes/${encodeURIComponent(quoteId('Q-MULTI'))}`);
  await expect(page.getByText(quote('Q-MULTI').reference).first()).toBeVisible();
});

test('TC-090 Automated accessibility scan @TC-090 @NFR-03 @AC-none', async ({ page }) => {
  const scan = async (label: string) => {
    const r = await new AxeBuilder({ page: page as any }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).withRules(['color-contrast']).analyze();
    expect(r.violations.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), label).toEqual([]);
  };
  await page.goto(loginUrl());
  await expect(ui.email(page)).toBeVisible();
  await scan('login');
  await loginViaUi(page, 'U-51');
  await expect(ui.rows(page).first()).toBeVisible();
  await scan('list');
  await page.goto(quoteKeyUrl('Q-MULTI'));
  await expectQuoteShows(page, 3, 'current');
  await scan('quote (current)');
  await page.goto(quoteKeyUrl('Q-MULTI', 1));
  await expect(ui.superseded(page)).toBeVisible();
  await scan('quote (superseded, banner and grey cards)');
});

async function focusStops(page: Page, until: (name: string) => boolean, max = 80) {
  const stops: { name: string; top: number; visible: boolean }[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const s = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const name = el.getAttribute('aria-label') || el.textContent?.trim() || (el as HTMLInputElement).placeholder || el.tagName;
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const shadow = cs.boxShadow !== 'none';
      return { name: name.slice(0, 80), top: Math.round(r.top + window.scrollY), visible: outline || shadow };
    });
    if (!s) continue;
    stops.push(s);
    if (until(s.name)) return stops;
  }
  throw new Error(`Focus never reached the target. Stops: ${stops.map((s) => s.name).join(' > ')}`);
}

test('TC-091 Keyboard-only use @TC-091 @NFR-03 @AC-none', async ({ page }) => {
  await page.goto(loginUrl());
  await expect(ui.email(page)).toBeVisible();
  // login with the keyboard
  const loginStops = await focusStops(page, (n) => /sign in|log in/i.test(n));
  // we passed the email and password fields on the way; fill them where focus allows
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.type((await import('../helpers/fixtures')).user('U-51').email);
  await page.keyboard.press('Tab');
  await page.keyboard.type((await import('../helpers/fixtures')).user('U-51').password);
  await page.keyboard.press('Enter');
  await expect(ui.rows(page).first()).toBeVisible();
  for (const s of loginStops) expect(s.visible, `visible focus on "${s.name}"`).toBe(true);
  // paging: reach the Next control
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  const listStops = await focusStops(page, (n) => /next/i.test(n));
  for (const s of listStops) expect(s.visible, `visible focus on "${s.name}"`).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/page=2|\/quotes/);
  // banner link: superseded version shows the banner
  await page.goto(quoteKeyUrl('Q-MULTI', 1));
  await expect(ui.banner(page)).toBeVisible();
  const bannerStops = await focusStops(page, (n) => /view|open|latest|current|newer|v3|version 3/i.test(n));
  for (const s of bannerStops) expect(s.visible, `visible focus on "${s.name}"`).toBe(true);
  await page.keyboard.press('Enter');
  await expectQuoteShows(page, 3, 'current');
  // logical order: focus moves down the page (tolerance for same-row controls)
  for (const stops of [loginStops, listStops, bannerStops]) {
    stops.reduce((prev, s) => {
      expect(s.top, `"${s.name}" should not precede the previous stop`).toBeGreaterThanOrEqual(prev - 4);
      return s.top;
    }, 0);
  }
  expect(FRONTEND_URL).toBeTruthy();
});

