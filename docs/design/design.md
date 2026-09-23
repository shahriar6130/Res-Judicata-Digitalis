# Dashboard design system

This document defines the implemented frontend treatment for Shakkho's canonical route inventory.
Document precedence is the ADLASB PDF, then `docs/PRD/PRD.md`, architecture, specification and this
design file. The specification's 35 routes are delivered by tier: acceptance-critical Tier 1 first;
S24 and S33 stay thin, while only S23 export—not its B7 report/search—is optional Tier 2.

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
- `/dlo` keeps the art on the right and uses the office review image, a red seam, and officer-specific copy. `/lawyer` keeps the art on the left but uses the alternate justice image, a green seam, and case-representation copy. Both use the same split layout, serif hierarchy, restrained hairlines, and responsive stacked treatment. Their role captions and accent dots retain text labels so colour is never the only distinction.
- On `/dlo`, the rotated **DLO** image label uses the larger `--t-portal-dlo-role` type token and sits close to the image's left edge. Its anchor accounts for the rotated text width so it stays visible; tablet and mobile sizes step down with the existing type scale.
- `/udc` is the dedicated operator entry page; `/portal/udc` remains available. It places the alternate justice image on the right and pairs a token-based amber seam with UDC-specific service copy. The existing mobile-only login and operator registration fields are unchanged.
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

Citizen notifications at `/dashboard/citizen#notifications` group new and earlier updates under
hairline headings. Each entry shows a full title and supporting text, a localised timestamp, a
labelled new state, and a clear route into the related detail. The unread treatment uses a dark
rule and text label, never colour alone. The mark-all control stays visible and has a 44px target;
the list reflows without horizontal scrolling.

### DLAO

Lead with the signed-in officer's applications and follow-up tasks. Each worklist row shows its
application reference, applicant, channel, matter, waiting time, suggested priority, verification
state and review stage. The review workspace keeps identity, documents, eligibility and officer
decision as distinct steps, with the source record and audit trail available alongside them.

The implemented `/dashboard/dlo` Overview (`#overview`, also the default route) uses a dark
editorial header with the active workload count, four linked queue totals, three compact charts,
and a new-application worklist. The `#new`, `#review`, `#decided`, and `#tasks` pages lead directly
with their worklist and do not repeat the charts or summary tiles. The black DLO sidebar separates
Overview from the queue links with a hairline, shows office counts beside labelled links, and uses
a light active state with a visible keyboard focus outline. All colours and fonts come from tokens.
The worklist uses stacked, hairline-separated records instead of a wide table. Details wrap into
fewer columns as the viewport narrows, so the page needs no horizontal scrolling; opening an
application keeps the existing review workspace.
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

`/dashboard/udc` leads with a new assisted application action, operator-scoped work counts, recent intakes, and a short service tool list. Submitted records open the operator's applications list; unfinished intakes return to their workspace. The sidebar groups Overview, application work, and support destinations. Connection status stays visible as a compact strip while its diagnostic and simulation controls expand on request. Consent and document destinations open their dedicated intake panels. The global dashboard header owns the Bangla/English toggle, so UDC does not repeat it in the content area. On smaller screens, the hero, counts, and records wrap into columns without horizontal page scrolling.
UDC subpages share a white, amber-edged heading surface, serif titles, and clear keyboard focus. Their queue rows and form grids stack at narrow widths.

### Administrator

Show sourceable service counts, versioned policy values, authorised-user totals, and audit events.
For this prototype S33 is a read-only seeded configuration reference, not a full policy-pack editor.
Administrators cannot make legal or case-consequential decisions from this view.

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

## /device (IVR, USSD) and /debug

- Styles: `frontend/components/dlas/dlas.module.css`, tokens only. New token `--font-mono` (JSON and ids).
- /device pages show a step trail, the handset, and a right-hand **Live record** panel with the JSON being written. The citizen wizard and UDC screens keep their own design; UDC workspace gains a "Shared record" section.
- Simulated external services (SMS gateway, telephone network, speech-to-text, USSD gateway) always carry a dashed "Simulated" tag.
- IVR and USSD are rendered as a dark handset; prompts, keypad and transcript are bilingual (Bangla default).
