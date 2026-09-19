# Res Judicata Digitalis — Shakkho

Shakkho is an evidence-grounded operational layer for Bangladesh legal aid services. It preserves
conflicting operational observations, derives explainable milestone states, and requires an
authorised, evidence-citing human resolution before a conflict can become resolved. It is neither
a generic case-management dashboard nor a source of legal advice.

## Repository structure

- `apps/api/` — FastAPI, SQLAlchemy, Alembic, pure reconciliation domain, fixtures and tests
- `packages/contracts/` — generated OpenAPI and evidence-state contracts plus examples
- `docs/architecture/` — backend boundaries and reconciliation rules

## Backend setup

Install Python 3.12+ and PostgreSQL, then:

```bash
cd apps/api
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m scripts.seed
uv run uvicorn app.main:app --reload
```

Use `uv run ruff format .`, `uv run ruff check .`, and `uv run pytest` for verification. Standard
Python virtual environments remain supported when `uv` is unavailable.

## Shared contract

Generate `packages/contracts/openapi.json` and `evidence-states.json` directly from the backend:

```bash
cd apps/api
uv run python -m scripts.generate_contracts
uv run pytest tests/test_contracts.py
```

The contract test fails if the committed documents drift from FastAPI or the canonical enum.

## Phase status and handoff

Phase 1 provides the data model, initial migration, deterministic reconciliation, observation
write, case timeline, actionable officer queue, development fixtures and stable contracts.
Resolution writes and claim submission are visible as explicit `501` Phase 2 routes. Authentication,
notifications, production delivery, AI, deployment automation and frontend work are out of scope.

**Ahan:** consume `packages/contracts/openapi.json`, `evidence-states.json`, and the JSON in
`packages/contracts/examples/`. Model the interface around the timeline and explainable state; do
not infer that the latest observation is true.

**Raima:** extend `apps/api/fixtures/development.json`, run `uv run python -m scripts.seed`, and add
integration coverage without changing reconciliation rules. PostgreSQL migration and environment
commands are in `docs/architecture/backend-foundation.md`.
