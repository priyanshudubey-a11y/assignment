import { describe, expect, it } from 'vitest';
import { loginPathFor, resolveNext } from './redirect';

describe('resolveNext (FE-04 whitelist)', () => {
  it.each([
    ['/quotes', '/quotes'],
    ['/quotes/', '/quotes'],
    ['/quotes?page=3', '/quotes?page=3'],
    ['/quotes/abc-123', '/quotes/abc-123'],
    ['/quotes/abc-123/versions/2', '/quotes/abc-123/versions/2'],
    ['/quotes/abc-123?utm=x#frag', '/quotes/abc-123'],
  ])('allows %s', (input, out) => expect(resolveNext(input)).toBe(out));

  it.each([
    ['/login'],
    ['/login?next=/quotes'],
    ['https://evil.example/quotes'],
    ['http://evil.example'],
    ['//evil.example/quotes'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
    ['quotes'],
    [''],
    ['/'],
    ['/admin'],
    ['/quotes/a/b'],
    ['/quotes/a/versions/0'],
    ['/quotes/a/versions/x'],
    ['/quotes/%0d%0a'],
    ['/quotes/<script>'],
    ['/quotes?page=0'],
  ])('rejects %s (falls back to the list)', (input) => {
    expect(resolveNext(input)).toBe('/quotes');
  });

  it('handles null and undefined', () => {
    expect(resolveNext(null)).toBe('/quotes');
    expect(resolveNext(undefined)).toBe('/quotes');
  });

  it('drops an invalid page parameter', () => {
    expect(resolveNext('/quotes?page=0')).toBe('/quotes');
    expect(resolveNext('/quotes?page=abc')).toBe('/quotes');
  });

  it('never returns the login page, even when asked to sign in from /login', () => {
    expect(loginPathFor({ pathname: '/login', search: '' })).toBe('/login?next=%2Fquotes');
  });

  it('builds the login path with the encoded current location', () => {
    expect(loginPathFor({ pathname: '/quotes/q1', search: '' })).toBe('/login?next=%2Fquotes%2Fq1');
  });
});
