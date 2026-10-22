# Test Cases — Quote Portal, Phase 1

Status: Draft v0.2 (Session 2), pending your confirmation. Decisions Q1 to Q5 were taken by BA judgement at your request and are listed in section 6. Source: `docs/requirements.md` v0.2 and `docs/spec.md` v0.2. Test execution happens in Session 5.

- **Intro:** every case is traced to a requirement ID and an AC ID. Types: functional, negative, edge, regression. Where the documents do not define the expected result, the case uses the decision recorded in section 6.
- **Cases that depend on a judgement call:** TC-006, 007, 013, 020, 028, 030, 031, 044, 072, 073, 084. Reverse any decision in section 6 and these change.

## 1. Test data

- Placeholders are used because the seed names are not yet defined (decision D2: one organisation per quote count). All emails use the `@example.test` domain. Default password for seeded users: `Passw0rd!test` **[P]**.

| Data ID | Description |
| --- | --- |
| ORG-0 / U-0 | Organisation with 0 quotes, and its customer user |
| ORG-1 / U-1 | Organisation with exactly 1 quote |
| ORG-50 / U-50 | Organisation with exactly 50 quotes |
| ORG-51 / U-51 | Organisation with 51 or more quotes, including Q-MULTI and Q-REV below |
| ORG-B / U-B | A different organisation with its own quotes, including Q-B1 |
| Q-MULTI | Quote in ORG-51 with 3 versions (v3 current, v1 and v2 superseded) |
| Q-REV | Quote in ORG-51 with a single version (v1), used for revision tests |
| Q-B1 | Quote belonging to ORG-B (never visible to U-51) |
| Q-NOLINES | Quote with a current version and zero line items (added to the seed by decision D4) |
| Q-TIES | At least 5 quotes in ORG-51 with identical sort timestamp |
| Bad IDs | `does-not-exist`, `abc`, `' OR 1=1 --`, `../etc/passwd` |

## 2. Test cases

### 2.1 Login and redirects (FR-02)

| TC ID | Req / AC | Type | Scenario (Given / When / Then) | Preconditions | Test data | Expected result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-001 | FR-02 / AC-001 | functional | Given a valid customer, when they submit correct credentials, then they land on the quote list | Seed run; signed out | U-51 / valid password | Quote list shown; exactly one navigation after submit (no intermediate redirects); session cookie set |
| TC-002 | FR-02 / AC-001 | edge | Given a valid customer, when they enter their email in different letter case, then login still works | As above | `U-51@EXAMPLE.TEST` | Login succeeds (email is case-insensitive) |
| TC-003 | FR-02 / AC-001 | edge | Given the login form, when the user double-clicks submit or presses Enter twice, then only one login completes | As above | U-51 | One session, one landing on the list, no error banner |
| TC-004 | FR-02 / AC-002 | negative | Given a valid email, when the password is wrong, then the user stays on login | Signed out | U-51 / wrong password | Stays on login; message "Incorrect email or password."; no session cookie; no redirect |
| TC-005 | FR-02 / AC-002 | negative | Given an unknown email, when the user submits, then the response matches the wrong-password response | Signed out | `nobody@example.test` | Same message, same HTTP status (401) and same response body shape as TC-004 (no account enumeration) |
| TC-006 | FR-02 / AC-002 | negative | Given empty fields, when the user submits, then login is refused | Signed out | Empty email and/or password | Stays on login; inline "Enter a valid email." for an empty email and "Enter your password." for an empty password; no API request is sent |
| TC-007 | FR-02 / AC-002 | negative | Given a malformed email, when the user submits, then login is refused | Signed out | `not-an-email` | Stays on login; inline "Enter a valid email."; no API request sent; no session |
| TC-008 | FR-02 / AC-002 | negative | Given repeated failures, when 10 wrong passwords are submitted and then the correct one, then login still works | Signed out | U-51 | No lockout (Q5=C); the correct password succeeds on the 11th attempt |
| TC-009 | FR-02 / AC-003 | regression | Given a signed-out user opens a quote deep link, when they sign in, then they reach that quote with no loop (critical bug from 09-25) | Signed out | `/quotes/Q-MULTI` as U-51 | Redirected to login once; after login lands on Q-MULTI; at most one redirect after submit; never returns to login |
| TC-010 | FR-02 / AC-003 | negative | Given a login URL with an external redirect target, when the user signs in, then the external target is ignored | Signed out | `?next=https://evil.example` | Lands on the quote list; no navigation to the external site |
| TC-011 | FR-02 / AC-003 | negative | Given a redirect target that is the login page itself, when the user signs in, then no loop occurs | Signed out | `?next=/login` | Lands on the quote list |
| TC-012 | FR-02, FR-04 / AC-003 | edge | Given a deep link to another organisation's quote, when U-51 signs in, then the result is "not found", not a loop | Signed out | `/quotes/Q-B1` as U-51 | After login shows "Quote not found."; no loop; no data leaked |
| TC-013 | FR-02 / AC-001 | edge | Given a signed-in user, when they open the login page, then they are not stuck | Signed in | U-51 | Redirected to the quote list once; no loop |

### 2.2 Logout and access control (FR-06, FR-02, FR-04)

| TC ID | Req / AC | Type | Scenario (Given / When / Then) | Preconditions | Test data | Expected result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-014 | FR-06 / none (G-01) | functional | Given a signed-in user, when they log out, then the session ends | Signed in | U-51 | Redirected to login; `GET /api/me` returns 401 |
| TC-015 | FR-06 / none (G-01) | negative | Given a user has logged out, when they press the browser Back button, then no quote data is shown | Logged out | U-51 | Protected pages redirect to login or show no data; API calls return 401 |
| TC-016 | FR-02, FR-04 / AC-009 | negative | Given no session, when protected endpoints are called, then access is denied | Signed out | `/api/me`, `/api/quotes`, `/api/quotes/Q-MULTI`, `/api/quotes/Q-MULTI/versions/1` | All return 401 with JSON `{code, message}`; no quote data |
| TC-017 | FR-01 / AC-008 | negative | Given a session becomes invalid while a quote is open, when the page next calls the API, then the user is sent to login with the return path | Signed in on Q-MULTI | Delete cookie server-side | Redirected to login; after login returns to Q-MULTI once |

### 2.3 Quote list and pagination (FR-03)

Default page size is 20 (spec). "Walk all pages" means requesting page 1 to the last page and concatenating the items.

| TC ID | Req / AC | Type | Scenario (Given / When / Then) | Preconditions | Test data | Expected result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-020 | FR-03 / AC-006 | edge | Given an organisation with zero quotes, when the user opens the list, then an empty state is shown | Signed in | U-0 | Empty-state message, no error; API `items=[]`, `total=0`, `totalPages=0` |
| TC-021 | FR-03 / AC-005 | edge | Given exactly one quote, when the list opens, then one row and one page are shown | Signed in | U-1 | 1 row; `total=1`, `totalPages=1`; page controls hidden or disabled |
| TC-022 | FR-03 / AC-005 | edge | Given exactly 50 quotes and `pageSize=50`, when the list opens, then everything is on one page | Signed in | U-50, `pageSize=50` | 50 rows; `total=50`, `totalPages=1`; no second page |
| TC-023 | FR-03 / AC-005 | functional | Given 50 quotes and the default page size, when the user walks all pages, then pages hold 20, 20 and 10 | Signed in | U-50 | `totalPages=3`; sizes 20/20/10; 50 distinct IDs |
| TC-024 | FR-03 / AC-004 | regression | Given 51 quotes and `pageSize=50` (the ">50 rows" bug), when the user walks all pages, then page 1 holds 50 and page 2 holds 1 | Signed in | U-51, `pageSize=50` | `total=51`, `totalPages=2`; sizes 50/1; the union is exactly the 51 seeded IDs, none duplicated or missing |
| TC-025 | FR-03 / AC-004 | functional | Given 51 or more quotes and the default page size, when the user walks all pages, then no row is lost or repeated | Signed in | U-51 | Sizes 20/20/11 (if exactly 51); the union equals the seeded set |
| TC-026 | FR-03 / AC-004 | edge | Given `pageSize=1`, when the user walks 51 pages twice, then the order is identical both times | Signed in | U-51, `pageSize=1` | 51 pages; the same ID sequence in both walks |
| TC-027 | FR-03 / AC-004 | edge | Given quotes with identical sort timestamps, when the user pages across them, then none is duplicated or skipped | Signed in | U-51 with Q-TIES, `pageSize=3` | Tie broken by id descending; every Q-TIES quote appears exactly once |
| TC-028 | FR-03 / AC-004 | edge | Given the user is on page 2, when a quote is revised and the list re-sorts, then page 3 is requested | Signed in on page 2 | U-51; run `seed:revise` on a quote on page 1 | The quote's list position does not change (the sort date is the quote's original issue date); walking pages 1 to last after the revision returns every seeded ID exactly once, in the same order as before; the revised quote shows its new version number |
| TC-029 | FR-03 / AC-004 | negative | Given an invalid page number, when the list is requested, then it is rejected | Signed in | `page=0`, `page=-1`, `page=abc` | HTTP 400 with JSON `{code, message}`; UI shows "Could not load quotes. Try again."; no stack trace |
| TC-030 | FR-03 / AC-004 | negative | Given an invalid page size, when the list is requested, then it is rejected | Signed in | `pageSize=0`, `pageSize=abc`, `pageSize=101`, plus `pageSize=100` as the valid upper bound | `0`, `abc` and `101` return HTTP 400 with JSON `{code, message}`; `100` returns 200 |
| TC-031 | FR-03 / AC-004 | edge | Given a page number beyond the last page, when requested, then the result is defined | Signed in | U-51, `page=999` | HTTP 200 with `items=[]` and correct `total` and `totalPages`; UI shows an empty page with a way back to the last page, not an error |
| TC-032 | FR-03 / none (G-05) | negative | Given the quote service fails, when the list is requested, then an error state is shown and not an empty state | Signed in; stub 500 or timeout | U-51 | "Could not load quotes. Try again." with retry; retry succeeds after recovery; not shown as "no quotes" |
| TC-033 | FR-03 / AC-004 | negative | Given an unsupported sort value, when the list is requested, then it is rejected | Signed in | `sort=password:asc` | HTTP 400; no change in data exposure |
| TC-034 | FR-03, FR-04 / AC-009 | negative | Given two organisations, when U-51 walks the list, then no ORG-B quote appears | Signed in | U-51 | Only ORG-51 quotes; none of ORG-B's IDs; `total` equals ORG-51's count |

### 2.4 Quote view (FR-01)

Fields shown on a quote are not defined (OQ-07). Cases assert the reference, title, version number, line items and total, which the spec data model contains.

| TC ID | Req / AC | Type | Scenario (Given / When / Then) | Preconditions | Test data | Expected result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-040 | FR-01 / AC-007 | functional | Given a quote with several versions, when the customer opens it, then the current version is shown and labelled | Signed in | U-51, Q-MULTI | Version 3 displayed with a "Current" label; reference, title, line items and total shown |
| TC-041 | FR-01 / AC-007 | functional | Given a quote with one version, when opened, then it is labelled current with no banner | Signed in | U-51, Q-REV | Version 1 labelled current; no newer-version banner |
| TC-042 | FR-01, FR-07 / AC-007 | alternate | Given a superseded version, when opened, then it is labelled and read-only with a link to the current version | Signed in | U-51, Q-MULTI v1 | Labelled superseded; read-only; link to v3 |
| TC-043 | FR-01 / AC-007 | edge | Given all seeded quotes, when the data is checked, then each has exactly one current version | Seed run | All ORG-51 quotes | Exactly one current version per quote; version numbers consecutive from 1 |
| TC-044 | FR-01 / AC-007 | edge | Given a quote with no line items, when opened, then it renders without error | Signed in | U-51, Q-NOLINES | Page renders; line-items area shows "No line items"; total shows 0.00; no crash |
| TC-045 | FR-01 / AC-007 | functional | Given line items, when the quote is shown, then amounts are consistent | Signed in | U-51, Q-MULTI | Each line total equals quantity x unit price; version total equals the sum of line totals; amounts formatted with 2 decimals from integer minor units |
| TC-046 | FR-01 / AC-008 | negative | Given the data source fails, when a quote is opened, then a retryable error is shown | Signed in; stub 500 | U-51, Q-MULTI | Error state with Retry; no stack trace; Retry works after recovery |
| TC-047 | FR-01 / AC-008 | edge | Given a slow response, when a quote is opened, then a loading state shows and "not found" never flashes | Signed in; add 3 s latency | U-51, Q-MULTI | Loading indicator, then the quote; no transient "Quote not found." |
| TC-048 | FR-01 / AC-007 | negative | Given an invalid quote ID, when opened, then "Quote not found." is shown | Signed in | Bad IDs | 404 or 400 as the API defines; UI shows "Quote not found."; no stack trace; no SQL error text |

### 2.5 Data isolation (FR-04)

| TC ID | Req / AC | Type | Scenario (Given / When / Then) | Preconditions | Test data | Expected result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-050 | FR-04 / AC-009 | functional | Given U-51 is signed in, when they open another organisation's quote URL, then it is not found | Signed in | `/quotes/Q-B1` as U-51 | "Quote not found." |
| TC-051 | FR-04 / AC-009 | negative | Given the API, when U-51 requests Q-B1 and a non-existent ID, then the responses are indistinguishable | Signed in | `GET /api/quotes/Q-B1`, `GET /api/quotes/does-not-exist` | Same status (404), same body shape and message |
| TC-052 | FR-04 / AC-009 | negative | Given the versions endpoint, when U-51 requests ORG-B's version, then it is not found | Signed in | `/api/quotes/Q-B1/versions/1` | 404, same as a non-existent version |
| TC-053 | FR-04 / AC-009 | negative | Given sequential IDs, when U-51 probes neighbouring IDs, then only own-organisation quotes ever resolve | Signed in | IDs around Q-MULTI and Q-B1 | Only ORG-51 quotes return 200 |
| TC-054 | FR-04 / AC-009 | functional | Given ORG-B, when U-B signs in, then they see their own quotes and none of ORG-51's | Signed in | U-B | List contains only ORG-B quotes; `/quotes/Q-MULTI` is not found |
| TC-055 | FR-04 / AC-009 | negative | Given client-supplied organisation data, when sent, then it is ignored | Signed in | U-51 with `organisationId=ORG-B` in query string, header or body | Results unchanged; still ORG-51 only |

### 2.6 Newer-version notice (FR-07)

The refresh interval is 60 s and also on window refocus (spec, proposed).

| TC ID | Req / AC | Type | Scenario (Given / When / Then) | Preconditions | Test data | Expected result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-060 | FR-07 / AC-012 | functional | Given a customer views v1, when v2 is issued, then the banner appears within the interval | U-51 on Q-REV v1 | Run `seed:revise -- Q-REV` | "Newer version available" banner within 60 s; v1 stays visible and read-only; link opens v2 |
| TC-061 | FR-07 / AC-012 | functional | Given a revision happened while the tab was in the background, when the tab is refocused, then the banner appears promptly | As above; tab hidden | Revise, then refocus | Banner appears within 5 s of refocus, without waiting for the next interval |
| TC-062 | FR-07 / AC-012 | edge | Given two revisions while viewing v1, when the banner appears, then it links to the latest | U-51 on v1 | Revise twice | Link goes to the latest version (v3), not v2 |
| TC-063 | FR-07 / AC-012 | negative | Given nothing changes, when the page stays open for 2 intervals, then no banner appears | U-51 on current version | Wait 130 s | No banner; no flicker or console errors |
| TC-064 | FR-07 / AC-012 | functional | Given the banner is shown, when the user follows the link, then the current version is shown | Banner visible | Click link | Newest version shown, labelled current; banner gone |
| TC-065 | FR-07 / AC-012 | edge | Given the user opens a superseded version directly, when the page loads, then the banner shows immediately | Signed in | Q-MULTI v1 | Banner present on load; labelled superseded |
| TC-066 | FR-07 / AC-012 | edge | Given a revision is issued between list load and opening, when the user opens the quote, then the current version is shown | List loaded | Revise Q-REV, then click it | Opens the new current version; no stale version |
| TC-067 | FR-07 / AC-012 | negative | Given the network drops during polling, when the poll fails, then no false banner or error flood appears | On Q-REV v1 | Go offline for 2 intervals, then online | No banner while offline; no repeated error toasts; polling resumes online |
| TC-068 | FR-07 / AC-012 | functional | Given the banner appears, when a screen reader is used, then it is announced | Banner shown | Screen reader or `role="status"` check | Banner is announced without stealing focus **[P]** |

### 2.7 Mock data and seed (FR-08)

| TC ID | Req / AC | Type | Scenario (Given / When / Then) | Preconditions | Test data | Expected result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-069 | FR-08 / AC-014 | functional | Given a seeded quote, when `seed:revise` runs, then a new current version exists and the old one is superseded | Seed run | Q-REV | `version_no` +1; previous `superseded_at` set; exactly one current |
| TC-070 | FR-08 / AC-014 | edge | Given two `seed:revise` runs at once, when both complete, then versions stay consistent | Seed run | Q-REV, two parallel runs | Versions 2 and 3 exist, no duplicate version number, exactly one current |
| TC-071 | FR-08 / AC-014 | negative | Given an unknown quote, when `seed:revise` runs, then it fails cleanly | Seed run | `does-not-exist` | Non-zero exit; clear error; no data changed |
| TC-072 | FR-08 / AC-013 | functional | Given the seed has run, when the data is inspected, then all required shapes exist | Fresh database | Seed | Separate organisations hold exactly 0, 1, 50 and 51 or more quotes (ORG-0, ORG-1, ORG-50, ORG-51), each with a customer user; Q-MULTI has 3 versions; ORG-B has its own quotes; Q-NOLINES and Q-TIES exist |
| TC-073 | FR-08 / AC-013 | edge | Given the seed has run, when it runs again, then data is not duplicated | Seed already run | Seed twice | Re-running resets to the known seed state: references stay unique, counts and shapes identical to TC-072; no duplicates |

### 2.8 Beta, monitoring and operations (FR-05, NFR-01)

| TC ID | Req / AC | Type | Scenario (Given / When / Then) | Preconditions | Test data | Expected result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-080 | NFR-01 / AC-010 | functional | Given the portal is up, when the health endpoint is called, then it reports healthy | Beta deployed | `GET /api/health` | 200 with `{status}`; no authentication needed; no sensitive data |
| TC-081 | NFR-01 / AC-010 | functional | Given the monitor is configured, when the backend is stopped, then an alert is raised | Monitor running | Stop the backend for more than 2 checks | Alert after 2 consecutive failed checks (spec, proposed); alert channel per OQ-13 |
| TC-082 | NFR-01 / AC-010 | edge | Given one failed check, when the next succeeds, then no alert is raised | Monitor running | One failed check | No alert **[P]** |
| TC-083 | FR-05 / none (G-08) | functional | Given the beta on staging, when a smoke test runs, then login and the list work | Staging URL | U-51 | HTTPS reachable; login works; list and a quote open |
| TC-084 | FR-05 / AC-011 | functional | Given Acme used the beta, when feedback is reviewed, then a dated record exists on or before 2026-10-20 | Beta in use | Feedback log | A dated feedback record exists. If dated on or before 2026-10-20: Pass. If dated later: report as a schedule variance with the date, not as a product failure. If none: Fail |

### 2.9 Non-functional (NFR-02 baseline, NFR-03, spec performance target)

| TC ID | Req / AC | Type | Scenario (Given / When / Then) | Preconditions | Test data | Expected result |
| --- | --- | --- | --- | --- | --- | --- |
| TC-090 | NFR-03 / none | functional | Given the login, list and quote pages, when an automated accessibility scan runs, then there are no contrast failures | Pages reachable | WCAG 2.1 AA ruleset **[P]** | No colour-contrast violations, including grey cards |
| TC-091 | NFR-03 / none | functional | Given the keyboard only, when the user logs in, pages through the list and follows the banner link, then everything is reachable | Signed out | U-51 | All controls reachable in logical order with visible focus |
| TC-092 | NFR-03 / none | functional | Given the final designs, when pages are compared, then spacing matches | Design link available | Figma link | **Blocked** until OQ-16 supplies the link |
| TC-093 | spec NFR-04 (performance) / none (G-03) | functional | Given 10,000 quotes in an organisation, when the list is requested, then it is fast | Load data | `GET /api/quotes` repeated 200 times | p95 under 500 ms **[P]**. Linked to the spec's NFR-04 (performance); the ID conflict with the requirement doc's NFR-04 (Cost) is recorded as G-03 and carried forward |
| TC-094 | NFR-02 baseline / none (G-04) | functional | Given the database and responses, when inspected, then baseline hygiene holds | Seed run | DB dump, response headers, error responses | Passwords stored hashed (no plaintext); session cookie is httpOnly (and Secure on HTTPS); error bodies contain no stack traces |

## 3. Regression pack

- Run on every build: TC-009, TC-011, TC-024, TC-025, TC-027, TC-016, TC-051, TC-060, TC-069, TC-080.
- These cover the 09-25 critical bugs (redirect loop, pagination above 50 rows), data isolation and the new-version notice.

## 4. Coverage by acceptance criterion

| AC ID | Covered by | Notes |
| --- | --- | --- |
| AC-001 | TC-001, 002, 003, 013 | |
| AC-002 | TC-004, 005, 006, 007, 008 | |
| AC-003 | TC-009, 010, 011, 012 | |
| AC-004 | TC-024, 025, 026, 027, 028, 029, 030, 031, 033 | |
| AC-005 | TC-021, 022, 023 | |
| AC-006 | TC-020 | |
| AC-007 | TC-040 to 045, 048 | |
| AC-008 | TC-017, 046, 047 | |
| AC-009 | TC-016, 034, 050 to 055 | |
| AC-010 | TC-080, 081, 082 | Operational test |
| AC-011 | TC-084 | Date already passed; see D5 |
| AC-012 | TC-060 to 068 | |
| AC-013 | TC-072, 073 | See D2 and D4 |
| AC-014 | TC-069, 070, 071 | |

All 14 ACs have at least one case.

## 5. Coverage by requirement and gaps

| Requirement | Covered by | Status |
| --- | --- | --- |
| FR-01 | TC-040 to 048 | Covered |
| FR-02 | TC-001 to 013, 016, 017 | Covered |
| FR-03 | TC-020 to 034 | Covered; list error state has no AC (G-05) |
| FR-04 | TC-012, 016, 034, 050 to 055 | Covered |
| FR-05 | TC-083, 084 | Partly covered; process evidence only; no AC for deployment (G-08) |
| FR-06 | TC-014, 015 | **Gap G-01: no AC** |
| FR-07 | TC-042, 060 to 068 | Covered |
| FR-08 | TC-069 to 073 | Covered; see D2 |
| NFR-01 | TC-080 to 082 | Covered |
| NFR-02 (withdrawn; baseline hygiene only) | TC-094 | **Gap G-04: no AC** |
| NFR-03 | TC-090 to 092 | Covered; TC-092 blocked on OQ-16; no AC |
| NFR-04 Cost (requirements) | None | **Gap G-02: not testable in the product** |

Gaps found in the approved documents. I have not edited them; they need your decision:
- **G-01:** FR-06 (logout) has no acceptance criterion.
- **G-02:** NFR-04 in the requirement doc is Cost (cloud cap), which cannot be tested in the application.
- **G-03:** NFR-04 in `spec.md` is a list performance target, so the same ID means two different things. TC-093 is linked to "spec NFR-04" until resolved.
- **G-04:** NFR-02 baseline hygiene (hashed passwords, cookie flags, no stack traces) has no acceptance criterion.
- **G-05:** The list error state ("Could not load quotes. Try again.", section 6) has no acceptance criterion.
- **G-06:** FR-08 / AC-013 say one organisation has quotes "in counts 0/1/50/51+ across test accounts", but quotes belong to organisations, so one organisation cannot have four different counts. Resolved for testing by D2.
- **G-07:** AC-011 sets a feedback deadline of 2026-10-20, which has passed. Handled by D5.
- **G-08:** Staging deployment (FR-05) has no acceptance criterion other than the feedback one.
- **G-09:** `issued_at` is a version field in the data model but is used as the list sort key without saying which version. Resolved for testing by D1.
- **G-10:** The documents leave these expected results undefined (resolved by D4): page size maximum, page beyond the last, `totalPages` for zero quotes, empty or malformed email wording, signed-in user opening `/login`, quote with no line items, seed re-run behaviour.

## 6. Decisions taken by BA judgement

- **Intro:** you asked me to make the call on Q1 to Q5. These are the choices and why. Say which to reverse and I will change the affected cases.

| ID | Decision | Reason | Affects |
| --- | --- | --- | --- |
| D1 | `issued_at` as the list sort key means the quote's **original issue date**, which never changes. Ties break on id descending. A revision therefore never moves a row. | Removes the duplicate/skip risk under offset pagination without switching to cursors, and fits the spec's wording. The spec should say this explicitly. | TC-027, TC-028 |
| D2 | The seed uses **separate organisations** for 0, 1, 50 and 51+ quotes, plus ORG-B. | Quotes belong to organisations, so counts cannot differ within one. | TC-072, AC-013 |
| D3 | The approved documents are **not edited**. The ID conflict (NFR-04) and the missing ACs (FR-06, NFR-02 baseline, list error state) stay recorded as G-01 to G-05 and carry into Session 3 planning. Tests link to the requirement ID. | Rule: approved documents change only with your say-so. Raise a v0.3 change later if you want the ACs added. | G-01 to G-05, TC-014, 015, 032, 090 to 094 |
| D4 | Accepted all proposed defaults: maximum page size 100 (above returns 400), page beyond the last returns 200 with no items, `totalPages` 0 for zero quotes, empty or malformed email shows "Enter a valid email." with no request sent, signed-in user at `/login` goes to the list, quote with no line items shows "No line items" and 0.00, Q-NOLINES added to the seed, re-running the seed resets to the known state. | Safest conventional behaviour; consistent with section 6 of the requirement doc where it speaks. | TC-006, 007, 013, 020, 030, 031, 044, 073 |
| D5 | AC-011 stays as a **manual evidence check**. A feedback record dated after 2026-10-20 is reported as a schedule variance, not a product failure. | The date has passed; the check is still useful evidence for the pilot. | TC-084 |

---
Confidential — Internal Use Only | Page [n]
