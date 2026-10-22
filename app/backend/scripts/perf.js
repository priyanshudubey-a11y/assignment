'use strict';
// BE-16: GET /api/quotes p95 at 10,000 quotes in one organisation. Runs against SQLite on this machine;
// it is NOT staging-class Postgres. Exits non-zero when p95 >= 500 ms.
const path = require('node:path');
const http = require('node:http');
const { openDatabase } = require('../src/db');
const { createApp } = require('../src/app');
const { generateLoad } = require('./generate-load');

const REQUESTS = Number(process.env.PERF_REQUESTS || 400);
const THRESHOLD_MS = 500;

function request(port, pathAndQuery, cookie) {
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    const req = http.request({ port, path: pathAndQuery, method: 'GET', headers: cookie ? { cookie } : {} }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode, ms: Number(process.hrtime.bigint() - t0) / 1e6 }));
    });
    req.on('error', reject);
    req.end();
  });
}

function login(port, email, password) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email, password });
    const req = http.request({ port, path: '/api/auth/login', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.headers['set-cookie'][0].split(';')[0]));
    });
    req.on('error', reject);
    req.end(body);
  });
}

(async () => {
  const dbPath = process.env.PERF_DB_PATH || path.join(__dirname, '..', 'data', 'perf.db');
  const db = openDatabase(dbPath);
  const creds = await generateLoad(db, 10000);
  const server = createApp({ db, config: { logLevel: 'silent' } }).listen(0);
  const port = server.address().port;
  const cookie = await login(port, creds.email, creds.password);
  const sorts = ['issued_at:desc', 'issued_at:asc', 'reference:asc', 'reference:desc'];
  const times = [];
  for (let i = 0; i < REQUESTS; i++) {
    const page = 1 + Math.floor(Math.random() * 500); // pageSize 20 -> 500 pages
    const sort = sorts[i % sorts.length];
    const r = await request(port, `/api/quotes?page=${page}&pageSize=20&sort=${encodeURIComponent(sort)}`, cookie);
    if (r.status !== 200) throw new Error(`Unexpected status ${r.status}`);
    times.push(r.ms);
  }
  // Worst case for offset pagination: the last page.
  const last = await request(port, '/api/quotes?page=500&pageSize=20&sort=issued_at:asc', cookie);
  times.push(last.ms);
  times.sort((a, b) => a - b);
  const p = (q) => times[Math.min(times.length - 1, Math.ceil(q * times.length) - 1)];
  console.log(`quotes=10000 requests=${times.length} p50=${p(0.5).toFixed(1)}ms p95=${p(0.95).toFixed(1)}ms p99=${p(0.99).toFixed(1)}ms max=${times[times.length - 1].toFixed(1)}ms`);
  server.close();
  db.close();
  if (p(0.95) >= THRESHOLD_MS) {
    console.error(`FAIL: p95 ${p(0.95).toFixed(1)}ms >= ${THRESHOLD_MS}ms`);
    process.exit(1);
  }
  console.log(`PASS: p95 under ${THRESHOLD_MS}ms (SQLite, local machine; not staging-class)`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
