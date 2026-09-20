# Shakkho Product Requirements Document

**Product:** Shakkho - Verified Legal Aid Operations for Bangladesh

**Repository:** Res-Judicata-Digitalis

**Document owner:** Team Res Judicata Digitalis

**Status:** Prototype build baseline

**Version:** 1.0

**Last updated:** 20 September 2026

> This root PRD is the canonical product-scope document for the repository. If it conflicts with
> `ai_read_me/spec.md`, `ai_read_me/architecture.md`, a slide, prompt, or an earlier document, this
> PRD controls product intent. The implemented API contract and tested domain rules control current
> software behaviour. Changes to the product thesis, evidence states, human-authority boundary, or
> prototype acceptance criteria require review by the project lead.

## 1. Product decision

Build Shakkho as a verification and intervention layer for Bangladesh legal aid, not as another
generic case-management system and not as a replacement for courts, NLASO, District Legal Aid
Offices (DLAOs), or the developing Digital Legal Aid System.

The product must answer a harder operational question than "what status was last entered?":

> Did the expected legal-aid service or handoff actually happen, what evidence supports that
> conclusion, where do sources disagree, and who must act next?

Shakkho turns critical work into evidence-bearing milestones, preserves conflicting claims,
derives an explainable evidence state, routes unresolved exceptions to an authorised officer,
communicates a verified next action safely, and can assemble verified lawyer work into a
payment-readiness record.

## 2. Problem

Legal-aid work crosses applicants, panel lawyers, officers, courts, mediators, helplines, and
finance processes. A case may appear to be moving while a critical handoff is late, missing,
self-reported, or contradicted elsewhere. Officers often discover the failure after the next
deadline has passed. Citizens may not know the reliable next action, and lawyers repeat reporting
work without a clear connection to fee processing.

Bangladesh is already digitising intake, assignment, tracking, mediation, notification, and data
management. Rebuilding those commodity functions would duplicate active institutional work.
Shakkho therefore concentrates on the missing operational capability: source-aware proof of
service and early intervention when that proof is absent, stale, or contradictory.

### 2.1 Root causes

- Records and communications are fragmented across institutions and channels.
- A single mutable status can hide who asserted it and what it was based on.
- The owner, deadline, evidence requirement, and failure route for the next action are often
  unclear.
- Self-reporting is necessary but insufficient for consequential milestones.
- Reporting adds work for lawyers while payment evidence is maintained separately.
- Officers inspect broad case lists instead of a small queue of exceptions requiring judgment.
- Low connectivity, shared phones, limited data, and differing digital literacy constrain service
  design.

### 2.2 Product hypothesis

If every critical handoff has a responsible actor, due window, minimum evidence, and failure route;
if observations remain attributed and append-only; if disagreement is preserved rather than
overwritten; and if verified work prepares reporting and claim evidence, then officers can
intervene earlier, citizens can receive more reliable next actions, and lawyers can report with
less duplicated effort.

This is a field-testable hypothesis, not a claim that the prototype has reduced court backlog or
case delay.

## 3. Users and jobs to be done

| User | Primary job | Immediate value |
|---|---|---|
| Legal-aid officer | Find and resolve missing, disputed, or stale handoffs | A focused, explainable intervention queue and complete decision trail |
| Panel lawyer | Report service quickly and understand missing evidence | A short update that can populate progress reporting and claim readiness |
| Citizen or legal-aid recipient | Know the safe, verified next action and challenge a wrong record | Neutral low-bandwidth communication, confirmation, dispute, or callback |
| Programme manager | Locate recurring operational bottlenecks without reading every file | Sourceable service-reliability measures and policy feedback |
| Finance reviewer | Determine whether a fee claim has the required support | A traceable payment-readiness packet; no automatic payment |
| Auditor | Reconstruct what was asserted, derived, corrected, and decided | Append-only evidence and attributed human decisions |
| System administrator | Configure policy safely and manage authorised access | Versioned rules, least privilege, and observable operation |

## 4. Goals, non-goals, and principles

### 4.1 Prototype goals

1. Prove that an expected legal-aid milestone can be reconstructed from attributed observations.
2. Detect missing, stale, and contradictory evidence without silently choosing a winner.
3. Allow only an authorised human to resolve a consequential conflict, citing the evidence and a
   reason.
4. Show a low-bandwidth reporting and citizen-notification path without claiming unsupported
   production integrations.
5. Demonstrate that verified work can populate a payment-readiness packet while approval and
   disbursement remain outside Shakkho.
6. Keep every derived state explainable and recomputable from preserved history.

### 4.2 Non-goals

- Replacing the government legal-aid system or court case-management system.
- E-filing, national identity integration, or a full document-management suite.
- Determining eligibility, guilt, liability, legal merit, or judicial outcome.
- Autonomous legal advice, lawyer discipline, reassignment, payment denial, or citizen-credibility
  scoring.
- Real payment disbursement.
- Claiming a live cause-list, court, finance, SMS, or IVR integration without authorisation.
- A lawyer leaderboard or performance ranking based on win rate.
- Blockchain or an opaque machine-learning risk score.

### 4.3 Product principles

1. **Evidence before status.** Every consequential state exposes its sources and rule.
2. **Disagreement is data.** A newer or more authoritative observation does not silently erase a
   conflicting active observation.
3. **Human authority for consequential action.** Automation prepares and routes; an authorised
   person resolves.
4. **Exceptions before dashboards.** The primary officer experience is work requiring action now.
5. **Append, do not rewrite.** Corrections supersede prior evidence without deleting it.
6. **Incentives before compliance.** A short lawyer update should reduce later reporting work.
7. **Bangla and low bandwidth first.** SMS, assisted entry, compact pages, and voice-ready flows are
   first-class.
8. **Interoperate before replace.** Official systems remain authoritative for their records.
9. **Minimum necessary data.** Sensitive content is separated, masked, and restricted.
10. **Measure service, not legal outcome.** Operational reliability must not become an automated
    misconduct judgment.

## 5. Core product model

### 5.1 The verified milestone

Each milestone represents one field of an expected service event and contains:

- the expected action and responsible actor;
- a due window and, where relevant, a freshness window;
- the field being evaluated and its policy-versioned evidence rule;
- attributed observations with source actor or organisation, channel, event time, capture time,
  and evidence reference;
- a derived evidence state, value, contributing observation identifiers, and reason code;
- any explicit supersession links;
- an authorised resolution when active values conflict;
- the next commitment and failure route; and
- optional claim relevance.

### 5.2 Canonical evidence states

| State | Meaning | Product behaviour |
|---|---|---|
| `PENDING` | A required value has not arrived and its due window remains open | Wait; show the upcoming commitment |
| `MISSING` | A required value is absent after its due window | Create an actionable exception |
| `REPORTED` | One attributed source supports one active value | Show as provisional |
| `CORROBORATED` | At least two independent actors or organisations support one value | Advance where policy permits |
| `VERIFIED` | An uncontested source is authoritative for that exact assertion | Advance and prepare formal records |
| `DISPUTED` | Two or more active normalised values conflict | Freeze automatic completion and route to review |
| `STALE` | Time-sensitive evidence has exceeded its freshness policy | Request current evidence and route as needed |
| `VERIFIED_WITH_RESOLVED_CONFLICT` | An authorised officer resolved a documented conflict with cited evidence and reason | Advance while retaining the losing claim and decision trail |

Confidence scores may affect review priority, but never establish truth. Two channels used by one
actor are not independent. Records from one organisation are not automatically independent.
Authority is scoped to the assertion: for example, a cause list may establish that a hearing was
listed but not that a lawyer attended.

### 5.3 Deterministic reconciliation order

For a requested field, the service must:

1. apply explicit supersession while retaining all historical observations;
2. select applicable, non-empty observations for the field;
3. return `PENDING` or `MISSING` when no required value exists, according to the due window;
4. normalise values using the field policy and group compatible observations;
5. return `DISPUTED` when multiple active values remain unless a valid authorised resolution cites
   all active conflicting observations, chooses an active value, and includes authority and reason;
6. for one value, test staleness, assertion-specific authority, and independent corroboration in
   that order; and
7. return the state, selected value where applicable, contributing IDs, superseded IDs, resolution
   ID, and a stable reason code.

Milestone state is a derived projection. Observation history is the evidence record.

## 6. Required product workflows

### 6.1 Signature workflow: conflicting next hearing date

1. A lawyer reports the next hearing date as 28 September.
2. A controlled court-source observation records 30 September.
3. The milestone becomes `DISPUTED`; both threads remain visible side by side.
4. An authorised officer reviews the supporting order, cites both observations, selects
   30 September, states the authority basis, and records a reason.
5. The milestone becomes `VERIFIED_WITH_RESOLVED_CONFLICT`.
6. The 28 September report remains visible as superseded or non-selected evidence.
7. A neutral corrected citizen message is committed to the outbox as `QUEUED`; delivery changes
   separately only when the provider confirms it.

This transition is the primary jury demonstration. It proves the product's differentiation in one
short sequence: conflicting evidence is preserved, human authority is explicit, and notification
status is operationally honest.

### 6.2 Assignment to verified contact

- Ingest or record the official assignment reference.
- Create a lawyer-contact commitment with a policy-defined due window.
- Accept a low-friction lawyer report of contact, failed attempt, or scheduled consultation.
- Request a neutral citizen confirmation or assisted callback where safe.
- Reconcile compatible or conflicting observations.
- Route overdue or denied contact to the officer without treating either party's claim as a verdict.

### 6.3 Missing hearing update

- Create the expected hearing and reporting commitment.
- Prompt the lawyer before and after the hearing.
- Mark the required value `MISSING` once the policy window passes.
- Increase transparent urgency when the next known deadline is near or non-service is reported.
- Record intervention, resolution, and the next commitment.

### 6.4 Mediation

Model mediator assignment, party contact, consent where required, scheduling, session occurrence,
and outcome recording as separate commitments. Verify procedural completion without exposing
confidential mediation content. Route a missed contact or scheduling milestone before labelling a
mediation unsuccessful. Production policy requires confirmation by competent legal and DBLA
authority.

### 6.5 Payment readiness

Link verified service milestones to configured claim requirements. Show complete and missing
items, policy version, supporting evidence, and officer review. Shakkho may prepare and submit a
packet to an authorised process; it must not approve or disburse funds.

## 7. Functional requirements

Priority uses `P0` for the demonstration-critical path, `P1` for the complete prototype, and `P2`
for pilot-readiness work.

| ID | Requirement | Priority | Acceptance summary |
|---|---|---:|---|
| FR-01 | Import or create a case reference without claiming ownership of the official record | P0 | Reference is unique and source-labelled |
| FR-02 | Define commitments, actors, due windows, required fields, authority rules, and freshness | P0 | Rules are explicit and versionable |
| FR-03 | Append attributed observations idempotently | P0 | Retry returns the same result; payload mismatch returns a conflict |
| FR-04 | Reconcile observations into the eight canonical evidence states | P0 | Domain decision table and tests pass |
| FR-05 | Preserve supersession, disagreement, and contributing evidence | P0 | Timeline reconstructs the full chain |
| FR-06 | Display an officer queue for `MISSING`, `DISPUTED`, and `STALE` milestones | P0 | Rows show rule/state, age, case, and commitment |
| FR-07 | Display a case evidence timeline and side-by-side reconciliation view | P0 | Sources, channels, dates, and conflicts remain distinguishable |
| FR-08 | Allow an authorised officer to resolve a conflict with cited observations and reason | P0 | Unauthorised or incomplete resolution is rejected |
| FR-09 | Commit resolution, recomputed state, next commitment, audit event, and outbox record atomically | P0 | Transaction either succeeds completely or rolls back |
| FR-10 | Provide a minimal lawyer update flow | P1 | A tested user completes a valid update in under one minute |
| FR-11 | Provide safe citizen confirmation, dispute, and callback paths | P1 | Copy is neutral and does not expose allegations on a shared-phone lock screen |
| FR-12 | Track notification lifecycle separately from case truth | P1 | UI never claims delivery before provider confirmation |
| FR-13 | Assemble a payment-readiness packet | P1 | Packet names every satisfied and missing policy requirement |
| FR-14 | Provide sourceable manager measures | P1 | Aggregate view drills down only within authorised scope |
| FR-15 | Support Bangla-first labels, responsive low-bandwidth use, keyboard navigation, and accessible status cues | P1 | Usability and accessibility checks pass |
| FR-16 | Support offline-safe client identifiers and conflict-aware synchronisation | P2 | Retried offline writes do not duplicate evidence |
| FR-17 | Integrate with official systems only through authorised, versioned adapters | P2 | Failure does not corrupt evidence state |

## 8. Screen requirements

1. **Officer intervention queue:** actionable state, case reference, commitment, condition age,
   transparent reason, due time, owner, and filters. Never show an unexplained risk score.
2. **Case evidence timeline:** expectations, observations, source identity, organisation, channel,
   event and capture times, evidence reference, supersession, resolutions, and notification status.
3. **Reconciliation view:** conflicting values displayed simultaneously with contributing evidence;
   authoritative evidence does not silently erase another active value.
4. **Intervention workspace:** evidence selection, supporting record preview, authority basis, reason,
   next commitment, safe-message preview, and atomic submit.
5. **Lawyer quick update:** minimal structured inputs with optional bounded speech-to-field draft;
   human review is required before submission.
6. **Citizen confirmation:** Bangla-first, low-data, neutral, and able to confirm, dispute, or request a
   callback without giving legal advice.
7. **Payment-readiness packet:** service items, evidence links, policy version, missing requirements,
   review status, and an explicit "no payment made" boundary.
8. **Manager view:** operational counts and time measures that link to authorised source cases while
   suppressing unnecessary personal content.

## 9. API and data boundaries

### 9.1 Phase 1 implemented contract

- `GET /health`
- `POST /cases/{case_id}/observations` with `Idempotency-Key`
- `GET /cases/{case_id}/timeline`
- `GET /officer/queue`
- visible deferred routes for resolution and claim submission return `501` until implemented

The generated OpenAPI document and evidence-state contract in `packages/contracts/` are the
frontend integration source. Contract drift must fail automated tests.

### 9.2 Core entities

`Case`, `Organisation`, `Actor`, `Assignment`, `Commitment`, `Observation`, `Resolution`,
`MilestoneState`, `ClaimPacket`, `ClaimPacketItem`, `NotificationOutbox`, and an idempotency
record. Phase 2 adds the security principal/role model and append-only security/audit events.

### 9.3 Transaction boundary

A consequential officer action must commit its resolution, recalculated milestone state, next
commitment, audit event, and notification-outbox row in one database transaction. An independent
worker attempts message delivery idempotently. Provider failure changes delivery state, not the
resolved case state.

## 10. AI boundary

Permitted, behind a provider-neutral interface and human confirmation:

- Bangla speech transcription;
- candidate field extraction with source passage and confidence;
- translation or plain-language message drafting from verified fields;
- source-linked operational summaries; and
- duplicate suggestions for a person to review.

Prohibited:

- changing evidence state or resolving conflict;
- determining eligibility, credibility, assignment, discipline, payment, or legal outcome;
- generating unreviewed legal advice;
- training an external model on case content without documented authority and safeguards; and
- sending sensitive user-facing content without the required approval gate.

The end-to-end product and demonstration must still work with AI disabled.

## 11. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | Follow `SECURITY.md`; default-deny, server-side case/office/sensitivity scope, MFA for privileged production roles, and auditable decisions |
| Privacy | Synthetic data only for the prototype; minimise and separate contact, case, and analytics data; neutral notifications and defined retention |
| Reliability | Idempotent ingestion, append-only evidence, recomputable projections, atomic consequential writes, and retry-safe outbox delivery |
| Performance | Queue and timeline remain usable on low-end devices and constrained connections; set measurable budgets during frontend integration |
| Availability | Graceful external-service failure, manual fallback, and no dependency on AI for core operation |
| Accessibility | Keyboard operation, visible focus, labelled controls, sufficient contrast, non-colour status cues, and screen-reader semantics |
| Localisation | Bangla-first user-facing content; timezone-aware timestamps displayed in Asia/Dhaka; English administrative terms where required |
| Interoperability | Versioned OpenAPI/export formats, provider-neutral AI boundary, and adapters that do not assume unconfirmed official APIs |
| Auditability | Every derived state and decision links to rule, evidence, actor, and time; corrections preserve earlier records |
| Configurability | Evidence rules, due windows, freshness, templates, and required claim items are versioned policy rather than hidden UI logic |

## 12. Measures and evaluation

The prototype records the mechanics needed to measure these outcomes; it does not claim the
outcomes before field testing.

- percentage of expected updates received within the configured window;
- percentage of sampled milestones with traceable evidence;
- number of missing or disputed handoffs discovered only after the next deadline;
- median time from exception creation to authorised resolution;
- median lawyer time to submit a valid update;
- officer time spent compiling progress reports;
- time from verified work to complete claim packet;
- citizen acknowledgement of the verified next action;
- notification failure and recovery rate; and
- unjustified differences in notification and resolution by channel or relevant service context.

## 13. Prototype acceptance criteria

The prototype is demonstration-ready only when all of the following are true:

- Every milestone state is traceable to source observations, policy, and a stable reason code.
- Conflicting values cannot silently replace one another.
- Conflicting authoritative records remain `DISPUTED` until valid human resolution.
- One actor repeating a claim over two channels remains one source.
- A required absent value becomes `MISSING` after its due window even when unrelated observations
  exist.
- Staleness is reachable, tested, and visible in the officer queue.
- An unauthorised or incomplete resolution cannot change a milestone.
- Earlier evidence remains visible after correction or resolution.
- Resolution and message creation are atomic, while delivery status is independent.
- A failed notification does not roll back a case decision and offers retry or callback handling.
- Officer and case reads are denied outside server-side role, office, case, and sensitivity scope.
- The lawyer update can be completed in under one minute in a moderated test.
- Citizen-facing text is comprehensible, neutral, and safe for a shared phone.
- Core demo pages remain responsive under a documented constrained-network test.
- The complete signature scenario works with AI disabled and synthetic data only.

## 14. Delivery plan and current status

### Phase 1 - backend evidence foundation: complete on `feat/backend-foundation`

Implemented and locally verified:

- FastAPI, SQLAlchemy, Alembic, PostgreSQL configuration, and deterministic domain separation;
- the eight evidence states and reconciliation engine;
- append-only observation ingestion, attribution validation, idempotency, and atomic projection
  recomputation;
- health, timeline, and officer queue reads;
- seed fixtures for `PENDING`, `MISSING`, `REPORTED`, `CORROBORATED`, `VERIFIED`, `STALE`, and the
  signature `DISPUTED` case;
- generated OpenAPI/evidence contracts and drift tests; and
- 25 passing tests, Ruff checks, and a disposable-database migration/seed check.

PostgreSQL execution remains to be repeated in the team integration environment because Docker and
PostgreSQL were unavailable on the Phase 1 workstation.

### Phase 2 - secure authorised resolution and audit: next

Phase 2 starts only after this PRD and `SECURITY.md` are accepted. Its vertical slice is:

1. add a minimal principal, role, office membership, and sensitivity-access model;
2. authenticate seeded prototype users through a standard library/provider-compatible boundary;
3. apply central default-deny authorization to every protected route;
4. implement `POST /milestones/{id}/resolutions` with officer authority, case scope, cited active
   observations, authority basis, reason, and concurrency safety;
5. atomically recompute the milestone, create the next commitment, append the audit event, and add
   the neutral notification-outbox row;
6. expose outbox status without implementing production SMS;
7. expand OpenAPI, fixtures, and tests, including cross-user/cross-office denials and the complete
   disputed-to-resolved signature scenario; and
8. run the security gate defined in `SECURITY.md`.

### Phase 3 - parallel experience and integration work

- Ahan builds the officer queue, timeline, reconciliation view, and intervention workspace strictly
  from the generated contract.
- Raima expands synthetic fixtures, PostgreSQL/integration/E2E coverage, notification simulation,
  and reproducible deployment checks.
- Shahriar owns backend rules, authorisation, resolution transaction, contracts, review, and merge.

### Later pilot work

Citizen confirmation, lawyer voice assistance, claim submission, mediation templates, offline sync,
official adapters, production messaging, monitoring, retention, backups, and institutional identity
must be field-validated and separately authorised.

## 15. Risks, assumptions, and open decisions

### Principal risks

- Duplicating government functionality instead of integrating with it.
- Treating an observation, confidence score, or official-looking source as universal truth.
- Exposing vulnerable citizens through shared devices, logs, exports, or excessive case detail.
- Creating officer alert fatigue through low-value or poorly tuned rules.
- Making lawyers perceive verification as automated surveillance or punishment.
- Overstating prototype integrations, payment capability, or outcome impact.
- Allowing the older JurisFlow model, frontend logic, or orchestration tools to bypass the canonical
  evidence-state rules.

### Assumptions requiring field validation

- Which source is authoritative for each exact assertion.
- Which roles may resolve, correct, reassign, approve, or submit.
- Which case types and messages are safe for citizen confirmation.
- Actual service windows, retention periods, fee requirements, and escalation paths.
- Technical and institutional availability of official case, court, identity, and finance systems.
- Ownership of product, data, security operations, support, and evaluation.

### Falsification criteria

Narrow or stop the concept if fieldwork finds that the relevant handoff failures are rare, the
official system already verifies them reliably, officers cannot act on detected exceptions,
citizen confirmation cannot be made safe, or payment delay is unrelated to evidence/reporting
burden.

## 16. Change control and definition of done

- A behaviour change starts with a PRD requirement and an executable test.
- Domain rules live in the backend, not the frontend, n8n, or an LLM prompt.
- The OpenAPI and evidence-state contracts are generated and checked for drift.
- Database migrations are reviewed for reversibility, integrity, privacy, and append-only impact.
- Security-sensitive work includes negative authorisation and abuse-case tests.
- A feature is not done until its failure state, audit trail, safe copy, and demo fixture are covered.
- No branch is release-ready while its tests, lint, migration check, contract check, and applicable
  `SECURITY.md` gate fail.

## 17. References

- `Shakkho_Verified_Legal_Aid_Operations_Bangladesh_Final_Corrected.pdf` - complete product,
  research, governance, and build specification supplied for this repository.
- `report.md` on `feat/backend-foundation` - Phase 1 implementation and verification report.
- `docs/architecture/backend-foundation.md` and `docs/architecture/reconciliation-rules.md` on
  `feat/backend-foundation` - implemented backend boundaries and rules.
- `packages/contracts/openapi.json` and `packages/contracts/evidence-states.json` on
  `feat/backend-foundation` - machine-readable integration contract.
