Dear Team,

Thank you for the thoughtful questions — they are exactly the right ones to ask before you commit your limited time. Here are my answers, grounded in the Final Round Case document itself.

Q1. Do we need to build a solid tech-enabled backend?
No production-grade backend is expected — no Kubernetes, no real database cluster, no live SMS gateway. But read the case's Prototype standards carefully: "Working = the core logic genuinely functions with sample data and changes system state," and "Concept-only = a slide, wireframe or verbal explanation without working logic does not count as implementation." So a purely visual click-through, where a button shows a success message but nothing actually changes, will not count.

A JSON-based local store is perfectly acceptable as your "backend," on these conditions:

State must survive a page reload. A juror must be able to open the scenario later and see the change. If the citizen is on a phone and the officer on a laptop, the store must be server-side, so that every role sees the same record.
The JSON must hold an audit[] array on every record and a provenance tag on every field, because the jury must be able to tell applicant-confirmed, representative-reported and AI-inferred data apart.

Q2. Architecture plus a simulation-based prototype, or a working prototype?
Both — but be precise about what "simulation" may mean. Per the case, a clearly labelled mock/simulator is acceptable only for external integrations that cannot reasonably be connected live (SMS, IVR/16699, payment, NID). Your own workflow, state transitions and audit entries must actually work. And the architecture is a must: System integration & architecture is 20% of the score, and the case requires "one shared record architecture… rather than separate mini-projects." Design the shared record / task / audit model first, then build the flows on top of it.

Q3. Are we implementing technology, or solving the cases?
Solving the cases — through a working architecture. All 5 citizen scenarios, 7 provider scenarios and 11 technical challenges are mandatory and must be reachable and testable, but the case explicitly says to reuse common components rather than build 23 separate things. Two non-negotiable rules: (a) never show anything that does not really work — the jury may inspect any item during Q&A; (b) eligibility, rejection, final priority, lawyer assignment, mediation outcome and closure always remain with an authorised human — AI and automation are advisory only, and every module must fail visibly and safely (retry, handoff, human review), never silently.

Q4. Will solution architecture add value?
It is the backbone. 40% of the score (architecture 20% + technical quality 20%) is judged on shared records, clear state transitions, no disconnected feature islands, and source traceability. A clear high-level design showing how the shared record, common services and the 11 technical modules connect will support both criteria directly — and make your 10-minute pitch far easier to structure.

In short: build the shared record first, make one citizen journey work end to end, then extend — and never demonstrate anything that does not genuinely change state. Feel free to reach out if anything above needs clarification.

Best regards,
Moudud Hassan
Technical Mentor, ADLASB Hackathon