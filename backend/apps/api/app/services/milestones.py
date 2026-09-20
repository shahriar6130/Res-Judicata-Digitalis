from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Actor, Commitment, MilestoneState, Observation, Resolution
from app.domain.policies import DEFAULT_POLICY
from app.domain.reconciliation import (
    FieldPolicy,
    ObservationFact,
    ReconciliationPolicy,
    ReconciliationRequest,
    ResolutionFact,
    reconcile,
)


def _aware(value: datetime | None) -> datetime | None:
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=UTC)


def recompute_milestone(
    session: Session, commitment: Commitment, field_name: str, now: datetime | None = None
):
    evaluated_at = now or datetime.now(UTC)
    observations = session.scalars(
        select(Observation).where(Observation.commitment_id == commitment.id)
    ).all()
    resolutions = session.scalars(
        select(Resolution).where(Resolution.commitment_id == commitment.id)
    ).all()
    base_rule = DEFAULT_POLICY.for_field(field_name)
    freshness = (
        timedelta(hours=commitment.freshness_window_hours)
        if commitment.freshness_window_hours is not None
        else base_rule.freshness_window
    )
    policy = ReconciliationPolicy(
        fields={
            field_name: FieldPolicy(
                field=base_rule.field,
                required=base_rule.required,
                due_window=base_rule.due_window,
                freshness_applies=base_rule.freshness_applies,
                freshness_window=freshness,
                authoritative_source_types=base_rule.authoritative_source_types,
                normalizer=base_rule.normalizer,
            )
        }
    )
    result = reconcile(
        ReconciliationRequest(
            field=field_name,
            due_window_end=_aware(commitment.due_window_end),
            evaluated_at=evaluated_at,
            observations=tuple(
                ObservationFact(
                    id=item.id,
                    field=item.field,
                    value=item.value,
                    source_type=item.source_type,
                    source_actor_id=item.source_actor_id,
                    source_organisation_id=item.source_organisation_id,
                    observed_at=_aware(item.observed_at),
                    supersedes_observation_id=item.supersedes_observation_id,
                    confidence=item.confidence,
                )
                for item in observations
            ),
            resolutions=tuple(
                ResolutionFact(
                    id=item.id,
                    field=item.field,
                    chosen_value=item.chosen_value,
                    observation_ids=frozenset(observation.id for observation in item.observations),
                    authority_basis=item.authority_basis,
                    reason=item.reason,
                    authorised=bool(
                        (officer := session.get(Actor, item.officer_id))
                        and officer.active
                        and officer.role == "OFFICER"
                    ),
                )
                for item in resolutions
            ),
        ),
        policy,
    )
    projection = session.scalar(
        select(MilestoneState).where(
            MilestoneState.commitment_id == commitment.id, MilestoneState.field == field_name
        )
    )
    if projection is None:
        projection = MilestoneState(commitment_id=commitment.id, field=field_name)
        session.add(projection)
    projection.current_state = result.state.value
    projection.current_value = result.value
    projection.last_evaluated_at = evaluated_at
    projection.resolution_id = result.resolution_id
    session.flush()
    return projection, result
