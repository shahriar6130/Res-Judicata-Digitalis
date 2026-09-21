# ____Spec____ 

> What to build, for whom, and how to know it works. For the technical design (components, flows, data model), see [`architecture.md`](./architecture.md).

**Tagline:** Every assigned case deserves a clear next step.

**One-liner:** JurisFlow helps District Legal Aid Offices in Bangladesh see when an expected step after lawyer assignment is missing, explains why it matters, and tracks the officer's follow-up until the gap is actually resolved.

**Status:** Hackathon prototype. Thresholds and demo cases are illustrative, not legal deadlines or validated predictions. JurisFlow is a proposed complement to the existing legal-aid systems, not a replacement.

---

## 1. Principles

1. **Explainable.** Every alert and priority shows its reason. No unexplained "Risk 85/100".
2. **Humans decide.** The system recommends follow-up. It never decides reassignment, payment, eligibility, discipline or misconduct.
3. **AI is optional.** The system works fully with AI off. AI only drafts wording or summarizes.
4. **One gap = one alert.** Re-checking never duplicates.
5. **History is append-only.** Corrections add records; nothing is overwritten.
6. **Silence is not risk.** A future hearing with nothing overdue produces no alert.
7. **A failed SMS is not lawyer negligence.** It creates a contact-repair task.
8. **Attendance ≠ outcome; reported ≠ verified.** Stored separately.
9. **A call attempt alone does not close an alert.**
10. **Simulated things are labelled.** SMS, clock and payments are clearly marked; no real money moves.

"Risk" means operational follow-up priority only, not case-loss probability or misconduct.

---

## 2. Scope

**MVP (build this)**
- Case intake (web form or staff walk-in entry)
- Lawyer assignment: officer picks from a filtered list (practice area + availability)
- Hearing schedule and structured hearing report
- SMS simulator with delivery states, including forced failure
- Friction engine: Reporting, Communication, Document
- Priority labels with reasons: Watch / Needs action / Escalated
- Officer action queue with owner and due time
- Case timeline
- Simulated clock and scheduler
- Admin rule/threshold panel
- n8n automations: reminder, friction alert, approval-gated escalation letter

**Stretch:** remaining friction categories, operational charts, claim-status screens, Bayesian priority layer.

**Out of scope:** real payments (bKash/Nagad), WhatsApp, IVR/voice intake, Whisper, RAG, OCR, NID check, real court or OMS integration, e-filing, legal chatbot, lawyer leaderboards, outcome prediction.

---

## 3. Roles

| Role | Does |
|---|---|
| **Citizen** | Applies, views status, receives SMS |
| **Panel lawyer** | Accepts assignments, submits hearing reports |
| **DLO / officer** | Approves cases, assigns lawyers, owns the action queue, approves consequential messages |
| **Office staff** | Maintains records, enters phone updates, handles contact-repair tasks |
| **Admin** | Configures thresholds, manages users, views metrics |

Everyone signs in from their own portal with a **mobile number and password**. Each sign-in portal
splits into a black art pane and a login pane; the art image, its side, and the **RGB accent
colour** per role (`--accent-citizen` blue, `--accent-dlo` red, `--accent-lawyer` green,
`--accent-admin` violet) vary, and the login pane leads with a bold white-on-black role chip,
so the four entry points are easy to distinguish (`lib/portal-art.ts`). §8 of the PRD describes the
role-specific screens; §12 is the acceptance check.

---

## 4. Screens

1. **Officer action queue** — sorted by priority then age; each row shows label, plain-language reason, owner, due time, and an "attendance unknown" chip where relevant.
2. **Case timeline** — assignments, hearings, reports, messages (with delivery state), alerts, interventions, corrections. Simulated items badged.
3. **Alert detail / intervention form** — reason, supporting timestamps, rule id + version, actions (call attempt, obtain update, request verification, reassign), state transitions.
4. **Lawyer view** — assigned cases, accept/decline, hearing report form with attendance, outcome, adjournment reason and next date as separate fields.
5. **Citizen view** — apply, status, message history.
6. **Admin panel** — grace period, overdue-report count, adjournment count, users.
7. **SMS simulator + clock control** — send/receive fake SMS, force a failure, advance time.

UI copy: always show the reason; show "rule-based, not yet calibrated" near any numeric index; label simulated messaging. Every screen ships in complete Bangla (default) and complete English, switched by the text-only language toggle — no per-line mixing.

---

## 5. Demo scenarios

Use fictional data, a simulated clock, and clearly labelled SMS simulation.

**A. Detect a reporting gap and close the loop** (case JF-1042)
1. Officer records a hearing; hearing and expected-report deadline appear in the timeline.
2. Simulator sends a reminder; message and simulated delivery state appear.
3. Clock advances past the grace period with no reply; the gap is detected.
4. A Needs-action alert shows reason, owner, due time, and "attendance unknown".
5. Officer records a call attempt; intervention is logged, **alert stays open**.
6. Officer records the lawyer's reported attendance, adjournment and next date; report is marked self-reported.
7. Engine re-evaluates; alert resolves, history is retained, next reminder is scheduled.

**B. Report arrives but next date is unknown.** The reporting gap resolves; a separate date-check task stays open and escalates to scheduling follow-up if it goes overdue. *Resolving one issue does not hide another.*

**C. Correct non-alert** (JF-1043). Hearing six weeks away, nothing overdue. After 14 quiet days, no alert. *Silence alone is not risk.*

**D. Communication failure.** Force a failed SMS; a contact-repair task opens instead of a lawyer-nonresponse alert. Staff fixes the contact and the engine re-evaluates.

**E. Escalation.** Separate case with two consecutive overdue reports and no delivery failure. Priority becomes Escalated, both gaps are explained, and human review is assigned. No automatic "absent" label, no automatic reassignment.

**Approval gate (add to A or E).** The engine drafts an escalation letter; it stays pending until the officer approves, then n8n sends it and the send is logged.

### Seed data
~30 synthetic cases across family, criminal and land types, with synthetic names and phones. Include: missing report, failed SMS, missing document, two overdue reports, a far-future hearing, three adjournments. Loaded by a resettable fixture script.

---

## 6. Acceptance checklist

Write a test for every line.

- [ ] One issue generates one active alert, even when evaluated repeatedly.
- [ ] Priority always has a visible reason.
- [ ] Every actionable alert has an owner and due time.
- [ ] A contact attempt alone does not close an alert.
- [ ] New information resolves only the gaps it actually clears.
- [ ] Future hearings do not produce inactivity alerts.
- [ ] Failed delivery creates a contact-repair task, not lawyer escalation.
- [ ] Corrected dates invalidate obsolete expectations and stale reminders.
- [ ] History survives resolution and correction.
- [ ] Rule id + version is stamped on every alert.
- [ ] Consequential outbound messages cannot send without officer approval.
- [ ] The system works end-to-end with the LLM disabled.
- [ ] Simulated messaging and clock are visibly labelled.
- [ ] Every endpoint enforces role-based access.
- [ ] Every role signs in from its own portal with a mobile number and password; both fields are validated.

---

## 7. Build order

1. Models, migrations and seed script.
2. Auth and RBAC with seeded role accounts.
3. Case, assignment, hearing and report endpoints; every mutation writes an Event.
4. Simulated clock and scheduler.
5. Friction engine (`evaluate_case`): Reporting, then Communication, then Document, with tests.
6. Alert state machine and deduplication.
7. Priority labels and reason text.
8. Frontend: queue, timeline, alert detail, lawyer report form, admin rules.
9. SMS simulator, outbox worker, delivery states.
10. n8n workflows: reminder, friction alert, gated escalation letter.
11. Optional ChatGPT drafting behind a feature flag with template fallback.
12. Demo hardening: run scenarios A–E end to end.

---

## 8. Do not

- Let AI or ChatGPT decide priority, state, assignment, eligibility, payment or discipline.
- Put friction logic in n8n.
- Delete or overwrite events, reports or resolved alerts.
- Raise inactivity alerts for future hearings.
- Treat SMS failure as lawyer negligence.
- Present the Bayesian weight (0.7) as tuned.
- Hardcode thresholds; read them from `RuleConfig`.
- Build out-of-scope items or claim real integrations, real payments or a court API.

---

## 9. Measures and honest claims

Track hearing-update timeliness, time to first intervention, time to resolution, cases with no next step, alert usefulness and staff follow-up effort. Include unresolved alerts and spot-check non-alerted cases for missed gaps.

There is no evidence yet that JurisFlow reduces delay. It is a pilot hypothesis: earlier detection → earlier intervention → fewer preventable delays. Do not claim the prototype has reduced court delays.

---

## 10. Jury Q&A

- **"Bangladesh already digitizes case tracking. What's new?"** Tracking says what state a case is recorded in. JurisFlow asks whether the expected work is actually happening and who needs to act.
- **"Why not use ChatGPT for the risk score?"** Prioritization in a justice setting must be explainable and auditable. Rules and weighted factors can be inspected; model reasoning cannot. AI is used for wording, not judgment.
- **"Where's the evidence it reduces delay?"** None yet. It's a pilot hypothesis, and the metrics exist to test it.
- **"Does it replace the government system?"** No. It consumes case events and adds the monitoring and intervention layer on top.

---

## 11. Open decisions

- Real grace periods and SLAs per office (currently illustrative).
- Which system is authoritative for each date or event.
- Which existing DBLA/NLASO systems can be integrated, and whether it's authorized.
- SMS provider and cost model (SMS is not automatically free).

---

## 12. Future ideas (not in the prototype)

Borrowed from the related Shakkho concept, worth adding after the core loop works:
- **Evidence states** per milestone: verified / corroborated / reported / disputed / missing / stale.
- **Citizen confirmation** as an independent observation. A disagreement triggers review, not a verdict.
- **Reconciliation view** showing conflicting dates side by side until an officer resolves with a cited reason.
- **Mediation workflow** as its own commitments (mediator assigned, parties contacted, session held, outcome recorded).
- **Payment-readiness packet**. Readiness only; approval and disbursement stay with the authorized process.
- Neutral, privacy-safe SMS wording, since phones may be shared.
