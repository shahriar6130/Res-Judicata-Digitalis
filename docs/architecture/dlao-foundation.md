# DLAO branch and architecture foundation

**Branch:** `DLAO`  
**Status:** Foundation only—no complete DLAO workflow is claimed.  
**Authority:** ADLASB final-case PDF → PRD → reconciliation rules → architecture → specification.

## 1. Purpose

The DLAO module is the operational case-management surface over Shakkho's shared legal-aid record. It is not a parallel dashboard database. Its job is to help authorised officers and staff receive work, understand evidence and delay, make only the decisions assigned to them, coordinate panel lawyers and reconstruct accountability.

This branch remains independent for Ahan to review and merge into `main`. It must not merge itself.

## 2. Existing architecture inspected and retained

| Area | Current repository reality | Foundation decision |
|---|---|---|
| Frontend | Next.js 16/React 19/TypeScript, bilingual role portals and local-state dashboards | Reuse components, tokens and role metadata. Ahan connects later views to HTTP contracts; local UI state is not acceptance evidence. |
| Backend | FastAPI with SQLAlchemy/Alembic and generated OpenAPI contracts | Keep FastAPI; place DLAO commands/queries under `app/modules/dlao`; keep security shared. |
| Database | Supabase/PostgreSQL schema for applications, cases, observations, milestones, promises, decisions and audit events | Extend through migrations; never create a DLAO-only copy of a case. |
| Authentication | Not implemented. Role portal forms are presentation only. | A later verified-session adapter derives actor scope server-side. Never trust a client-supplied role or scope. |
| Authorisation | RLS is enabled, but current SQL policies allow the service role broad access; endpoints do not enforce actor scope | Add a pure deny-by-default policy now; connect it to authenticated FastAPI dependencies and transaction queries later. Do not claim enforcement yet. |
| APIs | Health, case read, observation write and a deliberately unavailable resolution route | Preserve contracts. New DLAO APIs must authenticate and authorise before querying/mutating. |
| Integrations | Supabase client/config only; no live notification, 16699 or payment integration | Keep external services behind labelled adapters/simulators. Internal workflow must remain real. |

The historical `Solved/00-repo-baseline.md` predates backend foundation now present on `main`; it remains historical evidence and must not be used to conclude that the current repository has no backend.

## 3. DLAO operational scope

Planned workflow, delivered incrementally:

```text
Application intake
→ verification and missing-information work
→ eligibility/assessment packet
→ authorised decision or applicable committee review
→ service-path/routing decision
→ panel assessment and human lawyer assignment where required
→ active case/service tracking
→ lawyer progress, hearing/order and next-action updates
→ delay/urgency visibility and notifications
→ outcome and authorised closure
→ routine reporting and audit reconstruction
```

The exact authorised decision-maker comes from the versioned authority matrix; the module must not hardcode that every decision belongs to one committee or officer.

### Required projections

- **Applications:** new, verification state, assessment state, pending human decision, accepted/rejected, route and lawyer-assignment readiness.
- **Panel lawyers:** panel status, active/inactive, self-declared availability and timestamp, office/practice scope, assignment load and overdue updates/reports.
- **Cases:** owner office, assigned lawyer, pathway/stage, last verified update, next hearing, last order/update, next obligation, priority and overdue reason.
- **Officer work:** evidence-first decision queue, oldest/most urgent broken promises, required human action, policy version and audit history.

## 4. Module boundaries

```text
app/security/authorization.py       shared role/scope policy
app/modules/dlao/                   DLAO commands, queries and projections
app/models/                         shared canonical records
app/domain/                         shared deterministic domain rules
app/api/endpoints/                  authenticated HTTP adapters
backend/packages/contracts/         generated handoff for Ahan
frontend/                           role-scoped presentation consuming API only
```

The DLAO module may orchestrate shared records but may not own a second auth model, audit store, notification truth, case table or frontend-only state machine.

## 5. Authorisation foundation

Access requires the applicable intersection of tenant, verified role, office, case relationship/assignment and action permission. Missing scope denies access.

| Role | Foundation access | Explicitly excluded |
|---|---|---|
| DLAO/authorised officer | Office-scoped application/case work; eligibility, priority and lawyer-assignment decision actions | Other tenants/offices; unauthorised restricted evidence |
| Other legal-aid staff | Office-scoped list/read/verify/prepare assessment/report | Eligibility, priority or lawyer-assignment decisions |
| Panel lawyer | Read and submit progress only for an assigned case where the lawyer relationship matches | Other lawyers' cases; DLAO decisions and reports |
| Citizen | Read only the citizen's related application/case projection | Staff queues, co-applicants, internal evidence and other citizens |

`app.security.authorization` is intentionally pure and tested. It is not authentication. A future dependency must create `ActorScope` from a verified server session and apply the decision before every database query or mutation. PostgreSQL queries must still filter tenant/office/case, and later RLS policies must be tightened; a Python decision alone is not defence in depth.

## 6. Human-control boundary

Technology may prepare completeness checks, evidence, workload, reminders, priority indicators and reports. Eligibility/rejection, final priority, consequential routing, panel assignment/reassignment and closure remain authorised human actions with evidence, policy version, reason and attributable audit event. Lawyer inactivity patterns prompt review and never establish misconduct.

## 7. Incremental delivery plan

1. Connect verified prototype sessions to the shared authorisation dependency and tenant/office/case-filtered repositories.
2. Build the DLAO application queue and verification/assessment packet over `Application`.
3. Add the Human Decision Gate and valid application/case transitions.
4. Add routing/service-path and panel-lawyer registry/workload/assignment.
5. Add case monitoring, lawyer updates, promises, urgency and notifications.
6. Add event-derived reporting, audit projection and Ahan's frontend integration after each slice.

Each slice must expose an API contract, deterministic fixture, automated allow/deny tests, state/audit evidence and a frontend integration checklist. External simulators call the same APIs; they may not replace workflow logic.

## 8. Current non-goals and known gaps

- No real login/session or MFA exists.
- The policy is not yet attached to current endpoints.
- Existing case endpoints can return fixtures and are not safe production projections.
- Current observation writes catch persistence errors and use non-cryptographic Python `hash`; later ledger work must replace this.
- Current RLS policies are not user/office/case isolation policies.
- No lawyer registry, assignment, hearing/order, notification or reporting entity/API is added in this foundation step.
- No complete PDF item is marked implemented, integrated or testable by this branch foundation alone.

## 9. Handoff to Ahan

Ahan should consume generated OpenAPI/contracts, never import Supabase in the frontend, and never reproduce authorisation or workflow transitions in React state. Each screen action must call an authorised backend command and render the resulting state, task and audit reference. Presentation integration should follow each completed DLAO slice rather than waiting until all backend work is complete.
