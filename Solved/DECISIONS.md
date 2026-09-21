# Shakkho — Decisions and execution register

## 00 — Repository baseline audit

**Status:** Done — prompt 01 executed on 2026-09-21.  
**PDF trace:** Prototype standard — working integrated prototype; “one system, not twenty-three islands.”  
**Contribution:** Established the actual starting point so Foundation extends reusable frontend work without treating local fixtures as shared-record implementation.  
**Decision:** The next build work must start with the Day-1 risk/build gate and shared-record Foundation. Current role dashboards and `/sim/*` are migration inputs only; they are not acceptance evidence.  
**Evidence:** [00-repo-baseline.md](00-repo-baseline.md).  
**Remaining:** Generate and execute prompt 02, including the current typecheck/build blockers and the four Day-1 risk harnesses.

## D-001 — Build-prompt operating protocol

**Status:** Approved baseline.  
**Decision:** Generate and execute one dependency-ordered prompt at a time. The ADLASB PDF remains the scope/acceptance authority; PRD, architecture and specification remain frozen unless the user proposes a deviation. Ask for user input only for genuine open or changed case-solution decisions, using a short Decision Card before generating that case-specific prompt.  
**Stack:** Architecture-fixed modular monolith using the existing Next.js/TypeScript frontend, PostgreSQL canonical state and always-on worker/host boundary. New libraries require a recorded capability-gap reason.  
**Evidence rule:** A page is not solved without canonical state, audit event, applicable promise, enforced authority and passing automated/juror-triggerable evidence.  
**Tracking:** Every executed prompt creates a compact mirrored `Solved/` file and updates only proven columns in `Solved/TRACEABILITY.md`.
