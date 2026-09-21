# Shakkho — Complete Product and Prototype Specification

**Status:** Build specification for the ADLASB Final Round prototype

**Product name:** **Shakkho**

**Document precedence:** **[ADLASB Final Round Case PDF](../ADLASB/ADLASB-Hackathon_Final-Round_Case.pdf) → [PRD](../PRD/PRD.md) → [architecture](../architecture/architecture.md) → this specification → design/code**. When documents conflict, the higher document wins. Evidence reconciliation and precedence are defined in [reconciliation-rules.md](../architecture/reconciliation-rules.md).

**Normative language:** **MUST/MUST NOT** is mandatory for acceptance; **SHOULD/SHOULD NOT** is expected unless a reason is recorded; **MAY** is optional.

---

## 1. Specification objective

Shakkho is one human-led legal-aid operating system serving five citizen situations, seven provider scenarios and eleven technical challenges through one authoritative Application/Case record. It is not a collection of demos, an AI lawyer or a replacement for authorised legal-aid personnel.

Every working action MUST:

1. authenticate and authorise the actor;
2. validate the current state and requested transition;
3. update canonical state;
4. append an attributable audit event;
5. create, accept, complete or escalate the relevant promise/task;
6. update the appropriate role-scoped views;
7. update the safe citizen Status Sentence when applicable.

An interface-only interaction does not count as implementation. Only unavailable external connections—16699 transport, SMS/email gateways, NID/court sources and payment disbursement—may be visibly labelled simulations. Shakkho's internal transitions, failures and audit records MUST work.

---

## 2. Core product thesis

The system distinguishes four conditions that ordinary case trackers often collapse:

1. information was recorded;
2. an authorised human made a decision;
3. the next actor accepted responsibility;
4. the promised action was completed with evidence and safely communicated.

The four reusable mechanisms are:

- **Canonical Case Record and Case Ledger:** operational state plus a per-application/per-case integrity-verifiable event chain;
- **Promise Engine:** named owner, acceptance, due time, completion evidence and escalation;
- **Human Decision Gate:** evidence-first authorised decisions with reasons and overrides;
- **Status Sentence:** approved, safe, plain-language Bangla/English status templates with a three-state travel advisory.

---

## 3. Mandatory coverage

### 3.1 Five citizen scenarios

| ID | Citizen | Mandatory barrier and outcome |
|---|---|---|
| A1 | Moyuri Akter | Unsafe contact, inaccessible NID, representative report and missing first-hand account; progress safely, distinguish Ripon's statements, enforce safe contact and allow correction/withdrawal |
| A2 | Ripon | Blind representative; independently complete a meaningful Bangla task without PDF, CAPTCHA, visual-only OTP or sighted help |
| A3 | Nabila | Urgent image-based abuse/pressure; restrict evidence, surface urgency for human review and track referral acknowledgement/deadline/escalation |
| A4 | Nuching Marma | Low literacy, Marma/limited Bangla, UDC assistance and unreliable connectivity; preserve translation/provenance/consent and survive network loss |
| A5 | Abdul Malek | Seven-month case, unreliable shop number, informal hearing dates and missing lawyer updates; obtain screenless status and surface overdue updates before travel |

### 3.2 Seven provider scenarios

| ID | Provider | Required operational outcome |
|---|---|---|
| B1 | DLAO officer | One explained queue for new, incomplete, urgent, pending and overdue work; human priority and recorded override |
| B2 | Legal Aid Officer/Mediator | Registration, contact, safety, notices, scheduling, documents, attendance, multiple attempts, ODR/in-person fallback and outcome |
| B3 | 16699 agent | Shared Application/Case lookup plus Bangla assisted intake/status without a separate note system |
| B4 | UDC entrepreneur | Assisted intake, checklist, free-service notice, consent/provenance, bounded access, safe contact and weak-network support |
| B5 | Panel lawyer | Assignment worklist, accept/decline, documents, hearings/deadlines, structured updates, reminders and safe linked notifications |
| B6 | Receiving DLAO | Complete referral package, accept/return/acknowledge, shared status and non-acknowledgement follow-up |
| B7 | Administrative/case-support staff | Search/reconstruct the record, view history/tasks and generate one routine report from captured data |

### 3.3 Eleven technical challenges

| ID | Mandatory capability |
|---|---|
| T1 | Lawyer-change request, human reassignment, interim stage/payment reconciliation and separate repeated-inactivity review alert |
| T2 | Two-or-more returned/rejected transfers in the same unresolved transfer chain, retained escalation and authorised route decision |
| T3 | Three separate related cases, one shared document and staff-only group view without merging confidentiality/outcomes |
| T4 | Fuzzy duplicate candidates over 10–15 records, including at least two similar-but-different traps and reversible human review |
| T5 | Natural Bangla multi-turn intake with approved slots/tools, provenance, correction and sensitive human handoff |
| T6 | Five-to-six document briefing/checklist with source anchors, one missing item and one unclear/unreadable item |
| T7 | Maintenance, property and labour settlement drafts, marked inference, deterministic inconsistency and human review |
| T8 | At least three triage components over at least five cases, with one disagreement surfaced for human resolution |
| T9 | Three offline records, idempotent sync, one conflict, human resolution and independent integrity verification |
| T10 | Installable PWA, safe caching, Normal/Light modes under the same throttled profile and reported load/interaction measures |
| T11 | Two asynchronous signers, one offline, later sync, independent cryptographic verification and mutation failure |

---

## 4. User roles and authority

| Role | May view/do | MUST NOT do |
|---|---|---|
| Citizen/applicant | Own application/case-safe view, confirm/correct/withdraw permitted information, requests, appeal/grievance, safe status | See co-applicants or unrestricted provider notes |
| Representative | Scope-limited represented-person actions and status | Treat unconfirmed report as applicant-confirmed |
| 16699 agent | Verify caller, permitted status, safe callback, assisted intake, knowledge search | View restricted evidence or decide eligibility/routing |
| UDC entrepreneur | Time-bounded assisted intake, checklist, document capture, offline queue | Become the applicant contact, retain post-expiry access or charge for free service |
| DLAO/Legal Aid Officer | Eligibility, priority, routing, referral, assignment, escalation actions and closure according to authority | Delegate consequential judgment to AI |
| Mediator | Safety screen, attempts, notices, attendance, notes, draft review and outcome | Infer consent or auto-schedule unsafe joint mediation |
| Receiving DLAO/SCLAC/LLAC officer | Review minimum referral package, accept/return/acknowledge according to office authority | Receive ownership before acceptance |
| Panel lawyer | Accept/decline, necessary file, hearings/deadlines, structured updates | View unrelated/group applicants or close the case |
| Case-support staff | Search, reconstruct, handover notes and routine report | Make legal/eligibility/routing decisions |
| Supervisor/oversight | Resolve operational escalation and view unresolved final rung | Erase the original transfer/promise history |
| Appeal authority | Review appeal evidence and decide with reason | Modify original rejection invisibly |
| Finance/accounts | Review interim/final payment stages and simulated disbursement | Block legal case closure or auto-calculate recoverable liability |
| System administrator | Versioned directory/policy/template/user configuration | Inherit case decision authority |
| Read-only auditor/jury | Audit, access logs, exported verification and coverage evidence | Mutate operational state |

Consequential decisions MUST be server-authorised. Hiding a control in the UI is not sufficient permission enforcement.

---

## 5. Required number of screens/pages

### 5.1 Final count

Build **35 route-level page templates**.

| Area | Count |
|---|---:|
| Citizen and access | 10 |
| Assisted channels | 3 |
| DLAO/office operations | 11 |
| Mediation and signing | 4 |
| Lawyer and finance | 4 |
| Administration, audit and jury controls | 3 |
| **Total** | **35** |

This count refers to reusable route templates, not every seeded record or wizard step. Tabs, drawers, confirmation dialogs, empty/loading/error states and role variants do not create separate pages. The 23 mandatory requirements are reached through these shared pages.

The standalone integrity/signature verifier is an additional static verification artefact, not a Shakkho application route, and therefore is not counted as a 36th screen. If delivered as HTML, it MUST run independently from an exported bundle and public key with network access disabled.

### 5.2 Delivery tiers and cut line

- **Tier 1 — acceptance-critical:** required to trigger and prove the 23 mandatory acceptance paths. Tier 1 is never cut.
- **Tier 2 — thin:** present only at the minimum depth stated in the inventory. S23's B7 routine report/search remains Tier 1, while CSV/PDF export is Tier 2; S24 is one thin appeal/grievance path; S33 is a read-only seeded configuration view with no policy-pack editor.

Every page below carries its tier explicitly. When time is constrained, remove Tier 2 export/polish before reducing any Tier 1 state change, guardrail or audit evidence. “All 35 pages” therefore means all Tier 1 routes plus the stated thin Tier 2 surfaces—not production-depth administration, reporting or grievance management.

### 5.3 Global overlays/components not counted as pages

The following MUST be reusable components:

- notification centre;
- safe Status Sentence and travel-advisory preview;
- Human Decision Gate drawer;
- provenance/source inspector;
- document/source anchor viewer;
- promise detail and escalation ladder;
- access-reason/break-glass dialog for Nabila's restricted evidence;
- offline/sync indicator;
- language and Normal/Light toggles;
- quick-exit action;
- simulated badge and integration status;
- reset/confirmation dialog;
- toast/live-region feedback;
- latest audit-event and hash-verification panel.

---

## 6. Route and page inventory

### 6.1 Citizen and access — 10 pages

| ID | Route | Page | Tier | Required contents and working actions | Coverage |
|---|---|---|---|---|---|
| S01 | `/` | Access hub | Tier 1 | Shakkho explanation; five doors; Bangla default; safe/neutral branding; English, Light and quick-exit controls; role/provider entry | Five doors, G1, G4 |
| S02 | `/auth` | Citizen register/login | Tier 1 | Safe-channel check before OTP; voice/assisted/in-person alternatives; numeric reference + PIN/safe phrase; repeat audio OTP; no CAPTCHA | A1, A2, Annex B2 register/login |
| S03 | `/apply` | Application intake wizard | Tier 1 | New/resume; applicant, legal-aid office, method/type, previous reference, child/category, case type/subtype, income/address, representative, opposite party, safe contact, accessibility, vulnerability; read-back and provenance per field | A1, A2, A4, T5, Annex B1/B2 |
| S04 | `/apply/documents` | Document checklist/upload | Tier 1 | Case-type checklist; file/photo capture; blur/size feedback; versions; missing/uncertain labels; free-service notice where assisted | A4, B4, T6, G6 |
| S05 | `/apply/receipt/[ref]` | Submission/offline receipt | Tier 1 | `APP-YYYY-XXXXX` or `TEMP-xxxx pending sync`; digits-only keypad reference; resume code; safe delivery choice; what happens next | Annex IDs, T9 |
| S06 | `/citizen` | Citizen home | Tier 1 | Application/case list with minimal safe content; one Status Sentence; owner/next action/due time; accessible callback/status options | A5, G3, G4, G7 |
| S07 | `/citizen/cases/[caseId]` | Citizen case/status | Tier 1 | Safe timeline, verified next step, lawyer/referral/mediation status, failed-contact log summary, three-state travel advisory with source/validity | A5, B5/B6, Status Sentence |
| S08 | `/citizen/record/[applicationId]` | Representation and statements | Tier 1 | Authority scope; Ripon-reported vs Moyuri-confirmed facts; first-hand promise; confirm/correct/withdraw; withdrawn payload hidden while event remains | A1, A2, G2, T ledger |
| S09 | `/citizen/requests/[id]` | Citizen action centre | Tier 1 | Lawyer-change request; safe callback; provide information; applicable appeal with reason/guidance; grievance register/status; no automatic decision | T1, appeal, grievance |
| S10 | `/access-simulator` | IVR/USSD/SMS simulator | Tier 1 | Tabs for keypad/voice IVR, USSD and SMS; numeric lookup; safe phrase; audio OTP/repeat; `SHORT_BN` segment count; neutral suppression when unsafe; SMS/web-text equivalents for every IVR task used by Deaf or hard-of-hearing people | A2, A5, B3, USSD/SMS door |

### 6.2 Assisted channels — 3 pages

| ID | Route | Page | Tier | Required contents and working actions | Coverage |
|---|---|---|---|---|---|
| S11 | `/16699` | Helpline agent console | Tier 1 | Caller verification; Application/Case lookup; permitted disclosure level; safe phrase; Status Sentence; story-already-told summary; approved knowledge search; assisted intake/handoff | B3, A1/A2/A5, T5 |
| S12 | `/udc` | UDC assisted intake | Tier 1 | Free-service acknowledgement; applicant vs assistant contact; translation/source labels; `VERBAL_READBACK` consent and witness; checklist/photo capture; access expiry | A4, B4, T5/T6 |
| S13 | `/udc/sync` | Offline queue and conflict recovery | Tier 1 | Encrypted pending queue; temp IDs; foreground sync; session-expiry re-auth; retry; temp-to-APP mapping; per-field conflict comparison; forgotten-PIN discard warning; logout wipe | A4, T9, T10, G8 |

### 6.3 DLAO and office operations — 11 pages

| ID | Route | Page | Tier | Required contents and working actions | Coverage |
|---|---|---|---|---|---|
| S14 | `/dlo` | Today/operations queue | Tier 1 | New, incomplete, urgent, pending and overdue segments; age/SLA; plain reasons; owner/next action; filters/search; recommendation override with reason | B1, T8, G5/G7 |
| S15 | `/dlo/applications/[id]` | Verification and eligibility | Tier 1 | Identity/doc/vulnerability review; confirmed/unconfirmed facts; duplicate warning; published criteria; request info; human accept/reject; reason, guidance and appeal pointer; Case ID only on acceptance | Annex B1/B2, B1, T4/T6 |
| S16 | `/cases/[caseId]` | Unified case workspace | Tier 1 | Role-scoped summary; people/representation; timeline/ledger; documents; promises/tasks; decisions; notifications; access history; outcome/closure checklist | G1–G10, B7 |
| S17 | `/dlo/routing/[caseId]` | Jurisdiction and pathway decision | Tier 1 | Evidence and missing facts first; office directory; Advice/Mediation/Direct Aid/Other Service; recorded “resolved?” and “beneficiary requests panel lawyer?”; human route decision | Annex B2 blocks 3–5, G5 |
| S18 | `/dlo/referrals` | Referral inbox/outbox master-detail | Tier 1 | Package completeness; send/acknowledge/accept/return; structured reason; sender ownership in transit; time in limbo; two-return transfer-chain escalation; authorised reroute to named office | A3, B6, T2 |
| S19 | `/dlo/duplicates/[id]` | Duplicate candidate review | Tier 1 | 10–15 seed records; Bangla/English/transliteration attributes; privacy-limited intake warning; authorised side-by-side; duplicate/separate/related; reversible decision; confusion table | T4, G5/G9 |
| S20 | `/dlo/incidents/[groupId]` | Related-incident group | Tier 1 | Staff-only group; three separate Salma cases; one shared document via per-case links; case-specific outcomes; revoke one link only; lawyer conflict check | T3, G6/G9 |
| S21 | `/dlo/triage/[id]` | Multi-component triage review | Tier 1 | Category, urgency and process/jurisdiction component findings; evidence/reasons; disagreement; safety/wrong-jurisdiction samples; authorised resolution feeding Today queue | T8, B1, G5 |
| S22 | `/dlo/documents/[caseId]` | Document intelligence | Tier 1 | Six seeded files; OCR/page-region anchors; classification; duplicate/latest version; checklist; missing and unreadable items; source-verifiable briefing; officer verification | T6, B1/B7, G6 |
| S23 | `/office/search-reports` | Search and reporting | Tier 1 core; Tier 2 export | Search Bangla, English, transliteration, Application/Case ID; field/version history; handover notes; one routine B7 seeded report and district/SLA filters. CSV/PDF export is optional Tier 2 and MUST NOT displace the routine view | B7, Annex cross-cutting reports |
| S24 | `/office/appeals-grievances` | Appeals and grievance worklist | Tier 2 thin | One working applicable appeal path: competent-authority review/decision/notification. One grievance path: `REGISTERED → INVESTIGATING → RESOLVED → CLOSED`, with “asked for payment” or “lawyer not responding”; no extra grievance administration | Annex B1 and cross-cutting services |

### 6.4 Mediation and signing — 4 pages

| ID | Route | Page | Tier | Required contents and working actions | Coverage |
|---|---|---|---|---|---|
| S25 | `/mediator` | Mediator worklist | Tier 1 | New/scheduled/today/notice-failed/awaiting-outcome matters; owner, attempt, date and safety status | B2, G7 |
| S26 | `/mediator/cases/[caseId]` | Mediation workspace | Tier 1 | Registration; safety screen; contact/notices/delivery; party modes and remote consent; schedule; documents; attendance; attempts; ODR failure and in-person fallback; settled/partial/failed/absent outcome | B2, A1 safety, Annex pathway |
| S27 | `/mediator/drafts/[draftId]` | Settlement drafting | Tier 1 | Maintenance/property/labour templates; note-to-draft; marked AI inference; numbers/dates/names/monthly-total checks; Bangla output; audio read-back; human review and version lock | T7, G5/G6 |
| S28 | `/sign/[token]` | Party signing | Tier 1 | Safe signer ceremony; canonical document hash; two asynchronous signers; one offline; PIN/witness; device/server time; sync; export signed artefact/public key for the separate verifier; edited document fails and requires re-signing | T11, B2, G10 |

### 6.5 Lawyer and finance — 4 pages

| ID | Route | Page | Tier | Required contents and working actions | Coverage |
|---|---|---|---|---|---|
| S29 | `/lawyer` | Lawyer worklist | Tier 1 | Offered/accepted/urgent/overdue assignments; workload; hearing/deadline; mobile-first; accept/decline reason | B5, T1 |
| S30 | `/lawyer/cases/[caseId]` | Lawyer case workspace | Tier 1 | Minimum necessary latest-version package; hearing calendar; attendance/outcome/next-date as separate fields; structured update; required next update; source/provenance | B5, A5 |
| S31 | `/dlo/lawyer-management/[caseId]` | Assignment/reassignment/accountability | Tier 1 | Financial-status branches; panel approval/practice/workload/conflict; citizen request; assignment; missed-update pattern review; handover and urgent coverage; interim fee-stage reconciliation; safe notice | T1, B5, Annex B2 block 5 |
| S32 | `/finance/payments` | Finance payment queue | Tier 1 | Interim/final stage evidence; paid/earned/disputed display; approve/return; simulated disbursement; post-closure continuation; never block closure or calculate recoverable amount | T1, Annex payment subprocess |

### 6.6 Administration, audit and jury controls — 3 pages

| ID | Route | Page | Tier | Required contents and working actions | Coverage |
|---|---|---|---|---|---|
| S33 | `/admin` | Seeded configuration reference | Tier 2 thin | Read-only versioned office/referral directory, role matrix, fixed/default threshold, panel registry, approved knowledge/templates, notification templates and integrations marked REAL/SIMULATED; no policy-pack editor and no case decisions | Scalability, Annex cross-cutting |
| S34 | `/audit` | Audit, access and integrity | Tier 1 | Search event chain; actor/role/office/channel/authority; access logs; Nabila break-glass review; signed checkpoint; export event/signature artefacts and public keys; withdrawn content unavailable; no mutation. Verification itself runs in the standalone verifier, not this app page | G9/G10, T9/T11 |
| S35 | `/demo` | 23/23 Coverage Navigator and Failure Lab | Tier 1 | Every A/B/T item one click away; seeded state/trigger/reset/event; virtual clock; network/unsafe answer/non-ack/two returns/missed update/conflict/tamper/unreadable/ODR/signature/logout failures; `/selftest`; Normal/Light measurement; visitor ID | Live jury testability, all 23 |

---

## 7. Existing-route compatibility

The current `/`, `/dlo`, `/lawyer` and `/admin` routes are already canonical S01, S14, S29 and S33 routes. Only legacy `/dashboard/{role}` routes MAY remain as migration aliases; they MUST redirect or render the corresponding canonical page and MUST NOT become a second workflow or separate data store. Existing legacy `/sim/*` routes MUST move behind or link to S35 and MUST cause real seeded state/audit changes rather than UI-only feedback.

---

## 8. Shared shell and navigation

### 8.1 Global controls

Every applicable page MUST provide:

- Bangla default and complete English toggle;
- Normal/Light rendering toggle;
- visible current role and office;
- notification centre;
- online/offline/sync state;
- quick exit for citizen/access pages;
- accessible skip link and main landmark;
- visitor/scenario label on public demo;
- no unexplained numerical risk score.

### 8.2 Provider shell

- Desktop: fixed/sticky role navigation and bounded content width.
- Mobile/tablet: functioning drawer with overlay, focus trap, Escape/close and close-after-navigation.
- Navigation is permission-derived; direct URL access is still server-authorised.
- “Simulated” items are grouped and visibly dashed/labelled.
- Global notification/outbox status MUST distinguish `QUEUED`, `SENT`, `DELIVERED`, `FAILED` and `SUPPRESSED`.

### 8.3 Citizen shell

- Show minimal safe information first.
- Lead with one Status Sentence and one next action.
- Collapse source detail until requested.
- Never reveal dispute type, opposite party, violence/coercion detail or restricted evidence in lock-screen-like surfaces.
- Quick exit MUST navigate immediately to a neutral page and clear visible sensitive state from the current view.

---

## 9. Visual and interaction requirements

The current design system remains the base unless the higher documents require a change.

- All colours, type, spacing, radii and motion MUST use `frontend/app/tokens.css` and approved font setup.
- Bangla citizen/UDC/lawyer views MUST use a legible Bangla face; do not rely on a Latin-only display font.
- Use semantic red/yellow/black only with text/icon/state labels; colour alone is insufficient.
- Avoid gradients, shadows, decorative card grids, gamified scores and AI spectacle.
- Use hairline lists, strong headings, restrained panels and one clear primary action.
- Touch targets MUST be at least 44×44 CSS pixels for citizen/lawyer/UDC actions.
- All fields MUST have persistent labels, help/error association and Bangla/English messages.
- At 200% zoom, content MUST reflow without horizontal page scrolling except controlled document tables with an accessible alternative.
- Loading, empty, partial, offline, stale, failed and unauthorised states MUST be designed, not left as blank pages.

### 9.1 Normal/Light mode

Light mode MUST preserve the same routes, security, validation and task semantics while removing decorative images, animation, full display fonts, eager previews, non-critical prefetch/polling and chart-heavy views. It MUST retain safety warnings, consent, provenance, decision evidence, offline recovery and errors.

Run Normal and Light against the same build, seed, cold cache, Slow 3G and 4× CPU profile three times each; report median transferred KB, request count, first meaningful paint, interactive time, completion seconds and taps. Repeat on the chosen low-end Android device.

---

## 10. Application and intake specification

### 10.1 Required application fields

| Group | Required fields/behavior |
|---|---|
| Submission | Legal-aid office, application method/channel, submission time, requested legal-aid type, previous reference |
| Matter | Case type, subtype, short account, incident location/date where applicable, opposite party |
| Applicant | Name, contact, address, NID status/value if available, income/financial facts, applicant category |
| Safeguarding | Child involved, vulnerability flags, coercion/GBV/safety indicators, accessibility/literacy/language/connectivity needs |
| Representation | Representative identity, relationship, authority basis/scope, confirmed/unconfirmed fields |
| Contact | Each number/channel owner, safety state, safe time, quiet hours, neutral wording and alternate route |
| Provenance | Speaker, typist, translator, intermediary, source language, AI extraction, confirmer and correction/withdrawal history per material fact |
| Documents | Type, version, source, quality, hash, latest/duplicate state, OCR/uncertainty and access classification |
| Consent | Type, scope, method, time, witness/assistant and withdrawal; audio read-back for non-readers |

Missing NID MUST NOT silently invent identity or automatically stop a safe application. Use `IDENTITY_UNVERIFIED` and route verification to an authorised person.

### 10.2 Intake behavior

- Begin sensitive conversational intake with “Is it safe to talk or call this number?”
- Allow new, save, resume and assisted modes.
- Present a read-back summary before submission.
- Distinguish required, unavailable, uncertain and refused-to-answer.
- An assisted contact MUST NOT overwrite the applicant's contact.
- Child/vulnerability flags MUST tighten permissions and appear in the officer review.
- Submission issues `APP-YYYY-XXXXX`; an offline draft issues `TEMP-xxxx` until authoritative sync.

---

## 11. Status, safe contact and notification specification

### 11.1 Status Sentence

Citizen-visible status MUST come only from approved Bangla/English templates and typed slots. Free-form LLM text is forbidden.

Two publication tiers:

- **Routine:** may publish automatically from verified workflow state.
- **Sensitive/hearing-related:** requires authorised human verification.

### 11.2 Travel advisory

| State | Requirement |
|---|---|
| `TRAVEL_REQUIRED` | Date, place and verified source required |
| `NO_TRAVEL_NEEDED` | Human-verified basis and validity window; forbidden for court hearing dates; wording includes “unless a later notice is received” |
| `UNKNOWN` | Default; directs citizen to safe 16699/office contact |

### 11.3 Safe delivery

Before OTP, SMS, call or disclosure, evaluate the recipient, number owner, safety state, allowed time, wording and verification level. Unsafe delivery produces `SUPPRESSED_UNSAFE_CHANNEL` plus a responsible fallback promise.

Bangla SMS MUST use approved `SHORT_BN` variants designed for approximately one Unicode segment, display predicted segment count and never truncate the date/reference/callback instruction.

---

## 12. Human Decision Gate specification

For eligibility, rejection, priority, routing, referral conflict, mediation suitability/outcome, lawyer assignment/reassignment, appeal, payment approval and closure:

1. show evidence, source and uncertainty before the recommendation;
2. show missing information and policy version;
3. allow only outcomes authorised for the role;
4. require reasons for rejection, high-stakes acceptance and every override;
5. record actor, role, office, authority, evidence set, recommendation, result, reason and time;
6. generate the next task/notification from the human result.

AI MUST NOT execute the final transition directly.

---

## 13. Promise and escalation specification

| Promise type | Semantics |
|---|---|
| Handoff | Requires receiver acceptance; sender owns it until accepted |
| Duty | Named owner and due time; completion requires evidence |
| Citizen-owed | Reminder-oriented; unreachable is not refusal |

States: `OFFERED → ACCEPTED → ACTIVE → FULFILLED`, with `RETURNED`, `OVERDUE`, `ESCALATED` and authorised cancellation.

Escalation ladder: `owner → supervisor → programme/DBLA oversight`. The last unresolved rung MUST stay visible.

The demo virtual clock MUST provide `+1h`, `+24h`, `+48h`, `jump to next due` and reset. Advancing it MUST run real scheduler logic and create a labelled demo event.

---

## 14. Service workflow specification

### 14.1 Verification and eligibility

- Technology checks completeness, possible repeats, document quality and published criteria.
- Human chooses request information, accept, reject or applicable appeal path.
- Rejection requires reason, next-step guidance and appeal pointer.
- Case ID `DLAS-YYYY-XXXXX` is created only on acceptance.

### 14.2 Jurisdiction and routing

- Present candidate office/pathway and missing facts.
- Human selects Advice, Mediation, Direct Legal Aid/Litigation or an Other Applicable Service/referral.
- Referral is not a fourth peer legal-aid service pathway.
- T2 escalation triggers after **two or more returned/rejected transfers within the same unresolved transfer chain**, regardless of interleaved resubmission or acknowledgement, and remains until a human route decision names a receiver that accepts.

### 14.3 Advice

- Record advice category and safe next step.
- Record explicit “issue resolved?” decision.
- If unresolved, return to routing, panel assessment or another applicable service.

### 14.4 Mediation

- Screen coercion, violence and power imbalance first.
- Human selects proceed, separate sessions, remote, unsuitable or refer.
- Track notice delivery, date, per-party mode, identity/join check, attendance, documents and multiple attempts.
- ODR failure creates a real in-person fallback/reschedule promise.
- Outcomes: settled, partial, failed or party absent.

### 14.5 Direct legal aid and lawyer assignment

- Record explicit citizen request for panel lawyer.
- Record financial-status decision and reason.
- “No funded panel/can bear cost” MUST inform the applicant and record alternatives.
- Human selects an approved panel lawyer using practice area, workload and conflict information.
- Lawyer accepts/declines with reason before responsibility changes.

### 14.6 Referral

- Package contains reason, history, requested action, minimum necessary documents, restrictions, sender/receiver and acknowledgement deadline.
- Completeness validator blocks omitted required package fields.
- Sender owns the case in transit.
- Receiving office accepts or returns with structured reason.
- Non-acknowledgement and two-return ping-pong create real promises/escalation.

### 14.7 Outcome, closure and payment

- Closure requires reports, verification, documents and approvals.
- Closure is an authorised decision and event.
- Interim `PaymentStage` reconciliation may occur at lawyer reassignment before closure.
- Final payment evidence/approval/simulated disbursement may continue after closure.
- Payment MUST NOT block closure; `CLOSED · PAYMENT_PENDING` is valid.

### 14.8 Appeal and grievance

- Appeal: `FILED → UNDER_REVIEW → DECIDED_APPROVED/DECIDED_REJECTED → NOTIFIED` by competent authority.
- Grievance: `REGISTERED → INVESTIGATING → RESOLVED → CLOSED`, with reopen from resolved when authorised.
- Neither flow rewrites the original decision/history.

---

## 15. Technical module specifications

### T1 — Lawyer change and repeated inactivity

- Seed Marzina plus two other active matters for the same lawyer.
- Versioned demo threshold: two missed required updates on one case and a three-active-case pattern for separate review.
- Citizen request enters DLAO queue.
- Human reassigns; outgoing handover and urgent coverage promise are created.
- Interim FeeSchedule shows paid/earned/disputed stage evidence and is labelled illustrative—not DBLA policy.
- Pattern wording MUST be “review,” never misconduct or recoverable amount.

### T2 — Jurisdiction ping-pong

- Seed Rahim's DLAO ↔ LLAC chain with structured reasons.
- At two returns in the same unresolved transfer chain—regardless of interleaved resubmission or acknowledgement—show time in limbo and retained escalation.
- Sender remains owner until named receiver accepts.
- Human route decision is mandatory.

### T3 — Related incident

- Seed Salma plus two co-workers as separate Case IDs.
- Staff-only group projection; applicants never see co-applicants.
- Store common evidence once; grant per-case `DocumentLink` permissions.
- Withdrawing one applicant revokes only that link, not the shared document or other links.
- Preserve case-specific instructions, confidentiality, outcomes and audit.
- Run lawyer conflict check across linked cases.

### T4 — Duplicate detection

- Use name, parent/spouse, age, phone, village/union, incident date, opposite party and document hash.
- Handle Bangla numerals, spacing, `মোঃ/মো./Md.`, transliteration and spelling variants.
- Intake roles see only “possible existing application—route to DLAO.”
- Authorised reviewer sees comparison and chooses duplicate, separate or related.
- Show found/missed/traps confusion table; never label fraud.

### T5 — Conversational Bangla intake

- Safety-first opening.
- Fill only approved fields and preserve transcript/provenance.
- Allowed tools: required documents, published criteria and office directory.
- Mask direct identifiers before model calls; strict JSON schema; prompt-injection guard.
- Demonstrate straightforward and sensitive/ambiguous handoff with packet.
- Deterministic fallback MUST complete the demo without the model.

### T6 — Document agent

- Use six seeded documents including phone photo, missing item and unreadable scan.
- Every material briefing sentence links to a page/region OCR span or is dropped.
- Show classification, blur, duplicate/latest version and case checklist.
- Officer verifies; uncertain text is never guessed.

### T7 — Settlement drafting

- Provide maintenance, property and labour Bangla templates.
- Mark inferred text.
- Deterministically compare numbers/words, dates, names and monthly/total amounts.
- Include one planted inconsistency.
- Require audio read-back where appropriate, legal review, consent and version lock.

### T8 — Multi-component triage

- Fixed schemas for category, urgency and process/jurisdiction components plus orchestration.
- Use at least eight seeded cases in Shakkho (exceeding PDF minimum five), including disagreement, safety and wrong-jurisdiction cases.
- Display concise evidence/reasons, never hidden chain-of-thought.
- Human resolution feeds the DLAO queue and agreement metric.

### T9 — Offline sync and integrity

- Three offline records with UUID and `TEMP-xxxx` receipt.
- AES-GCM queue; PIN-derived key in memory; foreground-only sync.
- Expired session requires re-authentication and PIN before sync.
- Forgotten PIN has no backdoor; explicit warning/discard only.
- Server deduplicates UUID, maps IDs and appends canonical event referencing offline commitment.
- Conflicts never use silent last-write-wins; human comparison required.
- Provide a separately built static client-side verifier that accepts only the exported event/checkpoint artefact and public key, makes no Shakkho API calls, reads no app state/database and recomputes all hashes/signatures; a verifier embedded in S28 or S34 does not count. Tamper button remains demo-only.
- State threat model; never claim tamper-proof.

### T10 — Low-bandwidth PWA

- Installable and offline-reopenable.
- Safe cache: shell, assets, minimal reference and encrypted queue only.
- Exclude case pages, sensitive evidence and persistent auth tokens by default.
- Manual Normal/Light toggle; `Save-Data` MAY suggest Light.
- Logout wipes key, queue, decrypted data and sensitive caches.
- Execute the identical measurement harness specified in Section 9.1.

### T11 — Asynchronous e-signature

- ECDSA P-256 prototype keys and synthetic identities.
- Sign canonical document hash plus case/document/version/signer metadata.
- Two signers at different times; one offline and later synced.
- Lock after first signature; edits require re-signing.
- The standalone no-API verifier succeeds before mutation and fails after mutation.
- UI states that cryptographic validity does not prove identity, legal validity, capacity, consent or enforceability.

---

## 16. Golden Thread acceptance

| ID | Pass condition |
|---|---|
| G1 | All channels/providers touch the same record and show source/role/handover |
| G2 | Speaker, typist, translator, inference, confirmer and representation authority remain visible |
| G3 | Unsafe contact can be suppressed/delayed with recorded reason and fallback owner |
| G4 | Required tasks have accessible, non-screen or assisted equivalent routes |
| G5 | Consequential recommendations are reviewable/correctable/overridable and human authority is recorded |
| G6 | Missing, uncertain, latest-version and duplicate document issues are visible without guessing/merging |
| G7 | Mediation, referral, lawyer, task and deadline show owner, status and next action |
| G8 | Offline/retry/conflict paths do not silently lose or duplicate records |
| G9 | Role privacy persists across handovers and group links |
| G10 | Jury can reconstruct actor, time, channel, provider role, authority and consequence |

---

## 17. Data, privacy and ledger specification

- Sensitive narrative/PII lives in encrypted `VaultPayload`, not immutable event text.
- Ledger uses opaque per-payload keyed HMAC commitments, not raw hashes of names/phones.
- Withdrawal masks/removes permitted payload and destroys its HMAC key; append `WITHDRAWN` event without repeating content.
- Event chain remains verifiable after withdrawal.
- Nabila's evidence has no unrestricted thumbnail; access requires case role or prototype break-glass reason and audit.
- T3 group access is staff-only and per-link.
- Every sensitive view writes `AccessLog`.
- Checkpoint root is signed with a key outside PostgreSQL and verified against exported events; state the host-key limitation.
- Public demo uses synthetic data only—no real NID, beneficiary, case, payment or live 16699 call.

---

## 18. AI, OCR and cost controls

- All AI/OCR calls are server-side.
- Strip/mask direct identifiers and send minimum context.
- Validate strict schemas; model cannot mutate state.
- Treat user/document content as untrusted instructions.
- Time out and fall back deterministically.
- Enforce per-tenant, per-endpoint and global daily spend/token limits.
- At 80% global budget warn operator; at 100% open circuit and switch T5–T8 to deterministic fallback.
- Display degraded/fallback mode without blocking the underlying human workflow.

---

## 19. Offline and shared-device specification

- Service worker caches only approved assets/reference data.
- Encrypted local queue uses random salt, calibrated PBKDF2 and AES-GCM.
- Derived key remains memory-only.
- Sync is foreground-only; do not depend on iOS Background Sync.
- Pending count, retryability, temp mapping and conflict state are visible.
- Quota failure MUST warn before accepting a large offline file.
- Never silently evict pending drafts.
- Logout/reset wipes encrypted queue, decrypted working data, key and sensitive caches.

---

## 20. Administration and scaling specification

One national codebase MUST configure rather than fork:

- offices, DLAO/SCLAC/LLAC/authorised entities and focal points;
- district/office scope;
- role grants;
- effective-dated policy packs and legal claim references;
- referral threshold default/fixed prototype value of two returned/rejected transfers in the same unresolved transfer chain;
- panel registry, practice areas and workload;
- approved templates/knowledge;
- SLA/escalation timers;
- notification templates;
- integration mode and contract.

The prototype's S33 view is read-only seeded configuration. A future authorised configuration command would write an audit event; it is not required before mandatory acceptance paths are complete. Administrators cannot make legal/case decisions through configuration.

---

## 21. Demo tenant and seeded data

### 21.1 Tenant lifecycle

- One active tenant per browser/session.
- Deterministic seed target under two seconds.
- Six-hour idle and 24-hour absolute TTL.
- Garbage collection every ten minutes.
- A provisional hard safety ceiling MAY start at 200 active demo tenants, but it is not a supported-capacity claim. Before freeze, run a load test at the expected jury load—minimum 25 simultaneous visitor tenants exercising seed, reset and core reads/writes—record p95 latency, seed/reset time and error rate, then set or lower the operational cap from evidence. Never fall back to shared mutable state.
- Reset creates a new generation and rejects late writes from the old generation.

### 21.2 Required fixtures

- Moyuri, Ripon, Nabila, Nuching and Malek.
- Marzina plus two other inactive cases for one lawyer.
- Rahim's two-return DLAO/LLAC transfer.
- Salma plus two co-workers and one common factory-fire document.
- 12–15 duplicate records with true variants and two trap pairs.
- Two complete scripted T5 conversations plus about ten Bangla utterance variants covering spelling, colloquial phrasing, correction and sensitive/ambiguous handoff.
- Six to eight versioned approved knowledge articles/templates searchable from the 16699 and UDC assisted-access pages and cited by T5/T7 where used.
- Six documents with one missing and one unreadable.
- Maintenance, property and labour note sets with inconsistency.
- At least eight triage cases.
- Three offline records and one conflict.
- One settlement with two signers.
- DLAOs for Joypurhat, Jhenaidah, Khagrachhari and Barguna; LLAC, SCLAC, focal point and fictional other competent authority.
- Eight panel lawyers with approval, practice and workload.
- One seeded user for every role.

---

## 22. Failure Lab requirements

| Trigger | Required observable recovery |
|---|---|
| Unsafe person answers Moyuri's phone | Suppress/delay, reason event, preserve unconfirmed state, choose safe route |
| OTP destination unsafe | No OTP sent; offer voice/assisted/in-person verification |
| Nabila referral not acknowledged | Sender remains owner; overdue promise and escalation appear |
| Nuching network drops | Encrypted draft and temp receipt survive; reconnect resumes |
| Two offline edits conflict | Comparison goes to human; no overwrite |
| Malek lawyer misses two updates | DLAO action appears; safe status changes only after verification |
| Rahim returned twice | Escalation retained; human route decision and named receiver required |
| Duplicate trap selected | Side-by-side evidence; no fraud/auto-merge/reject |
| Triage components disagree | Reasons displayed; officer resolves and audit records it |
| Document unreadable | Missing/uncertain surfaced; no invented summary |
| ODR connection fails | Reschedule/in-person fallback promise created |
| Signed document changed | Independent verification fails |
| Ledger row tampered | Export/checkpoint verification fails |
| Shared UDC logout | Queue/key/decrypted/sensitive cache wiped |
| Officer does not act | Escalates to supervisor then oversight; final rung remains visible |

---

## 23. Prototype measurements

All results MUST be labelled **prototype measurements from seeded data**, not real-world impact.

| Metric | Formula |
|---|---|
| Owned-next-action rate | Active cases with accepted/active due promise ÷ active seeded cases |
| Handoff acknowledgement time | Median `ReferralAccepted/Returned − ReferralSent` |
| Prevented unnecessary journey rate | Verified `NO_TRAVEL_NEEDED` delivered before planned travel ÷ seeded planned journeys |
| Continuity rate | Cross-channel/provider transitions retaining one ID ÷ all seeded transitions |
| Timely intervention rate | Overdue promises resolved before failure/closure ÷ overdue seeded promises |

Display numerator, denominator and source event IDs.

---

## 24. Acceptance and test specification

### 24.1 `/selftest`

In a fresh tenant, run all A1–A5, B1–B7 and T1–T11 scenarios. The suite MUST also contain explicit assertions for:

- all five doors reaching the same record, including the neutral privacy-aware SMS rendering and short USSD status/next-action/callback flow;
- G1–G10 individually, with event/access/decision evidence rather than page presence;
- rejection with reason/guidance and the applicable competent-authority appeal decision/notification path;
- both financial-status branches: funded panel assessment and no-funded-panel/alternatives recorded;
- closure blocked when any required report, verification, document or approval is missing, followed by successful authorised closure when the checklist is complete.

For every check, show:

- PASS/FAIL;
- initial/final state;
- event IDs;
- promise/decision/outbox evidence;
- integrity result;
- reset control.

A page existing does not count as PASS.

### 24.2 Critical Playwright paths

1. Moyuri/Ripon safe contact, safe OTP, representation and withdrawal.
2. Nuching offline capture, expired-session re-auth, sync conflict and logout wipe.
3. Nabila/Rahim non-acknowledgement, virtual time, two-return escalation and reroute.
4. Malek/Marzina missed updates, reassignment, urgent coverage and interim payment reconciliation.
5. Mediation safety, T7 version lock and T11 mutation failure.

### 24.3 Release gates

- Bangla OCR risk test completed.
- Real Android TalkBack/audio OTP test completed without sighted helper.
- Public PWA installs from clean browser, reopens offline and reconnects.
- Normal/Light same-profile comparison recorded.
- Role/office/case/tenant enforcement verified.
- No client-side LLM secret.
- Global AI spend breaker verified.
- Every navigator item triggers state change and audit event.
- QR/URL work on two phones.

---

## 25. Simulation boundaries

| Boundary | Prototype treatment |
|---|---|
| 16699 telephony | Labelled simulator; caller verification/intake/status state is real |
| SMS/email gateway | Labelled simulator; outbox, safety suppression, retry and delivery states are real |
| Payment gateway | Labelled simulator; review/approval/disbursement events are real |
| NID service | Interface stub; identity gaps remain explicit |
| Court source | Officer/lawyer-entered source unless a real approved adapter exists |
| Video/ODR transport | May be simulated; scheduling/failure/fallback states are real |
| AI/OCR provider | May be live server-side or deterministic fallback; human boundary unchanged |

Every simulator MUST show its interface contract and `SIMULATED` label.

---

## 26. Definition of done

Shakkho is ready for submission only when:

- every Tier 1 route and acceptance action is reachable or intentionally role-protected; S24 and S33 exist only at their defined thin depth, and S23's CSV/PDF export may be omitted before its Tier 1 B7 report/search path;
- all five doors access the same records;
- all 23 mandatory items are one-click reachable from S35;
- each acceptance action changes canonical state and writes an event;
- all G1–G10 checks pass;
- human-only decisions cannot be bypassed;
- unsafe contact, accessibility, offline, conflict and failure paths work;
- shared evidence never merges T3 cases;
- application and Case ID rules match Annex B2;
- two-return T2 escalation works across interleaved resubmission or acknowledgement within the same unresolved transfer chain;
- T1 interim reconciliation works before closure and payment never blocks closure;
- citizen status is template-safe and travel advice defaults to `UNKNOWN`;
- external simulations are labelled;
- reset/visitor isolation survives simultaneous browsers;
- `/selftest`, clean-browser PWA and critical Playwright paths pass.

---

## 27. Recommended build order

1. Foundation: tenancy, roles, IDs, state machines, Case Ledger/Vault, promises, decisions, virtual clock, reset.
2. S01–S13: safe/accessible and assisted/offline intake, T5/T6/T9/T10.
3. S14–S23 Tier 1 core: DLAO operations, T2/T3/T4/T8 and the B7 routine report/search.
4. S25–S28: mediation, T7 and T11.
5. S29–S32: lawyer, T1 and finance.
6. S34–S35 plus the standalone no-API verifier: audit, navigator, failure lab and expanded selftest.
7. Add Tier 2 thin surfaces: S24, read-only seeded S33 and S23 export only if time remains.
8. Acceptance: TalkBack, OCR, throttling, clean install, measured jury-concurrency load, multi-browser isolation and final deployment.

Do not deepen optional polish until each mandatory item has one real acceptance path.

### 27.1 Repository dependency preflight

Verified in the repository on 2026-09-21:

| Dependency | Verified assumption |
|---|---|
| `docs/design/design.md` | Exists; uses the PDF-first document hierarchy, Shakkho name, Tier 1-first delivery, read-only S33 and the restrained accessible visual direction assumed here |
| `AGENTS.md` | Exists; requires documentation updates with product changes, token-only colours/fonts and full Bangla/English coverage |
| `frontend/app/tokens.css` | Exists; defines shared colour, type, spacing, radius, layout, focus and motion tokens. Hardcoded presentation values belong here, not in components |
| `frontend/app/layout.tsx` | Exists; loads the declared Playfair Display/Noto Serif Bengali variables, sets Bangla as the initial document language and installs the i18n provider |
| `frontend/lib/i18n.tsx` | Exists; provides Bangla-default and English application-wide messages with persistent language selection |
| `frontend/` | Exists as a Next.js 16 + React 19 + TypeScript migration baseline. It does **not** yet implement S01–S35, the backend contracts or the required real state changes; the implementation agent must treat current dashboards and `/sim/*` as migration inputs, not completed acceptance evidence |

The coding agent MUST repeat this preflight at the start of each slice because repository state may change between sessions. A missing or changed dependency is reported as a slice blocker or documented migration—not silently recreated under a second convention.

---

## 28. Master implementation-generation prompt

Copy the prompt below into the coding agent from the repository root.

```text
You are implementing Shakkho, the ADLASB Final Round legal-aid prototype in this repository.

CURRENT_SLICE: <set exactly one: FOUNDATION, SLICE_1, SLICE_2, SLICE_3, SLICE_4, SLICE_5, SLICE_6, TIER_2_THIN, or ACCEPTANCE>

This is the complete project prompt, but this session is limited to CURRENT_SLICE. Do not implement, refactor for, or begin the next slice. Work already completed by earlier slices must be inspected and preserved; do not rebuild it under a parallel architecture.

Read these sources completely before changing code, in this exact precedence order:
1. docs/ADLASB/ADLASB-Hackathon_Final-Round_Case.pdf
2. docs/PRD/PRD.md
3. docs/architecture/reconciliation-rules.md
4. docs/architecture/architecture.md
5. docs/spec/spec.md
6. docs/design/design.md and repository AGENTS.md files

If documents conflict, the higher source wins. Do not invent legal rules, policy thresholds or external integrations. Keep the product name Shakkho everywhere.

Goal:
Build the working integrated Shakkho prototype described in docs/spec/spec.md. It must implement all five citizen scenarios, seven provider scenarios and eleven technical challenges through one shared Application/Case record. A working action must change canonical state, append an audit event and update its promise/task. UI-only mock behavior does not count. Only unavailable external connections—16699 transport, SMS/email, NID/court and payment gateway—may be visibly labelled SIMULATED; their internal Shakkho workflow must still work.

Required UI scope:
Implement the 35 route-level page templates S01–S35 at the tiers inventoried in Sections 5–6 of docs/spec/spec.md. Complete Tier 1 acceptance paths before Tier 2: S24 stays one thin appeal/grievance path, S33 is read-only seeded configuration, and S23 export is optional after the B7 routine report/search works. Reuse route templates, tabs, drawers and components; do not create 23 disconnected mini-apps. Only legacy `/dashboard/{role}` and `/sim/*` routes are aliases; preserve them by redirecting/linking to canonical routes rather than maintaining duplicate workflows.

Mandatory product rules:
- Bangla is default with a complete English toggle.
- Normal/Light mode must preserve the same task and pass the defined T10 comparison.
- Enforce tenant, role, office and case scope on the server.
- Consequential decisions require the Human Decision Gate and authorised human role.
- Sent is not accepted; referral sender owns the case until receiver acceptance.
- Application IDs are APP-YYYY-XXXXX; Case IDs are created only after acceptance as DLAS-YYYY-XXXXX; offline work uses TEMP-xxxx until sync.
- Preserve field-level provenance and representation status.
- Keep sensitive payloads in the encrypted vault and ledger only opaque keyed commitments.
- Citizen-visible status comes only from approved templates, never free-form AI.
- Unsafe contact/OTP must be suppressed with a recorded reason and fallback promise.
- T2 escalates at two or more returned/rejected transfers within one unresolved transfer chain, even when resubmission or acknowledgement is interleaved.
- T3 links cases and shared evidence without merging confidentiality, instructions or outcomes.
- PaymentStage supports interim T1 reconciliation before closure and never blocks closure.
- Offline sync is idempotent, foreground-only and conflict-aware.
- Logout on shared devices wipes queue keys and sensitive cached state.
- AI/OCR calls are server-side, schema-bound, identifier-masked, rate/spend limited and have deterministic fallbacks.

Engineering shape:
- Keep the modular-monolith architecture.
- Use the existing Next.js/TypeScript frontend and shared design tokens.
- Use PostgreSQL for canonical state.
- Run the scheduler and outbox worker in-process on the always-on prototype host.
- Keep all secrets server-side.
- Build deterministic seeded tenants, reset, Time Machine, Failure Lab, 23/23 Coverage Navigator and `/selftest`; `/selftest` must also prove all five doors, G1–G10, rejection/appeal, both financial branches and closure blocking.
- Build the integrity/signature verifier as a standalone static client-side artefact that uses only exported data and a public key, with no Shakkho API or app-state access.
- Do not use gradients, shadows, decorative dashboards, unexplained scores or hardcoded colors/fonts.
- Do not overwrite unrelated user changes.

Implementation order:
1. Inspect the repository and report the current gap against Sections 5–6 and 27 of the spec.
2. Implement the shared foundation and migrations first.
3. Implement the six integrated slices in the specified build order.
4. After each slice, run relevant tests and update documentation/status without claiming unbuilt items.
5. Finish with expanded `/selftest`, critical Playwright journeys, standalone verifier tests, lint/typecheck/build, clean-browser PWA/offline verification, a minimum-25-visitor load test and a concise built-vs-simulated report.

Per-session execution gate:
- Work on exactly CURRENT_SLICE and stop when its evidence pack is complete or a concrete blocker is proven.
- Before editing, verify `docs/design/design.md`, every applicable `AGENTS.md`, `frontend/app/tokens.css`, `frontend/app/layout.tsx`, `frontend/lib/i18n.tsx`, the current routes and the previous slice's evidence/tests.
- Do not start the next slice merely because time or context remains.
- A slice passes only when its required action changes canonical state, appends the attributable event, creates/completes/escalates the promise where applicable, enforces the server-side role/office/case/tenant rule and passes the slice tests.
- If the slice fails, leave its status incomplete, preserve the failing evidence and list the smallest next action. Never mark partial UI as acceptance coverage.
- The next session may select the following slice only after the current slice's evidence pack and tests pass, or the user explicitly records an accepted deviation.

For every page or module delivered, provide:
- routes/files changed;
- state transition and audit event implemented;
- role/permission enforced;
- mandatory A/B/T and Golden Thread items covered;
- test command and result;
- remaining gaps.

End every session with one slice evidence pack containing:
- CURRENT_SLICE and PASS/FAIL/INCOMPLETE;
- routes, migrations and files changed;
- acceptance IDs and Annex workflow blocks exercised;
- before/after states, audit event IDs and promise/task evidence from the seeded test;
- human authority and privacy checks performed;
- exact test commands and results;
- built versus simulated boundaries;
- unresolved failures or risks;
- explicit statement that the next slice was not started.

Do not stop at wireframes or placeholder buttons. Continue until the current implementation slice has a genuine state-changing acceptance path and passes its tests. If a legal/policy fact is not in the ADLASB PDF or verified claim register, label it subject to authorised confirmation and keep it out of automatic decisions.
```

---

## 29. Traceability summary

| Specification group | Primary pages |
|---|---|
| Five doors | S01–S05, S10–S13 |
| A1/A2 | S02, S03, S08, S10, S11 |
| A3 | S03–S04, S15–S18, S34–S35 |
| A4 | S03–S05, S12–S13, S22 |
| A5 | S06–S07, S10, S29–S31 |
| B1/B7 | S14–S16, S21–S23 |
| B2 | S25–S28 |
| B3/B4 | S11–S13 |
| B5/B6 | S18, S29–S32 |
| T1 | S09, S14, S29–S32 |
| T2–T4 | S18–S21 |
| T5–T8 | S03, S11–S12, S21–S22, S27 |
| T9–T11 | S13, S28, S34–S35 |
| G1–G10 | S16, S34–S35 plus all state-changing routes |

This specification is complete only while it remains subordinate to the ADLASB PDF and consistent with the PRD and architecture.
