# সাক্ষ্য — Frontend

Next.js (App Router, TypeScript) frontend for সাক্ষ্য, an evidence-grounded operational layer for
Bangladesh legal aid services. Visual system: `docs/design/design.md`.

Citizen intake controls use consistent token-based hover, selection, and keyboard
focus states. Pointer hover is limited to hover-capable devices, and motion follows
the user's reduced-motion preference.

The administrator dashboard at `/dashboard/admin` uses the shared local record
for live counts, cross-office application monitoring, audit history, and searchable
create/edit/delete controls for citizen, lawyer, DLO officer, mediator, and UDC operator accounts. Account
changes are audited. The DLO review screen offers a reasoned correction form during
verification for applicant, filer, matter, urgency, and safe-contact information.
Changing verified fields reopens the related check; a district change reroutes open work.
Legal decisions remain officer actions. Prototype data lives in browser `dlas.db.v1`.

The administrator Applications section shows each application's hearing schedule. Administrators
can add hearings or edit the date/time, court, and purpose; lawyer-reported attendance and outcomes
remain read-only. Hearing schedule changes persist to `dlas.db.v1`, are audited, and update the due
date of an existing open lawyer-report task when applicable.

The admin Backup tab downloads a dated JSON bundle of app-owned browser storage,
including the shared record and stored document previews. To restore, choose a JSON
file, review the counts, and use **Replace current data and import**. Older `/debug`
record exports are accepted. Import replaces the current browser's app data and reloads
the dashboard.

The current four dashboards are migration-era surfaces, not the final route contract. Build toward
the 35 canonical S01–S35 route templates in `docs/spec/spec.md`: complete Tier 1 acceptance paths
first; keep S24 and S33 thin and treat only S23 export as optional Tier 2. `/dashboard/{role}` and
`/sim/*` are legacy aliases; `/`, `/dlo`, `/lawyer` and `/admin` are canonical routes.

## Stack

- Next.js 16 (App Router, static-server-rendered pages)
- TypeScript, CSS Modules
- `next/font`: Playfair Display (Latin) + Noto Serif Bengali, wired into one serif stack

## Structure

```
app/          routes (sign-in portals + workspaces + dashboard)
app/tokens.css   all design tokens — colors, fonts, spacing, radius, layout, motion
app/themes/black_theme.css   active original black theme
app/themes/red_white.css   saved courthouse image theme overrides
app/themes/blue_white.css   saved blue and white theme overrides
components/   SignInPortal, RoleDashboard, SimulatorPanel, PortalLinks, Wordmark, LanguageToggle,
              Button, Field, Sidebar, LawMark
lib/          i18n context + dictionary, roles, brand, portal-art
```

## Portals

Each role signs in from its own URL; after sign-in the app lands directly on that role's dashboard.

| Role | Sign-in portal | Workspace (after sign-in) | Dashboard |
|---|---|---|---|
| Citizen (নাগরিক) | `/` | `/dashboard/citizen` | `/dashboard/citizen` |
| District Legal Aid Officer (জেলা আইনি সহায়তা কর্মকর্তা) | `/dlo` | `/dashboard/dlo` | `/dashboard/dlo` |
| Panel lawyer (প্যানেল আইনজীবী) | `/lawyer` | `/dashboard/lawyer` | `/dashboard/lawyer` |
| UDC operator (ইউডিসি উদ্যোক্তা) | `/udc` (also `/portal/udc`) | `/dashboard/udc` | `/dashboard/udc` |
| Administrator (প্রশাসক) | `/admin` | `/dashboard/admin` | `/dashboard/admin` |

Citizen notifications at `/dashboard/citizen#notifications` group new and earlier updates, show
readable details and timestamps, and open the related case or dashboard view. The unread count and
mark-all-read control use the citizen account's existing read state.
Document requests such as NID or marriage certificates appear only for applications linked to the
signed-in citizen's session or applicant/representative phone. An open follow-up task does not grant
access to another citizen's application or upload controls.
The home document-upload section appears only when an owned, open application has an outstanding
document; there is no placeholder card when nothing needs uploading.

Successful mediation continues from `/dashboard/mediator` through a persisted settlement state
machine. **Settlement reached** opens manual fields for the issue, proposed and agreed resolution,
conditions, deadline, and additional terms. Party execution is simulated and visibly labelled
`DEMO / SIMULATED`; mediator confirmation is stored separately. The DLO sidebar opens the separate
CLO queue at `/dashboard/dlo/settlements`, with one review route per agreement. Only an explicit
CLO **Certify** action after both signatures and mediator confirmation records `RESOLVED` and may
create settlement follow-up tasks. Return and clarification actions reopen mediator correction;
revised terms require fresh execution and confirmation.

Failed mediation also continues through a persisted workflow. **Mediation failed** collects the
mediation date, attendance, discussed issues, outcome, optional reason/status, follow-up need, and
proposed referral without requesting confidential caucus notes. It creates a formal failure/referral
record and an advisory system suggestion. The separate officer queue is available at
`/dashboard/dlo/mediation-outcomes`; officers may confirm, change the path, or request more
information. Confirming `LAWYER_ASSIGNMENT` creates the existing panel-lawyer assignment task and
exposes that workflow in the DLO case workspace. The citizen timeline shows the handoff from
mediation through officer review to lawyer assignment.

The DLO workspace opens on `#overview` (also the default route). Its header shows the active
workload, the four status tiles navigate to `#new`, `#review`, `#decided`, and `#tasks`, and charts
summarize the current office's applications by queue state, matter, and filing channel. Those four
queue pages show their worklist without repeating the overview. The DLO sidebar has a separate
Overview link and labelled queue counts. Worklist links open `#app/<APP-ID>` for the existing review
flow; each application and follow-up record has a visible **Open application** control. The records
wrap their labelled fields across the available width without horizontal scrolling. All queue
figures come from `dlas.db.v1` and follow the selected Bangla or English language.
The open-application review form uses the full workspace width and has no separate audit-trail
sidebar. Audit entries are still persisted and remain available through the existing activity and
debug views.
For lawyer-path cases, the Panel lawyer section provides the complete ending flow: record the
representation outcome, review the payable-hearing count, use **Pay lawyer (simulated)**, and enter
a closing note to enable **Close case**. Closure is blocked until every recorded lawyer payment is
paid, then the application becomes `RESOLVED`, the citizen is notified, and the action is audited.

The legacy lawyer dashboard at `/dashboard/lawyer` has focused Overview, Assignments, Reports,
and Schedule views that match its sidebar links. The assignment offer supports acceptance or a
required decline reason. The hearing report collects attendance, outcome, and next date separately.
Its sample case data and action feedback are labelled simulated and remain in the current session.

The UDC dashboard opens with a new assisted application action, operator-scoped work counts and
recent intakes. The sidebar groups Overview, application work and support destinations. Consent
and document links open their dedicated intake panels. Connection diagnostics are available in an
expandable strip, and the global header provides the language toggle. The `/udc` sign-in page
uses the existing mobile login and operator registration flow with UDC-specific art and copy.

The `/device/ivr` and `/device/ussd` simulators share a guided phone workspace. A mode switch,
three-step introduction, handset, conversation, and live-record panel make the active task clearer.
The panels stack on narrow screens. Both modes still write to the shared intake record, and
simulated telephone and gateway behavior stays labelled.

*Quick test login:* For fast evaluation on `/` (Citizen), quick-test credentials (Mobile: `a`, Password: `a`) are provided with **Auto-fill** and direct **Quick enter** buttons.

Each portal links to the other three. Role names, descriptions and routes live in `lib/roles.ts`.
Every role signs in with a **mobile number and a password**; both are required before the primary
action becomes available. Sign-in portals split into two panes: a black art pane with the law-mark
(a clear, high-contrast law emblem image rendered via `components/law-mark.tsx` with `object-fit: cover`, `--lawmark-opacity` token, a soft protective vignette, and a geometric hairline grid) and a login
pane. **Each role has its own art treatment** so the entry points are easily distinguished:
`lib/portal-art.ts` picks the image (from `assets/`), the side (left or right), and the token
accent colour per role (`--accent-citizen` blue, `--accent-dlo` red, `--accent-lawyer` green,
`--accent-admin` violet). A rotated role label identifies the art pane.

The DLO and Lawyer login pages share the same form shell but have distinct entry treatments: DLO
uses right-side office-review imagery and a red seam; Lawyer uses left-side case-representation
imagery and a green seam. Each has bilingual role-specific copy and a labelled art caption. Their
existing sign-in fields and destinations are unchanged.
The Lawyer desktop portal keeps both columns at viewport height, with sign-up scrolling inside the
form column so the image crop stays steady and no gap appears below it. Tablet and mobile use fixed
stacked image heights and normal page scrolling.
The rotated DLO image label is larger and aligned near the image's left edge, with responsive sizing.

**Dashboard** (`/dashboard/{role}`): WordPress-style layout with a black
left sidebar (240px, sticky) containing role-specific navigation for core roles (citizen, dlo, lawyer, admin) and operational roles, Wordmark, and a "Simulated"
section (clock/SMS/court/scenario/reset). Content area is off-white, max-width 1280px, centered.
Header has hamburger menu (mobile) and language toggle. Mobile: sidebar slides in via overlay.
Navigation labels from i18n (Bangla/English). The role pages are implemented in
`components/role-dashboard.tsx`: citizen status and reply controls, lawyer assignments/reporting,
the DLO live office queue and review flow, and admin measures/rule drafts. The DLO queue and
review read and write the local shared record through `lib/dlas/`. The sidebar simulation links are backed by the local-only
`/sim/{clock|sms|court|scenario|reset}` control panel; it changes visible demo state without
claiming a backend mutation. See `components/sidebar.tsx` and `app/dashboard/layout.tsx`.

Nothing hardcodes a color or font family outside `app/tokens.css` and
`app/layout.tsx`; change the whole look in those two files.

### Saved theme

The active theme is app/themes/black_theme.css, imported after app/tokens.css in app/globals.css. This restores the original black and off-white appearance and red admin palette. The blue_white.css and red_white.css alternatives remain saved.

To switch themes, change the active theme import in `app/globals.css` among `./themes/blue_white.css`, `./themes/red_white.css`, and `./themes/black_theme.css`. No component code or product-facing switch is involved.

## Language

Every screen renders fully in Bangla (default) or fully in English. The text-only toggle
(`বাংলা · English`) in the header switches the entire interface; the choice persists in
`localStorage` (`shakkho.lang`) and updates `<html lang>`. Add strings to `lib/i18n.tsx`
(`messages.bn` / `messages.en`) — never mix languages within one line.

## Commands

```bash
npm install
npm run dev       # http://localhost:3000
npm run build
npm run start
npm run lint
```
### Court mediation and mediation privacy (Features 8–9)

- The legal pathway form captures mediation origin and all court referral fields. Court-origin matters reuse `/dashboard/mediator` and remain labelled throughout assignment and mediation.
- Certified court settlements and confirmed court-path failure records create a `COURT_AUTHORITY_NOTIFICATION` task. Officer dispatch recording is explicitly simulated.
- `lib/dlas/mediation-access.ts` contains the mediation role/scope matrix and case access helpers.
- Mediator caucus content is stored under `workspace.mediatorConfidential` and is omitted from public/officer projections. Assigned-mediator checks run on reads and every mutation.
- DLO sign-up supports Legal Aid Officer and Chief Legal Aid Officer authority roles. Only the Chief role can open the settlement certification worklist or certify an agreement.
- Mediation sensitive-action audits include an explicit `caseId`; confidential note text is never copied into an audit entry.
### Device simulator UI

`/device` defaults to the IVR simulator; `/device/ivr` and `/device/ussd` select the corresponding phone flow. The interface uses a compact heading, a two-option mode switch, and one centered handset. The handset display has a compact fixed height with internal scrolling for longer prompts, and its keypad and call controls retain 44px targets. Every mount starts fresh: the active device session is not restored and the flow neither stores nor shows conversation history. Voice text entry appears inside the handset when required. The device surface omits message, live JSON, and debug-console panels while continuing to write required application fields, provenance, audit events, handoffs, and submissions.
### Admin mediator and UDC management

`/dashboard/admin#users` includes Mediators and UDC operators. Mediator add/edit uses the shared `db.mediators` registry and captures status, role, district, qualification, mediation tracks, and case types. UDC operator add/edit uses `db.udcOperators` and synchronizes the associated registered UDC centre. Both flows append admin/account audit entries; the existing mediator verification, certification, assignment, and login workflows remain in place.

Every People row has a Delete action with a confirmation dialog. Deletion preserves historical application and admin audit records and writes a deletion audit event. Active mediator and lawyer assignments block removal with an inline message. Deleting a UDC operator also removes the operator's linked registered centre entry.
### Admin sidebar

The admin sidebar links to Overview, People, Applications, Policy, Mediation oversight, Audit, and Backup. Hash links update the admin workspace in place; the Overview control clears an existing hash correctly. Admin styling uses scoped `--admin-*` tokens across the sidebar, page background, hero, tabs, cards, tables, forms, dialogs, and interaction states, leaving DLO, lawyer, mediator, UDC, and citizen interfaces unchanged.
The সাক্ষ্য wordmark plate in the Admin sidebar also uses the admin hero and border tokens, removing the shared black block so the complete Admin workspace presents one burgundy visual identity.


### Blue White visual refresh

The saved, inactive CSS-only theme in frontend/app/themes/blue_white.css now uses ocean blue (#1764d9), navy (#142d50), white, and pale blue surfaces. This supersedes the earlier supplied palette. Featured admin, lawyer, and UDC panels use a subtle blue gradient; controls have softer corners, blue focus states, and gentle hover shadows. Pages and dialogs fade in briefly only when reduced motion is not requested. Errors and destructive actions retain red. Black theme is currently selected in globals.css, and saved alternate themes remain available without a theme button.
