# QA Plan — Quote Portal, Phase 1

Status: Draft v0.1 (Session 3), pending user confirmation. Sources: `docs/requirements.md` v0.2, `docs/spec.md` v0.2, `docs/test-cases.md` v0.1 (71 test cases, TC-001 to TC-094). Contract: `plans/openapi.yaml`. Items marked **[P]** are proposals; open questions are in `plans/plan-be.md` section 7 (Q-P1 to Q-P8).

## 1. Goals

- Brief intro: turn the approved test cases into automated checks that are ready to run, and make coverage of every requirement visible.
- Automate every test case in `docs/test-cases.md` at the lowest level that can prove it (unit, API, or UI/E2E), and give the few that cannot be fully automated a scripted manual check with recorded evidence.
- Keep the regression pack (TC-009, 011, 016, 024, 025, 027, 051, 060, 069, 080) runnable on every build, because it covers the two critical 09-25 bugs, data isolation and the newer-version notice.
- Make the test data reproducible from the seed (FR-08), so no test depends on hand-made data.
- Report any requirement without a test case, and any test case whose expected result is still undefined (section 8).

## 2. Scope and the Session 4 / Session 5 boundary

- Brief intro: this plan covers test design, test code, data and environments. It does not cover running the tests.
- **Test EXECUTION happens in Session 5, not in Session 4.** Session 4 builds the product and writes the automation code and test data. Session 5 runs the full suite, records results and logs defects.
- Developers may run their own unit and integration tests in Session 4 to keep the build working (see plan-be and plan-fe, definition of done). These runs are not the recorded test run and are not reported as test results **[P, Q-P8]**.
- **In scope:** all 71 test cases; the test data and fixtures; the test environments; the regression pack; the traceability check.
- **Out of scope:** security testing beyond TC-094 (MFA, patching, lockout and session timeout are out of Phase 1), load testing beyond TC-093, usability studies, and tests for Phase 2 or the real quote source.

## 3. Test levels and tooling

- Brief intro: tools are proposals **[P]** so the plan is concrete; they follow the stack proposed in Q-P1.
- **Unit (U):** developer-level tests run with the project's own runner (Jest or Vitest). QA writes the unit-level cases that depend on seed or repository logic.
- **API (A):** HTTP tests against a running backend (for example Jest with Supertest, or a Postman/Newman collection), plus contract checks against `plans/openapi.yaml`.
- **UI / E2E (E):** Playwright against the running web app, including the stubbed 500, latency and offline cases (network interception) and `axe-core` for accessibility scans.
- **Performance (P):** k6 (or similar) for TC-093.
- **Scripted manual / ops (M):** a written checklist with evidence (screenshots, alert message, document link) for the cases that depend on external systems or people: TC-081, TC-082, TC-084, TC-092.

| Level | Test cases |
| --- | --- |
| Unit (3) | TC-045, TC-069, TC-071 |
| API (26) | TC-002, TC-005, TC-008, TC-016, TC-022, TC-023, TC-024, TC-025, TC-026, TC-027, TC-028, TC-029, TC-030, TC-031, TC-033, TC-034, TC-043, TC-051, TC-052, TC-053, TC-055, TC-070, TC-072, TC-073, TC-080, TC-094 |
| UI / E2E (37) | TC-001, TC-003, TC-004, TC-006, TC-007, TC-009, TC-010, TC-011, TC-012, TC-013, TC-014, TC-015, TC-017, TC-020, TC-021, TC-032, TC-040, TC-041, TC-042, TC-044, TC-046, TC-047, TC-048, TC-050, TC-054, TC-060, TC-061, TC-062, TC-063, TC-064, TC-065, TC-066, TC-067, TC-068, TC-083, TC-090, TC-091 |
| Performance (1) | TC-093 |
| Scripted manual / ops (4) | TC-081, TC-082, TC-084, TC-092 |

- Brief note: the level is the main level; several cases also have an API or UI assertion in the same script (for example TC-004 checks the UI message and that no cookie is set).
- Totals: 3 unit + 26 API + 37 UI / E2E + 1 performance + 4 scripted manual = 71 test cases, each automated or scripted by exactly one task QA-Tnnn in `plans/tasks-qa.md`.

## 4. Test data

- Brief intro: placeholders in `docs/test-cases.md` (ORG-0, ORG-1, ORG-50, ORG-51, ORG-B, Q-MULTI, Q-REV, Q-B1, Q-NOLINES, Q-TIES) become real records through the seed.
- BE-03 writes a fixtures file that maps each placeholder to a real id and login (QA-01 reads it). No test hard-codes ids or emails.
- Default password for seeded users is `Passw0rd!test` **[P]**; all emails use `@example.test`.
- Tests that change data (`seed:revise` in TC-028, TC-060 to TC-062, TC-066, TC-069, TC-070) use Q-REV or a dedicated quote and reset the seed afterwards (QA-02), so test order does not matter.
- Bad ids for TC-048 and TC-051 to TC-053: `does-not-exist`, `abc`, `' OR 1=1 --`, `../etc/passwd`.
- Performance data (TC-093) comes from BE-16's generator (10,000 quotes in one organisation) and is loaded only into the performance environment.
- Open data decisions: seed shape (Q-P4), seed re-run behaviour (Q-P5), Q-NOLINES (must be added to the seed, noted in Session 2).

## 5. Environments

- Brief intro: three environments, each with a fresh seed before a full run.
- **Local / CI:** the app and its database started from the repository, seeded, used for unit, API and E2E runs and for the regression pack on every build.
- **Staging (beta):** the deployed beta (FR-05) used for the smoke test (TC-083), health and monitoring checks (TC-080 to TC-082) and the final full run in Session 5. Hosting is open (Q-P2).
- **Performance:** a staging-class database holding 10,000 quotes in one organisation, separate from the beta data (TC-093).
- Test tooling for stubbing 500s, latency and offline runs in the E2E suite uses network interception in the browser, not changes to the server.

## 6. Dependencies

- Brief intro: what QA automation waits on.
- BE-03 seed and fixtures file; BE-04 `seed:revise`; BE-06 to BE-11 endpoints; BE-12 health; BE-14 and FE-12 for staging; BE-15 for the monitoring checks.
- FE-03, FE-06, FE-07, FE-09 for stable element hooks used in E2E scripts.
- Decisions that turn PENDING cases into runnable ones: TC-028 (Q-P3), TC-006, TC-007, TC-013, TC-020, TC-030, TC-031, TC-044, TC-073 (Q-P5), TC-072 (Q-P4), TC-093 (Q-P6), TC-084 (Q-P7).
- The Figma link (OQ-16) for TC-092, which is blocked until it exists.

## 7. Sequencing and risks

- Brief intro: harness first, then the regression pack, then the rest by area.
- **Order:** QA-01 to QA-03 and QA-05 (harness, fixtures, reset, checklist) → regression pack cases → login and access control → list and pagination → quote view and isolation → newer-version notice and seed → ops and non-functional.
- **Risk: PENDING cases.** Ten cases (TC-006, 007, 013, 020, 028, 030, 031, 044, 072, 073) have undefined expected results. Automation for them is written against the proposed defaults in Q-P3 to Q-P5 and is marked `pending-decision` so a wrong default is cheap to change.
- **Risk: time-based tests.** TC-060 and TC-063 wait up to 60 s or 130 s. Mitigation: the polling interval is a configurable constant, so the suite can shorten it in a dedicated test build while one end-to-end run keeps the real interval.
- **Risk: test order and shared data.** Mitigation: data-changing tests reset the seed (QA-02).
- **Risk: non-automatable cases.** TC-081, TC-082, TC-084 and TC-092 depend on a monitor, people and a design link. They are scripted manual checks with evidence, not automation.
- **Risk: test cases are Draft v0.1.** If the review changes them, tasks are updated; IDs are never renumbered.

## 8. Traceability check (step 6)

- Brief intro: each requirement mapped to at least one backend or frontend task and at least one test case. Gaps are listed after the table. The approved documents are not edited; gaps are for the user to decide.

| Requirement | Backend tasks | Frontend tasks | Test cases | Result |
| --- | --- | --- | --- | --- |
| FR-01 Quote view | BE-02, BE-10, BE-11 | FE-07, FE-08, FE-10 | TC-017, TC-040 to TC-048 | Covered |
| FR-02 Login | BE-05, BE-06, BE-07, BE-08 | FE-02, FE-03, FE-04 | TC-001 to TC-013, TC-016, TC-017 | Covered |
| FR-03 Quote list and pagination | BE-09, BE-16 | FE-06, FE-10 | TC-020 to TC-034 | Covered; TC-028 pending Q-P3 |
| FR-04 Data isolation | BE-08, BE-09, BE-10, BE-11 | FE-02, FE-10 | TC-012, TC-016, TC-034, TC-050 to TC-055 | Covered |
| FR-05 Beta on staging | BE-14 | FE-12 | TC-083, TC-084 | Covered (TC-084 is process evidence; gap G-07, G-08) |
| FR-06 Logout | BE-07 | FE-05 | TC-014, TC-015 | Covered; no AC (G-01) |
| FR-07 Newer-version notice | BE-04, BE-10, BE-11 | FE-08, FE-09 | TC-042, TC-060 to TC-068 | Covered |
| FR-08 Mock data | BE-03, BE-04 | none needed | TC-043, TC-069 to TC-073 | Covered; TC-072 and TC-073 pending Q-P4, Q-P5 |
| NFR-01 Monitoring | BE-12, BE-15 | none needed | TC-080 to TC-082 | Covered |
| NFR-02 (withdrawn; baseline hygiene) | BE-01, BE-05 | none needed | TC-094 | Covered; no AC (G-04) |
| NFR-03 Visual quality and accessibility | none (frontend only) | FE-11 | TC-090 to TC-092 | Covered; TC-092 blocked on OQ-16; no AC |
| NFR-04 Cost (requirements) | none | none | none | **Gap: not testable in the product (G-02)** |
| spec NFR-04 List performance | BE-16 | none needed | TC-093 | Covered under a conflicting ID (G-03) |

- **Result:** every FR-01 to FR-08 and NFR-01 to NFR-03 maps to at least one backend or frontend task and at least one test case. Two requirement-level gaps remain: NFR-04 (cost) has no task or test case, and NFR-04 is used for two different things.

### Gaps and findings (for the user to decide)

- **Inherited from `docs/test-cases.md`** (not edited, listed again so one file shows the whole picture): G-01 FR-06 has no AC; G-02 NFR-04 (cost) is not testable in the app; G-03 NFR-04 ID conflict between requirements and spec; G-04 NFR-02 baseline hygiene has no AC; G-05 list error state has no AC; G-06 AC-013 says one organisation has four different counts; G-07 AC-011 deadline 2026-10-20 has passed; G-08 FR-05 deployment has no AC; G-09 sort key `issued_at` is ambiguous across versions; G-10 several expected results are undefined.
- **New in this session:**
  - **G-11:** `docs/requirements.md` section 6 says an account "must exist and be active", but the data model in `docs/spec.md` has no active flag (plan-be R-6, Q-P5).
  - **G-12:** NFR-03 (spacing and contrast) refers to "the dashboard"; whether that is the portal is open (OQ-15). FE-11 and TC-090 to TC-092 assume it is.
  - **G-13:** Four test cases (TC-081, TC-082, TC-084, TC-092) cannot be fully automated; they are planned as scripted manual checks with evidence.
  - **G-14:** `docs/test-cases.md` is marked Draft v0.1 pending review and the gates folder shows only a Session 1 marker, so it is not confirmed that the test cases are approved (Q-P8).
  - **G-15:** `plans/openapi.yaml` adds two things beyond `docs/spec.md` section 3, both marked **[P]**: `currentVersionNo` in the version response and an optional `details` array on validation errors.

---
Confidential — Internal Use Only | Page [n]
