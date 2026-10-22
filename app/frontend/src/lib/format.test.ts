import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney } from './format';

describe('formatMoney', () => {
  it('shows 2 decimals from minor units', () => {
    expect(formatMoney(0, 'USD')).toBe('USD 0.00');
    expect(formatMoney(5, 'USD')).toBe('USD 0.05');
    expect(formatMoney(1050, 'EUR')).toBe('EUR 10.50');
    expect(formatMoney(123456789, 'GBP')).toBe('GBP 1,234,567.89');
  });
});

describe('formatDate', () => {
  it('formats in UTC', () => {
    expect(formatDate('2026-01-02T23:30:00.000Z')).toBe('2 Jan 2026');
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026');
    expect(formatDate(null)).toBe('');
  });
});
