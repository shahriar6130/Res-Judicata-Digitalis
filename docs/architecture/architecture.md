# Frontend dashboard architecture

The canonical system architecture and business model live in `docs/PRD/PRD.md`. This document
records the implemented frontend boundary for the four current role portals.

## Component boundaries

```text
app/layout.tsx
  I18nProvider
    sign-in portal -> role.home
    dashboard/layout.tsx
      Sidebar(role)
      LanguageToggle
      RoleDashboard(role)
        CitizenDashboard | OfficerDashboard | LawyerDashboard | AdminDashboard
    sim/[[...tool]]/page.tsx
      SimulatorPanel(tool)
```

`RoleDashboard` is a client boundary because the prototype controls need local state and event
handlers. Route pages remain server components and pass only the role identifier. Component styles
use colocated CSS Modules; global type and colour tokens remain in `app/tokens.css`.

## Authority boundary

The Next.js layer presents data and gathers intent. It does not derive legal eligibility, resolve a
conflict, declare misconduct, approve payment, or make another consequential decision. The DLAO
evidence drawer exposes the inputs that a future authorised decision API must receive, while its
resolution button remains disabled. The administrator rule editor stores only a local draft.

Current dashboard records are deterministic prototype fixtures. Local state is intentionally reset
on reload. When backend integration is added, read data must come from generated contracts and all
mutations must pass server-side role and case scope. The interface must display queued, sent,
delivered, and failed notification states separately.

## Routing

`lib/roles.ts` is the source for sign-in destinations. Each role now lands directly on
`/dashboard/{role}`. Dashboard navigation uses same-page section fragments to avoid unfinished
routes. The optional catch-all `/sim/[[...tool]]` supports the five simulator links with one shared
panel.

## Responsive shell

The desktop sidebar is sticky. At 1024px and below it is translated off canvas until
`DashboardLayout` passes `open=true`; an overlay and navigation callback close it. The role is read
from the dashboard URL and controls only the navigation and role component selection.
