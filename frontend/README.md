# Shakkho — Frontend

Next.js (App Router, TypeScript) frontend for Shakkho, an evidence-grounded operational layer for
Bangladesh legal aid services. Visual system: `docs/design/design.md`.

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
| Administrator (প্রশাসক) | `/admin` | `/dashboard/admin` | `/dashboard/admin` |

Each portal links to the other three. Role names, descriptions and routes live in `lib/roles.ts`.
Every role signs in with a **mobile number and a password**; both are required before the primary
action becomes available. Sign-in portals split into two panes: a black art pane with the law-mark
(a grayscale, low-opacity image under a white hairline grid — `components/law-mark.tsx`) and a login
pane. **Each role has its own art treatment** so the entry points are easily distinguished:
`lib/portal-art.ts` picks the image (from `assets/`), the side (left or right), and the **RGB accent
colour** per role (`--accent-citizen` blue, `--accent-dlo` red, `--accent-lawyer` green,
`--accent-admin` violet), and the login pane leads with a **bold white-on-black role-chip** naming
the end.

**Dashboard** (`/dashboard/{citizen|dlo|lawyer|admin}`): WordPress-style layout with a black
left sidebar (240px, sticky) containing role-specific navigation, Wordmark, and a "Simulated"
section (clock/SMS/court/scenario/reset). Content area is off-white, max-width 1280px, centered.
Header has hamburger menu (mobile) and language toggle. Mobile: sidebar slides in via overlay.
Navigation labels from i18n (Bangla/English). The role pages are implemented in
`components/role-dashboard.tsx`: citizen status and reply controls, lawyer assignments/reporting,
DLO evidence queue and comparison, and admin measures/rule drafts. These are deterministic
prototype interactions. The officer resolution control is intentionally disabled until the
authorised resolution API exists. The sidebar simulation links are backed by the local-only
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
