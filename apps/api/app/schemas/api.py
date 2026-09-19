from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domain.evidence import EvidenceState


class ObservationCreate(BaseModel):
    commitment_id: UUID
    field: str = Field(min_length=1, max_length=100)
    value: Any
    source_type: str = Field(min_length=1, max_length=80)
    source_actor_id: UUID | None = None
    source_organisation_id: UUID | None = None
    source_channel: str = Field(min_length=1, max_length=80)
    confidence: float | None = Field(default=None, ge=0, le=1)
    observed_at: datetime
    captured_at: datetime
    raw_ref: str | None = Field(default=None, max_length=500)
    supersedes_observation_id: UUID | None = None

    @model_validator(mode="after")
    def require_attribution(self):
        if self.source_actor_id is None and self.source_organisation_id is None:
            raise ValueError("source_actor_id or source_organisation_id is required")
        if self.observed_at.tzinfo is None or self.captured_at.tzinfo is None:
            raise ValueError("timestamps must include a timezone")
        return self


class ObservationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    commitment_id: UUID
    field: str
    value: Any
    source_type: str
    source_actor_id: UUID | None
    source_organisation_id: UUID | None
    source_channel: str
    confidence: float | None
    observed_at: datetime
    captured_at: datetime
    raw_ref: str | None
    supersedes_observation_id: UUID | None
    created_at: datetime


class MilestoneStateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    commitment_id: UUID
    field: str
    current_state: EvidenceState
    current_value: Any | None
    last_evaluated_at: datetime
    resolution_id: UUID | None


class ObservationResult(BaseModel):
    observation: ObservationRead
    milestone_state: MilestoneStateRead
    reason_code: str
    contributing_observation_ids: list[UUID]


class HealthReadiness(BaseModel):
    application: str
    database: str


class CaseSummary(BaseModel):
    id: UUID
    reference: str
    case_type: str
    opened_at: datetime
    sensitivity: str


class CommitmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    case_id: UUID
    stage: str
    expected_event: str
    responsible_actor_id: UUID | None
    due_window_start: datetime | None
    due_window_end: datetime | None
    freshness_window_hours: int | None
    created_at: datetime


class ResolutionRead(BaseModel):
    id: UUID
    commitment_id: UUID
    field: str
    chosen_value: Any
    officer_id: UUID
    authority_basis: str
    reason: str
    resolved_at: datetime
    created_at: datetime
    observation_ids: list[UUID]


class SupersessionRead(BaseModel):
    observation_id: UUID
    supersedes_observation_id: UUID


class TimelineResponse(BaseModel):
    case: CaseSummary
    commitments: list[CommitmentRead]
    observations: list[ObservationRead]
    milestone_states: list[MilestoneStateRead]
    resolutions: list[ResolutionRead]
    supersessions: list[SupersessionRead]


class QueueItem(BaseModel):
    case_id: UUID
    case_reference: str
    case_type: str
    commitment_id: UUID
    field: str
    state: EvidenceState
    condition_since: datetime
    age_seconds: int


class NotImplementedResponse(BaseModel):
    detail: str
