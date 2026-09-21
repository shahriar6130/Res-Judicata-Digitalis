# Res Judicata Digitalis — Shakkho

Shakkho is an evidence-grounded operational layer for Bangladesh legal aid services. It preserves
conflicting operational observations, derives explainable milestone states, and requires an
authorised, evidence-citing human resolution before a conflict can become resolved. It is neither
a generic case-management dashboard nor a source of legal advice.

## Repository structure

- `backend/` — FastAPI backend with Supabase (PostgreSQL) database integration, SQLAlchemy, Alembic migrations, and pure reconciliation domain
  - `backend/apps/api/` — API routers, Supabase database client, models, and migrations
  - `backend/packages/contracts/` — generated OpenAPI and evidence-state contracts plus examples
- `frontend/` — Next.js role sign-in portals and bilingual citizen, lawyer, DLO, and admin dashboards (decoupled from Supabase)
- `docs/architecture/` — backend boundaries, Supabase foundation, and reconciliation rules

## Backend & Supabase setup

The backend initiates **Supabase (PostgreSQL)** as its authoritative database. Install Python 3.10+ and configure your Supabase credentials:

```bash
cd backend/apps/api
cp .env.example .env
# Provide SUPABASE_DATABASE_URL and Supabase project keys in .env
```

To provision the database schema in Supabase:
- **Option 1 (Supabase Dashboard)**: Paste `backend/apps/api/supabase/migrations/20260921000001_initial_schema.sql` into the Supabase SQL Editor and run it.
- **Option 2 (Alembic)**: Run `alembic upgrade head`.

To start the FastAPI service:

```bash
uv sync  # or pip install -r requirements.txt
uv run python -m scripts.seed
uv run uvicorn app.main:app --reload --port 8000
```

Use `uv run ruff format .`, `uv run ruff check .`, and `uv run pytest` for verification. Standard
Python virtual environments remain supported when `uv` is unavailable.

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000` to access the Citizen sign-in portal. You can quickly test citizen login using:
- **Mobile number:** `a`
- **Password:** `a`
- Or click the **Auto-fill** or **Quick enter** buttons on the sign-in form.

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
