# Backend Plan — Quote Portal, Phase 1

Status: Draft v0.1 (Session 3), pending user confirmation. Sources: `docs/requirements.md` v0.2, `docs/spec.md` v0.2, `docs/test-cases.md` v0.1. The API contract is `plans/openapi.yaml` and is the single source of truth for both backend and frontend. Items marked **[P]** are proposals that need confirmation (see section 7).

## 1. Goals

- Brief intro: what the backend must deliver so Acme can use the beta and every test case can run.
- Serve the Phase 1 API exactly as defined in `plans/openapi.yaml` (login, logout, current user, quote list, quote detail, quote version, health).
- Keep every quote query scoped to the caller's organisation, with other organisations' ids indistinguishable from missing ids (FR-04).
- Fix, by design, the two critical defects from the 09-25 QA sync that sit on the backend side: pagination above 50 rows (FR-03) and, together with the frontend, the login redirect loop (FR-02).
- Provide seeded mock data and seed tooling so every list and view state, and the newer-version flow, can be exercised without a real quote source (FR-08).
- Expose a health endpoint and set up uptime monitoring before real traffic (NFR-01), and deploy to staging for the Acme beta (FR-05).

## 2. Scope

- Brief intro: Phase 1 only. The data layer sits behind a `QuoteRepository` interface so a real quote source can replace it later.
- **In scope**
  - Express API, data model and migrations, `QuoteRepository` (spec section 2)
  - Email and password authentication with server-side sessions, logout, `/api/me` (FR-02, FR-06)
  - Quote list with pagination, quote detail, quote version endpoints (FR-01, FR-03, FR-07)
  - Organisation scoping (FR-04)
  - Seed script and `seed:revise` (FR-08)
  - Health endpoint, monitoring setup, staging deployment of the backend (NFR-01, FR-05)
  - Baseline hygiene only: hashed passwords, httpOnly cookies, no stack traces (NFR-02 withdrawn from portal scope; baseline stays per spec)
  - List performance target from `spec.md` (see risk R-5 on the NFR-04 ID conflict)
- **Out of scope**
  - Real quote-source integration, quote creation or editing, admin UI
  - SSO, MFA, session timeout, login lockout, password reset, account creation (accounts are seeded; OQ-21)
  - Notifications, payments, cost control (the requirement-doc NFR-04 is a cloud spend cap and is not a backend feature)

## 3. Dependencies

- Brief intro: what the backend needs from others and from the frontend.
- `plans/openapi.yaml` approved (this session) before any build work starts.
- Decisions in section 7: stack and database (Q-P1), staging hosting and monitoring tool (Q-P2), sort key and revisions (Q-P3), seed shape (Q-P4), defaults for undefined behaviour (Q-P5).
- Staging environment and monitoring owner: Sam and Rahul Mehta per requirements section 10.
- Frontend consumes the contract through a mock server until BE-09 to BE-11 are available; there is no code dependency from frontend to backend during early build.
- QA consumes the seed fixtures file produced by BE-03.

## 4. Sequencing

- Brief intro: the contract is written first so backend and frontend run in parallel. Task IDs are in `plans/tasks-be.md`.
- **Milestone B0 — Contract (done in this session):** `plans/openapi.yaml`.
- **Milestone B1 — Foundation:** BE-01 scaffold, BE-02 data model and repository, BE-13 contract validation in CI.
- **Milestone B2 — Auth and seed:** BE-05 sessions and hashing, BE-06 login, BE-07 logout and `/api/me`, BE-08 auth middleware and org scoping, BE-03 seed, BE-04 `seed:revise`.
- **Milestone B3 — Quote API:** BE-09 list, BE-10 quote detail, BE-11 version endpoint, BE-12 health.
- **Milestone B4 — Beta readiness:** BE-14 staging deployment, BE-15 uptime monitoring, BE-16 list performance.
- Critical path: BE-01 → BE-02 → BE-05 → BE-06/BE-08 → BE-09 → BE-14. Seed work (BE-03, BE-04) runs in parallel with auth after BE-02, but BE-03 needs the hashing utility from BE-05.
- Frontend integration against the real backend starts when B3 is complete.

## 5. Risks

- Brief intro: risks specific to the backend, with a mitigation each.
- **R-1 Pagination regression above 50 rows (critical bug, closure never recorded).** Mitigation: deterministic order with id tiebreak, tests for 50, 51 and `pageSize=1` walks (TC-022 to TC-027), in the regression pack.
- **R-2 Redirect loop (critical bug).** Mostly a frontend concern; the backend contributes by never issuing redirects from login and by returning a clean 401 on expired sessions (TC-009, TC-017).
- **R-3 Cross-organisation data leak.** Mitigation: the repository cannot be called without an organisation id, the organisation comes only from the session, and cross-organisation tests run on every build (TC-016, TC-050 to TC-055).
- **R-4 Revisions reorder the list under offset pagination (TC-028).** Depends on Q-P3. Proposed mitigation: sort by the first-issue date, which a revision does not change.
- **R-5 ID conflict.** `spec.md` uses NFR-04 for list performance while `requirements.md` uses NFR-04 for cloud cost (gap G-03). Plans and tasks refer to "spec NFR-04 (list performance)" until the user decides.
- **R-6 Data model has no "active" flag.** Requirements section 6 says the account "must exist and be active", but `spec.md` section 2 has no field for it. Proposed: all seeded users are active and the check is dropped in Phase 1 (Q-P5).
- **R-7 Concurrent `seed:revise` (TC-070).** Mitigation: transaction plus a unique constraint on (quote, version number) and a one-current-version constraint. A database without row-level locking behaves differently, which is why the database choice (Q-P1) matters.
- **R-8 Staging slipped twice (10-01, 10-06).** Mitigation: BE-14 starts as soon as BE-06 and BE-09 exist, not at the end.
- **R-9 Beta data is mock data (OQ-22).** Acme's feedback may not reflect real quotes. Not a backend defect; noted for the user.

## 6. Definition of done

- Brief intro: a backend task is done when all of the following hold.
- Every endpoint behaves as in `plans/openapi.yaml` for success and error responses, and contract tests (BE-13) pass.
- Developer unit and integration tests for the task exist and pass in CI. These are the developer's own checks; the formal test run of the `docs/test-cases.md` suite happens in Session 5, not Session 4.
- No stack traces, SQL errors or internal ids appear in any error body.
- Every query is scoped by the caller's organisation.
- The task's acceptance criteria in `plans/tasks-be.md` are met and the task references the requirement IDs it covers.
- Staging deploys cleanly from a clean checkout using only the documented steps, and the seed runs on it.

## 7. Open questions (shared by all plans)

- Brief intro: these are the questions asked in the batched `/validate-logic` round for this session. Proposed defaults are used in the plans until answered.
- **Q-P1 Stack and database.** Proposed: Node.js and Express, React, and Postgres for local, staging and CI alike (one engine, so the concurrency and performance tests mean the same thing everywhere). `spec.md` leaves SQLite or Postgres open **[P]**.
- **Q-P2 Staging and monitoring.** Hosting, staging URL, deploy method, monitoring tool, alert channel and who is paged (OQ-12, OQ-13). The 2-failure alert threshold is a proposal.
- **Q-P3 List sort key and revisions (TC-028, G-09).** Proposed: `issued_at` means the date version 1 was issued, so revising a quote does not move it in the list.
- **Q-P4 Seed shape (G-06, TC-072).** Proposed: separate organisations holding exactly 0, 1, 50 and 51 quotes (one user each), plus ORG-B, as in the test-data table of `docs/test-cases.md`.
- **Q-P5 Defaults for undefined behaviour (G-10).** Proposed: maximum `pageSize` 100; a page beyond the last returns 200 with empty items; `totalPages` is 0 when there are no quotes; empty or malformed email returns 400 with field messages; a signed-in user opening the login page is sent to the quote list; a quote without line items shows "No line items."; running the seed twice resets to the known state without duplicates; the "active account" check is dropped (R-6).
- **Q-P6 ID conflict and missing acceptance criteria (G-01 to G-05, G-08).** Which ID will list performance use, and will acceptance criteria be added for FR-06, NFR-02 baseline, the list error state and staging deployment? The approved documents are not edited by this session.
- **Q-P7 AC-011 deadline (G-07, TC-084).** The feedback deadline of 2026-10-20 has passed.
- **Q-P8 Test-case status and the Session 4 / Session 5 boundary.** `docs/test-cases.md` is marked Draft v0.1 pending review. Are its Session 2 answers (Q1 to Q5) settled, and may developers run their own unit tests in Session 4 while the formal test run waits for Session 5?

---
Confidential — Internal Use Only | Page [n]
