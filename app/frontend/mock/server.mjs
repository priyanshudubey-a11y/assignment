// Contract mock server (FE-01): serves the seven endpoints of plans/openapi.yaml from in-memory data.
// Usage: `npm run mock` (default port 3002 so it never collides with the real backend on 3001).
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createStore, reviseQuote, summary, versionSummary, PASSWORD } from './data.mjs';

const ERR = {
  INVALID_CREDENTIALS: [401, 'Incorrect email or password.'],
  UNAUTHENTICATED: [401, 'Sign in to continue.'],
  NOT_FOUND: [404, 'Quote not found.'],
  VALIDATION_ERROR: [400, 'Could not load quotes. Try again.'],
  INTERNAL_ERROR: [500, 'Something went wrong. Try again.'],
};

export function createMockServer() {
  const store = createStore();
  let current = store;
  const send = (res, status, body, headers = {}) => {
    const payload = body === undefined ? '' : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
    res.end(payload);
  };
  const fail = (res, code) => send(res, ERR[code][0], { code, message: ERR[code][1] });
  const readBody = (req) =>
    new Promise((resolve) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          resolve(null);
        }
      });
    });
  const cookieOf = (req) => /(?:^|;\s*)qp_session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
  const userOf = (req) => current.sessions.get(cookieOf(req));
  const userBody = (u) => ({ user: { id: u.id, email: u.email, role: u.role, organisation: u.org } });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://mock');
    const path = url.pathname;
    const m = req.method;

    // ---- test controls (not part of the contract) ----
    if (path === '/__mock/reset' && m === 'POST') {
      current = createStore();
      return send(res, 200, { ok: true });
    }
    if (path.startsWith('/__mock/revise/') && m === 'POST') {
      const n = reviseQuote(current, decodeURIComponent(path.split('/').pop()));
      return n ? send(res, 200, { versionNo: n }) : send(res, 404, { ok: false });
    }
    if (path === '/__mock/fail' && m === 'POST') {
      current.failNext = Number(url.searchParams.get('count') ?? 1);
      return send(res, 200, { failNext: current.failNext });
    }

    if (!path.startsWith('/api/')) return send(res, 404, { code: 'NOT_FOUND', message: 'Not found.' });
    if (path === '/api/health' && m === 'GET') return send(res, 200, { status: 'ok' });
    if (current.failNext > 0 && path !== '/api/me') {
      current.failNext -= 1;
      return fail(res, 'INTERNAL_ERROR');
    }

    if (path === '/api/auth/login' && m === 'POST') {
      const b = await readBody(req);
      if (!b || typeof b.email !== 'string' || typeof b.password !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) || !b.password) {
        return send(res, 400, { code: 'VALIDATION_ERROR', message: 'Enter a valid email address.', details: [{ field: 'email', message: 'Enter a valid email address.' }] });
      }
      const user = current.users.find((u) => u.email.toLowerCase() === b.email.toLowerCase());
      if (!user || b.password !== PASSWORD) return fail(res, 'INVALID_CREDENTIALS');
      const sid = crypto.randomUUID();
      current.sessions.set(sid, user);
      return send(res, 200, userBody(user), { 'Set-Cookie': `qp_session=${sid}; Path=/; HttpOnly; SameSite=Lax` });
    }
    if (path === '/api/auth/logout' && m === 'POST') {
      current.sessions.delete(cookieOf(req));
      res.writeHead(204, { 'Set-Cookie': 'qp_session=; Path=/; HttpOnly; Max-Age=0', 'Cache-Control': 'no-store' });
      return res.end();
    }

    const user = userOf(req);
    if (!user) return fail(res, 'UNAUTHENTICATED');
    if (path === '/api/me' && m === 'GET') return send(res, 200, userBody(user));

    const own = () => current.quotes.filter((q) => q.orgId === user.org.id);

    if (path === '/api/quotes' && m === 'GET') {
      const rawPage = url.searchParams.get('page') ?? '1';
      const rawSize = url.searchParams.get('pageSize') ?? '20';
      const sort = url.searchParams.get('sort') ?? 'issued_at:desc';
      const page = Number(rawPage);
      const pageSize = Number(rawSize);
      const okSorts = ['issued_at:desc', 'issued_at:asc', 'reference:asc', 'reference:desc'];
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || !okSorts.includes(sort)) {
        return fail(res, 'VALIDATION_ERROR');
      }
      const [field, dir] = sort.split(':');
      const key = field === 'issued_at' ? (q) => summary(q).issuedAt : (q) => q.reference;
      const sorted = own().sort((a, b) => {
        const c = key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
        const primary = dir === 'asc' ? c : -c;
        return primary || (a.id < b.id ? 1 : -1); // id descending tiebreak
      });
      const total = sorted.length;
      const items = sorted.slice((page - 1) * pageSize, page * pageSize).map(summary);
      return send(res, 200, { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
    }

    const mDetail = /^\/api\/quotes\/([^/]+)$/.exec(path);
    if (mDetail && m === 'GET') {
      const q = own().find((x) => x.id === decodeURIComponent(mDetail[1]));
      if (!q) return fail(res, 'NOT_FOUND');
      const cur = q.versions[q.versions.length - 1];
      return send(res, 200, {
        quote: summary(q),
        currentVersion: cur,
        currentVersionNo: cur.versionNo,
        versions: [...q.versions].reverse().map(versionSummary),
      });
    }
    const mVer = /^\/api\/quotes\/([^/]+)\/versions\/([^/]+)$/.exec(path);
    if (mVer && m === 'GET') {
      const q = own().find((x) => x.id === decodeURIComponent(mVer[1]));
      const v = q?.versions.find((x) => String(x.versionNo) === mVer[2]);
      if (!q || !v) return fail(res, 'NOT_FOUND');
      const cur = q.versions[q.versions.length - 1];
      return send(res, 200, { version: v, isCurrent: v.isCurrent, superseded: !v.isCurrent, currentVersionNo: cur.versionNo });
    }
    return send(res, 404, { code: 'NOT_FOUND', message: 'Not found.' });
  });
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.MOCK_PORT ?? 3002);
  createMockServer().listen(port, () => console.log(`Quote Portal contract mock listening on http://localhost:${port}`));
}
