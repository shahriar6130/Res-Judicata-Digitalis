"""Pydantic schemas for Cases and Timelines."""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class MilestoneSchema(BaseModel):
    id: str
    milestone_type: str
    state: str
    explanation: Optional[str] = None
    achieved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PromiseSchema(BaseModel):
    id: str
    task_type: str
    owner_role: str
    due_at: datetime
    state: str
    evidence_required: Optional[str] = None
    escalation_rung: str

    class Config:
        from_attributes = True


class ObservationSchema(BaseModel):
    id: str
    field_key: str
    raw_value: str
    source_role: str
    source_actor_id: str
    channel: str
    verified: bool
    is_disputed: bool
    created_at_server: datetime

    class Config:
        from_attributes = True


class CaseDetailSchema(BaseModel):
    id: str
    case_reference: str
    status: str
    pathway: str
    priority: str
    office_scope_id: str
    policy_version: str
    status_sentence_bn: Optional[str] = None
    status_sentence_en: Optional[str] = None
    milestones: List[MilestoneSchema] = Field(default_factory=list)
    promises: List[PromiseSchema] = Field(default_factory=list)
    observations: List[ObservationSchema] = Field(default_factory=list)

    class Config:
        from_attributes = True
