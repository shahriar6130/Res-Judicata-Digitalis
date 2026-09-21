# DLAO module boundary

This package will contain DLAO-specific application commands, queries and role projections. It must reuse the shared `Application`, `Case`, `Observation`, `Milestone`, `PromiseTask`, `Decision` and `AuditEvent` records.

Planned subareas are added incrementally: application work queue, verification/assessment packet, authorised decision gate, routing, panel-lawyer registry/assignment, case monitoring, reporting projection and audit view.

Do not place authentication, shared ledger/vault logic, generic promises, notification transport or frontend presentation state inside this package. The current branch adds only this boundary and the shared pure authorisation policy in `app.security.authorization`.
