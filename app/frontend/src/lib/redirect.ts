/**
 * The single place that decides where a post-login redirect may go (FE-04).
 * Only same-origin, whitelisted app paths are allowed; everything else (login, external URLs,
 * protocol-relative URLs, junk) falls back to the quote list.
 */
export const DEFAULT_AFTER_LOGIN = '/quotes';

const ID = '[A-Za-z0-9_-]{1,128}';
const WHITELIST: RegExp[] = [
  /^\/quotes\/?$/,
  new RegExp(`^/quotes/${ID}/?$`),
  new RegExp(`^/quotes/${ID}/versions/[1-9][0-9]{0,8}/?$`),
];
const BASE = 'http://portal.invalid';

function hasForbiddenChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 32 || c === 127 || c === 92) return true; // control characters and backslash
  }
  return false;
}

export function resolveNext(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) return DEFAULT_AFTER_LOGIN;
  // Must be an absolute path; reject "//host", "/\host", control chars and anything that is not "/x".
  if (!raw.startsWith('/') || raw.startsWith('//') || hasForbiddenChar(raw)) return DEFAULT_AFTER_LOGIN;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return DEFAULT_AFTER_LOGIN;
  }
  if (url.origin !== BASE) return DEFAULT_AFTER_LOGIN;
  const path = url.pathname;
  if (!WHITELIST.some((re) => re.test(path))) return DEFAULT_AFTER_LOGIN;
  if (/^\/quotes\/?$/.test(path)) {
    const page = url.searchParams.get('page');
    return page && /^[1-9][0-9]{0,6}$/.test(page) ? `/quotes?page=${page}` : '/quotes';
  }
  return path.replace(/\/$/, ''); // query and hash are dropped for quote pages
}

export function loginPathFor(location: { pathname: string; search: string }): string {
  const next = resolveNext(location.pathname + location.search);
  return `/login?next=${encodeURIComponent(next)}`;
}
