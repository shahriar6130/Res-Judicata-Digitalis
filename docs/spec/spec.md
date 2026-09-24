# Role dashboard specification

This specification covers the four currently implemented portal endpoints. Broader roles and later
flows remain governed by `docs/PRD/PRD.md`.

## Routes and outcomes

| Role | Sign-in | Dashboard | Required first outcome |
|---|---|---|---|
| Citizen | `/` | `/dashboard/citizen` | Understand and respond to the safe next action |
| DLAO | `/dlo` | `/dashboard/dlo` | Find the oldest or most urgent unresolved promise/evidence exception |
| Panel lawyer | `/lawyer` | `/dashboard/lawyer` | Accept work and submit the next structured update |
| Administrator | `/admin` (automatic, no credentials) | `/dashboard/admin` | Inspect operations and draft versioned policy changes |

Successful prototype sign-in routes directly to the matching dashboard. `/admin` is the exception:
it has no credential form and redirects directly to the administrator dashboard. For citizen
evaluation, the prototype provides quick test credentials (mobile: `a`, password: `a`) with
one-click **Auto-fill** and direct **Quick enter** actions.

## Functional requirements

### Citizen dashboard

- Intake choices distinguish hover, selected, and keyboard-focus states. Hover only
  applies on pointer devices; selected state persists independently of hover.

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

- `/dashboard/lawyer` has hash views `#overview` (default), `#assigned`, `#reports`, and `#calendar`; the sidebar links open the matching focused view.
- Allow assignment acceptance or reasoned decline in the local prototype.
- Show reporting deadlines and missing obligations.
- Collect attendance, outcome, and next date as separate required fields.
- Label the resulting update as self-reported evidence rather than verified truth.
- This legacy dashboard uses labelled sample cases and session-only state; it does not claim to send a decline reason or report to an officer.

### Administrator dashboard

- Show sourceable operational measures, active policy version, authorised-user totals, and recent
  audit events.
- Allow a local rule draft with a required version note.
- Do not expose legal decisions, overrides, or case resolution controls to the administrator.

The implemented admin dashboard reads the shared local record for real people, application,
task, and audit counts. It provides searchable directories and create/edit/delete controls for
citizens, lawyers, DLO officers, mediators, and UDC operators. Account changes are persisted with
administrator audit entries. The applications view monitors every office and channel;
legal decisions remain in the DLO workflow. The policy section displays the currently
stored ruleset versions.

The Admin Applications view also lists every application's hearings and permits an administrator to
add or edit the hearing date/time, court, and purpose. Lawyer-reported attendance and outcomes are
read-only in this editor. Each change updates the shared record and appends an administrator audit
entry; changing an unreported hearing also keeps its open reporting task deadline in sync.

During verification, a logged-in DLO officer can correct applicant identity/contact,
filer, matter, urgency, and safe-contact fields with a required reason. Corrections write
field provenance and before/after audit values, reopen affected verification steps, and
reroute open tasks when the district changes. Editing closes after a decision.

The admin Backup section exports all app-owned browser storage keys (`dlas.*`,
`shakkho.*`, and `rjd.*`) as a dated JSON bundle. This includes the canonical
`dlas.db.v1` record and available `dlas.files.v1` document copies. Import validates
the bundle and its shared-record version, previews counts, then replaces this browser's
app data only after the administrator chooses the explicit Replace action. It accepts
older `/debug` shared-record JSON exports as well. Storage-write failures restore the
previous keys where possible.

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
- [x] DLO and Lawyer sign-in pages use distinct role imagery, side placement, labelled role captions and token accent seams while keeping the same form behavior and Bangla/English toggle.
- [x] Switching the Lawyer portal between login and sign-up leaves the art image at a stable size and crop with no empty area below it; longer registration content scrolls within the desktop form column and the form header stays in place.
- [x] The DLO art label stays close to the left edge of its image at desktop, tablet, and mobile sizes without clipping.

## Step 1 — Access & Application (shared record)

- Citizen portal `/`: sign up with name + mobile number; log in with the mobile number only (no password). The wizard is prefilled from the account and the session records `meta.citizenId`; the phone is still verified by OTP before submitting.
- Citizen dashboard (home greeting, sidebar profile, My cases, case detail) shows the LOGGED-IN citizen and their own applications from `dlas.db.v1` (`lib/dlas/citizen-view.ts`): filed after login, or any door where the applicant/representative phone matches the account. No hard-coded citizen data remains: profile, cases, case detail, notifications (derived from own applications, open tasks, simulated SMS and complaints; "mark all read" stored on the account), unread badge and "My legal aid centre" (district office from the latest application; officer shown only once assigned) all read `dlas.db.v1`.
- Open document-follow-up or missing-info tasks do not establish citizen ownership. A requested NID or marriage certificate appears only for the account whose citizen session or applicant/representative phone matches that application; the same scope applies to notifications, case lists/details, document uploads, and citizen document actions.
- The citizen home dashboard shows the document-upload prompt only while at least one document remains unattached on the signed-in citizen's open applications. When no document is pending, no empty document card is rendered.
- `#notifications` groups unread and earlier items, shows each item's title, supporting text and localised timestamp, and keeps a visible path to the related view. The unread count and mark-all-read control reflect the existing account-backed read state.
- UDC login `/udc` (legacy `/portal/udc` also works): sign up with name + mobile + UDC centre + district; log in with the mobile only. New and legacy UDC accounts default to `PENDING`; they can sign in to see the approval state, but only an `APPROVED` account can use `/dashboard/udc`. The district-matched DLO manages these states from `/dashboard/dlo#udcs`, can approve one or all pending operators, and must enter a reason to reject. Cross-district UDC records are excluded and every decision is appended to the operator audit. The operator id/name/centre come from the account (no `udc-001`, no demo operator). UDC demo seed data (Nuching/Rangamati/Bandarban drafts, conflicts, measurements) and the Nuching jury-mode/demo pages were removed; the dashboard, applications list and sidebar show only the operator's own work from `dlas.db.v1` (+ live offline-queue status). The UDC overview starts the same five-step **Lodge a complaint** wizard used by citizens and links to status visits and sync. UDC identity is operator-attested rather than applicant-OTP verified. Evidence is forward-only: the operator can select and pass files into the sealed record, but the UDC interface exposes no evidence preview, content, filename, or quality-review screen. Old UDC intake/consent/document URLs resolve to the shared wizard instead of the former evidence viewer.
- Citizen "UDC" tab lists UDC centres for the district of the citizen's latest application, from `dlas.db.v1.udcCentres`: a demo directory (2 per district, labelled "demo directory", no names/phones) plus every signed-up UDC operator's centre (listed first).
- Four doors write ONE canonical JSON record through `IntakeGateway` (`frontend/lib/dlas/`):
  - Citizen: "Lodge a complaint" = the 5-step intake wizard at `/dashboard/citizen#intake` (`#complaint` is an alias; the separate old complaint form was removed as redundant), via `CitizenDoor`. Step 1 now also asks for the district and verifies the mobile number by OTP (simulated SMS); step 5 requires a safe contact time. Family/neighbour filing records the filer as a representative.
  - UDC: `/dashboard/udc#intake-new` uses the citizen complaint wizard component and its exact five steps, fields, validation, draft persistence, safe-contact choice, consent, and success state, via the UDC mode of `UdcDoor`. The operator account is preserved as provenance and attests in-person identity. Added evidence is marked sensitive, stored in the shared record, and represented to the UDC only by an opaque sealed-transfer status; only an authorised downstream role can open it.
  - Phones: `/device/ivr` (16699, simulated network + speech-to-text) and `/device/ussd` (*16699#, simulated gateway).
    Both phone pages show a bilingual three-step start guide, a current-mode selector, a prominent handset, conversation, and live record. The layout stacks without horizontal scrolling on narrow screens, while the same scripted flow and shared application record remain in use.
- One validator for all doors (`lib/dlas/validate.ts`); every field carries provenance; every session and record carries `audit[]`. Application ID `APP-YYYY-NNNNN` is minted only by the gateway (helpline agent submit and UDC offline sync reuse it).
- Submit opens human tasks (eligibility review, urgent safety review, document follow-up, missing info, representative call-back). Routing priority is advisory; `humanDecision` stays null.
- `/debug` shows every session/application, its intake step and backbone stage, JSON, provenance, audit, tasks, messages and transcript; export/import/reset.
- The browser keeps `localStorage["dlas.db.v1"]` as the synchronous offline cache. `RemoteStoreBootstrap` hydrates the newest snapshot from `GET /api/dlas-store` and debounced local writes mirror through `PUT /api/dlas-store` to one environment-scoped Upstash Redis JSON key. Admin create/edit/delete, hearing, JSON export, and backup-restore actions reconcile with Upstash before showing a result: export downloads the reconciled current snapshot and import immediately flushes the restored snapshot online. Success names the online database, while an unavailable or unconfigured service is clearly reported as a browser-only operation. The Route Handler validates `v` and `schemaVersion`, rejects payloads above 4 MiB, prevents a clearly older snapshot from replacing a newer one, and keeps all REST tokens server-only. Failed remote writes remain queued for reconnect. Full record contract: `docs/architecture/DATA-CONTRACTS.md`.


## Step 2 — Verification & Eligibility (DLAO / SCLAC / LLAC)

- `/dlo`: officer sign-up (name, mobile, office type DLAO/SCLAC/LLAC, district) and log-in by mobile; log-out from the sidebar menu. `/dashboard/dlo` requires a logged-in officer.
- The old hard-coded officer dashboard (demo cases, alerts, assignments, timeline) was removed. `/dashboard/dlo` is the office queue (New · In verification · Decided · Follow-up tasks) and a 5-step review workspace, all from `dlas.db.v1`.
- `/dashboard/dlo` and `#overview` show a live active-workload count, linked totals for all four buckets, composition/matter/channel charts when applications exist, and a new-application worklist. `#new`, `#review`, `#decided`, and `#tasks` show only their respective worklist. The DLO sidebar exposes these five destinations with office counts. Counts and charts derive from the signed-in officer's office queue; the overview does not create or change review records.
- `/dashboard/dlo#udcs` lists only registered UDC operators whose district equals the logged-in officer's district. It shows approval totals and account metadata, supports individual approval, bulk approval of all pending district operators, and reason-required rejection. The persisted decision records status, officer, timestamp, reason, and an audit event. An officer without a district sees no UDC accounts and cannot decide one.
- Every application and follow-up task record provides an explicit **Open application** link to `#app/<APP-ID>` in addition to the linked application reference.
- An open application renders the active review step at the full workspace width. The case-review page does not show a separate audit-trail sidebar; existing audit records remain persisted and available in the activity/debug surfaces.
- Office worklists use responsive labelled records, retaining all queue fields without horizontal scrolling. The application action remains visible with the record header.
- Steps follow the Step-2 diagram: received → identity → documents & facts → vulnerability & eligibility (advisory recommendation from the JSON ruleset) → human decision. Yes creates Case ID `DLAS-YYYY-NNNNN` and allows eligibility notes; No requires a reason, notifies the applicant and closes the application (REJECTED). Blocked steps open follow-up tasks.
- Divergence from the earlier Prompt 12 draft: Case ID creation and rejection are part of this step because the Step-2 diagram includes them; pathway selection (mediation / lawyer / referral) remains the next step.
- Citizen side updates automatically: status, timeline, Case ID, "not accepted — reason" and notifications.
- Lawyer-path closure is officer-controlled: the DLO records representation completion, reviews each lawyer's payable-hearing count, uses the explicitly simulated Pay lawyer button, and then closes the case with a reason of at least 10 characters. Close remains unavailable until every recorded lawyer payment is `PAID`; closure sets `RESOLVED`, records `closedAt`, closes remaining tasks, notifies the citizen safely, and appends audit entries.

## Feature 6 — successful mediation settlement

The canonical mediation workspace stores one `SettlementWorkflow` after a mediator explicitly
records `SETTLEMENT_REACHED`. Required, manually entered terms are issue, proposed resolution,
agreed resolution, conditions, and deadline; additional terms are optional. No term is generated
or inferred by the application.

The allowed state transitions are
`TERMS_RECORDED → PARTY_EXECUTION → AWAITING_MEDIATOR_CONFIRMATION → AWAITING_CLO_CERTIFICATION → RESOLVED`.
`RETURNED_FOR_CORRECTION` and `CLARIFICATION_REQUESTED` are CLO decisions that return control to
the mediator. Saving a revision increments the agreement revision, clears both signatures and the
mediator confirmation, and returns to `TERMS_RECORDED`. Prototype signatures store their timestamp
and `simulated: true`. The mediator confirmation stores mediator ID, name, status, and timestamp.

The separate CLO queue is `/dashboard/dlo/settlements`; each review opens at
`/dashboard/dlo/settlements/[applicationId]` and is limited to the signed-in officer's office.
Certification is a human action and is rejected unless both parties are signed and the mediator is
confirmed. Certification stores agreement ID, certification timestamp, certifying officer, legal
outcome, and any follow-up requirements, then sets the application to `RESOLVED`. Selected follow-up
requirements create owned `SETTLEMENT_FOLLOW_UP` tasks for compliance checks, party contact,
deadline review, or enforcement monitoring.

## Feature 7 — mediation failure workflow

`MEDIATION_FAILED` creates a `MediationFailureRecord`; it does not set a bare Failed case status.
The mediator records mediation date, attendance by party, issues discussed, outcome, optional
reason/status, follow-up requirement, and a proposed referral pathway. The record snapshots the
session number, channel and completion time while explicitly marking confidential caucus content
as excluded.

The referral pathways are `COURT_LEGAL_PATHWAY`, `LAWYER_ASSIGNMENT`,
`FURTHER_LEGAL_AID_REVIEW`, and `OTHER_REFERRAL`. A deterministic system suggestion stores reasons
and `advisoryOnly: true`. The record remains `AWAITING_OFFICER_REVIEW` until an authorized officer
confirms the suggestion, changes it with a reason, or requests more procedural information. An
information request creates a mediator task; the response returns the record to officer review
without soliciting caucus content.

Officer review routes are `/dashboard/dlo/mediation-outcomes` and
`/dashboard/dlo/mediation-outcomes/[applicationId]`. A confirmed lawyer pathway changes the
officer-controlled service pathway to `LAWYER`, initializes the existing lawyer matter if needed,
and creates a `LAWYER_ASSIGNMENT` task. It does not choose or assign a lawyer. The existing officer
shortlist and panel-lawyer offer workflow begins from that task. Audit and citizen timeline entries
show Mediation → Failure → Referral record → Legal Aid Officer → Lawyer assignment.
## Features 8–9: court origin and mediation access control

- `PathwayInputs` stores `mediationOrigin` plus court name, court level, case number, referral date, order/reference, referring authority, current litigation stage, and referral deadline.
- `MediationMatter.origin` distinguishes `PRE_LITIGATION`, `MANDATORY_PRE_CASE`, `COURT_REFERRED`, and `APPELLATE_REFERRAL`; `track` continues to drive the shared eligibility and workspace engine.
- Court settlement certification creates a pending `SETTLEMENT_OUTCOME` authority notification. A court/legal failure referral creates `FAILURE_RETURN`. Both create `COURT_AUTHORITY_NOTIFICATION` tasks and require an officer to record the simulated dispatch.
- `MEDIATION_ROLE_SCOPES` defines the Citizen, Legal Aid Officer, Chief Legal Aid Officer, Mediator, Panel Lawyer, and DBLA/Admin scopes. Case gates remain assignment based for mediators and panel lawyers and office based for officers.
- Only the assigned, non-revoked mediator can open or mutate a mediation workspace. Its read model excludes NID, direct phone/address, eligibility information, internal notes, staff checks, unrelated risk, and other cases.
- New caucus writes live in `workspace.mediatorConfidential.caucusNotes`; the optional legacy `caucus` array is read only for stored-record migration. Public projections strip both containers.
- Officer accounts carry an optional `authorityRole`. Existing SCLAC records resolve to Chief Legal Aid Officer; other legacy officer records resolve to Legal Aid Officer. Settlement review and certification require the Chief role.
- Every new sensitive mediation action records actor, role, explicit case ID, action, and timestamp in the existing append-only audit array. Caucus audit entries never include note text.
## Device simulator presentation

- `/device` continues to default to IVR, with `/device/ivr` and `/device/ussd` selecting the same underlying scripted flow.
- The compact screen retains SIM entry, call/dial controls, keypad or USSD response, voice input, emergency transfer, and the required canonical application-field writes.
- The handset display is fixed at a compact height and scrolls long prompts internally; keypad and primary phone controls retain 44px minimum targets.
- Device sessions are page scoped. Opening, switching to, or reloading a device route starts with no active session or conversation history. The device flow does not call the transcript persistence API.
- There is no separate conversation or simulated-message pane. Voice text entry appears inside the handset display only when the current IVR node requires text.
- Developer JSON, provenance, audit inspection, and the `/debug` navigation control are not presented in the device user interface.
- Removing diagnostic UI does not remove the underlying audit, provenance, persistence, or `/debug` route used by developers elsewhere.
## Admin directory: mediators and UDC operators

- `ManagedRole` includes `mediators` and `udcOperators` alongside citizens, lawyers, and officers.
- Admin mediator creation writes the existing `DlasDb.mediators` registry shape with a `MED-*` identifier, nested contact record, district, status, role, qualification, supported tracks, supported case types, default availability, and append-only mediator/admin audit entries.
- Editing a mediator updates that same registry record; it does not create a second mediator account store or change mediator authentication.
- UDC operator administration continues to write `DlasDb.udcOperators`. Saving an operator creates or updates the corresponding `REGISTERED_OPERATOR` entry in `DlasDb.udcCentres`.
- Admin overview totals and audit aggregation include mediator and UDC operator accounts.
- Deletion requires an explicit confirmation. It removes the account from its role directory while preserving application and admin audit history, then writes `account.deleted` or `mediator.account_deleted` to the admin audit.
- A mediator with an active, non-revoked mediation assignment and a lawyer with an offered or accepted assignment cannot be deleted. The administrator receives an inline dependency error.
- Deleting a UDC operator removes its linked `REGISTERED_OPERATOR` centre entry; demo-directory and unrelated centre entries remain.
## Admin sidebar behavior

- Admin sidebar links map directly to the implemented `overview`, `users`, `cases`, `rules`, `mediation`, `audit`, and `backup` sections.
- Hash changes update the visible admin workspace without a full page reload.
- Clicking Overview from a hash section clears the hash and restores the overview.
- Exactly one sidebar item is active: the hashless Overview item is active only when no section hash is present.
- Admin colors are scoped through --admin-* tokens. The active black theme restores the original red administrator palette.
- The Admin sidebar, including the সাক্ষ্য wordmark plate, uses the scoped admin palette rather than the shared black wordmark background. Other role sidebars remain unchanged.

## Theme snapshot and restoration

- `frontend/app/tokens.css` is the active theme source imported by `frontend/app/globals.css`.
- `frontend/app/themes/black_theme.css` is the preserved snapshot of the original global, role, status, and admin tokens.
- `frontend/app/themes/red_white.css` preserves the courthouse image theme.
- frontend/app/themes/black_theme.css is active. blue_white.css and red_white.css are saved alternatives.
- Theme presentation is CSS-only. No theme selector or theme state appears in the product UI.
- `globals.css` imports the active theme after `tokens.css`. Developers switch among the saved themes by changing that single import path; no component or application state changes are required.


### Blue White visual refresh

The saved, inactive CSS-only theme in frontend/app/themes/blue_white.css now uses ocean blue (#1764d9), navy (#142d50), white, and pale blue surfaces. This supersedes the earlier supplied palette. Featured admin, lawyer, and UDC panels use a subtle blue gradient; controls have softer corners, blue focus states, and gentle hover shadows. Pages and dialogs fade in briefly only when reduced motion is not requested. Errors and destructive actions retain red. Black theme is currently selected in globals.css, and saved alternate themes remain available without a theme button.
