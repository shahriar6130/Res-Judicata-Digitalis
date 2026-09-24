# Dashboard design system

This document defines the implemented frontend treatment for Shakkho's canonical route inventory.
Document precedence is the ADLASB PDF, then `docs/PRD/PRD.md`, architecture, specification and this
design file. The specification's 35 routes are delivered by tier: acceptance-critical Tier 1 first;
S24 and S33 stay thin, while only S23 export—not its B7 report/search—is optional Tier 2.

## Direction

The interface combines an editorial legal publication with a restrained operational tool. It uses
an off-white canvas, black navigation, hairline divisions, large serif headings, and clear reasons
before actions. The saved Blue White theme permits subtle gradients on featured panels and restrained hover shadows. It does not use unexplained scores or colour as the sole signal.

All colours, type sizes, spacing, radii, and motion values come from frontend/app/tokens.css and the selected theme. The active theme is frontend/app/themes/black_theme.css, restoring the original black navigation, off-white surfaces, role accents, and red administrator palette. The saved red_white.css and blue_white.css alternatives can be selected through the theme import in globals.css; there is no product theme switch.
Playfair Display and Noto Serif Bengali form the one permitted font stack. Bangla is the default;
the text toggle changes the entire visible interface to English and persists the choice.

## Sign-in portals and art treatment

- Sign-in portals split into two columns (stacked on mobile/tablet): a dark art pane with the law-mark imagery and a clean form pane.
- The law-mark component (`components/law-mark.tsx`) displays high-resolution legal emblem imagery using `object-fit: cover` at `--lawmark-opacity` (0.78).
- A subtle vertical vignette gradient ensures high contrast for the top-bar Wordmark and language toggle, while retaining clear visibility of the central justice sculpture.
- A geometric hairline grid (`--grid-line`, `--grid-size`) overlays the art pane, maintaining the technical editorial aesthetic.
- Each role portal alternates image and side layout (left vs right) along with its distinctive role accent chip.
- `/dlo` keeps the art on the right and uses the office review image, a red seam, and officer-specific copy. `/lawyer` keeps the art on the left but uses the alternate justice image, a green seam, and case-representation copy. Both use the same split layout, serif hierarchy, restrained hairlines, and responsive stacked treatment. Their role captions and accent dots retain text labels so colour is never the only distinction.
- On desktop, the Lawyer art and form columns each occupy the viewport height. The longer sign-up form scrolls within its column, leaving no gap below the image and keeping the image crop and form starting position steady. Tablet and mobile use a stacked image with fixed responsive heights and normal page scrolling.
- On `/dlo`, the rotated **DLO** image label uses the larger `--t-portal-dlo-role` type token and sits close to the image's left edge. Its anchor accounts for the rotated text width so it stays visible; tablet and mobile sizes step down with the existing type scale.
- `/udc` is the dedicated operator entry page; `/portal/udc` remains available. It places the alternate justice image on the right and pairs a token-based amber seam with UDC-specific service copy. The existing mobile-only login and operator registration fields are unchanged.
- `/admin` has no sign-in form in this prototype. It immediately enters `/dashboard/admin`, avoiding
  a credential step for the simulated administrator workspace.
- For testing convenience, the Citizen sign-in portal (`/`) provides a quick-test credential prompt (`mobile: "a"`, `password: "a"`) with **Auto-fill** and **Quick enter** buttons that immediately navigate to `/dashboard/citizen`.

## Shared dashboard shell

- Desktop uses a sticky 240px black sidebar and a centered content region up to 1280px.
- The sidebar contains the role navigation and a separate Simulated section.
- Below 1024px the sidebar becomes a working slide-in drawer with an overlay.
- Content uses one primary action per view, 1px hairline lists, square 2-4px controls, and generous
  whitespace.
- Every interactive element has a visible keyboard focus state and citizen/lawyer controls meet the
  44px tap-target requirement.
- Remote JSON persistence does not add a blocking loading screen: dashboards render immediately
  from the local offline cache, then update through the existing reactive record store when a newer
  Upstash snapshot arrives. Loss of the remote connection leaves the current interface usable and
  queues the newest snapshot for a foreground reconnect retry.
- Admin mutation dialogs and JSON backup actions keep their action busy until online reconciliation
  finishes. Export downloads the reconciled snapshot; import immediately flushes its restored data.
  The resulting bilingual status line says whether the record reached the online database or is
  currently saved only in the browser, so local fallback is never presented as online success.

## Role views

### Citizen

Lead with one safe status sentence and one verified next action. Keep case information minimal for
shared-device safety. Citizen actions are separate neutral controls: confirm, dispute, and request a
callback. Source detail is collapsed until requested.

Citizen notifications at `/dashboard/citizen#notifications` group new and earlier updates under
hairline headings. Each entry shows a full title and supporting text, a localised timestamp, a
labelled new state, and a clear route into the related detail. The unread treatment uses a dark
rule and text label, never colour alone. The mark-all control stays visible and has a 44px target;
the list reflows without horizontal scrolling.
Notifications, the home document reminder, and case links are derived only from applications owned
by the signed-in citizen through their citizen session or matching applicant/representative phone.
An open document or missing-info task is never itself a reason to show another citizen's case.
The home document-upload section is conditional: show its upload actions when an owned, open
application has an outstanding document, and omit the section entirely when none is pending.

### DLAO

Lead with the signed-in officer's applications and follow-up tasks. Each worklist row shows its
application reference, applicant, channel, matter, waiting time, suggested priority, verification
state and review stage. The review workspace keeps identity, documents, eligibility and officer
decision as distinct steps. The active review form uses the full content width and does not reserve
a side column for an audit trail. Audit data remains recorded and available through the dedicated
activity and developer inspection surfaces.

The implemented `/dashboard/dlo` Overview (`#overview`, also the default route) uses a dark
editorial header with the active workload count, four linked queue totals, three compact charts,
and a new-application worklist. The `#new`, `#review`, `#decided`, and `#tasks` pages lead directly
with their worklist and do not repeat the charts or summary tiles. The black DLO sidebar separates
Overview from the queue links with a hairline, shows office counts beside labelled links, and uses
a light active state with a visible keyboard focus outline. All colours and fonts come from tokens.
The worklist uses stacked, hairline-separated records instead of a wide table. Details wrap into
fewer columns as the viewport narrows, so the page needs no horizontal scrolling; opening an
application keeps the existing review workspace.

The DLO sidebar also opens `#udcs`, a district-scoped UDC approval worklist. It shows pending,
approved, and rejected totals plus the registered operator, centre, mobile, registration date, and
last login. The officer may approve one operator, approve every pending operator in the district,
or reject one with a required reason. Operators from another district never appear. Decisions use
token-based status treatments, remain readable on narrow screens, and are recorded in the UDC
account audit history. Pending or rejected operators can sign in to see their status but cannot
enter the assisted-intake workspace.

For a lawyer-path case, the DLO workspace ends with a visible three-step sequence: complete the
representation, approve and send the clearly labelled simulated lawyer payment, then close the
case with a required note. The Close case control remains disabled until every recorded lawyer
payment is marked paid. A closed case shows its outcome, officer, closing note, and timestamp.
It also shows the generated testimonial reference and confirms delivery to the citizen case page.
On that owned citizen page, a bilingual simulated-document card presents the testimonial ID,
case and application references, parties, matter, participating lawyers, hearing count, recorded
outcome and reasons, issuing officer, office, and issue time. The notification opens that case page.
Each application and follow-up record also has a labelled, outlined **Open application** control,
so the application ID is not the only way to enter the review.

### Panel lawyer

`/dashboard/lawyer` uses one focused section per sidebar destination: Overview, Assignments,
Reports, and Schedule. The overview leads with one next action and a small set of explained
counts. Assignment details, report obligations, and hearing dates use hairline sections rather
than decorative cards. Accept and reasoned decline are explicit actions. Hearing updates keep
attendance, outcome, and next date as separate labelled inputs so one value cannot imply another.
The dashboard labels its sample data and session-only feedback as simulated. On narrow screens,
metrics, detail fields, and hearing rows stack without horizontal page scrolling.

### UDC operator

`/dashboard/udc` leads with a new assisted application action, operator-scoped work counts, recent intakes, and a short service tool list. UDC assisted intake uses the same five-step layout, fields, validation, safe-contact choice, consent, and submission result as the citizen **Lodge a complaint** flow; only identity verification differs, because the logged-in operator attests that the applicant or representative is present. The UDC document step is a sealed, forward-only hand-off: it displays only an opaque transfer count and readiness status, never evidence contents, thumbnails, filenames, file size, or document-quality inspection. Legacy UDC intake, consent, and document URLs resolve to this shared wizard so they cannot reopen the former evidence viewer. Submitted records open the operator's applications list; unfinished entries return to the shared wizard. The sidebar groups Overview, application work, and support destinations. Connection status stays visible as a compact strip while its diagnostic and simulation controls expand on request. The global dashboard header owns the Bangla/English toggle, so UDC does not repeat it in the content area. On smaller screens, the hero, counts, and records wrap into columns without horizontal page scrolling.
UDC subpages share a white, amber-edged heading surface, serif titles, and clear keyboard focus. Their queue rows and form grids stack at narrow widths.

### Administrator

Show sourceable service counts, versioned policy values, authorised-user totals, and audit events.
For this prototype S33 is a read-only seeded configuration reference, not a full policy-pack editor.
Administrators cannot make legal or case-consequential decisions from this view.

The admin workspace replaces sample figures with counts and recent activity from
`dlas.db.v1`. Its dark heading, compact metric row, focused hash sections, and searchable
role directory use the existing tokens and Bangla/English toggle. Administrators can add,
edit, and delete citizen, panel-lawyer, DLO officer, mediator, and UDC operator accounts;
each change writes an audit entry. Delete is a red outlined row action that opens a focused
confirmation dialog naming the account and explaining retained history. The application section monitors all offices and channels. It does not
offer legal decisions. During an open DLO verification, a disclosure form lets the
officer correct applicant, filer, matter, urgency, and safe-contact details with a
required reason. Changed values retain provenance and old values in the audit; changes
to verified details reopen the affected checks. District corrections reroute open work.

The administrator Backup section has separate Export JSON and Import JSON panels. Export
downloads one dated file with app-owned browser data, including the shared record and
stored document previews. Import accepts the current bundle or an older shared-record
JSON export, validates it, shows application/account/document counts, and requires a
visible Replace action before restoring and reloading the dashboard.

## State and simulation treatment

The citizen intake wizard uses the same token-based interaction pattern for choice
cards, acting-for pills, safe-contact slots, progress buttons, and upload controls.
Hover on pointer devices gives unselected choices a light surface and a clear ink
outline without changing their size; selected choices retain their stronger selected
state. Keyboard focus has a separate visible outline. Touch devices do not keep a
sticky hover treatment, and reduced-motion preferences remove transitions.

States are text inside thin rectangular outlines. `DISPUTED` and `MISSING` use the red token;
`STALE` uses a dashed gray outline; other states use black or gray. Priority uses an 8px dot plus
text: yellow Watch, black Needs action, red Escalated.

All demo-only material carries a dashed Simulated label. `/sim/clock`, `/sim/sms`, `/sim/court`,
`/sim/scenario`, and `/sim/reset` change visible local prototype state only and clearly say that no
live message, court record, or backend mutation occurred.

## Responsive behavior

At tablet width, two-column content becomes one column and queue rows become stacked records. At
mobile width, page padding reduces to 16px, actions fill the available width, evidence comparisons
stack, and wide content never causes horizontal page scrolling.

## /device (IVR, USSD) and /debug

## Failed mediation and referral review

Choosing **Mediation failed** opens a structured outcome form in the mediator workspace. It shows
mediation date, applicant and respondent attendance, issues discussed, outcome, optional
reason/status, follow-up requirement, and proposed referral pathway. A warning above the fields
states that confidential caucus content must not be included.

The resulting **Mediation failure / referral record** is a bordered procedural record rather than
a failure-status badge. Its system suggestion is presented in a separate advisory block labelled
`SYSTEM SUGGESTION`. The officer screen at
`/dashboard/dlo/mediation-outcomes/[applicationId]` follows with a `LEGAL AID OFFICER REVIEW`
section and three explicit actions: Confirm referral, Change pathway, and Request more information.
When lawyer assignment is confirmed, a labelled sequence shows Mediation → Failure → Referral
record → Legal Aid Officer → Lawyer assignment. Layout, type, colours, focus and responsive stacking
reuse the existing shared tokens and DLO work-surface patterns.

## /device (IVR, USSD) and /debug

## Successful mediation and CLO certification

After **Settlement reached**, the mediator workspace presents one numbered progress strip for
terms, party execution, mediator confirmation, CLO certification, and the recorded legal outcome.
The settlement form uses six labelled fields: issue, proposed resolution, agreed resolution,
conditions, deadline, and additional terms. Copy beside the form states that the mediator enters
the terms manually and that the system does not generate them.

Party rows show applicant, respondent, and mediator separately. Prototype signature controls and
every resulting signature state carry the bilingual `DEMO / SIMULATED` label. The CLO route
`/dashboard/dlo/settlements/[applicationId]` uses the same hairline sections and token-based DLO
work surface. It shows the agreement, case context, execution, and mediator confirmation before
the three decisions: Certify, Return for correction, and Request clarification. Certification is
visibly unavailable until both parties have executed and the mediator has confirmed. A certified
record shows `RESOLVED`, agreement ID, officer, time, outcome, and follow-up work.

## /device (IVR, USSD) and /debug

- Styles: `frontend/components/dlas/dlas.module.css`, tokens only. New token `--font-mono` (JSON and ids).
- `/device` pages show one centered handset without a separate conversation, message, or live-record pane. Developer JSON remains available through the separate `/debug` route and is not displayed in the caller interface. The citizen wizard and UDC screens keep their own design; the UDC workspace retains its own shared-record tools.
- Simulated external services (SMS gateway, telephone network, speech-to-text, USSD gateway) always carry a dashed "Simulated" tag.
- IVR and USSD are rendered as a dark handset; prompts, keypad and transcript are bilingual (Bangla default).
- The `/device/ivr` and `/device/ussd` pages share a short introduction and labelled two-mode switch. The dark handset is the only interaction surface, with a flat bezel, readable screen, large keypad targets, distinct call/end actions, and voice text controls embedded in the display when needed. Mode switching uses a labelled current-page state, and the simulated network or gateway tag remains visible.
## Court-referred mediation and access boundaries (Features 8–9)

The legal-pathway screen records a visible **Mediation origin**: Pre-Litigation, Mandatory Pre-Case, Court-Referred, or Appellate Referral. Court-origin cases display the court name and level, case number, referral date and order/reference, referring authority, litigation stage, and referral deadline in the officer assignment view and the same mediator workspace. A court case therefore remains visually distinct while using the existing mediation workflow.

After certified settlement or officer-confirmed failure return, the officer UI shows a separate referring-authority dispatch card. External delivery is labelled **DEMO / SIMULATED** and requires a human-entered dispatch reference.

The mediator workspace labels its general sections **PUBLIC CASE RECORD** and the caucus section **MEDIATOR CONFIDENTIAL NOTES**. Confidential caucus content is visually contained, uses design tokens, and never appears in citizen, officer, CLO, lawyer, or administrator projections. The mediator sees only the current assigned case and its need-to-know party, document, communication, and accessibility fields. The CLO settlement link and certification screen are available only to a Chief Legal Aid Officer account.
## Device simulator simplification

The `/device`, `/device/ivr`, and `/device/ussd` views use a compact introductory heading followed by a two-option IVR/USSD switch and one centered handset. The handset uses a fixed compact display with internal scrolling for longer prompts, reduced bezel spacing, and 44px keypad and call targets. Each visit starts with a clean phone session. Conversation history is neither displayed nor written by the device UI. Duplicate onboarding instructions, secondary workspace content, progress strips, messages, and live JSON/debug panels are omitted so the current prompt and response remain visually dominant. The global device header does not expose the developer debug console.
## Admin mediator and UDC directory

The `/dashboard/admin#users` account directory includes Mediators and UDC operators as peer role tabs. Mediator rows show name, mediator ID, phone, district, and status. The add/edit dialog records the mediator's account details, registry role, status, qualification, mediation tracks, and case types. UDC operator rows and forms continue to show the linked centre and district, and saving an operator synchronizes its registered UDC centre record. The overview count includes both groups.
The adjacent `/dashboard/admin#training` section remains a first-class admin destination. Each
mediator row shows training/certification state, provider, validity, and verification state. Its
token-styled bilingual dialog edits the canonical training fields and required history note, clearly
warning that the change resets verification rather than silently qualifying the mediator.

Every account row includes Edit and Delete controls. Delete requires confirmation, returns an inline error when an active mediator or lawyer assignment blocks removal, and keeps historical application and audit records. Deleting a UDC operator also removes only that operator's linked registered centre entry.

The Admin Applications section expands each application with its hearing schedule. Hearing rows show
date and time, court, purpose, and the preserved lawyer-reported outcome. Administrators may add a
hearing or correct its date, court, and purpose in a focused dialog. The edit surface does not change
attendance or outcomes, and every schedule addition or correction is audited.
## Admin sidebar

The admin dashboard uses the selected theme's dedicated admin palette across the complete workspace. The active theme gives the sidebar, সাক্ষ্য wordmark plate, hero, controls, page surface, panels, dialogs, notices, and tables one burgundy family; the wordmark never falls back to the shared black plate. In Blue White, those same scoped tokens resolve to its saved blue palette. The sidebar contains Overview, People, Applications, Policy, Mediation oversight, Audit, and Backup. Its compact workspace heading reads System administration.

Under the image theme, the same admin variables resolve to its saved courthouse treatment. Restoring the black theme restores the burgundy administrator palette and original role colors.


### Blue White visual refresh

The saved, inactive CSS-only theme in frontend/app/themes/blue_white.css now uses ocean blue (#1764d9), navy (#142d50), white, and pale blue surfaces. This supersedes the earlier supplied palette. Featured admin, lawyer, and UDC panels use a subtle blue gradient; controls have softer corners, blue focus states, and gentle hover shadows. Pages and dialogs fade in briefly only when reduced motion is not requested. Errors and destructive actions retain red. Black theme is currently selected in globals.css, and saved alternate themes remain available without a theme button.

## Multi-party service actions

The mediation assignment surface renders every active mediator as its own bordered assignment
record and leaves the case-specific eligibility picker available for adding a co-mediator. Citizen
intake presents alleged-person defence as a fourth acting-for choice using the same token-driven
pill treatment. On owned lawyer cases, the lawyer-change control is a calm action card with three
plain states: request available, waiting for DLAO, and approved/update soon. DLAO review uses the
existing warning/task and action patterns. Completion notices say only that mediation is complete
and the testimonial is ready. Requested-document notices disappear after upload.
