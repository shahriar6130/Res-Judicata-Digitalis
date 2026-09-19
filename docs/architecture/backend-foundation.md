# Backend foundation

## Boundaries

- `domain/` contains deterministic policy and reconciliation code with no HTTP or database dependency.
- `db/` owns SQLAlchemy mappings and session construction. Observation rows are evidence history;
  `milestone_states` is only a recomputable projection.
- `services/` translates persisted evidence into domain facts and persists the derived projection.
- `api/routes/` validates transport concerns and coordinates one deliberate transaction per mutation.
- `schemas/` is the typed HTTP boundary. `packages/contracts/` is generated from this application.

PostgreSQL is the application database and the backend is the sole owner of these tables. External
notification delivery is deliberately outside case-state transactions: later code will commit an
outbox row, and a separate worker will attempt delivery.

## Observation request flow

The observation endpoint validates case/commitment ownership, field policy, attribution,
supersession and the idempotency key. It appends an observation, records the request hash, derives
the affected milestone, and commits those database changes together. Reuse of a key with the same
payload returns the original observation; reuse with different content returns `409`.

The engine first removes explicitly superseded evidence from the active set without deleting it.
It then normalizes and groups applicable values, tests resolutions, authority, independence and
freshness in the documented order. Confidence never determines the result.

## Commands

Requires Python 3.12+ and PostgreSQL:

```bash
cd apps/api
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run python -m scripts.seed
uv run uvicorn app.main:app --reload
uv run ruff format .
uv run ruff check .
uv run pytest
uv run python -m scripts.generate_contracts
```

For a standard virtual environment, install the project and dev dependencies with
`python -m pip install -e . --group dev`, then omit `uv run` from the commands.

## Deferred to Phase 2

Officer authority enforcement and resolution writes, claim-packet submission, notification outbox
production/worker delivery, authentication/authorization, audit hardening and production
operability are deferred. The two deferred mutation routes return explicit `501` responses. AI is
not part of this foundation; a later AI integration may only propose an unconfirmed observation.
