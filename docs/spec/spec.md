# Role dashboard specification

This specification covers the four currently implemented portal endpoints. Broader roles and later
flows remain governed by `docs/PRD/PRD.md`.

## Routes and outcomes

| Role | Sign-in | Dashboard | Required first outcome |
|---|---|---|---|
| Citizen | `/` | `/dashboard/citizen` | Understand and respond to the safe next action |
| DLAO | `/dlo` | `/dashboard/dlo` | Find the oldest or most urgent unresolved promise/evidence exception |
| Panel lawyer | `/lawyer` | `/dashboard/lawyer` | Accept work and submit the next structured update |
| Administrator | `/admin` | `/dashboard/admin` | Inspect operations and draft versioned policy changes |

Successful prototype sign-in routes directly to the matching dashboard. For citizen evaluation, the prototype provides quick test credentials (mobile: `a`, password: `a`) with one-click **Auto-fill** and direct **Quick enter** actions.

## Functional requirements

### Citizen dashboard

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

- Allow assignment acceptance or reasoned decline in the local prototype.
- Show reporting deadlines and missing obligations.
- Collect attendance, outcome, and next date as separate required fields.
- Label the resulting update as self-reported evidence rather than verified truth.

### Administrator dashboard

- Show sourceable operational measures, active policy version, authorised-user totals, and recent
  audit events.
- Allow a local rule draft with a required version note.
- Do not expose legal decisions, overrides, or case resolution controls to the administrator.

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
