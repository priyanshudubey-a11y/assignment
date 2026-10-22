# Backend Tasks — Quote Portal, Phase 1

Status: Draft v0.1 (Session 3). Plan: `plans/plan-be.md`. Contract: `plans/openapi.yaml`. Test cases: `docs/test-cases.md`.

- Brief intro: each task is small and independently verifiable. "Verified by" lists the test cases that will exercise it in Session 5; they are not run in Session 4.
- Requirement IDs follow `docs/requirements.md`. "spec NFR-04" means the list performance target in `docs/spec.md` (ID conflict G-03).

## B1 — Foundation

- [x] **BE-01 — Backend scaffold and error handling**
  - Requirements: NFR-02 (baseline hygiene), foundation for all FRs
  - Acceptance criteria:
    - The API starts from one command with configuration from environment variables only.
    - A shared error handler returns `{code, message}` JSON for every failure; a deliberately thrown error returns `INTERNAL_ERROR` with no stack trace or internal detail.
    - Request logs never contain passwords or session ids.
    - Lint and the unit test runner work in CI.
  - Dependencies: Q-P1
  - Verified by: TC-094

- [x] **BE-02 — Data model, migrations and `QuoteRepository`**
  - Requirements: FR-01, FR-03, FR-04, FR-07, FR-08
  - Acceptance criteria:
    - Tables for Organisation, User, Quote, QuoteVersion and QuoteLineItem exist as in `spec.md` section 2; money is stored as integer minor units.
    - Constraints: user email unique case-insensitively; quote reference unique; version number unique per quote; at most one current version per quote.
    - `QuoteRepository` exposes list, get quote and get version, and every method requires an organisation id.
    - Migrations run on an empty database and can be re-run without error.
  - Dependencies: BE-01
  - Verified by: TC-043, TC-070

- [x] **BE-13 — Contract validation in CI**
  - Requirements: FR-01 to FR-04, FR-06, FR-07, NFR-01 (all endpoints)
  - Acceptance criteria:
    - CI fails if `plans/openapi.yaml` is invalid.
    - Contract tests check that each implemented endpoint's success and error responses match the schemas in the contract.
    - Any behaviour change that needs a contract change is raised with the user and not made silently.
  - Dependencies: BE-01 (tests are added per endpoint as BE-06 to BE-12 land)
  - Verified by: TC-016, TC-029, TC-051

## B2 — Authentication, seed and scoping

- [x] **BE-05 — Password hashing and session management**
  - Requirements: FR-02, NFR-02 (baseline)
  - Acceptance criteria:
    - Passwords are stored only as salted hashes with a documented work factor; no plaintext anywhere (database, logs, responses).
    - Sessions are server-side; the cookie is httpOnly, SameSite=Lax **[P]** and Secure when served over HTTPS.
    - There is no idle timeout and no lockout in Phase 1 (decision Q5=C); a session ends on logout.
    - A session can be invalidated server-side so a replayed cookie no longer works.
  - Dependencies: BE-01, BE-02
  - Verified by: TC-008, TC-014, TC-094

- [x] **BE-06 — `POST /api/auth/login`**
  - Requirements: FR-02
  - Acceptance criteria:
    - Correct credentials return 200 with the user and set the session cookie; the endpoint never issues a redirect.
    - Wrong password and unknown email return the same 401 status, body shape and message ("Incorrect email or password.").
    - Empty or malformed email, or empty password, returns 400 `VALIDATION_ERROR` with field messages and no session **[P, Q-P5]**.
    - Email matching is case-insensitive.
    - Ten wrong passwords followed by the correct one still succeeds.
    - Two simultaneous identical logins do not produce an error for either.
  - Dependencies: BE-02, BE-05
  - Verified by: TC-001 to TC-008

- [x] **BE-07 — `POST /api/auth/logout` and `GET /api/me`**
  - Requirements: FR-06, FR-02
  - Acceptance criteria:
    - Logout returns 204, clears the cookie and invalidates the session server-side; logout with no session also returns 204.
    - After logout, `/api/me` and every protected endpoint return 401 even if the old cookie is replayed.
    - `/api/me` returns the user with organisation, or 401.
  - Dependencies: BE-05, BE-08
  - Verified by: TC-014, TC-015, TC-017

- [x] **BE-08 — Authentication middleware and organisation scoping**
  - Requirements: FR-04, FR-02
  - Acceptance criteria:
    - Every `/api` route except login, logout and health returns 401 `UNAUTHENTICATED` JSON when there is no valid session.
    - The organisation id comes only from the session; an `organisationId` sent in the query string, a header or the body is ignored.
    - A unit test proves repository calls cannot be made without an organisation id.
  - Dependencies: BE-02, BE-05
  - Verified by: TC-016, TC-034, TC-055

- [x] **BE-03 — Seed script**
  - Requirements: FR-08
  - Acceptance criteria:
    - `npm run seed` creates the data of the agreed seed shape (Q-P4): organisations and users holding 0, 1, 50 and 51 quotes; ORG-B with its own quotes including Q-B1; Q-MULTI with 3 versions; Q-REV with 1 version; Q-NOLINES; at least 5 quotes with the same sort timestamp (Q-TIES).
    - Every quote has exactly one current version, consecutive version numbers from 1, and line totals equal to quantity x unit price.
    - Running the seed twice leaves the same known state with no duplicate references **[P, Q-P5]**.
    - The seed writes a fixtures file mapping the placeholder names (ORG-51, Q-MULTI and so on) to real ids and emails, for use by QA automation **[P]**.
    - Seeded passwords are stored hashed.
  - Dependencies: BE-02, BE-05, Q-P4
  - Verified by: TC-043, TC-045, TC-072, TC-073

- [x] **BE-04 — `seed:revise`**
  - Requirements: FR-08, FR-07
  - Acceptance criteria:
    - `npm run seed:revise -- <quoteId>` creates version n+1 with its line items, marks the previous current version superseded and updates the quote's current version, all in one transaction.
    - Two parallel runs on the same quote leave consecutive version numbers, no duplicates and exactly one current version.
    - An unknown quote id exits non-zero with a clear message and changes nothing.
  - Dependencies: BE-02
  - Verified by: TC-069, TC-070, TC-071, TC-060

## B3 — Quote API

- [x] **BE-09 — `GET /api/quotes`**
  - Requirements: FR-03, FR-04
  - Acceptance criteria:
    - Defaults are page 1, pageSize 20, sort `issued_at:desc`; order is the sort field then id descending.
    - `page` below 1 or not an integer, `pageSize` below 1, above 100 or not an integer **[P, Q-P5]**, and any sort value outside the contract allow-list return 400 `VALIDATION_ERROR` with the message "Could not load quotes. Try again.".
    - For organisations with 0, 1, 50 and 51 quotes, `total` and `totalPages` are correct and walking every page returns each seeded id exactly once, including with `pageSize=1` and `pageSize=50` and with quotes sharing a sort timestamp.
    - `items` is empty and `totalPages` is 0 for an organisation with no quotes; a page beyond the last returns 200 with empty items **[P]**.
    - Only the caller's organisation's quotes are returned and `total` counts only those.
    - A data-source failure returns 500 `INTERNAL_ERROR`, never an empty list.
  - Dependencies: BE-02, BE-08, BE-03 (data), Q-P3, Q-P5
  - Verified by: TC-020 to TC-027, TC-029 to TC-034

- [x] **BE-10 — `GET /api/quotes/{id}`**
  - Requirements: FR-01, FR-04, FR-07
  - Acceptance criteria:
    - Returns the quote, its current version with line items, `currentVersionNo` and all versions newest first.
    - A quote from another organisation, a non-existent id and a malformed id (including `abc`, `' OR 1=1 --` and `../etc/passwd`) return the identical 404 status, body shape and message.
    - A quote with no line items returns an empty `lineItems` array.
    - All database access uses parameterised queries.
    - After `seed:revise`, the next call returns the higher `currentVersionNo`.
  - Dependencies: BE-02, BE-08
  - Verified by: TC-040 to TC-045, TC-048, TC-050, TC-051, TC-053, TC-066

- [x] **BE-11 — `GET /api/quotes/{id}/versions/{versionNo}`**
  - Requirements: FR-01, FR-04, FR-07
  - Acceptance criteria:
    - Returns the version with `isCurrent`, `superseded` (always the inverse of `isCurrent`) and `currentVersionNo`.
    - A version number that does not exist (0, 999, non-numeric) returns 404.
    - Another organisation's quote returns the same 404 as a non-existent version.
  - Dependencies: BE-02, BE-08
  - Verified by: TC-042, TC-052, TC-062, TC-064

- [x] **BE-12 — `GET /api/health`**
  - Requirements: NFR-01
  - Acceptance criteria:
    - Needs no authentication and returns 200 `{status: "ok"}` when the app and database are reachable.
    - Returns 503 `{status: "unavailable"}` when the database cannot be reached **[P]**.
    - The body contains no sensitive or version data.
  - Dependencies: BE-01, BE-02
  - Verified by: TC-080, TC-081

## B4 — Beta readiness

- **BE-14 — Staging deployment (backend)**
  - Requirements: FR-05
  - Acceptance criteria:
    - Backend and database run on staging behind HTTPS and the seed has been run there.
    - A clean deploy from the repository follows documented steps only, with a documented rollback.
    - The staging URL and test accounts are handed to the frontend and QA tasks.
  - Dependencies: BE-06, BE-09, BE-03, Q-P2
  - Verified by: TC-083

- **BE-15 — Uptime monitoring**
  - Requirements: NFR-01
  - Acceptance criteria:
    - A monitor polls `/api/health` on staging at a documented interval.
    - An alert fires after 2 consecutive failed checks and not after a single failure **[P threshold]**.
    - The alert channel and the person paged are recorded (OQ-13). Owner per notes: Sam.
  - Dependencies: BE-12, BE-14, Q-P2
  - Verified by: TC-081, TC-082

- [x] **BE-16 — List performance**
  - Requirements: spec NFR-04 (list performance), FR-03
  - Acceptance criteria:
    - An index supports the list query by organisation, sort field and id.
    - A script generates 10,000 quotes in one organisation for load testing without affecting the standard seed.
    - `GET /api/quotes` p95 is under 500 ms at 10,000 quotes per organisation on the staging-class database **[P]**.
  - Dependencies: BE-09, Q-P6
  - Verified by: TC-093

---
Confidential — Internal Use Only | Page [n]
