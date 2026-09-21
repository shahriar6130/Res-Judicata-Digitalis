# Dashboard design system

This document defines the implemented frontend dashboard treatment for the four role portals. The
canonical product and authority model is `docs/PRD/PRD.md`.

## Direction

The interface combines an editorial legal publication with a restrained operational tool. It uses
an off-white canvas, black navigation, hairline divisions, large serif headings, and clear reasons
before actions. It does not use gradients, shadows, decorative cards, unexplained scores, or colour
as the sole signal.

All colours, type sizes, spacing, radii, and motion values come from `frontend/app/tokens.css`.
Playfair Display and Noto Serif Bengali form the one permitted font stack. Bangla is the default;
the text toggle changes the entire visible interface to English and persists the choice.

## Sign-in portals and art treatment

- Sign-in portals split into two columns (stacked on mobile/tablet): a dark art pane with the law-mark imagery and a clean form pane.
- The law-mark component (`components/law-mark.tsx`) displays high-resolution legal emblem imagery using `object-fit: cover` at `--lawmark-opacity` (0.78).
- A subtle vertical vignette gradient ensures high contrast for the top-bar Wordmark and language toggle, while retaining clear visibility of the central justice sculpture.
- A geometric hairline grid (`--grid-line`, `--grid-size`) overlays the art pane, maintaining the technical editorial aesthetic.
- Each role portal alternates image and side layout (left vs right) along with its distinctive role accent chip.
- For testing convenience, the Citizen sign-in portal (`/`) provides a quick-test credential prompt (`mobile: "a"`, `password: "a"`) with **Auto-fill** and **Quick enter** buttons that immediately navigate to `/dashboard/citizen`.

## Shared dashboard shell

- Desktop uses a sticky 240px black sidebar and a centered content region up to 1280px.
- The sidebar contains the role navigation and a separate Simulated section.
- Below 1024px the sidebar becomes a working slide-in drawer with an overlay.
- Content uses one primary action per view, 1px hairline lists, square 2-4px controls, and generous
  whitespace.
- Every interactive element has a visible keyboard focus state and citizen/lawyer controls meet the
  44px tap-target requirement.

## Role views

### Citizen

Lead with one safe status sentence and one verified next action. Keep case information minimal for
shared-device safety. Citizen actions are separate neutral controls: confirm, dispute, and request a
callback. Source detail is collapsed until requested.

### DLAO

Lead with the exception/intervention queue. Each row shows visible priority text, the plain-language
reason, case reference, promise/evidence state, and age. The evidence drawer displays conflicting
values side by side. A consequential resolution stays disabled until an authorised backend decision
gate exists.

### Panel lawyer

Show assignments and deadlines as hairline sections. Accept and decline are explicit actions.
Hearing updates keep attendance, outcome, and next date as separate labelled inputs so one value
cannot imply another.

### Administrator

Show sourceable service counts, versioned policy values, authorised-user totals, and audit events.
Administrators can draft configuration changes but cannot make legal or case-consequential
decisions from this view.

## State and simulation treatment

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
