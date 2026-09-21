# Prompt 01 — Repository Audit and Baseline Gap Report (read-only)

## 1. PDF requirements addressed
- ADLASB Final Case, "Prototype standard": a *working* integrated prototype on one shared record; concept-only does not count.
- "Build one system — not twenty-three islands." This audit establishes what already exists so nothing is rebuilt or duplicated.
- Deliverables: public prototype URL, all 23 mandatory items reachable and testable.

## 2. Baseline documents (precedence: PDF > PRD > architecture > spec)
- `docs/ADLASB/ADLASB-Hackathon_Final-Round_Case.pdf`
- `docs/PRD/PRD.md`, `docs/architecture/architecture.md`, `docs/architecture/reconciliation-rules.md`, `docs/spec/spec.md`
- `docs/design/design.md` and any `AGENTS.md` (report if missing)

## 3. Scope
- **In scope:** inspect, run existing checks, write a report. 
- **Out of scope:** any change to application code, schema, config or dependencies. Do not implement features. Do not install new packages other than what the project already declares.
- Depends on: nothing.

## 4. Instructions
1. Read the documents above in precedence order. Note any conflict you find (for example product name, T2 "consecutive" wording, source-of-truth header) — list them, do not fix them.
2. Inspect the repository: framework and versions, package manager, folder structure, routes/pages present, components, data layer/ORM/migrations, auth, API routes, background jobs, PWA/service worker, simulators (`/sim/*`), tests, lint/typecheck config, deployment config (Fly.io or other), environment variables (names only, never values).
3. Run, and record exact command and result of: install, lint, typecheck, build, existing tests. Report failures without fixing them.
4. Map every route/page found to the spec inventory S01–S35: `exists-complete`, `exists-partial`, `stub`, `missing`, `legacy/alias`.
5. Map existing modules to architecture modules (tenancy, ledger/vault, state machines, promise engine, outbox, documents, referral, mediation, signing, panel lawyer, payment, audit, AI adapters) with the same status labels.
6. Identify: hard-coded data, mock-only logic that does not change state, code that creates a parallel record (violates "one record"), secrets exposed client-side, and anything that conflicts with the architecture.
7. List the Day-1 risks and whether the repo already has a harness for each: Bangla OCR, TalkBack/audio OTP, PWA install on the public URL, always-on scheduler.
8. Produce a ranked recommendation of what prompts 02–06 must change, in the smallest sensible set of steps.

## 5. Shared-record integration
Not applicable (read-only). The report must state whether a single authoritative record exists today or whether feature-specific side stores exist.

## 6. Failure and human control
Do not guess. If something cannot be determined, write "unknown — needs confirmation" instead of assuming.

## 7. Tests and acceptance
- Report file exists at `Solved/00-repo-baseline.md` with sections: Stack; Commands run and results; Route map vs S01–S35; Module map vs architecture; Conflicts between documents; Parallel-record / mock-only findings; Security findings; Day-1 risk harness status; Recommended next steps.
- Working tree has no code changes (`git status` shows only the new report).

## 8. Solved update
- Create `Solved/00-repo-baseline.md` (the report itself).
- Set the "Baseline audit" row in `Solved/TRACEABILITY.md` to Done.

## 9. Cut line
None. Keep the report concise; tables over prose.