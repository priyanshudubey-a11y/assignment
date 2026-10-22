import type { components, paths } from './schema';

// Types come straight from plans/openapi.yaml (npm run gen:api). If the contract changes in a way
// that affects these paths, `npm run build` (tsc) fails instead of the client drifting.
type JsonOk<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: { 200: { content: { 'application/json': infer R } } };
}
  ? R
  : never;

export type LoginResponse = JsonOk<'/api/auth/login', 'post'>;
export type MeResponse = JsonOk<'/api/me', 'get'>;
export type QuoteListResponse = JsonOk<'/api/quotes', 'get'>;
export type QuoteDetailResponse = JsonOk<'/api/quotes/{id}', 'get'>;
export type QuoteVersionResponse = JsonOk<'/api/quotes/{id}/versions/{versionNo}', 'get'>;
export type User = components['schemas']['User'];
export type QuoteSummary = components['schemas']['QuoteSummary'];
export type QuoteVersion = components['schemas']['QuoteVersion'];
export type VersionSummary = components['schemas']['VersionSummary'];
export type LineItem = components['schemas']['LineItem'];
export type ErrorCode = components['schemas']['Error']['code'] | 'NETWORK' | 'UNKNOWN';

/** Raw server messages are kept for diagnostics only; the UI never renders them. */
export class ApiError extends Error {
  status: number;
  code: ErrorCode;
  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let unauthorizedHandler: (() => void) | null = null;
/** FE-02: any 401 from a protected call clears the user state and sends the user to login. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  /** false for calls where a 401 is an expected answer (login, bootstrap /api/me). */
  handle401?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK', 'Network error');
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data ?? {}) as { code?: ErrorCode; message?: string };
    if (res.status === 401 && opts.handle401 !== false) unauthorizedHandler?.();
    throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.message ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/api/auth/login', { method: 'POST', body: { email, password }, handle401: false }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST', handle401: false }),
  getMe: (signal?: AbortSignal) => request<MeResponse>('/api/me', { signal, handle401: false }),
  listQuotes: (params: { page: number; pageSize: number }, signal?: AbortSignal) =>
    request<QuoteListResponse>(`/api/quotes?page=${params.page}&pageSize=${params.pageSize}`, { signal }),
  getQuote: (id: string, signal?: AbortSignal) =>
    request<QuoteDetailResponse>(`/api/quotes/${encodeURIComponent(id)}`, { signal }),
  getQuoteVersion: (id: string, versionNo: number, signal?: AbortSignal) =>
    request<QuoteVersionResponse>(`/api/quotes/${encodeURIComponent(id)}/versions/${versionNo}`, { signal }),
};
