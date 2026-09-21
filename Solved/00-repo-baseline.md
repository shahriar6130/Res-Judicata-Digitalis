# 00 — Repository Baseline Audit

**Status:** Done — read-only audit completed 2026-09-21.  
**Scope:** Existing repository only; no application code, schema, configuration or dependency declaration was changed.  
**Authoritative order used:** ADLASB PDF → PRD → architecture → specification → design/code.

## Executive finding

The repository contains a bilingual Next.js frontend baseline, but **no authoritative shared record exists**. There is no backend directory, database, ORM, migration, API, server-side authentication, tenant boundary, ledger/vault, Promise Engine, outbox, scheduler, PWA or project test suite. Current role actions and simulators mutate isolated React `useState` only and reset on reload. The code therefore does not yet satisfy the PDF prototype standard or “one system, not twenty-three islands.”

## Stack

| Area | Observed baseline |
|---|---|
| Frontend | Next.js 16.3.5 App Router, React 19.2.8, TypeScript 5, CSS Modules |
| Package manager | npm with `frontend/package-lock.json` |
| UI foundations | Bangla-default/English i18n, shared tokens, responsive role dashboards and sign-in portals |
| Backend/data | Missing. README references `backend/apps/api` and generated contracts, but no `backend/` directory exists |
| Authentication | Client-only non-empty mobile/password check followed by `router.push`; no credential verification or server session |
| Tests | No project test files, test runner, Playwright config or `test` script |
| PWA | No manifest, service worker, offline cache contract or install harness |
| Jobs/deployment | No scheduler, worker, Docker/Fly configuration or public-URL configuration |
| Environment variables | No `.env*` files found; no environment-variable names found in application source |

## Commands run and results

| Command | Result |
|---|---|
| `npm ci` | **Environment failure:** initial sandbox write denial, then npm cache failure (`Exit handler never called`; user cache contains root-owned files) |
| `npm ci --cache /tmp/shakkho-npm-cache --no-audit --no-fund` | **PASS:** 345 declared packages installed |
| `npm run lint` | **PASS** |
| `./node_modules/.bin/tsc --noEmit` | **FAIL:** TS2307 for the JPG and PNG imports in `lib/portal-art.ts`; no image module declarations are available to standalone `tsc` |
| `npm run build` | **FAIL:** compilation and TypeScript stage pass, then prerender fails at `/dashboard/mediator`; `Sidebar` receives an unsupported role and calls `items.map` on `undefined` |
| `npm test` | **FAIL:** no `test` script is declared |

The failed build generated only ignored `.next`/TypeScript artefacts. Dependency installation changed only ignored `frontend/node_modules`.

## Route map versus S01–S35

Status meanings: **exists-complete** = required working acceptance path exists; **exists-partial** = meaningful UI exists but lacks required integration; **stub** = route exists with wrong/placeholder content; **missing** = canonical route absent; **legacy/alias** = related non-canonical UI exists.

| ID | Canonical route | Status | Existing evidence / gap |
|---|---|---|---|
| S01 | `/` | stub | Citizen sign-in only; no five-door access hub, Light mode or quick exit |
| S02 | `/auth` | missing | Sign-in component is client-only at other routes; no safe OTP/session flow |
| S03 | `/apply` | missing | No application wizard or provenance capture |
| S04 | `/apply/documents` | missing | No upload/checklist pipeline |
| S05 | `/apply/receipt/[ref]` | missing | No APP/TEMP receipt or resume code |
| S06 | `/citizen` | stub | Placeholder page; legacy `/dashboard/citizen` is exists-partial with hard-coded local state |
| S07 | `/citizen/cases/[caseId]` | missing | Legacy citizen dashboard shows one hard-coded case only |
| S08 | `/citizen/record/[applicationId]` | missing | No representation/statement confirmation or withdrawal record |
| S09 | `/citizen/requests/[id]` | missing | Legacy complaint and callback controls are local-only; no request lifecycle |
| S10 | `/access-simulator` | missing | `/sim/sms` is a local SMS panel; no IVR, USSD, safe phrase or shared status |
| S11 | `/16699` | missing | `/portal/helpline` and `/dashboard/helpline` are legacy/alias local fixtures |
| S12 | `/udc` | missing | `/portal/udc` and `/dashboard/udc` are legacy/alias local fixtures |
| S13 | `/udc/sync` | missing | No encrypted queue, sync, conflict or logout-wipe behavior |
| S14 | `/dlo` | stub | DLAO sign-in only; `/dashboard/dlo` is an exists-partial hard-coded queue |
| S15 | `/dlo/applications/[id]` | missing | No verification/eligibility transition |
| S16 | `/cases/[caseId]` | missing | No unified workspace or canonical record |
| S17 | `/dlo/routing/[caseId]` | missing | No pathway decision or Human Decision Gate |
| S18 | `/dlo/referrals` | missing | Receiving-authority dashboard is legacy/alias local UI only |
| S19 | `/dlo/duplicates/[id]` | missing | No matching or reversible duplicate decision |
| S20 | `/dlo/incidents/[groupId]` | missing | No related-case group or per-case document links |
| S21 | `/dlo/triage/[id]` | missing | No multi-component triage execution |
| S22 | `/dlo/documents/[caseId]` | missing | No OCR, source anchors, versions or quality findings |
| S23 | `/office/search-reports` | missing | Case-support dashboard is legacy/alias fixture; no search/report data source |
| S24 | `/office/appeals-grievances` | missing | Appeal dashboard and citizen complaint form are local-only legacy UI |
| S25 | `/mediator` | missing | Mediator portal/dashboard is legacy/alias and currently breaks production prerender |
| S26 | `/mediator/cases/[caseId]` | missing | No mediation state, attempts, safety gate or fallback |
| S27 | `/mediator/drafts/[draftId]` | missing | No settlement templates/drafting checks |
| S28 | `/sign/[token]` | missing | No signing, offline signer or export for independent verification |
| S29 | `/lawyer` | stub | Lawyer sign-in only; `/dashboard/lawyer` is exists-partial local state |
| S30 | `/lawyer/cases/[caseId]` | missing | No case package or persisted hearing update |
| S31 | `/dlo/lawyer-management/[caseId]` | missing | No assignment, pattern review, handover or interim reconciliation |
| S32 | `/finance/payments` | missing | Finance dashboard is legacy/alias fixture only |
| S33 | `/admin` | stub | Admin sign-in only; legacy dashboard offers local editable rule UI rather than read-only seeded configuration |
| S34 | `/audit` | missing | Auditor dashboard is static legacy copy; no events, checkpoint export or access log |
| S35 | `/demo` | missing | `/sim/scenario` and “23/23” links are UI-only and do not enumerate/test 23 items |

**Count:** 0 exists-complete; 0 canonical exists-partial; 5 canonical stubs; 30 canonical routes missing. Several legacy dashboards contain reusable presentation components, but none is acceptance evidence.

## Module map versus architecture

| Architecture module | Status | Evidence / gap |
|---|---|---|
| Tenancy and deterministic reset | missing | No data layer; simulator reset changes one component flag only |
| Authentication/authorisation | stub | Client-only form and URL-selected role; no tenant/role/office/case enforcement |
| Application/Case records and IDs | missing | Hard-coded `SHK-DEMO-*` references; no APP-/DLAS- lifecycle |
| State machines | missing | Component-local booleans/arrays only |
| Case Ledger and Vault | missing | “Ledger” text is hard-coded; no events, hashes, HMAC commitments or encrypted payloads |
| Provenance/representation | missing | No typed claims, authority or confirmation history |
| Human Decision Gate | missing | Local reason forms do not call an authorised command |
| Promise Engine/virtual clock | stub | Static promise wording and isolated local clock; no owner/deadline/escalation engine |
| Notification outbox/safe contact | stub | Local SMS delivered/failed toggle; no outbox, suppression, retry or safe policy |
| Documents/OCR/AI adapters | missing | No upload, OCR, model adapter, schema or deterministic fallback |
| Referral | stub | Role fixture describes accept/return; no shared transfer chain or acknowledgement |
| Mediation | stub | Role fixture only; no persisted workflow |
| Signing/verifier | missing | No cryptography or standalone verifier |
| Panel lawyer | exists-partial | Reusable UI for accept/decline/hearing form, but local-only and unscoped |
| Payment | stub | Finance fixture only; no `PaymentStage` or reconciliation |
| Audit/access/integrity | stub | Static auditor tasks only; no source records or verifier |
| Reporting/selftest | missing | Static “23/23” link; no report query or `/selftest` |
| PWA/offline sync | missing | No manifest/service worker/IndexedDB/queue |
| Worker/scheduler | missing | No backend process or deployment shape |

## Conflicts between documents

No unresolved product-name, source-precedence or T2 wording conflict was found across the current PRD, architecture, specification and design documents.

Repository/document drift remains:

1. Root `README.md` claims a FastAPI/SQLAlchemy/Alembic backend, contracts, fixtures and tests that are absent.
2. `docs/architecture/backend-foundation.md` is empty.
3. `docs/design/design.md` calls the treatment “implemented” although the canonical S01–S35 route set is not implemented.
4. `Build/00-INDEX.md` lists prompts 02–26/P1/P2, but only prompt 01 and the template currently exist.
5. The frontend README correctly calls dashboards migration-era surfaces; that statement matches the code.

## Parallel-record and mock-only findings

- There is no shared record and no persistent side store. Instead, citizen, lawyer, DLAO, provider and simulator screens each keep unrelated local React state.
- Simulator clock, SMS, court, scenario and reset controls do not update dashboards or each other.
- Sign-in accepts any non-empty credentials and only navigates to a role URL.
- Complaint submission creates a random local reference; reload loses it and no audit event is written.
- Operational task completion is a local string array; displayed “history,” “policy pack,” metrics, ledger counts and case identifiers are hard-coded.
- The coverage navigator is a link to one generic scenario, not a 23-item navigator.
- No action currently satisfies the required transaction contract: canonical state change + audit event + promise update.

## Security findings

| Finding | Assessment |
|---|---|
| Client-side secrets | None detected; no environment files or `NEXT_PUBLIC_*` usage found |
| Authentication | Missing; form validation is not authentication |
| Authorisation | Missing; role is derived from URL and UI hiding is the only boundary |
| Sensitive-data protection | Missing; no vault, encryption, access log, break-glass or retention behavior |
| Audit/integrity | Missing; displayed audit/ledger content is fixture text |
| Offline/shared-device protection | Missing; only language preference uses `localStorage` |
| Hard-coded presentation values | Several CSS modules contain raw colours outside `tokens.css`, contrary to root `AGENTS.md` |
| Demo data | Appears synthetic, but there is no enforced demo/production boundary |

## Day-1 risk harness status

| Risk gate | Harness status |
|---|---|
| Bangla OCR on text PDF, scan and phone photo | missing |
| TalkBack, Bangla audio and voice OTP on a real Android phone | missing; physical-device result unknown — needs confirmation |
| Clean-browser PWA install/offline reopen on public URL | missing; no PWA or deployment config; public URL unknown — needs confirmation |
| Always-on scheduler/outbox while no requests arrive | missing; no backend, worker or Fly/Docker configuration |

## Ranked next steps for prompts 02–06

Prompts 02–06 do not yet exist on disk and must be generated before execution.

1. **Prompt 02 — restore a trustworthy test gate and prove first-order risks.** Include the two current build blockers (image-module declaration for standalone `tsc`; role-safe sidebar/navigation so all generated role pages prerender), add a project test script, then create the OCR/TalkBack evidence protocol, minimal PWA install probe and scheduler liveness harness. Do not mark device/public-URL checks passed without physical/deployed evidence.
2. **Prompt 03 — create the actual shared-record runtime.** Establish the architecture's always-on modular-monolith backend, PostgreSQL migrations, API contract, tenant isolation, actor/role/office/case enforcement, APP-/DLAS-/TEMP IDs, deterministic seed/reset and visitor generation guard. Remove false backend claims from README until evidence exists.
3. **Prompt 04 — add ledger/vault/provenance in the same transaction boundary.** Implement per-aggregate event sequence/hash, vault encryption, keyed commitments, correction/withdrawal, access logs and exported checkpoint artefacts. Do not adapt hard-coded “ledger” UI as a second source of truth.
4. **Prompt 05 — implement state machines and Human Decision Gate.** Encode application, case, referral, promise, payment, appeal and grievance transitions with server-side authority checks, including `OTHER_SERVICE`, both financial branches, closure blocking and the two-return unresolved-chain rule.
5. **Prompt 06 — make responsibility operational.** Implement Promise Engine, virtual clock, in-process scheduler, transactional outbox, safe-contact suppression/fallback and retained escalation. Replace `/sim/*` component state with tenant-scoped commands over the same shared records.

Across prompts 02–06, reuse the existing bilingual components/tokens where sound, but treat every current dashboard action as presentation-only until a server command proves state, event and promise evidence.

## Working-tree verification

No tracked application or configuration file was modified by this audit. `Build/` and `Solved/` were already untracked at audit start; this report and the traceability/decision updates are contained inside `Solved/`. Ignored dependency/build artefacts are `frontend/node_modules`, `frontend/.next`, `frontend/next-env.d.ts` and `frontend/tsconfig.tsbuildinfo`.
