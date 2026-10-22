# Build decisions (Session 4) — judgement calls made by Claude on 2026-10-22
User instruction: "make a judgement call". These replace the open proposals Q-P1..Q-P8 for this build and are listed in handoff.md for review.

- Q-P1 Database: SQLite via Node's built-in `node:sqlite` (Node 22) or `better-sqlite3` if node:sqlite is unusable. Postgres is NOT available on the build device. Keep all SQL behind QuoteRepository so Postgres can replace it. Consequence: TC-070 (concurrency) and BE-16 (p95) are validated on SQLite only.
- Q-P2 Staging/monitoring: no host, URL, tool or channel was given. BE-14, BE-15, FE-12 stay UNMARKED and are listed in handoff.md. Provide a health endpoint and a documented monitor config sketch only if cheap.
- Q-P3 issued_at in list sort = date version 1 was issued (revisions do not move a quote).
- Q-P4 Seed: separate orgs holding exactly 0, 1, 50, 51 quotes (one user each) plus ORG-B, per docs/test-cases.md test-data table.
- Q-P5 Defaults accepted as proposed (max pageSize 100; page beyond last -> 200 empty; totalPages 0 when empty; bad email -> 400 VALIDATION_ERROR; signed-in user at /login -> quote list; "No line items."; seed twice resets without duplicates; "active account" check dropped).
- Q-P6 Keep the label "spec NFR-04 (list performance)". Q-P7 TC-084 / AC-011 treated as obsolete (deadline 2026-10-20 passed); note only.
- Q-P8 Test cases v0.1 treated as the working baseline. Devs run own unit tests; the QA suite is written, NOT executed.

## Shared conventions (all three sub-agents)
- Backend: http://localhost:3001 . Frontend dev server: http://localhost:5173 proxying /api to 3001.
- Fixtures file written by `npm run seed` in app/backend: `app/backend/seed/fixtures.json`. QA loads it; never hard-code ids. Shape: { "orgs": { "ORG-0": {id,name}, ... }, "users": { "<PLACEHOLDER>": {email,password,orgKey} }, "quotes": { "Q-MULTI": {id,reference}, ... } } using the placeholder names from docs/test-cases.md.
- Seed/revise: `npm run seed`, `npm run seed:revise -- <quoteId>` in app/backend.
- Do not edit docs/, plans/openapi.yaml or plan-*.md. Only tick your own tasks file (change "- **XX-nn" task line to start with "- [x] **XX-nn" ; leave undone tasks unmarked).
- Contract changes are not allowed; report conflicts in your final message instead.
