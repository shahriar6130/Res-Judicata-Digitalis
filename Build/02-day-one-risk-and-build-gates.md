# Prompt 02 — Restore the build and prove the Day-1 risk gates

**Prompt status:** Draft  
**PDF coverage:** A2 (case PDF p.4), T6 and T10 (p.8), G4 and G8 (p.9); prototype standards (p.2)  
**Depends on:** Prompt 01 — `Solved/00-repo-baseline.md` is Done  
**Solved file:** `Solved/02-day-one-risk-and-build-gates.md`

> Execute this prompt only after approval. Stop after its tests and evidence update; do not begin Prompt 03.

## 0. Decision Card

- **Frozen baseline:** D-001; existing Next.js 16/React 19/TypeScript application; PostgreSQL and the authoritative shared record begin in Prompt 03; the public prototype uses one always-on Fly.io Machine in `sin`.
- **Open decision/deviation:** none.
- **User decision:** not required—frozen baseline applies.
- **Execution-level package choice:** a dev/test package may be added only for an otherwise missing OCR, unit-test or browser-test capability. Record package, locked version, capability gap, why platform/current dependencies are insufficient and the smallest fallback in the Solved file. This is not permission to select a production AI/OCR provider.

## 1. PDF requirement and acceptance

| Item | Verified requirement and this prompt's evidence |
|---|---|
| Prototype standard — p.2 | A working item must run logic and change state; a screen or explanation alone does not count. Prompt 02 establishes trustworthy build/test and risk evidence, not mandatory-item completion. |
| A2 Ripon — p.4 | Final acceptance is one meaningful Bangla task completed independently by a blind authorised representative, with authority scope and Moyuri-confirmation status visible. Test without a sighted helper. This prompt proves the real-device accessibility route is viable. |
| T6 — p.8 | Final acceptance uses 5–6 documents, including a missing item and an unclear/unreadable item; material summaries must be sourced and officer-verified. This prompt tests only the first-order Bangla extraction risk on a text PDF, scan and phone photo. |
| T10 — p.8 | Final acceptance is an installable PWA with safe caching and Normal/Light comparison under the same throttled profile. This prompt proves clean install and offline reopen only; Prompt 11 completes the safe encrypted queue and measurement acceptance. |
| G4 — p.9 | The relevant task must work through its required accessible/non-screen/assisted route. Capture TalkBack evidence on real Android hardware. |
| G8 — p.9 | Weak-network/offline/retry paths must not silently lose or duplicate records. This prompt proves only shell/offline and always-on-process risks; shared-record recovery is deferred to Prompts 06 and 11. |

### Credit boundary

This is a pre-foundation engineering gate. **Do not** mark A2, T6, T10, G4 or G8 Implemented, Integrated or Testable in `Solved/TRACEABILITY.md`. They require later shared-record logic, human authority and complete PDF acceptance paths. Prompt 02 may mark only the “Day-1 gates” deliverable Done when all four evidence groups below pass.

## 2. Approved sources

- PDF: pp.2, 4, 8 and 9.
- PRD: A2 journey; T6; T10; deployment/selftest; Day-1 plan and risk register.
- Architecture: §§4.3–4.4, 14.2, 25.1–25.3, ADR-011 and ADR-012.
- Specification: §§15 (T6/T10), 24.2–24.3 and 27.
- Decisions: `Solved/DECISIONS.md` D-001.
- Existing evidence: `Solved/00-repo-baseline.md`.
- Repository rules: root and `frontend/AGENTS.md`; consult the installed Next.js 16 documentation before changing framework boot, manifest or service-worker behavior.

## 3. Scope and cut line

**Build one coherent outcome:** a green repository gate plus reproducible evidence for Bangla OCR, real-phone TalkBack/audio OTP, clean-browser PWA install/offline reopen and an always-on scheduler-process heartbeat.

**Fix these known baseline failures:**

1. standalone TypeScript cannot resolve the imported PNG/JPG modules;
2. `/dashboard/mediator` prerender fails because unsupported role navigation reaches `items.map` as `undefined`;
3. there is no project test command or browser-risk harness.

**Do not build:** PostgreSQL, tenancy/auth/RBAC, Application/Case records, ledger/vault, domain state machines, Promise Engine/outbox, T6 briefing agent, encrypted offline queue, Normal/Light measurement, or final citizen/provider flows. Those belong to Prompts 03–19.

**Tier 2 cut first:** styled risk dashboards, charts, automated report presentation and extra device/browser combinations. Never cut the green build, raw machine-readable evidence, real Android test, clean-browser public-URL test or no-request worker proof.

## 4. Implementation contract

### 4.1 Trustworthy repository gate

1. Repair image-module typing without weakening strict TypeScript.
2. Make role/sidebar navigation total and type-safe. Unknown roles must produce a safe explicit fallback, never an undefined list. Confirm every generated dashboard route prerenders.
3. Add `typecheck`, `test`, `test:risk:ocr` and `test:e2e:risk` scripts. Keep `lint` and `build` green.
4. Add the smallest focused tests for the two regressions. Do not rewrite the existing interface or hardcode new colours/fonts.

### 4.2 Bangla OCR risk harness

1. Store only synthetic fixtures and a UTF-8 ground-truth manifest: one Bangla text PDF, one scanned image and one realistic phone-photo transformation. Include one deliberately degraded/unreadable region.
2. Provide a replaceable `OcrProbe` adapter and a deterministic CLI test. This is a risk spike, not the final T6 agent or a production provider choice.
3. Emit JSON containing fixture hash/type, engine/version, duration, extracted text, ground-truth comparison metric, uncertain/unreadable regions and errors. Never fill uncertain text by guessing.
4. Preserve the raw results under `Solved/evidence/02/ocr/`. Document which input is usable and the fallback: text-based PDFs for the reliable demo path plus a poor image visibly labelled unreadable/uncertain.
5. Harness PASS means all three fixtures execute and honest measurements/errors are recorded. It does **not** mean T6 passes.

### 4.3 Real Android TalkBack/audio risk harness

1. Create or reuse a bounded, clearly labelled Day-1 diagnostic route that exercises the same meaningful Bangla task later used for Ripon: authenticate with a repeatable audio/voice-delivered OTP, hear a synthetic case Status Sentence, and distinguish representative authority plus confirmed versus unconfirmed information.
2. The task must not require CAPTCHA, PDF, visual OTP, pointer precision or sighted interpretation. Provide proper Bangla accessible names/instructions/errors, logical focus, visible focus, target sizing and 200% reflow. Provide web-text/SMS-equivalent content for Deaf or hard-of-hearing users.
3. Use pre-generated synthetic Bangla audio checked into the application; browser speech recognition is not an acceptance dependency.
4. Add automated semantic/keyboard checks, but treat them only as preparation. Create a manual evidence form recording device model, Android/Chrome/TalkBack versions, tester, date, task steps, no-sighted-helper result, defects and artefact paths.
5. PASS requires the complete task on a real Android phone with TalkBack and no sighted helper. If hardware or a suitable non-team tester is unavailable, report `NEEDS_PHYSICAL_DEVICE` and keep Prompt 02 Partial—never infer a pass from desktop automation.

### 4.4 Minimal PWA install/offline probe

1. Add a standards-based manifest, icons, service-worker registration and an offline fallback sufficient to install and reopen the diagnostic shell.
2. Use an explicit cache allowlist: application shell and immutable static diagnostic assets only. Do not cache case/status responses, evidence, authentication values or arbitrary GET responses. Add cache versioning and controlled cleanup.
3. Add a browser test that starts with a clean context, loads the route, confirms manifest/service-worker control, switches offline, reopens/reloads the route, reconnects and confirms recovery.
4. Repeat on the deployed HTTPS URL in a genuinely clean browser and record URL, build ID, browser/device, service-worker version, timestamps and result. Localhost evidence alone cannot pass the public PWA gate.
5. Do not claim full T10: Normal/Light same-profile measurements, encrypted queued drafts, shared-device logout wipe and storage-eviction behavior remain Prompt 11 work.

### 4.5 Always-on process/scheduler liveness probe

1. Containerise the minimal current application for the architecture-fixed single Fly.io Machine in `sin`, with automatic stop disabled and a local Docker fallback.
2. Using the supported Next.js Node-runtime startup mechanism, start one idempotent in-process **diagnostic heartbeat** that continues without incoming HTTP requests. Guard against duplicate loops during development/reload and stop cleanly.
3. Expose only non-sensitive health evidence: build/boot identifier, process-start time, last heartbeat time and monotonic tick count. Do not add mock promises, fake ledger events or a parallel domain store.
4. Prove from deployment logs/health output that ticks advance during at least five minutes with no inbound requests, then make one request and capture the before/after evidence.
5. This probe proves the hosting/process shape only. Prompt 06 must replace/extend it with the database-leased scheduler, virtual clock, Promise Engine and transactional outbox before G8 receives credit.

### 4.6 Documentation and evidence

- Update `frontend/README.md` with exact local gate, risk-test, Docker and clean-browser commands. Do not edit frozen PRD/architecture/spec unless implementation reveals a real conflict; record any conflict and stop for reconciliation.
- Add no real beneficiary data, NID, case, live 16699 call or live payment.
- Keep every risk route/fixture visibly labelled synthetic and diagnostic.

**Stack:** follow the approved architecture. Lock dependencies in `package-lock.json`. For each added package, record the required capability and fallback as specified in the Decision Card.

## 5. Shared-record and authority contract

| Contract | Required implementation |
|---|---|
| Canonical record | Not yet available; Prompt 03 creates it. Diagnostic fixtures/results are build evidence only and must never masquerade as Application/Case data. |
| State transition | Domain transition not applicable. The machine-readable gate status may move `NOT_RUN → PASS/FAIL/NEEDS_PHYSICAL_DEVICE/NEEDS_PUBLIC_URL`; it has no legal/workflow effect. |
| Ledger events | None. Do not fabricate application/case audit events before the ledger exists. |
| Promise/task | None. The liveness heartbeat is not a Promise Engine obligation. |
| Permissions | Risk fixtures are synthetic and contain no PII. Any public health route exposes only the bounded fields above; deployment/admin details and secrets remain server-side. |
| Human decision | A named team member records the physical-device and public-URL observations and signs off the raw evidence. Later officers still verify OCR-derived content. |
| Provenance/safety | Each evidence file records build ID, tool/device/version, tester or automated runner, timestamp and raw outcome. Uncertainty stays visible. |

Confirm in the solution: no side-store is presented as Shakkho's shared record, no mandatory PDF item is claimed complete, and no secret or real case data is placed in client bundles, logs, fixtures or screenshots.

## 6. Failure behavior

| Trigger | Required visible recovery/accountability |
|---|---|
| OCR adapter fails, returns blank text or cannot read a region | Emit a failed/uncertain result with fixture and engine evidence; use the documented text-PDF fallback; never manufacture text. |
| TalkBack/audio task cannot be completed | Record the exact failing control/step and device context; gate remains Partial until retested without sighted help. |
| Service worker fails install/offline reopen | Show the browser error and cache/version evidence; unregister/wipe only the diagnostic cache during retest; do not call local success a public pass. |
| Heartbeat stops or Fly sleeps | Health shows stale tick; capture configuration/logs and fail the always-on gate. Do not substitute traffic-driven polling. |
| A new dependency is unavailable | Use the recorded smallest fallback or report Blocked; do not bypass tests or commit fetched/generated secrets. |

## 7. Tests and proof

From `frontend/`, the implementation must make these commands real and green unless an explicitly manual/deployed gate is being reported:

```bash
npm ci --cache /tmp/shakkho-npm-cache --no-audit --no-fund
npm run lint
npm run typecheck
npm test
npm run test:risk:ocr
npm run build
npm run test:e2e:risk
```

Also run the documented local Docker smoke test. Then execute and record these literal observations:

1. **Build regression:** all role routes, including `/dashboard/mediator`, build/prerender without exception; the unsupported-role test returns a safe fallback.
2. **OCR:** run text PDF, scan and phone photo; inspect raw extraction/uncertainty and JSON metrics.
3. **A2 risk:** on real Android, a tester using TalkBack completes the Bangla audio-OTP/status/authority task without sighted help.
4. **PWA risk:** from a clean browser on the deployed URL, install/control the app, go offline, reopen/reload the diagnostic shell, reconnect and recover.
5. **Worker risk:** make no requests for five minutes; prove the same boot's heartbeat advanced on the always-on host.

Capture under `Solved/evidence/02/`:

- `gate-summary.json` with commit/build ID and separate automated/manual/deployed statuses;
- command logs;
- OCR fixture manifest and raw/metric results;
- signed TalkBack test form and non-sensitive screenshot/video reference;
- clean-browser PWA/service-worker evidence;
- redacted Fly configuration, health snapshots and heartbeat logs.

Do not commit credentials, deployment tokens, real phone numbers, identifying tester data or beneficiary information.

## 8. Required Solved update

1. Create `Solved/02-day-one-risk-and-build-gates.md` from `Solved/_TEMPLATE.md`.
2. Record each of the four gates separately as `PASS`, `FAIL`, `NEEDS_PHYSICAL_DEVICE` or `NEEDS_PUBLIC_URL`, with exact commands and artefact paths.
3. Update the “Day-1 gates” row in `Solved/TRACEABILITY.md` only if all four gates pass. Leave A2, T6, T10, G4 and G8 unchecked; add only a concise evidence note that foundational risk testing was completed.
4. Update the Prompt 02 entry in `Solved/DECISIONS.md` with package capability-gap decisions and remaining failures. Do not change D-001.
5. Final prompt status is:
   - **Done:** green code gate plus all OCR, physical TalkBack, public PWA and no-request worker evidence pass;
   - **Partial:** implementation is green but physical/deployed evidence is missing or a risk failed;
   - **Blocked:** the build/test baseline cannot be made trustworthy.
6. Stop. Prompt 03 may begin only after Prompt 02 is Done or the user records an explicit accepted blocker/deviation.
