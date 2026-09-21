# Prompt NN — <Working outcome>

**Prompt status:** Draft | Approved | In progress | Done | Blocked  
**PDF coverage:** <A#/B#/T#/G#/Door/Annex block + verified PDF page/section>  
**Depends on:** <prompt numbers and passing evidence>  
**Solved file:** `Solved/NN-<slug>.md`

## 0. Decision Card

- **Frozen baseline:** <settled PRD/architecture/spec choices used>
- **Open decision/deviation:** <only a material unresolved choice, or `none`>
- **User decision:** <D-###, or `not required—frozen baseline applies`>

Do not generate/execute a case-specific design while a material Decision Card is unanswered.

## 1. PDF requirement and acceptance

| Item | Required evidence |
|---|---|
| ID and case/workflow | <PDF item> |
| Verified page/section | <exact reference or `needs team confirmation`> |
| Mandatory behavior | <close paraphrase; short quote only if necessary> |
| Minimum acceptance test | <literal observable threshold> |
| Guardrail | <human control/privacy/accessibility/failure rule> |

## 2. Approved sources

- PRD: <sections>
- Architecture: <sections/records/state machines>
- Specification: <S-pages/modules/tests>
- Decisions: <D-###>
- Existing evidence: <Solved files/tests>

## 3. Scope and cut line

**Build:** <one coherent outcome>  
**Do not build:** <later prompts and unrelated polish>  
**Tier 2 cut first:** <specific optional depth>

## 4. Implementation contract

1. <ordered implementation step>
2. <ordered implementation step>
3. <ordered implementation step>

**Stack:** follow architecture. Any new library requires a one-line capability-gap decision.

## 5. Shared-record and authority contract

| Contract | Required implementation |
|---|---|
| Canonical record | <Application/Case/other aggregate changed> |
| State transition | `<FROM> → <TO>` with invalid-edge rejection |
| Ledger events | `<EventName>` with actor/role/office/channel/authority |
| Promise/task | <created/accepted/completed/escalated or not applicable> |
| Permissions | <tenant + role + office + case scope> |
| Human decision | <who; evidence shown; decision; reason; what happens next> |
| Provenance/safety | <source/confirmation/safe-contact/access behavior> |

Confirm in the solution: no feature side store, duplicate record or UI-only acceptance state.

## 6. Failure behavior

- Trigger: <failure the juror can cause>
- Visible recovery: <retry/handoff/escalation/human review>
- Accountability: <owner, due time, retained evidence>

## 7. Tests and proof

Run:

```bash
<lint/typecheck/domain/integration/e2e commands>
```

Acceptance scenario:

1. <seed/open>
2. <trigger>
3. <verify state/event/promise/permission/failure>

Capture: <test name, event IDs, screenshot/artefact path and built-vs-simulated label>.

## 8. Required Solved update

Create `Solved/NN-<slug>.md` from `Solved/_TEMPLATE.md`. Update only proven rows in `Solved/TRACEABILITY.md`. Stop without starting the next prompt.
