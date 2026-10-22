# Frontend Plan — Quote Portal, Phase 1

Status: Draft v0.1 (Session 3), pending user confirmation. Sources: `docs/requirements.md` v0.2, `docs/spec.md` v0.2, `docs/test-cases.md` v0.1. The frontend builds against `plans/openapi.yaml`. Items marked **[P]** are proposals; open questions are listed in `plans/plan-be.md` section 7 (Q-P1 to Q-P8).

## 1. Goals

- Brief intro: the customer-facing screens that Acme will use in the beta.
- Let a customer sign in, see a paginated list of their organisation's quotes and open a quote with its current version clearly labelled (FR-02, FR-03, FR-01).
- Eliminate the login redirect loop (critical bug, 09-25): a successful login lands on the intended page exactly once, and a failed login stays on the login screen (FR-02).
- Make pagination work for 0, 1, 50, 51 and many rows (FR-03).
- Tell the customer when a newer version of the quote on screen exists, without removing the version they are reading (FR-07).
- Show clear loading, empty, error and not-found states, with cross-organisation ids shown as "Quote not found." (FR-04).
- Meet the accessibility and visual-quality expectations from the review notes (NFR-03) and be deployable to staging for the beta (FR-05).

## 2. Scope

- Brief intro: three screens plus the shell around them. All data comes from the Phase 1 API.
- **In scope**
  - Login screen, post-login redirect handling, logout control (FR-02, FR-06)
  - Quote list with pagination controls (FR-03)
  - Quote detail, superseded version view, version navigation (FR-01, FR-07)
  - Newer-version banner with refocus and 60 s polling **[P interval]** (FR-07)
  - Loading, empty, error and not-found states
  - Accessibility (contrast, keyboard, screen-reader announcement) and spacing per final designs (NFR-03)
  - Frontend build and staging deployment, with the backend deploy (FR-05)
- **Out of scope**
  - SSO, MFA, password reset, account creation, session timeout and lockout messaging
  - Admin screens, quote creation or editing, notifications
  - Internationalisation (not mentioned in the notes)

## 3. Dependencies

- Brief intro: what the frontend waits on, and what waits on it.
- `plans/openapi.yaml` approved. Until the backend endpoints exist, the frontend uses a mock server generated from the contract.
- Final designs or wireframes from Anita (due 2026-10-06; Figma link not recorded, OQ-16). Without them FE-11 can check contrast and keyboard use but not spacing (TC-092 stays blocked).
- Backend staging (BE-14) for the integration and smoke tests.
- Decisions in `plan-be.md` section 7: Q-P5 (empty-field messages, `/login` when signed in, "No line items." text, page beyond last) and Q-P1 (stack).
- QA needs stable element hooks (accessible names and `data-testid` on key controls) from FE-03, FE-06, FE-07 and FE-09.

## 4. Sequencing

- Brief intro: contract-first, so frontend work starts on day one with a mock server. Task IDs are in `plans/tasks-fe.md`.
- **Milestone F1 — Foundation:** FE-01 scaffold, API client and mock server.
- **Milestone F2 — Sign-in:** FE-02 routing and session bootstrap, FE-03 login screen, FE-04 redirect logic, FE-05 logout.
- **Milestone F3 — Browse and view:** FE-06 quote list, FE-07 quote detail, FE-10 not-found and error handling.
- **Milestone F4 — Revisions:** FE-08 version navigation, FE-09 newer-version banner.
- **Milestone F5 — Polish and beta:** FE-11 accessibility and visual polish, FE-12 staging integration and smoke test.
- Critical path: FE-01 → FE-02 → FE-03 → FE-04, then FE-06/FE-07 → FE-09 → FE-12.
- FE-04 (redirects) is scheduled early and tested against both the mock and the real backend because it carries the critical redirect-loop bug.

## 5. Risks

- Brief intro: risks specific to the frontend.
- **R-1 Redirect loop returns.** Mitigation: a single redirect function with a whitelist, `replace` navigation, and tests for deep link, `next=/login`, external `next` and the expired-session case (TC-009 to TC-013, TC-017); TC-009 is in the regression pack.
- **R-2 Design inputs missing (OQ-16) and "the dashboard" ambiguity (OQ-15).** The spacing and grey-card contrast findings may not even apply to the portal. Mitigation: automated contrast checks now; spacing check waits for the Figma link.
- **R-3 Mock and real backend drift.** Mitigation: the API client is generated from the contract and contract tests run on the backend (BE-13).
- **R-4 Banner polling is noisy or silent.** Interval of 60 s and refocus are proposals. Mitigation: the interval is one constant; tests cover refocus, two revisions, offline and no-change cases (TC-060 to TC-068).
- **R-5 Stale list or stale quote shown after a revision.** The list is fetched when opened, and the quote page re-reads on a timer. Proposed: the list does not poll (Q-P3).
- **R-6 Accessibility standard not stated.** WCAG 2.1 AA is a proposal **[P]** (spec NFR-03).
- **R-7 Beta slipped twice before.** Mitigation: FE-12 is a smoke test of the full flow on staging, started as soon as BE-14 is done.
- **R-8 Cached protected content after logout.** Mitigation: protected pages re-check the session and are not cached by the browser (TC-015).

## 6. Definition of done

- Brief intro: a frontend task is done when all of the following hold.
- The task's acceptance criteria in `plans/tasks-fe.md` are met, against the mock server and, once available, the real backend.
- Every screen has loading, empty (where relevant), error and not-found behaviour as the task describes.
- Messages use the wording in the requirements (for example "Incorrect email or password.", "Quote not found.", "Could not load quotes. Try again.", "A newer version of this quote is available.").
- No stack traces or raw API errors are shown to the user.
- Key controls have accessible names and test hooks for QA automation.
- Developer unit and component tests exist and pass in CI. The formal test run of `docs/test-cases.md` happens in Session 5, not Session 4.

---
Confidential — Internal Use Only | Page [n]
