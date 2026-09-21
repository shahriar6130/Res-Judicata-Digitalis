# Res Judicata Digitalis — Shakkho

Shakkho is an evidence-grounded operational layer for Bangladesh legal aid services. It preserves
conflicting operational observations, derives explainable milestone states, and requires an
authorised, evidence-citing human resolution before a conflict can become resolved. It is neither
a generic case-management dashboard nor a source of legal advice.

## Repository structure

- `backend/apps/api/` — FastAPI, SQLAlchemy, Alembic, pure reconciliation domain, fixtures and tests
- `backend/packages/contracts/` — generated OpenAPI and evidence-state contracts plus examples
- `frontend/` — Next.js role sign-in portals and bilingual citizen, lawyer, DLO, and admin dashboards
- `docs/architecture/` — backend boundaries and reconciliation rules
- `docs/spec/spec.md` — 35-route Shakkho build contract, including Tier 1 acceptance paths and thin Tier 2 surfaces

Document precedence is ADLASB PDF → PRD → architecture → specification → design/code. See
`docs/architecture/reconciliation-rules.md`. The implementation must complete Tier 1 acceptance
paths before S23 export, expanded S24 grievance administration or editable S33 policy tooling.

## Backend setup

Install Python 3.12+ and PostgreSQL, then:

```bash
cd backend/apps/api
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m scripts.seed
uv run uvicorn app.main:app --reload
```

Use `uv run ruff format .`, `uv run ruff check .`, and `uv run pytest` for verification. Standard
Python virtual environments remain supported when `uv` is unavailable.

## Shared contract

Generate `backend/packages/contracts/openapi.json` and `evidence-states.json` directly from the backend:

```bash
cd backend/apps/api
uv run python -m scripts.generate_contracts
uv run pytest tests/test_contracts.py
```

The contract test fails if the committed documents drift from FastAPI or the canonical enum.

## Phase status and handoff

Phase 1 provides the data model, initial migration, deterministic reconciliation, observation
write, case timeline, actionable officer queue, development fixtures and stable contracts.
Resolution writes and claim submission are visible as explicit `501` Phase 2 routes. Authentication,
notifications, production delivery, AI, deployment automation and frontend work are out of scope.

**Ahan:** consume `backend/packages/contracts/openapi.json`, `evidence-states.json`, and the JSON in
`backend/packages/contracts/examples/`. Model the interface around the timeline and explainable state; do
not infer that the latest observation is true.

**Raima:** extend `backend/apps/api/fixtures/development.json`, run `uv run python -m scripts.seed`, and add
integration coverage without changing reconciliation rules. PostgreSQL migration and environment
commands are in `docs/architecture/backend-foundation.md`.
