# DLAS Prototype — Final Architecture (v3)
### ADLASB Legal Tech Hackathon 2026 · "Five Doors, One Record"

**Architecture is frozen as of v2.** Everything below v3 changed is acceptance-test-level
detail — exact scenario wiring, seed-data counts, and legal-citation precision — not a
redesign. Schema, engine, write-safety, RBAC pattern, four-layer framing: unchanged.

---

## 1. System Shape (unchanged since v1)

```
FRONTEND (existing, role-based views: Citizen / UDC / DLAO / Lawyer / Mediator / 16699 / Admin)
        │  fetch() — the frontend NEVER writes state directly
        ▼
API LAYER  (Express or FastAPI — ~20 routes)
        │  every request checked against the role's permission scope (Section 6)
        ▼
WORKFLOW ENGINE  (the ONLY code allowed to mutate db.json)
   event in → idempotency check → match rules.json → run action(s) → mutate state
   → append audit[] → return new state
        │
        ▼
data/
 ├── db.json            state
 ├── rules.json          configurable workflow/routing rules and thresholds
 ├── scenarios.json      the 23 mandatory items, each wired to its literal acceptance test
 └── fee_schedules.json  demo payment rates (never real fee values)
```

---

## 2. `db.json` — three more additions (schema shape otherwise unchanged)

**Payment reconciliation is stage-based, not a single flag** (T1's acceptance test names this explicitly):
```json
{
  "payment_reconciliation": {
    "assignment_id": "LA-001",
    "completed_stages": ["INITIAL_REVIEW", "HEARING_1"],
    "pending_stages": ["HEARING_2"],
    "eligible_amount": "DEMO_RATE",
    "status": "DLAO_REVIEW"
  }
}
```
This sits alongside the lawyer reassignment flow, kept separate from the repeated-inactivity pattern alert — the PDF is explicit that these are two different outputs of T1, not one.

**Referral supports RETURNED as a real state, not just an ack timeout** (B6's acceptance test is "acknowledges/accepts/**returns**"):
```json
{ "status": "RETURNED", "return_reason": "WRONG_JURISDICTION",
  "return_count": 1, "return_history": [{ "from": "DLAO-DHAKA", "reason": "WRONG_JURISDICTION", "at": "..." }] }
```
Both sending and receiving office read the same `referral` record — a return is a status change on that one record, never a second copy.

**Provenance events stay additive, never overwritten** (A1 requires Moyuri to later correct or withdraw information while Ripon's original report stays visible):
```json
[
  { "event": "REPRESENTATIVE_REPORTED", "person_id": "P-002", "field": "incident_description", "value": "..." },
  { "event": "APPLICANT_CONFIRMED", "person_id": "P-001", "field": "incident_description" },
  { "event": "APPLICANT_CORRECTED", "person_id": "P-001", "field": "incident_description", "new_value": "..." }
]
```
The current field value updates; the event history does not. A juror can see Ripon's original account, Moyuri's confirmation, and her later correction as three distinct audit entries — this is one of the strongest Golden Thread demonstrations available in the prototype, worth featuring in the pitch.

---

## 3. `rules.json` — demo-scope metadata

Every rule that encodes a legal-routing assumption (not a pure workflow mechanic) now carries an explicit disclaimer so the prototype never implies it has encoded Bangladeshi law in full:
```json
{
  "id": "RULE-DEMO-FAMILY-MAINTENANCE-ADR-ROUTING",
  "source": "PROTOTYPE_RULE", "effective_scope": "DEMO", "requires_legal_validation": true,
  "on": "CASE_CLASSIFIED",
  "when": { "classification.domain": "FAMILY", "classification.matter": "MAINTENANCE" },
  "then": [ { "type": "SET_FIELD", "path": "classification.adr", "value": { "eligible": true, "required": true } },
            { "type": "CREATE_TASK", "task_type": "ADR_REVIEW", "assigned_to_role": "DLAO" } ]
}
```
Purely mechanical rules (lawyer inactivity threshold, referral return-count escalation, duplicate confidence threshold) don't need this tag — they're workflow thresholds, not legal claims.

---

## 4. Workflow Engine (unchanged from v2)

Idempotency key check, serialized write queue, atomic tmp-file rename — all already correct, no further change.

---

## 5. API surface — two additions

```
POST   /api/lawyer-assignments/:id/reassign   triggers stage-based payment reconciliation
POST   /api/reports/district-status           generates the B7 report from live db.json (not hand-entered)
```
Rest of the route list unchanged from v2.

---

## 6. Role-based access — enforced at the API, not the frontend

Golden Thread G9 requires access boundaries to *persist across handovers*, which a frontend-only permission check cannot guarantee (any direct API call bypasses it). So every route checks the caller's role against a fixed scope table before touching `db.json`:

| Role | Scope |
|---|---|
| CITIZEN | own case only; own documents; status fields |
| REPRESENTATIVE | fields listed in their `representation.scope` only |
| UDC | intake creation + cases they were the assisting actor on |
| LAWYER | cases in their own `lawyer_assignments` only |
| MEDIATOR | mediation object + linked case fields relevant to mediation |
| DLAO | full operational record for their district |
| RECEIVING_DLAO | referred case + the handover package only, until acknowledged |
| ADMIN/CASE_SUPPORT | search + audit + reporting fields, no case-content edit rights |

Implementation: one middleware function, `role → allowed field paths`, checked against the route + payload before `workflowEngine.processEvent()` runs — same "one mechanism, reused everywhere" principle as the rest of the architecture, not a per-route special case.

---

## 7. Four-layer framing — using the PDF's own layers

The PDF's own "How to think about the challenge" table already defines four layers — use these for the pitch and solution paper, since they're the vocabulary the jury was given (confirmed correct on recheck; not the invented set an earlier draft proposed):

```
┌─────────────────────────────────────────────────────┐
│ 1. CITIZEN ACCESS         → Five Doors, A1–A5        │
├─────────────────────────────────────────────────────┤
│ 2. SERVICE DELIVERY       → B1–B7 provider views     │
├─────────────────────────────────────────────────────┤
│ 3. TECHNICAL CAPABILITY   → T1–T11                   │
├─────────────────────────────────────────────────────┤
│ 4. GOVERNANCE & TRUST     → provenance, permissions, │
│                              audit, human authority   │
└─────────────────────────────────────────────────────┘
                    all four sit on:
              ONE SHARED CASE RECORD (db.json)
```
Layers 1–3 are the 23 mandatory items grouped exactly as the PDF groups them; layer 4 is the Golden Thread. This maps directly onto the pitch structure's "one system, four layers, 23 mandatory items" line — use this diagram on the architecture slide. The implementation architecture (Frontend → API → Workflow Engine → Shared Record, Section 1) and this four-layer presentation are two different views of the same system — both correct, used for different purposes.

---

## 8. Acceptance-test-level wiring — v3 additions

These are the items that needed a more specific scenario than v2 had. Each matched against the PDF's literal acceptance-test wording.

**T1 — Lawyer change.** PDF: *"stage-based payment reconciliation → separate repeated-inactivity review alert"* (two distinct outputs). Scenario: `LAWYER_CHANGE_REQUESTED → DLAO_REVIEW → REASSIGNMENT` writes `payment_reconciliation` (Section 2) on the old assignment; independently, `HEARING_MISSED` events across ≥3 cases for the same lawyer fire `RULE-LAWYER-PATTERN-ALERT` (unchanged from v1/v2) — kept as two separate code paths so the demo can show them as separate outputs, not one conflated status.

**T4 — Duplicate detection.** PDF: *"10–15 demo records including genuine duplicate candidates and at least two similar-but-different trap cases."* Seed exactly 12: 8 normal, 2 genuine duplicate candidates, 2 similar-but-different (same name/area, different phone+incident — the trap). DLAO decision on any candidate is one of `LINK | NOT_DUPLICATE | NEEDS_MORE_REVIEW` — never `FRAUD`, never an auto-merge.

**T5 — Conversational intake.** PDF requires *two* demonstrations, not one: (1) straightforward Bangla intake → slot-fill → confirmation → Application ID; (2) a sensitive/ambiguous statement → uncertainty flagged → conversation preserved → `CREATE_TASK` to a human *with the conversation context attached*, not just a generic escalation flag.

**A1 — Moyuri.** PDF: *"Moyuri can later correct or withdraw information."* Wired via the additive provenance-event chain in Section 2 — `REPRESENTATIVE_REPORTED → APPLICANT_CONFIRMED → APPLICANT_CORRECTED` (or `APPLICANT_WITHDREW_CONFIRMATION`), all visible in `audit[]`.

**B1 — DLAO officer.** PDF: *"override one system recommendation and see the override recorded."* Concrete scenario: system recommends `priority: NORMAL`; DLAO sets `priority: HIGH` with a typed reason; `recommendation`/`decision`/`decided_by`/`override: true` (Section 2 pattern from v2) makes this one API call, one audit entry — feature it directly in the pitch, it's the clearest single demonstration of human control in the whole prototype.

**B5 — Panel lawyer.** PDF: *"accepts an assignment, sees a hearing date, submits an update, then misses a later deadline; DLAO receives an overdue alert without a chase call."* Full chain: `ASSIGNED → ACCEPTED → HEARING_SCHEDULED → PROGRESS_UPDATE → (missed deadline) → OVERDUE_TASK created automatically`. Engine already supports every step; this just names the scenario explicitly in `scenarios.json`.

**B6 — Receiving DLAO.** PDF: *"acknowledges/accepts/returns; both offices see status."* Uses the `RETURNED` referral state from Section 2 — same record, both offices read it, no second copy.

**B7 — Admin/case-support staff.** PDF: *"generate one routine status/reporting view from data already captured in the case record."* `POST /api/reports/district-status` computes counts (new/pending/overdue/mediation/lawyer-assigned/referred/closed) by querying `db.json` live — the report has no separately-entered numbers, which is the actual point to make to the jury (G1/G7/G10 in one screen).

**T9 — Offline sync.** Add the PDF's required threat-model statement directly into the demo, not just the mechanism:
> *Threat model: protects against accidental duplication, conflicting offline edits, and inconsistent sync state. Assumption: does not claim protection against a fully compromised device or OS.*

**T11 — E-signature.** PDF: *"independent verification method."* The verification step must be a separate function from the signing step — don't just re-read the same flag the signer set. `verifyDocument(case_id)` independently recomputes the document hash and re-checks both signatures against it, callable on its own (not only as a side-effect of signing) — and the UI keeps the guardrail text visible: cryptographic validity ≠ legal validity, identity, capacity, or consent.

Everything else in the 23-item table (A2–A5 except A1, B2–B4, T2, T3, T6, T7, T8, T10) is unchanged from v2 — those were already matched to their literal acceptance test.

---

## 9. Verified legal grounding — tightened wording

Rechecked directly against the official CPC text (bdlaws.minlaw.gov.bd). Two refinements to v2's wording:

- **More precise than "mandatory since 2012":** the 2012 amendment (Act XXXVI of 2012) changed "the Court **may**" to "the Court **shall**" in §89A and §89C — that's the actual mandatory language. But §89E ("Application and commencement of the provisions of sections 89A and 89C") says those provisions apply *"to such area, and commenced on such date, as the government may, by notification in the official Gazette, fix"* — i.e., application is subject to area/date notification, not automatically nationwide-uniform. So the accurate statement for the solution paper is: **"CPC §§89A and 89C contain mandatory mediation language following the 2012 amendment ('shall' replacing 'may'), subject to the area/date application and commencement mechanism in §89E."** This is also, incidentally, the real provision that the very first (fabricated) draft you were given was probably gesturing at when it invented a "section 21B" — there is a genuine area/date-commencement mechanism in Bangladeshi law, it's §89E, not a section number that doesn't exist.
- **Worth citing directly, and useful for the pitch:** §89A (as amended 2017) lets the court refer a dispute to *"the concerned Legal Aid Officer appointed under the Legal Aid Act, 2000"* — a real, named legal hook connecting court-referred mediation to exactly the kind of legal-aid-officer role this case's DLAO/mediator roles are modeled on. Citing this specific line in the solution paper is stronger than a general CPC reference.
- Family Courts Act 2023 citation (replacing the repealed 1985 Ordinance) — unchanged from v2, re-confirmed correct.

---

## 10. Five success indicators (for the solution paper's required section)

Measurable, not invented percentages — report actual prototype numbers once you have them:
1. Time from intake start to a valid Application ID (any channel)
2. Percentage of cases with zero manual re-entry across provider handovers
3. Median referral acknowledgement time (creation → receiving-DLAO ack)
4. Overdue panel-lawyer task rate (tasks past `due_at` with no update)
5. Successful offline-created record sync rate with zero duplicates (T9's own test, reused as a system-health metric)

---

## 11. Internal QA coverage matrix (not for the jury — for you)

The PDF states any of the 23 items may be pulled for a live check during Q&A. Track readiness against this table before submission; it's a checklist, not an architecture artifact:

| ID | Trigger | Expected state change | Audit entry | Human decision shown | Failure test |
|---|---|---|---|---|---|
| A1 | representative intake | safe-contact flow active | ✓ | ✓ (correction) | unsafe contact attempt |
| A2 | voice status request | status delivered, no visual dependency | ✓ | — | — |
| A3 | urgent report | referral created, sensitive-access restricted | ✓ | ✓ | no acknowledgement |
| A4 | assisted + offline intake | queued then synced | ✓ | ✓ | network loss mid-submit |
| A5 | non-smartphone status request | next step surfaced | ✓ | — | 2 missed lawyer updates |
| B1 | queue review | priority overridden | ✓ | ✓ | — |
| B2 | mediation scheduling | remote/hybrid session created | ✓ | ✓ | — |
| B3 | helpline lookup | same record surfaced | ✓ | — | — |
| B4 | assisted intake | application + checklist + notice | ✓ | ✓ | network loss |
| B5 | assignment | accept → update → overdue alert | ✓ | ✓ | missed update |
| B6 | referral | acknowledged / accepted / returned | ✓ | ✓ | no acknowledgement |
| B7 | report request | live-generated report | ✓ | — | — |
| T1 | 2 missed hearings | reassignment + payment reconciliation | ✓ | ✓ | pattern alert (3rd case) |
| T2 | 2 returns | escalation | ✓ | ✓ | — |
| T3 | linked incident | shared doc, no data merge | ✓ | ✓ | attempted cross-case leak |
| T4 | fuzzy match | human review queued | ✓ | ✓ | trap case (similar, not dup) |
| T5 | ambiguous statement | human handoff with context | ✓ | ✓ | — |
| T6 | doc set | briefing + checklist | ✓ | ✓ | unreadable document |
| T7 | mediator notes | draft + inconsistency warning | ✓ | ✓ | — |
| T8 | 5 cases | conflict surfaced | ✓ | ✓ | disagreement case |
| T9 | 3 offline records | sync, no duplicate | ✓ | ✓ | simulated conflict |
| T10 | throttled load | light mode active | — | — | sensitive-cache exclusion check |
| T11 | async signing | independent verification passes | ✓ | ✓ | offline signer |

---

## 12. What changed in v3, one line each

- T1: payment reconciliation is now a stage-based object, explicitly separate from the pattern alert.
- T4: dataset size and composition (12 records, 2 duplicates, 2 traps) now specified.
- T5: two required demonstrations (straightforward + sensitive/handoff) now both named.
- A1: correction/withdrawal modeled as additive provenance events, not overwrites.
- B1: override demonstrated as one concrete scenario, not just supported by the data model.
- B5, B6, B7: each given its literal acceptance-test scenario (accept/decline/overdue; accept/return; live-generated report).
- T9: threat-model/assumptions statement added to the demo, per the PDF's explicit guardrail.
- T11: verification made an independently-callable function, not a re-read of the signing flag.
- Legal citation tightened: §89E's real area/date-commencement mechanism cited correctly (this is likely what the original fabricated "section 21B" claim was garbling), plus §89A's 2017 referral-to-Legal-Aid-Officer line as a direct citation.
- Added an internal (non-jury-facing) QA coverage matrix.

Nothing in Sections 1, 4, 6, 7, or 10 changed — they were already correct in v2.
