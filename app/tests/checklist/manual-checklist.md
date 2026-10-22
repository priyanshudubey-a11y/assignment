# Scripted manual checklist and evidence template (QA-05)

Cases that cannot be fully automated: TC-081, TC-082, TC-084, TC-092. Expected results are copied from `docs/test-cases.md`. Fields "Run by", "Date" and "Result" stay blank until Session 5. Store evidence under `app/tests/evidence/<TC-id>/` (create it) or link it.

Tags: each entry carries its test case id and requirement ids on the heading line so `tools/traceability.mjs` can map it.

---

## TC-081 Alert after consecutive failed checks @TC-081 @NFR-01 @AC-010

- Level: scripted manual / ops. Status: **pending** on the staging host and monitor (Q-P2: no host, tool or channel provided; BE-14 and BE-15 open).
- Preconditions: monitor running against `GET /api/health`; alert channel known (OQ-13).
- Steps:
  1. Note the time and confirm the monitor shows the portal as up (`curl -i $BASE/api/health` returns 200 `{"status":"ok"}`).
  2. Stop the backend for longer than 2 monitor checks (local rehearsal: stop the process started with `npm start` in `app/backend`; staging: stop the service with the host's tool).
  3. Wait for 2 consecutive failed checks; record the time of each failed check from the monitor.
  4. Check the alert channel for the alert; note its time and text.
  5. Restart the backend and confirm recovery (`curl -i $BASE/api/health`).
- Expected result: alert after 2 consecutive failed checks (proposed); alert channel per OQ-13.
- Evidence to store: screenshot of the monitor history with the two failed checks, the alert message (screenshot or copied text with time), and the stop/start times.
- Run by: ____________  Date: ____________  Result (Pass / Fail / Blocked): ____________  Notes: ____________

---

## TC-082 Single failed check raises no alert @TC-082 @NFR-01 @AC-010

- Level: scripted manual / ops. Status: pending on the same monitor as TC-081.
- Preconditions: monitor running; alert channel known.
- Steps:
  1. Stop the backend and restart it so that exactly one check fails (stop shortly before a check, restart straight after; use the monitor's check interval to time it).
  2. Confirm in the monitor history that one check failed and the next succeeded.
  3. Watch the alert channel until at least 2 further check intervals have passed.
- Expected result: no alert after one failed check **[P]**.
- Evidence to store: screenshot of the monitor history (one failed, then successful checks) and of the empty alert channel for that period.
- Run by: ____________  Date: ____________  Result (Pass / Fail / Blocked): ____________  Notes: ____________

---

## TC-084 Acme beta feedback is recorded by the deadline @TC-084 @FR-05 @AC-011 @pending-decision

- Level: scripted manual / process evidence. Status: **pending-decision (Q-P7)**. `app/BUILD-DECISIONS.md` treats AC-011 as obsolete because the deadline 2026-10-20 has passed; this entry is kept as a note and a schedule check only.
- Preconditions: beta in use by Acme; a feedback log exists.
- Steps:
  1. Open the feedback log (location to be supplied by the product owner).
  2. Find the earliest dated feedback record from Acme.
  3. Compare its date with 2026-10-20.
- Expected result: a dated feedback record exists. If dated on or before 2026-10-20: Pass. If dated later: report as a schedule variance with the date, not as a product failure. If none: Fail.
- Evidence to store: link to the feedback log or a screenshot showing the record and its date.
- Run by: ____________  Date: ____________  Result (Pass / Fail / Schedule variance / N/A obsolete): ____________  Notes: ____________

---

## TC-092 Spacing matches the final designs @TC-092 @NFR-03 @AC-none @blocked

- Level: scripted manual / design review. Status: **blocked** until OQ-16 supplies the Figma link. Placeholder only.
- Preconditions: Figma link available; frontend running with seeded data.
- Steps (to run once unblocked):
  1. Open the Figma frames for login, quote list and quote view side by side with the running pages at the same viewport width.
  2. For each page compare spacing (padding, gaps between cards, line spacing) against the design values.
  3. Record each deviation with the element, expected value and actual value.
- Expected result: spacing matches the Figma designs; blocked until OQ-16 supplies the link.
- Evidence to store: Figma link, paired screenshots per page, list of deviations.
- Run by: ____________  Date: ____________  Result (Pass / Fail / Blocked): ____________  Notes: ____________
