# Reconciliation rules

## Document precedence

The governing order is:

1. **[ADLASB Final Round Case PDF](../ADLASB/ADLASB-Hackathon_Final-Round_Case.pdf)** — competition scope, mandatory workflows, acceptance evidence and Annex business rules;
2. **[PRD](../PRD/PRD.md)** — Shakkho's product interpretation of the ADLASB requirements;
3. **[System architecture](architecture.md)** — technical realization of the PRD;
4. lower-level specifications, designs, generated contracts and code comments.

When two documents conflict, the higher document wins. A lower document may add implementation detail but may not remove, weaken or reinterpret a higher-level mandatory requirement. Resolve discovered conflicts by correcting the lower document and recording the decision; do not make the code choose silently.

This same precedence is linked from the [architecture header](architecture.md). The evidence reconciliation rules below govern conflicting case observations; they do not override the document precedence above.

## States and decision order

`PENDING` means a required value is not yet due; `MISSING` means it is overdue. `REPORTED` is one
attributed source, `CORROBORATED` is agreement by at least two independent actors or organisations,
and `VERIFIED` requires an uncontested source authoritative for that exact assertion. `DISPUTED`
preserves incompatible active values. `STALE` means a time-sensitive value has expired.
`VERIFIED_WITH_RESOLVED_CONFLICT` requires a valid officer resolution.

The engine: (1) applies explicit supersession, (2) selects the requested field, (3) decides absent
value, (4) groups policy-normalized active values, (5) handles conflict and any valid resolution,
then (6) applies freshness, assertion-specific authority, independent corroboration or reporting.

## Authority, independence and history

Authority is scoped to the assertion. A cause list can establish that a hearing was listed, not
that it occurred. An order can establish an outcome expressly recorded in it. Officer authorship
alone is not authoritative. Conflicting authoritative records are still disputed.

Multiple channels from one actor are one source. Records from one organisation are not
independent merely because there are two records. Where actor identity is available it is used;
otherwise organisation identity is used. Supersession only changes which observations are active;
the superseded IDs remain explainable and every database row remains intact.

A conflict resolution must match the field, cite all active conflicting observations, choose one
of the active normalized values, and include both an authority basis and non-empty reason.

## Signature demonstration

A lawyer's 28 September report and a cause-list 30 September record produce `DISPUTED`, even
though one source is authoritative. Both remain on the timeline. An authorised officer who cites
both observations, the supporting order and a written reason may select 30 September; the derived
state becomes `VERIFIED_WITH_RESOLVED_CONFLICT`. The 28 September report remains preserved. A
later notification can be queued via an outbox without claiming it has already been delivered.
