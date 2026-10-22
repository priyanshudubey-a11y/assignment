import { execSync } from 'child_process';
import { expect, test } from '@playwright/test';
import { json, loginAs } from '../helpers/api';
import { BACKEND_DIR } from '../helpers/env';

// pending-decision: Q-P6 (NFR id label) and the 500 ms target are proposals. Runs on SQLite only (Q-P1).
// Data set: BE-16 generator. Set PERF_LOAD_CMD (run in app/backend) to load it, e.g. "npm run seed:perf",
// and PERF_USER to the fixtures key of the user that owns the 10,000 quotes (default U-PERF).
const REQUESTS = 200;
const P95_LIMIT_MS = Number(process.env.PERF_P95_MS ?? 500);

test('TC-093 List performance at 10,000 quotes @TC-093 @NFR-04-list @pending-decision', async () => {
  if (process.env.PERF_LOAD_CMD) execSync(process.env.PERF_LOAD_CMD, { cwd: BACKEND_DIR, stdio: 'pipe', timeout: 280_000 });
  const ctx = await loginAs(process.env.PERF_USER ?? 'U-PERF');
  const probe = await json(await ctx.get('/api/quotes'));
  expect(probe.total, 'precondition: 10,000 quotes loaded in the performance organisation').toBeGreaterThanOrEqual(10_000);

  const times: number[] = [];
  for (let i = 0; i < REQUESTS; i++) {
    const t0 = performance.now();
    const res = await ctx.get('/api/quotes');
    await res.body();
    times.push(performance.now() - t0);
    expect(res.status()).toBe(200);
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.ceil(0.95 * times.length) - 1];
  test.info().annotations.push({ type: 'p95_ms', description: p95.toFixed(1) });
  console.log(`TC-093 p95=${p95.toFixed(1)} ms p50=${times[100].toFixed(1)} ms max=${times[times.length - 1].toFixed(1)} ms over ${REQUESTS} requests`);
  expect(p95).toBeLessThan(P95_LIMIT_MS);
});
