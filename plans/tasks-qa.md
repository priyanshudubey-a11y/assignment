# QA Tasks — Quote Portal, Phase 1

Status: Draft v0.1 (Session 3). Plan: `plans/plan-qa.md`. Test cases: `docs/test-cases.md` v0.1. Contract: `plans/openapi.yaml`.

- Brief intro: tasks QA-01 to QA-06 build the harness and shared helpers; tasks QA-T001 to QA-T094 automate one test case each (the number matches the test case, so QA-T024 automates TC-024). Gaps in numbering match gaps in `docs/test-cases.md`.
- **These tasks produce test code, data and checklists only. Test EXECUTION happens in Session 5, not in Session 4.**
- A case tagged **pending** has an expected result that `docs/test-cases.md` leaves undefined; its test is written against the proposed default and tagged `pending-decision`. A case tagged **blocked** cannot run until its dependency exists.
- Every automated test carries the tags `@TC-nnn`, its requirement id(s) and, for the regression pack, `@regression`. Tests read ids and logins from the fixtures file and never hard-code them.

## Harness and helpers

- **QA-01 — Test harness, tooling and environments**
  - Requirements / test cases covered: all test cases
  - Acceptance criteria:
    - The API runner, Playwright (UI/E2E), the unit runner and the performance tool run from one documented command each.
    - Configuration exists for local/CI and staging (base URL from an environment variable); nothing is hard-coded.
    - A fixtures loader reads the file written by BE-03 and exposes ORG-0, ORG-1, ORG-50, ORG-51, ORG-B, Q-MULTI, Q-REV, Q-B1, Q-NOLINES, Q-TIES and the user logins by their placeholder names.
    - A sample test of each level runs green against the local build as a harness check; this is not a test-case run.
  - Dependencies: BE-01, BE-03, FE-01

- [x] **QA-02 — Seed reset and data-change helper**
  - Requirements / test cases covered: TC-028, TC-060 to TC-062, TC-066, TC-069, TC-070
  - Acceptance criteria:
    - A helper resets the seed to the known state before and after any data-changing test.
    - A helper runs `seed:revise` for a given quote and returns the new version number.
    - Data-changing tests can run in any order without affecting each other.
  - Dependencies: BE-03, BE-04, QA-01

- [x] **QA-03 — API test helpers**
  - Requirements / test cases covered: FR-02, FR-04 (all API cases)
  - Acceptance criteria:
    - A login helper returns a session for a named seeded user and reuses it within a test file.
    - Shared assertions check the error shape {code, message}, the absence of stack traces, and that two responses are indistinguishable (status, body shape, message), used by TC-005 and TC-051 to TC-053.
    - A list-walker helper requests every page and returns the concatenated ids for pagination tests.
  - Dependencies: QA-01, BE-06

- [x] **QA-04 — Regression pack and CI job**
  - Requirements / test cases covered: TC-009, TC-011, TC-016, TC-024, TC-025, TC-027, TC-051, TC-060, TC-069, TC-080
  - Acceptance criteria:
    - The ten regression cases are tagged `@regression` and run together with one command.
    - A CI job runs the pack on every build and fails the build when any case fails.
    - The job is wired up in Session 4; the first recorded run is part of Session 5.
  - Dependencies: QA-01 and the automation tasks of the ten cases

- [x] **QA-05 — Scripted manual checklist and evidence template**
  - Requirements / test cases covered: TC-081, TC-082, TC-084, TC-092
  - Acceptance criteria:
    - A checklist file holds, for each of the four cases, the steps, the expected result from `docs/test-cases.md`, and where to store the evidence (screenshot, alert message, document link).
    - Each entry has fields for who ran it, the date and the result, left blank until Session 5.
    - TC-092 is marked blocked until the Figma link (OQ-16) exists; TC-084 is marked pending Q-P7.
  - Dependencies: none

- [x] **QA-06 — Traceability report**
  - Requirements / test cases covered: all FR and NFR
  - Acceptance criteria:
    - Every automated test and checklist entry carries its test case id (for example `@TC-024`) and requirement ids as tags.
    - A script produces the matrix requirement → test case → automated test or checklist entry, and fails when a test case in `docs/test-cases.md` has no automation or checklist entry.
    - The report lists test cases tagged `pending-decision` or `blocked` so Session 5 knows which cases are not yet runnable.
  - Dependencies: QA-01

## Login and redirects (FR-02)

- [x] **QA-T001 — Automate TC-001: Valid login lands on the quote list once**
  - Test case / requirements: TC-001; FR-02; AC-001
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-001` implements the Given / When / Then of TC-001 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: quote list shown after exactly one navigation after submit; session cookie set.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-06, FE-03, FE-04

- [x] **QA-T002 — Automate TC-002: Email is matched case-insensitively**
  - Test case / requirements: TC-002; FR-02; AC-001
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-002` implements the Given / When / Then of TC-002 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: login with an upper-case email succeeds.
  - Dependencies: QA-01, QA-03, BE-06

- [x] **QA-T003 — Automate TC-003: Double submit completes one login**
  - Test case / requirements: TC-003; FR-02; AC-001
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-003` implements the Given / When / Then of TC-003 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: double-click and double Enter give one session, one landing on the list, no error banner.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-06, FE-03

- [x] **QA-T004 — Automate TC-004: Wrong password stays on login**
  - Test case / requirements: TC-004; FR-02; AC-002
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-004` implements the Given / When / Then of TC-004 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: stays on login with 'Incorrect email or password.'; no session cookie; no redirect.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-06, FE-03

- [x] **QA-T005 — Automate TC-005: Unknown email response matches wrong password**
  - Test case / requirements: TC-005; FR-02; AC-002
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-005` implements the Given / When / Then of TC-005 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: same 401 status, body shape and message as TC-004.
  - Dependencies: QA-01, QA-03, BE-06

- [x] **QA-T006 — Automate TC-006: Empty fields are refused** — **pending**
  - Test case / requirements: TC-006; FR-02; AC-002
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-006` implements the Given / When / Then of TC-006 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: stays on login with a field-level required message.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
    - The test is written against the proposed default and tagged `pending-decision` until the question is answered; it is not counted as ready until then.
  - Dependencies: QA-01, BE-06, FE-03, Q-P5

- [x] **QA-T007 — Automate TC-007: Malformed email is refused** — **pending**
  - Test case / requirements: TC-007; FR-02; AC-002
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-007` implements the Given / When / Then of TC-007 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: stays on login, no session; wording and status per Q-P5.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
    - The test is written against the proposed default and tagged `pending-decision` until the question is answered; it is not counted as ready until then.
  - Dependencies: QA-01, BE-06, FE-03, Q-P5

- [x] **QA-T008 — Automate TC-008: No lockout after repeated failures**
  - Test case / requirements: TC-008; FR-02; AC-002
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-008` implements the Given / When / Then of TC-008 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: 10 wrong passwords then the correct one succeeds on the 11th attempt.
  - Dependencies: QA-01, QA-03, BE-06

- [x] **QA-T009 — Automate TC-009: Deep link then login has no redirect loop** — regression pack
  - Test case / requirements: TC-009; FR-02; AC-003
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-009` implements the Given / When / Then of TC-009 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: one redirect to login, then lands on the quote, at most one redirect after submit, never back to login.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
    - It is tagged `@regression` and included in the QA-04 job.
  - Dependencies: QA-01, BE-06, BE-10, FE-02, FE-04

- [x] **QA-T010 — Automate TC-010: External redirect target is ignored**
  - Test case / requirements: TC-010; FR-02; AC-003
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-010` implements the Given / When / Then of TC-010 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: lands on the quote list; no navigation to the external site.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, FE-04

- [x] **QA-T011 — Automate TC-011: Redirect target /login causes no loop** — regression pack
  - Test case / requirements: TC-011; FR-02; AC-003
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-011` implements the Given / When / Then of TC-011 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: lands on the quote list.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
    - It is tagged `@regression` and included in the QA-04 job.
  - Dependencies: QA-01, FE-04

- [x] **QA-T012 — Automate TC-012: Deep link to another organisation's quote after login**
  - Test case / requirements: TC-012; FR-02, FR-04; AC-003
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-012` implements the Given / When / Then of TC-012 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: 'Quote not found.' after login; no loop; no data leaked.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-10, FE-04, FE-10

- [x] **QA-T013 — Automate TC-013: Signed-in user opening the login page** — **pending**
  - Test case / requirements: TC-013; FR-02; AC-001
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-013` implements the Given / When / Then of TC-013 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: redirected to the quote list once.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
    - The test is written against the proposed default and tagged `pending-decision` until the question is answered; it is not counted as ready until then.
  - Dependencies: QA-01, FE-04, Q-P5

## Logout and access control (FR-06, FR-02, FR-04)

- [x] **QA-T014 — Automate TC-014: Logout ends the session**
  - Test case / requirements: TC-014; FR-06; none (G-01)
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-014` implements the Given / When / Then of TC-014 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: redirected to login; GET /api/me returns 401.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-07, FE-05

- [x] **QA-T015 — Automate TC-015: Back button after logout shows no data**
  - Test case / requirements: TC-015; FR-06; none (G-01)
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-015` implements the Given / When / Then of TC-015 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: protected pages redirect to login or show no data; API returns 401.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-07, FE-05

- [x] **QA-T016 — Automate TC-016: Protected endpoints deny anonymous access** — regression pack
  - Test case / requirements: TC-016; FR-02, FR-04; AC-009
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-016` implements the Given / When / Then of TC-016 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: 401 with JSON {code, message} for /api/me, /api/quotes, a quote and a version; no data.
    - It is tagged `@regression` and included in the QA-04 job.
  - Dependencies: QA-01, QA-03, BE-08

- [x] **QA-T017 — Automate TC-017: Invalid session sends user to login with return path**
  - Test case / requirements: TC-017; FR-01, FR-02; AC-008
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-017` implements the Given / When / Then of TC-017 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: redirected to login; after login returns to the quote once.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-05, BE-07, FE-02

## Quote list and pagination (FR-03)

- [x] **QA-T020 — Automate TC-020: Zero quotes shows the empty state** — **pending**
  - Test case / requirements: TC-020; FR-03; AC-006
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-020` implements the Given / When / Then of TC-020 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: empty-state message, no error; items=[] and total=0; totalPages per Q-P5.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
    - The test is written against the proposed default and tagged `pending-decision` until the question is answered; it is not counted as ready until then.
  - Dependencies: QA-01, BE-09, FE-06, Q-P5

- [x] **QA-T021 — Automate TC-021: Exactly one quote**
  - Test case / requirements: TC-021; FR-03; AC-005
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-021` implements the Given / When / Then of TC-021 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: 1 row; total=1 and totalPages=1; page controls hidden or disabled.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-09, FE-06

- [x] **QA-T022 — Automate TC-022: Exactly 50 quotes with pageSize=50**
  - Test case / requirements: TC-022; FR-03; AC-005
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-022` implements the Given / When / Then of TC-022 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: 50 rows; total=50; totalPages=1; no second page.
  - Dependencies: QA-01, QA-03, BE-09

- [x] **QA-T023 — Automate TC-023: 50 quotes at default page size**
  - Test case / requirements: TC-023; FR-03; AC-005
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-023` implements the Given / When / Then of TC-023 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: totalPages=3; sizes 20/20/10; 50 distinct ids.
  - Dependencies: QA-01, QA-03, BE-09

- [x] **QA-T024 — Automate TC-024: 51 quotes with pageSize=50 (the >50 rows bug)** — regression pack
  - Test case / requirements: TC-024; FR-03; AC-004
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-024` implements the Given / When / Then of TC-024 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: total=51; totalPages=2; sizes 50/1; union equals the 51 seeded ids, none duplicated or missing.
    - It is tagged `@regression` and included in the QA-04 job.
  - Dependencies: QA-01, QA-03, BE-09

- [x] **QA-T025 — Automate TC-025: 51 or more quotes at default page size** — regression pack
  - Test case / requirements: TC-025; FR-03; AC-004
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-025` implements the Given / When / Then of TC-025 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: sizes 20/20/11 for exactly 51; union equals the seeded set.
    - It is tagged `@regression` and included in the QA-04 job.
  - Dependencies: QA-01, QA-03, BE-09

- [x] **QA-T026 — Automate TC-026: pageSize=1 walked twice gives the same order**
  - Test case / requirements: TC-026; FR-03; AC-004
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-026` implements the Given / When / Then of TC-026 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: 51 pages; identical id sequence in both walks.
  - Dependencies: QA-01, QA-03, BE-09

- [x] **QA-T027 — Automate TC-027: Identical sort timestamps are not duplicated or skipped** — regression pack
  - Test case / requirements: TC-027; FR-03; AC-004
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-027` implements the Given / When / Then of TC-027 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: ties broken by id descending; every Q-TIES quote appears exactly once with pageSize=3.
    - It is tagged `@regression` and included in the QA-04 job.
  - Dependencies: QA-01, QA-03, BE-09, BE-03

- [x] **QA-T028 — Automate TC-028: Revision while paging through the list** — **pending**
  - Test case / requirements: TC-028; FR-03; AC-004
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-028` implements the Given / When / Then of TC-028 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: expected result per Q-P3 (a row can be duplicated or skipped under offset pagination).
    - The test is written against the proposed default and tagged `pending-decision` until the question is answered; it is not counted as ready until then.
  - Dependencies: QA-01, QA-03, QA-02, BE-04, BE-09, Q-P3

- [x] **QA-T029 — Automate TC-029: Invalid page number is rejected**
  - Test case / requirements: TC-029; FR-03; AC-004
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-029` implements the Given / When / Then of TC-029 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: HTTP 400 with JSON {code, message} for page=0, -1 and abc; no stack trace.
  - Dependencies: QA-01, QA-03, BE-09

- [x] **QA-T030 — Automate TC-030: Invalid page size is rejected** — **pending**
  - Test case / requirements: TC-030; FR-03; AC-004
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-030` implements the Given / When / Then of TC-030 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: HTTP 400 for pageSize=0, abc and 100000; maximum per Q-P5.
    - The test is written against the proposed default and tagged `pending-decision` until the question is answered; it is not counted as ready until then.
  - Dependencies: QA-01, QA-03, BE-09, Q-P5

- [x] **QA-T031 — Automate TC-031: Page beyond the last page** — **pending**
  - Test case / requirements: TC-031; FR-03; AC-004
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-031` implements the Given / When / Then of TC-031 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: defined result per Q-P5 (proposed: 200 with empty items).
    - The test is written against the proposed default and tagged `pending-decision` until the question is answered; it is not counted as ready until then.
  - Dependencies: QA-01, QA-03, BE-09, Q-P5

- [x] **QA-T032 — Automate TC-032: List error state is not an empty state**
  - Test case / requirements: TC-032; FR-03; none (G-05)
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-032` implements the Given / When / Then of TC-032 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: 'Could not load quotes. Try again.' with Retry; Retry works after recovery; never shown as 'no quotes'.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-09, FE-06

- [x] **QA-T033 — Automate TC-033: Unsupported sort value is rejected**
  - Test case / requirements: TC-033; FR-03; AC-004
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-033` implements the Given / When / Then of TC-033 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: HTTP 400 for sort=password:asc; no data exposure change.
  - Dependencies: QA-01, QA-03, BE-09

- [x] **QA-T034 — Automate TC-034: List never contains another organisation's quotes**
  - Test case / requirements: TC-034; FR-03, FR-04; AC-009
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-034` implements the Given / When / Then of TC-034 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: only ORG-51 quotes; total equals ORG-51's count.
  - Dependencies: QA-01, QA-03, BE-08, BE-09

## Quote view (FR-01)

- [x] **QA-T040 — Automate TC-040: Current version is shown and labelled**
  - Test case / requirements: TC-040; FR-01; AC-007
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-040` implements the Given / When / Then of TC-040 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: version 3 with a 'Current' label; reference, title, line items and total shown.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-10, FE-07

- [x] **QA-T041 — Automate TC-041: Single-version quote has no banner**
  - Test case / requirements: TC-041; FR-01; AC-007
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-041` implements the Given / When / Then of TC-041 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: version 1 labelled current; no newer-version banner.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-10, FE-07

- [x] **QA-T042 — Automate TC-042: Superseded version is labelled and read-only**
  - Test case / requirements: TC-042; FR-01, FR-07; AC-007
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-042` implements the Given / When / Then of TC-042 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: labelled superseded; read-only; link to the current version.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-11, FE-08

- [x] **QA-T043 — Automate TC-043: Each seeded quote has exactly one current version**
  - Test case / requirements: TC-043; FR-01; AC-007
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-043` implements the Given / When / Then of TC-043 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: exactly one current version per quote; version numbers consecutive from 1.
  - Dependencies: QA-01, QA-03, BE-03

- [x] **QA-T044 — Automate TC-044: Quote with no line items renders** — **pending**
  - Test case / requirements: TC-044; FR-01; AC-007
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-044` implements the Given / When / Then of TC-044 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: page renders; empty line-items message; no crash; exact text per Q-P5.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
    - The test is written against the proposed default and tagged `pending-decision` until the question is answered; it is not counted as ready until then.
  - Dependencies: QA-01, BE-10, FE-07, Q-P5

- [x] **QA-T045 — Automate TC-045: Line and version amounts are consistent**
  - Test case / requirements: TC-045; FR-01; AC-007
  - Level: Unit
  - Acceptance criteria:
    - An automated test tagged `@TC-045` implements the Given / When / Then of TC-045 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: line total = quantity x unit price; version total = sum of line totals; 2-decimal format from minor units.
  - Dependencies: QA-01, BE-02, BE-03, FE-07

- [x] **QA-T046 — Automate TC-046: Data-source failure shows a retryable error**
  - Test case / requirements: TC-046; FR-01; AC-008
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-046` implements the Given / When / Then of TC-046 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: error state with Retry; no stack trace; Retry works after recovery.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-10, FE-07

- [x] **QA-T047 — Automate TC-047: Slow response shows loading, never a false not-found**
  - Test case / requirements: TC-047; FR-01; AC-008
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-047` implements the Given / When / Then of TC-047 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: loading indicator then the quote; no transient 'Quote not found.'.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, FE-07

- [x] **QA-T048 — Automate TC-048: Invalid quote id shows not found**
  - Test case / requirements: TC-048; FR-01; AC-007
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-048` implements the Given / When / Then of TC-048 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: 'Quote not found.' for each bad id; no stack trace; no SQL error text.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-10, FE-10

## Data isolation (FR-04)

- [x] **QA-T050 — Automate TC-050: Another organisation's quote URL is not found**
  - Test case / requirements: TC-050; FR-04; AC-009
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-050` implements the Given / When / Then of TC-050 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: 'Quote not found.'.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-10, FE-10

- [x] **QA-T051 — Automate TC-051: Other-organisation and non-existent ids are indistinguishable** — regression pack
  - Test case / requirements: TC-051; FR-04; AC-009
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-051` implements the Given / When / Then of TC-051 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: same status (404), body shape and message.
    - It is tagged `@regression` and included in the QA-04 job.
  - Dependencies: QA-01, QA-03, BE-10

- [x] **QA-T052 — Automate TC-052: Versions endpoint hides other organisations**
  - Test case / requirements: TC-052; FR-04; AC-009
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-052` implements the Given / When / Then of TC-052 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: 404, same as a non-existent version.
  - Dependencies: QA-01, QA-03, BE-11

- [x] **QA-T053 — Automate TC-053: Probing neighbouring ids resolves only own quotes**
  - Test case / requirements: TC-053; FR-04; AC-009
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-053` implements the Given / When / Then of TC-053 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: only ORG-51 quotes return 200.
  - Dependencies: QA-01, QA-03, BE-10

- [x] **QA-T054 — Automate TC-054: Organisation B sees only its own quotes**
  - Test case / requirements: TC-054; FR-04; AC-009
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-054` implements the Given / When / Then of TC-054 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: list holds only ORG-B quotes; ORG-51's quote is not found.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-09, FE-06, FE-10

- [x] **QA-T055 — Automate TC-055: Client-supplied organisation data is ignored**
  - Test case / requirements: TC-055; FR-04; AC-009
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-055` implements the Given / When / Then of TC-055 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: results unchanged when organisationId is sent in query, header or body.
  - Dependencies: QA-01, QA-03, BE-08

## Newer-version notice (FR-07)

- [x] **QA-T060 — Automate TC-060: Banner appears within the polling interval** — regression pack
  - Test case / requirements: TC-060; FR-07; AC-012
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-060` implements the Given / When / Then of TC-060 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: banner within 60 s; v1 stays visible and read-only; link opens v2.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
    - It is tagged `@regression` and included in the QA-04 job.
  - Dependencies: QA-01, QA-02, BE-04, FE-09

- [x] **QA-T061 — Automate TC-061: Banner appears promptly on refocus**
  - Test case / requirements: TC-061; FR-07; AC-012
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-061` implements the Given / When / Then of TC-061 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: banner within 5 s of refocus without waiting for the next interval.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, QA-02, BE-04, FE-09

- [x] **QA-T062 — Automate TC-062: Two revisions link to the latest version**
  - Test case / requirements: TC-062; FR-07; AC-012
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-062` implements the Given / When / Then of TC-062 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: link goes to the latest version (v3), not v2.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, QA-02, BE-04, FE-09

- [x] **QA-T063 — Automate TC-063: No false banner when nothing changes**
  - Test case / requirements: TC-063; FR-07; AC-012
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-063` implements the Given / When / Then of TC-063 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: no banner after 2 intervals; no flicker or console errors.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, FE-09

- [x] **QA-T064 — Automate TC-064: Following the banner link shows the current version**
  - Test case / requirements: TC-064; FR-07; AC-012
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-064` implements the Given / When / Then of TC-064 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: newest version shown, labelled current; banner gone.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, FE-08, FE-09

- [x] **QA-T065 — Automate TC-065: Banner shows on load for a superseded version**
  - Test case / requirements: TC-065; FR-07; AC-012
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-065` implements the Given / When / Then of TC-065 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: banner present on load; labelled superseded.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, FE-08, FE-09

- [x] **QA-T066 — Automate TC-066: Revision between list load and open**
  - Test case / requirements: TC-066; FR-07; AC-012
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-066` implements the Given / When / Then of TC-066 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: the new current version opens; no stale version.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, QA-02, BE-04, BE-10, FE-07

- [x] **QA-T067 — Automate TC-067: Network drop during polling**
  - Test case / requirements: TC-067; FR-07; AC-012
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-067` implements the Given / When / Then of TC-067 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: no false banner offline; no repeated error toasts; polling resumes online.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, FE-09

- [x] **QA-T068 — Automate TC-068: Banner is announced to screen readers**
  - Test case / requirements: TC-068; FR-07; AC-012
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-068` implements the Given / When / Then of TC-068 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: announced without stealing focus (role=status check).
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, FE-09

## Mock data and seed (FR-08)

- [x] **QA-T069 — Automate TC-069: seed:revise issues a new current version** — regression pack
  - Test case / requirements: TC-069; FR-08; AC-014
  - Level: Unit
  - Acceptance criteria:
    - An automated test tagged `@TC-069` implements the Given / When / Then of TC-069 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: version_no +1; previous superseded_at set; exactly one current.
    - It is tagged `@regression` and included in the QA-04 job.
  - Dependencies: QA-01, QA-02, BE-04

- [x] **QA-T070 — Automate TC-070: Parallel seed:revise runs stay consistent**
  - Test case / requirements: TC-070; FR-08; AC-014
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-070` implements the Given / When / Then of TC-070 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: versions 2 and 3 exist; no duplicate version number; exactly one current.
  - Dependencies: QA-01, QA-03, QA-02, BE-04

- [x] **QA-T071 — Automate TC-071: seed:revise with an unknown quote fails cleanly**
  - Test case / requirements: TC-071; FR-08; AC-014
  - Level: Unit
  - Acceptance criteria:
    - An automated test tagged `@TC-071` implements the Given / When / Then of TC-071 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: non-zero exit; clear error; no data changed.
  - Dependencies: QA-01, BE-04

- [x] **QA-T072 — Automate TC-072: Seed produces all required shapes** — **pending**
  - Test case / requirements: TC-072; FR-08; AC-013
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-072` implements the Given / When / Then of TC-072 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: organisations with 0, 1, 50 and 51+ quotes; a quote with 2+ versions; ORG-B with its own quotes; exact shape per Q-P4.
    - The test is written against the proposed default and tagged `pending-decision` until the question is answered; it is not counted as ready until then.
  - Dependencies: QA-01, QA-03, BE-03, Q-P4

- [x] **QA-T073 — Automate TC-073: Running the seed twice does not duplicate data** — **pending**
  - Test case / requirements: TC-073; FR-08; AC-013
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-073` implements the Given / When / Then of TC-073 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: references unique; counts unchanged or reset to the known state per Q-P5.
    - The test is written against the proposed default and tagged `pending-decision` until the question is answered; it is not counted as ready until then.
  - Dependencies: QA-01, QA-03, BE-03, Q-P5

## Beta, monitoring and operations (FR-05, NFR-01)

- [x] **QA-T080 — Automate TC-080: Health endpoint reports healthy** — regression pack
  - Test case / requirements: TC-080; NFR-01; AC-010
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-080` implements the Given / When / Then of TC-080 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: 200 with {status}; no authentication; no sensitive data.
    - It is tagged `@regression` and included in the QA-04 job.
  - Dependencies: QA-01, QA-03, BE-12

- [x] **QA-T081 — Automate TC-081: Alert after consecutive failed checks**
  - Test case / requirements: TC-081; NFR-01; AC-010
  - Level: Scripted manual / ops
  - Acceptance criteria:
    - A checklist entry for TC-081 exists in the QA-05 checklist with steps, the expected result (**alert after 2 consecutive failed checks (proposed); alert channel per OQ-13**) and an evidence field.
    - The check is scripted as far as the tools allow (for example a command that stops the backend); the evidence and the pass or fail call are recorded by a person in Session 5.
  - Dependencies: QA-05, BE-15, QA-05, Q-P2

- [x] **QA-T082 — Automate TC-082: Single failed check raises no alert**
  - Test case / requirements: TC-082; NFR-01; AC-010
  - Level: Scripted manual / ops
  - Acceptance criteria:
    - A checklist entry for TC-082 exists in the QA-05 checklist with steps, the expected result (**no alert after one failed check**) and an evidence field.
    - The check is scripted as far as the tools allow (for example a command that stops the backend); the evidence and the pass or fail call are recorded by a person in Session 5.
  - Dependencies: QA-05, BE-15, QA-05

- [x] **QA-T083 — Automate TC-083: Staging smoke test**
  - Test case / requirements: TC-083; FR-05; none (G-08)
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-083` implements the Given / When / Then of TC-083 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: HTTPS reachable; login works; list and a quote open.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, BE-14, FE-12

- [x] **QA-T084 — Automate TC-084: Acme beta feedback is recorded by the deadline** — **pending**
  - Test case / requirements: TC-084; FR-05; AC-011
  - Level: Scripted manual / ops
  - Acceptance criteria:
    - A checklist entry for TC-084 exists in the QA-05 checklist with steps, the expected result (**a dated record on or before 2026-10-20; deadline has passed (Q-P7)**) and an evidence field.
    - The check is scripted as far as the tools allow (for example a command that stops the backend); the evidence and the pass or fail call are recorded by a person in Session 5.
    - The test is written against the proposed default and tagged `pending-decision` until the question is answered; it is not counted as ready until then.
  - Dependencies: QA-05, QA-05, Q-P7

## Non-functional (NFR-02 baseline, NFR-03, spec NFR-04)

- [x] **QA-T090 — Automate TC-090: Automated accessibility scan**
  - Test case / requirements: TC-090; NFR-03; none
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-090` implements the Given / When / Then of TC-090 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: no colour-contrast violations on login, list and quote pages, including grey cards.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, FE-11

- [x] **QA-T091 — Automate TC-091: Keyboard-only use**
  - Test case / requirements: TC-091; NFR-03; none
  - Level: UI / E2E
  - Acceptance criteria:
    - An automated test tagged `@TC-091` implements the Given / When / Then of TC-091 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: login, paging and the banner link reachable in logical order with visible focus.
    - It drives the browser through accessible names or the `data-testid` hooks from the frontend tasks, with no fixed sleeps.
  - Dependencies: QA-01, FE-11

- [x] **QA-T092 — Automate TC-092: Spacing matches the final designs** — **blocked**
  - Test case / requirements: TC-092; NFR-03; none
  - Level: Scripted manual / ops
  - Acceptance criteria:
    - A checklist entry for TC-092 exists in the QA-05 checklist with steps, the expected result (**spacing matches the Figma designs; blocked until OQ-16 supplies the link**) and an evidence field.
    - The check is scripted as far as the tools allow (for example a command that stops the backend); the evidence and the pass or fail call are recorded by a person in Session 5.
    - The test is a placeholder tagged `blocked` until the dependency exists.
  - Dependencies: QA-05, FE-11, QA-05, OQ-16

- [x] **QA-T093 — Automate TC-093: List performance at 10,000 quotes** — **pending**
  - Test case / requirements: TC-093; spec NFR-04 (list performance); none (G-03)
  - Level: Performance
  - Acceptance criteria:
    - An automated test tagged `@TC-093` implements the Given / When / Then of TC-093 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: p95 under 500 ms over 200 requests (proposed); NFR ID per Q-P6.
    - It loads the BE-16 data set, calls `GET /api/quotes` 200 times and computes p95.
    - The test is written against the proposed default and tagged `pending-decision` until the question is answered; it is not counted as ready until then.
  - Dependencies: QA-01, BE-16, Q-P6

- [x] **QA-T094 — Automate TC-094: Baseline security hygiene**
  - Test case / requirements: TC-094; NFR-02 (baseline hygiene); none (G-04)
  - Level: API
  - Acceptance criteria:
    - An automated test tagged `@TC-094` implements the Given / When / Then of TC-094 using the data named in `docs/test-cases.md`, taken from the fixtures file.
    - The test passes only when: passwords hashed; session cookie httpOnly (and Secure on HTTPS); no stack traces in error bodies.
  - Dependencies: QA-01, QA-03, BE-01, BE-05

---
Confidential — Internal Use Only | Page [n]
