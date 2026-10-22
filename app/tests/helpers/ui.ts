import { expect, Locator, Page } from '@playwright/test';
import { FRONTEND_URL, SESSION_COOKIE } from './env';
import { quoteId, user } from './fixtures';

// All UI selectors live here so Session 5 can adjust them in one place once the real markup exists.
// Locators prefer accessible names, then data-testid hooks, then plain text (no fixed sleeps anywhere).
// ASSUMED routes: /login[?next=], /quotes (list), /quotes/:id, /quotes/:id/versions/:n.

export const T = {
  incorrect: 'Incorrect email or password.',
  needEmail: 'Enter a valid email.',
  needPassword: 'Enter your password.',
  notFound: 'Quote not found.',
  listError: 'Could not load quotes. Try again.',
  noLines: /no line items/i,
  banner: /newer version available/i,
};

export const ui = {
  email: (p: Page) => p.getByLabel(/email/i),
  password: (p: Page) => p.getByLabel(/password/i),
  submit: (p: Page) => p.getByRole('button', { name: /sign in|log in/i }),
  logout: (p: Page) => p.getByRole('button', { name: /log ?out|sign ?out/i }).or(p.getByRole('link', { name: /log ?out|sign ?out/i })),
  rows: (p: Page) => p.getByTestId('quote-row').or(p.locator('table tbody tr')),
  retry: (p: Page) => p.getByRole('button', { name: /retry|try again/i }),
  nextPage: (p: Page) => p.getByRole('button', { name: /next/i }).or(p.getByRole('link', { name: /next/i })),
  banner: (p: Page) => p.getByText(T.banner),
  bannerRegion: (p: Page) => p.getByRole('status').filter({ hasText: T.banner }),
  bannerLink: (p: Page) => p.getByRole('link', { name: /view|open|latest|current|newer|v\d/i }).filter({ hasNot: p.getByRole('row') }).last(),
  current: (p: Page) => p.getByText(/\bcurrent\b/i).first(),
  superseded: (p: Page) => p.getByText(/superseded/i).first(),
  loading: (p: Page) => p.getByRole('progressbar').or(p.getByText(/loading/i)).first(),
};

export const loginUrl = (next?: string) => `/login${next !== undefined ? `?next=${encodeURIComponent(next)}` : ''}`;
export const quotesUrl = (id: string, versionNo?: number) => `/quotes/${encodeURIComponent(id)}${versionNo ? `/versions/${versionNo}` : ''}`;
export const quoteKeyUrl = (key: string, versionNo?: number) => quotesUrl(quoteId(key), versionNo);

export const isLoginUrl = (url: string) => new URL(url).pathname.replace(/\/$/, '') === '/login';
export const isListUrl = (url: string) => /^\/quotes\/?$/.test(new URL(url).pathname) || new URL(url).pathname === '/';

/** Records main-frame navigations (full loads and history changes) from now on. */
export function trackNavigations(page: Page) {
  const urls: string[] = [];
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) urls.push(f.url());
  });
  return urls;
}

/** Counts requests matching a path pattern. */
export function trackRequests(page: Page, pattern: RegExp) {
  const seen: string[] = [];
  page.on('request', (r) => {
    if (pattern.test(new URL(r.url()).pathname + new URL(r.url()).search)) seen.push(`${r.method()} ${r.url()}`);
  });
  return seen;
}

export async function fillLogin(page: Page, userKey: string, passwordOverride?: string) {
  const u = user(userKey);
  await ui.email(page).fill(u.email);
  await ui.password(page).fill(passwordOverride ?? u.password);
}

/** Signs in through the form. Optionally start from a deep link or a next param. */
export async function loginViaUi(page: Page, userKey: string, start: string = loginUrl()) {
  await page.goto(start);
  await expect(ui.email(page)).toBeVisible();
  await fillLogin(page, userKey);
  await ui.submit(page).click();
  await expect(page).not.toHaveURL(/\/login(\?|$)/);
}

/** Signs in with the API through the browser context (cookie lands in the browser). Not the login page under test. */
export async function signInViaApi(page: Page, userKey: string) {
  const u = user(userKey);
  const res = await page.context().request.post(`${FRONTEND_URL}/api/auth/login`, { data: { email: u.email, password: u.password } });
  expect(res.status(), `API sign-in as ${userKey}`).toBe(200);
}

export async function sessionCookie(page: Page) {
  return (await page.context().cookies()).find((c) => c.name === SESSION_COOKIE);
}

/** Collects console errors and uncaught page errors. */
export function trackErrors(page: Page) {
  const errs: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push(String(e)));
  return errs;
}

export const APP_STACK = /\bat\s+[\w$.<>]+\s*\(.*:\d+:\d+\)|SQLITE_|SqliteError|syntax error|stack trace/i;

export async function expectNoLeak(page: Page, ...needles: (string | undefined)[]) {
  const body = (await page.locator('body').innerText()).replace(/,/g, '');
  for (const n of needles) if (n) expect(body).not.toContain(n);
  expect(body).not.toMatch(APP_STACK);
}

export function versionText(n: number) {
  return new RegExp(`(version\\s*${n}\\b|\\bv${n}\\b)`, 'i');
}

export async function expectQuoteShows(page: Page, versionNo: number, label: 'current' | 'superseded') {
  await expect(page.getByText(versionText(versionNo)).first()).toBeVisible();
  await expect((label === 'current' ? ui.current(page) : ui.superseded(page))).toBeVisible();
}

export type { Locator };
