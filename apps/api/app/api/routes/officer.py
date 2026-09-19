from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Case, Commitment, MilestoneState
from app.db.session import get_db
from app.domain.evidence import EvidenceState
from app.schemas.api import QueueItem

router = APIRouter(prefix="/officer", tags=["officer"])
ACTIONABLE = {EvidenceState.MISSING, EvidenceState.DISPUTED, EvidenceState.STALE}


@router.get("/queue", response_model=list[QueueItem])
def officer_queue(
    state: EvidenceState | None = Query(default=None),
    case_type: str | None = Query(default=None),
    session: Session = Depends(get_db),
) -> list[QueueItem]:
    if state is not None and state not in ACTIONABLE:
        return []
    requested = [state.value] if state else [item.value for item in ACTIONABLE]
    statement = (
        select(MilestoneState, Commitment, Case)
        .join(Commitment, Commitment.id == MilestoneState.commitment_id)
        .join(Case, Case.id == Commitment.case_id)
        .where(MilestoneState.current_state.in_(requested))
    )
    if case_type:
        statement = statement.where(Case.case_type == case_type)
    now = datetime.now(UTC)
    result = []
    for milestone, commitment, case in session.execute(statement).all():
        since = milestone.last_evaluated_at
        if since.tzinfo is None:
            since = since.replace(tzinfo=UTC)
        result.append(
            QueueItem(
                case_id=case.id,
                case_reference=case.reference,
                case_type=case.case_type,
                commitment_id=commitment.id,
                field=milestone.field,
                state=milestone.current_state,
                condition_since=since,
                age_seconds=max(0, int((now - since).total_seconds())),
            )
        )
    return sorted(result, key=lambda item: (-item.age_seconds, str(item.commitment_id), item.field))
