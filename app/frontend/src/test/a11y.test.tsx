import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import axe from 'axe-core';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PASSWORD, renderApp, startBackend } from './helpers';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { render } from '@testing-library/react';

let be: Awaited<ReturnType<typeof startBackend>>;
beforeEach(async () => {
  be = await startBackend();
});
afterEach(() => be.close());

// jsdom does not compute layout or cascaded colours, so axe's colour-contrast rule is turned off here and
// replaced by the token-based contrast check further down.
async function scan(container: HTMLElement) {
  const r = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

describe('accessibility scan (FE-11, WCAG 2.1 A/AA rules axe can run in jsdom)', () => {
  it('login page', async () => {
    const { container } = renderApp('/login');
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(await scan(container)).toEqual([]);
  });
  it('login page with errors', async () => {
    const { container } = renderApp('/login');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sign in' }));
    await screen.findByText('Enter your email.');
    expect(await scan(container)).toEqual([]);
  });
  it('list and detail pages', async () => {
    const { container } = renderApp('/login?next=%2Fquotes');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'acme@example.test');
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByTestId('quote-list');
    expect(await scan(container)).toEqual([]);
    await user.click(screen.getAllByTestId('quote-row-link')[0]);
    await screen.findByTestId('quote-detail');
    expect(await scan(container)).toEqual([]);
  });
});

describe('keyboard (FE-11)', () => {
  it('login can be completed with the keyboard only, in a logical order', async () => {
    renderApp('/login');
    const user = userEvent.setup();
    await screen.findByLabelText('Email');
    await user.tab();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    await user.keyboard('acme@example.test');
    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.keyboard(PASSWORD);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByTestId('quote-list')).toBeInTheDocument();
  });

  it('list paging works from the keyboard', async () => {
    renderApp('/login');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'acme@example.test');
    await user.type(screen.getByLabelText('Password'), `${PASSWORD}{Enter}`);
    await screen.findByTestId('quote-list');
    screen.getByTestId('page-next').focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
  });
});

describe('colour contrast tokens (FE-11)', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
  const token = (name: string) => /#[0-9a-f]{6}/i.exec(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[0] ?? '')![0];
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const pairs: [string, string, string, number][] = [
    ['text', 'bg', 'body text', 4.5],
    ['text', 'surface', 'text on white', 4.5],
    ['text', 'card-grey', 'text on grey card', 4.5],
    ['muted', 'bg', 'muted text on page', 4.5],
    ['muted', 'surface', 'muted text on white', 4.5],
    ['muted', 'card-grey', 'muted text on grey card', 4.5],
    ['primary', 'bg', 'links on page', 4.5],
    ['primary', 'surface', 'links on white', 4.5],
    ['primary', 'card-grey', 'links on grey card', 4.5],
    ['primary-text', 'primary', 'primary button', 4.5],
    ['secondary-text', 'secondary-bg', 'secondary button', 4.5],
    ['error', 'surface', 'error on white', 4.5],
    ['error', 'error-bg', 'error on tinted background', 4.5],
    ['banner-text', 'banner-bg', 'banner', 4.5],
    ['current-text', 'current-bg', 'Current tag', 4.5],
    ['superseded-text', 'superseded-bg', 'Superseded tag', 4.5],
    ['border', 'surface', 'input border (non-text 3:1)', 3],
    ['focus', 'surface', 'focus ring (non-text 3:1)', 3],
  ];
  it.each(pairs)('%s on %s (%s) meets %s:1', (fg, bg, _label, min) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(min);
  });
  it('disabled button and banner link keep 4.5:1', () => {
    expect(ratio('#ffffff', '#5b6372')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#3b4150', '#e8eaee')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#0a3d8f', token('banner-bg'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('error boundary (FE-10)', () => {
  it('shows a generic message with no stack trace or details', () => {
    const Boom = () => {
      throw new Error('SELECT * FROM secret at stack.js:1');
    };
    const spy = console.error;
    console.error = () => {};
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    console.error = spy;
    const box = screen.getByTestId('error-boundary');
    expect(box).toHaveTextContent('Something went wrong. Try again.');
    expect(box.textContent).not.toMatch(/SELECT|stack/);
  });
});
