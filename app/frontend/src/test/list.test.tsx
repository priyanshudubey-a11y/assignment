import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { locations, PASSWORD, renderApp, startBackend } from './helpers';

let be: Awaited<ReturnType<typeof startBackend>>;
beforeEach(async () => {
  be = await startBackend();
});
afterEach(() => be.close());

async function login(email: string, next = '/quotes') {
  const r = renderApp(`/login?next=${encodeURIComponent(next)}`);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return { user, ...r };
}
const rowIds = () => screen.getAllByTestId('quote-row').map((r) => r.getAttribute('data-quote-id')!);

describe('quote list (FE-06)', () => {
  it('shows columns, formatted total, version and 20 rows on page 1 of 3', async () => {
    await login('acme@example.test');
    await screen.findByTestId('quote-list');
    expect(screen.getAllByTestId('quote-row')).toHaveLength(20);
    expect(screen.getByTestId('page-indicator')).toHaveTextContent('Page 1 of 3');
    for (const h of ['Reference', 'Title', 'Status', 'Version', 'Total', 'Issued']) {
      expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    }
    expect(screen.getByTestId('page-prev')).toBeDisabled();
    expect(screen.getAllByTestId('quote-row')[0]).toHaveTextContent(/USD \d{1,3}(,\d{3})*\.\d{2}/);
  });

  it('walking every page shows each of the 51 quotes exactly once, and the page is in the URL', async () => {
    const { user } = await login('acme@example.test');
    await screen.findByTestId('quote-list');
    const seen: string[] = [...rowIds()];
    await user.click(screen.getByTestId('page-next'));
    await screen.findByText('Page 2 of 3');
    expect(locations.at(-1)).toBe('/quotes?page=2');
    seen.push(...rowIds());
    await user.click(screen.getByTestId('page-next'));
    await screen.findByText('Page 3 of 3');
    seen.push(...rowIds());
    expect(screen.getAllByTestId('quote-row')).toHaveLength(11);
    expect(screen.getByTestId('page-next')).toBeDisabled();
    expect(seen).toHaveLength(51);
    expect(new Set(seen).size).toBe(51);
    await user.click(screen.getByTestId('page-prev'));
    await screen.findByText('Page 2 of 3');
  });

  it('reload on ?page=2 keeps the position', async () => {
    await login('acme@example.test', '/quotes?page=2');
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('a page beyond the last goes to the last page', async () => {
    await login('acme@example.test', '/quotes?page=99');
    // resolveNext keeps valid page numbers, so the list itself must correct it
    expect(await screen.findByText('Page 3 of 3')).toBeInTheDocument();
    expect(locations.at(-1)).toBe('/quotes?page=3');
  });

  it('a malformed page parameter is treated as page 1', async () => {
    const { unmount } = await login('acme@example.test');
    await screen.findByTestId('quote-list');
    unmount();
    renderApp('/quotes?page=abc');
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    expect(locations.at(-1)).toBe('/quotes');
  });

  it('zero quotes shows the empty state, not an error, and no pagination', async () => {
    await login('empty@example.test');
    expect(await screen.findByTestId('list-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('list-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
  });

  it('a single page hides pagination', async () => {
    await login('other@example.test');
    expect(await screen.findAllByTestId('quote-row')).toHaveLength(1);
    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
  });

  it('shows a loading state, then a retryable error that is never an empty list', async () => {
    const { user } = await login('acme@example.test');
    await screen.findByTestId('quote-list');
    await be.failNext(1);
    await user.click(screen.getByTestId('page-next'));
    expect(await screen.findByTestId('list-error')).toHaveTextContent('Could not load quotes. Try again.');
    expect(screen.queryByTestId('list-empty')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByTestId('quote-list');
    expect(screen.getByTestId('page-indicator')).toHaveTextContent('Page 2 of 3');
  });

  it('shows the loading state while the request runs', async () => {
    await login('acme@example.test');
    expect(await screen.findByTestId('list-loading')).toBeInTheDocument();
    await screen.findByTestId('quote-list');
    expect(screen.queryByTestId('list-loading')).not.toBeInTheDocument();
  });

  it('clicking a row, or its link, opens the quote', async () => {
    const { user } = await login('acme@example.test');
    await screen.findByTestId('quote-list');
    const first = screen.getAllByTestId('quote-row')[0];
    const id = first.getAttribute('data-quote-id')!;
    await user.click(within(first).getByText(/^Quote number|^Website|^Empty/));
    await screen.findByTestId('quote-detail');
    expect(locations.at(-1)).toBe(`/quotes/${id}`);
  });
});
