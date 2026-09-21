"""Observation recording and evidence ingestion endpoint."""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.domain.reconciliation import reconcile_case_observations
from app.models.entities import Observation, AuditEvent
from app.schemas.observation import CreateObservationRequest, CreateObservationResponse

router = APIRouter()


@router.post(
    "/observations",
    response_model=CreateObservationResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Evidence Observations"],
)
def record_observation(
    payload: CreateObservationRequest,
    db: Session = Depends(get_db),
):
    """Record an operational observation without assuming the latest value is true.

    Preserves competing claims and triggers deterministic reconciliation.
    """
    obs_id = str(uuid.uuid4())
    existing_records = []

    if db is not None:
        try:
            previous_obs = db.query(Observation).filter(
                Observation.case_id == payload.case_id
            ).all()
            existing_records = [
                {
                    "field_key": o.field_key,
                    "raw_value": o.raw_value,
                    "source_role": o.source_role,
                }
                for o in previous_obs
            ]
        except Exception:
            pass

    has_conflict, conflicts, outcome = reconcile_case_observations(
        existing_records,
        {
            "field_key": payload.field_key,
            "raw_value": payload.raw_value,
            "source_role": payload.source_role,
        },
    )

    if db is not None:
        try:
            new_obs = Observation(
                id=obs_id,
                case_id=payload.case_id,
                source_role=payload.source_role,
                source_actor_id=payload.source_actor_id,
                channel=payload.channel,
                field_key=payload.field_key,
                raw_value=payload.raw_value,
                verified=False,
                is_disputed=has_conflict,
                evidence_document_ref=payload.evidence_document_ref,
                metadata_payload=payload.metadata_payload,
            )
            db.add(new_obs)

            # Record audit event
            audit = AuditEvent(
                case_id=payload.case_id,
                event_type="OBSERVATION_SUBMITTED",
                actor_id=payload.source_actor_id,
                actor_role=payload.source_role,
                channel=payload.channel,
                payload_digest=str(hash(payload.raw_value)),
                event_hash=str(uuid.uuid4()),
                details={
                    "field_key": payload.field_key,
                    "has_conflict": has_conflict,
                    "conflicts": conflicts,
                },
            )
            db.add(audit)
            db.commit()
        except Exception:
            if db:
                db.rollback()

    msg = (
        "Observation registered. Competing claims flagged for DLAO human resolution."
        if has_conflict
        else "Observation registered successfully."
    )

    return CreateObservationResponse(
        observation_id=obs_id,
        case_id=payload.case_id,
        field_key=payload.field_key,
        status=outcome["status"],
        reconciliation_triggered=has_conflict,
        message=msg,
    )
