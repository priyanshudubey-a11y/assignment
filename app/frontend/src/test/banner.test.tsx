import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { App } from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { POLL_INTERVAL_MS } from '../config';

// Scripted backend so time and failures are fully controlled (the banner logic is time based).
let latest = 2;
let failPolls = false;
let quoteCalls = 0;
const user = { id: 'u1', email: 'a@b.test', role: 'customer', organisation: { id: 'o1', name: 'Org' } };
const ver = (n: number, current: boolean) => ({
  versionNo: n, isCurrent: current, issuedAt: '2026-01-01T00:00:00.000Z', supersededAt: current ? null : '2026-01-02T00:00:00.000Z',
  currency: 'USD', total: n * 100, validUntil: null, lineItems: [{ id: `l${n}`, description: `Item v${n}`, qty: 1, unitPrice: n * 100, lineTotal: n * 100 }],
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const summary = () => ({ id: 'q1', reference: 'QT-1', title: 'T', status: 'Sent', currentVersionNo: latest, currency: 'USD', total: latest * 100, issuedAt: '2026-01-01T00:00:00.000Z' });

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === '/api/me') return json({ user });
    if (path === '/api/quotes/q1') {
      quoteCalls += 1;
      if (failPolls && quoteCalls > 1) throw new TypeError('offline');
      const versions = Array.from({ length: latest }, (_, i) => latest - i).map((n) => ver(n, n === latest));
      return json({ quote: summary(), currentVersion: ver(latest, true), currentVersionNo: latest, versions: versions.map(({ lineItems: _l, validUntil: _v, ...v }) => v) });
    }
    const m = /^\/api\/quotes\/q1\/versions\/(\d+)$/.exec(path);
    if (m) return json({ version: ver(Number(m[1]), Number(m[1]) === latest), isCurrent: Number(m[1]) === latest, superseded: Number(m[1]) !== latest, currentVersionNo: latest });
    return json({ code: 'NOT_FOUND', message: 'x' }, 404);
  }));
}

function mount(path = '/quotes/q1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  latest = 2;
  failPolls = false;
  quoteCalls = 0;
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  stubFetch();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('newer-version banner (FE-09)', () => {
  it('the polling interval is the single 60 s constant', () => {
    expect(POLL_INTERVAL_MS).toBe(60_000);
  });

  it('no banner when nothing changed over two intervals, and the page does not flicker', async () => {
    mount();
    await screen.findByTestId('quote-detail');
    await tick(POLL_INTERVAL_MS * 2);
    expect(quoteCalls).toBe(3); // initial + 2 polls
    expect(screen.queryByTestId('newer-version-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('version-label')).toHaveTextContent('Current');
  });

  it('shows the banner within one interval after a revision; keeps the viewed version; links to the latest (v3 after two revisions)', async () => {
    mount();
    await screen.findByTestId('quote-detail');
    latest = 4; // two revisions (v2 -> v4 here to prove it links to the latest, whatever it is)
    await tick(POLL_INTERVAL_MS - 1);
    expect(screen.queryByTestId('newer-version-banner')).not.toBeInTheDocument();
    await tick(1);
    const banner = screen.getByTestId('newer-version-banner');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveTextContent('A newer version of this quote is available.');
    expect(screen.getByTestId('newer-version-link')).toHaveAttribute('href', '/quotes/q1/versions/4');
    expect(screen.getByTestId('version-number')).toHaveTextContent('Version 2'); // still on screen
    expect(screen.getByText('Item v2')).toBeInTheDocument();
    expect(screen.getByTestId('version-label')).toHaveTextContent('Superseded');
  });

  it('refocus triggers an immediate re-read', async () => {
    mount();
    await screen.findByTestId('quote-detail');
    latest = 3;
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(await screen.findByTestId('newer-version-banner')).toBeInTheDocument();
    expect(quoteCalls).toBe(2);
  });

  it('becoming visible again also triggers a re-read', async () => {
    mount();
    await screen.findByTestId('quote-detail');
    latest = 3;
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(await screen.findByTestId('newer-version-banner')).toBeInTheDocument();
  });

  it('a failed poll shows no banner and no error, and polling resumes when the network returns', async () => {
    mount();
    await screen.findByTestId('quote-detail');
    failPolls = true;
    latest = 3;
    await tick(POLL_INTERVAL_MS * 3);
    expect(screen.queryByTestId('newer-version-banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('quote-detail')).toBeInTheDocument();
    failPolls = false;
    await tick(POLL_INTERVAL_MS);
    expect(screen.getByTestId('newer-version-banner')).toBeInTheDocument();
  });

  it('opening the latest version removes the banner', async () => {
    mount();
    await screen.findByTestId('quote-detail');
    latest = 3;
    await tick(POLL_INTERVAL_MS);
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) }).click(screen.getByTestId('newer-version-link'));
    await screen.findByText('Version 3', { selector: '[data-testid="version-number"]' });
    expect(screen.queryByTestId('newer-version-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('version-label')).toHaveTextContent('Current');
  });

  it('polling stops when the user leaves the quote page', async () => {
    const { unmount } = mount();
    await screen.findByTestId('quote-detail');
    unmount();
    const before = quoteCalls;
    await tick(POLL_INTERVAL_MS * 3);
    window.dispatchEvent(new Event('focus'));
    expect(quoteCalls).toBe(before);
  });

  it('opening a superseded version directly shows the banner on load', async () => {
    mount('/quotes/q1/versions/1');
    expect(await screen.findByTestId('newer-version-banner')).toBeInTheDocument();
    expect(screen.getByTestId('version-label')).toHaveTextContent('Superseded');
  });
});
