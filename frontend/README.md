# Shakkho — Frontend

Next.js (App Router, TypeScript) frontend for Shakkho, an evidence-grounded operational layer for
Bangladesh legal aid services. Visual system: `docs/design/design.md`.

## Stack

- Next.js 16 (App Router, static-server-rendered pages)
- TypeScript, CSS Modules
- `next/font`: Playfair Display (Latin) + Noto Serif Bengali, wired into one serif stack

## Structure

```
app/          routes (sign-in portals + workspaces)
app/tokens.css   all design tokens — colors, fonts, spacing, radius, layout, motion
components/   SignInPortal, PortalLinks, Wordmark, LanguageToggle, Button, Field, PlaceholderPage
lib/          i18n context + dictionary, roles, brand
```

## Portals

Each role signs in from its own URL; after sign-in the app lands on that role's workspace.

| Role | Sign-in portal | Workspace (after sign-in) |
|---|---|---|
| Citizen (নাগরিক) | `/` | `/citizen` |
| District Legal Aid Officer (জেলা আইনি সহায়তা কর্মকর্তা) | `/dlo` | `/dlo/home` |
| Panel lawyer (প্যানেল আইনজীবী) | `/lawyer` | `/lawyer/home` |
| Administrator (প্রশাসক) | `/admin` | `/admin/home` |

Each portal links to the other three. Role names, descriptions and routes live in `lib/roles.ts`.
Every role signs in with a **mobile number and a password**; both are required before the primary
action becomes available. Sign-in portals split into two panes: a black pane with the law-mark — a
grayscale, low-opacity image (`assets/justice-stands-strong-stockcake.jpg`) under a white hairline
grid overlay (`components/law-mark.tsx`) — and an off-white pane with the login column.

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