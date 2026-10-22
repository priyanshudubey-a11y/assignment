# Handoff — Quote Portal, Phase 1 (Session 4 build)

Written 2026-10-22. Brief intro: what was built, how to run it, and what is still open. QA suite is written but NOT executed (Session 5).

## 1. What was built
- Backend `app/backend`: Node 22 + Express, SQLite (`node:sqlite`) behind `QuoteRepository`. Tasks BE-01..BE-13 and BE-16 done.
- Frontend `app/frontend`: React + Vite + TypeScript, contract-derived mock server. Tasks FE-01..FE-10 done.
- QA automation `app/tests`: Playwright (API, UI, perf), traceability tool, manual checklist. Tasks QA-02..QA-06 and QA-T001..QA-T094 done; QA-01 left unticked.
- CI workflow (extra, outside app/): `.github/workflows/quote-portal-regression.yml`.

## 2. Install and run
- Prerequisite: Node 22.
- Backend (`app/backend`): `npm install` → `npm run seed` → `npm start`. Also `npm run seed:revise -- <quoteId>`, `npm run perf`, `npm test`, `npm run lint`.
- Frontend (`app/frontend`): `npm install`, then `npm run dev` (against the real backend) or `npm run dev:mock` (mock on 3002 + Vite). Also `npm test`, `npm run lint`, `npm run build`.
- `npm install` hung when run directly on the mounted folder in this environment; run it on your own machine (or copy the folder locally first).
- QA (`app/tests`): see `app/tests/README.md` (one command per level). Not run in this session.
- Config env vars (backend): `PORT`, `DB_PATH`, `TRUST_PROXY`, `COOKIE_SECURE`, `LOG_LEVEL`, `SEED_FIXTURES_PATH`, `SEED_PASSWORD`. Frontend: `API_TARGET`, `MOCK_PORT`.

## 3. URLs and ports
- Backend API: http://localhost:3001 (health: `/api/health`)
- Frontend dev server: http://localhost:5173 (proxies `/api` to 3001)
- Frontend mock server: http://localhost:3002

## 4. Seed and test data (real backend, `npm run seed`)
- Fixtures file: `app/backend/seed/fixtures.json` (keys follow docs/test-cases.md: U-0, U-1, U-50, U-51, U-B; ORG-0/1/50/51/B; Q-MULTI, Q-REV, Q-NOLINES, Q-B1, Q-TIES*).
- Password for all seeded users: `Test-Passw0rd!` (test data only).

| User | Email | Org | Quotes |
|---|---|---|---|
| U-0 | user0@org0.example.test | ORG-0 | 0 |
| U-1 | user1@org1.example.test | ORG-1 | 1 |
| U-50 | user50@org50.example.test | ORG-50 | 50 |
| U-51 | user51@org51.example.test | ORG-51 | 51 (includes the multi-version, no-lines and tie quotes) |
| U-B | userb@orgb.example.test | ORG-B | 8 |

- Mock server logins (password `Passw0rd!`): acme@example.test (51 quotes), empty@example.test (0), other@example.test (1).

## 5. Decisions made by judgement call (user said "make a judgement call"; please review)
- Database: SQLite, because Postgres/Docker are not on the build device. TC-070 (concurrency) and the list performance target are validated on SQLite only.
- Sort key: `issued_at` = date version 1 was issued, so a revision does not move a quote.
- Seed: separate orgs with exactly 0, 1, 50, 51 quotes, one user each, plus ORG-B.
- Plan defaults (Q-P5) accepted as proposed. "Active account" check dropped.
- "spec NFR-04 (list performance)" label kept (ID conflict G-03 unresolved). TC-084/AC-011 treated as obsolete (deadline 2026-10-20 passed).
- Seed user keys were renamed from the BE agent's guess (USER-*) to the test-case placeholders (U-*) after the build.
- Full list: `app/BUILD-DECISIONS.md`.

## 6. Results of developer tests (re-run by the lead)
- Backend: `npm test` 65/65 passed. Perf script (SQLite, 10,000 quotes): p95 5.5 ms (agent run).
- Frontend: `npm test` 108/108 passed, lint clean (run in a local copy; not against the real backend).
- QA suite: not executed. Only syntax/list checks (70 tests listed, 71/71 cases mapped).

## 7. Not done / open
- BE-14 staging deployment, BE-15 uptime monitoring, FE-12 staging build + smoke test: no staging host, URL, monitor tool or alert channel was given (Q-P2).
- FE-11: spacing check against designs blocked (Figma link missing, OQ-16; TC-092). Contrast checked on tokens only, not in a real browser.
- QA-01: needs a green sample run of each test level; deliberately not run this session.
- Frontend has not been run against the real backend (FE-04 redirect and FE-05 logout need that check in Session 5).
- Manual-only checks: TC-081, TC-082, TC-084, TC-092. TC-083 needs `STAGING_URL`.
- 13 tests are tagged `@pending-decision` / `@blocked` (TC-006, 007, 013, 020, 028, 030, 031, 044, 072, 073, 084, 093, 092).
- Open items from plans, still unanswered by the user: Q-P2, Q-P6, Q-P7, and the missing acceptance criteria (G-01..G-05, G-08). Approved docs were not edited.

## 8. Known limitations
- No-cache header on protected pages is set only by the Vite dev/preview servers; the production host must send it.
- Frontend API request functions are hand-written (types come from the contract).
- Frontend wording for field errors ("Enter your email." etc.) is the build's own choice; the plan marked it a proposal.
- Backend login 400 message is "Check the highlighted fields." (not fixed by contract).
- Perf test needs load data: set `PERF_LOAD_CMD` and `PERF_USER`.
- TC-063/TC-067 wait for real polling intervals (~2–3 min each).
- A delete permission was granted once on the connected folder to clear a corrupted `node_modules` in `app/backend`.
