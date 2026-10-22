'use strict';
const express = require('express');
const { QuoteRepository } = require('./quote-repository');
const { UserStore, toApiUser } = require('./user-store');
const { verifyPassword } = require('./passwords');
const { ApiError, MESSAGES, unauthenticated, quoteNotFound, validation } = require('./errors');

const COOKIE = 'qp_session';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Verified against when the email is unknown so both failures cost the same time.
const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

function createApp({ db, repository, users, config = {}, logger } = {}) {
  const repo = repository || new QuoteRepository(db);
  const userStore = users || new UserStore(db);
  const log = logger || (config.logLevel === 'silent' ? () => {} : (line) => console.log(line));
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  // Request log: method, path (no query string, no headers, no body), status, duration. Never credentials or session ids.
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      log(JSON.stringify({ t: new Date().toISOString(), method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms) }));
    });
    next();
  });

  app.use(express.json({ limit: '10kb' }));

  const cookieSecure = (req) => (config.cookieSecure === 'true' ? true : config.cookieSecure === 'false' ? false : req.secure);
  const setSessionCookie = (req, res, value) => {
    res.append('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax${cookieSecure(req) ? '; Secure' : ''}`);
  };
  const clearSessionCookie = (req, res) => {
    res.append('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${cookieSecure(req) ? '; Secure' : ''}`);
  };

  // ---- Public routes (no session needed): health, login, logout ----
  app.get('/api/health', (_req, res) => {
    try {
      repo.ping();
      res.status(200).json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const { email, password } = body;
      const details = [];
      if (typeof email !== 'string' || email.trim() === '') details.push({ field: 'email', message: 'Enter your email.' });
      else if (email.length > 254 || !EMAIL_RE.test(email.trim())) details.push({ field: 'email', message: 'Enter a valid email address.' });
      if (typeof password !== 'string' || password.length === 0) details.push({ field: 'password', message: 'Enter your password.' });
      else if (password.length > 256) details.push({ field: 'password', message: 'Password is too long.' });
      if (details.length) throw validation('Check the highlighted fields.', details);

      const user = userStore.findByEmail(email.trim());
      const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
      if (!user || !ok) throw new ApiError(401, 'INVALID_CREDENTIALS', MESSAGES.INVALID_CREDENTIALS);

      const sessionId = userStore.createSession(user.id);
      setSessionCookie(req, res, sessionId);
      res.status(200).json({ user: toApiUser({ ...user, organisation_name: user.organisation_name }) });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/logout', (req, res, next) => {
    try {
      userStore.destroySession(readCookie(req, COOKIE));
      clearSessionCookie(req, res);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // ---- Authentication middleware (BE-08): everything below needs a valid session ----
  app.use('/api', (req, _res, next) => {
    try {
      const row = userStore.findUserBySession(readCookie(req, COOKIE));
      if (!row) throw unauthenticated();
      // Organisation comes only from the session. Nothing in query, headers or body is consulted.
      req.user = row;
      next();
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/me', (req, res) => {
    res.status(200).json({ user: toApiUser(req.user) });
  });

  // ---- Quotes ----
  const INT = /^\d+$/;
  app.get('/api/quotes', (req, res, next) => {
    try {
      const bad = () => validation(MESSAGES.LIST_INVALID);
      const q = req.query;
      let page = 1;
      let pageSize = 20;
      let sort = 'issued_at:desc';
      if (q.page !== undefined) {
        if (typeof q.page !== 'string' || !INT.test(q.page) || q.page.length > 9) throw bad();
        page = Number(q.page);
        if (page < 1) throw bad();
      }
      if (q.pageSize !== undefined) {
        if (typeof q.pageSize !== 'string' || !INT.test(q.pageSize) || q.pageSize.length > 9) throw bad();
        pageSize = Number(q.pageSize);
        if (pageSize < 1 || pageSize > 100) throw bad();
      }
      if (q.sort !== undefined) {
        if (typeof q.sort !== 'string' || !QuoteRepository.SORTS.includes(q.sort)) throw bad();
        sort = q.sort;
      }
      const { items, total } = repo.listQuotes(req.user.organisation_id, { page, pageSize, sort });
      res.status(200).json({ items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/quotes/:id', (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id || id.length > 128) throw quoteNotFound();
      const result = repo.getQuote(req.user.organisation_id, id);
      if (!result) throw quoteNotFound();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/quotes/:id/versions/:versionNo', (req, res, next) => {
    try {
      const { id, versionNo } = req.params;
      if (!id || id.length > 128 || !/^[1-9]\d{0,8}$/.test(versionNo)) throw quoteNotFound();
      const result = repo.getVersion(req.user.organisation_id, id, Number(versionNo));
      if (!result) throw quoteNotFound();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Unmatched routes. Anything under /api/quotes/ gets the same body as an unknown quote, so odd ids
  // (for example "../etc/passwd", which contains slashes) are indistinguishable from other 404s.
  app.use('/api', (req, _res, next) => {
    if (req.path.startsWith('/quotes/')) return next(quoteNotFound());
    next(new ApiError(404, 'NOT_FOUND', 'Not found.'));
  });

  // ---- Shared error handler (BE-01): always {code, message}; never a stack trace or internal detail ----
  app.use((err, req, res, _next) => {
    if (err instanceof ApiError) {
      const body = { code: err.code, message: err.message };
      if (err.details) body.details = err.details;
      return res.status(err.status).json(body);
    }
    if (err instanceof URIError || /Failed to decode param/.test(err && err.message)) {
      // Malformed percent-encoding in a path id: treated like any other unknown quote.
      return res.status(404).json({ code: 'NOT_FOUND', message: MESSAGES.QUOTE_NOT_FOUND });
    }
    if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid request body.' });
    }
    // Server-side only: error name and message, no request data.
    log(JSON.stringify({ t: new Date().toISOString(), level: 'error', path: req.path, error: err && err.name, message: err && err.message }));
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: MESSAGES.INTERNAL });
  });

  return app;
}

module.exports = { createApp, COOKIE };
