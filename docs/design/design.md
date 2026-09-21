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
