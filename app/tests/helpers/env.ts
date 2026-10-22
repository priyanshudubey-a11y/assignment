import * as path from 'path';

export const BACKEND_URL = (process.env.BACKEND_URL ?? 'http://localhost:3001').replace(/\/$/, '');
export const FRONTEND_URL = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');
export const BACKEND_DIR = process.env.BACKEND_DIR ?? path.resolve(__dirname, '../../backend');
export const FIXTURES_PATH = process.env.FIXTURES_PATH ?? path.join(BACKEND_DIR, 'seed', 'fixtures.json');
export const SESSION_COOKIE = 'qp_session';
export const DEFAULT_PASSWORD = 'Passw0rd!test'; // docs/test-cases.md section 1 [P]
// Set QP_NO_RESET=1 on staging: the seed must not be re-run there.
export const NO_RESET = process.env.QP_NO_RESET === '1';
export const SEED_CMD = process.env.SEED_CMD ?? 'seed';
export const REVISE_CMD = process.env.REVISE_CMD ?? 'seed:revise';
// Quote page poll interval in ms (spec: 60 s). Only used to size timeouts.
export const POLL_MS = Number(process.env.QP_POLL_MS ?? 60_000);
export const BAD_IDS = ['does-not-exist', 'abc', "' OR 1=1 --", '../etc/passwd'];
