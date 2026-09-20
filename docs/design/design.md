# JurisFlow — Design

> Visual design system for the JurisFlow UI. For what to build, see [`spec.md`](./spec.md). For how it works technically, see [`architecture.md`](./architecture.md).

## 1. Direction

**A modern editorial publication combined with a refined software product.** Quiet, sharp, calm, and serious. This is a justice-sector tool, so the interface earns trust through clarity, not decoration.

Reference: the Harvey marketing site: off-white canvas, a large serif headline, black rectangular buttons, a text-only nav with thin spacing, and a black app sidebar with a subtly lighter active row.

**Golden rule:** choose the simpler option. Black and white first. Add red or yellow only when the meaning requires it. If an element doesn't help the user, remove it.

**JurisFlow-specific rule:** the interface communicates *reasons and next steps*. Every alert, label and status shows plain-language text. Color is never the only signal.

---

## 2. Design tokens

### CSS variables

```css
:root {
  /* Color */
  --black: #000000;
  --white: #FFFFFF;
  --off-white: #F7F7F5;
  --ink: #1A1A1A;        /* dark gray: body text on light, sidebar active row */
  --gray: #666666;       /* metadata, secondary text */
  --line: #E5E5E5;       /* hairlines, card borders */
  --red: #E53935;        /* accent: escalated, errors, destructive */
  --yellow: #F4C430;     /* accent: watch, warnings, highlights */

  /* Type */
  --font-serif: "Playfair Display", "Noto Serif Bengali", Georgia, serif;

  /* Spacing (4px base) */
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px; --s-6: 24px;
  --s-8: 32px; --s-12: 48px; --s-16: 64px; --s-20: 80px;

  /* Radius */
  --r-0: 0; --r-1: 2px; --r-2: 4px; --r-3: 6px; --r-4: 8px;

  /* Layout */
  --page-max: 1280px;
  --page-pad: 48px;      /* 16px on mobile */
}

body {
  font-family: var(--font-serif);
  color: var(--black);
  background: var(--off-white);
  font-variant-numeric: lining-nums tabular-nums;  /* see note below */
}
```

**Numerals.** Playfair Display defaults to old-style figures, which look uneven in dates, times and IDs. Always set `lining-nums tabular-nums` so hearing dates, deadlines and case references align.

### Tailwind (if used)

```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      ink: "#1A1A1A", gray: "#666666", line: "#E5E5E5",
      "off-white": "#F7F7F5", accent: { red: "#E53935", yellow: "#F4C430" },
    },
    fontFamily: { serif: ["var(--font-playfair)", "var(--font-bengali)", "Georgia", "serif"] },
    borderRadius: { DEFAULT: "4px", md: "6px", lg: "8px" },   // never larger
    boxShadow: { none: "none" },
  },
}
```

### Fonts (Next.js)

```ts
import { Playfair_Display, Noto_Serif_Bengali } from "next/font/google";
export const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
export const bengali  = Noto_Serif_Bengali({ subsets: ["bengali"], variable: "--font-bengali", display: "swap" });
```

**Bangla note:** Playfair Display has no Bengali glyphs. Any Bangla text falls back to Noto Serif Bengali, which keeps the serif feel. The fallback is already in `--font-serif`. Do not introduce any other font family.

---

## 3. Color usage

Black and white dominate. Accents are small and semantic.

| Token | Use | Never |
|---|---|---|
| Black `#000` | Primary buttons, headings, sidebar, active states | — |
| Off-white `#F7F7F5` | Page background | — |
| White `#FFF` | Cards, inputs, table surfaces | — |
| Ink `#1A1A1A` | Body text, active sidebar row | — |
| Gray `#666` | Metadata, timestamps, helper text | Primary content |
| Line `#E5E5E5` | Hairlines, borders | — |
| **Red** `#E53935` | Escalated priority, errors, destructive actions | Backgrounds of large areas |
| **Yellow** `#F4C430` | Watch priority, warnings, one highlighted word | Text on white (low contrast) |

Rules:
- No gradients, glassmorphism, neon, colored page backgrounds, or textured/photographic backdrops.
- Only one accent color per component.
- Yellow is used as a dot, small badge fill (with black text), or highlighter, never as text on white.
- Red on white is used for dots, borders and semibold text at 14px or larger. Check contrast whenever red is used for small text.

### Priority and status mapping (the only colored UI in the product)

| Meaning | Treatment |
|---|---|
| **Watch** | 8px yellow dot + "Watch" |
| **Needs action** | 8px black dot + "Needs action" |
| **Escalated** | 8px red dot + "Escalated" (text semibold) |
| Alert state (Open, Acknowledged, In progress, Resolved) | Plain gray text; Resolved gets a thin check, no color |
| Message status (QUEUED, SENT, DELIVERED, FAILED) | Plain text; FAILED in red |
| **Simulated** (SMS, clock) | Small uppercase gray label with a 1px dashed border |
| Attendance unknown | Gray italic text, no badge |

---

## 4. Typography

One family: **Playfair Display** (with the Bangla fallback above).

| Role | Size / line-height | Weight | Notes |
|---|---|---|---|
| Hero / page display (marketing, empty states) | 56–72 / 1.05 | 600–700 | Use rarely, only where it improves hierarchy |
| Page title (H1) | 40 / 1.15 | 600 | One per page; letter-spacing −0.01em |
| Section heading (H2) | 28 / 1.25 | 600 | |
| Subheading (H3) | 20 / 1.3 | 600 | |
| Body | 16 / 1.6 | 400 | |
| Small body / table cell | 15 / 1.5 | 400 | |
| Label / metadata | 13 / 1.4 | 400–500 | Gray; optional uppercase with +0.06em tracking |
| Button | 15 / 1 | 500 | |

- Editorial feel comes from scale contrast and whitespace, not from making everything large.
- Keep body line length to about 60–75 characters.
- Minimum text size is 13px. On mobile, body stays at 16px or larger.
- Hierarchy per page: **primary heading → supporting text → primary action → secondary content.**

---

## 5. Layout and spacing

- **Grid:** 12 columns, `--page-max` 1280px, consistent horizontal margins (48px desktop, 24px tablet, 16px mobile).
- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 80. Most components use 16, 24, 32, and 48.
- **Vertical rhythm:** 48px between page sections, 24px between a heading and its content, 16px between related items.
- Sections may alternate white and off-white. Large areas stay visually quiet.
- Everything aligns to the grid. No cramped clusters, no unfinished-looking voids.

### App shell (officer, admin)

```
┌────────────┬──────────────────────────────────────────────┐
│ JurisFlow  │  Page title                    [Primary action]│
│            │  Supporting line (gray)                        │
│ Queue      │  ─────────────────────────────────────────    │
│ Cases      │  Content on off-white / white                  │
│ Admin      │                                                │
│ Simulator  │                                                │
│            │                                                │
│ (user)     │                                                │
└────────────┴──────────────────────────────────────────────┘
```

- **Sidebar:** black, 240px, white Playfair text, text-only items (no icons unless functional). Active item: `#1A1A1A` background, 4px radius. Wordmark "JurisFlow" at the top in semibold.
- **Top bar:** none. Page title and primary action sit in the content header.
- **Simulator + clock** live in the sidebar as a separate section labelled **Simulated**.

### Lawyer and citizen views
Mobile-first, single column, no sidebar. A simple top wordmark and 2–3 text links. Large tap targets (44px minimum). Officer/admin views are desktop-first and remain usable on tablet.

---

## 6. Components

### Buttons
| Type | Style |
|---|---|
| Primary | Black fill, white text, 4px radius, padding 12px 20px. Hover: `#1A1A1A` |
| Secondary | White fill, 1px black border, black text. Hover: off-white fill |
| Destructive | Red fill, white text. Only for genuinely destructive actions (e.g. reassign, cancel hearing) |
| Text link | Black, underline on hover, no color change |

One primary button per view. No pill shapes. Disabled: gray text on `--line` background.

### Inputs and forms
White background, 1px `--line` border, 4px radius, 12px 14px padding, label above in 13px gray-to-black. **Focus: 1px black border** plus a 2px black outline offset for keyboard visibility. Errors: red 1px border and a red message below. 24px between fields. No floating labels.

### Navigation
Text-only, plenty of spacing, hairline separators. No dropdown stacks, no icon rows. Current page is indicated by a black underline (top nav) or the ink row (sidebar).

### Cards (use sparingly)
Only where they separate genuinely distinct information, such as an alert detail summary. White on off-white, 1px `--line` border, 6px radius, 24px padding, no shadow, never nested. Lists and queues use **hairline rows, not cards**.

### Tables and lists (queue, cases)
The core JurisFlow pattern, kept editorial:

```
Priority        Reason                                      Case      Owner        Due
────────────────────────────────────────────────────────────────────────────────────────
● Escalated     Two hearing reports remain overdue          JF-1044   R. Karim     Today
                Attendance unknown; no finding of absence has been made.
────────────────────────────────────────────────────────────────────────────────────────
● Needs action  Hearing report not received after 48 hours  JF-1042   S. Akter      Tomorrow
```

- 1px `--line` row dividers, header row in 13px uppercase gray, no zebra striping, no cell borders.
- Row padding 16px vertical. The reason is the visually dominant text (16px, black); everything else is secondary (gray).
- Row hover: off-white background. Click opens the alert detail.
- Sort order: priority, then age. Escalated rows are simply first, not louder.

### Priority label
Dot + text inline, as in section 3. Always followed or accompanied by the reason. Never a bare "85/100". If a numeric index is ever shown, render it in gray beside the label with the caption *"follow-up priority index · unvalidated heuristic"*.

### Timeline (case)
Vertical 1px `--line` rule at the left, 8px hollow black circle per event, timestamp in gray (lining numerals), event text in black, actor in gray. Alerts and interventions are visually the same weight as other events; only priority dots carry color. Corrections show as a new entry that references the earlier one ("Corrects entry of 12 Sep"), never replacing it. Simulated events carry the **Simulated** tag.

### Alert lifecycle control
A plain row of text states (`Open → Acknowledged → In progress → Resolved`) with the current one in black semibold and the rest gray. Actions beneath as secondary buttons. Deferral opens an inline form asking for a reason and review date.

### Approval gate (generated drafts)
A bordered box: the draft text, a gray line "Drafted with AI · needs officer approval", then a primary **Approve and send** and a secondary **Edit**. Nothing sends before approval.

### Empty, loading, error
- **Empty:** one serif sentence in gray, e.g. "No open alerts. Every expected update is on track." No illustrations.
- **Loading:** a thin 2px black progress line at the top of the content area, or plain text "Loading…".
- **Error:** red text with a plain explanation and a retry text link.

### Icons
Almost none. Allowed only for functional meaning (close, chevron, external link). Black, one consistent 1.5px stroke set (Lucide). No decorative icons in cards, headings or nav.

---

## 7. Screens

| Screen | Layout notes |
|---|---|
| **Officer queue** | H1 "Action queue", gray supporting line with counts, table as in section 6, filters as plain text toggles (All · Escalated · Needs action · Watch) |
| **Case timeline** | H1 is the case reference. Left column: timeline. Right column (320px): case facts, assigned lawyer, next expected event. Hairline dividers only |
| **Alert detail** | Reason as H2. Below: supporting timestamps, rule id + version in gray, action buttons, state control, interventions log |
| **Lawyer view** | Single column. Assigned cases as a hairline list. Report form with attendance, outcome, adjournment reason, and next date as separate fields; primary "Submit report" |
| **Citizen view** | Single column, large type, one status sentence per case, message history below |
| **Admin panel** | Form-style page: grace period, overdue-report count, adjournment count. Show version history as a hairline list |
| **Simulator** | Two-column: fake phone thread (left) and clock control (right). Everything carries the **Simulated** tag; includes a "Force delivery failure" secondary button |

---

## 8. Motion

Subtle and functional only: 150–200ms opacity and background transitions on hover, small 4px translate for menus, smooth expand/collapse for inline forms. No bounces, parallax, or entrance animations. Respect `prefers-reduced-motion`.

---

## 9. Responsive

- Breakpoints: 640 / 1024 / 1280.
- **Tablet:** sidebar collapses to a text menu; the timeline's right column moves below.
- **Mobile:** tables become stacked hairline rows (priority + reason on top, meta beneath); reduce page padding to 16px; buttons go full-width; never allow horizontal page scroll (wide content scrolls inside its own container).
- Keep hierarchy intact; scale spacing down, not the structure.

---

## 10. Accessibility

- Text contrast at least 4.5:1 (gray `#666` on white passes; yellow never used for text on white).
- Priority is always conveyed by text as well as color.
- Visible focus for every interactive element; full keyboard operation of the queue and forms.
- Form labels tied to inputs; errors announced to assistive tech.
- Tap targets at least 44px on citizen and lawyer views.
- Bangla content must render with the Bengali fallback font at the same size and line-height as Latin text.

---

## 11. Copy tone

Plain, calm, neutral. State facts and the next step; never accuse.

- ✅ "Hearing report not received after 48 hours. Attendance unknown."
- ❌ "Lawyer failed to appear."
- ✅ "Message could not be delivered. Contact details may need updating."
- ❌ "Lawyer is not responding."

Sentence case everywhere. Use the "Simulated" tag wherever content is not real.

---

## 12. Agent checklist

Before finishing any screen, confirm:

- [ ] Only Playfair Display (with Bengali fallback); lining tabular numerals on.
- [ ] Mostly black, white, off-white; accents limited to priority dots, failures, warnings.
- [ ] No gradients, shadows, glass, or radii above 8px; no pill buttons.
- [ ] Lists use hairline rows, not stacked cards; no cards inside cards.
- [ ] One primary button per view.
- [ ] Every alert shows its reason; no bare numeric score.
- [ ] Simulated content is tagged.
- [ ] Layout works at mobile width without horizontal scroll.
- [ ] Nothing was added that doesn't help the user.
