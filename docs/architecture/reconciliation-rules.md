# Shakkho — Document Reconciliation Rules

## Document precedence

The governing order is:

1. [ADLASB Final Round Case PDF](../ADLASB/ADLASB-Hackathon_Final-Round_Case.pdf)
2. [PRD](../PRD/PRD.md)
3. [System architecture](architecture.md)
4. [Product specification](../spec/spec.md)
5. [Design system](../design/design.md), code and implementation notes

When two documents conflict, the higher document wins. A lower document may make an implementation choice only where the higher documents are silent, and that choice must not narrow or replace a higher-document acceptance condition.

## Evidence and claim rule

- The ADLASB PDF is the sole authority for competition scope, workflows, named scenarios, acceptance tests and judging criteria.
- External law, policy, programme or numeric claims remain **unverified** until a team member opens the authentic source and records the claim, source, location, date checked and reviewer in the claim register.
- Unverified claims cannot drive automated decisions and must not be presented as established fact in the prototype, paper or pitch.
- Simulated external boundaries must be labelled `SIMULATED`; internal state changes, human decisions, promises and audit entries must remain real.

## Change rule

A change to a higher document must be reconciled downward in the same change. The implementer records any deliberate deviation and its authority; silent divergence is not allowed.
