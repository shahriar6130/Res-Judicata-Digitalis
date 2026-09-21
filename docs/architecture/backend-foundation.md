# Shakkho — Backend Architecture & Supabase Foundation

**Status:** Canonical foundation guide for the FastAPI backend and Supabase database.  
**Companion Documents:** `docs/architecture/architecture.md`, `backend/README.md`, `README.md`.

The independent DLAO module boundary and its current authorisation limitations are defined in `docs/architecture/dlao-foundation.md`.

---

## 1. Architectural Role

The Shakkho backend operates as an evidence-grounded operational service for Bangladesh legal aid delivery. It:
1. Reconciles conflicting operational observations without assuming the latest observation is true.
2. Derives explainable milestone progressions from verified evidence.
3. Enforces human-authorized decision gates for consequential legal aid transitions.
4. Uses **Supabase (PostgreSQL)** as the durable, managed relational database layer with strict tenant isolation, connection pooling, and append-only audit events.
5. Keeps the **Next.js frontend decoupled from Supabase SDKs**, serving clean API contracts over standard HTTP/JSON.

---

## 2. Supabase Database Configuration

### 2.1 Connection Topology

Supabase provides hosted PostgreSQL with built-in connection pooling via Supavisor. The backend supports two primary modes:

| Mode | Port | Recommended Use | Connection URI Pattern |
|---|---|---|---|
| **Transaction Pooler** | `6543` | API route handlers, high concurrency, serverless runtimes | `postgresql://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require` |
| **Direct Connection / Session** | `5432` | Schema migrations (Alembic), CLI tooling, persistent long-lived workers | `postgresql://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require` |

### 2.2 Environment Variables

The backend loads configuration from `.env` via `app.core.config.Settings`:

- `SUPABASE_DATABASE_URL` / `DATABASE_URL`: Active PostgreSQL connection string with `sslmode=require`.
- `SUPABASE_URL`: Supabase project API host (`https://[project-ref].supabase.co`).
- `SUPABASE_SERVICE_ROLE_KEY`: Privileged backend key for administrative/system operations.
- `SUPABASE_ANON_KEY`: Public client key.
- `CORS_ORIGINS`: Comma-separated allowed frontend origins (e.g., `http://localhost:3000`).

---

## 3. Schema & Row Level Security (RLS)

All tables in the public schema enforce Row Level Security:

1. **`applications`**: Initial citizen requests (`official_id`, `status`, `channel`, `office_scope_id`, `vulnerability_flags`).
2. **`cases`**: Admitted operational cases (`case_reference`, `pathway`, `status`, `priority`, `policy_version`, `status_sentence_bn`, `status_sentence_en`).
3. **`observations`**: Granular evidence observations (`source_role`, `source_actor_id`, `field_key`, `raw_value`, `is_disputed`, `evidence_document_ref`).
4. **`milestones`**: Explainable milestones derived from verified observations.
5. **`promise_tasks`**: Time-bounded role commitments with explicit escalation rungs.
6. **`decisions`**: Authoritative legal aid officer gates (`decision_type`, `authority_basis`, `reason`, `evidence_references`).
7. **`audit_events`**: Cryptographic event hashes maintaining tamper-evident audit history.

### 3.1 Applying Schema to Supabase

- **Option A (Supabase Dashboard)**: Run `backend/apps/api/supabase/migrations/20260921000001_initial_schema.sql` directly in the Supabase SQL Editor.
- **Option B (Alembic CLI)**: Run `alembic upgrade head` from `backend/apps/api`.

---

## 4. Reconciliation Engine

The domain reconciliation logic lives in `app.domain.reconciliation.reconcile_case_observations`:
- When an observation arrives for an existing `field_key` with divergent values, the system preserves both observations.
- It sets `is_disputed = True` and transitions status to `REQUIRES_HUMAN_RESOLUTION`.
- It does not overwrite prior records or assume recent submissions are true.

---

## 5. Frontend & Backend Boundary

The repository follows a clean dual-folder layout:
- **`frontend/`**: Next.js (App Router) bilingual user interface. Does not import Supabase SDK or hold database secrets.
- **`backend/`**: FastAPI service encapsulating Supabase database access, validation, reconciliation, and audit generation.
