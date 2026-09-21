# Shakkho Build-Prompt Protocol

Use this protocol whenever the user asks for the next build prompt or asks to execute one.

## 1. Governing sources

Read the relevant portions in this order:

1. `docs/ADLASB/ADLASB-Hackathon_Final-Round_Case.pdf`
2. `docs/PRD/PRD.md`
3. `docs/architecture/reconciliation-rules.md`
4. `docs/architecture/architecture.md`
5. `docs/spec/spec.md`
6. `docs/design/design.md`, applicable `AGENTS.md`, previous `Solved/` evidence and current code

The PDF controls mandatory scope, cases, acceptance tests, checklist and workflow. Never invent a PDF page, legal rule or verified fact. Use the PDF's printed page/section and item ID; otherwise write `page needs team confirmation`.

## 2. Frozen baseline versus user input

The PRD, architecture and specification are the approved baseline. Do not re-litigate settled choices in every prompt.

Before generating a **case-specific** prompt:

1. compare the next roadmap item with the frozen documents and `Solved/DECISIONS.md`;
2. list only genuine open choices or intended deviations in a short Decision Card;
3. ask the user for input and stop before writing the prompt when an answer would change workflow, citizen safety, human authority, data handling, acceptance evidence or prototype scope;
4. record the approved answer as a numbered decision in `Solved/DECISIONS.md` and reference it from the prompt.

If no material choice is open, say `Decision gate: no new decision—frozen baseline applies` and generate the prompt. If the user volunteers a changed solution plan, treat it as a proposed deviation: reconcile it against the PDF before accepting it.

## 3. One prompt at a time

- Follow `Build/00-INDEX.md` dependency order.
- Generate exactly one new `Build/NN-<slug>.md` per request.
- Do not implement merely because a prompt was generated. Execute only when the user asks.
- Do not begin the next prompt until the current prompt's required tests and `Solved/` update are complete, or the user records an accepted deviation/blocker.
- Keep the prompt focused on one coherent acceptance outcome. Reuse earlier foundation; never create a parallel record, auth model, audit store or simulator state.

## 4. Fixed technical direction

Use the architecture's modular-monolith direction: existing Next.js/TypeScript frontend, PostgreSQL canonical state, always-on host/worker shape and adapter boundaries for unavailable external services. Stack selection is not repeated per feature.

A new library is allowed only when the prompt records:

- the capability gap;
- the selected package and version policy;
- why existing dependencies/platform APIs are insufficient;
- the smallest fallback if the package fails.

## 5. Required prompt contract

Every prompt must:

- have a specific outcome title: `Prompt NN — <what becomes working>`;
- cite the PDF item/page/section and literal acceptance minimum;
- name dependencies and exclusions;
- define canonical state transitions and ledger events;
- name exact roles, information shown, human decision and authority enforcement;
- prove it writes the shared Application/Case record;
- define failure/retry/escalation and safe fallback;
- specify commands and a juror-triggerable scenario test;
- identify evidence to capture;
- state the Tier 2 cut line;
- require the matching lightweight `Solved/NN-<slug>.md` update.

Target a compact prompt. Prefer tables/checklists and concrete file/behavior contracts over explanatory prose. Do not repeat the entire PRD or architecture.

## 6. Execution and evidence rule

Implementation is not complete because a page exists. PASS requires:

1. real canonical state change;
2. attributable audit event;
3. promise/task update when applicable;
4. server-side tenant/role/office/case authority;
5. required failure/human-control behavior;
6. automated test plus juror-triggerable evidence.

Only unavailable external transport may be labelled `SIMULATED`; Shakkho's internal workflow must work.

## 7. Solved protocol

After execution, create `Solved/NN-<slug>.md` from `Solved/_TEMPLATE.md` and update `Solved/TRACEABILITY.md`.

- Keep the summary compact—roughly ten evidence lines plus the small table.
- Cite the PDF item and verified page/section.
- Record status as `Done`, `Partial`, `Blocked` or `Not started`.
- Include test names/commands and event IDs or artefact paths.
- Mark **Implemented**, **Integrated** or **Testable** only when the corresponding evidence passes.
- Never mark later prompts, unbuilt UI or simulated internal logic as complete.

## 8. Prompt-generation response

When a prompt is created, report only:

- file path and title;
- PDF items addressed;
- whether a Decision Card was required;
- dependencies and expected proof;
- the exact next action: review, approve or execute.
