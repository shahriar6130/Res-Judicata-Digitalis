# সাক্ষ্য — Frontend

Next.js (App Router, TypeScript) frontend for সাক্ষ্য, an evidence-grounded operational layer for
Bangladesh legal aid services. Visual system: `docs/design/design.md`.

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

The DLO workspace opens on `#overview` (also the default route). Its header shows the active
workload, the four status tiles navigate to `#new`, `#review`, `#decided`, and `#tasks`, and charts
summarize the current office's applications by queue state, matter, and filing channel. Those four
queue pages show their worklist without repeating the overview. The DLO sidebar has a separate
Overview link and labelled queue counts. Worklist links open `#app/<APP-ID>` for the existing review
flow; each application and follow-up record has a visible **Open application** control. The records
wrap their labelled fields across the available width without horizontal scrolling. All queue
figures come from `dlas.db.v1` and follow the selected Bangla or English language.

The legacy lawyer dashboard at `/dashboard/lawyer` has focused Overview, Assignments, Reports,
and Schedule views that match its sidebar links. The assignment offer supports acceptance or a
required decline reason. The hearing report collects attendance, outcome, and next date separately.
Its sample case data and action feedback are labelled simulated and remain in the current session.

The UDC dashboard opens with a new assisted application action, operator-scoped work counts and
recent intakes. The sidebar groups Overview, application work and support destinations. Consent
and document links open their dedicated intake panels. Connection diagnostics are available in an
expandable strip, and the global header provides the language toggle. The `/udc` sign-in page
uses the existing mobile login and operator registration flow with UDC-specific art and copy.

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
