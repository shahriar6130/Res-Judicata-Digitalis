# Shakkho — Backend (FastAPI + Supabase)

This is the FastAPI backend service for **Shakkho** (Res Judicata Digitalis), an evidence-grounded
operational layer for Bangladesh legal aid services.

The backend uses **Supabase (PostgreSQL)** as its authoritative database, providing schema-backed
relational storage, Row Level Security (RLS), connection pooling, and append-only audit event logging.
The frontend remains decoupled from Supabase and consumes standard API contracts.

---

## Architecture Overview

```
backend/
├── apps/
│   └── api/
│       ├── app/
│       │   ├── api/             # FastAPI routers & endpoints (/health, /cases, /observations)
│       │   ├── core/            # Config, Supabase client, and SQLAlchemy database engine
│       │   ├── domain/          # Deterministic evidence reconciliation domain engine
│       │   ├── models/          # SQLAlchemy ORM models (Applications, Cases, Observations, etc.)
│       │   └── schemas/         # Pydantic request & response contracts
│       ├── alembic/             # Database migration revisions for PostgreSQL
│       ├── supabase/            # Supabase SQL migrations and CLI config
│       │   └── migrations/      # Pure SQL migrations with Row Level Security (RLS)
│       ├── fixtures/            # Seed data fixtures
│       ├── scripts/             # Contract generation and database seeding
│       ├── pyproject.toml       # Python package configuration
│       └── requirements.txt     # Python dependencies
└── packages/
    └── contracts/               # Generated OpenAPI and evidence-state contracts
```

---

## 1. Quick Start & Supabase Database Setup

### Step 1: Obtain Supabase Credentials

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and create or select your project.
2. Under **Project Settings -> Database -> Connection string**:
   - Select **URI**.
   - For server/API deployments, choose **Connection pooling** (**Transaction mode**, port `6543`) or Direct (`5432`).
3. Under **Project Settings -> API**:
   - Copy the **Project URL** (`https://<project-ref>.supabase.co`).
   - Copy the **anon public key** and **service_role key**.

### Step 2: Configure Environment Variables

In `backend/apps/api/`:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase values:

```env
# Supabase Connection Pooling (port 6543) or Direct (port 5432)
SUPABASE_DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require

# Supabase API Credentials
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

ENVIRONMENT=development
PORT=8000
```

### Step 3: Run Database Migrations

You can apply the database schema to Supabase using **either** of two methods:

#### Option A — Supabase Dashboard SQL Editor (Fastest)
1. Open the **SQL Editor** in your Supabase project dashboard.
2. Copy the contents of `backend/apps/api/supabase/migrations/20260921000001_initial_schema.sql`.
3. Paste and click **Run**. This provisions all tables, indexes, and Row Level Security policies.

#### Option B — Alembic Migrations
```bash
cd backend/apps/api
alembic upgrade head
```

### Step 4: Seed Initial Development Fixtures

```bash
cd backend/apps/api
python -m scripts.seed
```

### Step 5: Start the FastAPI Server

Using standard Python virtual environment or `uv`:

```bash
cd backend/apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Or with `uv`:
```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

---

## 2. API Endpoints & Health Diagnostics

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | `GET` | System health, Supabase DB connection test, pooler mode, and latency |
| `/health/db` | `GET` | Direct Supabase PostgreSQL ping check |
| `/cases` | `GET` | Operational cases with timelines and milestone status |
| `/cases/{case_ref}` | `GET` | Detail for single case with observations and promises |
| `/observations` | `POST` | Ingest operational evidence without discarding competing claims |
| `/resolutions` | `POST` | Authoritative DLAO resolution gate (HTTP 501 in Phase 1) |
| `/docs` | `GET` | Interactive Swagger / OpenAPI documentation |
| `/redoc` | `GET` | Interactive ReDoc documentation |

---

## 3. Frontend Separation

As instructed:
- The Next.js frontend (`frontend/`) does **not** directly import or use the Supabase client SDK.
- The frontend connects to the backend API layer via standard HTTP/JSON requests.
- This ensures sensitive service-role keys and business reconciliation logic remain safely isolated on the backend.
