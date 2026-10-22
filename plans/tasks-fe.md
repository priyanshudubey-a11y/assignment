# Frontend Tasks — Quote Portal, Phase 1

Status: Draft v0.1 (Session 3). Plan: `plans/plan-fe.md`. Contract: `plans/openapi.yaml`. Test cases: `docs/test-cases.md`.

- Brief intro: each task is small and independently verifiable. "Verified by" lists the test cases that will exercise it in Session 5; they are not run in Session 4.
- Messages quoted below come from requirements section 6 unless marked **[P]**.

## F1 — Foundation

- **FE-01 — Scaffold, API client and mock server**
  - Requirements: foundation for FR-01 to FR-04, FR-06, FR-07
  - Acceptance criteria:
    - The React app starts from one command and `/api` calls go to the same origin through a dev proxy.
    - The API client and its types are generated from `plans/openapi.yaml`, so a contract change breaks the build instead of drifting.
    - A mock server started from one command serves all seven endpoints from the contract examples, so screens can be built before the backend exists.
    - Lint and the unit test runner work in CI.
  - Dependencies: `plans/openapi.yaml`, Q-P1
  - Verified by: none directly (enables all UI tests)

## F2 — Sign-in

- **FE-02 — Routing, session bootstrap and auth guard**
  - Requirements: FR-02, FR-04
  - Acceptance criteria:
    - The app calls `GET /api/me` before showing any protected page; no protected content flashes while it is pending.
    - A signed-out visitor to a protected URL is sent to the login page once, carrying the original path as `next`.
    - A 401 from any API call clears the user state and sends the user to login with the current path as `next`; after sign-in they return to that page once.
    - Protected pages are not cached by the browser (`Cache-Control` on the app shell and no cached API data after logout).
  - Dependencies: FE-01
  - Verified by: TC-009, TC-016, TC-017

- **FE-03 — Login screen**
  - Requirements: FR-02
  - Acceptance criteria:
    - Email and password fields with labels, a submit button, and required-field and malformed-email messages shown per field without sending a request **[P wording, Q-P5]**.
    - The submit button is disabled while a request is in flight; double-click or pressing Enter twice sends one request and causes one navigation.
    - A 401 shows "Incorrect email or password." on the login screen, with no redirect, and does not say which field was wrong.
    - Email is sent as typed; the case-insensitive match is the backend's.
    - The password is never put in the URL, local storage or logs.
    - Error text is announced to screen readers and focus moves to the first problem.
  - Dependencies: FE-02
  - Verified by: TC-001 to TC-008

- **FE-04 — Post-login redirect and return path**
  - Requirements: FR-02
  - Acceptance criteria:
    - After a successful login the app navigates once, using `replace`, to `next` when it is a same-origin path matching the whitelist (quote list, a quote, a quote version), otherwise to the quote list.
    - `next=/login`, an external URL, a protocol-relative URL and an invalid path all lead to the quote list, never back to login.
    - A deep link to another organisation's quote ends on "Quote not found." after login, with no loop.
    - A signed-in user who opens the login page is sent to the quote list once **[P, Q-P5]**.
  - Dependencies: FE-02, FE-03
  - Verified by: TC-001, TC-009 to TC-013, TC-017

- **FE-05 — Logout**
  - Requirements: FR-06
  - Acceptance criteria:
    - A logout control is visible on every signed-in page.
    - Activating it calls `POST /api/auth/logout`, clears the user state and shows the login page.
    - Using the browser Back button afterwards shows the login page or no data, never cached quote content.
  - Dependencies: FE-02, BE-07 (real backend), mock until then
  - Verified by: TC-014, TC-015

## F3 — Browse and view

- **FE-06 — Quote list page**
  - Requirements: FR-03
  - Acceptance criteria:
    - A table shows reference, title, status, current version, total (formatted with 2 decimals from minor units and the currency) and issue date.
    - Default page size is 20; pagination controls show the current page and `totalPages`, and are hidden or disabled when there is one page.
    - The page number is in the URL, so reload and the Back button keep the position.
    - Walking all pages shows every quote once, for 0, 1, 50 and 51 quotes, including `pageSize=50` **[P: the page size is not user-changeable in Phase 1, the test uses the API]**.
    - Zero quotes shows an empty state, not an error; a failed request shows "Could not load quotes. Try again." with a Retry button and is never shown as an empty list.
    - A loading state is shown while the request runs.
    - If the requested page is beyond the last page and there are quotes, the app goes to the last page **[P]**.
    - Clicking a row opens that quote.
  - Dependencies: FE-02, Q-P5
  - Verified by: TC-020 to TC-023, TC-032, TC-034

- **FE-07 — Quote detail page**
  - Requirements: FR-01
  - Acceptance criteria:
    - Shows reference, title, version number with a "Current" label, line items (description, quantity, unit price, line total) and the version total; amounts have 2 decimals from integer minor units.
    - A quote with no line items renders with the message "No line items." and no error **[P, Q-P5]**.
    - A loading state is shown and "Quote not found." never flashes while loading.
    - A failed request shows a retryable error state with no stack trace; Retry works after recovery.
    - The page URL contains the quote id, so deep links work (see FE-04).
  - Dependencies: FE-02
  - Verified by: TC-040, TC-041, TC-044 to TC-047

- **FE-10 — Not-found and error handling**
  - Requirements: FR-01, FR-03, FR-04
  - Acceptance criteria:
    - A 404 for a quote or version (unknown, malformed or another organisation's id) shows "Quote not found." with a link back to the list; the message and layout are identical for all three cases.
    - A top-level error boundary shows a generic message for unexpected failures, with no stack traces, SQL text or raw API bodies.
    - Network failure states offer Retry.
  - Dependencies: FE-06, FE-07
  - Verified by: TC-012, TC-048, TC-050, TC-054

## F4 — Revisions

- **FE-08 — Version navigation and superseded view**
  - Requirements: FR-01, FR-07
  - Acceptance criteria:
    - The quote page lists the available versions and links to each.
    - A superseded version is labelled "Superseded", is read-only and has a link to the current version.
    - Opening a superseded version directly shows the newer-version banner on load (FR-07).
  - Dependencies: FE-07
  - Verified by: TC-042, TC-065

- **FE-09 — Newer-version banner**
  - Requirements: FR-07
  - Acceptance criteria:
    - While a quote is open, the app re-reads the quote on window refocus and every 60 s **[P interval]**, and compares `currentVersionNo` with the version on screen.
    - When it is higher, a banner "A newer version of this quote is available." appears with a link to the latest version (v3 if two revisions happened); the version on screen stays visible and read-only.
    - The banner appears within 60 s of a revision and within 5 s of refocus.
    - No banner appears when nothing changed over two intervals, and no flicker or console errors.
    - A failed poll shows no banner and no error flood; polling resumes when the network returns.
    - Following the link shows the current version and removes the banner.
    - The banner has `role="status"` so it is announced without moving focus **[P]**.
    - Polling stops when the user leaves the quote page.
  - Dependencies: FE-07, FE-08
  - Verified by: TC-060 to TC-068

## F5 — Polish and beta

- **FE-11 — Accessibility and visual polish**
  - Requirements: NFR-03
  - Acceptance criteria:
    - An automated accessibility scan (WCAG 2.1 AA ruleset **[P]**) finds no colour-contrast violations on login, list and quote pages, including grey cards.
    - Login, list paging and the banner link can be completed with the keyboard only, in a logical order, with visible focus.
    - Spacing matches the final designs, checked against the Figma link when supplied (OQ-16); until then this part is recorded as blocked.
  - Dependencies: FE-03, FE-06, FE-07, FE-09; designs (OQ-16)
  - Verified by: TC-090, TC-091, TC-092

- **FE-12 — Staging build and smoke test**
  - Requirements: FR-05
  - Acceptance criteria:
    - The frontend builds from a clean checkout and is served on staging over HTTPS from the same origin as the API.
    - A smoke run on staging shows login, the list and one quote opening for a seeded user.
    - The staging URL and test accounts are shared for the Acme beta.
  - Dependencies: BE-14, FE-03, FE-06, FE-07, Q-P2
  - Verified by: TC-083

---
Confidential — Internal Use Only | Page [n]
