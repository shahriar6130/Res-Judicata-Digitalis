# Build Roadmap — Ordered Prompt Index

**Product:** Shakkho — ADLASB Final Round prototype  
**Protocol:** [00-BUILD-PROTOCOL.md](00-BUILD-PROTOCOL.md)  
**Precedence:** ADLASB PDF → PRD → architecture → specification → design/code.  
**Order:** dependency-first. The shared record and human-control mechanisms are built before case screens.  
**Stack:** fixed by the architecture; a prompt may add a library only with a recorded one-line reason.

Only the current prompt is generated and executed. Later rows are the approved roadmap, not permission to create or build everything at once.

| # | Prompt filename | Outcome | PDF coverage | Input gate |
|---|---|---|---|---|
| 01 | `01-repository-audit-and-baseline-gap-report.md` | Evidence-backed repository baseline | Prototype standard; all | Done |
| 02 | `02-day-one-risk-and-build-gates.md` | Green build/test baseline plus OCR, TalkBack, PWA and scheduler risk evidence | A2, T6, T10, G4, G8 | Only for deviations |
| 03 | `03-foundation-shared-record-tenancy-roles-ids-reset.md` | Authoritative record, tenant isolation, server authority, IDs and deterministic reset | G1, G9; Annex rules 1–3 | Only for deviations |
| 04 | `04-foundation-ledger-vault-provenance-audit.md` | Ledger/vault transaction boundary, provenance, withdrawal and audit | G1, G2, G10 | Only for deviations |
| 05 | `05-foundation-state-machines-human-decision-gate.md` | Enforced workflow states and authorised human decisions | G5; Annex B2 blocks/rules | Open decisions listed first |
| 06 | `06-foundation-promises-clock-outbox-safe-contact.md` | Promise ownership, deadlines, escalation, virtual time and safe notifications | G3, G7, G8 | Open decisions listed first |
| 07 | `07-citizen-access-representation-status.md` | Web intake/status, representation and safe Status Sentence | A1, A2, A5, G2, G3 | Required if plan differs |
| 08 | `08-ivr-ussd-sms-and-16699-access.md` | Screenless/low-literacy doors and shared-record 16699 console | A2, B3, five doors, G4 | Required if plan differs |
| 09 | `09-t5-conversational-bangla-intake.md` | Bounded Bangla slot intake with provenance and human handoff | T5 | Required |
| 10 | `10-udc-assisted-intake-and-t6-documents.md` | UDC assistance, consent, document control and source-anchored briefing | A4, B4, T6, G2, G6 | Required |
| 11 | `11-t9-offline-sync-and-t10-low-bandwidth-pwa.md` | Encrypted offline queue, conflict review, installable Light-mode PWA | T9, T10, G8 | Required for open trade-offs |
| 12 | `12-dlao-operations-verification-routing-and-report.md` | DLAO queue, eligibility, routing, appeal, closure checks and B7 report | B1, B7; Annex blocks 2–4, 6 | Required |
| 13 | `13-t3-t4-t8-dlao-intelligence.md` | Related cases, duplicate review and explainable triage disagreement | T3, T4, T8 | Required |
| 14 | `14-b2-mediation-and-t7-settlement.md` | Full mediation attempts/ODR fallback and three reviewed settlement drafts | B2, T7 | Required |
| 15 | `15-t11-asynchronous-signing-and-verifier.md` | Two-party async signing plus standalone no-network verification | T11 | Required |
| 16 | `16-a3-b6-t2-referral-and-escalation.md` | Sensitive referral, receiver acknowledgement and two-return human rerouting | A3, B6, T2 | Required |
| 17 | `17-a5-b5-panel-lawyer-and-case-status.md` | Lawyer assignment/updates and Malek's safe pre-travel status | A5, B5 | Required |
| 18 | `18-t1-lawyer-change-and-payment-reconciliation.md` | Change request, handover, inactivity review and interim payment stages | T1 | Required |
| 19 | `19-audit-failure-lab-selftest-and-release.md` | Audit/export, 23/23 navigator, Failure Lab, expanded selftest and public-release gates | G1–G10; all 23; five doors | Only for unresolved release choices |
| P1 | `P1-solution-paper.md` | Two-page/1,000-word evidence-based paper | Deliverable 1 | Required |
| P2 | `P2-pitch-deck-and-fallback-video.md` | Deck, 10-minute pitch and ≤90-second fallback video | Deliverables 2–4 | Required |

## Six-slice mapping

| Slice | Prompts |
|---|---|
| Foundation | 02–06 |
| 1. Safe accessible intake | 07–09 |
| 2. Assisted/offline intake | 10–11 |
| 3. DLAO operations | 12–13 |
| 4. Mediation and settlement | 14–15 |
| 5. Urgent referral | 16 |
| 6. Lawyer accountability | 17–18 |
| Cross-cutting acceptance | 19 |

**Cut line:** remove Tier 2 depth first—S23 export, expanded S24 grievance administration and editable S33 tooling. Never cut a named failure, mandatory acceptance path, human authority, shared-record write or audit evidence.

**Delivery dates from the case:** paper by 26 Sep 11:59 PM; public prototype, deck and fallback video by 27 Sep 8:00 AM. Freeze product scope by 25 Sep.
