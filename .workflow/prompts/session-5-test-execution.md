# Session 5 — Test execution

## Inputs (read only these)
- `docs/test-cases.md`, `plans/plan-qa.md`, `plans/tasks-qa.md`, `docs/spec.md`
- The requirement document in `docs/` (file name starts with `requirements`)
- `handoff.md`
- The running application (start it using handoff.md)
- DO NOT read the implementation code (`app/backend`, `app/frontend`) to decide expected results. Expected results come from the documents only. Running the QA automation in `app/tests` is allowed.

## Outputs
- `docs/defects.md`, `docs/test-report.md`, evidence under `docs/evidence/`

## Task
1. Execute ALL test cases, automated and manual. Record Pass, Fail or Blocked per Test Case ID, with evidence.
2. Log every failure in `defects.md`: defect ID, steps to reproduce, expected vs actual result, severity, linked requirement ID and Test Case ID.
3. Write `test-report.md`: totals by status, requirement coverage (per FR/NFR), open defects, and a release recommendation.
4. DO NOT fix the application in this session. Failed cases go back to a build session, and this session is re-run as regression.
5. No gate marker is written by this session. Present the report to the user and stop.

## Gate marker to write
None (end of workflow).

## Rules that apply to every session
- Sessions are isolated. Work ONLY from the files named under "Inputs". Do not rely on chat memory or on any other file; hand off through files only.
- Project root is the current working directory. Treat the original meeting-notes folder as read-only and out of scope unless it is listed under Inputs.
- Do not assume silently. If something is unclear, conflicting or missing, ask the user using /validate-logic (invoke the `validate-logic` skill). Batch all questions into one round.
- If sources conflict, the later or more senior decision wins. Record every conflict and how it was resolved under "Open Questions" (section 10 of the requirement doc).
- Every requirement has an ID (FR-01, NFR-01, ...). Carry these IDs through user stories, acceptance criteria, test cases, plans and tasks. Never renumber approved IDs; add new ones instead and log the change.
- Requirement documents use the standard requirements template (exact section and table structure) in bullet-point style with a brief intro per section. Footer on all pages: "Confidential — Internal Use Only | Page [n]".
- Do not edit documents approved in earlier phases. If you find a defect in one, report it to the user and let them decide.
- Final report (always): what was produced, what is still open, and which gate marker you wrote (or "none yet").

## If running in a cloud session linked to the user's computer
- The project root is the connected `assignment` folder (mounted at `$HOME/mnt/assignment`). Read and write all project files there through the device shell, not in the cloud working directory. Paths in this prompt are relative to that folder.
- The hook does not fire in this mode; the user starts each session manually by sending: "Read .workflow/prompts/session-5-test-execution.md and follow it exactly."
