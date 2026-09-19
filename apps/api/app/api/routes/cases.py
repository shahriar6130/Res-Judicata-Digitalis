import hashlib
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import (
    Actor,
    Case,
    Commitment,
    IdempotencyRecord,
    Observation,
    Organisation,
    Resolution,
)
from app.db.session import get_db
from app.domain.policies import DEFAULT_POLICY
from app.schemas.api import (
    CaseSummary,
    CommitmentRead,
    MilestoneStateRead,
    ObservationCreate,
    ObservationRead,
    ObservationResult,
    ResolutionRead,
    SupersessionRead,
    TimelineResponse,
)
from app.services.milestones import recompute_milestone

router = APIRouter(prefix="/cases", tags=["cases"])


@router.post(
    "/{case_id}/observations",
    response_model=ObservationResult,
    status_code=status.HTTP_201_CREATED,
)
def create_observation(
    case_id: UUID,
    payload: ObservationCreate,
    idempotency_key: str = Header(min_length=1, max_length=200, alias="Idempotency-Key"),
    session: Session = Depends(get_db),
) -> ObservationResult:
    commitment = session.get(Commitment, payload.commitment_id)
    if commitment is None or commitment.case_id != case_id:
        raise HTTPException(status_code=404, detail="Commitment not found for case")
    try:
        DEFAULT_POLICY.for_field(payload.field)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if payload.source_actor_id:
        actor = session.get(Actor, payload.source_actor_id)
        if actor is None or not actor.active:
            raise HTTPException(status_code=422, detail="Source actor must exist and be active")
    if payload.source_organisation_id:
        organisation = session.get(Organisation, payload.source_organisation_id)
        if organisation is None or not organisation.active:
            raise HTTPException(
                status_code=422, detail="Source organisation must exist and be active"
            )
    if payload.supersedes_observation_id:
        prior = session.get(Observation, payload.supersedes_observation_id)
        if prior is None or prior.commitment_id != commitment.id or prior.field != payload.field:
            raise HTTPException(
                status_code=422, detail="Superseded observation must match field and commitment"
            )

    scope = f"case-observation:{case_id}"
    request_hash = hashlib.sha256(payload.model_dump_json().encode()).hexdigest()
    existing = session.scalar(
        select(IdempotencyRecord).where(
            IdempotencyRecord.scope == scope, IdempotencyRecord.key == idempotency_key
        )
    )
    if existing:
        if existing.request_hash != request_hash:
            raise HTTPException(
                status_code=409, detail="Idempotency key was used with a different payload"
            )
        observation = session.get(Observation, existing.observation_id)
        projection, result = recompute_milestone(session, commitment, payload.field)
        session.commit()
        return ObservationResult(
            observation=ObservationRead.model_validate(observation),
            milestone_state=MilestoneStateRead.model_validate(projection),
            reason_code=result.reason_code,
            contributing_observation_ids=list(result.contributing_observation_ids),
        )

    observation = Observation(**payload.model_dump())
    session.add(observation)
    session.flush()
    session.add(
        IdempotencyRecord(
            scope=scope,
            key=idempotency_key,
            request_hash=request_hash,
            observation_id=observation.id,
        )
    )
    projection, result = recompute_milestone(session, commitment, payload.field)
    session.commit()
    return ObservationResult(
        observation=ObservationRead.model_validate(observation),
        milestone_state=MilestoneStateRead.model_validate(projection),
        reason_code=result.reason_code,
        contributing_observation_ids=list(result.contributing_observation_ids),
    )


@router.get("/{case_id}/timeline", response_model=TimelineResponse)
def timeline(case_id: UUID, session: Session = Depends(get_db)) -> TimelineResponse:
    case = session.scalar(
        select(Case)
        .where(Case.id == case_id)
        .options(
            selectinload(Case.commitments).selectinload(Commitment.observations),
            selectinload(Case.commitments).selectinload(Commitment.milestone_states),
            selectinload(Case.commitments)
            .selectinload(Commitment.resolutions)
            .selectinload(Resolution.observations),
        )
    )
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    commitments = sorted(case.commitments, key=lambda item: (item.created_at, str(item.id)))
    observations = sorted(
        (item for commitment in commitments for item in commitment.observations),
        key=lambda item: (item.observed_at, item.created_at, str(item.id)),
    )
    resolutions = sorted(
        (item for commitment in commitments for item in commitment.resolutions),
        key=lambda item: (item.resolved_at, str(item.id)),
    )
    states = sorted(
        (item for commitment in commitments for item in commitment.milestone_states),
        key=lambda item: (str(item.commitment_id), item.field),
    )
    return TimelineResponse(
        case=CaseSummary.model_validate(case, from_attributes=True),
        commitments=[CommitmentRead.model_validate(item) for item in commitments],
        observations=[ObservationRead.model_validate(item) for item in observations],
        milestone_states=[MilestoneStateRead.model_validate(item) for item in states],
        resolutions=[
            ResolutionRead(
                **ResolutionRead.model_validate(
                    {**item.__dict__, "observation_ids": [obs.id for obs in item.observations]}
                ).model_dump()
            )
            for item in resolutions
        ],
        supersessions=[
            SupersessionRead(
                observation_id=item.id, supersedes_observation_id=item.supersedes_observation_id
            )
            for item in observations
            if item.supersedes_observation_id is not None
        ],
    )
