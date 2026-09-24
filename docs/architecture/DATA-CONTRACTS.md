# DLAS Data Contracts — "Five Doors, One Record"

**Status:** Step 1 (Access & Application) implemented. Canonical code: `frontend/lib/dlas/`.
**Storage:** browser `localStorage` (prototype backend). No server. Everything below is JSON.

This file answers two questions for the team:

1. **Which JSON lives where?** (storage keys → collections)
2. **Which route (endpoint) reads/writes which JSON?**

---

## 1. Storage map

```mermaid
flowchart LR
  subgraph Doors["Step 1 · Access & Application (the five doors)"]
    C["/dashboard/citizen#intake<br/>WEB_PORTAL<br/>(CitizenDoor)"]
    D["/dashboard/udc/intake/new → /[temporaryId]<br/>UDC_ASSISTED<br/>(UdcDoor)"]
    I["/device/ivr<br/>IVR_16699 (sim)"]
    U["/device/ussd<br/>USSD (sim)"]
  end
  subgraph Legacy["Other existing flows (bridged)"]
    LU["/dashboard/udc sync-centre / seeded offline drafts"]
    LH["/dashboard/helpline agent intake"]
  end
  GW(["IntakeGateway<br/>lib/dlas/gateway.ts<br/>validate → mint APP-ID → audit → tasks"])
  DB[("localStorage<br/>dlas.db.v1<br/>sessions · applications · tasks · outbox · otp")]
  SH[("localStorage<br/>shakkho.helpline.v1<br/>records (projection) + provider modules")]
  DBG["/debug"]
  C & D & I & U --> GW
  LU -- ingestUdcOfflineDraft --> GW
  LH -- ingestLegacyHelplineRecord --> GW
  GW --> DB
  GW -- mirrorToLegacyStore --> SH
  DB --> DBG
  SH --> DBG
```

| Key | Kind | Owner | Holds |
|---|---|---|---|
| `dlas.db.v1` | localStorage | `lib/dlas/store.ts` | **Canonical shared record** — `DlasDb` (see §2) |
| `dlas.active.<CHANNEL>` | localStorage | `lib/dlas/door-bridges.ts`, `components/dlas/shared.tsx` | id of the in-progress session per door (save/resume) |
| `dlas.node.<SES-ID>` | localStorage | `components/dlas/scripted-phone.tsx` | current IVR/USSD menu node (resume a call) |
| `shakkho.helpline.v1` | localStorage | `lib/shakkho/persistence.ts` | Legacy `StoreEnvelope` used by helpline, DLAO, referral, lawyer pages. New applications appear in `records[]` as read-only projections with the same `applicationId`. |
| `shakkho.dlao.inbox.v1` | localStorage | `lib/shakkho/bridges/dlao-inbox.bridge.ts` | legacy DLAO inbox tasks |
| `shakkho.referrals.inbox.v1` | localStorage | `lib/shakkho/bridges/referral-inbox.bridge.ts` | legacy referral inbox |
| `shakkho.udc.v1` | IndexedDB | `lib/shakkho/services/offline-store.service.ts` | legacy UDC offline drafts |
| `dlas.files.v1` | localStorage | `lib/dlas/files.ts` | officer-viewable copies of uploaded documents, keyed by `docId` (images ≤1200px JPEG, PDFs ≤450 KB); `DocumentRef.preview` says `STORED` / `TOO_LARGE` / `NONE` |
| `rjd.intake.drafts` / `rjd.intake.pending` | localStorage | `lib/intake-store.ts` | citizen wizard's own draft + offline queue (the wizard also writes `dlas.db.v1` at every step) |
| `shakkho.lang`, `shakkho.udc.sidebar.v1` | localStorage | UI | language, sidebar state |

> ⚠ localStorage is **per browser**. A citizen on a phone and an officer on a laptop do **not** share it.
> To move state between devices for the demo use **/debug → Export JSON / Import JSON**.

---

## 2. `dlas.db.v1` — the whole database

```jsonc
{
  "v": 1,
  "schemaVersion": "dlas.application.v1",
  "counters": { "application": 5, "case": 0, "auditSeq": 212 },
  "udcCentres":   [ /* UdcCentre — { centreId, name{bn,en}, area{bn,en}, district, hours, services[], source DEMO_DIRECTORY|REGISTERED_OPERATOR, operatorId } — 2 demo centres per district + every signed-up UDC operator */ ],
  "officers":     [ /* DlaoOfficerAccount — { officerId OFC-XXXXXX, name, phone, officeType DLAO|SCLAC|LLAC, district, audit[] } */ ],
  "eligibilityRulesets": [ /* { version "LASP-2014-working-v1", status WORKING_DRAFT, incomeThresholdAnnualBdt{SUPREME_COURT,OTHER_COURTS}, exemptCategories[] } */ ],
  "udcOperators": [ /* UdcOperatorAccount — { operatorId UDC-XXXXXX, name, phone, centre, district, createdAt, lastLoginAt, audit[] } */ ],
  "citizens":     [ /* CitizenAccount — { citizenId, name, phone, createdAt, lastLoginAt, notificationsReadAt, audit[] } */ ],
  "sessions":     [ /* IntakeSession — one per attempt at any door (pre-submission) */ ],
  "applications": [ /* ApplicationRecord — the shared record, one per Application ID */ ],
  "tasks":        [ /* Task — human work created by the workflow */ ],
  "outbox":       [ /* SimMessage — simulated SMS (OTP, confirmations, suppressed) */ ],
  "otp":          [ /* OtpChallenge — demo OTP codes */ ],
  "updatedAt": "2026-09-23T07:10:00.000Z"
}
```

### 2.1 `ApplicationRecord` (identical shape from every door)

```jsonc
{
  "schemaVersion": "dlas.application.v1",
  "applicationId": "APP-2026-30002",        // minted ONLY by IntakeGateway.submit
  "caseId": null,                            // set only after human acceptance (Step 2)
  "status": "SUBMITTED",                     // SUBMITTED|UNDER_REVIEW|INFO_REQUESTED|ACCEPTED|REJECTED|WITHDRAWN|CLOSED
  "stage": "ACCESS_APPLICATION",             // backbone stage (see §4)
  "channel": {
    "code": "IVR_16699",                     // WEB_PORTAL|MOBILE_APP|IVR_16699|USSD|UDC_ASSISTED|HELPLINE_AGENT
    "captureMethod": "IVR_DTMF",
    "sessionId": "SES-K3P9QZ",
    "entryPoint": "tel:16699",
    "simulated": true,                       // telephone/USSD network is simulated; workflow is real
    "clientRef": null                        // offline temp id / legacy id → idempotency
  },
  "identity": { "phone": "01711000001", "method": "CALLER_LINE_ID", "verified": true, "verifiedAt": "…", "otpAttempts": 0 },
  "data": {
    "applicant": {
      "fullName": "Moyuri Akter", "phone": "01799000111", "phoneOwnedByApplicant": null,
      "gender": "FEMALE", "district": "JOYPURHAT", "addressLine": null,
      "preferredLanguage": "bn", "canRead": null, "accessibilityNeeds": []
    },
    "filedBy": { "kind": "REPRESENTATIVE", "name": "Ripon Hossain", "phone": "01711000001",
                 "relation": "SIBLING", "operatorId": null, "centre": null },
    "matter": { "category": "FAMILY", "summary": "…", "summaryOriginal": null, "translation": null,
                "incidentDate": null, "opposingParty": null },
    "urgency": { "selfReportedUrgent": false, "flags": [] },
    "safeContact": { "method": "VIA_REPRESENTATIVE", "phone": "01711000001", "safeTime": "EVENING",
                     "smsAllowed": false, "voicemailAllowed": false, "neutralWordingRequired": true,
                     "notes": null, "window": null /* or { "day": "FRI", "time": "10:30" } */ },
    "documents": [
      { "docId": "DOC-7Q2M1A", "type": "NID", "status": "WILL_SUBMIT_LATER", "fileName": null,
        "mimeType": null, "sizeBytes": null, "sha256": null, "sensitive": false, "qualityNote": null }
    ],
    "consent": { "dataProcessing": true, "contactOnSafeChannel": true, "shareWithAssignedProviders": true,
                 "method": "IVR_DTMF_1", "readBackConfirmed": true, "noticeVersion": "CONSENT-NOTICE-v1", "recordedAt": "…" },
    "freeServiceNoticeAcknowledged": true
  },
  "provenance": {                           // EVERY captured field, keyed by dotted path
    "applicant.fullName": { "source": "REPRESENTATIVE_REPORTED", "method": "IVR_DTMF", "confidence": "STATED",
                            "by": "rep:01711000001", "at": "…", "note": "read back to representative" },
    "applicant.phone":    { "source": "REPRESENTATIVE_REPORTED", "method": "IVR_DTMF", "confidence": "STATED", "by": "rep:01711000001", "at": "…" },
    "routing.office":     { "source": "SYSTEM_DERIVED", "method": "SYSTEM", "confidence": "STATED", "by": "system", "at": "…" }
  },
  "validation": { "valid": true, "missing": [], "errors": [],
                  "warnings": [{ "path": "filedBy", "code": "APPLICANT_CONFIRMATION_PENDING", "message": "…" }] },
  "routing": { "office": "DLAO-JOYPURHAT", "recommendedPriority": "NORMAL", "reasons": ["No urgency signals"],
               "advisoryOnly": true, "humanDecision": null },
  "taskIds": ["TSK-A1B2C3", "TSK-D4E5F6", "TSK-G7H8I9"],
  "audit": [ { "seq": 41, "at": "…", "actor": "system", "role": "system", "action": "session.started", "detail": {} } ],
  "version": 1, "createdAt": "…", "submittedAt": "…", "updatedAt": "…"
}
```

**Provenance sources** — the jury must be able to tell these apart:

| source | meaning | typical door |
|---|---|---|
| `APPLICANT_STATED` | applicant typed/pressed it, not yet read back | Web, USSD |
| `APPLICANT_CONFIRMED` | applicant confirmed after read-back | all (review step / "press 1 if correct") |
| `REPRESENTATIVE_REPORTED` | said by a representative (Ripon for Moyuri) — never upgraded to applicant-confirmed | Web (rep), IVR, USSD |
| `OPERATOR_ENTERED` | UDC/helpline typed it for the applicant | UDC, helpline |
| `AI_INFERRED` | speech-to-text output before confirmation | IVR voice answers |
| `SYSTEM_DERIVED` | platform-computed (caller-line id, office routing, checklist) | all |

A UDC translation stays `OPERATOR_ENTERED` (`matter.summary`); only the applicant's own words (`matter.summaryOriginal`) become `APPLICANT_CONFIRMED`.

### 2.2 `IntakeSession` (what /debug shows before submission)

```jsonc
{
  "sessionId": "SES-K3P9QZ", "channel": "USSD", "entryPoint": "*16699#", "simulated": true,
  "step": "DETAILS_CAPTURED",               // STARTED → IDENTITY_VERIFIED → DETAILS_CAPTURED → DOCUMENTS_ATTACHED → REVIEWED → SUBMITTED | ABANDONED
  "stepHistory": [{ "step": "STARTED", "at": "…" }, { "step": "IDENTITY_VERIFIED", "at": "…" }],
  "identity": { "phone": "01811000002", "method": "NETWORK_MSISDN", "verified": true, "verifiedAt": "…", "otpAttempts": 0 },
  "meta": { "msisdn": "01811000002", "lang": "en" },   // UDC: operatorId, centre · IVR: callerId
  "draft": { /* ApplicationData — same shape as record.data, filled progressively */ },
  "provenance": { /* same as record.provenance */ },
  "transcript": [ { "at": "…", "from": "SYSTEM", "text": "Which district?\n1. Dhaka …", "nodeId": "DISTRICT" },
                  { "at": "…", "from": "USER", "text": "2", "nodeId": "DISTRICT" } ],
  "applicationId": null,                   // set on submit
  "lastValidation": null,
  "audit": [ /* session-level audit; copied onto the record at submit */ ],
  "createdAt": "…", "updatedAt": "…"
}
```

### 2.3 `Task`

```jsonc
{ "taskId": "TSK-A1B2C3", "type": "ELIGIBILITY_REVIEW",   // ELIGIBILITY_REVIEW|URGENT_SAFETY_REVIEW|COMPLETE_MISSING_INFO|DOCUMENT_FOLLOW_UP|HUMAN_CALLBACK
  "applicationId": "APP-2026-30002", "sessionId": "SES-K3P9QZ",
  "assignedRole": "DLAO", "office": "DLAO-JOYPURHAT", "status": "OPEN", "priority": "NORMAL",
  "reason": "New application — eligibility decision by authorised officer",
  "dueAt": "…", "createdAt": "…", "context": {} }
```

Tasks created at submit: always `ELIGIBILITY_REVIEW`; `URGENT_SAFETY_REVIEW` if urgency flags; `COMPLETE_MISSING_INFO` if a legacy flow submitted incomplete data; `DOCUMENT_FOLLOW_UP` if documents are pending; `HUMAN_CALLBACK` (helpline) if a representative filed. IVR "0" / USSD "0" creates a `HUMAN_CALLBACK` without an application.

### 2.4 `SimMessage` and `OtpChallenge`

```jsonc
{ "msgId": "SMS-2KD9QX", "kind": "SMS_CONFIRMATION", "to": "01712345678",
  "body": "Your reference number is APP-2026-30001. Keep it safe.",   // neutral wording by default
  "sessionId": "SES-…", "applicationId": "APP-2026-30001", "simulated": true,
  "status": "SUPPRESSED_UNSAFE",           // DELIVERED | SUPPRESSED_UNSAFE (applicant refused SMS)
  "at": "…" }
{ "sessionId": "SES-…", "phone": "01712345678", "code": "481203", "expiresAt": "…", "consumed": true }
```

---

## 3. Door → JSON mapping (same fields, different capture)

| Field | Citizen wizard (`/dashboard/citizen#intake`) | IVR (`/device/ivr`, sim) | USSD (`/device/ussd`, sim) | UDC (`/dashboard/udc/intake/*`) |
|---|---|---|---|---|
| identity | SMS OTP on step 1 (`SMS_OTP`) | caller-line id (`CALLER_LINE_ID`) | SIM MSISDN (`NETWORK_MSISDN`) | `OPERATOR_ATTESTED` (applicant present) |
| filedBy.kind | self → SELF; family/neighbour → REPRESENTATIVE | SELF / REPRESENTATIVE (menu 1/2) | SELF / REPRESENTATIVE | UDC_OPERATOR (+ operatorId, centre) |
| applicant.fullName | "your name" (self) or "their name" (rep) | voice → `AI_INFERRED` → read-back | typed | typed by operator; interpreter-recorded name |
| applicant.district | district select (step 1) | keypad 1–8 | menu 1–8 | district select |
| matter.category | 6 matter cards → canonical code | keypad 1–8 | menu 1–8 | matter select → canonical code |
| matter.summary | description (step 3) | voice → read-back | ≤160 chars | Bangla translation + `summaryOriginal` (applicant's words) |
| matter.opposingParty | party name + address | — | — | — |
| urgency.flags | — | "in danger? 1/2" | "in danger? 1/2" | — |
| safeContact.* | "any time" or day + time → safeTime + window; phone; special instructions → notes | menu + keypad | menu + digits | contact route + safe time select |
| documents | uploads (sha256) + checklist → WILL_SUBMIT_LATER | checklist → WILL_SUBMIT_LATER | checklist → WILL_SUBMIT_LATER | camera captures (quality findings → qualityNote) + checklist |
| consent.method | `WEB_CHECKBOX` | `IVR_DTMF_1` | `USSD_OPTION_1` | `UDC_VERBAL_READBACK` (8 consent topics) |

Matter mapping (citizen/UDC legacy codes → canonical): family→FAMILY, land→LAND, civil→CIVIL_MONEY, criminal→CRIMINAL_DEFENCE, labour→LABOUR, other→OTHER.
Citizen safe contact: "Any time" → `safeTime: ANYTIME`; or a specific day + time → `safeContact.window = { day, time }` and `safeTime` = MORNING (<12:00) / AFTERNOON (<16:00) / EVENING.
UDC submit never blocks on gaps (applicant may have travelled far): missing fields become a `COMPLETE_MISSING_INFO` task. Citizen, IVR and USSD submit only when valid.

All district/matter/safe-time lists come from `lib/dlas/reference.ts` (keypad digit = list index + 1), so IVR "2", USSD "2" and the citizen/UDC "Joypurhat" option all store `"JOYPURHAT"`.
All doors call one validator: `lib/dlas/validate.ts`.

Required for a valid submit (every door): `identity.verified`, `applicant.fullName`, `applicant.phone` (optional when a representative files — contact then goes through them), `applicant.district`, `matter.category`, `matter.summary` (≥10 chars), `safeContact.method`, `safeContact.safeTime`, `safeContact.phone` (if CALL/SMS), `consent.dataProcessing`, `consent.method`. Representative: `filedBy.name/relation/phone`. UDC: `filedBy.operatorId`, `freeServiceNoticeAcknowledged`, `consent.readBackConfirmed`.

---

## 4. Backbone stages (from the case document)

```
ENTRY CHANNEL → APPLICATION ID → VERIFICATION / REVIEW → CASE ID → MEDIATION / LAWYER / REFERRAL → FOLLOW-UP → OUTCOME → CLOSURE
stage:  ACCESS_APPLICATION → VERIFICATION_REVIEW → CASE_OPENED → SERVICE_DELIVERY → FOLLOW_UP → OUTCOME → CLOSURE
```

Step 1 ends at `ACCESS_APPLICATION` + `status: SUBMITTED` + open `ELIGIBILITY_REVIEW` task. Step 2 (DLAO review) will move `stage` and set `routing.humanDecision` / `caseId` — by an authorised human only.

---

## 5. Route map (all endpoints) → JSON they use

| Route | Role | Reads / writes |
|---|---|---|
| `/portal/udc` | UDC sign-in | **Sign up** (name + mobile + UDC centre + district) / **Log in** (mobile only) → `dlas.db.v1.udcOperators`, current id in `dlas.udc.current`; every assisted record carries `filedBy.operatorId` |
| `/dlo` | DLAO / SCLAC / LLAC sign-in | **Sign up** (name + mobile + office + district) / **Log in** (mobile only) → `dlas.db.v1.officers`, current id in `dlas.dlao.current` |
| `/dashboard/dlo` (`#new` `#review` `#decided` `#tasks` `#app/<APP-ID>`) | officer | **Step 2** — office queue + review workspace; writes `applications[].review`, `status`, `stage`, `caseId`, `closedAt`, `tasks`, `outbox`, `audit` via `DlaoReviewService` (`lib/dlas/dlao.ts`) |
| `/` | citizen sign-in | **Sign up** (name + mobile) / **Log in** (mobile only) → `dlas.db.v1.citizens`, current id in `dlas.citizen.current` |
| `/dashboard/citizen#intake` (alias `#complaint`) | citizen / representative | **"Lodge a complaint"** — the 5-step wizard (the separate old complaint form was removed as redundant); **writes** `dlas.db.v1` at every step via `CitizenDoor` (OTP, district, draft, submit → APP-ID); also its own `rjd.intake.*` |
| `/dashboard/udc/intake/new` → `/dashboard/udc/intake/[temporaryId]` | UDC | existing new-intake + workspace; **writes** `dlas.db.v1` via `UdcDoor` (start, consents, translation, documents, submit) before the offline queue, which then reuses the same APP-ID |
| `/device`, `/device/ivr`, `/device/ussd` | caller on 16699 / basic phone | IVR & USSD simulators; **write** `dlas.db.v1` through the shared script `lib/dlas/scripted-flow.ts` |
| `/debug` | team / jury | **reads** `dlas.db.v1` (+ any localStorage key); export / import / reset |
| `/`, `/dlo`, `/lawyer`, `/admin`, `/portal/[role]` | sign-in portals | — |
| `/dashboard/[role]`, `/dashboard/{citizen,dlo,lawyer,admin}` | role dashboards | `lib/case-demo.ts` (static demo), legacy envelope |
| `/dashboard/helpline`, `/dashboard/helpline/records/[applicationId]`, `/dashboard/helpline/agent[/handoffId]` | 16699 agent | `shakkho.helpline.v1`: records, sessions, representations, verifications, handoffs, communications, audit, humanIntakes, safeContactPlans. Agent submit → **canonical ID via gateway** |
| `/helpline/calls/[sessionId]`, `/helpline/accessibility/ripon-status`, `/voice-status/[caseId]` | Ripon / voice status | `shakkho.helpline.v1`: sessions, voiceStatusSessions |
| `/dashboard/udc/**` (consent, documents, offline-queue, sync-centre, history, performance, jury-mode, status-visit, letter-access, device-and-cache, clarification-tasks, applications) | UDC | IndexedDB `shakkho.udc.v1` (offlineDrafts) + `shakkho.helpline.v1` (assistedIntakes, idMappings, syncConflicts, integrityVerifications). Offline sync → **canonical ID via gateway** |
| `/demo/nuching-offline-flow`, `/case-support/offline-origin`, `/case-support/sync-conflicts` | case support | same UDC/offline collections |
| `/dashboard/dlao/applications/[applicationId]` | DLAO | `shakkho.helpline.v1`: records, dlaoVerifications, dlaoTaskItems |
| `/referrals/**`, `/cases/[caseId]/referrals`, `/citizen/referrals/[recordId]`, `/applications/[applicationId]/sensitive-review` | DLAO / receiving DLAO | `shakkho.helpline.v1`: referrals, sensitiveEvidence, authorityDirectory, legalBasis, routingRecommendations, deliveryOperations, escalationTasks, citizenSafeStatuses; `shakkho.referrals.inbox.v1` |
| `/dlao/**` (lawyers, assignments, reassignments, inactivity-reviews, overdue-lawyer-updates, lawyer-change-requests, payment-reconciliation) | DLAO | `shakkho.helpline.v1`: panelLawyers, lawyerAssignments, caseHearings, caseProgressUpdates, requiredUpdates, lawyerChangeRequests, reassignments, inactivityPatterns, paymentReconciliations … |
| `/lawyer/**` | panel lawyer | same lawyer collections |
| `/citizen/cases/[caseId]/{status,lawyer-change}` | citizen | lawyer + status collections |
| `/admin/{authority-directory,legal-basis-registry,fee-schedules,update-requirements}` | admin | registry collections in `shakkho.helpline.v1` |
| `/sim/[[...tool]]` | demo controls | local component state only |
| `/verify/[certNumber]` | public verify | static |

Next steps move each provider module onto `dlas.db.v1` in the order of the backbone (DLAO review → case ID → mediation / lawyer / referral), reusing `IntakeGateway`-style services so everything stays one record.


---

## 6. Step 2 — Verification & eligibility (`record.review`)

```
Application received by relevant office      receive()            SUBMITTED → UNDER_REVIEW, stage VERIFICATION_REVIEW
Verify identity & NID                        checkNidRegistry()   SIMULATED — format check only (10/13/17 digits), labelled on the record
                                             verifyIdentity()     + nid: MATCHES_DOCUMENT | MISMATCH | NOT_PROVIDED (MISMATCH blocks; CONFIRMED+MISMATCH refused)
                                                                  CONFIRMED | CORRECTED (→ OFFICER_VERIFIED provenance) | DISPUTED | UNREACHABLE (→ BLOCKED, INFO_REQUESTED, HUMAN_CALLBACK task)
Verify documents & facts                     reviewFacts()        SUFFICIENT (→ review.verifiedAt, audit application.verified = VERIFIED) | NEEDS_CLARIFICATION | INSUFFICIENT (→ BLOCKED, COMPLETE_MISSING_INFO task)
                                             markDocumentReceived(), setDocumentType() (officer re-classifies an upload → OFFICER_VERIFIED provenance)
Vulnerability & eligibility (advisory)       assessEligibility()  recommendation from the JSON ruleset — exempt category first, then income band
Eligible for legal aid?  (HUMAN)             decide()             reason ≥ 10 chars, always
   Yes → Case ID DLAS-YYYY-NNNNN, status ACCEPTED, stage CASE_OPENED, applicant notified (SMS rules apply)
   No  → status REJECTED, stage CLOSURE, closedAt, all tasks closed, applicant notified
Where to send? (HUMAN, accepted cases only)  choosePathway()      GRAM_ADALAT | MEDIATION | LAWYER, reason ≥ 10 chars; recommendPathway() is advisory
   → stage SERVICE_DELIVERY, task GRAM_ADALAT_REFERRAL (GRAM_ADALAT) | MEDIATION_SCHEDULING (MEDIATOR) | LAWYER_ASSIGNMENT (DLAO), applicant notified
Record eligibility details and notes         addNote()
```

**Something missing or disputed** (`reviewFacts` → INSUFFICIENT / NEEDS_CLARIFICATION): the applicant is told **automatically** — a dashboard notification (from the open `COMPLETE_MISSING_INFO` task) plus a simulated SMS through the safe-contact rules (neutral wording / SMS-off respected; audit `applicant.info_requested`). With `requestCall: true` the officer also opens a `HUMAN_CALLBACK` task for the helpline at the applicant's safe time. Identity `UNREACHABLE` likewise sends an automatic "we tried to reach you" SMS and opens a call-back task.

An application shows **UNVERIFIED** until `review.verifiedAt` is set, i.e. the officer has checked identity + NID and the documents and case facts.

```jsonc
"review": {
  "officerId": "OFC-7K2M9Q", "officerName": "…", "office": "DLAO-JHENAIDAH", "receivedAt": "…",
  "identity":    { "state": "COMPLETED", "outcome": "CORRECTED", "method": "PHONE_CALL", "note": "…",
                   "corrections": [{ "path": "applicant.nidNumber", "from": "1234567890", "to": "1234567891" }], "attempts": 2, "at": "…",
                   "nid": { "status": "MATCHES_DOCUMENT", "formatValid": true,
                            "simulatedRegistryCheck": { "at": "…", "result": "FORMAT_OK", "note": "Simulated — … only the number format was checked" } } },
  "facts":       { "state": "COMPLETED", "items": [{ "key": "matter.summary", "label": "…", "value": "…", "status": "CORROBORATED", "note": null }],
                   "missingEvidence": [], "outcome": "SUFFICIENT", "at": "…" },
  "eligibility": { "state": "COMPLETED", "rulesetVersion": "LASP-2014-working-v1", "courtLevel": "OTHER_COURTS",
                   "declaredAnnualIncomeBdt": 250000, "incomeBand": "ABOVE_THRESHOLD", "exemptCategories": ["WOMEN_CHILD_OPPRESSION"],
                   "vulnerabilityNotes": "…", "recommendation": "ELIGIBLE_EXEMPT_CATEGORY", "reasons": ["…"], "advisoryOnly": true, "at": "…" },
  "decision":    { "decision": "ELIGIBLE", "reason": "…", "followedRecommendation": true, "by": "OFC-…", "byName": "…", "at": "…" },
  "notes":       [{ "at": "…", "by": "OFC-…", "byName": "…", "text": "…" }],
  "verifiedAt":  "…",
  "pathway":     { "type": "MEDIATION", "recommended": "MEDIATION", "recommendationReasons": ["…"], "followedRecommendation": true,
                   "reason": "…", "by": "OFC-…", "byName": "…", "at": "…" }
}
```

Officer scope: DLAO sees its district, LLAC sees labour matters of its district, SCLAC sees all.
The eligibility ruleset is a **working draft** stored in the JSON; correct it there (new version) after checking the Legal Aid Services Policy text — the UI always shows the version used.

## 7. Step 3 — Panel lawyer (`/lawyer` sign-in, `/dashboard/lawyer`)

Accounts: `db.lawyers[]` — `{ lawyerId: "LAW-XXXXXX", name, phone (login), district (panel), barEnrolmentNo, practiceAreas[], audit[] }`; session key `dlas.lawyer.current`.
Rules (editable JSON, written on first use): `db.lawyerRules` — `{ version, offerResponseHours: 48, updateDueHours: 48, missedHearingsBeforeReassign: 2, patternCases: 3, patternWindowDays: 90, maxActiveCases: 10, feeBasis }`.

```
DLAO chooses pathway LAWYER (Step 2)            → task LAWYER_ASSIGNMENT (DLAO)
Engine suggests lawyers (ADVISORY)               suggestLawyers(): district panel ranked by specialisation, availability (active cases vs maxActiveCases), recent missed hearings; previous lawyers on the case ranked last
DLAO offers the case                             DlaoLawyerService.assign()  → assignment OFFERED, LAWYER_RESPONSE task for the lawyer, SMS to lawyer (simulated); audit records the engine rank
Lawyer accepts                                   LawyerService.accept()      → ACCEPTED, access grant FULL_CASE_RECORD, client told (safe-contact rules); on a reassignment the upcoming hearings move to the new lawyer
Lawyer declines (reason) / no answer in 48 h     decline() / sweep           → DLAO task LAWYER_ASSIGNMENT / LAWYER_UPDATE_OVERDUE (OFFER_RESPONSE) — assign another
Lawyer records a hearing                         addHearing()                → hearing (assignmentId = responsible lawyer), HEARING_UPDATE_DUE (due = hearing + 48 h)
Lawyer reports                                   submitUpdate()              → hearing.result ATTENDED | MISSED (did not attend) | NOT_HELD; provenance LAWYER_REPORTED
No report by the deadline                        sweep                       → hearing counts as MISSED, DLAO alert LAWYER_UPDATE_OVERDUE (no chase call), reminder SMS to the lawyer
Missed ≥ missedHearingsBeforeReassign on a case  submitUpdate() / sweep      → DLAO task LAWYER_REASSIGN_REVIEW "assign another lawyer" (human decision)
DLAO reassigns                                   DlaoLawyerService.withdraw()→ WITHDRAWN, old lawyer's access revoked, payment frozen PENDING_CASE_COMPLETION, new LAWYER_ASSIGNMENT task
Missed hearings on ≥ patternCases cases (90 d)   sweep                       → separate LAWYER_INACTIVITY_REVIEW (T1 pattern — review only, not a finding)
DLAO completes representation                    DlaoLawyerService.complete()→ stage OUTCOME; every assignment's payment → DLAO_REVIEW with the attended-hearing count
```

```jsonc
"lawyer": {
  "assignments": [{ "assignmentId": "ASN-…", "lawyerId": "LAW-…", "lawyerName": "…", "status": "OFFERED|ACCEPTED|DECLINED|WITHDRAWN|COMPLETED",
                    "offeredAt": "…", "offeredBy": "OFC-…", "offeredByName": "…", "note": "…", "respondBy": "…", "respondedAt": "…",
                    "declineReason": null, "responseOverdueFlaggedAt": null, "handoverFrom": "ASN-… (previous)", "reassignFlaggedAt": null,
                    "ledger":  { "hearingsAttended": 1, "hearingsMissed": 2, "hearingsNotHeld": 0, "hearingsUnreported": 0, "updatesOnTime": 0, "updatesLate": 2, "updatedAt": "…" },
                    "payment": { "status": "ACCRUING|PENDING_CASE_COMPLETION|DLAO_REVIEW", "payableHearings": 1,
                                 "completedStages": [{ "hearingId": "HRG-…", "at": "…", "result": "ATTENDED" }],
                                 "missedHearings": 2, "eligibleAmount": "DEMO_RATE", "note": "…", "at": "…" } }],
  "hearings":    [{ "hearingId": "HRG-…", "assignmentId": "ASN-…", "result": "ATTENDED|MISSED|NOT_HELD|null", "at": "…", "court": "…",
                    "purpose": null, "addedBy": "LAW-…", "addedAt": "…", "updateDueAt": "…", "updateId": null, "overdueFlaggedAt": null, "clientNotifiedAt": null }],
  "updates":     [{ "updateId": "UPD-…", "hearingId": "HRG-…", "attendance": "ATTENDED|NOT_ATTENDED|NOT_HELD",
                    "outcome": "ADJOURNED|HEARD|ORDER_PASSED|JUDGMENT|SETTLED|OTHER", "nextDate": null, "note": "…", "by": "LAW-…", "byName": "…", "at": "…", "late": false }],
  "access":      [{ "lawyerId": "LAW-…", "lawyerName": "…", "assignmentId": "ASN-…", "scope": "FULL_CASE_RECORD", "grantedAt": "…", "revokedAt": null, "revokeReason": null }],
  "completion":  { "outcome": "JUDGMENT|SETTLED|WITHDRAWN_BY_CLIENT|OTHER", "reason": "…", "by": "OFC-…", "byName": "…", "at": "…" }
}
```

### 7.1 Engine shortlist, auto-cascade, daily attendance

```
DLAO clicks "Assign lawyer"        DlaoLawyerService.createShortlist() → lawyer.shortlists[] (top rules.shortlistSize = 5)
   score (0–100) = workload 35 × (1 − active/maxActiveCases) + win rate 30 × win% + attendance 25 × present% (0 if absent today) + specialisation 10
   (no record yet for win% / attendance = neutral 50 %; lawyers who already declined / expired / were removed on this case are left out)
DLAO picks one of the 5            assign()  → offer (offeredVia DLAO_CHOICE), lawyer notified (Case intake + SMS)
Lawyer accepts                     → shortlist ACCEPTED, candidate ACCEPTED
Lawyer declines (reason ≥ 10)      → candidate DECLINED + reason → engine offers the next PENDING candidate (offeredVia AUTO_NEXT), no DLAO step
No answer by respondBy             sweep → assignment EXPIRED, candidate NO_RESPONSE → next candidate (AUTO_NEXT)
All 5 declined / no answer         → shortlist EXHAUSTED, DLAO task LAWYER_ASSIGNMENT "ask the engine for a new shortlist"
Lawyer registers attendance        LawyerAuth.markAttendance(PRESENT|ABSENT) → lawyers[].attendance[{ date, status, at }] (one per day, changes audited)
DLAO completes representation      outcome WON | LOST | SETTLED | WITHDRAWN_BY_CLIENT | OTHER → feeds each lawyer's win %
```

```jsonc
"shortlists": [{ "shortlistId": "SHL-…", "createdAt": "…", "by": "OFC-…", "byName": "…", "rulesVersion": "LAWYER-RULES-demo-v1",
                 "status": "ACTIVE|ACCEPTED|EXHAUSTED|CANCELLED",
                 "candidates": [{ "lawyerId": "LAW-…", "name": "…", "rank": 1, "score": 72.5,
                                  "breakdown": { "workload": 35, "winRate": 15, "attendance": 12.5, "specialisation": 10 },
                                  "stats": { "activeCases": 0, "capacity": 10, "won": 0, "lost": 0, "winPct": null, "presentDays": 0, "absentDays": 0,
                                             "attendancePct": null, "absentToday": false, "matchesMatter": true },
                                  "outcome": "PENDING|OFFERED|ACCEPTED|DECLINED|NO_RESPONSE", "reason": null, "offeredAt": null }] }]
```
Lawyer dashboard: today's attendance (Present / Absent + last 14 days), Case intake (offers with case details; client identity/contact and files open only after acceptance), My cases (expandable list with every detail), Notifications (derived from the record; `lawyers[].notificationsReadAt`), Attendance history, Hearing reports, Calendar.

### 7.2 DLAO lawyer monitoring (`/dashboard/dlo#lawyers`, `#lawyer/<LAW-ID>`)

Read model `useDistrictLawyers()` (lib/dlas/lawyer-monitor.ts): every lawyer on the officer's district panel (SCLAC: all) with today's attendance, 30-day attendance, active cases vs capacity, won/lost, missed hearings (90 d), overdue reports, open offers, last report, and each case's next hearing and latest update; plus a feed of the latest hearing reports. Most urgent lawyers first.

```
DLAO logs a call (made from their phone)   DlaoLawyerMonitor.logCall()        → contacts[] CALL (REACHED | NO_ANSWER | WRONG_NUMBER)
DLAO summons the lawyer                    DlaoLawyerMonitor.summon()         → contacts[] SUMMONS (appearAt, place, reason) status SENT, SMS (simulated)
Lawyer acknowledges                        LawyerContactService.acknowledge() → ACKNOWLEDGED
DLAO records the result                    DlaoLawyerMonitor.resolveSummons() → ATTENDED | MISSED
DLAO sends a reminder / message            DlaoLawyerMonitor.remind()         → contacts[] REMINDER, SMS (simulated)
```
`lawyers[].contacts[]`: `{ contactId: "CON-…", kind, at, by, byName, applicationId, note, callOutcome, appearAt, place, status: LOGGED|SENT|ACKNOWLEDGED|ATTENDED|MISSED, acknowledgedAt, resolvedAt, resolutionNote }` — audited on the lawyer and, when tied to a case, on the case. The lawyer sees summons (red banner on Overview + Acknowledge), messages and missed calls in Notifications.

Access: an offered lawyer sees only the case summary and the officer's note; the full record (client, safe-contact rules, documents, all earlier hearings and reports) opens only while an access grant is active, and every lawyer action checks it. A new lawyer sees the previous lawyer's hearings read-only and cannot report on them.
The deadline sweep runs while the DLAO or lawyer workspace is open (on every record change and once a minute) and writes only on new alerts. The citizen sees "Panel lawyer assigned" (each lawyer), each hearing date, and — before travelling — "No lawyer report for the … hearing" when a report is overdue (A5).

### 7.3 Red flag — too many declined offers

| What | JSON |
|---|---|
| Rule | `lawyerRules.declinesBeforeRedFlag` (default **8**) |
| Counted | `assignments[]` with `lawyerId = X`, `status = "DECLINED"` and `respondedAt` after the lawyer's last **cleared** flag (`countedDeclines`) |
| Raised (on the 8th decline, once) | `lawyers[].redFlags[] += {flagId, reason: "DECLINED_OFFERS", raisedAt, threshold, declines[{applicationId, caseId, assignmentId, at, reason}], status: "ACTIVE"}`; `LAWYER_RED_FLAG` DLAO task; simulated SMS to the lawyer; `lawyer.red_flagged` audit entries on the lawyer and the case |
| Effect (advisory) | The lawyer stays on the panel. The engine lists red-flagged lawyers after all others (`stats.redFlagged`, `stats.declines` on shortlist candidates). The DLAO can still choose them |
| Cleared by a human | `DlaoLawyerMonitor.clearRedFlag(lawyerId, note ≥ 10 chars)` → `status: "CLEARED"`, `clearedAt/By/ByName`, `clearNote`; closes the task; `lawyer.red_flag_cleared` audit entry; SMS to the lawyer. New declines count from `clearedAt` |
| Screens | DLO `#lawyers`: "Red-flagged" stat and 🚩 tag, plus "Declined n/8" once a lawyer is 2 away from the limit. DLO `#lawyer/<id>`: every declined offer with its reason, and the clear form. DLO shortlist: 🚩 tag. Lawyer overview and intake: warning at limit − 2, red banner when flagged; the decline form shows "This will be decline n of 8" |

## 8. DLO office staff (`/dlo-stuff`) — story pre-check

Staff work inside a District Legal Aid Office. They see only the office's **incoming** cases and can only check the **story**. They cannot see documents, NID, phone or safe-contact details, the officer's review or any decision.

| What | JSON |
|---|---|
| Accounts (sign-up / login by phone, one office district) | `db.officeStaff[]` → `{staffId, name, phone, district, createdAt, lastLoginAt, audit[]}`; session key `localStorage["dlas.staff.current"]` |
| Incoming list | `applications` where `data.applicant.district === staff.district`, `!review.decision`, status `SUBMITTED` / `UNDER_REVIEW` / `INFO_REQUESTED` |
| Read model | `StaffCaseView`: story fields only (summary, category, other party, incident date, urgency flags, filed-by). No documents, NID or contact details |
| Story check | `application.staffCheck = {outcome: STORY_VERIFIED \| NEEDS_CLARIFICATION, items[{key, answer: YES\|NO\|UNSURE}], note, by, byName, at, history[]}` |
| Rule | All four answers YES → `STORY_VERIFIED`; anything else → `NEEDS_CLARIFICATION`, and a note of at least 10 characters is required |
| Audit | `application.audit[]` gets `staff.story_checked` with role `dlo_staff` and `advisoryOnly: true` |

The check is **advisory**. It does not change `status` or `review`. The officer sees it as "Staff pre-check" in the `/dashboard/dlo` queue and as a banner on the review page, and still does the identity, fact and document verification and makes the decision.

## 9. Mediator registry (Feature 1) — `/dashboard/dlo#mediators`

Mediators are **not** panel lawyers. They have their own record, their own service (`lib/dlas/mediators.ts`) and their own screen. No assignment happens in the registry.

| What | JSON |
|---|---|
| Registry | `db.mediators[]` → `MediatorRecord` |
| Identity | `mediatorId` (MED-XXXXXX), `name`, `role` (LEGAL_AID_OFFICER / PANEL_MEDIATOR / COMMUNITY_MEDIATOR) |
| Status | `status` ACTIVE / INACTIVE / SUSPENDED / PENDING_VERIFICATION, plus `statusReason` and `statusChangedAt`. New registrations are always PENDING_VERIFICATION. ACTIVE requires a valid, officer-verified certification. Every change needs a reason (at least 10 characters) |
| Qualification | `qualification {kind, detail}` |
| Certification / training | `certification {status CERTIFIED / TRAINING_COMPLETED / IN_TRAINING / NOT_TRAINED, body, certificateNo, issuedOn, validUntil, verifiedBy, verifiedByName, verifiedAt}`. Editing the certificate resets verification. The derived `certificationState()` is VALID / EXPIRED / UNVERIFIED / NOT_QUALIFYING |
| Experience | `experience {years, mediationsConducted, settled, note}` |
| Scope | `caseTypes[]` (13 mediation case types, each tagged pre-litigation or court-referred), `tracks[]` (PRE_LITIGATION / COURT_REFERRED), `district`, `operationalAreas[]`, `languages[]` |
| Availability | `availability {status AVAILABLE / LIMITED / UNAVAILABLE, days[], channels[] PHYSICAL / VOICE / ONLINE, maxActiveMatters, unavailableUntil, note, updatedAt}` |
| Current workload | `workload {activeMatters, basis: SAMPLE / RECORDED / RECORDS}`. The number is entered by hand until assignment exists; Feature 3 computes it from assignments (`basis: RECORDS`) |
| Conflict declarations | `conflicts[] {conflictId, kind, source MEDIATOR_DECLARED / OFFICER_RECORDED, partyName, applicationId, area, detail, status ACTIVE / WITHDRAWN, withdrawnReason}` |
| Administrative record | `adminRecord[] {kind NOTE / TRAINING / COMPLAINT / COMMENDATION / STATUS_CHANGE / VERIFICATION / AVAILABILITY / PROFILE, text, by, at}` |
| Contact | `contact {phone, email, preferredChannel, office}` |
| Sample data | `sample: true`, loaded only on request ("Load sample mediators") and labelled SAMPLE everywhere as illustrative, not real people. Removable. Real registrations are never deleted |
| Audit | `audit[]`: mediator.registered, .updated, .certification_verified, .status_changed, .availability_set, .conflict_declared, .conflict_withdrawn, .record_added, .sample_loaded |
| Access | A DLAO officer sees and edits their own district's mediators; SCLAC sees all |
| Link to future assignment | `assignmentReadiness(m)` runs the hard filters that don't depend on a case: status → certification → availability → capacity → scope. Feature 3 adds the case-specific filters (district, case type, track, conflicts matched against the case's parties, locality and case ID), then ranks by experience, relevant experience, workload, availability and record. The system recommends and the officer confirms |

## 10. Legal pathway classification (Feature 2) — Step 2 "Legal pathway"

**Rule:** the system recommends; the authorised officer reviews and then confirms or changes; the system records the decision. The system never finalises a pathway.

| What | JSON / code |
|---|---|
| Rule table (data, not UI) | `DEFAULT_PATHWAY_RULES` in `lib/dlas/pathway-rules.ts`. An install can override it with `db.pathwayRules` (same shape), and `pathwayRulesOf(db)` picks the one in force. It holds: `version`, `mandatoryPreCaseDistricts` (currently `"ALL"` — set to the districts where mandatory pre-case mediation is notified), `subcategories` per matter category, and `rules[]` `{ruleId, enabled, when {categories, subcategories, subcategoryMissing, urgencyAny, courtStatus, mandatoryDistrictOnly}, result, title, basis, law, track, referralTarget, expectedDocs}`. The first enabled rule that matches wins |
| Classifier | `classifyPathway(record, inputs, rules)`. It is pure and deterministic, and reads structured fields only: category, subcategory, court status, district, urgency flags, the other party and the attached documents. No AI and no free-text inference |
| Pathway statuses | MANDATORY_PRE_CASE_MEDIATION · MEDIATION_AVAILABLE · COURT_REFERRED_MEDIATION · LAWYER_ASSISTANCE · URGENT_ESCALATION · OTHER_REFERRAL · REQUIRES_OFFICER_REVIEW (can never be final) |
| Officer-entered facts | `application.pathwayClassification.inputs {subcategory, courtStatus UNKNOWN/NONE/FILED_PENDING/REFERRED_FOR_MEDIATION/DECIDED/APPEAL, courtName, courtCaseNo, referralDate, setBy, setAt}`. Provenance is `OFFICER_ENTERED` |
| System assessments | `.assessments[] {assessmentId, at, rulesVersion, result, ruleId, matched[], warnings[], evidence[], inputs snapshot}`, recorded whenever the result or inputs change |
| Officer decisions | `.decisions[] {decisionId, action CONFIRMED / CHANGED / INFO_REQUESTED, assessmentId, systemClassification, previousSystemClassification, previousFinal, finalPathway, referralTarget, reason, by, byName, at}` |
| Final pathway | `.final {status, referralTarget, decisionId, by, byName, at}`. Only Confirm or Change sets it. It also writes `review.pathway` through `commitPathway()`, so the downstream task starts as before: MEDIATION_SCHEDULING, the lawyer engine, GRAM_ADALAT_REFERRAL, or EXTERNAL_REFERRAL. URGENT_ESCALATION also opens an URGENT_SAFETY_REVIEW task. `review.pathway.followedRecommendation` is true only when the officer confirmed |
| Request more information | Creates a COMPLETE_MISSING_INFO task, optionally sends a safe SMS (simulated), and is recorded as INFO_REQUESTED |
| Audit | pathway.inputs_recorded, pathway.system_assessed (`advisoryOnly`), pathway.officer_confirmed / .officer_changed, pathway.info_requested, pathway.chosen |
| Legal basis shown to the officer (to verify) | Legal Aid Services Act 2000 s.21A (court-referred) and s.21B (pre-case). The Legal Aid Services (Amendment) Ordinance 2025 makes pre-case mediation mandatory for listed laws: Family Courts Act 2023 s.5, Dowry Prohibition Act 2018 ss.3–4, House Rent Control Act 1991, SAT Act 1950 s.96, Non-Agricultural Tenancy Act 1949 s.24, Parents Maintenance Act 2013 s.8, and partition suits. It is being rolled out district by district. Excluded: Nari o Shishu Nirjatan Daman Ain s.11(g) and NI Act s.138 |

## 11. Mediator assignment (Feature 3) — separate from panel lawyers

| What | JSON / code |
|---|---|
| Matter | `application.mediation {openedAt, pathwayStatus, track PRE_LITIGATION / COURT_REFERRED, caseType, caseTypeSource MAPPED / OFFICER_SET, assignmentStatus, runs[], assignments[]}`. It is opened when the officer confirms a mediation pathway, which also creates a MEDIATOR_ASSIGNMENT task |
| Case type | Taken from the pathway subcategory through `MEDIATION_CASE_TYPE_MAP` (data); the officer can correct it |
| Hard filters | 1 STATUS active · 2 CERTIFICATION valid and verified · 3 JURISDICTION (same district and the mediator takes this track) · 4 AVAILABILITY (not unavailable and under capacity) · 5 CONFLICT (no active declaration matching the case ID, a party name or the applicant's locality; also excludes a mediator already removed from this case) · 6 CASE_TYPE handled |
| Suitability facts (no score, no "best") | relevant experience HIGH / MEDIUM / LOW, current workload (recorded baseline plus matters assigned here), availability (days and channels), area match, administrative record (complaints and commendations). The officer can sort by name, workload or experience |
| Eligibility runs | `runs[] {runId, at, by, caseType, track, district, candidates[] {mediatorId, eligible, checks[], conflictIds[], considerations}}` |
| Assignments | `assignments[] {assignmentId, mediatorId, runId, status AWAITING_OFFICER_CONFIRMATION / ASSIGNED / WITHDRAWN / REASSIGNMENT_REQUESTED / COMPLETED, recommendedBy/At/Note, conflictCheck {at, clear, conflictIds}, assignedBy/At/ByName, reason, accessGrantedAt, accessRevokedAt, endedAt, endReason}` |
| Matter status | PENDING → RECOMMENDED (a run found eligible mediators) → AWAITING_OFFICER_CONFIRMATION (officer recommended one) → ASSIGNED (officer confirmed with a reason; conflict re-checked) → REASSIGNMENT_REQUESTED (access revoked, MEDIATOR_REASSIGNMENT task) → … → COMPLETED |
| Conflict | Recommending or confirming a conflicted mediator is refused ("CONFLICT DETECTED"). If a matching conflict is declared after assignment, the panel shows CONFLICT DETECTED and requires reassignment |
| Side effects on confirm | Case-based access granted; the MEDIATION_SCHEDULING task is assigned to the mediator; simulated SMS to the mediator and a neutral SMS to the applicant; `mediator.assigned_to_case` recorded on the mediator's audit |
| Audit | mediation.matter_opened, .case_type_set, .eligibility_checked (`advisoryOnly`), .mediator_recommended, .conflict_detected, .mediator_assigned, .recommendation_withdrawn, .reassignment_requested, .assignment_completed |

## 12. Mediation workspace (Feature 4) — `/mediator` (sign-in) · `/dashboard/mediator`

| What | JSON / code |
|---|---|
| Mediator account | The registry record itself (`db.mediators[]`). Login is by phone; session key `localStorage["dlas.mediator.current"]`. Self-registration at `/mediator` creates a PENDING_VERIFICATION record that the officer verifies (Feature 1). A mediator only receives cases once ACTIVE |
| Case-based access | A mediator can open a case only while their `mediation.assignments[]` entry is ASSIGNED and `accessRevokedAt` is null. This is checked on every read and every write |
| Need-to-know view | `useMediatorCase()` → `MediatorCaseView`: case ID, dispute type and subcategory, stage, pathway, mandatory / court-referred, court reference, created date, officer, who assigned the mediator; applicant name, identity-verified yes/no, contact method and window, neutral-wording and SMS flags, representation, language, accessibility; opposing party name; documents excluding the NID, marked verified / received / pending, relevant to this dispute, restricted, downloadable. **Not exposed:** NID, phone numbers, address, income and eligibility, officer notes, staff checks |
| Workspace | `application.mediation.workspace {openedAt, access {channel, connectivity, language, interpreter, accessibilityNotes}, respondent {contactPreference, representation, representativeName, verification}, sessions[], caucus[], settlement[], outcomes[]}` |
| Sessions | `{sessionId, number, channel PHYSICAL / VOICE / ONLINE (online is simulated), scheduledFor, place, status SCHEDULED / IN_PROGRESS / PAUSED / COMPLETED, startedAt, endedAt, pauses[], attendance {APPLICANT, RESPONDENT: {status UNRECORDED / PRESENT / ABSENT / REPRESENTED, mode, at}}}`. A session cannot end until both parties' attendance is recorded. Scheduling closes the MEDIATION_SCHEDULING task and sends a safe SMS to the applicant (simulated) |
| Private caucus | `caucus[] {noteId, side APPLICANT / RESPONDENT, sessionId, text, at, by}`. **Confidential**: shown only in the mediator workspace. The audit records `mediation.caucus_note_added {side, confidential: true}`, never the text |
| Settlement discussion | `settlement[] {itemId, list ISSUES / DISCUSSION / PROPOSED / AGREED / OUTSTANDING, text, status ACTIVE / WITHDRAWN, history[]}`. Entered by the mediator only; there is no AI and no generated terms or amounts. Every edit and move is kept in the item's history |
| Outcome | `outcomes[] {kind SETTLEMENT_REACHED / MEDIATION_FAILED / NEEDS_FOLLOW_UP / ADJOURNED, note, agreedTerms[], outstanding[], failure {reason, recommendedNext}, followUpBy, nextSession, legalStatus}`. It is an explicit mediator action and needs at least one completed session. **Settlement** needs at least one agreed term and both parties present or represented; `legalStatus` becomes AWAITING_SIGNATURES_AND_CERTIFICATION, never "final"; a MEDIATION_OUTCOME_REVIEW task goes to the DLAO. **Failed** creates a failure record and a HIGH-priority MEDIATION_OUTCOME_REVIEW task (the officer chooses the next pathway). **Follow-up** creates a MEDIATION_FOLLOW_UP task for the mediator. **Adjourn** schedules the next session. After a settlement or a failure the workspace becomes read-only |
| Workspace status | NOT_SCHEDULED / SCHEDULED / IN_PROGRESS / PAUSED / AWAITING_OUTCOME / OUTCOME_RECORDED (`workspaceStatus()`) |
| Audit (role `mediator`) | mediation.workspace_opened (at most once per 30 minutes), .session_scheduled / _rescheduled / _started / _paused / _resumed / _ended, .attendance_applicant / _respondent, .caucus_note_added, .settlement_updated {op, list}, .outcome_recorded, .document_viewed / _downloaded, .access_updated, .respondent_updated |

## 13. Multi-channel mediation (Feature 5) — the channel is transport; the mediator owns the process

| What | JSON / code |
|---|---|
| Channel per session | `sessions[].channel` PHYSICAL / VOICE / ONLINE, chosen in "MEDIATION CHANNEL" when scheduling. Physical sessions add `place` (location) and `room` |
| Transport (simulated) | `sessions[].transport {voice, online, checkIn, fallbacks[], log[]}`. **No telephony or video service is connected.** Sessions created before Feature 5 get an empty transport (`transportOf()`) |
| Voice | `voice.APPLICANT / RESPONDENT {state IDLE → INITIATED → CONNECTED / NO_ANSWER → ENDED, attempts, initiatedAt, connectedAt, endedAt}`. The transitions are enforced (you cannot connect a call that was never initiated). The system dials under the safe-contact rules, so the mediator never sees the number; the audit entry carries the applicant's safe-contact method and time |
| Online (simulated room) | `online {roomId, participants APPLICANT / RESPONDENT / MEDIATOR {state NOT_JOINED / CONNECTED / WEAK / DISCONNECTED}}`. The mediator joins when the session starts; the other states are set with the simulator. The session timer counts elapsed time minus pauses |
| Physical | location, room, scheduled time, `checkIn` per party ("arrived at venue"), attendance |
| Mediator-owned process | Start, pause / resume, end, attendance, caucus, settlement discussion and outcome are the same controls for every channel. Transport actions never change session status |
| Limited connectivity | `connectivityLimited(ws, session)` is true when the mediator recorded connectivity as LIMITED, or when an online participant is WEAK or DISCONNECTED. It shows **LIMITED CONNECTIVITY** in the workspace header and a bar with the **voice / physical fallback** buttons. Scheduling online with limited connectivity is allowed, with a warning |
| Fallback | `MediationWorkspaceService.switchChannel(to, reason, place?, room?)` → `transport.fallbacks[] {from, to, reason, at}`. The session keeps its status, attendance, caucus notes and settlement items; the mediation is never blocked. If the session has not started yet, the applicant is sent a safe SMS about the new channel (simulated) |
| Audit | mediation.voice_call {side, state, attempt}, mediation.online_connection {who, state}, mediation.venue_check_in {side}, mediation.channel_switched {from, to, reason, sessionStatus}; all transport entries carry `simulated: true` |
## Mediation origin, confidential notes, and authority notifications

`pathwayClassification.inputs` may contain the court referral metadata used by the shared mediation engine. `application.mediation.origin` is the explicit four-value origin while `track` remains the two-value mediator eligibility dimension.

`application.mediation.workspace.mediatorConfidential.caucusNotes` is a private mediator-only partition. Public and officer read models must remove both this property and the legacy `workspace.caucus` migration source. Audit rows record caucus-note creation without the note body.

`application.mediation.authorityNotifications[]` records a certified settlement outcome or confirmed failure return that must be reported to the referring authority. `PENDING_DISPATCH` becomes `DEMO_RECORDED` only through an authenticated officer action with a dispatch reference. It does not represent actual electronic delivery.

Sensitive mediation audit rows include `actor`, `role`, `caseId`, `action`, and `at`. `DlaoOfficerAccount.authorityRole` distinguishes Legal Aid Officer from Chief Legal Aid Officer without changing the existing officer login record or storage key.

## 14. Mediator privacy / role-based access (Feature 9) — need-to-know, audited

| What | JSON / code |
|---|---|
| Role scopes | `MEDIATION_ROLE_SCOPES` (`lib/dlas/mediation-access.ts`) for CITIZEN, LEGAL_AID_OFFICER, CHIEF_LEGAL_AID_OFFICER, MEDIATOR, PANEL_LAWYER and DBLA_ADMIN; checked with `canAccessMediationScope(role, scope)`. Only MEDIATOR holds `MEDIATOR_CONFIDENTIAL_NOTES`; only CLO and DBLA_ADMIN hold `DISTRICT_MONITORING`; only CLO holds `AGREEMENT_CERTIFICATION` |
| Case-level access | Mediator: `mediatorCanAccessCase` (ASSIGNED and not revoked; the existing need-to-know view in `/mediator`). Officer / CLO: `officerCanAccessApplication` (own office; SCLAC sees all) |
| PUBLIC CASE RECORD (officer / CLO) | `officerMediationRecord(a)` in `lib/dlas/mediation-oversight.ts`, built on `publicMediationWorkspace()`: status, mediator, sessions (channel, place, attendance, fallback count), outcomes, settlement {agreementId, status, certifiedBy/At}, failure {recordId, status}, mediation audit rows. Caucus content is never included; only `confidentialNoteCount` |
| MEDIATOR CONFIDENTIAL NOTES | `workspace.mediatorConfidential.caucusNotes`; readable only in the mediator workspace. The officer panel shows a locked block with the count and "not accessible to your role" |
| Sensitive-view audit | `MediationAccessLog.recordView(applicationId, surface)` → case audit `mediation.record_viewed` {officer, authorityRole, surface, confidentialNotesExcluded: true}, role `dlao` / `clo`, with `caseId`. Deduplicated per officer, case and surface for 30 minutes |
| Audit row shape | `auditRow(e, a)` → User · Role · Case · Action · Timestamp for every entry. `mediatorAudit` (mediator registry) and `staff.story_checked` now carry `caseId` |
| UI | `/dashboard/dlo#app/<id>` Legal pathway step → **MEDIATION RECORD — officer view** (scope chips, PUBLIC CASE RECORD, locked confidential block, audit table). `/dashboard/dlo#mediation-monitor` → **District mediation monitor**, CLO only (sidebar item hidden for others; a direct link shows "Access restricted"): stage counts, sessions this week by channel, limited connectivity, fallbacks, overdue mediation and settlement tasks, mediator workload, latest 40 audit rows |

## 15. Legal Aid Office control center (Feature 10) — `/dashboard/dlo#overview`

| What | JSON / code |
|---|---|
| Read model | `lib/dlas/office-control.ts` → `classifyCase(a, tasks, officer, now)` (pure) and `useOfficeControl()`. It only reads the shared record: `status`, `review`, `validation.missing`, `pathwayClassification` (latest assessment / final), `review.pathway`, `mediation` (assignmentStatus, workspace sessions, settlementWorkflow, failureRecord, authorityNotifications), open `tasks[]`, `routing` priority and `audit[]`. It writes nothing |
| Status per case | INTAKE: NEW, PENDING_VERIFICATION, INCOMPLETE (info requested, required fields missing, or a blocked check). PATHWAY: AWAITING_CLASSIFICATION, MANDATORY_AWAITING_CONFIRMATION, MEDIATION_AVAILABLE, LAWYER_PATHWAY. MEDIATION: ASSIGNMENT_PENDING, AWAITING_OFFICER_CONFIRMATION, AWAITING_SCHEDULE, SCHEDULED, IN_PROGRESS, AWAITING_OUTCOME / OUTCOME_REVIEW, SETTLEMENT_EXECUTION, AGREEMENT_AWAITING_CERTIFICATION, FAILED, REFERRAL_PENDING, RESOLVED. Other: REFERRED, REJECTED. Urgent = the officer's priority decision (or the recommended priority) is URGENT, or the final pathway is URGENT_ESCALATION |
| Next action | `{action, label, href}` plus `owner` OFFICER / CLO / MEDIATOR / PARTY / LAWYER. The href opens the workflow that owns the change: `#app/<id>` (verification, pathway, mediator assignment, mediation record), `/dashboard/dlo/settlements/<id>` (CLO: review and certify), `/dashboard/dlo/mediation-outcomes/<id>` (failure and referral review). Scheduling stays with the mediator, so the officer's action is a follow-up |
| Deadline | The earliest of the case's open task `dueAt` and its next scheduled session time → OVERDUE / DUE_SOON (≤ 48 h) / LATER |
| UI | `components/dlao/office-control.tsx`, inserted into the existing overview between the summary tiles and the analytics: **Needs your attention now** (owner = you or overdue; urgent, then overdue, then deadline); lanes for Intake, Pathway, Mediation and Deadlines (upcoming 7 days, overdue mediation, awaiting certification, follow-ups due in 48 h); each stage filters the **case table** (Case ID · Applicant · Dispute type · Pathway · Mediator · Status · Last action · Next action · Deadline · Quick action) |

## 16. Mediation audit trail (Feature 11) — WHO · WHAT · WHEN · CASE · STATUS, append-only

| What | JSON / code |
|---|---|
| Entry | `AuditEntry {seq, at (WHEN), actor + role + detail.officer/mediator (WHO), action (WHAT), caseId (CASE), status (STATUS), detail}`. `status = {application, stage, pathway, mediation}` is the case status right after the action. It is stamped by the store on every new application audit row (`lib/dlas/audit-trail.ts` → `statusSnapshot`), so no service can forget it. Rows written before Feature 11 have no status and are shown as "status not recorded" |
| Append-only | `store.mutate()` fingerprints every `audit[]` in the DB before the mutator runs. `sealAuditHistory()` then rejects the whole write (`AuditTamperError`, nothing saved) if any earlier entry was changed, removed or reordered. The only exception is removing a whole illustrative sample record (`sample: true`, e.g. sample mediators). No screen has edit or delete controls. Limitation: this is a browser prototype, so someone with devtools can still rewrite localStorage directly; a server store would enforce the same rule on its side |
| Refused action still audited | A conflict of interest found at mediator confirmation now saves `mediation.conflict_detected` (and the failed conflict check) before the confirmation is refused |
| New events | `mediation.caucus_opened` {side, sessionId} (the first note per side per session; never the content). `settlement.submitted_for_certification` {agreementId, to: CHIEF_LEGAL_AID_OFFICER} (written when the mediator confirms) |
| Rendering | `describeAudit(e, a)` returns an actor label (Legal Aid Officer / CLO / Mediator / Applicant / System …) and a plain-language sentence. System-generated steps (pathway classification, eligible mediator list, conflict detection, SMS, tasks) show as **System** with "run by <person>". `caseActivity(a)` returns them oldest first |
| UI | `/dashboard/dlo#app/<id>` → **ACTIVITY / AUDIT TRAIL** (`components/dlao/case-activity.tsx`), full width under the case steps. Grouped by day, `HH:MM — Who · name`, then the sentence, case ID, status after, #seq and expandable details. Filters: Key events, All, Intake & verification, Pathway, Mediation, Settlement / failure, Lawyer. Read-only |

## 17. End-to-end mediation demo (Feature 12) — `/demo/mediation`

| What | JSON / code |
|---|---|
| Lifecycle read model | `lib/dlas/mediation-lifecycle.ts` → `mediationLifecycle(a, tasks, expected?)`. It is derived only from the record, audit and tasks, and works for every mediation case. Each stage has a lane (CITIZEN, SYSTEM, OFFICER, MEDIATOR, PARTY, CLO, LAWYER, DBLA), a state (DONE, CURRENT, UPCOMING), a checkpoint (SYSTEM SUGGESTION, OFFICER REVIEW REQUIRED → OFFICER CONFIRMED, MEDIATOR ACTION, PARTY ACTION, CLO CERTIFICATION REQUIRED → CLO CERTIFIED, LAWYER ACTION, COMPLETED, OVERSIGHT), who and when from the audit, supporting facts, and the real screen that owns it. After the session the case branches: SETTLEMENT (settlement → execution → mediator confirmation → CLO → resolved → follow-up) or FAILURE (failure record → officer review → legal pathway → shortlist → officer offer → panel lawyer accepts) |
| Demo runner | `lib/dlas/mediation-demo.ts` → `runDemoStep(caseKey, note?, newRun?)` performs the CURRENT stage through the real service, signed in as the fictional demo account that owns it (citizen, Legal Aid Officer, sample mediator, CLO, panel lawyer). It then restores whoever was signed in. Human steps record the reason shown and edited in the UI. `signInForDemo(role)` lets a judge open the real screen as that role. Because the runner reads the stage from the record, a step done in the real screen is picked up. A new run files new applications; nothing is deleted (the audit is append-only) |
| Demo data | District JHENAIDAH. Fictional people marked "(demo)"; phones in the 01300-0000xx block; sample mediators come from the existing sample loader (labelled SAMPLE). Case A: spousal maintenance → settlement. Case B: inherited land partition → failure → panel lawyer. Only SMS, OTP delivery and party signatures are simulated |
| Follow-up | `SettlementFollowUpService.complete(applicationId, taskId, note)`: the officer records a CLO-required `SETTLEMENT_FOLLOW_UP` as done. Audit: `settlement.follow_up_completed` {kind, note, remaining} |
| UI | `/demo/mediation`: a role strip (Technology, Mediator, Legal Aid Officer, CLO, Panel lawyer, DBLA), case tabs, a NEXT STEP card (checkpoint badge, the reason to be recorded, "Decide as …" / "Run: System" / "Do it in the real screen instead") and the lifecycle timeline. The same timeline appears in the officer's case details (`/dashboard/dlo#app/<id>`, above the audit trail) and feeds the DBLA view `/dashboard/admin#mediation` (all districts, read-only: current stage, checkpoint, progress, what each case is waiting on) |

## 18. DLAO ↔ DLAO transfer, district register, citizen-urgent tab, biometric attendance

| What | JSON / code |
|---|---|
| Handling office | `lib/dlas/case-handling.ts` → `handlingDistrict(a)`: the applicant's district, or the `toDistrict` of the latest ACCEPTED transfer. Officer access (`officerCanAccessApplication`), the mediator panel (eligibility) and the panel-lawyer shortlist (`rankLawyers`) all use it. The applicant's own district is never rewritten |
| Transfer | `application.transfers[] {transferId, fromOffice/fromDistrict, toOffice/toDistrict, reason, status PENDING / ACCEPTED / REJECTED / CANCELLED, requestedBy/Name/At, respondedBy/Name/At, responseMessage, taskId}`. `CaseTransferService` (`lib/dlas/case-transfer.ts`) has three actions. `request` requires a reason of at least 10 characters and opens a `CASE_TRANSFER_REVIEW` task in the receiving office. `respond(ACCEPT \| REJECT)`: a rejection requires a message and opens a `CASE_TRANSFER_REJECTED` task, carrying the message, for the sender; acceptance moves `routing.office` and the open DLAO tasks and sends the applicant a safe SMS. `cancel` withdraws a pending request. A transfer is blocked while a mediator or panel lawyer is offered or assigned, or while the case is closed. Until acceptance the receiving office sees a summary only. Audit: `case.transfer_requested / _accepted / _rejected / _cancelled` |
| Transfer UI | Case page `/dashboard/dlo#app/<id>` → "Transfer to another DLAO" (district and reason; pending banner with cancel; history with the receiving office's message). Inbox `/dashboard/dlo#transfers` (also `/dlo/infer`): incoming requests (accept, or reject with a message), sent requests with their answers. The sidebar badge counts incoming requests |
| District register | `/dashboard/dlo#cases` (`lib/dlas/district-cases.ts`): every case the office handles. Running time is shown as a colour dot (green under 30 days, amber 30–90, red over 90), and so is the time since the last audit entry (green up to 7 days, amber 8–14, red over 14). It also shows the state and next action, and the lawyer or mediator. For lawyer cases it adds hearings, the next hearing, overdue reports and missed hearings, with links to lawyer control (summon, red flag) and to withdraw / reassign. Filters: open, lawyer, mediation, silent 14+ days, running 90+ days, closed. Read-only |
| Citizen urgency | The web intake step 3 asks "Is this urgent?" (checkbox plus reasons: danger now, violence or threats, eviction, detention, child involved, online harassment) → `data.urgency {selfReportedUrgent, flags}`. The existing pipeline then raises the advisory priority and the safety-review task. `/dashboard/dlo#urgent` lists these cases (sidebar badge = open urgent cases). Priority and pathway stay the officer's decision |
| Biometric attendance | `/lawyer/biometric`: a simulated fingerprint pad. Press and hold for 2 s → `LawyerAuth.markAttendance("PRESENT", {method: "BIOMETRIC_SIMULATED", deviceId: "SIM-FP-SCANNER-01"})`; releasing early records nothing. `LawyerDayAttendance` gains `method` (`SELF_DECLARED` / `BIOMETRIC_SIMULATED`) and `deviceId`; the audit entry `attendance.marked / changed` carries the method and `simulated: true`. The lawyer's attendance page links to the pad instead of offering a plain "Present" button; "Absent" remains self-declared |

## 19. IVR: simulated AI triage, emergency button, 16699 agent hand-off · transfer notices · requested documents

| What | JSON / code |
|---|---|
| Simulated AI triage | `lib/dlas/ivr-triage.ts` → `triageStory(text, lang)`: a rule-based stand-in for an AI model (`engine: SIMULATED_TRIAGE_V1`, `simulated: true`, `advisoryOnly: true`). Findings are CRITICAL (danger to life, self-harm, sexual violence, child at risk, detention, trafficking) or SENSITIVE (physical violence, imminent eviction, complex litigation, distress, unclear story), each with the matched words as evidence. It routes to an agent on anything critical, on complex litigation, or on two or more sensitive findings; otherwise the IVR continues. It never rejects anyone and never decides eligibility. Stored as `session.aiTriage[]` and copied to `application.aiTriage[]` on submit. Audit: `ai.story_triaged`, `handoff.to_agent` |
| IVR flow | `SUMMARY_CONFIRM → AI_TRIAGE` (auto node: "Please hold — our assistant (simulated AI) is reviewing…") `→ AGENT_TRANSFER → AGENT_WAIT` or `→ DANGER` (the normal flow). A critical call cannot opt out; a sensitive one can press 2 to continue the automated application (`handoff.caller_continued_automated`). Hanging up while a transfer is open does not abandon the session, because the agent calls back |
| Emergency | A red 🚨 EMERGENCY button on the IVR phone during any call, plus main-menu option 9 → `IvrEscalation.emergency()`. It sets `urgency {selfReportedUrgent: true, flags: [IMMEDIATE_DANGER]}` and opens an `EMERGENCY_CALL` task (URGENT, due in 2 minutes). The caller hears "call 999 now; connecting you to an agent". Audit: `emergency.pressed` |
| Agent hand-off | `session.agentHandoff {kind AI_ESCALATION / EMERGENCY, status WAITING / CONNECTED / COMPLETED / CLOSED, taskId, triageId, agentId/Name, outcome}`; tasks `AGENT_LIVE_TRANSFER` / `EMERGENCY_CALL` for `HELPLINE_AGENT`. 16699 agents sign in (`db.helplineAgents[]`, `HelplineAgentAuth`). `AgentDesk.take / capture / consent / submit / close`: the agent completes the missing fields on the SAME intake session (provenance `OPERATOR_ENTERED · AGENT_FORM`, consent `AGENT_VERBAL_READBACK`) and submits. The result is an ApplicationRecord in `dlas.db.v1` like any other door, with `agentHandoff` and `aiTriage` carried onto it. Screen: `/dashboard/helpline#ivr-escalations` (emergencies first, with the AI findings and the draft captured so far) |
| Transfer notices | `db.officeNotices[] {office, kind TRANSFER_RECEIVED / ACCEPTED / REJECTED / CANCELLED, applicationId, caseRef, title, body, at, readBy[]}`, written by `CaseTransferService`. `OfficeNoticeBar` shows unread notices at the top of every DLO view ("Case transfer received from X DLAO"; "X DLAO rejected the transfer — the case is back with your office" with its message). The case page shows "Transferred case — received from X" to the receiving office and "Rejected — back with your office" to the sender; queue rows get a transfer tag |
| Requested documents | The citizen's "Documents needed" (case page and home card) lists only the documents the Legal Aid Officer requested (`document.requested`), not the matter's default checklist |

## 20. Mediator best picks → offer → accept / decline → auto-next

Code: `lib/dlas/mediator-offers.ts`. UI: `components/dlao/mediator-assign.tsx` (Best picks + open offer), `components/mediator/mediator-workspace.tsx` (Case offers). Test: `t32offers.js`.

**Ranking (advisory).** After the hard filters (§ mediator assignment), `rankCandidates()` scores each *eligible* mediator 0–100 by fixed rules:
experience HIGH/MEDIUM/LOW = 35/22/10 · free capacity = 30 × (1 − load/capacity) · availability AVAILABLE/LIMITED = 15/6 · record COMMENDED/none/CONCERN = 15/8/0 · area match = 5. Ties: lower load, then name. The breakdown is shown to the officer and written to audit. The officer chooses whom to offer to; the system never assigns.

**Record.** `application.mediation.assignments[]` item (`MediatorAssignmentRecord`) gains
`status: OFFERED | DECLINED | EXPIRED` (plus existing ASSIGNED / WITHDRAWN …) and
`offer: { offeredAt, respondBy (+24h), via: OFFICER_PICK | AUTO_NEXT, rank, score, respondedAt, declineReason }`.
`mediation.assignmentStatus = AWAITING_MEDIATOR_ACCEPTANCE` while an offer is open (at most one open offer per case).

**Transitions.**
| Actor | Call | Effect |
|---|---|---|
| DLAO | `MediatorOfferService.offer(appId, mediatorId, reason)` | live re-check (conflict/capacity) → OFFERED; task `MEDIATOR_CASE_OFFER` to the mediator; SMS to mediator (SIMULATED); audit `mediation.mediator_offered` |
| DLAO | `withdrawOffer(appId, reason)` | WITHDRAWN; task closed; audit `mediation.offer_withdrawn` |
| Mediator | `accept(appId)` | conflict re-check → ASSIGNED, need-to-know access, scheduling task, applicant SMS (safe channel / neutral wording), office notice `MEDIATOR_ACCEPTED`; audit `mediation.mediator_accepted` |
| Mediator | `decline(appId, reason)` | DECLINED → next-ranked eligible mediator offered automatically (`via: AUTO_NEXT`, audit `mediation.auto_offered_next`), office notice `MEDIATOR_DECLINED` |
| System | `sweepMediatorOffers(now)` (runs on the minute clock on DLO + mediator screens) | past `respondBy` → EXPIRED → next pick, same as decline |
| System | none left | `assignmentStatus = RECOMMENDED`, DLAO task `MEDIATOR_ASSIGNMENT` (HIGH), notice `MEDIATOR_NONE_LEFT`, audit `mediation.offers_exhausted` |

A mediator who declined or let an offer expire is never re-offered automatically; the officer may still choose them manually. Before acceptance the mediator sees only case ref, matter, case type, track and office — no party personal data. Office notices live in `db.officeNotices[]` and appear in the DLO notice bar.

### 20.1 Mediators are auto-approved; the office only assigns

- `MediatorAuth.signUp` creates the mediator as `status: ACTIVE` with `certification = { status: CERTIFIED, body: "Self-declared at sign-up: <qualification>", verifiedBy: "system", verifiedByName: "Auto-approved at sign-up", verifiedAt: <signup time> }`; audit `mediator.self_registered { autoApproved: true }`. They pass the eligibility filters at once and appear in Best picks.
- Store migration (`store.ts autoApproveMediator`): any non-sample mediator still `PENDING_VERIFICATION` loads as ACTIVE with an auto-approved certificate.
- DLO dashboard `#mediators` / `#mediator/<id>` is **view-only**: no add (`#mediators/new` → list), edit, certificate verification, status change, availability, conflict declarations or admin-record entries. Tabs: Profile, Record & audit.
- The only office action on mediators is assignment: Legal pathway → Mediation → Best picks → offer (§20). Mediators protect themselves from conflicts by declining the offer.
- `MediatorRegistry.*` library functions remain (used by tests / sample data) but have no DLO UI.

## 21. Settlement: DLO verifies last → testimonial → case closed (no CLO step)

Code: `lib/dlas/mediation-workspace.ts` `SettlementVerificationService` (old `CloSettlementService` kept as an alias: `certify` = `verify`). UI: `/dashboard/dlo/settlements[/<APP-ID>]` (`components/dlao/clo-settlement-review.tsx`), visible to every Legal Aid Officer. Test: `t34verify.js`.

1. Mediator records terms → both parties sign (SIMULATED) → mediator confirms → `settlementWorkflow.status = AWAITING_CLO_CERTIFICATION` (legacy enum name; means *awaiting the DLO's verification*).
2. **DLO verifies** — `verify(appId, { outcome })`: any officer of the handling office (`officerCanAccessMediationCase`), no CLO role needed. Sets `resolution {certifyingOfficer = DLO, certificationTimestamp, outcome}`, `flow.status = RESOLVED`; the case is still open. Audit `settlement.certified` (detail `verifiedBy: LEGAL_AID_OFFICER`). The DLO can instead `review(appId, RETURNED_FOR_CORRECTION | CLARIFICATION_REQUESTED, note)` → back to the mediator.
3. **DLO generates the testimonial** — `issueTestimonial(appId)`: writes `settlementWorkflow.testimonial` (`SettlementTestimonial`: `testimonialId TST-…`, office, case ref, agreement, parties, mediator, agreed resolution, conditions, deadline, verified outcome, signature/confirmation/verification times, `issuedBy/At`, `simulated: true`) and **closes the case**: `application.status = RESOLVED`, `stage = CLOSURE`, `closedAt = now`; every open task of the case is closed except a pending `COURT_AUTHORITY_NOTIFICATION`. Audit `settlement.testimonial_issued` + `case.closed`; applicant SMS on the safe channel (neutral wording where required, SIMULATED gateway). Issuing twice is refused.
4. The testimonial is shown on the settlement page with **Print** and **Download (.html)**, marked DEMO / SIMULATED (no official seal or e-signature). The citizen timeline's *Closure* step shows the testimonial number and the office to collect it from.

Lifecycle (Feature 12) settlement tail is now `mediator_confirmation → dlo_verification (OFFICER) → testimonial (OFFICER) → closed (SYSTEM)`; the CLO checkpoints and the settlement follow-up stage were removed. Office control: "Verify the agreement (final step)" → "Generate the testimonial & close the case" → "Closed — testimonial issued". `LEGAL_AID_OFFICER` now has the `AGREEMENT_CERTIFICATION` scope.

## 22. Rule-based red flag (replaces the citizen's "Is this urgent?" question)

Code: `lib/dlas/incident-taxonomy.ts` (pure rules), `lib/dlas/incident-flag.ts` (officer review), `components/dlao/incident-flag.tsx` (case-page banner). Test: `t35incident.js`.

- The citizen web form no longer asks whether the case is urgent (only the "call 999 if a life is at risk" note remains).
- **Taxonomy** (`IncidentCategory › IncidentSubcategory`): VIOLENT_CRIME (MURDER, ATTEMPTED_MURDER, ASSAULT, GRIEVOUS_BODILY_HARM, TORTURE) · SEXUAL_OFFENCE (RAPE, SEXUAL_ASSAULT, SEXUAL_HARASSMENT, CHILD_SEXUAL_ABUSE) · PERSONAL_SAFETY (KIDNAPPING, HUMAN_TRAFFICKING, DEATH_THREAT, STALKING, MISSING_PERSON) · DOMESTIC_VIOLENCE (PHYSICAL_ABUSE, PSYCHOLOGICAL_ABUSE, ECONOMIC_ABUSE, THREAT) · PROPERTY (LAND_DISPUTE, TENANCY, INHERITANCE, PROPERTY_DAMAGE) · FAMILY (DIVORCE, CHILD_CUSTODY, MAINTENANCE, FAMILY_DISPUTE) · LABOR (UNPAID_WAGES, WRONGFUL_TERMINATION, WORKPLACE_HARASSMENT) · CIVIL (CONTRACT, DEBT, COMPENSATION, OTHER_CIVIL_DISPUTE) · ADMINISTRATIVE (DOCUMENTATION, GOVERNMENT_SERVICE, OTHER) · OTHER.
- **RED categories:** VIOLENT_CRIME, SEXUAL_OFFENCE, PERSONAL_SAFETY, DOMESTIC_VIOLENCE.
- **Rules** (`classifyIncident({matter, summary})`, version `incident-rules-2026.09`): fixed Bangla + English keyword lists per subcategory over the applicant's own description; longest phrase first (so "খুনের হুমকি" = death threat, not murder); violence or a death threat in the family home (husband/wife/in-laws, or matter = FAMILY) → DOMESTIC_VIOLENCE; a bare threat outside the home → PERSONAL_SAFETY; if no words match, the matter type decides (VIOLENCE → VIOLENT_CRIME, LAND → PROPERTY, CYBER_HARASSMENT → PERSONAL_SAFETY, …). Primary = first match in taxonomy order (red first). No AI, no score.
- **Record:** `application.incident: IncidentClassification` {category, subcategory, red, matched[{category, subcategory, keyword}], basis DESCRIPTION_KEYWORDS | MATTER_TYPE, rule (plain words), rulesVersion, at, advisoryOnly, officerReview}. Set by `IntakeGateway.submit` for every channel; older records are classified on read (`incidentOf`). Red → `routing.recommendedPriority = URGENT` with reason `RED FLAG (rule): …`; audit `incident.red_flagged` (or `incident.classified`).
- **DLO:** red cases go to **Urgent cases** (`#urgent`), are marked red in the district register and office control (`isUrgent`), and the case page shows a red banner with the rule and the applicant's words. The officer can **confirm** the flag or **clear** it with a reason (≥ 10 chars) — `IncidentFlagService.review` → `officerReview`, audit `incident.red_flag_confirmed | incident.red_flag_cleared`. A cleared flag leaves the urgent list; "Flag red again" restores it.
- `isCitizenUrgent(a)` now means `isRedFlagged(a)`. `data.urgency` (old self-reported flags, e.g. from IVR emergency) is kept but no longer drives the urgent list.

## 23. Settlement discussion — SIMULATED AI draft the mediator edits

Code: `lib/dlas/settlement-draft.ts` (pure template), `MediationWorkspaceService.draftSettlementWithAi` / `addItem(…, fromDraft)`, UI in the mediator workspace → case → *Settlement* tab. Test: `t36draft.js`.

- **Draft with AI** (labelled SIMULATED AI) shows a short "reading the case record… / checking attendance… / drafting…" sequence, then pre-fills the five boxes (Issues, Discussion points, Proposed terms, Agreed terms, Outstanding). Nothing is saved: each box is marked "✨ AI draft — edit before adding" until the mediator edits it and presses **+**.
- It is a deterministic template (`settlement-draft-sim-2026.09`) chosen by the mediation case type (or the rule-based incident subcategory): maintenance, dower, custody, divorce, land, inheritance, tenancy, wages, debt, or a neutral default. Inputs: the shared record only — matter, case type, the applicant's own description, party names, last session attendance, and points already written (not re-drafted). It **never reads caucus notes** and **never invents amounts**: those are `[bracketed]` placeholders, and a point that still contains `[…]` is refused.
- Audit: `settlement.ai_draft_generated` {draftId AID-…, simulated, basis}; each added point records `source` = `MEDIATOR` | `AI_DRAFT_EDITED` | `AI_DRAFT_UNCHANGED` and `aiDraftId` (also on `mediation.settlement_updated`).

## 24. Testimonial → citizen → appeal (DLO accepts → lawyer; otherwise resolved)

Code: `lib/dlas/settlement-appeal.ts` (`SettlementAppealService`, `sweepSettlementAppeals`), UI: citizen case page + home banner (`components/dlas/citizen-settlement.tsx`), DLO settlement page (`AppealPanel`). Test: `t37appeal.js`. Replaces the "testimonial closes the case" step of §21.

- `issueTestimonial` now **sends the testimonial to the citizen** (visible on their case page, SMS) and opens `settlementWorkflow.appeal = { windowEndsAt: +7 days, status: WINDOW_OPEN }`. `application.status = RESOLVED`, `stage = OUTCOME`, `closedAt` still null.
- Citizen (`CitizenAuth`, own case only): **Accept the settlement** → `ACCEPTED_BY_CITIZEN` → closed; or **Appeal** with a reason (≥ 10 chars) → `FILED`, DLO task `SETTLEMENT_APPEAL_REVIEW` (HIGH), office notice `SETTLEMENT_APPEAL_FILED`.
- No response before `windowEndsAt` → `sweepSettlementAppeals` (runs on the minute clock on citizen and DLO screens) → `LAPSED` → closed **as resolved by default**.
- DLO `decide(appId, ACCEPTED | REJECTED, reason ≥ 10)`: **ACCEPTED** → `review.pathway = LAWYER`, pathway final `LAWYER_ASSISTANCE`, `application.status = ACCEPTED`, `stage = SERVICE_DELIVERY`, task `LAWYER_ASSIGNMENT` → the DLO assigns a panel lawyer through the existing shortlist/offer flow. **REJECTED** → closed as resolved. The citizen gets an SMS either way.
- Closing = `stage CLOSURE`, `closedAt`, open tasks closed (except a pending court-authority notice), audit `case.closed {reason}`. Audit also: `settlement.testimonial_sent_to_citizen`, `settlement.appeal_filed`, `settlement.accepted_by_citizen`, `settlement.appeal_accepted`, `settlement.appeal_rejected`, `settlement.appeal_window_lapsed`.
- Lifecycle tail: `testimonial → closed (CITIZEN)`; demo step "closed" = the citizen accepts.

## 25. "Summarize" — SIMULATED AI case summary (DLO, DLO staff, mediator, lawyer)

Code: `lib/dlas/case-summary.ts` (`buildCaseSummary` pure, `CaseSummaryService.generate(appId, role)`), UI `components/dlas/ai-summary.tsx` on the DLO case page, the staff story-check page, the mediator workspace and the lawyer case view. Test: `t38summary.js`.

- Button **✨ Summarize** (tag SIMULATED AI) → 4-step "reading… / checking… / filtering to your role… / writing…" sequence → the summary appears section by section: headline, watch-outs (red flag, neutral wording, no SMS, child, accessibility, overdue report), What happened, Parties, Where it stands, Documents, Key dates, Suggested next step.
- Deterministic template (`case-summary-sim-2026.09`) over the shared record. Access is checked per role (officer of the office · staff of the district · the assigned mediator · the offered/accepted lawyer). Never included for anyone: phone numbers, NID numbers, caucus notes. Mediator: also no income/eligibility or staff notes. Offered-only lawyer: no party names. Each summary lists what it left out.
- Audit `case.ai_summary_generated {summaryId, forRole, simulated, withheld}` on the case.

### 22.1 The category the citizen picks makes the case urgent

- Citizen form (step 2) now has 8 cards: Family, Land, Civil, **Criminal**, **Sexual harassment / abuse** (new), **Security / threats** (new), Labour, Other. New `MatterCategory` codes `SEXUAL_HARASSMENT`, `SECURITY` (legacy door codes `sexual_harassment`, `security`), with document checklists and pathway subcategories.
- `RED_MATTERS = CRIMINAL_DEFENCE, SEXUAL_HARASSMENT, SECURITY, VIOLENCE`: choosing one of these makes `incident.red = true` and routing priority **URGENT** at submission, **whatever the description says** (rule text starts `URGENT: applicant chose “…”`). Keyword rules (§22) still add the category and can also flag other matter types red. The DLO can still confirm or clear the flag with a reason. Test: `t40matter.js`.

## 26. UDC light mode — text first, files later (simulated weak network)

Code: `lib/shakkho/services/light-mode.service.ts` (`LightMode`, `installLightModeAutoFlush`, `useLightMode`), `UdcDoor.syncDocument(…, { heldOnDevice })` + `UdcDoor.completeHeldUpload` (`lib/dlas/door-bridges.ts`), UI `components/udc/primitives/light-mode-panel.tsx` (strip under the network bar on every UDC screen; full list in the Sync Centre). Network profiles come from `NetworkConditionService` (normal · slow · intermittent · offline · reconnected), all SIMULATED.

- **Light mode is on** when the network is slow, intermittent or offline. A document captured in the intake workspace is then **not uploaded**: the record lists it with `status: WILL_SUBMIT_LATER`, `preview: NONE` and the note "Held on the UDC device — <kind> network…"; the bytes are kept in this browser's IndexedDB (`shakkho.udc.held.v1`) and a manifest entry in `localStorage["shakkho.udc.lightmode.v1"]` (`HeldUpload`: file name, size, SHA-256, heldAt, heldBecause, status HELD | UPLOADING | SENT | FAILED, progress).
- **Save + queue** still sends the application **text** (a few KB — the size is shown as "TEXT SENT ✓ n KB"), so the Application ID is issued right away.
- **When the network is normal / reconnected** the held files upload automatically (also "Send held files now"): simulated progress for ≈ size ÷ bandwidth (1.2–6 s), stops and keeps the file held if the link turns weak mid-upload. Then `completeHeldUpload` attaches it — to the intake session if not yet submitted, otherwise to the application (`status ATTACHED`, `uploadedVia UDC`, provenance "uploaded after reconnect (light mode)", audit `document.uploaded_after_reconnect {bytes, heldAt, heldBecause, sha256}`, DLAO task `DOCUMENT_REVIEW`).
- Fix alongside: `offline-store.service.ts` `txAll` now returns the IndexedDB request's **result** (was the request object → `all.filter is not a function`), and re-opens the DB with a version bump if it exists without its stores.

## 27. T3 — Multiple applicants, one incident ("Group cases") — linked, not merged

Code: `lib/dlas/incident-groups.ts` (`IncidentGroupService`, `groupSuggestions`, `citizenGroupView`), DLO UI `components/dlao/incident-groups.tsx` (sidebar **Group cases (same incident)** → `#groups`, `#group/<GRP-ID>`, banner on the case page), citizen UI `components/dlas/citizen-group.tsx` (home banner + case page card) and citizen notifications. Test: `t41group.js`.

- **Guardrail (case document T3):** "Link, do not merge. Confidentiality, instructions and outcomes remain case-specific." A group is `db.incidentGroups[]` (`IncidentGroup`: title, description, date, place, office, applicationIds, status ACTIVE | DISSOLVED, sharedEvidence[], audit[]); each case gets `application.incidentGroupId`. Nothing in the cases' own records is merged or copied.
- **Suggestions (advisory):** among the office's open, ungrouped cases, pairs score on same matter type (20), same rule-based subcategory (15), same other party (30), similar descriptions (Jaccard word overlap, up to 35), filed within 14 days (5); ≥ 50 → suggested, joined into clusters, with the reasons shown. The DLO chooses.
- **DLO actions** (office's own cases only; reasons required, ≥ 10 chars): `create` (≥ 2 cases), `addCase`, `removeCase` (the group dissolves when < 2 remain), `uploadSharedEvidence` — **one** file (FileStore key `SEV-…`, SHA-256; the same file twice is refused) visible to every linked case; each case gets an audit *reference* (`incident_group.shared_evidence_linked`, `copy: false`), not a copy.
- **Applicants:** each is told by SMS on their safe channel (neutral wording where required) and sees on their dashboard/case page: the incident, how many *other* cases are linked, and the shared evidence — **never** the other applicants' names, phones or stories. Notifications: linked / new shared evidence / unlinked.
- **Audit:** group `incident_group.created | case_added | case_removed | shared_evidence_added | dissolved`; case `incident_group.linked | unlinked | shared_evidence_linked` + `notice.sms_*`.

## 28. T4 — Duplicate / fraud-risk check (SIMULATED AI, human decides)

Code: `lib/dlas/duplicate-check.ts` (`scorePair`, `scanApplications`, `DuplicateReviewService`, `loadDuplicateDemo`), UI `components/dlao/duplicate-check.tsx` (sidebar **Duplicate / fraud-risk check** → `#duplicates`; banner on a flagged case page). Test: `t42dup.js`.

- **Guardrail (case document T4):** never auto-reject, auto-merge or label a person fraudulent. The scan only raises signals; nothing about a case changes except audit entries.
- **"✨ Run AI duplicate & fraud-risk scan"** (tag SIMULATED AI): 4-step "reading / normalising names / comparing / scoring" sequence, then deterministic fuzzy matching (`dup-scan-sim-2026.09`) over every pair of the office's records. Name: title-stripped, token-sorted, character-bigram Dice similarity (Akter/Aktar, Md. Kamal/Kamal). Weights: NID same +45 / different −35 · phone same +25 · name +12–20 (< 50 % → −10) · other party +10 / different −10 · story word overlap +8–15 · matter +5 / different −8 · different district −5 · filed within 30 days +3. Every weight is shown as evidence ▲ for / ▼ against.
- **Results:** POSSIBLE_DUPLICATE (score ≥ 45), RISK_SIGNAL ("one NID on two different names", "one phone for two different applicants — often a shared family/shop/UDC phone"; worded as *verify*, never *fraud*), SIMILAR_BUT_DIFFERENT (same-looking name but identifiers disagree → shown as checked and kept apart — the "trap cases").
- **Human review:** side-by-side table (=/≠ per field) → decision SAME_PERSON | DIFFERENT_PEOPLE | NEEDS_VERIFICATION with a note (≥ 10 chars). Stored in `db.duplicateReviews[]` (`DuplicateReview`); audit `duplicate.flagged_for_review` (system) and `duplicate.review_decided {noAutomaticAction: true}` on both cases; scan run logged in `adminAudit`.
- **Demo data (acceptance test):** "Load 13 demo records" files 13 clearly fictional "(demo)" records through the normal citizen door: 3 genuine duplicates, 2 risk signals, 2 same-name-different-people traps.

## 29. Lawyer — all hearings & early reporting (prototype)

- **View:** `/dashboard/lawyer#hearings` (sidebar "All hearings"; also a button on the Calendar and an Overview tile). Lists every hearing on the lawyer's accepted cases, past and future, with filters: All / Upcoming / To report / Reported.
- **Action:** every unreported hearing has a button: "Record attendance & report", or for a future hearing "▶ Attend now & report (prototype)". The case page gets the same early action on its own upcoming hearings. Both use the existing `LawyerService.submitUpdate` form.
- **Prototype rule:** a future hearing may be reported before its date so the full flow can be demonstrated. Nothing is hidden:
  - `HearingUpdate.beforeHearing = true` (optional field)
  - provenance note "PROTOTYPE: reported before the hearing date"
  - the `hearing.update_submitted` audit event carries `detail.beforeHearing`
  - the UI shows a "Before hearing date (prototype)" tag
- **Unchanged guards:** the case must be accepted; the lawyer must own the hearing's assignment; one report per hearing; a next date creates the next hearing; reassignment checks still run.
- **Test:** `t43hear` (a future hearing reported early → REPORTED, flagged, audited; a past hearing is not flagged; a second report is rejected).

## 30. Lawyer path — payment approval, simulated payout, case closure

The DLO closes a lawyer-path case in three steps, all on the DLO case page (`#app/<id>`) in the Panel lawyer section.

1. **Complete representation** (existing `DlaoLawyerService.complete`): outcome plus a reason → stage OUTCOME, and each lawyer's payment goes to `DLAO_REVIEW`.
2. **Approve payment**: `DlaoLawyerService.approvePayment(appId, assignmentId, {payableHearings, note})`.
   - Runs from the "Review & approve payment" button in the Attendance & payment ledger.
   - The computed count is the number of attended hearings. If the DLO changes it, a reason of at least 10 characters is required, and the count must fall between 0 and the number of completed stages.
   - Result: `payment.status = "APPROVED"` and `payment.approval = {payableHearings, computedHearings, note, by, byName, at}`.
   - Audited as `lawyer.payment_approved`; the lawyer gets a simulated SMS and a notice on their dashboard.
3. **Pay lawyer (simulated)**: `DlaoLawyerService.payLawyer(appId, assignmentId)`.
   - Allowed only after approval.
   - Result: `payment.status = "PAID"` and `payment.disbursement = {ref: "SIMPAY-…", method: "SIMULATED_TRANSFER", simulated: true, …}`.
   - Audited as `lawyer.payment_disbursed` with `simulated: true`. No money moves.
4. **Close case**: `DlaoLawyerService.closeCase(appId, note)`.
   - Requires `completion`. Blocked until every recorded lawyer payment is `PAID`. Needs a note of at least 10 characters.
   - Result:
     - `lawyer.closure = {reason, by, byName, at}`
     - `status: RESOLVED`, `stage: CLOSURE`, `closedAt` set
     - every open task on the case is closed
     - audit entries `status.changed` and `application.closed {pathway: "LAWYER", outcome, payments}`
     - the citizen gets an SMS using the safe-contact rules
   - After this, the DLO page shows a "Case closed" banner, and the citizen timeline shows the Outcome step ("Court stage complete — outcome: …") and the Closure step ("Case closed by …").
- **Schema:**
  - `PaymentReconciliation.status` gains `APPROVED | PAID` and optional `approval` / `disbursement`.
  - `LawyerMatter.closure?` is added.
- **Test:** `t44close`.
