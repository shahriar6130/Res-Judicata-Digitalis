import uuid
from datetime import datetime
from typing import Annotated, Any

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.domain.evidence import EvidenceState

UuidPk = Annotated[uuid.UUID, mapped_column(primary_key=True, default=uuid.uuid4)]


resolution_observations = Table(
    "resolution_observations",
    Base.metadata,
    Column("resolution_id", ForeignKey("resolutions.id", ondelete="CASCADE"), primary_key=True),
    Column("observation_id", ForeignKey("observations.id"), primary_key=True),
)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Case(Base, TimestampMixin):
    __tablename__ = "cases"
    id: Mapped[UuidPk]
    reference: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    case_type: Mapped[str] = mapped_column(String(80), index=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sensitivity: Mapped[str] = mapped_column(String(40), default="STANDARD")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    commitments: Mapped[list["Commitment"]] = relationship(back_populates="case")


class Organisation(Base):
    __tablename__ = "organisations"
    id: Mapped[UuidPk]
    name: Mapped[str] = mapped_column(String(200))
    organisation_type: Mapped[str] = mapped_column(String(80))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Actor(Base):
    __tablename__ = "actors"
    id: Mapped[UuidPk]
    organisation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organisations.id"))
    role: Mapped[str] = mapped_column(String(80))
    name: Mapped[str] = mapped_column(String(200))
    contact: Mapped[str | None] = mapped_column(String(200))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Assignment(Base):
    __tablename__ = "assignments"
    id: Mapped[UuidPk]
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id"), index=True)
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("actors.id"), index=True)
    role: Mapped[str] = mapped_column(String(80))
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Commitment(Base, TimestampMixin):
    __tablename__ = "commitments"
    id: Mapped[UuidPk]
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id"), index=True)
    stage: Mapped[str] = mapped_column(String(80))
    expected_event: Mapped[str] = mapped_column(String(160))
    responsible_actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("actors.id"))
    due_window_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_window_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    freshness_window_hours: Mapped[int | None]
    case: Mapped[Case] = relationship(back_populates="commitments")
    observations: Mapped[list["Observation"]] = relationship(back_populates="commitment")
    resolutions: Mapped[list["Resolution"]] = relationship(back_populates="commitment")
    milestone_states: Mapped[list["MilestoneState"]] = relationship(back_populates="commitment")


class Observation(Base, TimestampMixin):
    __tablename__ = "observations"
    id: Mapped[UuidPk]
    commitment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("commitments.id"), index=True)
    field: Mapped[str] = mapped_column(String(100), index=True)
    value: Mapped[Any] = mapped_column(JSON)
    source_type: Mapped[str] = mapped_column(String(80))
    source_actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("actors.id"))
    source_organisation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organisations.id"))
    source_channel: Mapped[str] = mapped_column(String(80))
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 4))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    raw_ref: Mapped[str | None] = mapped_column(String(500))
    supersedes_observation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("observations.id")
    )
    commitment: Mapped[Commitment] = relationship(back_populates="observations")


class Resolution(Base, TimestampMixin):
    __tablename__ = "resolutions"
    id: Mapped[UuidPk]
    commitment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("commitments.id"), index=True)
    field: Mapped[str] = mapped_column(String(100), index=True)
    chosen_value: Mapped[Any] = mapped_column(JSON)
    officer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("actors.id"))
    authority_basis: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text)
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    commitment: Mapped[Commitment] = relationship(back_populates="resolutions")
    observations: Mapped[list[Observation]] = relationship(secondary=resolution_observations)


class MilestoneState(Base):
    __tablename__ = "milestone_states"
    __table_args__ = (UniqueConstraint("commitment_id", "field"),)
    id: Mapped[UuidPk]
    commitment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("commitments.id"), index=True)
    field: Mapped[str] = mapped_column(String(100))
    current_state: Mapped[str] = mapped_column(String(60), default=EvidenceState.PENDING.value)
    current_value: Mapped[Any | None] = mapped_column(JSON)
    last_evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    resolution_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("resolutions.id"))
    commitment: Mapped[Commitment] = relationship(back_populates="milestone_states")


class ClaimPacket(Base, TimestampMixin):
    __tablename__ = "claim_packets"
    id: Mapped[UuidPk]
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id"), index=True)
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("actors.id"))
    policy_version: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(40))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ClaimPacketItem(Base):
    __tablename__ = "claim_packet_items"
    id: Mapped[UuidPk]
    packet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("claim_packets.id"), index=True)
    requirement_code: Mapped[str] = mapped_column(String(100))
    evidence_ref: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(40))


class NotificationOutbox(Base, TimestampMixin):
    __tablename__ = "notification_outbox"
    id: Mapped[UuidPk]
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id"), index=True)
    template: Mapped[str] = mapped_column(String(100))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    idempotency_key: Mapped[str] = mapped_column(String(200), unique=True)
    status: Mapped[str] = mapped_column(String(40))
    attempts: Mapped[int] = mapped_column(default=0)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class IdempotencyRecord(Base, TimestampMixin):
    __tablename__ = "idempotency_records"
    __table_args__ = (UniqueConstraint("scope", "key"),)
    id: Mapped[UuidPk]
    scope: Mapped[str] = mapped_column(String(200))
    key: Mapped[str] = mapped_column(String(200))
    request_hash: Mapped[str] = mapped_column(String(64))
    observation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("observations.id"))
