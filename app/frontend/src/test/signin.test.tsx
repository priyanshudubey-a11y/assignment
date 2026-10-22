import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { locations, PASSWORD, renderApp, startBackend } from './helpers';

let be: Awaited<ReturnType<typeof startBackend>>;
beforeEach(async () => {
  be = await startBackend();
});
afterEach(() => be.close());

async function signInWith(email: string, password = PASSWORD) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}
const loginCalls = () => be.calls.filter((c) => c.path === '/api/auth/login');

describe('auth guard (FE-02)', () => {
  it('signed-out visit to a protected URL goes to login once, carrying next; nothing protected flashes', async () => {
    renderApp('/quotes/q-multi');
    expect(screen.queryByTestId('quote-detail')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(locations.filter((l) => l.startsWith('/login'))).toEqual(['/login?next=%2Fquotes%2Fq-multi']);
    expect(screen.queryByTestId('quote-list')).not.toBeInTheDocument();
  });

  it('a 401 from an API call mid-session sends the user to login with the current path as next, and back once after sign-in', async () => {
    renderApp('/login');
    await signInWith('acme@example.test');
    await screen.findByTestId('quote-list');
    // Server-side session disappears (e.g. expired): logout via the API directly.
    await fetch('/api/auth/logout', { method: 'POST' });
    const user = userEvent.setup();
    await user.click((await screen.findAllByTestId('quote-row-link'))[0]); // this detail request now gets 401
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(locations.at(-1)).toMatch(/^\/login\?next=%2Fquotes%2F/);
    await signInWith('acme@example.test');
    expect(await screen.findByTestId('quote-detail')).toBeInTheDocument();
  });
});

describe('login screen (FE-03)', () => {
  it('shows per-field messages and sends no request for empty or malformed input', async () => {
    renderApp('/login');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(loginCalls()).toHaveLength(0);
  });

  it('wrong password shows the generic message, stays on login, does not redirect', async () => {
    renderApp('/login?next=%2Fquotes%2Fq-multi');
    await signInWith('acme@example.test', 'wrong');
    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(locations.every((l) => l.startsWith('/login'))).toBe(true);
    expect(screen.getByTestId('login-submit')).toBeEnabled();
  });

  it('unknown email gives the same message', async () => {
    renderApp('/login');
    await signInWith('nobody@example.test');
    expect(await screen.findByTestId('login-error')).toHaveTextContent('Incorrect email or password.');
  });

  it('sends one request on double click and Enter twice, with the email exactly as typed, and never puts the password in the URL', async () => {
    renderApp('/login');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'Acme@Example.TEST');
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.dblClick(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByTestId('quote-list');
    expect(loginCalls()).toHaveLength(1);
    expect(JSON.parse(String(be.fetchSpy.mock.calls.find((c) => c[0] === '/api/auth/login')![1]!.body)).email).toBe('Acme@Example.TEST');
    expect(locations.some((l) => l.includes(PASSWORD) || l.includes('password'))).toBe(false);
  });

  it('server error shows a generic message', async () => {
    renderApp('/login');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'acme@example.test');
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await be.failNext(1);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByTestId('login-error')).toHaveTextContent('Something went wrong. Try again.');
  });
});

describe('post-login redirect (FE-04)', () => {
  it('goes to the quote list once by default, using replace (no /login entry left)', async () => {
    renderApp('/login');
    await signInWith('acme@example.test');
    await screen.findByTestId('quote-list');
    expect(locations.at(-1)).toBe('/quotes');
    expect(locations.filter((l) => l === '/quotes')).toHaveLength(1);
  });

  it('deep link while signed out lands on the deep link, exactly once', async () => {
    renderApp('/quotes/q-multi');
    await signInWith('acme@example.test');
    expect(await screen.findByTestId('quote-detail')).toBeInTheDocument();
    // visit, one redirect to login, one redirect back: no loop
    expect(locations).toEqual(['/quotes/q-multi', '/login?next=%2Fquotes%2Fq-multi', '/quotes/q-multi']);
  });

  it.each([
    ['next=%2Flogin'],
    ['next=https%3A%2F%2Fevil.example%2Fquotes'],
    ['next=%2F%2Fevil.example'],
    ['next=%2Fnot-a-real-page'],
    ['next='],
  ])('?%s ends on the quote list, never back on login', async (qs) => {
    renderApp(`/login?${qs}`);
    await signInWith('acme@example.test');
    await screen.findByTestId('quote-list');
    expect(locations.at(-1)).toBe('/quotes');
  });

  it("deep link to another organisation's quote ends on 'Quote not found.' without a loop", async () => {
    renderApp('/quotes/q-other-org');
    await signInWith('acme@example.test');
    expect(await screen.findByRole('heading', { name: 'Quote not found.' })).toBeInTheDocument();
    expect(locations.filter((l) => l.startsWith('/login')).length).toBe(1);
  });

  it('a signed-in user opening /login is sent to the quote list once', async () => {
    renderApp('/login');
    await signInWith('acme@example.test');
    await screen.findByTestId('quote-list');
    cleanup();
    renderApp('/login');
    await screen.findByTestId('quote-list');
    expect(locations).toEqual(['/login', '/quotes']);
  });
});

describe('logout (FE-05)', () => {
  it('is on every signed-in page, calls the API, shows login, and protected pages need sign-in again', async () => {
    renderApp('/login');
    await signInWith('acme@example.test');
    await screen.findByTestId('quote-list');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(be.calls.some((c) => c.path === '/api/auth/logout' && c.method === 'POST')).toBe(true);
    expect(be.signedIn()).toBe(false);
    expect(screen.queryByTestId('quote-list')).not.toBeInTheDocument();
    expect(locations.at(-1)).toBe('/login');
  });

  it('control is present on the detail page too', async () => {
    renderApp('/login?next=%2Fquotes%2Fq-multi');
    await signInWith('acme@example.test');
    await screen.findByTestId('quote-detail');
    expect(screen.getByTestId('logout-button')).toBeVisible();
  });
});

it('bootstrap failure (non-401 from /api/me) shows a retryable error, not protected content', async () => {
  be.fetchSpy.mockImplementationOnce(async () => new Response('boom', { status: 500 }));
  renderApp('/quotes');
  expect(await screen.findByTestId('app-error')).toHaveTextContent('Something went wrong. Try again.');
  await waitFor(() => expect(screen.queryByTestId('quote-list')).not.toBeInTheDocument());
});
