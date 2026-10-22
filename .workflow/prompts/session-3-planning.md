# Session 3 — Planning

## Inputs (read only these)
- The confirmed requirement document in `docs/` (file name starts with `requirements`)
- `docs/spec.md`
- `docs/test-cases.md`

## Outputs
- `plans/openapi.yaml` (API contract, written FIRST so BE and FE can work in parallel)
- `plans/plan-be.md`, `plans/plan-fe.md`, `plans/plan-qa.md` (or split by module if cleaner)
- `plans/tasks-be.md`, `plans/tasks-fe.md`, `plans/tasks-qa.md`

## Task
1. Define the API contract first (`plans/openapi.yaml`), consistent with spec.md.
2. Each plan includes: goals, scope, dependencies, sequencing, risks, definition of done.
3. `plan-qa.md` maps test-cases.md to test levels (unit, API, UI/E2E) and defines test data and environments. State that test EXECUTION happens in Session 5, not Session 4.
4. Each plan has a matching task file. Tasks are small and independently verifiable, each with: task ID, requirement IDs covered, acceptance criteria, dependencies.
5. `tasks-qa.md` includes a task to automate each test case, referencing Test Case IDs.
6. Check traceability: every FR/NFR maps to at least one BE/FE task and one test case. List gaps.
7. Ask open questions via /validate-logic (batched). When the user explicitly confirms, write `.workflow/gates/plan.approved` and stop.

## Gate marker to write
`.workflow/gates/plan.approved`

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
- The hook does not fire in this mode; the user starts each session manually by sending: "Read .workflow/prompts/session-3-planning.md and follow it exactly."
