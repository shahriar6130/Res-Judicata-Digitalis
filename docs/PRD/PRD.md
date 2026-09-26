# Shakkho — Final Authoritative Solution Model

**Document status:** Final solution-model baseline for prototype implementation and the 1,000-word solution paper.  
**Supersedes:** All earlier concept, strategy and pitch drafts in this workspace.  
**Source hierarchy:** The ADLASB Final Round Case is the sole source of truth for competition scope, workflow, acceptance tests and judging. External laws, programme announcements and the supplementary workflow PDF are research candidates only; they may enter the paper or automated rules only after a team member personally validates and records them in the claim register. The operative precedence and conflict-resolution rule is maintained in [reconciliation-rules.md](../architecture/reconciliation-rules.md#document-precedence).
**Merged gap review:** The corrections in `final_final_changes.md` are incorporated into this same authoritative file; no separate model should be used for implementation.

> **Every legal-aid case is a chain of human obligations. It keeps one authoritative record, makes every obligation visible, and prevents a citizen from disappearing between channels, offices and providers.**

---

## 1. The actual problem being solved

Bangladesh does not merely need another application form, chatbot or dashboard. The official Digital Legal Aid System already plans applications, case tracking, lawyer assignment, mediation, notifications and data management. Reproducing those features is baseline compliance, not differentiation.

The deeper operational failure is that **recorded activity is often mistaken for delivered service**:

- a referral is sent but not accepted;
- a lawyer is assigned but does not acknowledge or update;
- a mediation notice is generated but the party is not safely reached;
- an assisted account is typed by somebody else but the applicant has not confirmed it;
- an offline submission appears complete locally but never reaches the authoritative record;
- a document exists but is unreadable, outdated or unverified;
- a case is marked closed although required reports, verification, documents or approvals are incomplete;
- a citizen knows that a case exists but not who owes the next action or when.

The result is delay, repeat travel, repeated storytelling, unsafe communication, chase calls, weak accountability and unreliable management data.

Shakkho solves this by making a distinction between:

1. **information recorded**;
2. **a decision made by an authorised human**;
3. **responsibility accepted by the next actor**;
4. **the promised service actually completed with evidence**.

That distinction is the solution's central operating insight.

---

## 2. What it is—and is not

Shakkho is a reference operating model for the required DLAS prototype. It combines the complete ADLASB workflow with four reusable mechanisms.

### Mechanism 1 — Canonical Case Record and Case Ledger

The current operational state is stored in a normal relational case record. Every meaningful action also appends a provenance-rich event to an integrity-verifiable **per-application/per-case** ledger. A periodic checkpoint hash makes later history rewrites detectable without forcing every case into one global serial chain.

Personally identifying or unsafe narrative payloads live in a separately permissioned `VaultPayload`, not inside the immutable event body. The ledger stores IDs, metadata and the payload hash. Correction appends a superseding event. Withdrawal masks or deletes the permitted vault payload and appends `WITHDRAWN`; ordinary operational views hide it while authorised audit shows only that it was withdrawn, by whom and when. This preserves both A1 withdrawal and ledger integrity.

This is not blockchain. The ledger provides reconstructability, conflict visibility and detectable integrity failure; it is not described as absolutely tamper-proof.

### Mechanism 2 — Promise Engine

Whenever a person or institution owes an action, the system creates a structured promise containing:

- responsible person and role;
- triggering event;
- required action;
- acceptance status;
- due time;
- evidence required for completion;
- escalation ladder;
- safe citizen-visible status.

A handoff remains the sender's responsibility until the receiver accepts it. “Sent” is not “received”; “assigned” is not “accepted”; “generated” is not “delivered.”

Promise types are explicit: **handoff** requires receiver acceptance; **duty** has an owner and due time; **citizen-owed** supports reminders but never labels an unreachable citizen as refusing. Escalation proceeds owner -> supervisor -> programme/DBLA oversight view; the final unresolved rung stays visible.

### Mechanism 3 — Human Decision Gate

Eligibility, rejection, appeal review where applicable, final priority, consequential routing, referral, lawyer allocation, mediation outcome and closure pass through a common human-decision control.

Technology may prepare evidence or recommendations. The authorised person must accept, edit or override the recommendation. Evidence is shown before the recommendation; high-stakes acceptance and every override require a reason. Decision time and override rate feed a sampled audit view to reduce rubber-stamping.

### Mechanism 4 — Status Sentence

Each case produces one safe, verified, plain-language status statement from a whitelist of approved Bangla templates and typed slots. An LLM never writes citizen-visible status.

Travel guidance has three states:

- `TRAVEL_REQUIRED`: date, place and verified source;
- `NO_TRAVEL_NEEDED`: only from human-verified state, with a validity window and “unless you receive a later notice”; never used for a court hearing date;
- `UNKNOWN`: safe default—contact 16699/office before travelling.

The same verified Status Sentence can be displayed, read aloud by IVR, or communicated by an authorised 16699/UDC worker. Routine templates may publish automatically; sensitive and hearing-related statuses require human verification. Unsafe wording and channels are blocked.

### Mandatory USSD/SMS door

Provide a small working simulator connected to the same record and safe-contact policy:

- **SMS view:** renders the current Status Sentence in short, neutral, privacy-aware wording. It must not expose dispute type, opposing party, violence/safety facts or sensitive evidence. When even neutral messaging is unsafe, the system suppresses the message and records the reason.
- **USSD view:** a short keypad flow such as `1 Status`, `2 Next action`, `3 Request safe callback`, `0 Exit`; it uses a digits-only keypad reference plus PIN/safe phrase, times out, and stores no separate case record.
- **Acceptance test:** change a case's next action, reopen the SMS and USSD simulators, observe the updated safe Status Sentence, then mark the number/channel unsafe and verify that sensitive output is blocked with an audit event.

### It is not

- an AI lawyer;
- an automated eligibility or jurisdiction judge;
- a mandatory Gram Adalat pipeline;
- seven separate provider systems;
- a citizen-only portal;
- a collection of 23 disconnected demos.

---

## 3. Complete service model

### Stage 1 — Access and application

The citizen can enter through web/mobile, 16699/voice, USSD/SMS simulation, UDC/authorised assistance, DLAO/institutional referral, or an authorised **Referral Committee/Focal Point**. A channel is only an interface; every channel writes to the same application record.

At submission:

- online submission creates the unique **Application ID**; offline work first receives `TEMP-xxxx` marked “pending sync,” then the server issues and links the `APP-…` ID on sync;
- record who spoke, typed, translated, inferred and confirmed each material fact;
- record representative authority and its scope;
- record safe number/channel/time/wording;
- record accessibility, literacy, language and connectivity needs;
- preserve unverified identity gaps instead of inventing or blocking unnecessarily;
- capture the Annex B1 application schema: legal-aid office, application type/method, requested aid type, previous reference, child involved, applicant category, case type/sub-type, personal/income/address information, representative and opposite party; child involvement triggers restricted handling;
- record vulnerability flags during verification, including disability, GBV/coercion, child involvement and applicable poverty category;
- record document versions and quality;
- create the first review promise;
- issue a neutral acknowledgement receipt with the server or temporary numeric reference and a save/resume code.

### Citizen session, safe OTP and keypad access

Web/mobile supports Register/Login (OTP) as shown in Annex B2, but never sends OTP or case-revealing notifications to a channel marked unsafe. Alternatives are voice OTP with repeat, assisted verification or in-person verification. A safe phrase chosen during intake is required before IVR/agent disclosure. The PWA name, icon and notification text remain neutral and the web route provides quick exit.

`APP-YYYY-XXXXX` and `DLAS-YYYY-XXXXX` remain official visible IDs, while IVR/USSD use a digits-only reference with prefix choice (`1 application`, `2 case`). Lookup may also use an approved phone plus safe phrase.

No Case ID exists yet.

### Stage 2 — Verification and eligibility

Technology checks completeness, duplicate candidates, document quality and applicable published criteria. It never rejects or accepts the applicant.

The authorised DLAO/Legal Aid Officer sees:

- confirmed and unconfirmed facts separately;
- representative-reported information;
- document briefing with source references;
- missing/uncertain items;
- duplicate candidates with comparison evidence;
- urgency and safety signals;
- financial-status information where required;
- system recommendation and reasons.

The officer decides:

- request more information;
- accept as eligible, creating the **Case ID**;
- reject with a reason;
- send the matter to the applicable appeal/review path.

Every rejection notice communicates the reason, next-step guidance and an appeal pointer where applicable. The District Legal Aid Committee/competent authority is recorded as the appeal decision-maker.

The Case ID is created only after acceptance and remains unchanged throughout referral, mediation, representation, outcome and closure.

### Stage 3 — Jurisdiction and routing

The system does not force a fixed channel-to-formal-litigation sequence. Access channel and service pathway are separate decisions.

It runs a versioned **Policy Pack** that presents candidate routes based on:

- verified matter type;
- location and office competence;
- effective date;
- applicable mandatory pre-case mediation rule;
- urgency/safety constraints;
- service availability;
- missing facts and uncertainty.

The authorised human confirms one of the three ADLASB service pathways:

1. **Advice**;
2. **Mediation**;
3. **Direct Legal Aid / Litigation**;

Referral/close is an **other applicable pathway** after the recorded service decision; it is not presented as a fourth peer service pathway.

**Unverified external research candidate:** sources listed later appear to describe a 2026 legal-aid amendment, physical/virtual mediation and geographically activated pre-case mediation. Until a team member personally opens the primary instrument and completes the claim register, none of those propositions may appear as confirmed in the paper or drive an automatic route. The ADLASB model therefore presents mediation applicability for authorised human confirmation.

### Village Court / Gram Adalat boundary

It is not part of the ADLASB mandatory workflow and is removed from the prototype, paper and deck. The claim register records **“not used—outside competition source of truth.”** If asked in Q&A, answer that a production DLAS could later add a separately verified, human-confirmed adapter without altering the three ADLASB pathways.

### Stage 4A — Advice pathway

An authorised Legal Aid Officer/provider reviews the record, provides advice, records the advice category and safe next step, then records the explicit decision **“issue resolved through advice?”** If no, the case moves to another applicable pathway.

The citizen receives a safe Status Sentence, not unrestricted legal text generated by AI.

### Stage 4B — Mediation pathway

The same Case ID moves through:

1. registration;
2. party contact and safe-contact checks;
3. date fixing;
4. notices and delivery status;
5. document review;
6. attendance;
7. one or more mediation attempts;
8. outcome preparation;
9. party understanding and consent;
10. signatures/formalities;
11. settlement record or unresolved escalation.

Mediation is labelled **In-person / ODR** as in Annex B2. Each party has a participation mode (in-person, phone or simulated video), remote-consent record, identity/join check and attendance state. Failed remote participation creates a real in-person fallback/reschedule notice.

Before scheduling, a human reviews a safety screen for violence, coercion and power imbalance and chooses: proceed, separate sessions, remote, not suitable or refer. A flagged case is never automatically scheduled for a joint session.

The drafting assistant must generate thin but working drafts for **maintenance, property and labour** matters. AI-inferred text is marked. At least one internal inconsistency is surfaced. A Legal Aid Officer/Mediator reviews the draft, the parties must understand and consent, and required formalities remain human-controlled.

Multiple mediation attempts remain part of one case; failed attempts never create parallel cases or erase prior history.

### Stage 4C — Direct legal aid and panel-lawyer pathway

After unresolved advice/mediation, record the explicit decision **“Beneficiary requests Panel Lawyer?”** The request is the citizen's recorded choice, not an officer assumption. When panel representation is requested and required:

1. authorised staff verifies the beneficiary's financial status under applicable DBLA criteria;
2. if government-funded representation is not allowed, the decision and available alternatives are explained;
3. if approved, an authorised human reviews the panel registry, practice/eligibility information and current workload, then selects a lawyer from the applicable panel;
4. the lawyer receives a complete assignment package;
5. the lawyer accepts or declines digitally with a reason;
6. hearings, deadlines, documents and required updates become promises;
7. safe citizen notifications derive from verified updates;
8. inactivity creates a review alert, not an automatic misconduct finding;
9. reassignment and stage-based payment reconciliation remain human-controlled;
10. interim/final payment processing, approval and simulated disbursement are recorded.

### Stage 4D — Referral pathway

The directory includes DLAO, **SCLAC (as named in ADLASB Annex B2)**, LLAC/Labour Legal Aid Cell and other authorised entities.

A referral contains:

- reason and requested action;
- case history;
- minimum necessary documents;
- sensitive-access restrictions;
- sending and receiving actors;
- acknowledgement deadline;
- return reason vocabulary;
- escalation rule.

The sender retains responsibility until the receiving office acknowledges and accepts. **Two or more returned/rejected transfers within the same unresolved transfer chain** trigger and retain escalation, even when resubmission or acknowledgement events occur between the returns; an authorised human makes the final routing decision.

### Stage 5 — Outcome, closure and continuing accountability

The outcome may be advice completed, mediated settlement, court decision, referral result or another authorised resolution.

Closure is blocked until the required:

- provider reports;
- documents and latest versions;
- outcome record;
- verification;
- approvals;
- citizen-safe final communication

are present.

Closure is a human decision and ledger event. In the implemented lawyer path, the Legal Aid Officer records completion, approves the payable-hearing ledger, records the clearly labelled simulated payout, and only then closes the case; the close action is unavailable while any recorded lawyer payment is unpaid. Closing atomically generates a simulated closure testimonial, sends a safe citizen notice, and makes the persisted testimony viewable on the owning citizen's case page. T1 stage-based payment reconciliation on reassignment remains independent until final completion. The case remains available for permitted reporting and future reference.

---

## 4. Authority and automation model

| Operation | Technology may do | Required human and decision | Technology must never do |
|---|---|---|---|
| Intake | Ask Bangla questions, fill approved slots, read back, preserve provenance | Applicant/representative confirms; agent assists where needed | Invent facts or treat representative statements as applicant-confirmed |
| Eligibility | Check completeness and published criteria; prepare evidence | Authorised DLAO/Legal Aid Officer accepts, seeks information or rejects | Auto-accept or auto-reject |
| Priority | Detect deadlines, violence/safety indicators and operational delay | DLAO sets final priority and response | Make an unexplained risk judgment |
| Routing | Present rule-backed candidates and missing facts | Authorised officer determines consequential route | Decide jurisdiction or compulsory mediation silently |
| Duplicate check | Produce fuzzy candidates and matching attributes | Staff confirms separate/duplicate/related | Auto-merge, auto-reject or label fraud |
| Documents | Summarise, cite sources, flag unreadable/missing items | Officer verifies briefing | Guess unreadable content |
| Settlement | Draft from approved templates and mark inference/conflicts | Mediator reviews; parties understand/consent | Finalise terms or infer consent |
| Lawyer management | Track acceptance, deadlines, patterns and payments | DLAO reviews, reassigns and handles accountability | Declare misconduct or recoverable amount automatically |
| Payment lifecycle | Prepare illustrative stage reconciliation and payment evidence | Finance/accounts reviewer approves, returns or records simulated disbursement under applicable policy | Treat a prototype fee schedule as DBLA policy or block case closure on payment |
| Referral | Package, transmit, time and escalate | Sender and receiver accept responsibility; authorised person resolves conflict | Treat transmission as acceptance |
| Closure | Check completion prerequisites | Authorised officer approves closure | Close because a timer expired or AI predicts completion |

### Role-by-decision enforcement

| Decision | Authorised role | Required information before decision | Recorded output |
|---|---|---|---|
| Accept/reject/request information | DLAO/Legal Aid Officer or other authority configured from ADLASB | Application, published criteria, identity/document/vulnerability verification, provenance and missing facts | Decision, reason, authority, policy-pack version and next-step guidance |
| Set priority | DLAO/Legal Aid Officer | Deadline, safety/vulnerability indicators and evidence source | Priority, response target and reason |
| Select route/referral | Authorised DLAO/SCLAC/LLAC officer | Jurisdiction facts, directory, prior returns and receiving-office requirements | Route, reason, minimum package and acknowledgement deadline |
| Approve mediation suitability/mode | Legal Aid Officer/Mediator | Safety screen, consent, power imbalance and per-party participation capability | Proceed/separate/remote/not-suitable/referral decision |
| Assign/reassign panel lawyer | DLAO/authorised panel manager | Financial-status decision, practice area, approval status, workload, conflicts and upcoming hearing | Assignment, handover and urgent-coverage promises |
| Resolve escalation | Supervisor/escalation authority; programme/DBLA oversight remains visible at final rung | Full promise history, evidence, returns, elapsed time and current owner | Resolution, new owner/due time or documented continuing exception |
| Decide appeal | District Legal Aid Committee/competent authority | Original decision, reasons, appeal material and applicable authority | Appeal decision, reasons and notification |
| Approve payment/disbursement | Finance/accounts reviewer | Completion evidence, illustrative stage reconciliation and authorised policy | Approve/return/disburse record; never an automatic recoverable amount |
| Approve closure | Authorised DLAO/Legal Aid Officer | Required reports, documents, verification, outcome and approvals | Closure reason and safe final communication |

High-stakes acceptance and every override require a reason. The interface presents evidence before any recommendation, records decision time and override rate, and supports sampled read-only audit. Administrative staff and system administrators cannot make legal or case-consequential decisions merely because they can configure or view the system.

---

## 5. Role model and adoption value

### Citizen or representative

Uses any available channel, gives or corrects information, controls safe contact, understands the next step and does not have to restart at each office.

### DLAO officer

Receives an explained action queue—not an opaque score. Reviews eligibility, priority, routing, referrals, lawyer changes, escalations and closure. Every override is attributable.

### Legal Aid Officer / Mediator

Manages the complete mediation journey, multiple attempts, participation mode, documents, outcome drafting, review and consent from one record.

### 16699 agent

Looks up permitted status, reads a safe Status Sentence, or creates an assisted intake in the same record. The agent cannot see restricted evidence or make legal decisions.

### UDC entrepreneur

Provides bounded assistance with a free-service notice, checklist, consent and provenance. The entrepreneur's number is not silently converted into the applicant's contact. Post-submission access is limited.

### Panel lawyer

Accepts/declines assignments, sees necessary case material, hearings and deadlines, and files structured progress updates. One update feeds citizen status, DLAO monitoring, reporting and payment evidence, reducing duplicate work.

### Receiving DLAO/authority

Receives the complete minimum package, accepts or returns with a structured reason, and becomes the visible owner only upon acceptance.

### Administrative/case-support staff

Searches and reconstructs the record without physical-file hunting and produces one routine report from data already captured.

### Supervisor / escalation authority

Resolves overdue or repeatedly returned work using the complete promise history. If the supervisor does not act, the unresolved final rung stays visible in the programme/DBLA oversight view; the system never marks an escalation resolved merely because it was forwarded.

### Finance / accounts reviewer

Reviews post-closure payment evidence, stage reconciliation and approval/disbursement records. Prototype fee schedules are versioned and visibly illustrative, not presented as DBLA policy.

### Appeal authority

The District Legal Aid Committee or other competent authority reviews an applicable appeal using the original decision, reasons and appeal materials, then records the decision and notification.

### LLAC / SCLAC officers

Perform only the verification, referral and service actions authorised for their office. `SCLAC` is not expanded beyond “as named in ADLASB Annex B2” unless the claim register verifies an official expansion.

### Read-only auditor / jury inspector

Can reconstruct events, checkpoints, access history and decision authority without changing operational state or viewing restricted payloads unless specifically permitted.

### System administrator

Maintains versioned directories, templates, rule packs, thresholds and role grants. Configuration changes are audited; this role has no eligibility, routing, mediation, assignment, appeal, payment or closure authority by default.

The adoption principle is simple: **the system must remove chase calls and duplicate registers, not create another reporting burden.**

---

## 6. Core data and state model

### Core entities

- `Application`
- `Case`
- `PersonParty`
- `RepresentationAuthority`
- `StatementClaim`
- `ConfirmationCorrectionWithdrawal`
- `SafeContactPolicy`
- `Consent`
- `Document` and `DocumentVersion`
- `Decision`
- `PromiseTask`
- `Referral`
- `MediationAttempt`
- `LawyerAssignment`
- `PanelLawyerRegistry` and `PanelWorkloadProjection`
- `HearingUpdate`
- `PaymentStage`
- `OutcomeClosure`
- `AppealReview`
- `RelatedIncidentGroup`
- `AuditEvent`
- `PolicyPackVersion`
- `CitizenSession`, `OtpSession` and `SafePhrase`
- `VaultPayload` and payload-redaction state
- `VulnerabilityFlag`
- `NotificationOutbox`
- `Grievance`
- `KnowledgeArticle` and `ApprovedTemplate`
- `FeeSchedule` (illustrative and versioned)
- `AccessLog` and `BreakGlassAccess`
- `SyncSession` and `Device`
- `Checkpoint`
- `Report`
- `TravelAdvisory`
- `TemporaryReceipt`

### Identifier formats

Use the formats shown in Annex B2:

- Application ID: `APP-YYYY-XXXXX`
- Case ID: `DLAS-YYYY-XXXXX`

The suffix is generated uniquely; the visible format is not used as a security credential.

### Application state machine

`DRAFT -> SUBMITTED -> VERIFYING -> NEEDS_INFORMATION | DECISION_PENDING -> ACCEPTED | REJECTED -> APPEAL_PENDING (if applicable) -> ACCEPTED | CLOSED_REJECTED`

Acceptance creates the Case ID. Rejection never creates a Case ID unless a later authorised appeal/review changes the decision.

An offline submission first receives `TEMP-xxxx` and a neutral receipt marked “pending sync.” On authoritative server receipt, it is mapped to `APP-YYYY-XXXXX`. Device time is stored for context but is untrusted; server receipt/anchor time orders the canonical record.

### Case state machine

`OPENED -> ROUTING_REVIEW -> ADVICE_ACTIVE | MEDIATION_ACTIVE | REFERRAL_PENDING | PANEL_ASSESSMENT -> ASSIGNMENT_PENDING | OTHER_SERVICE -> SERVICE_ACTIVE -> OUTCOME_RECORDED -> CLOSURE_REVIEW -> CLOSED`

Return and escalation are explicit transitions, never invisible status text.

Payment is a separate post-closure state machine: `NOT_REQUIRED | PENDING -> REVIEW -> APPROVED | RETURNED -> DISBURSED -> RECONCILED`. A case may therefore be `CLOSED · PAYMENT_PENDING`.

### Promise state machine

`OFFERED -> ACCEPTED -> ACTIVE -> FULFILLED`

Alternative transitions: `RETURNED`, `OVERDUE`, `ESCALATED`, `CANCELLED_BY_AUTHORISED_HUMAN`.

Every completion cites evidence; every cancellation cites authority and reason.

### Ledger event contract

Each event records:

- UUID and application/case ID;
- event type and timestamp;
- actor, role, office and channel;
- authority/consent basis;
- applicant-confirmed, representative-reported, intermediary-translated, staff-entered or AI-inferred provenance;
- before/after state references;
- affected field/document/task IDs;
- previous hash and event hash;
- offline UUID, sync and conflict metadata;
- safe citizen-visible consequence.

The chain is scoped per application/case and visitor namespace rather than globally. A periodic checkpoint hash makes history rewrites detectable without serialising every district write. Sensitive text and PII live in `VaultPayload`; the ledger retains only payload IDs, content hashes and non-sensitive metadata. Correction appends a superseding event. Withdrawal masks or deletes the permitted vault payload and appends `WITHDRAWN`, so ordinary views cannot recover the unsafe content while the chain still proves that a withdrawal occurred. Access to sensitive payloads writes an `AccessLog`; break-glass access requires a role, stated reason and later audit.

---

## 7. The five citizen journeys and literal failure recovery

### Moyuri Akter

Ripon's report enters as representative-reported, not Moyuri-confirmed. `IDENTITY_UNVERIFIED` does not prevent safe progress. A first-hand-account promise schedules a safe opportunity to hear Moyuri herself. No OTP or disclosure goes to an unsafe channel; safe phrase, quiet hours, neutral sender/icon/text and quick exit apply. When an unsafe person answers, the call is blocked/delayed with reason and the next safe window is recorded. Moyuri later confirms one statement and corrects or withdraws another; operational views hide a withdrawn vault payload while the ledger preserves the withdrawal event.

### Ripon

Completes the same meaningful Bangla status/representation task through both the screen-reader web route and keypad/voice IVR simulator using TalkBack and an audio/voice-delivered OTP with repeat. A spoken authority summary distinguishes what Moyuri confirmed from what remains unconfirmed. There is no CAPTCHA, visual-only OTP or PDF dependency; timeouts are generous. Bangla accessible names, instructions and errors, logical focus, usable targets and 200% zoom/reflow are release requirements, tested by a non-team user without sighted help.

### Nabila

Urgency is surfaced for human confirmation with an SLA clock. Sensitive media is hashed at ingest, produces no thumbnail/preview, and requires authorised case scope or reasoned break-glass access. The referral preview contains only minimum-necessary evidence and a safe holding message. When the receiving authority does not acknowledge by the deadline, an alternate-channel promise and escalation are created without exposing the evidence.

### Nuching Marma

The record distinguishes Nuching's original words/audio or note, translator identity, Bangla translation and UDC-entered text. Verbal consent is audio-read back and witnessed as `VERBAL_READBACK`. On-device blur/size checks request a retake without interpreting legal content. UDC access expires after assistance; its number never replaces Nuching's safe contact. When the network drops halfway, an offline `TEMP-xxxx` receipt and encrypted local queue preserve the draft; later sync is idempotent and conflicts go to human review.

### Abdul Malek

The shop number has its own reliability/safety history and creates an “alternative contact” task instead of being treated as Malek's personal contact. When the lawyer misses two required updates, the DLAO sees the overdue obligation before Malek travels. Hearing dates show their source (lawyer report or court record). Numeric IVR lookup reads a safe, human-verified Status Sentence and three-state travel advisory without a smartphone or reading.

---

## 8. Mandatory technical modules as one system

### T1 — Lawyer change and inactivity

Marzina Begum has two missed required hearing/update obligations; the same lawyer has similar inactivity on two other active cases. Demo configuration:

- `individual_inactivity = 2 missed required obligations on one case`;
- `cross_case_pattern_review = threshold reached on 3 active cases`.

These are visible, versioned prototype thresholds—not DBLA policy and not proof of misconduct. Flow: citizen request -> DLAO queue -> human review -> reassignment -> outgoing-lawyer handover checklist -> urgent coverage promise when a hearing falls within the configured window -> stage-based payment reconciliation -> separate pattern-review alert. The illustrative schedule shows paid, earned and disputed evidence per stage but never computes an automatic recoverable amount.

### T2 — Jurisdiction ping-pong

Rahim Mia's case is returned between DLAO and Labour Legal Aid Cell. At two or more returned transfers in the same unresolved transfer chain—regardless of interleaved resubmission or acknowledgement—the Promise Engine retains escalation. The transfer-chain view shows structured reasons and time in limbo; the sender remains owner in transit until the receiving office accepts, and a supervisor decides the route.

### T3 — Related incident

Three Salma Begum/co-worker cases are linked to one factory-fire group. One versioned common document is stored once and referenced under controlled permissions. The group view is staff-only; applicants never see co-applicants. Case-specific instructions, confidentiality and outcomes remain separate, withdrawal by one applicant does not delete a lawful shared source for the others, and a lawyer conflict check spans the linked cases.

### T4 — Duplicate detection

Use 12-15 seeded records with true-duplicate variants and at least two similar-but-different traps. Matching compares name, parent/spouse name, age, phone, village/union, incident date, opposite party and document hash while handling Bangla numerals, spacing, `মোঃ`/`মো.`/`Md.`, transliteration and spelling variants. Intake roles see only “possible existing application—route to DLAO”; authorised staff sees the reversible side-by-side decision. A confusion table reports found, missed and correctly separated traps. Never label fraud.

### T5 — Conversational Bangla intake

Natural Bangla multi-turn intake begins with “is it safe to talk/call this number?”, fills only approved fields, clarifies uncertainty, reads back facts, preserves provenance and hands a sensitive/ambiguous case to a human with a defined packet. Model-bound data has names, phones and IDs masked; instructions embedded in user text cannot invoke tools; output must match a strict slot schema. Allowed tools are `get_required_documents`, `check_published_criteria` and `find_office`. A deterministic fallback and about ten Bangla utterance variants ensure the test works without the model. Production requires an approved hosting/data-protection arrangement.

### T6 — Document agent

Use six synthetic documents, one missing required item and one unreadable item. Each material briefing sentence must resolve to an OCR span/page-region anchor or is dropped. Classification, blur detection, per-case checklist and hash-based duplicate/latest-version checks prepare the officer briefing; the officer verifies it.

Bangla OCR is a Day-1 technical risk gate. Test representative Bangla scans and phone photos immediately. For the reliable acceptance path, use primarily text-based PDFs plus one deliberately poor image that must be labelled unreadable/uncertain rather than guessed. OCR output remains extracted evidence requiring officer verification, never authoritative text.

### T7 — Settlement drafting

Keep all three working Bangla scenarios: maintenance, property and labour. Mark AI-inferred text and expose at least one inconsistency. Deterministic checks compare numbers/words, dates, party names and monthly/total amounts. Template provenance is visible, parties receive audio read-back where required, human legal review and consent are mandatory, and review locks the version; edits require review/signing again.

### Feature 6 — mediation success and certification

A successful mediation does not resolve a case at the moment parties say they agree or complete
the prototype signatures. The mediator records the six settlement fields manually, both parties
execute, and the mediator confirms that the record reflects the outcome. The signed-in CLO then
reviews the settlement agreement, execution status, mediator confirmation, and relevant case
information. The CLO may certify, return for correction, or request clarification; the system never
certifies automatically.

Only CLO certification creates the recorded `RESOLVED` legal outcome. That outcome includes the
agreement ID, certification time, certifying officer, outcome text, and applicable follow-up work.
Follow-up types cover compliance checking, party contact, deadline review, and enforcement
monitoring. Any revision after a CLO return requires both prototype signatures and mediator
confirmation again.

### Feature 7 — failed mediation and referral

Failed mediation produces an auditable procedural outcome and referral record instead of reducing
the case to a Failed label. The mediator records the date, attendance, issues discussed, outcome,
appropriate reason/status, follow-up need, and proposed next pathway. Confidential caucus content
is neither required nor copied into the record.

The product distinguishes the advisory system suggestion from the Legal Aid Officer's decision.
The officer can confirm the referral, change the pathway with a reason, or request more procedural
information. Available pathways are court/legal process, lawyer assignment, further legal aid
review, and another referral. No suggestion automatically determines the final path.

For a confirmed lawyer pathway, the handoff is Mediation → Failure → Referral record → Legal Aid
Officer → Lawyer assignment. Confirmation opens the existing panel-lawyer assignment work item;
lawyer ranking, selection, offer and acceptance remain in that established officer-controlled
workflow. The case timeline displays the handoff and its current stage.

### T8 — Multi-component triage

Run at least eight cases through at least three fixed-schema components: category, urgency and jurisdiction/process compliance, coordinated by an orchestrator. Include one disagreement, one safety case and one wrong-jurisdiction case. Output visibly feeds the DLAO queue and reports agreement rate. Display concise reasons/evidence, not hidden chain-of-thought.

### T9 — Offline sync

Create three applications offline with UUIDs and `TEMP-xxxx` receipts, reconnect without duplicates and map them to server IDs, produce one per-field conflicting edit and send it to human review, then verify ledger integrity. Retry/backoff and storage-quota failure are visible. A juror can “tamper a row” and see checkpoint verification fail.

Offline clients do not directly splice events into the authoritative server hash chain. Each local event stores its UUID, device/session identifier, local sequence, payload hash and the last known server anchor hash. On sync, the server authenticates the session, deduplicates the UUID, validates the anchor and transition, detects conflicts, then appends a new canonical server event that references the original offline UUID/payload hash. A stale anchor is not silently rejected or inserted; it produces a conflict/rebase review event. This preserves one authoritative ordering while retaining proof of what was created offline.

Threat model: protects against accidental duplication, interrupted sync, stale conflicts and detectable modification. It assumes the demo browser/device is not fully compromised and privileged server/key control is trusted. Never claim absolute tamper-proofing.

### T10 — Low-bandwidth PWA

Installable normal/light mode under the same throttled profile. Light mode can respond to exposed save-data/low-memory hints and always has a manual toggle. Record page weight, requests, first meaningful paint, time to interactive and taps/seconds for the primary task; test storage eviction and one low-end Android device. Prefer system/subset Bangla fonts.

On shared devices, cache only the shell, static assets, minimal reference data and explicitly queued drafts. Do not ordinarily cache case pages, sensitive evidence, authentication tokens or cross-user status.

Encrypt the local queue with AES-GCM through WebCrypto. Derive the queue key from an operator-entered session PIN/passphrase using PBKDF2 with a random salt and calibrated iteration count; do not store the PIN or derived key beside the ciphertext. Keep the unlocked key in memory only. State the limitation that a short PIN has low entropy, so production deployment requires approved authentication/key management and rate-limited unlock. Logout/reset revokes the session, drops the in-memory key and wipes the queue, decrypted data and sensitive caches.

### T11 — Asynchronous signature

Two parties sign at different times; one signs offline and syncs later using ECDSA P-256 for broad WebCrypto support. Sign canonical serialization of the document hash plus case/document/version/signer metadata. The signer ceremony includes hash read-back, PIN and witness where applicable; device and server timestamps stay distinct. The document locks after the first signature and any edit requires re-signing.

Use synthetic demo identities/keys and state that production identity proofing/key issuance requires an approved authority. Provide a separate verifier page/script that uses the artefact and public key without trusting app state. Cryptographic validity does not establish legal validity, identity, capacity, informed consent or enforceability.

---

## 9. Golden Thread and Annex business rules

The implementation passes only if all are true:

1. all channels and providers use the same authoritative record;
2. speaker, typist, translator, inference and confirmer remain visible;
3. unsafe contact can be blocked/delayed with reason;
4. required tasks have equivalent accessible/assisted routes;
5. human recommendations can be corrected/overridden and authority is recorded;
6. missing, uncertain, duplicate and latest-version document issues are visible;
7. every mediation, referral, lawyer, task and deadline has owner/status/next action;
8. offline/retry/conflict paths do not silently lose or duplicate records;
9. role-based privacy persists through handovers;
10. the jury can reconstruct who did what, when, through which role/channel and on whose authority.

Annex B2 rules are implemented exactly:

- every submission receives an Application ID;
- Case ID only after eligibility and acceptance;
- Case ID persists through the lifecycle, including transfer;
- DLAO, SCLAC, LLAC and authorised entities may refer/transfer according to authority;
- multiple mediation attempts remain on the same case;
- funded panel allocation occurs only after the required financial-status decision;
- closure is blocked until reports, verification, documents and approvals exist;
- notifications, actions and records remain auditable.

Annex B1's **appeal application (if applicable)** is implemented thinly: application -> competent-authority review -> approve/reject -> notification -> ledger event. Grievance/feedback is also thin and must not displace mandatory scope.

### Annex cross-cutting service layer

These are connected services on the same record—not disconnected feature pages:

- **Approved knowledge and template assistance:** six to eight versioned procedure explainers, checklists and approved templates searchable by 16699 agents, UDC assistants and officers. T5 and T7 cite this content; it is labelled illustrative where appropriate.
- **Panel management:** registration, approval status, practice areas, workload and citizen-safe feedback on communication/responsiveness. Never rank by win rate and never trigger automatic punishment.
- **Grievance and feedback:** thin but real `REGISTERED -> INVESTIGATING -> RESOLVED -> CLOSED` flow, including “asked for payment” and “lawyer not responding”; an authorised reopen returns `RESOLVED -> INVESTIGATING` without rewriting history.
- **Dashboard and reporting:** Today queue, ageing/SLA, district-wise management view, five live prototype measurements and the B7 routine/monthly report from ledger events.
- **Integrations panel:** 16699, SMS, email, payment gateway, NID service and court source, each showing an interface contract and `SIMULATED` or `REAL`. Simulation is limited to unavailable external connections; internal state changes remain real.
- **Notification centre/outbox:** in-app provider notifications plus labelled email/SMS simulations with `QUEUED -> SENT -> DELIVERED | FAILED`, retry history, bilingual neutral templates and per-case delivery log.
- **Save/resume:** autosaved draft and neutral receipt with numeric resume reference; offline drafts retain `TEMP-xxxx` until server acceptance.
- **Court-source input:** officer/lawyer-entered hearing or decision event explicitly labelled by source, never presented as a live court integration unless one exists.
- **Financial-status branch:** both `YES` and `NO` decisions are demonstrable with reasons; `NO` presents authorised alternative options instead of silently ending service.

### Mediation safety and ODR mechanics

Before scheduling, an authorised human reviews coercion, violence and power-imbalance flags and chooses `PROCEED`, `SEPARATE_SESSIONS`, `REMOTE`, `NOT_SUITABLE` or `REFER`. A flagged case is never auto-scheduled jointly. Each party has participation mode (in person, phone or video link), remote consent, identity/join check, notice-delivery status and attendance. A failed remote session creates a real reschedule/fallback-to-in-person state change; only the video connection may be labelled simulated. Outcome is `SETTLED`, `PARTIAL`, `FAILED` or `PARTY_ABSENT`, and multiple attempts stay on one timeline.

---

## 10. Privacy, security and runtime reliability

### Role-scoped views

Each role receives only necessary fields and actions through case- and office-scoped RBAC. Sensitive evidence is separately permissioned; every view writes an access log, break-glass requires a reason, and sessions time out. Duplicate candidates are masked for intake roles. The Status Sentence is a whitelisted safe projection, not a raw case summary or LLM output. Routine templates may publish automatically; sensitive and hearing-related sentences require human verification.

### Accessible and safe equivalents

Citizen views default to Bangla with an English toggle and optional Bangla digits. Use a legible Bangla sans face, strong contrast, large targets and text paired with semantic colour; light mode uses system/subset fonts. IVR tasks have USSD/SMS/web-text equivalents for Deaf or hard-of-hearing users. Shared-device logout wipes decrypted data, the in-memory key and sensitive caches.

### Virtual Time Machine

The Failure Lab includes a tenant-scoped clock with `+1 hour`, `+24 hours`, `+48 hours` and `jump to next due`. The Promise Engine and scheduler read only this clock; reset restores fixture time. This makes A3 non-acknowledgement, A5/B5/T1 missed updates and T2 repeated returns juror-triggerable without waiting in real time. Every jump writes a clearly labelled simulation event and never changes real system time.

### Seed-data contract

- named citizens: Moyuri, Ripon, Nabila, Nuching and Malek;
- offices: DLAOs in Joypurhat, Jhenaidah, Khagrachhari and Barguna; LLAC; SCLAC; fictional “other competent authority”; referral focal point;
- eight panel lawyers with approval, practice and workload, including one lawyer with Marzina plus two inactive cases;
- Rahim's two-return chain; Salma plus two co-workers and one shared factory-fire document;
- 12–15 duplicate-test records with true variants and two trap pairs;
- two scripted T5 intakes and about ten Bangla utterance variants;
- six T6 documents, including a missing item, phone photo and unreadable scan;
- three T7 note sets; eight T8 cases; three offline T9 records plus one conflict; one T11 document with two signers;
- one login per operational role and one read-only auditor.

### Self-test and deployment reliability

`/selftest` creates a fresh visitor namespace and reports PASS/FAIL with event IDs. It exercises all 23 acceptance scenarios, all five doors including the neutral USSD/SMS Status Sentence path, G1–G10, rejection and applicable appeal, both financial-status branches, and closure blocking when reports, verification, documents or approvals are incomplete. CI runs it before freeze and the navigator shows the result. Deploy on an always-on instance in a nearby region with health monitoring, server-side secrets, no PII logs, rate limits without CAPTCHA, tenant ID on every row and deterministic AI fallbacks. Keep pre-generated Bangla audio, local Docker and the offline MP4. Test Chrome/Firefox, target Android/Chrome, check iOS Safari separately, scan the QR on two phones and run a throttled clean-browser install/offline/reconnect test.

### Public-jury isolation

- mutable demo data is namespaced per visitor/session;
- each scenario and the full environment have deterministic reset actions;
- reset restores fixtures, clocks and ledger genesis state;
- two browsers cannot modify each other's data;
- the LLM key stays server-side and calls are rate-limited;
- deterministic fallbacks exist for all AI tests;
- the deployed URL is verified in a clean browser, including service-worker install, offline reload and reconnect.

These are technical acceptance controls, not presentation extras.

---

## 11. Why this model is distinctive and adoptable

### Differentiation

Unified records, routing, UDC access, AI intake and dashboards are expected. Shakkho's distinction is the combination of:

- field/event-level legal provenance;
- accepted—not merely sent—responsibility;
- evidence-based completion;
- human authority gates;
- citizen-safe status generated from verified operational state;
- one failure vocabulary across online, assisted and offline work;
- date/geography-specific rule packs;
- one action updating operations, citizen status, reporting and payment evidence.

### Realistic moat

The cryptography or AI model is not the moat. Defensibility develops through:

- the Promise Protocol and failure taxonomy;
- the Bangladesh legal-aid event/provenance ontology;
- approved and versioned national/district policy packs;
- safe-contact protocols and Bangla intake schemas;
- Bangla/transliteration duplicate test corpus;
- conformance tests for all 23 requirements and Bad Day failures;
- verified service directory and institutional integrations;
- accumulated anonymised evidence about where work stalls and which intervention resolves it;
- provider adoption because the workflow removes duplicate work.

### Scale from pilot to 64 districts

Keep one national codebase, identifiers, event vocabulary, role model, security model and reporting schema. Configure:

- office/service directory;
- legal-policy effective dates and geography;
- mediation applicability;
- language/accessibility assistance;
- escalation timers;
- approved templates;
- provider panels.

Scaling means adding configuration and institutions—not building a different application for each district.

---

## 12. Five seeded prototype measurements

Use exactly these in the solution paper and label them **prototype measurements calculated from seeded demonstration data**, not evidence of real-world impact:

1. **Owned-next-action rate:** percentage of active cases with a named responsible actor, accepted action and due time.
2. **Handoff acknowledgement time:** median time from referral/assignment offer to acceptance or structured return.
3. **Prevented unnecessary journey rate:** citizens receiving a verified next step before a journey that would otherwise have been required.
4. **Continuity rate:** percentage of cross-channel/provider transitions completed without re-entering core facts or creating a parallel record.
5. **Timely intervention rate:** percentage of overdue lawyer/referral/mediation promises resolved after an authorised alert before service failure or closure.

These test whether the prototype measures the intended operational improvement. They do not prove population-level impact, time savings or national performance before a real pilot and evaluation.

For reproducibility, calculate them only from named ledger events:

| Measurement | Prototype formula and event source |
|---|---|
| Owned-next-action rate | active cases with an `ACCEPTED/ACTIVE` due promise ÷ all active seeded cases; `PromiseCreated/Accepted/Fulfilled` |
| Handoff acknowledgement time | median `ReferralAccepted/Returned.time - ReferralSent.time` across seeded referrals |
| Prevented unnecessary journey rate | cases with verified `NO_TRAVEL_NEEDED` delivered before planned travel ÷ seeded cases with a planned journey; `TravelAdvisoryVerified/Delivered` |
| Continuity rate | transitions reusing the same application/case without a new parallel record ÷ all seeded cross-channel/provider transitions; `ChannelChanged/ReferralAccepted` plus ID linkage |
| Timely intervention rate | overdue promises resolved by an authorised intervention before recorded service failure/closure ÷ overdue seeded promises; `PromiseOverdue/Escalated/Resolved` |

The demo shows numerator, denominator and source event IDs; never extrapolate these seeded results to Bangladesh-wide impact.

---

## 13. Build-ready implementation contract

The prototype is “working” only when each action follows this transaction:

`authorise actor -> validate transition -> update canonical state -> append ledger event -> create/fulfil/escalate promise -> update permitted role projections -> update safe Status Sentence`

### Build through the PDF's six integrated flows

Foundation services—schema, roles, state machines, Case Ledger, Promise Engine, Human Decision Gate, seeded reset and visitor isolation—are built once and reused by all six flows. They are not a seventh user flow.

For the architecture view, group the same system into ADLASB's four layers: **Citizen Access** (five doors), **Service Delivery** (six flows and role views), **Technical Capability** (ledger/vault, promises, PWA, AI tools and integrations), and **Governance & Trust** (human authority, privacy, safety, audit and versioned policy). This is one architecture, not four products.

### Concrete prototype stack and interfaces

- one TypeScript Next.js/React installable PWA for citizen and provider role projections;
- server-only application/API routes with PostgreSQL for canonical state, visitor tenant isolation and append-only events;
- IndexedDB for the AES-GCM encrypted offline queue; WebCrypto for PBKDF2, hashes and ECDSA P-256;
- a background scheduler driven by the tenant virtual clock for promises, outbox retries and escalations;
- a protected server-side LLM adapter with strict schemas plus deterministic fixtures/fallbacks;
- Playwright for `/selftest`, clean-session, accessibility and state-transition regression tests;
- an OpenAPI/adapter-contract page for 16699, SMS/email, payment, NID and court sources, with every connection visibly marked real or simulated;
- an always-on nearby deployment plus local Docker fallback. SQLite may support local development only; the public concurrent demo uses PostgreSQL. Capacity is established by a pre-freeze load test at the expected jury concurrency (minimum 25 simultaneous visitor tenants), reporting p95 response time, seed/reset time and error rate; no untested tenant number is presented as supported capacity.

| PDF flow | End-to-end implementation scope | Main Annex blocks |
|---|---|---|
| **1. Safe and accessible intake** | Moyuri, Ripon, 16699, T5, representation, safe contact, confirmation/correction/withdrawal and screenless status | Access & Application; Verification & Eligibility; cross-cutting AI/audit/security |
| **2. Assisted, low-bandwidth and offline intake** | Nuching, UDC, case support, T6, T9 and T10; consent, document quality, encrypted queue and conflict review | Access & Application; Verification; document management; integrations/audit |
| **3. DLAO daily operations** | DLAO/case support, T3, T4 and T8; explained queue, related cases, duplicate review, human override and routine report | Verification & Eligibility; Jurisdiction & Routing; dashboard/reporting; AI assistance |
| **4. Mediation and settlement** | Mediator, multiple attempts, ODR and in-person fallback, T7, T11, outcome and closure prerequisites | Legal Aid Service Pathways; Outcome & Closure; notification/document/audit services |
| **5. Urgent referral and receiving office** | Nabila, receiving DLAO, Rahim T2, sensitive access, DLAO/SCLAC/LLAC/focal-point directory, acknowledgement/return/escalation | Jurisdiction & Routing; referral/transfer; notification/audit/security |
| **6. Long-running case and lawyer accountability** | Malek, Marzina T1, panel lawyer, panel registry/workload, financial review, assignment, updates, reassignment, payment reconciliation and closure | Panel Lawyer Process; Outcome & Closure; payment, panel management and reporting |

Acceptance hardening runs across the six flows: all 23 trigger tests, five literal persona failures, G1-G10, TalkBack, throttling, clean-browser/service-worker and deterministic AI fallback.

Do not deepen optional features until every mandatory item has one real state-changing acceptance path and audit event.

### Explicit cut line, in order

If time runs short, reduce scope in this order while preserving every mandatory acceptance test:

1. remove grievance functionality beyond the single thin record/decision path;
2. remove email and app-notification polish beyond the required SMS simulation and in-app centre;
3. remove panel-lawyer ratings UI while keeping the field and safe-feedback rule;
4. remove the optional Deaf/HoH demonstration while retaining its equivalent-route design and paper mention;
5. reduce the approved knowledge base to six to eight articles/templates;
6. remove grievance functionality beyond one register-investigate-resolve-close path;
7. remove monthly reports beyond B7's one routine report;
8. remove policy-pack administration screens and keep versioned seeded configuration;
9. remove payment-interface polish while keeping T1 reconciliation state and audit events;
10. keep only the required T10 measurement protocol, then remove cosmetic analytics/animations.

Never cut: any named persona failure, any T1-T11 acceptance condition, all three T7 drafts, B7's routine report, T1 payment reconciliation, T10 simple measurements, role privacy, human decision control, state changes or audit evidence.

---

## 14. Paper-ready structure

Start the paper immediately as a build manifest, then update it only with completed implementation.

### Recommended approximately 940-word allocation

- **Problem and solution thesis — 110 words:** recorded activity versus delivered service; Case Ledger + Promise Engine.
- **Architecture — 185 words:** five doors, canonical record/ledger, human gate, promises, role views and Status Sentence.
- **Workflow and legal fit — 175 words:** Application ID, eligibility, Case ID, routing, advice/mediation/direct aid/other applicable referral, panel/payment/closure. Do not include Village Court/Gram Adalat in the paper.
- **23-item coverage map — 170 words:** compact table mapping A/B/T items to the six PDF flows and Annex blocks.
- **Human control and safeguarding — 95 words:** consequential decisions, AI boundaries, safe contact, permissions and provenance.
- **Failure and resilience — 95 words:** five persona failures, offline conflict, non-acknowledgement, inactivity and signature verification.
- **What was built / built versus simulated — 55 words:** state which six flows and shared services are working, then clearly label only external 16699, SMS and payment connections as simulations.
- **Five indicators and scale — 55 words:** list the five measures and national/configurable scaling.

Target about 940 words, leaving roughly 60 words of safety below the 1,000-word maximum for headings, labels or final corrections.

The paper must not claim a module is built until its trigger, state change and audit event work in the deployed prototype.

---

## 15. Mandatory acceptance contract

| ID | Working action and required state/audit proof |
|---|---|
| **A1 Moyuri** | Progress with `IDENTITY_UNVERIFIED` -> record Ripon's representative report and first-hand-account promise -> safe-phrase check -> block unsafe answered call and record next safe window -> Moyuri confirms/corrects/withdraws later. Vault redaction, provenance and safe-contact events stay distinct. |
| **A2 Ripon** | Independently complete the same Bangla status/authority task through TalkBack web and keypad/voice IVR, including repeatable audio OTP and spoken confirmation scope. |
| **A3 Nabila** | Human confirms urgency/SLA -> ingest hashed no-preview evidence -> preview minimum package -> withhold acknowledgement -> create alternate-channel overdue/escalation events and safe holding message. |
| **A4 Nuching** | Record audio read-back/witness, original-language source, translation and UDC provenance -> reject/retake blurred image -> interrupt network -> issue temp receipt -> recover encrypted draft -> idempotent sync/conflict review; UDC access expires. |
| **A5 Malek** | Fail shop-number contact -> create alternative-contact task -> miss two lawyer updates -> create DLAO alert -> deliver sourced hearing status and three-state travel advisory through numeric IVR before travel. |
| **B1 DLAO** | Use Today/ageing/SLA queue -> inspect evidence first -> give reason for high-stakes acceptance/override -> write decision event and update override metric/searchable history. |
| **B2 Mediator** | Complete safety screen -> notices/delivery -> per-party attendance/mode -> multiple attempts -> ODR failure and real in-person fallback -> settled/partial/failed/absent outcome. |
| **B3 16699** | Verify numeric reference plus safe phrase -> disclose only permitted status -> use approved knowledge -> continue the “story already told” Bangla intake in the same record without duplicate leakage. |
| **B4 UDC** | Record free-service notice and verbal-readback consent -> use T6 checklist -> complete offline recovery without operator phone as applicant contact -> expire access -> expose “asked to pay” grievance path. |
| **B5 Lawyer** | Accept/decline with reason -> receive latest-version package -> use mobile hearing/deadline/update view -> miss later obligations -> DLAO receives alert without chase call. |
| **B6 Receiving DLAO** | Completeness validator blocks an incomplete package -> send complete minimum package -> accept/return with structured reason -> shared timeline updates -> acknowledgement SLA/non-ack follow-up. |
| **B7 Case support** | Search Bangla/English/transliteration -> inspect field-version history and handover notes -> generate and view one routine report entirely from captured record data. CSV/PDF export is Tier 2 and may be cut first. |
| **T1** | Marzina request -> human review -> handover/urgent coverage promise -> reassignment -> illustrative paid/earned/disputed stage reconciliation -> separate three-case “review, not misconduct” alert. |
| **T2** | Return/reject Rahim's transfer two or more times within the same unresolved transfer chain, even with resubmission or acknowledgement interleaved -> show reasons/time in limbo and sender ownership -> Promise Engine retains escalation -> supervisor route-decision event. |
| **T3** | Create three separate related cases -> upload one common document -> controlled group view without merging case-specific data. |
| **T4** | Run 12–15 records including two trap pairs -> produce confusion table -> intake sees masked warning, staff sees attributes -> reversible human duplicate/separate/related decision; never auto-reject/merge/fraud-label. |
| **T5** | Safety-first opening -> complete straightforward Bangla intake -> mask PII and enforce tool schema -> hand sensitive/ambiguous intake to human with slots/transcript/provenance/uncertainty -> correction loop. |
| **T6** | Analyse six documents -> retain only source-anchored briefing sentences -> show missing/unreadable/latest-version/blur findings -> officer verification event. |
| **T7** | Generate Bangla maintenance/property/labour drafts -> mark inference -> deterministic inconsistency warning -> audio read-back -> mediator review/version lock. |
| **T8** | Run at least eight cases through fixed-schema category/urgency/process components -> surface disagreement, safety and wrong-jurisdiction cases -> feed DLAO queue -> human resolution/agreement metric. |
| **T9** | Create three offline temp records -> sync ID mapping with no duplicate -> per-field conflict/retry -> human resolution -> checkpoint verification -> “tamper row” causes failure. |
| **T10** | Install PWA -> compare normal/light under the same Slow-3G/CPU profile -> report weight, requests, paint, interactive and task completion -> test eviction/low-end Android -> prove logout wipe. |
| **T11** | Two parties sign canonical artefact asynchronously with ECDSA P-256, one offline -> sync -> independent verification succeeds -> edit locks/re-sign rule and mutated artefact fails. |

External 16699, SMS and payment connections may be labelled simulators. Their internal trigger, state change, failure behaviour and audit event must still be real.

---

## 16. Jury control surfaces

### Persistent 23/23 navigator

Keep a persistent **23/23 Coverage Navigator** available from every provider view. It is not a checklist of claims. Each item opens:

- the exact seeded scenario and responsible role;
- a short statement of the acceptance condition;
- a trigger/reset control;
- current canonical state;
- expected state change;
- latest Case Ledger event and hash-verification result;
- related PDF flow, Annex block and Golden Thread requirements;
- whether any external connection is simulated.

Each scenario has an isolated reset. The navigator displays the current visitor/session identifier so simultaneous jurors cannot alter one another's data.

### Failure Lab

The Failure Lab is a juror-triggerable control panel over real workflow logic, not an animation. Each action must change state, create an event and expose the responsible fallback human.

| Trigger | Required observable recovery |
|---|---|
| Unsafe person answers Moyuri's phone | Block/delay contact, record reason, preserve unconfirmed status and select safer route |
| Nabila's receiver does not acknowledge | Referral promise becomes overdue; sender remains responsible; escalation task appears |
| Nuching loses network halfway | Encrypted draft survives; reconnect deduplicates; sync events join the canonical ledger |
| Two offline edits conflict | No silent overwrite; comparison goes to authorised human resolution |
| Malek's lawyer misses two updates | DLAO action appears; citizen status is updated only after human verification |
| Rahim's referral is returned twice within the same unresolved transfer chain | Jurisdiction escalation appears even if resubmission/acknowledgement is interleaved; human route decision is required |
| Duplicate trap is selected | Side-by-side evidence appears; no automatic fraud/merge/rejection |
| Triage components disagree | Conflict and concise reasons appear; officer resolves and audit records override |
| Document is unreadable | T6 marks uncertainty and missing evidence; it does not fabricate a summary |
| Signed document is modified | Independent T11 verifier fails |
| Logout on shared UDC device | Session ends and encrypted queue/decrypted working data/sensitive caches are wiped |
| Advance virtual clock | Due promises become overdue through real scheduler logic; reset restores fixture time |
| Withdraw unsafe statement payload | Operational payload disappears, `WITHDRAWN` event remains and chain verification passes |
| Remote mediation connection fails | Session becomes failed/reschedule-required and a real in-person fallback promise is created |

**One planned Bad Day for the 10-minute pitch:** Nuching's network drops halfway through an assisted UDC submission. The record survives locally, reconnects without duplication, exposes one deliberately seeded conflict for human review and passes integrity verification. This single sequence proves inclusion, T9, T10, provenance, human control and auditability.

---

## 17. Five-day execution plan

| Day | Build focus | Exit condition |
|---|---|---|
| **Day 1 — Foundation and first-order risk gates** | Freeze entities, authority matrix, state transitions, IDs, six-flow map and full seed contract. Build visitor isolation/reset, per-case Ledger/Vault, Promise Engine, Human Decision Gate and Time Machine. Decide offline chain joining and PIN-derived queue key. Before dependent UI work, test: (1) Bangla OCR on text PDFs/scans/photos; (2) TalkBack plus pre-generated audio/keypad/voice-OTP on a real Android phone; and (3) minimal PWA deployment, clean-browser install and offline service worker. | Submission creates `APP-YYYY-XXXXX`; offline creates `TEMP-xxxx`; acceptance creates `DLAS-YYYY-XXXXX`; rejection does not. Hash/checkpoint and withdrawal pass. Clock creates overdue work. OCR/fallback, real-phone accessibility and public-host install/offline gates pass. |
| **Day 2 — Flows 1 and 2** | Build Moyuri/Ripon/16699 and Nuching/UDC journeys, safe session/phrase, USSD/SMS/IVR, T5/T6/T9/T10, consent, redaction, encrypted queue and light mode. Add notification outbox and approved knowledge minimum. Start the approximately 940-word paper using only working claims. | Literal Moyuri/Ripon/Nuching tests pass, including unsafe OTP suppression, withdrawal, network drop, conflict, temp-ID mapping and logout wipe. |
| **Day 3 — Flows 3, 5 and 6** | Build DLAO Today/SLA/report, T3/T4/T8, Nabila evidence controls, Rahim transfer chain, panel registry/workload, Malek travel advisory, Marzina handover/coverage and post-closure payment. Add integrations panel and thin grievance. Update paper map. | Named fixtures/counts/versioned thresholds pass; directory, minimum package, referral acknowledgement/escalation and both financial branches work. |
| **Day 4 — Flow 4 and end-to-end closure** | Build mediation safety gate, notices/attendance, ODR/in-person fallback, all three T7 drafts, T11 offline signer/verifier, panel allocation, thin appeal, outcomes and corrected closure/payment ordering. Finish Failure Lab, 23/23 navigator and `/selftest`. | All six flows reach real outcomes; unsafe mediation is blocked; mutation breaks signature verification; incomplete cases cannot close; closed cases may remain payment-pending. |
| **Day 5 — Acceptance and deliverables** | Run `/selftest`, all 23 tests, G1-G10, persona failures, role/privacy/access logs, TalkBack, Slow-3G protocol, low-end Android, clean-browser/service-worker, visitor isolation/reset and rate limits. Reconcile paper claims, freeze, deploy, create deck and record fallback. | Public URL/QR works on two phones; every item triggers state/audit; seeded metrics are labelled; paper fits two pages/1,000 words; captioned MP4 is no more than 90 seconds. |

### Team ownership to assign before coding

| Workstream | Scope |
|---|---|
| Foundation | Schema, RBAC, ledger/vault, promises, Time Machine, tenants and reset |
| Intake and assisted AI | T4–T8, knowledge base, safe sessions and human handoff |
| Offline/PWA/crypto | T9–T11, encrypted queue, service worker and verifier |
| Frontend/accessibility | Role views, Bangla UI, TalkBack, IVR/USSD/SMS simulators |
| Service operations | Referral, mediation, panel lawyer, payment and closure flows |
| QA/deployment | `/selftest`, device/throttling checks, hosting and monitoring |
| Legal/governance | Claim register, authority matrix, safeguards and paper truth-check |
| Pitch/delivery | Deck, Q&A cards, captioned video and timed rehearsal |

Assign one accountable name and one backup per row. The legal/governance owner must approve any legal/current-operational claim before it enters the UI, paper or deck.

### Top risks and fixed fallbacks

| Risk | Required fallback |
|---|---|
| Bangla OCR fails on scans/photos | Text PDFs for the reliable path; one poor image is explicitly unreadable/uncertain |
| Bangla speech/TalkBack varies by device | Pre-generated audio and keypad path fixed on Day 1 after real-phone test |
| Public host cold-start/outage | Always-on host, local Docker and offline MP4 |
| LLM is slow/unavailable | Deterministic T5–T8 fixtures and rules |
| Offline edge case fails | Fixed scripted conflict plus `/selftest` regression |
| Live pitch overruns | Six-flow timed script; secondary requirements remain one-click Q&A cards |

---


## 18. Deck, pitch and fallback package

### Submission controls

- Slide 1 contains the public prototype URL and a tested QR code.
- The fallback recording is MP4, no more than 90 seconds, and shows a working integrated flow rather than slides alone.
- Use Nuching's assisted intake -> network loss -> offline survival -> reconnect -> conflict review -> authoritative sync/audit as the fallback flow.
- Keep a clean seeded reset for the live demonstration and a separate local fallback.

### Ten-minute script

| Time | Demonstration |
|---|---|
| **0:00-0:15** | Malek risks losing a day's wage although his case, lawyer and office exist: recorded is not delivered; sent is not accepted. |
| **0:15-1:00** | Architecture: five doors, one record, four layers, 23 items—Ledger/Vault, Human Decision Gate, Promise Engine, role views and Status Sentence. |
| **1:00-7:00** | Six integrated flows, about one minute each: Moyuri/Ripon; Nuching/UDC; DLAO operations; safe mediation; Nabila/Rahim referral; Malek/Marzina accountability. A second team member drives while the presenter narrates. |
| **7:00-8:00** | Planned Bad Day: Nuching network drop -> offline receipt/recovery -> sync -> conflict resolution -> integrity result. |
| **8:00-9:00** | Provider and citizen payoff: one update avoids repeat entry/chase calls, accepted handoffs prevent limbo, safe contact prevents harm and verified advice prevents an unnecessary journey. |
| **9:00-10:00** | Feasibility: integrations panel, configured district scale and five seeded prototype measurements. Close: “We show who owes the next act, when it is due, whether it happened, and what protects the citizen when it does not.” |

Keep SMS/USSD, rejection/appeal, both financial branches, panel workload, closure blocker and routine report as juror-ready navigator cards rather than overloading the timed demonstration. Assign visible legal/governance, technical, accessibility/design and delivery voices.

### Q&A answers

**Is the ledger blockchain or tamper-proof?**  
No. It is a relational operational record plus append-only, hash-linked audit events under a stated threat model.

**Can AI decide eligibility, priority or jurisdiction?**  
No. It extracts, compares, drafts or recommends. An authorised human decides and the reason/override is recorded.

**Does a lawyer-pattern alert prove misconduct?**  
No. The configurable prototype threshold opens human review; it is not a finding.

**Why will providers use this?**  
One update feeds the case, promise queue, citizen-safe status, routine report and payment evidence, reducing duplicate entry and chase calls.

**What is original if event logs and task engines exist?**  
Field-level provenance, accepted—not merely sent—responsibility, safe-contact-aware Status Sentences and one failure-recovery model across assisted, offline and provider workflows.

**Why a hash chain rather than only an editable audit table?**  
It detects later modification and verifies offline-to-server ordering under a stated threat model. It is not blockchain or tamper-proof.

**What if a withdrawn statement is unsafe?**  
Sensitive payloads live outside the chain; withdrawal masks/deletes the permitted payload and appends a non-sensitive withdrawal event, so chain verification still works.

**What if the officer never acts?**  
The promise escalates from owner to supervisor to programme/DBLA oversight, where the unresolved final rung remains visible.

**Could “no need to travel” be wrong?**  
The advisory defaults to `UNKNOWN`; `NO_TRAVEL_NEEDED` needs a verified source and validity window and is never generated for a court hearing date.

**How do you prevent rubber-stamping?**  
Evidence appears before recommendations, high-stakes acceptance and overrides need reasons, and the audit shows decision time and override patterns.

**Is mediation safe for Moyuri?**  
Not automatically. A human safety screen can require separate sessions, remote handling, another route or no mediation.

**Where does personal data go when AI is used?**  
Identifiers are masked, output is schema-limited, user text cannot invoke tools, and deterministic fallbacks exist. Production needs an approved hosting/data-protection arrangement.

**How does this connect to real DLAS services?**  
Versioned adapter contracts isolate 16699, SMS/email, payment, NID and court sources; the integrations panel clearly marks each real or simulated.

**Why does payment not block closure?**  
Annex B2 places completion/payment/disbursement after case closure; the system therefore supports `CLOSED · PAYMENT_PENDING`.

**Is duplicate detection fraud detection?**  
No. It only surfaces a privacy-limited “possible repeat application” for reversible human review.

**Where is Gram Adalat?**  
It is intentionally absent from the prototype, paper and deck because ADLASB is the competition source of truth. It may be researched later only through the claim register and authorised legal confirmation.

---

## 19. Legal-claim validation rule

Maintain a small claim register for every legal or current-operational statement used in the prototype, paper or deck:

| Field | Required value |
|---|---|
| Claim | Exact narrow statement being made |
| Authority | ADLASB page/Annex or official law/regulation/agency publication |
| Provision/source | Section, notification or direct URL |
| Effective date | Date in force or publication date |
| Geography/matter | Where and to which disputes the rule applies |
| Verified on | Date a team member personally opened/read it |
| Prototype consequence | Rule-pack version, UI wording or human-confirmation requirement |

Rules:

1. ADLASB controls the competition requirements.
2. A legal/current claim enters the paper only after a team member opens the primary or official source and records it.
3. If the effective date, geography, schedule or interpretation is not confirmed, label it **“subject to authorised legal confirmation”** and do not encode it as an automatic decision.
4. Do not present the pilot district count as an ADLASB fact; the case PDF does not state one. Any external pilot count may appear only after a team claim-register entry is completed and the official source is directly cited.
5. The 2026 amendment, notified mediation geography, BDT 300,000 Village Court figure and external pilot-district count are **unverified for team use** until a team member personally opens the primary/official source and completes the claim-register row. Links below are research leads only, not approved claims.
6. Village Court/Gram Adalat is recorded as **not used—outside the ADLASB competition source of truth** and is excluded from the prototype, paper and deck.

---

## 20. ADLASB-only mandatory-scope compliance audit

### Validation statement

This section was checked directly against all 12 pages of the **ADLASB Final Round Case**, which is the sole source of truth for this audit.

**Coverage statement:** All 23 mandatory items, all five access doors, G1-G10 and Annex B2 blocks 1–7 are mapped in this model. Specification, build and deployed-test status remain separate; this document does not claim implementation confidence before the corresponding evidence exists.

Status legend:

- **Specified ✓** — the final model contains the required design and acceptance condition.
- **Built ☐** — remains unchecked until functioning code changes canonical state.
- **Tested ☐** — remains unchecked until the deployed prototype passes the exact acceptance/failure test and writes an audit event.

### Five-door validation — ADLASB page 3

| Door | Required behaviour | Model location | Status |
|---|---|---|---|
| 16699 / IVR / voice | Voice-first intake/status, read-back, safe contact and human handoff | Sections 3, 5, 7, 15 | Specified ✓ · Built ☐ · Tested ☐ |
| USSD / SMS | Short, low-data, neutral and privacy-aware status flow | Mandatory USSD/SMS door; Sections 15 and 18 | Specified ✓ · Built ☐ · Tested ☐ |
| Web / mobile | Bangla-first, accessible, low-bandwidth, save/resume | T10; Sections 7, 8, 10 | Specified ✓ · Built ☐ · Tested ☐ |
| Assisted access | UDC/helper/representative consent, provenance, bounded permission and audit | Sections 3, 5, 7, 15 | Specified ✓ · Built ☐ · Tested ☐ |
| DLAO / referral route | Walk-in/institutional route using same record and acknowledged handover | Sections 3, 5, 9, 15 | Specified ✓ · Built ☐ · Tested ☐ |

### Mandatory 23-item checklist — ADLASB pages 4-10

| ID | ADLASB requirement | Model/acceptance mapping | Status |
|---|---|---|---|
| A1 | Moyuri: safe contact, identity gap, representation | Sections 7 and 15; unsafe-answer Failure Lab trigger | Specified ✓ · Built ☐ · Tested ☐ |
| A2 | Ripon: blind access and independent task/status | Sections 7 and 15; Day-1 real-phone TalkBack gate | Specified ✓ · Built ☐ · Tested ☐ |
| A3 | Nabila: urgency, sensitive access, tracked referral | Sections 7 and 15; non-acknowledgement trigger | Specified ✓ · Built ☐ · Tested ☐ |
| A4 | Nuching: assisted access, language/provenance, offline | Sections 7 and 15; planned Bad Day | Specified ✓ · Built ☐ · Tested ☐ |
| A5 | Malek: long-running status, unstable contact, lawyer follow-up | Sections 7 and 15; two-missed-update trigger | Specified ✓ · Built ☐ · Tested ☐ |
| B1 | DLAO: operational queue, priority, backlog and override | Sections 4, 5, 13 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| B2 | Mediator: end-to-end mediation plus ODR and in-person fallback | Sections 3, 5, 8 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| B3 | 16699: shared lookup plus Bangla intake/status | Sections 3, 5 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| B4 | UDC: assisted intake, checklist, safe contact, free notice, weak network | Sections 3, 5, 7, 8 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| B5 | Panel lawyer: assignment, hearings/deadlines, updates and alert | Sections 3, 5, 8 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| B6 | Receiving DLAO: complete referral, acknowledgement and status | Sections 3, 5 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| B7 | Case support: structured record, search and one routine report | Sections 5, 13 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| T1 | Lawyer change, repeated inactivity and payment reconciliation | Sections 8 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| T2 | Two-return jurisdiction ping-pong and human escalation | Sections 8 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| T3 | Three linked cases and shared evidence without merging | Sections 8 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| T4 | 10-15 duplicate candidates including two traps and human review | Sections 8 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| T5 | Conversational Bangla intake and sensitive human handoff | Sections 8 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| T6 | 5-6 documents, sourced briefing, missing and unreadable items | Sections 8 and 15; Day-1 OCR gate | Specified ✓ · Built ☐ · Tested ☐ |
| T7 | Maintenance, property and labour drafts, inference marks and inconsistency | Sections 3, 8 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| T8 | Three components, five cases, disagreement and human review | Sections 8 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| T9 | Three offline records, idempotent sync, conflict and integrity check | Sections 8, 10 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| T10 | Installable PWA, light mode, throttling, measurements and safe caching | Sections 8, 10, 12 and 15 | Specified ✓ · Built ☐ · Tested ☐ |
| T11 | Asynchronous offline signature and independent verification | Sections 8 and 15 | Specified ✓ · Built ☐ · Tested ☐ |

**Coverage count:** 23 of 23 specified; 0 of 23 may be marked built or tested before implementation evidence exists.

### Golden Thread checklist — ADLASB page 9

| ID | Pass condition | Model coverage | Status |
|---|---|---|---|
| G1 | One record across doors/providers with source, role and handover | Canonical record, Ledger, six flows | Specified ✓ · Tested ☐ |
| G2 | Representation and provenance remain visible | Field/event provenance and authority | Specified ✓ · Tested ☐ |
| G3 | Unsafe contact blocked/delayed with reason | SafeContactPolicy, SMS/USSD suppression, Failure Lab | Specified ✓ · Tested ☐ |
| G4 | Equivalent accessible/non-screen/assisted route | TalkBack/audio/UDC/USSD/IVR | Specified ✓ · Tested ☐ |
| G5 | Consequential recommendation is human-reviewable and override is recorded | Human Decision Gate | Specified ✓ · Tested ☐ |
| G6 | Missing/uncertain/latest/duplicate document issues are visible | Document versions and T6 | Specified ✓ · Tested ☐ |
| G7 | Mediation/referral/lawyer/task/deadline has owner/status/next action | Promise Engine | Specified ✓ · Tested ☐ |
| G8 | Offline/retry/conflict loses or duplicates nothing silently | T9 sync contract | Specified ✓ · Tested ☐ |
| G9 | Role privacy persists across handovers | Role projections and restricted evidence | Specified ✓ · Tested ☐ |
| G10 | Reconstruct who did what, when, through which role/channel/authority | Ledger event contract and verifier | Specified ✓ · Tested ☐ |

### Responsible-design and prototype-standard validation — ADLASB pages 2 and 9

| ADLASB rule | Model enforcement | Status |
|---|---|---|
| Working means genuine logic, state change and audit | Build transaction contract in Section 13 | Specified ✓ · Tested ☐ |
| Only unavailable external integrations may be simulated | 16699/SMS/payment boundary stated in Sections 14-15 | Specified ✓ · Tested ☐ |
| Concept-only does not count | Every acceptance row requires a trigger and observable state/event | Specified ✓ · Tested ☐ |
| Human authority for consequential decisions | Human Decision Gate and authority matrix | Specified ✓ · Tested ☐ |
| Provenance categories distinguish sources | Ledger event contract | Specified ✓ · Tested ☐ |
| Privacy, safe contact and material-access history | SafeContactPolicy, role views and audit | Specified ✓ · Tested ☐ |
| Bangla-first accessibility and equivalent routes | Ripon gate, USSD/SMS, IVR and UDC | Specified ✓ · Tested ☐ |
| Visible, safe failure and human escalation | Failure Lab and Promise Engine | Specified ✓ · Tested ☐ |
| Every module writes to same IDs/tasks/audit | Canonical state and event transaction | Specified ✓ · Tested ☐ |
| Illustrative data only | Seeded synthetic fixtures | Specified ✓ · Tested ☐ |

### Annex B2 business-rule validation — ADLASB page 12

| Rule | Model coverage | Status |
|---|---|---|
| Every submission receives Application ID | `APP-YYYY-XXXXX` at submission | Specified ✓ · Tested ☐ |
| Case ID only after eligibility and acceptance | Application state machine creates `DLAS-YYYY-XXXXX` only on acceptance | Specified ✓ · Tested ☐ |
| Same Case ID throughout lifecycle/referral | Canonical Case and referral model | Specified ✓ · Tested ☐ |
| DLAO/SCLAC/LLAC/authorised transfer | Referral directory and Promise Engine | Specified ✓ · Tested ☐ |
| Multiple mediation attempts on same case | `MediationAttempt` collection | Specified ✓ · Tested ☐ |
| Funded panel allocation only after required financial decision | Direct-legal-aid pathway and Human Decision Gate | Specified ✓ · Tested ☐ |
| Closure only after reports, verification, documents and approvals | Closure blockers | Specified ✓ · Tested ☐ |
| Complete audit, notifications and records | Ledger, Promise Engine and safe Status Sentence | Specified ✓ · Tested ☐ |

### Deliverable and live-test validation — ADLASB pages 1-3 and 10

| Requirement | Model control | Status |
|---|---|---|
| Solution paper: PDF, maximum 2 pages / 1,000 words | Approximately 940-word allocation with “what was built/simulated” and coverage map | Specified ✓ · Produced ☐ |
| Pitch deck: prototype URL and QR on slide 1 | Section 18 submission controls | Specified ✓ · Produced ☐ |
| Public prototype: all 23 reachable and testable | 23/23 navigator, visitor isolation and deterministic reset | Specified ✓ · Deployed/tested ☐ |
| Fallback: MP4, no more than 90 seconds | Nuching working failure/recovery flow | Specified ✓ · Recorded/tested ☐ |
| Six integrated flows, not 23 disconnected narrations | Section 13 exact six-flow map | Specified ✓ · End-to-end tested ☐ |
| Jury may select any item during Q&A | Each item has a trigger, expected state, event and reset | Specified ✓ · Tested ☐ |

### Audit conclusion

All 23 mandatory items and Annex B2 blocks 1–7 are mapped; build and test status is tracked separately. Each unchecked **Built** and **Tested** box requires deployed behaviour, a canonical state transition and an audit event. This is a traceable specification audit, not a “100% working” claim, and it excludes unverified external legal/programme claims.

---

## 21. External research leads — not source-of-truth validation

The links below were found on official-government or UNDP domains during research, but they are **not approved claims for the prototype, paper or deck**. A team member must personally open the primary text, identify the relevant provision/effective date/geography and complete Section 19's claim register first.

- [External pilot-programme description — UNDP](https://www.undp.org/bangladesh/press-releases/digital-legal-aid-services-improve-access-justice)
- [External DLAS co-design description — UNDP](https://www.undp.org/bangladesh/news/accelerating-digital-legal-aid-bangladesh-justice-within-reach-all)
- [Candidate source: Legal Aid Services amendment text — Laws of Bangladesh](https://bdlaws.minlaw.gov.bd/act-print-1674.html)
- [Candidate source: pre-case mediation provision/notification — Laws of Bangladesh](https://bdlaws.minlaw.gov.bd/act-print-834/section-print-54928.html)
- [Candidate source: legal advice and mediation rules — Directorate of Legal Aid](https://nlaso.gov.bd/pages/legislative-informations/%E0%A6%86%E0%A6%87%E0%A6%A8%E0%A6%97%E0%A6%A4-%E0%A6%B8%E0%A6%B9%E0%A6%BE%E0%A7%9F%E0%A6%A4%E0%A6%BE-%E0%A6%AA%E0%A6%B0%E0%A6%BE%E0%A6%AE%E0%A6%B0%E0%A7%8D%E0%A6%B6-%E0%A6%93-%E0%A6%AE%E0%A6%A7%E0%A7%8D%E0%A6%AF%E0%A6%B8%E0%A7%8D%E0%A6%A5%E0%A6%A4%E0%A6%BE-%E0%A6%AC%E0%A6%BF%E0%A6%A7%E0%A6%BF%E0%A6%AE%E0%A6%BE%E0%A6%B2%E0%A6%BE-%E0%A7%A8%E0%A7%A6%E0%A7%A8%E0%A7%AB-8179aa-6922da35933eb65569e031b5)
## Feature 8 — Court-referred mediation

The product shall identify every mediation by origin and retain complete court referral metadata without creating a second mediation application. Officer review, mediator assignment, workspace sessions, settlement, and failure use the shared engine. Certified success produces a recorded legal outcome and a separate referring-authority notification task. Confirmed failure returns the formal failure record to the court/legal pathway. No external notification is inferred or silently sent.

## Feature 9 — Mediator privacy and role-based access

Access shall combine role permission with ownership, office, or active assignment. Mediators may access assigned cases and the verified information required to conduct mediation, but cannot access unrelated cases, other mediators’ matters, internal officer or administrative notes, unrelated personal or risk information, or confidential data outside the assignment. Caucus notes form a separate mediator-confidential record.

Legal Aid Officers may review case verification, pathway, assignment, required mediation records, outcome, and audit history within their office. Chief Legal Aid Officers additionally review and certify settlement agreements and monitor the available district/national settlement worklist. Panel lawyers receive case access only after the lawyer handoff and access grant. Citizens remain limited to their own public case record. DBLA/Admin monitoring excludes mediator-confidential notes. Sensitive actions must record user, role, case, action, and timestamp.
## Device simulator usability refinement

The IVR and USSD prototype shall present a single simulated handset with the current prompt and response controls. The handset display shall remain compact and scroll longer prompt content within the display while preserving usable keypad targets. Every visit shall start with a fresh device session, and the device shall neither persist nor display a conversation transcript. Repeated instructions, message panes, and developer-facing record inspection shall not compete with the caller flow. The device header shall omit the Debug control. Required application fields, provenance, audit events, handoff, emergency, and submission behavior remain part of the workflow.
## Admin role directory expansion

DBLA/Admin shall be able to find, add, edit, and delete accounts from the People directory, including the existing mediator and UDC operator records. Deletion requires a named confirmation and an audit entry. Historical application and audit records remain. Active mediator and lawyer assignments block deletion until resolved; deleting a UDC operator removes the linked registered centre. Mediators remain in the shared mediator registry used by assignment and mediator sign-in. UDC operators remain linked to the shared UDC centre directory. Admin creation does not bypass the established mediator certification and assignment checks, and all changes are audited.

The Admin dashboard retains a dedicated Mediator training section for the canonical certification
and training fields. Administrative edits reset prior verification, return active mediators to
pending verification, append training history and audit evidence, and therefore cannot silently
make a mediator eligible for assignment or be overwritten by legacy auto-approval migration.
## Admin navigation

The admin sidebar shall provide working navigation to every implemented admin workspace, including mediation oversight. Navigation shall preserve the single-page hash workspace, allow a return to Overview, and communicate one active destination at a time. The complete admin workspace uses the selected theme across navigation, content surfaces, forms, dialogs, tables, and interaction states while retaining the shared accessible structure.

## Visual theme

The product uses the CSS-only `gov_theme.css` compatibility theme over centralized tokens. It implements a premium blue-white glass system with primary `#2563EB`, hover `#1D4ED8`, canvas `#F6F9FC`, navy text `#0F172A`, translucent white surfaces, and semantic green/amber/red states. Saved themes remain development references; no theme switch is shown in the product interface.


### Blue-white macOS-inspired glass system

The active CSS-only theme in `frontend/app/themes/gov_theme.css` uses a subtle ambient background,
translucent navigation and grouped surfaces, 14–20px surface radii, blue primary controls, blue
keyboard focus, and light layered shadows. Dense tables and lists retain their existing information
density and separators rather than becoming isolated cards. Errors, failed operations, destructive
warnings, and urgent states use red plus text/icon semantics; only critical states pulse, and
reduced-motion disables that animation. The implementation preserves all routes, content,
permissions, workflows, responsive behavior, and Bangla/English behavior.

## Case-level service refinements

The product shall allow several mediators on a case when each passes the same case-specific human-
reviewed eligibility process. Citizens and UDC-assisted citizens shall be able to seek legal aid
to defend an alleged person, with that purpose retained in the canonical record. A citizen with an
assigned panel lawyer shall be able to report alleged illegal conduct through a lawyer-change
request; the district officer receives actionable work, and approval acknowledges the application
without claiming that a replacement is already assigned. Citizen notifications shall remain
current: mediation completion copy shall not advertise a seven-day appeal window, and a requested
document reminder shall disappear after successful submission.
