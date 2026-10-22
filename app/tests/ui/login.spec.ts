import { expect, test } from '@playwright/test';
import { quote, quoteId } from '../helpers/fixtures';
import {
  T, expectNoLeak, fillLogin, isListUrl, isLoginUrl, loginUrl, quotesUrl, sessionCookie,
  signInViaApi, trackNavigations, trackRequests, ui,
} from '../helpers/ui';

test('TC-001 Valid login lands on the quote list once @TC-001 @FR-02 @AC-001', async ({ page }) => {
  await page.goto(loginUrl());
  await fillLogin(page, 'U-51');
  const navs = trackNavigations(page);
  await ui.submit(page).click();
  await page.waitForURL((u) => !isLoginUrl(u.toString()));
  await expect(ui.rows(page).first()).toBeVisible();
  expect(isListUrl(page.url())).toBe(true);
  expect(new Set(navs).size, `navigations after submit: ${navs.join(' -> ')}`).toBe(1);
  expect(await sessionCookie(page)).toBeTruthy();
});

test('TC-003 Double submit completes one login @TC-003 @FR-02 @AC-001', async ({ page }) => {
  await page.goto(loginUrl());
  await fillLogin(page, 'U-51');
  const posts = trackRequests(page, /\/api\/auth\/login/);
  const navs = trackNavigations(page);
  await ui.submit(page).dblclick();
  await ui.password(page).press('Enter').catch(() => undefined); // form may already be gone
  await expect(ui.rows(page).first()).toBeVisible();
  expect(posts.filter((p) => p.startsWith('POST'))).toHaveLength(1);
  expect(navs.filter((u) => isListUrl(u))).toHaveLength(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(isListUrl(page.url())).toBe(true);
});

test('TC-004 Wrong password stays on login @TC-004 @FR-02 @AC-002', async ({ page }) => {
  await page.goto(loginUrl());
  await fillLogin(page, 'U-51', 'not-the-password');
  const navs = trackNavigations(page);
  await ui.submit(page).click();
  await expect(page.getByText(T.incorrect)).toBeVisible();
  expect(isLoginUrl(page.url())).toBe(true);
  expect(await sessionCookie(page)).toBeUndefined();
  expect(navs.filter((u) => !isLoginUrl(u))).toHaveLength(0);
});

// pending-decision: Q-P5 (inline messages, no API request)
test('TC-006 Empty fields are refused @TC-006 @FR-02 @AC-002 @pending-decision', async ({ page }) => {
  await page.goto(loginUrl());
  const posts = trackRequests(page, /\/api\/auth\/login/);
  await ui.submit(page).click();
  await expect(page.getByText(T.needEmail)).toBeVisible();
  await expect(page.getByText(T.needPassword)).toBeVisible();
  await ui.email(page).fill('someone@example.test');
  await ui.submit(page).click();
  await expect(page.getByText(T.needPassword)).toBeVisible();
  expect(isLoginUrl(page.url())).toBe(true);
  expect(posts).toHaveLength(0);
});

// pending-decision: Q-P5 (malformed email -> "Enter a valid email.", no request)
test('TC-007 Malformed email is refused @TC-007 @FR-02 @AC-002 @pending-decision', async ({ page }) => {
  await page.goto(loginUrl());
  const posts = trackRequests(page, /\/api\/auth\/login/);
  await ui.email(page).fill('not-an-email');
  await ui.password(page).fill('whatever1');
  await ui.submit(page).click();
  await expect(page.getByText(T.needEmail)).toBeVisible();
  expect(isLoginUrl(page.url())).toBe(true);
  expect(posts).toHaveLength(0);
  expect(await sessionCookie(page)).toBeUndefined();
});

test('TC-009 Deep link then login has no redirect loop @TC-009 @FR-02 @AC-003 @regression', async ({ page }) => {
  const navs = trackNavigations(page);
  await page.goto(quotesUrl(quoteId('Q-MULTI')));
  await expect(ui.email(page)).toBeVisible();
  expect(isLoginUrl(page.url())).toBe(true);
  expect(navs.filter((u) => isLoginUrl(u)).length, `to login once: ${navs.join(' -> ')}`).toBe(1);
  const afterLoginPage = navs.length;
  await fillLogin(page, 'U-51');
  await ui.submit(page).click();
  await expect(page).toHaveURL(new RegExp(`/quotes/${encodeURIComponent(quoteId('Q-MULTI'))}`));
  await expect(page.getByText(quote('Q-MULTI').reference).first()).toBeVisible();
  const after = navs.slice(afterLoginPage);
  expect(after.length, `redirects after submit: ${after.join(' -> ')}`).toBeLessThanOrEqual(1);
  expect(after.filter((u) => isLoginUrl(u))).toHaveLength(0);
});

test('TC-010 External redirect target is ignored @TC-010 @FR-02 @AC-003', async ({ page }) => {
  const external: string[] = [];
  await page.route(/evil\.example/, (route) => {
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto(loginUrl('https://evil.example'));
  await fillLogin(page, 'U-51');
  await ui.submit(page).click();
  await expect(ui.rows(page).first()).toBeVisible();
  expect(isListUrl(page.url())).toBe(true);
  expect(new URL(page.url()).hostname).not.toContain('evil');
  expect(external).toHaveLength(0);
});

test('TC-011 Redirect target /login causes no loop @TC-011 @FR-02 @AC-003 @regression', async ({ page }) => {
  await page.goto(loginUrl('/login'));
  await fillLogin(page, 'U-51');
  const navs = trackNavigations(page);
  await ui.submit(page).click();
  await expect(ui.rows(page).first()).toBeVisible();
  expect(isListUrl(page.url())).toBe(true);
  expect(navs.filter((u) => isLoginUrl(u))).toHaveLength(0);
});

test("TC-012 Deep link to another organisation's quote after login @TC-012 @FR-02 @FR-04 @AC-003", async ({ page }) => {
  const navs = trackNavigations(page);
  await page.goto(quotesUrl(quoteId('Q-B1')));
  await expect(ui.email(page)).toBeVisible();
  const n = navs.length;
  await fillLogin(page, 'U-51');
  await ui.submit(page).click();
  await expect(page.getByText(T.notFound)).toBeVisible();
  expect(navs.slice(n).filter((u) => isLoginUrl(u))).toHaveLength(0);
  await expectNoLeak(page, quote('Q-B1').reference, quote('Q-B1').title);
});

// pending-decision: Q-P5 (signed-in user at /login -> quote list)
test('TC-013 Signed-in user opening the login page @TC-013 @FR-02 @AC-001 @pending-decision', async ({ page }) => {
  await signInViaApi(page, 'U-51');
  const navs = trackNavigations(page);
  await page.goto(loginUrl());
  await expect(ui.rows(page).first()).toBeVisible();
  expect(isListUrl(page.url())).toBe(true);
  expect(navs.filter((u) => isLoginUrl(u)).length).toBeLessThanOrEqual(1);
  expect(navs.filter((u) => isListUrl(u))).toHaveLength(1);
});
