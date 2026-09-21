# PDF Traceability Matrix — ADLASB "Five Doors, One Record"

**Source of truth:** ADLASB Final Case PDF. Cited by section/ID (page numbers to be added by the team once confirmed against the printed PDF).
**Rule:** tick a column only when a test or juror-triggerable action proves it. *Implemented* = logic works and changes state; *Integrated* = writes to the shared record/ledger and uses common services; *Testable* = a juror can open it, trigger it and see the result.
**Legend for prompt column:** numbers refer to `Build/00-INDEX.md`.

## 1. Mandatory 23 items (PDF checklist)
| ID | Item | Prompts | Implemented | Integrated | Testable | Notes |
|---|---|---|---|---|---|---|
| A1 | Moyuri — safe contact, identity gap, representation | 06, 07 | [ ] | [ ] | [ ] | Failure test: unsafe person answers |
| A2 | Ripon — blind access, independent status/task | 02, 07, 08 | [ ] | [ ] | [ ] | Accessibility test: no sighted helper |
| A3 | Nabila — urgency, sensitive access, tracked referral | 16 | [ ] | [ ] | [ ] | Failure test: no acknowledgement |
| A4 | Nuching — assisted access, language/provenance, offline | 10, 11 | [ ] | [ ] | [ ] | Failure test: network drop mid-submit |
| A5 | Malek — status, unstable contact, lawyer follow-up | 07, 17 | [ ] | [ ] | [ ] | Failure test: two missed updates |
| B1 | DLAO officer — operational view, override | 12 | [ ] | [ ] | [ ] | Override recorded |
| B2 | Legal Aid Officer/Mediator — mediation + remote/hybrid | 14 | [ ] | [ ] | [ ] | In-person fallback |
| B3 | 16699 agent — shared look-up + Bangla intake/status | 08 | [ ] | [ ] | [ ] | Writes same record |
| B4 | UDC entrepreneur — assisted intake + checklist + notice | 10 | [ ] | [ ] | [ ] | Limited post-submission access |
| B5 | Panel lawyer — worklist, hearings, updates | 17 | [ ] | [ ] | [ ] | Overdue alert without chase call |
| B6 | Receiving DLAO — referral, ack/status | 16 | [ ] | [ ] | [ ] | Non-ack triggers follow-up |
| B7 | Admin/case-support — structured record, search, report | 12 | [ ] | [ ] | [ ] | One routine report |
| T1 | Lawyer change + inactivity pattern + payment reconciliation | 18 | [ ] | [ ] | [ ] | Pattern ≠ misconduct |
| T2 | Jurisdiction ping-pong + escalation | 16 | [ ] | [ ] | [ ] | Human routing decision |
| T3 | Related incident cases + shared evidence | 13 | [ ] | [ ] | [ ] | Link, do not merge |
| T4 | Duplicate detection + human review | 13 | [ ] | [ ] | [ ] | 10–15 records, 2 traps |
| T5 | Conversational Bangla intake agent | 09 | [ ] | [ ] | [ ] | Straightforward + sensitive handoff |
| T6 | Document summary/checklist agent | 02, 10 | [ ] | [ ] | [ ] | 5–6 docs, missing + unreadable |
| T7 | Settlement drafting assistant | 14 | [ ] | [ ] | [ ] | 3 scenarios, inconsistency warning |
| T8 | Multi-agent triage pipeline | 13 | [ ] | [ ] | [ ] | ≥5 cases, one disagreement |
| T9 | Offline-first sync + conflict/integrity | 11 | [ ] | [ ] | [ ] | 3 offline records, 1 conflict |
| T10 | Low-bandwidth PWA | 02, 11 | [ ] | [ ] | [ ] | Normal vs light, same profile |
| T11 | Async secure e-signature | 15 | [ ] | [ ] | [ ] | Signatures + unchanged document |

## 2. Golden Thread (G1–G10)
| ID | Requirement | Prompts | Status | Evidence |
|---|---|---|---|---|
| G1 | One record, many doors/providers | 03, 04 | [ ] | |
| G2 | Representation & provenance | 04, 07 | [ ] | |
| G3 | Safe contact | 06, 07 | [ ] | |
| G4 | Accessibility & inclusion | 02, 08, 11 | [ ] | |
| G5 | Human control | 05, 12–18 | [ ] | |
| G6 | Complete file & document control | 10 | [ ] | |
| G7 | Tracked responsibility | 06, 14, 16–18 | [ ] | |
| G8 | Resilience | 02, 06, 11 | [ ] | |
| G9 | Role-based privacy | 03 | [ ] | |
| G10 | End-to-end audit | 04, 19 | [ ] | |

## 3. Five doors
| Door | Prompts | Status | Evidence |
|---|---|---|---|
| 16699 / IVR / voice | 08 | [ ] | |
| USSD / SMS | 08 | [ ] | |
| Web / mobile | 07, 11 | [ ] | |
| Assisted access (UDC/helper) | 10 | [ ] | |
| DLAO / referral route | 12, 16 | [ ] | |

## 4. Annex B2 workflow blocks and business rules
| Block | Prompts | Status |
|---|---|---|
| 1 Access & Application | 07–10 | [ ] |
| 2 Verification & Eligibility (incl. rejection, appeal) | 12 | [ ] |
| 3 Jurisdiction & Routing | 12, 16 | [ ] |
| 4 Service Pathways (advice / mediation / direct aid) | 12, 14 | [ ] |
| 5 Panel Lawyer Process (financial-status gate) | 17, 18 | [ ] |
| 6 Outcome & Closure (blocked until reports/approvals) | 12, 18, 19 | [ ] |
| 7 Cross-cutting (notifications, documents, panel mgmt, grievance, dashboard, AI, integrations, audit) | 04–06, 10, 12–19 | [ ] |
| Business rules 1–8 | 05, 12 | [ ] |

## 5. Deliverables and judging
| Item | Due | Prompt | Status |
|---|---|---|---|
| Baseline audit | — | 01 | Done |
| Day-1 gates (OCR, TalkBack, PWA install, scheduler) | Day 1–2 | 02 | [ ] |
| Solution paper (2 pages / 1,000 words) | 26 Sep 11:59 PM | P1 | [ ] |
| Pitch deck (URL + QR on slide 1) | 27 Sep 8:00 AM | P2 | [ ] |
| Public prototype URL, all 23 reachable/testable | 27 Sep 8:00 AM | 19 | [ ] |
| 90-second fallback recording | 27 Sep 8:00 AM | P2 | [ ] |

| Judging criterion | Weight | Where it is earned |
|---|---|---|
| System integration & architecture | 20% | 03–06, 19 |
| Technical quality & reliability | 20% | 02, 11, 19 |
| Practical service improvement / legal impact | 15% | 12, 14, 17–18 |
| Innovation | 10% | 04, 06, 07 (provenance, promises, Status Sentence) |
| Inclusion & accessibility | 10% | 02, 07–08, 10–11 |
| Privacy, safety & responsible AI | 10% | 04, 06, 09–10, 13–16 |
| Feasibility, interoperability & scalability | 10% | 03, 11, 19 |
| Presentation & teamwork | 5% | P2 |
