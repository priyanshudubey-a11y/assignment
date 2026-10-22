# Session 4 — Build

## Inputs (read only these)
- `docs/spec.md`
- `plans/openapi.yaml`, `plans/plan-*.md`, `plans/tasks-*.md`

## Outputs
- `app/backend/`, `app/frontend/`, `app/tests/` (QA automation)
- Updated task files (tasks marked done as you go)
- `handoff.md` at the project root

## Task
1. Stack: Node.js backend + React frontend unless the plans say otherwise.
2. Execute each plan using three sub-agents: BE, FE and QA automation. Each sub-agent works ONLY from its own plan, its own task file, spec.md and the OpenAPI contract.
3. Developers (BE, FE) write and run their own unit tests. DO NOT execute the QA test suite in this session; only write it (it is run in Session 5).
4. Mark tasks done in the task files as you go; leave anything not done unmarked and list it.
5. Write `handoff.md`: install and run steps, URLs and ports, seed and test data, test credentials, known limitations.
6. Ask open questions via /validate-logic (batched). Present the build summary for review.
7. When the user explicitly confirms the build is complete, write `.workflow/gates/build.complete` (this starts Session 5) and stop.

## Gate marker to write
`.workflow/gates/build.complete`

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
- The hook does not fire in this mode; the user starts each session manually by sending: "Read .workflow/prompts/session-4-build.md and follow it exactly."
