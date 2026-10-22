# Session 2 — Test case writing

## Inputs (read only these)
- The confirmed requirement document in `docs/` (file name starts with `requirements`)
- `docs/spec.md`

## Outputs
- `docs/test-cases.md`

## Task
1. Create `test-cases.md` from the acceptance criteria. Each test case has: Test Case ID, linked requirement ID and AC ID, scenario (Given/When/Then), preconditions, test data, expected result, and type (functional, negative, edge, regression).
2. Cover happy paths, alternate paths, and the edge cases, races and missing states recorded during /validate-logic in the requirement doc and spec.
3. Report any requirement (FR/NFR) or AC that has no test coverage, as a coverage table.
4. Ask the user any open questions via /validate-logic (batched). Present the output for review.
5. When the user explicitly confirms, write `.workflow/gates/testcases.approved` and stop.

## Gate marker to write
`.workflow/gates/testcases.approved`

## Rules that apply to every session
- Sessions are isolated. Work ONLY from the files named under "Inputs". Do not rely on chat memory or on any other file; hand off through files only.
- Project root is the current working directory. Treat the original meeting-notes folder as read-only and out of scope unless it is listed under Inputs.
- Do not assume silently. If something is unclear, conflicting or missing, ask the user using /validate-logic (invoke the `validate-logic` skill). Batch all questions into one round.
- If sources conflict, the later or more senior decision wins. Record every conflict and how it was resolved under "Open Questions" (section 10 of the requirement doc).
- Every requirement has an ID (FR-01, NFR-01, ...). Carry these IDs through user stories, acceptance criteria, test cases, plans and tasks. Never renumber approved IDs; add new ones instead and log the change.
- Requirement documents use the standard requirements template (exact section and table structure) in bullet-point style with a brief intro per section. Footer on all pages: "Confidential — Internal Use Only | Page [n]".
- Do not edit documents approved in earlier phases. If you find a defect in one, report it to the user and let them decide.
- Write the gate marker ONLY after the user has explicitly confirmed this phase's output. Marker file content: ISO timestamp and the session number. Then stop.
- Final report (always): what was produced, what is still open, and which gate marker you wrote (or "none yet").

## If running in a cloud session linked to the user's computer
- The project root is the connected `assignment` folder (mounted at `$HOME/mnt/assignment`). Read and write all project files there through the device shell, not in the cloud working directory. Paths in this prompt are relative to that folder.
- The hook does not fire in this mode; the user starts each session manually by sending: "Read .workflow/prompts/session-2-test-cases.md and follow it exactly."
