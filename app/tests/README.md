# Quote Portal QA automation (Phase 1)

Written in Session 4, **not executed**. Session 5 runs it. Source: `plans/tasks-qa.md`, `docs/test-cases.md`, `plans/openapi.yaml`.

## Layout

- `playwright.config.ts` - one runner, four projects: `unit`, `api`, `ui` (Chromium), `perf`. Single worker (shared database).
- `helpers/` - `env.ts` (URLs, paths), `fixtures.ts` (reads `app/backend/seed/fixtures.json`), `seed.ts` (reset and `seed:revise`), `api.ts` (login, shared assertions, list walker), `db.ts` (read-only SQLite), `ui.ts` (all UI selectors in one place).
- `unit/`, `api/`, `ui/`, `perf/` - one test per test case, title carries `@TC-nnn`, requirement ids, `@regression`, `@pending-decision`.
- `checklist/manual-checklist.md` - TC-081, TC-082, TC-084, TC-092.
- `tools/traceability.mjs` - requirement to test case to test matrix; exits 1 if a case in `docs/test-cases.md` has no test or checklist entry.
- `../../.github/workflows/quote-portal-regression.yml` - CI job for the regression pack.

## Setup (once)

```
cd app/tests && npm install && npx playwright install chromium
cd ../backend && npm run seed          # writes seed/fixtures.json
# start the backend (port 3001) and the frontend dev server (port 5173)
```

Environment variables (all optional): `BACKEND_URL` (http://localhost:3001), `FRONTEND_URL` (http://localhost:5173), `FIXTURES_PATH`, `BACKEND_DIR`, `QP_DB_PATH` (SQLite file, otherwise discovered under app/backend), `SEED_CMD` (seed), `REVISE_CMD` (seed:revise), `QP_NO_RESET=1` (never reseed, for staging), `QP_POLL_MS` (60000, sizes timeouts only), `STAGING_URL` (TC-083), `PERF_LOAD_CMD`, `PERF_USER` (U-PERF), `PERF_P95_MS` (500).

## One command per level (run from app/tests)

| Level | Command |
| --- | --- |
| Unit (TC-045, 069, 071) | `npm run test:unit` |
| API (26 cases) | `npm run test:api` |
| UI / E2E (37 cases) | `npm run test:ui` |
| Performance (TC-093) | `npm run test:perf` (load the 10,000-quote data set first; see PERF_LOAD_CMD) |
| Regression pack (10 cases) | `npm run test:regression` |
| Everything except perf | `npm run test:all` |
| List tests without running | `npm run list` |
| Traceability report | `npm run trace` (writes test-results/traceability.md) |
| Type check | `npm run typecheck` |

Single case: `npx playwright test --grep "@TC-024\b"`. Pending cases only: `--grep @pending-decision`.
Harness checks (QA-01, not test cases): `npx playwright test --grep @harness`.

## Notes for Session 5

- Data-changing tests (TC-028, 060-062, 066, 067, 069, 070, 073) run `npm run seed` before/after, which also rewrites the fixtures file; the helpers re-read it every time.
- Time-based: TC-060, 062, 063, 067 wait for the real 60 s polling interval (TC-063 about 2 min, TC-067 about 3 min).
- Cases with undefined expected results (written against the defaults in `app/BUILD-DECISIONS.md`): TC-006, 007, 013, 020, 028, 030, 031, 044, 072, 073, 084, 093. TC-092 is blocked (OQ-16). Run `npm run trace` for the current list.
- TC-083 is skipped unless `STAGING_URL` is set. TC-081, 082, 084, 092 are manual (checklist).

## Assumptions to confirm against the built app

- Fixtures keys: users `U-0`, `U-1`, `U-50`, `U-51`, `U-B` (optional `U-PERF`), orgs `ORG-0` ... `ORG-B`, quotes `Q-MULTI`, `Q-REV`, `Q-B1`, `Q-NOLINES`, `Q-TIES` (array, `{ids}` or `Q-TIES-n` keys). Quote ids and references come from the fixtures file; titles from the API.
- Frontend routes `/login[?next=]`, `/quotes`, `/quotes/:id`, `/quotes/:id/versions/:n`; selectors (labels Email/Password, button Sign in, Log out, Retry, Next, rows via `data-testid="quote-row"` or table rows, banner text "Newer version available" with `role="status"`) are all in `helpers/ui.ts`.
- SQLite table names follow `docs/spec.md` (`quotes.organisation_id`, a table with `password_hash`).
