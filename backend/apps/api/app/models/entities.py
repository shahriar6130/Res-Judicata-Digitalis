"""Core Shakkho evidence-grounded domain models for PostgreSQL (Supabase)."""
from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    Boolean,
    ForeignKey,
    JSON,
    Index,
)
from sqlalchemy.orm import relationship
from app.models.base import Base, TenantModelMixin


class Application(Base, TenantModelMixin):
    """Initial citizen aid application before formal case admission."""
    __tablename__ = "applications"

    official_id = Column(String(64), unique=True, index=True, nullable=False)
    temporary_id = Column(String(64), index=True, nullable=True)
    status = Column(String(32), default="SUBMITTED", nullable=False, index=True)
    channel = Column(String(32), nullable=False, default="WEB_PWA")
    office_scope_id = Column(String(64), nullable=True, index=True)
    category = Column(String(64), nullable=True)
    case_type = Column(String(64), nullable=True)
    vulnerability_flags = Column(JSON, default=list, nullable=False)

    cases = relationship("Case", back_populates="application")


class Case(Base, TenantModelMixin):
    """Admitted legal aid case tracked across all milestones and promises."""
    __tablename__ = "cases"

    case_reference = Column(String(64), unique=True, index=True, nullable=False)
    application_id = Column(String(36), ForeignKey("applications.id"), nullable=True)
    office_scope_id = Column(String(64), nullable=False, index=True)
    pathway = Column(String(32), default="LITIGATION", nullable=False)
    status = Column(String(32), default="ACTIVE", nullable=False, index=True)
    priority = Column(String(16), default="NORMAL", nullable=False)
    policy_version = Column(String(16), default="v1.0", nullable=False)

    # Status summary
    status_sentence_bn = Column(Text, nullable=True)
    status_sentence_en = Column(Text, nullable=True)

    application = relationship("Application", back_populates="cases")
    observations = relationship("Observation", back_populates="case", cascade="all, delete-orphan")
    milestones = relationship("Milestone", back_populates="case", cascade="all, delete-orphan")
    promises = relationship("PromiseTask", back_populates="case", cascade="all, delete-orphan")
    decisions = relationship("Decision", back_populates="case", cascade="all, delete-orphan")
    audit_events = relationship("AuditEvent", back_populates="case", cascade="all, delete-orphan")


class Observation(Base, TenantModelMixin):
    """Raw self-reported or external evidence observation (competing claims preserved)."""
    __tablename__ = "observations"

    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    source_role = Column(String(32), nullable=False)
    source_actor_id = Column(String(64), nullable=False)
    channel = Column(String(32), nullable=False)
    field_key = Column(String(64), nullable=False, index=True)
    raw_value = Column(Text, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    is_disputed = Column(Boolean, default=False, nullable=False)
    evidence_document_ref = Column(String(255), nullable=True)
    metadata_payload = Column(JSON, default=dict, nullable=False)

    case = relationship("Case", back_populates="observations")


class Milestone(Base, TenantModelMixin):
    """Explainable operational milestone derived from verified observations or decisions."""
    __tablename__ = "milestones"

    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    milestone_type = Column(String(64), nullable=False, index=True)
    state = Column(String(32), default="PENDING", nullable=False)
    derived_from_observation_id = Column(String(36), ForeignKey("observations.id"), nullable=True)
    explanation = Column(Text, nullable=True)
    achieved_at = Column(DateTime, nullable=True)

    case = relationship("Case", back_populates="milestones")


class PromiseTask(Base, TenantModelMixin):
    """Time-bounded obligation assigned to a specific role with escalation rules."""
    __tablename__ = "promise_tasks"

    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    task_type = Column(String(64), nullable=False)
    owner_role = Column(String(32), nullable=False, index=True)
    due_at = Column(DateTime, nullable=False, index=True)
    state = Column(String(32), default="PENDING", nullable=False, index=True)
    evidence_required = Column(String(64), nullable=True)
    escalation_rung = Column(String(32), default="NONE", nullable=False)

    case = relationship("Case", back_populates="promises")


class Decision(Base, TenantModelMixin):
    """Authoritative human legal aid officer resolution gate."""
    __tablename__ = "decisions"

    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False, index=True)
    decision_type = Column(String(64), nullable=False)
    actor_id = Column(String(64), nullable=False)
    actor_role = Column(String(32), nullable=False)
    authority_basis = Column(String(128), nullable=True)
    result = Column(String(64), nullable=False)
    reason = Column(Text, nullable=False)
    evidence_references = Column(JSON, default=list, nullable=False)
    policy_version = Column(String(16), default="v1.0", nullable=False)

    case = relationship("Case", back_populates="decisions")


class AuditEvent(Base, TenantModelMixin):
    """Immutable append-only cryptographic event chain."""
    __tablename__ = "audit_events"

    case_id = Column(String(36), ForeignKey("cases.id"), nullable=True, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    actor_id = Column(String(64), nullable=False)
    actor_role = Column(String(32), nullable=False)
    channel = Column(String(32), nullable=False)
    payload_digest = Column(String(64), nullable=False)
    previous_hash = Column(String(64), nullable=True)
    event_hash = Column(String(64), nullable=False)
    details = Column(JSON, default=dict, nullable=False)

    case = relationship("Case", back_populates="audit_events")


# Composite indexes
Index("ix_case_tenant_status", Case.tenant_id, Case.status)
Index("ix_obs_case_field", Observation.case_id, Observation.field_key)
Index("ix_promise_due_state", PromiseTask.due_at, PromiseTask.state)
