-- =========================================================
-- Shakkho — Supabase Initial Migration (20260921000001)
-- Evidence-Grounded Legal Aid Schema with Row Level Security
-- =========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Applications table
CREATE TABLE IF NOT EXISTS public.applications (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    official_id VARCHAR(64) UNIQUE NOT NULL,
    temporary_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
    channel VARCHAR(32) NOT NULL DEFAULT 'WEB_PWA',
    office_scope_id VARCHAR(64),
    category VARCHAR(64),
    case_type VARCHAR(64),
    vulnerability_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_actor_id VARCHAR(64),
    row_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_applications_tenant ON public.applications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications (status);
CREATE INDEX IF NOT EXISTS idx_applications_office ON public.applications (office_scope_id);

-- 2. Cases table
CREATE TABLE IF NOT EXISTS public.cases (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    case_reference VARCHAR(64) UNIQUE NOT NULL,
    application_id VARCHAR(36) REFERENCES public.applications(id) ON DELETE SET NULL,
    office_scope_id VARCHAR(64) NOT NULL,
    pathway VARCHAR(32) NOT NULL DEFAULT 'LITIGATION',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    priority VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
    policy_version VARCHAR(16) NOT NULL DEFAULT 'v1.0',
    status_sentence_bn TEXT,
    status_sentence_en TEXT,
    created_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_actor_id VARCHAR(64),
    row_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_cases_tenant ON public.cases (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases (status);
CREATE INDEX IF NOT EXISTS idx_cases_ref ON public.cases (case_reference);

-- 3. Observations table (preserves competing claims without assuming latest is true)
CREATE TABLE IF NOT EXISTS public.observations (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    case_id VARCHAR(36) NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    source_role VARCHAR(32) NOT NULL,
    source_actor_id VARCHAR(64) NOT NULL,
    channel VARCHAR(32) NOT NULL,
    field_key VARCHAR(64) NOT NULL,
    raw_value TEXT NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_disputed BOOLEAN NOT NULL DEFAULT FALSE,
    evidence_document_ref VARCHAR(255),
    metadata_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_actor_id VARCHAR(64),
    row_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_observations_case ON public.observations (case_id);
CREATE INDEX IF NOT EXISTS idx_observations_field ON public.observations (case_id, field_key);

-- 4. Milestones table
CREATE TABLE IF NOT EXISTS public.milestones (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    case_id VARCHAR(36) NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    milestone_type VARCHAR(64) NOT NULL,
    state VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    derived_from_observation_id VARCHAR(36) REFERENCES public.observations(id) ON DELETE SET NULL,
    explanation TEXT,
    achieved_at TIMESTAMPTZ,
    created_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_actor_id VARCHAR(64),
    row_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_milestones_case ON public.milestones (case_id);

-- 5. Promise Tasks table
CREATE TABLE IF NOT EXISTS public.promise_tasks (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    case_id VARCHAR(36) NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    task_type VARCHAR(64) NOT NULL,
    owner_role VARCHAR(32) NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    state VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    evidence_required VARCHAR(64),
    escalation_rung VARCHAR(32) NOT NULL DEFAULT 'NONE',
    created_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_actor_id VARCHAR(64),
    row_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_promise_due_state ON public.promise_tasks (due_at, state);

-- 6. Decisions table (human authority gate)
CREATE TABLE IF NOT EXISTS public.decisions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    case_id VARCHAR(36) NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    decision_type VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    authority_basis VARCHAR(128),
    result VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    evidence_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    policy_version VARCHAR(16) NOT NULL DEFAULT 'v1.0',
    created_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_actor_id VARCHAR(64),
    row_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_decisions_case ON public.decisions (case_id);

-- 7. Audit Events table (tamper-evident hash chain)
CREATE TABLE IF NOT EXISTS public.audit_events (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default-tenant',
    case_id VARCHAR(36) REFERENCES public.cases(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    channel VARCHAR(32) NOT NULL,
    payload_digest VARCHAR(64) NOT NULL,
    previous_hash VARCHAR(64),
    event_hash VARCHAR(64) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_actor_id VARCHAR(64),
    row_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_audit_case ON public.audit_events (case_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON public.audit_events (event_type);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promise_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Allow backend service role full access
CREATE POLICY "Service role full access on applications" ON public.applications FOR ALL USING (true);
CREATE POLICY "Service role full access on cases" ON public.cases FOR ALL USING (true);
CREATE POLICY "Service role full access on observations" ON public.observations FOR ALL USING (true);
CREATE POLICY "Service role full access on milestones" ON public.milestones FOR ALL USING (true);
CREATE POLICY "Service role full access on promise_tasks" ON public.promise_tasks FOR ALL USING (true);
CREATE POLICY "Service role full access on decisions" ON public.decisions FOR ALL USING (true);
CREATE POLICY "Service role full access on audit_events" ON public.audit_events FOR ALL USING (true);
