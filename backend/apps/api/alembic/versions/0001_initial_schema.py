"""Initial Shakkho database schema for Supabase

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-09-21 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. applications
    op.create_table(
        "applications",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("official_id", sa.String(length=64), nullable=False),
        sa.Column("temporary_id", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("office_scope_id", sa.String(length=64), nullable=True),
        sa.Column("category", sa.String(length=64), nullable=True),
        sa.Column("case_type", sa.String(length=64), nullable=True),
        sa.Column("vulnerability_flags", sa.JSON(), nullable=False),
        sa.Column("created_at_server", sa.DateTime(), nullable=False),
        sa.Column("updated_at_server", sa.DateTime(), nullable=False),
        sa.Column("created_by_actor_id", sa.String(length=64), nullable=True),
        sa.Column("row_version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("official_id"),
    )
    op.create_index("ix_applications_official_id", "applications", ["official_id"])
    op.create_index("ix_applications_tenant_id", "applications", ["tenant_id"])

    # 2. cases
    op.create_table(
        "cases",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("case_reference", sa.String(length=64), nullable=False),
        sa.Column("application_id", sa.String(length=36), nullable=True),
        sa.Column("office_scope_id", sa.String(length=64), nullable=False),
        sa.Column("pathway", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("priority", sa.String(length=16), nullable=False),
        sa.Column("policy_version", sa.String(length=16), nullable=False),
        sa.Column("status_sentence_bn", sa.Text(), nullable=True),
        sa.Column("status_sentence_en", sa.Text(), nullable=True),
        sa.Column("created_at_server", sa.DateTime(), nullable=False),
        sa.Column("updated_at_server", sa.DateTime(), nullable=False),
        sa.Column("created_by_actor_id", sa.String(length=64), nullable=True),
        sa.Column("row_version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("case_reference"),
    )
    op.create_index("ix_cases_case_reference", "cases", ["case_reference"])
    op.create_index("ix_cases_tenant_id", "cases", ["tenant_id"])

    # 3. observations
    op.create_table(
        "observations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("case_id", sa.String(length=36), nullable=False),
        sa.Column("source_role", sa.String(length=32), nullable=False),
        sa.Column("source_actor_id", sa.String(length=64), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("field_key", sa.String(length=64), nullable=False),
        sa.Column("raw_value", sa.Text(), nullable=False),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.Column("is_disputed", sa.Boolean(), nullable=False),
        sa.Column("evidence_document_ref", sa.String(length=255), nullable=True),
        sa.Column("metadata_payload", sa.JSON(), nullable=False),
        sa.Column("created_at_server", sa.DateTime(), nullable=False),
        sa.Column("updated_at_server", sa.DateTime(), nullable=False),
        sa.Column("created_by_actor_id", sa.String(length=64), nullable=True),
        sa.Column("row_version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_observations_case_id", "observations", ["case_id"])
    op.create_index("ix_observations_field_key", "observations", ["field_key"])

    # 4. milestones
    op.create_table(
        "milestones",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("case_id", sa.String(length=36), nullable=False),
        sa.Column("milestone_type", sa.String(length=64), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False),
        sa.Column("derived_from_observation_id", sa.String(length=36), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("achieved_at", sa.DateTime(), nullable=True),
        sa.Column("created_at_server", sa.DateTime(), nullable=False),
        sa.Column("updated_at_server", sa.DateTime(), nullable=False),
        sa.Column("created_by_actor_id", sa.String(length=64), nullable=True),
        sa.Column("row_version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["derived_from_observation_id"], ["observations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_milestones_case_id", "milestones", ["case_id"])

    # 5. promise_tasks
    op.create_table(
        "promise_tasks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("case_id", sa.String(length=36), nullable=False),
        sa.Column("task_type", sa.String(length=64), nullable=False),
        sa.Column("owner_role", sa.String(length=32), nullable=False),
        sa.Column("due_at", sa.DateTime(), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False),
        sa.Column("evidence_required", sa.String(length=64), nullable=True),
        sa.Column("escalation_rung", sa.String(length=32), nullable=False),
        sa.Column("created_at_server", sa.DateTime(), nullable=False),
        sa.Column("updated_at_server", sa.DateTime(), nullable=False),
        sa.Column("created_by_actor_id", sa.String(length=64), nullable=True),
        sa.Column("row_version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_promise_tasks_case_id", "promise_tasks", ["case_id"])

    # 6. decisions
    op.create_table(
        "decisions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("case_id", sa.String(length=36), nullable=False),
        sa.Column("decision_type", sa.String(length=64), nullable=False),
        sa.Column("actor_id", sa.String(length=64), nullable=False),
        sa.Column("actor_role", sa.String(length=32), nullable=False),
        sa.Column("authority_basis", sa.String(length=128), nullable=True),
        sa.Column("result", sa.String(length=64), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("evidence_references", sa.JSON(), nullable=False),
        sa.Column("policy_version", sa.String(length=16), nullable=False),
        sa.Column("created_at_server", sa.DateTime(), nullable=False),
        sa.Column("updated_at_server", sa.DateTime(), nullable=False),
        sa.Column("created_by_actor_id", sa.String(length=64), nullable=True),
        sa.Column("row_version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 7. audit_events
    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("case_id", sa.String(length=36), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("actor_id", sa.String(length=64), nullable=False),
        sa.Column("actor_role", sa.String(length=32), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("payload_digest", sa.String(length=64), nullable=False),
        sa.Column("previous_hash", sa.String(length=64), nullable=True),
        sa.Column("event_hash", sa.String(length=64), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at_server", sa.DateTime(), nullable=False),
        sa.Column("updated_at_server", sa.DateTime(), nullable=False),
        sa.Column("created_by_actor_id", sa.String(length=64), nullable=True),
        sa.Column("row_version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("decisions")
    op.drop_table("promise_tasks")
    op.drop_table("milestones")
    op.drop_table("observations")
    op.drop_table("cases")
    op.drop_table("applications")
