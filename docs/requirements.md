# Requirement Gathering Document — Quote Portal (Phase 1: Customer-facing Quote View)

> Intro: Updated after /validate-logic round 1 (answers Q1–Q6 recorded in section 10). This document defines Phase 1 of the Quote Portal rebuild, based only on the meeting notes (1 Sep – 14 Oct 2026). Items tagged **[N]** come directly from the notes. Items tagged **[P]** are proposals that the notes do not support and need confirmation (see section 10).

| Prepared By | Priyanshu Dubey (BA) | Date | 2026-10-22 |
| --- | --- | --- | --- |
| Project / Feature Name | Quote Portal — Phase 1: customer-facing quote view | Version | v0.2 |
| Client | Acme (pilot / reference customer) — internal sponsor TBC | Status | Draft — validated (/validate-logic round 1), pending approval |
| Feature Flag | TBC (OQ-12) | | |

---

## 1. Objective

- Brief intro: why we are building this and how we will know it worked.

| Field | Details |
| --- | --- |
| **Business Goal** | - Rebuild the quote portal in phases, starting with the customer-facing quote view **[N 09-01]**<br>- Use Acme as the reference customer for the pilot **[N 09-01]** |
| **Success Metric** | - Not defined in notes (OQ-02)<br>- **[P]** Acme can log in, list and open their quotes during the beta, and beta feedback is collected by 2026-10-20 **[N 10-13]** |
| **Out-of-scope Goals** | - Billing migration, onboarding/signup flow, renewal/pricing work and sales pipeline (separate initiatives in the same notes) |
| **Priority / Urgency** | - Not stated. Beta targeted for October **[N 09-30]**; launch date undecided **[N 10-01]** (OQ-03) |

## 2. Scope

- Brief intro: Phase 1 is the customer-facing view only. Later phases are not described in the notes.

| Category | Details |
| --- | --- |
| **In Scope** | - Customer login **[N 09-08]**<br>- Quote list with pagination **[N 09-15]**<br>- Customer-facing quote view **[N 09-01]**<br>- Beta on staging for Acme demo and feedback **[N 10-06, 10-13]**<br>- Uptime monitoring before real traffic **[N 10-06]**<br>- Mock quote data seeded for Phase 1 **[Q1=C]**<br>- Newer-version notice on a quote being viewed **[Q3=A]** |
| **Out of Scope** | - Quote creation/editing/revision tooling (internal side) — not discussed (OQ-04)<br>- Integration with a real quote source (separate later phase) **[Q1=C]**<br>- SSO (deferred) **[Q2=A]**<br>- MFA, dependency patching, session timeout and login lockout for the portal **[Q5=C]**<br>- Phase 2+ features — not discussed |
| **Affected Systems** | - Staging environment (up since 09-08) **[N]**<br>- Cloud hosting (spend approved with a cap, value not recorded) **[N 10-02]**<br>- Quote data: seeded mock data in Phase 1; real source deferred **[Q1=C]**<br>- No SSO in Phase 1 **[Q2=A]** |
| **Phase / Release** | - MVP = Phase 1 above (runs on mock data), in beta on staging as of 2026-10-13 **[N]**<br>- Production launch date: undecided (OQ-03) |

## 3. Requirements

### 3.1 Functional Requirements

- Brief intro: each requirement has an ID that is carried into stories, ACs, test cases, plans and tasks.
- **FR-01 Customer-facing quote view [N 09-01]** — An authenticated customer can open a quote and see its content. The notes do not list which fields are shown (OQ-07). Revised quotes exist as a concept (Acme was waiting for a "revised quote"), so the view must make clear which version is current. Versions are read-only; if a newer version is issued while the customer is viewing, FR-07 applies **[Q3=A]**.
- **FR-02 Customer login [N 09-08]** — A customer signs in on a login screen to reach their quotes. The 09-25 QA sync records a login redirect loop as a critical bug, so a successful login must land on the intended page exactly once, and a failed login must stay on the login screen with an error. Authentication is email and password; SSO is deferred **[Q2=A]**. Account creation and password reset are not covered (OQ-21).
- **FR-03 Quote list with pagination [N 09-15]** — A customer sees a list of their quotes, paginated. The known defect is that pagination breaks above 50 rows. The list must work correctly for 0, 1, 50, 51 and many rows. Page size and sort order are not stated (OQ-09).
- **FR-04 Customer data isolation [Q4=A]** — A customer can only see quotes belonging to their own organisation. Requests for another organisation's quote ID return "not found", indistinguishable from a non-existent ID.
- **FR-05 Beta availability for Acme [N 10-06, 10-13]** — The beta is deployed on staging and demoed to Acme (demo 2026-10-14, held or not unrecorded). Acme beta feedback is collected by 2026-10-20.
- **FR-06 Logout [P]** — A user can log out. Session timeout and login lockout are explicitly out of Phase 1 **[Q5=C]**.
- **FR-07 Newer-version notice [Q3=A]** — If a newer version of the quote being viewed is issued, the customer sees a "newer version available" banner with a link to it, and the version on screen stays visible and read-only (labelled superseded).
- **FR-08 Mock quote data [Q1=C]** — Phase 1 reads quotes from seeded mock data, not a real quote system. The seed must include: an organisation with exactly 0, 1, 50 and 51+ quotes; a quote with multiple versions; and a second organisation so FR-04 can be tested. A way to issue a new version of a seeded quote on demand is needed to demonstrate FR-07.

### 3.2 Non-Functional Requirements

- Brief intro: only items evidenced in the notes are listed as requirements; the rest are open questions.
- **NFR-01 Monitoring [N 10-06]** — Uptime monitoring is in place before real traffic reaches the portal. Owner per notes: Sam. Threshold/alerting target not stated (OQ-13).
- **NFR-02 Security (withdrawn from portal scope) [Q5=C]** — MFA for admin accounts and the express dependency patch from the 10 Oct security review do not apply to this portal. ID reserved, not reused. Baseline hygiene still applies in the spec (hashed passwords, httpOnly cookies).
- **NFR-03 Visual quality and accessibility [N 09-18, 10-13]** — Spacing issues flagged in review (due 10-16 fix) and poor contrast on grey cards. The notes talk about "the dashboard" and do not say it is the portal (OQ-15). Accessibility standard (e.g. WCAG level) not stated.
- **NFR-04 Cost [N 10-02]** — Cloud spend is capped; a 10% cut proposal was due 2026-10-09. Cap value not recorded.

## 4. User Roles

- Brief intro: roles are inferred; the notes mention customers, admin accounts and Acme's procurement contact only.

| Role | Permissions | Restrictions | Notes |
| --- | --- | --- | --- |
| Customer user (e.g. Acme) | **[P]** Log in; list and view own organisation's quotes | No access to other customers' quotes; read-only | Primary Phase 1 user |
| Admin | Out of Phase 1 | — | MFA/admin items do not apply to the portal **[Q5=C]** |
| Internal sales (e.g. quote sender) | Not in Phase 1 | — | Sends revised quotes to Acme today **[N 09-01, 09-15]**; in Phase 1 revisions are simulated through the seed (FR-08) |

## 5. Workflow / Process Flow

- Brief intro: proposed customer journey for Phase 1 **[P]**; the notes describe no flow.

| Flow Type | Description |
| --- | --- |
| **Happy Path** | 1. Customer opens portal URL.<br>2. Signs in (FR-02).<br>3. Lands on quote list (FR-03).<br>4. Opens a quote (FR-01) and sees the current version. |
| **Alternate Paths** | - Customer with zero quotes sees an empty state.<br>- Customer opens a deep link while signed out, signs in, and is returned to that quote once (no loop).<br>- Customer views a superseded (older) revision, or a newer version is issued while viewing (FR-07). |
| **Error / Edge Cases** | - Wrong credentials (no lockout in Phase 1).<br>- Quote is revised while the customer is viewing it.<br>- Quote ID belongs to another customer (must look like not found).<br>- List with exactly 50 and 51 rows; backend timeout. |

## 6. Validations / Business Rules

- Brief intro: values are proposed unless tagged [N]; all need confirmation.

| Field / Element | Validation Rule | Business Logic | Error Message |
| --- | --- | --- | --- |
| Login: email/username | Required; valid format **[P]** | Account must exist and be active | "Incorrect email or password." (do not reveal which) |
| Login: password | Required **[P]** | No lockout or session timeout in Phase 1 **[Q5=C]** | "Incorrect email or password." |
| Post-login redirect | Only same-origin, whitelisted paths **[P]** | Redirect once; never back to the login screen | — |
| Quote list: page / pageSize | Integers; page ≥ 1; pageSize within limit **[P]** | Must work for >50 rows **[N 09-15]**; deterministic sort so rows are not duplicated or skipped between pages | "Could not load quotes. Try again." |
| Quote ID | Must belong to the caller's organisation | Otherwise respond as not found | "Quote not found." |
| Quote version | Version numbers increase by 1 per quote; exactly one current | A viewed version older than current triggers the banner (FR-07) | "A newer version of this quote is available." |

## 7. UI / UX Notes

- Brief intro: the notes mention wireframes and final designs, but no link was recorded.

| Field | Details |
| --- | --- |
| **Screen / Component** | Login screen; quote list; quote detail |
| **Layout Notes** | - Wireframes by Anita (slipped 09-22); final designs handed to dev by 2026-10-06 **[N]**<br>- Spacing issues from review fixed by 2026-10-16 **[N 10-13]**<br>- Grey-card contrast issue **[N 09-18]**, OQ-15 |
| **Interaction Notes** | - Pagination controls; empty state; error state; loading state (all **[P]**) |
| **Figma / Wireframe Link** | Not in notes — to be supplied (OQ-16) |

## 8. User Stories

- Brief intro: stories derived from the FRs above.

| Story ID | Title | User Story | Description | Acceptance Criteria (Given / When / Then) |
| --- | --- | --- | --- | --- |
| US-001 | Sign in | As a customer user, I want to sign in so that I can see my quotes | Covers the login screen and the redirect-loop bug | See AC-001, AC-002, AC-003 |
| US-002 | Browse quotes | As a customer user, I want a paginated list of my quotes so that I can find one | Covers the >50-row bug | See AC-004, AC-005, AC-006 |
| US-003 | View a quote | As a customer user, I want to open a quote so that I can review its content and current version | Covers FR-01 | See AC-007, AC-008 |
| US-004 | Data isolation | As a customer user, I want only my organisation's quotes visible so that my pricing stays confidential | Covers FR-04 | See AC-009 |
| US-005 | Beta readiness | As the product team, I want the beta monitored and on staging so that Acme can try it safely | Covers FR-05, NFR-01 | See AC-010, AC-011 |
| US-006 | Notice of revisions | As a customer user, I want to be told when a newer version of my quote exists so that I do not act on outdated pricing | Covers FR-07 | See AC-012 |
| US-007 | Mock data for beta | As the product team, I want realistic seeded quotes so that every list and view state can be exercised before a real source exists | Covers FR-08 | See AC-013, AC-014 |

## 9. Acceptance Criteria

- Brief intro: all ACs are traceable to a story and a requirement.

| AC ID | Scenario (Given / When / Then) | Linked Story |
| --- | --- | --- |
| AC-001 | Given a valid customer account, when they submit correct credentials, then they land on the quote list exactly once (FR-02) | US-001 |
| AC-002 | Given a wrong password, when they submit, then they stay on the login screen with a generic error and no redirect (FR-02) | US-001 |
| AC-003 | Given a signed-out user opens a quote deep link, when they sign in, then they reach that quote with no redirect loop (FR-02) | US-001 |
| AC-004 | Given a customer with 51 quotes, when they open the list, then all 51 are reachable across pages with none duplicated or missing (FR-03) | US-002 |
| AC-005 | Given exactly 50 quotes, when they open the list, then page-size and page-count behave consistently (FR-03) | US-002 |
| AC-006 | Given zero quotes, when they open the list, then an empty state is shown, not an error (FR-03) | US-002 |
| AC-007 | Given a quote with revisions, when the customer opens it, then the current version is shown and labelled (FR-01) | US-003 |
| AC-008 | Given the quote service fails, when the customer opens a quote, then a retryable error state is shown (FR-01) | US-003 |
| AC-009 | Given customer A is signed in, when they request customer B's quote ID, then they get "Quote not found" (FR-04) | US-004 |
| AC-010 | Given the beta is deployed, when the monitor checks the portal, then downtime raises an alert (NFR-01) | US-005 |
| AC-011 | Given the beta on staging, when Acme uses it, then feedback is captured by 2026-10-20 (FR-05) | US-005 |
| AC-012 | Given a customer is viewing version 1 of a quote, when version 2 is issued, then a "newer version available" banner appears (within the refresh interval or on refocus), version 1 remains visible and read-only, and the link opens version 2 (FR-07) | US-006 |
| AC-013 | Given the seed has been run, then organisation A has quotes in counts 0/1/50/51+ across test accounts, at least one quote has 2+ versions, and organisation B exists with its own quotes (FR-08) | US-007 |
| AC-014 | Given the seed command to issue a new version is run on a quote, then a new current version exists and the previous one is marked superseded (FR-08) | US-007 |

## 10. Assumptions / Dependencies

- Brief intro: conflicts found in the notes and how they were resolved, plus open questions that block clarity.

| Category | Details |
| --- | --- |
| **Assumptions** | - "Quote portal" notes with attendees Priya Nair / Rahul Mehta are the relevant ones; "Priya Shah / Rahul Verma" appear on billing and onboarding notes.<br>- The "login redirect loop" and "pagination" bugs listed in the 09-25 QA sync belong to the portal; "rounding" belongs to billing, not the portal. |
| **Dependencies** | - Final designs from Anita (due 2026-10-06)<br>- Staging environment and monitoring (Sam, Rahul Mehta)<br>- Seed data and seed tooling (FR-08)<br>- Procurement form/contact at Acme (done 10-01)<br>- Cloud spend approval (done 10-02, capped) |
| **Open Questions** | See table below |
| **Risk Notes** | - 37 open bugs on 09-25, three critical; no recorded closure of pagination or redirect-loop fixes.<br>- Beta deploy slipped twice (10-01, 10-06).<br>- Phase 1 runs on mock data, so Acme's beta feedback may not reflect their real quotes (OQ-22).<br>- Pagination and login-redirect fixes are unverified and are re-tested **[Q6]**.<br>- Launch date undecided.<br>- Two people share each first name (Priya, Rahul); owners are ambiguous in some notes. |

### Open Questions and Conflict Log

| ID | Question / Conflict | Resolution applied (if any) |
| --- | --- | --- |
| OQ-01 | **Conflict:** 09-30 offsite says portal beta on track for October; 10-01 says launch date not picked; 10-06 says beta deploy slipped; 10-13 says beta on staging. | Later decision wins: beta is on staging as of 10-13. Launch date remains open. |
| OQ-02 | Success metrics are not defined. | Proposed metric in section 1, unconfirmed. |
| OQ-03 | Production launch date. | Open. |
| OQ-04 | Is internal quote creation/revision in Phase 1? | Assumed out of scope. |
| OQ-05 | Where do quotes come from? | **Resolved [Q1=C]:** mock data in Phase 1; real integration is a later phase. |
| OQ-06 | Auth method for customers. | **Resolved [Q2=A]:** email and password; SSO deferred. |
| OQ-07 | Fields shown on a quote. | Open. |
| OQ-08 | How are revisions shown and what is "current"? | **Resolved [Q3=A]:** current version labelled; "newer version available" banner; viewed version stays read-only. |
| OQ-09 | Page size, sort order, filters, search. | Open. |
| OQ-10 | Data isolation model. | **Resolved [Q4=A]:** per organisation; other orgs' IDs return not found. |
| OQ-11 | Session length, lockout, password reset, logout. | **Resolved [Q5=C]:** no session timeout or lockout in Phase 1; logout kept as FR-06. Password reset: see OQ-21. |
| OQ-12 | Feature flag name/need. | Open. |
| OQ-13 | Monitoring thresholds and who is paged. | Open. |
| OQ-14 | Do MFA/dependency patch items (10-09) apply to the portal? | **Resolved [Q5=C]:** no. NFR-02 withdrawn. |
| OQ-15 | Is "the dashboard" (09-18) the portal? | Open. |
| OQ-16 | Wireframe/Figma link. | Open. |
| OQ-17 | **Conflict:** names. "Priya" = Nair or Shah; "Rahul" = Mehta or Verma. | Resolved by meeting attendee lists; ambiguous in 09-30 offsite items (not portal-related). |
| OQ-18 | **Conflict:** pagination fix due "Wednesday" (09-22) and top-3 bug fixes due 10-02 (09-25), no closure recorded. | **Resolved [Q6]:** treated as unverified; covered by re-test (AC-003, AC-004, AC-005). |
| OQ-19 | **Unusable inputs:** `2026-09-09-notes-final-v2.md` is empty; `scratch.md` is corrupted/binary; `untitled.md` has no context; `2026-10-03-sales-pipeline.md` has no real date. | Ignored; confirm nothing relevant is lost. |
| OQ-20 | Outcome of the 2026-10-14 Acme demo and the feedback due 2026-10-20 are not in the notes. | Open; does not block Phase 1 definition. |
| OQ-21 | How are customer accounts created and passwords reset? | Proposed: accounts seeded for the beta; no reset flow in Phase 1. Needs confirmation. |
| OQ-22 | Acme beta runs on mock data, not their real quotes. Acceptable for the pilot? | Open. |

## 11. Approval / Sign-off

### Reviewer / Client Representative 1

|  |  |
| --- | --- |
| Name: ___________________________ | Date: ___________________________ |

* [ ] The requirements listed are complete and to my satisfaction.
* [ ] All comments and pending discussions on this document have been reviewed and resolved.
* [ ] I acknowledge that any changes requested after sign-off will be raised through a formal change request process.

### Reviewer / Client Representative 2

|  |  |
| --- | --- |
| Name: ___________________________ | Date: ___________________________ |

* [ ] The requirements listed are complete and to my satisfaction.
* [ ] All comments and pending discussions on this document have been reviewed and resolved.
* [ ] I acknowledge that any changes requested after sign-off will be raised through a formal change request process.

| Version | Change Log |
| --- | --- |
| v0.1 | Initial draft from meeting notes, pending /validate-logic |
| v0.2 | Incorporated /validate-logic answers Q1–Q6: mock data, email/password, newer-version banner, org isolation, security items out of scope, retest of unverified fixes. Added FR-07, FR-08, US-006/007, AC-012–014, OQ-21/22. NFR-02 withdrawn. |

---
Confidential — Internal Use Only | Page [n]
