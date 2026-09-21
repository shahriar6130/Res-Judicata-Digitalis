"""Observation and evidence submission schemas."""
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class CreateObservationRequest(BaseModel):
    case_id: str
    field_key: str
    raw_value: str
    source_role: str = Field(..., description="Role providing the observation: CITIZEN, LAWYER, DLAO, etc.")
    source_actor_id: str
    channel: str = "WEB_PWA"
    evidence_document_ref: Optional[str] = None
    metadata_payload: Dict[str, Any] = Field(default_factory=dict)


class CreateObservationResponse(BaseModel):
    observation_id: str
    case_id: str
    field_key: str
    status: str
    reconciliation_triggered: bool
    message: str
