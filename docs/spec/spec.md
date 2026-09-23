# Role dashboard specification

This specification covers the four currently implemented portal endpoints. Broader roles and later
flows remain governed by `docs/PRD/PRD.md`.

## Routes and outcomes

| Role | Sign-in | Dashboard | Required first outcome |
|---|---|---|---|
| Citizen | `/` | `/dashboard/citizen` | Understand and respond to the safe next action |
| DLAO | `/dlo` | `/dashboard/dlo` | Find the oldest or most urgent unresolved promise/evidence exception |
| Panel lawyer | `/lawyer` | `/dashboard/lawyer` | Accept work and submit the next structured update |
| Administrator | `/admin` | `/dashboard/admin` | Inspect operations and draft versioned policy changes |

Successful prototype sign-in routes directly to the matching dashboard. For citizen evaluation, the prototype provides quick test credentials (mobile: `a`, password: `a`) with one-click **Auto-fill** and direct **Quick enter** actions.

## Functional requirements

### Citizen dashboard

- Show one plain-language status sentence, case reference, verified next action, assigned lawyer,
  and next hearing.
- Provide Confirm, Dispute, and Request a call as separate actions.
- Treat a citizen response as an attributed input for review, never an automatic verdict.
- Reveal source and policy detail on request without exposing unnecessary case content by default.

### DLAO dashboard

- Sort the seeded queue by priority then age and provide All, Escalated, Needs action, and Watch
  filters.
- Show a reason on every row; never show a bare score.
- Display conflicting claims simultaneously with source labels.
- Keep the resolution action unavailable while the authorised decision endpoint is unavailable,
  with explanatory copy beside the disabled control.

### Panel-lawyer dashboard

- Allow assignment acceptance or reasoned decline in the local prototype.
- Show reporting deadlines and missing obligations.
- Collect attendance, outcome, and next date as separate required fields.
- Label the resulting update as self-reported evidence rather than verified truth.

### Administrator dashboard

- Show sourceable operational measures, active policy version, authorised-user totals, and recent
  audit events.
- Allow a local rule draft with a required version note.
- Do not expose legal decisions, overrides, or case resolution controls to the administrator.

### Simulation control panel

- Provide working local controls for clock advancement, SMS delivery failure, court-date
  publication, scenario steps, and reset.
- Clearly label every control and result Simulated.
- Never claim that a local interaction sent a real notification or persisted a backend mutation.

## Acceptance checks

- [x] All four portals land on non-placeholder, bilingual dashboards.
- [x] The whole page switches between Bangla and English.
- [x] Sidebar links resolve to a real dashboard section or simulator route.
- [x] The mobile drawer opens, closes, and dismisses after navigation.
- [x] Citizen, lawyer, DLAO, and admin primary actions provide visible feedback.
- [x] DLAO conflict review preserves both values and identifies their sources.
- [x] Consequential resolution is not simulated as a successful save.
- [x] Colours and fonts come exclusively from shared tokens.
- [x] Queue rows and evidence layouts stack without horizontal page overflow.
- [x] Sign-in portals render visible, responsive law-mark imagery with vignette framing and grid overlay.

## Step 1 — Access & Application (shared record)

- Citizen portal `/`: sign up with name + mobile number; log in with the mobile number only (no password). The wizard is prefilled from the account and the session records `meta.citizenId`; the phone is still verified by OTP before submitting.
- Citizen dashboard (home greeting, sidebar profile, My cases, case detail) shows the LOGGED-IN citizen and their own applications from `dlas.db.v1` (`lib/dlas/citizen-view.ts`): filed after login, or any door where the applicant/representative phone matches the account. No hard-coded citizen data remains: profile, cases, case detail, notifications (derived from own applications, open tasks, simulated SMS and complaints; "mark all read" stored on the account), unread badge and "My legal aid centre" (district office from the latest application; officer shown only once assigned) all read `dlas.db.v1`.
- UDC portal `/portal/udc`: sign up with name + mobile + UDC centre + district; log in with the mobile only. `/dashboard/udc` requires a logged-in operator. The operator id/name/centre come from the account (no `udc-001`, no demo operator). UDC demo seed data (Nuching/Rangamati/Bandarban drafts, conflicts, measurements) and the Nuching jury-mode/demo pages were removed; the dashboard, applications list and sidebar show only the operator's own work from `dlas.db.v1` (+ live offline-queue status). Interpreter records and document captures are entered by the operator (real file, operator marks unreadable).
- Citizen "UDC" tab lists UDC centres for the district of the citizen's latest application, from `dlas.db.v1.udcCentres`: a demo directory (2 per district, labelled "demo directory", no names/phones) plus every signed-up UDC operator's centre (listed first).
- Four doors write ONE canonical JSON record through `IntakeGateway` (`frontend/lib/dlas/`):
  - Citizen: "Lodge a complaint" = the 5-step intake wizard at `/dashboard/citizen#intake` (`#complaint` is an alias; the separate old complaint form was removed as redundant), via `CitizenDoor`. Step 1 now also asks for the district and verifies the mobile number by OTP (simulated SMS); step 5 requires a safe contact time. Family/neighbour filing records the filer as a representative.
  - UDC: existing `/dashboard/udc/intake/new` → `/dashboard/udc/intake/[temporaryId]` (via `UdcDoor`). New intake adds district list, the problem in the applicant's words + Bangla translation, and a safe contact time. The workspace writes consents, interpreter records and document captures to the shared record, and "Save + queue" submits to it first so the offline sync reuses the same Application ID.
  - Phones: `/device/ivr` (16699, simulated network + speech-to-text) and `/device/ussd` (*16699#, simulated gateway).
- One validator for all doors (`lib/dlas/validate.ts`); every field carries provenance; every session and record carries `audit[]`. Application ID `APP-YYYY-NNNNN` is minted only by the gateway (helpline agent submit and UDC offline sync reuse it).
- Submit opens human tasks (eligibility review, urgent safety review, document follow-up, missing info, representative call-back). Routing priority is advisory; `humanDecision` stays null.
- `/debug` shows every session/application, its intake step and backbone stage, JSON, provenance, audit, tasks, messages and transcript; export/import/reset.
- Storage is `localStorage["dlas.db.v1"]` (per browser). Full contract: `docs/architecture/DATA-CONTRACTS.md`.


## Step 2 — Verification & Eligibility (DLAO / SCLAC / LLAC)

- `/dlo`: officer sign-up (name, mobile, office type DLAO/SCLAC/LLAC, district) and log-in by mobile; log-out from the sidebar menu. `/dashboard/dlo` requires a logged-in officer.
- The old hard-coded officer dashboard (demo cases, alerts, assignments, timeline) was removed. `/dashboard/dlo` is the office queue (New · In verification · Decided · Follow-up tasks) and a 5-step review workspace, all from `dlas.db.v1`.
- Steps follow the Step-2 diagram: received → identity → documents & facts → vulnerability & eligibility (advisory recommendation from the JSON ruleset) → human decision. Yes creates Case ID `DLAS-YYYY-NNNNN` and allows eligibility notes; No requires a reason, notifies the applicant and closes the application (REJECTED). Blocked steps open follow-up tasks.
- Divergence from the earlier Prompt 12 draft: Case ID creation and rejection are part of this step because the Step-2 diagram includes them; pathway selection (mediation / lawyer / referral) remains the next step.
- Citizen side updates automatically: status, timeline, Case ID, "not accepted — reason" and notifications.
