import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { AddressInfo } from 'node:net';
import { vi } from 'vitest';
import { App } from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { createMockServer } from '../../mock/server.mjs';

export const PASSWORD = 'Passw0rd!';

/** Starts the contract mock on a random port and routes global fetch('/api/...') to it, with a cookie jar. */
export async function startBackend() {
  const server = createMockServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let jar = '';
  const calls: { method: string; path: string }[] = [];
  const realFetch = globalThis.fetch;
  const fetchSpy = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = String(input);
    calls.push({ method: init.method ?? 'GET', path });
    const { signal: _s, credentials: _c, ...rest } = init; // jsdom AbortSignal is not accepted by Node fetch
    const headers = new Headers(rest.headers);
    if (jar) headers.set('Cookie', jar);
    const res = await realFetch(base + path, { ...rest, headers });
    const set = res.headers.get('set-cookie');
    if (set) jar = /qp_session=([^;]*)/.exec(set)?.[1] ? `qp_session=${/qp_session=([^;]*)/.exec(set)![1]}` : '';
    if (set && /Max-Age=0/.test(set)) jar = '';
    return res;
  });
  vi.stubGlobal('fetch', fetchSpy);
  const control = (p: string) => realFetch(base + p, { method: 'POST' });
  return {
    base,
    calls,
    fetchSpy,
    revise: (id: string) => control(`/__mock/revise/${id}`),
    failNext: (n: number) => control(`/__mock/fail?count=${n}`),
    signedIn: () => jar !== '',
    close: async () => {
      vi.unstubAllGlobals();
      await new Promise((r) => server.close(r));
    },
  };
}

export const locations: string[] = [];
function LocationSpy() {
  const l = useLocation();
  const here = l.pathname + l.search;
  useEffect(() => {
    if (locations.at(-1) !== here) locations.push(here);
  }, [here]);
  return null;
}

export function renderApp(path: string) {
  locations.length = 0;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationSpy />
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}
