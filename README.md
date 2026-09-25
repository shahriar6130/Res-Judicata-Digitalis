# Res Judicata Digitalis — সাক্ষ্য

সাক্ষ্য is an evidence-grounded operational layer for Bangladesh legal aid services. It preserves
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

## Frontend theme

The active theme is `frontend/app/themes/gov_theme.css`, imported after the base tokens in `globals.css`. White and pale green (`#e6fbd9`) form the page, navigation, and featured-panel surfaces; black is reading text, not a large background. The original Lady Justice/login photographs stay visible at full image opacity beneath a translucent vignette, with white text scoped to the image pane. Primary buttons, featured calls to action, and active navigation use `#038533` with white labels; links and outlined controls use the deeper `#02712b` for contrast on pale green; `#05a53f` is reserved for decorative accents. White button labels on `#038533` have a 4.77:1 contrast ratio, while black on `#e6fbd9` has 19.17:1. Muted copy uses a readable green-gray, control boundaries remain visible, and keyboard focus uses a black outline. Status labels and icons carry meaning alongside the green palette; color alone must not distinguish statuses. Bangla and English behavior is unchanged. Saved blue, black, and courthouse themes remain available through the CSS import, with no product theme switch.

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000` for the Citizen portal: **Sign up** with name + mobile number, then **Log in** with the mobile number only (no password in the prototype). Accounts are cached in `localStorage["dlas.db.v1"].citizens`; when the server-only Upstash REST variables are configured, the complete shared JSON is also hydrated and mirrored through `/api/dlas-store` (see `frontend/README.md`).

The prototype administrator entry at `/admin` requires no credentials and redirects directly to
`/dashboard/admin`. Admin mutations are saved to the browser first, then immediately flushed to
Upstash; the dashboard confirms whether the online save succeeded or only the browser copy exists.
Admin JSON export reconciles before downloading, and JSON import flushes the restored snapshot to
the same online store before reporting completion.
The Admin dashboard also retains a dedicated Mediator training section for editing training and
certificate records without bypassing verification.

## Step 1 — Access & Application (shared record)

Every intake door writes the same JSON record to the local offline cache and optional Upstash JSON mirror, and mints one Application ID:
`/dashboard/citizen#intake` (citizen), `/dashboard/udc/intake/new` (UDC), `/device/ivr` and `/device/ussd` (simulated phones).
Open `/debug` to inspect any session or application at any step. Contract: `docs/architecture/DATA-CONTRACTS.md`.

When the DLO closes a completed and paid lawyer-path case, the shared record also receives a
simulated closure testimonial. The citizen is notified and can view that testimony on their own
case-detail page.

Current shared-case workflows also support case-specific co-mediator assignments, legal-aid
applications made to defend an alleged person, and a citizen lawyer-change request for alleged
illegal conduct. Lawyer-change requests create a DLAO task; approval sends the citizen an
“approved—update soon” message. Mediation-completion notifications use completion/testimonial
wording without advertising a seven-day appeal period, and document-request notifications are
removed once the requested file is submitted.

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
