import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { locations, PASSWORD, renderApp, startBackend } from './helpers';

let be: Awaited<ReturnType<typeof startBackend>>;
beforeEach(async () => {
  be = await startBackend();
});
afterEach(() => be.close());

async function open(path: string, email = 'acme@example.test') {
  renderApp(`/login?next=${encodeURIComponent(path)}`);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

describe('quote detail (FE-07)', () => {
  it('shows reference, title, version with a Current label, line items and total with 2 decimals', async () => {
    await open('/quotes/q-multi');
    await screen.findByTestId('quote-detail');
    expect(screen.getByTestId('quote-reference')).toHaveTextContent('QT-1001');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Website rebuild');
    expect(screen.getByTestId('version-number')).toHaveTextContent('Version 2');
    expect(screen.getByTestId('version-label')).toHaveTextContent('Current');
    const rows = screen.getAllByTestId('line-item');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Consulting day');
    expect(rows[0]).toHaveTextContent('USD 120.00');
    expect(rows[0]).toHaveTextContent('USD 360.00');
    expect(screen.getByTestId('version-total')).toHaveTextContent('USD 360.00');
    expect(screen.queryByTestId('newer-version-banner')).not.toBeInTheDocument();
    expect(locations.at(-1)).toBe('/quotes/q-multi');
  });

  it('a quote with no line items renders "No line items." and no error', async () => {
    await open('/quotes/q-noitems');
    expect(await screen.findByTestId('no-line-items')).toHaveTextContent('No line items.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('version-total')).toHaveTextContent('USD 0.00');
  });

  it('shows loading and never flashes "Quote not found." while loading', async () => {
    await open('/quotes/q-multi');
    expect(await screen.findByTestId('detail-loading')).toBeInTheDocument();
    expect(screen.queryByText('Quote not found.')).not.toBeInTheDocument();
    await screen.findByTestId('quote-detail');
  });

  it.each([['/quotes/does-not-exist'], ['/quotes/q-other-org'], ['/quotes/q-multi/versions/9'], ['/quotes/q-multi/versions/abc']])(
    '%s shows the same "Quote not found." with a link back',
    async (path) => {
      // `next` whitelist rejects abc, so navigate there after sign-in
      await open('/quotes');
      await screen.findByTestId('quote-list');
      const { unmount } = renderApp(path);
      expect(await screen.findByRole('heading', { name: 'Quote not found.' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to quotes' })).toHaveAttribute('href', '/quotes');
      expect(screen.getByTestId('not-found').textContent).toBe('Quote not found.Back to quotes');
      unmount();
    },
  );

  it('a failed request shows a retryable error without raw details; Retry works after recovery', async () => {
    const user = await open('/quotes');
    await screen.findByTestId('quote-list');
    await be.failNext(1);
    await user.click(screen.getAllByTestId('quote-row-link')[0]);
    const err = await screen.findByTestId('detail-error');
    expect(err).toHaveTextContent('Could not load this quote. Try again.');
    expect(err.textContent).not.toMatch(/stack|sql|INTERNAL|Error:/i);
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('quote-detail')).toBeInTheDocument();
  });
});

describe('version navigation and superseded view (FE-08)', () => {
  it('lists versions and opens a superseded version read-only with the banner on load and a link to current', async () => {
    const user = await open('/quotes/q-multi');
    await screen.findByTestId('quote-detail');
    expect(screen.getAllByTestId('version-link').map((l) => l.textContent)).toEqual(['Version 2', 'Version 1']);
    await user.click(screen.getByRole('link', { name: 'Version 1' }));
    await screen.findByText('Version 1', { selector: '[data-testid="version-number"]' });
    expect(screen.getByTestId('version-label')).toHaveTextContent('Superseded');
    expect(screen.getByTestId('newer-version-banner')).toHaveTextContent('A newer version of this quote is available.');
    expect(screen.getByTestId('superseded-note')).toHaveTextContent('read-only');
    expect(screen.getByTestId('current-version-link')).toHaveAttribute('href', '/quotes/q-multi/versions/2');
    expect(screen.getAllByTestId('line-item')[0]).toHaveTextContent('USD 100.01'); // v1 data, not v2
    await user.click(screen.getByTestId('newer-version-link'));
    await screen.findByText('Version 2', { selector: '[data-testid="version-number"]' });
    expect(screen.getByTestId('version-label')).toHaveTextContent('Current');
    expect(screen.queryByTestId('newer-version-banner')).not.toBeInTheDocument();
  });
});
