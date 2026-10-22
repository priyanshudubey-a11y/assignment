# spec.md — Quote Portal, Phase 1

Status: Draft v0.2 (updated after /validate-logic round 1). Items marked **[P]** are proposals pending confirmation (see requirements.md section 10). Requirement IDs refer to requirements.md.

## 1. Scope
- In: email/password login (FR-02), quote list with pagination (FR-03), quote view (FR-01), organisation isolation (FR-04), logout (FR-06), newer-version banner (FR-07), seeded mock data and seed tooling (FR-08), health endpoint and uptime monitoring (NFR-01), deploy to staging for beta (FR-05).
- Out: real quote-source integration (later phase), quote creation/editing, internal admin UI, SSO, MFA, session timeout, login lockout, password reset, notifications, payments.
- Stack (my preference, not in notes): Node.js + Express backend, React frontend, SQLite or Postgres **[P]**.

## 2. Data model **[P]**
- **Organisation**: id, name, created_at
- **User**: id, organisation_id, email (unique, case-insensitive), password_hash, role (`customer` only in Phase 1)
- **Quote**: id, organisation_id, reference (unique), title, current_version, status, created_at
- **QuoteVersion**: id, quote_id, version_no (unique per quote), currency, total, valid_until, issued_at, superseded_at (null for current)
- **QuoteLineItem**: id, quote_version_id, description, qty, unit_price, line_total
- Data comes from a seed script (FR-08), not an external system. The data-access layer sits behind a `QuoteRepository` interface so a real source can replace it later.
- Rules: exactly one current version per quote; money stored as integer minor units; every query filtered by the caller's organisation_id.

## 3. API contract **[P]** (full OpenAPI is written in Session 3)
- `POST /api/auth/login` {email, password} → 200 {user} + session cookie | 401 generic
- `POST /api/auth/logout` → 204
- `GET /api/me` → 200 {user} | 401
- `GET /api/quotes?page=1&pageSize=20&sort=issued_at:desc` → 200 {items[], page, pageSize, total, totalPages} | 401 | 400
- `GET /api/quotes/{id}` → 200 {quote, currentVersion, currentVersionNo, versions[]} | 401 | 404 (also for another org's quote)
- `GET /api/quotes/{id}/versions/{versionNo}` → 200 {version, isCurrent, superseded} | 401 | 404
- `GET /api/health` → 200 {status}
- Errors: JSON {code, message}; no stack traces.

## 4. Key flows
- **Login:** submit → verify → create session → redirect to `next` if same-origin whitelisted, else quote list; exactly one redirect.
- **Deep link while signed out:** store `next` → login → go to `next`; if `next` is login or invalid → quote list (prevents the redirect loop).
- **List:** stable sort (issued_at desc, id desc as tiebreak); offset pagination; totals returned; empty state when total=0.
- **View:** load quote scoped by organisation; show current version; older versions labelled superseded and read-only.
- **Newer-version notice (FR-07):** the quote page refetches `currentVersionNo` on window refocus and every 60 s **[P interval]**; if it exceeds the viewed version, show the banner with a link to the current version. The viewed version stays on screen.
- **Seed (FR-08):** `npm run seed` creates org A (Acme) with accounts holding 0, 1, 50 and 51+ quotes, one quote with 2+ versions, and org B with its own quotes; `npm run seed:revise -- <quoteId>` issues a new version and marks the previous one superseded.

## 5. Non-functional requirements
- NFR-01: `/api/health` polled by uptime monitor; alert on 2 consecutive failures **[P threshold]**.
- NFR-02: withdrawn from portal scope [Q5=C]. Baseline hygiene only: hashed passwords, httpOnly cookies, no stack traces in errors.
- NFR-03: WCAG 2.1 AA contrast and spacing per final designs **[P level]**.
- NFR-04: list p95 < 500 ms at 10k quotes per org **[P]**.

## 6. Open items blocking the spec
Still open (non-blocking, proposed defaults used): OQ-02, 03, 04, 07, 09, 12, 13, 15, 16, 20, 21, 22 in requirements.md.
