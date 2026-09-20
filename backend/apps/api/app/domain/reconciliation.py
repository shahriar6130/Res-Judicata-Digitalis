from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.domain.evidence import EvidenceState

Normalizer = Callable[[Any], str]


def default_normalizer(value: Any) -> str:
    if isinstance(value, str):
        return " ".join(value.strip().casefold().split())
    return str(value)


@dataclass(frozen=True, slots=True)
class FieldPolicy:
    field: str
    required: bool = True
    due_window: timedelta | None = None
    freshness_applies: bool = False
    freshness_window: timedelta | None = None
    authoritative_source_types: frozenset[str] = frozenset()
    normalizer: Normalizer = default_normalizer


@dataclass(frozen=True, slots=True)
class ReconciliationPolicy:
    fields: dict[str, FieldPolicy]

    def for_field(self, field_name: str) -> FieldPolicy:
        try:
            return self.fields[field_name]
        except KeyError as exc:
            raise ValueError(f"Unknown reconciliation field: {field_name}") from exc


@dataclass(frozen=True, slots=True)
class ObservationFact:
    id: UUID
    field: str
    value: Any
    source_type: str
    observed_at: datetime
    source_actor_id: UUID | None = None
    source_organisation_id: UUID | None = None
    supersedes_observation_id: UUID | None = None
    confidence: Decimal | None = None


@dataclass(frozen=True, slots=True)
class ResolutionFact:
    id: UUID
    field: str
    chosen_value: Any
    observation_ids: frozenset[UUID]
    authority_basis: str
    reason: str
    authorised: bool = False


@dataclass(frozen=True, slots=True)
class ReconciliationRequest:
    field: str
    due_window_end: datetime | None
    evaluated_at: datetime
    observations: tuple[ObservationFact, ...] = ()
    resolutions: tuple[ResolutionFact, ...] = ()


@dataclass(frozen=True, slots=True)
class ReconciliationResult:
    state: EvidenceState
    value: Any | None
    contributing_observation_ids: tuple[UUID, ...] = field(default_factory=tuple)
    resolution_id: UUID | None = None
    reason_code: str = ""
    superseded_observation_ids: tuple[UUID, ...] = field(default_factory=tuple)


def _ordered_ids(observations: Iterable[ObservationFact]) -> tuple[UUID, ...]:
    return tuple(sorted((item.id for item in observations), key=str))


def reconcile(request: ReconciliationRequest, policy: ReconciliationPolicy) -> ReconciliationResult:
    """Derive an explainable milestone state without mutating evidence history."""
    rule = policy.for_field(request.field)
    applicable = [item for item in request.observations if item.field == request.field]
    superseded_ids = {item.supersedes_observation_id for item in applicable}
    active = [item for item in applicable if item.id not in superseded_ids]
    trace = tuple(sorted((item.id for item in applicable if item.id in superseded_ids), key=str))

    valued = [item for item in active if item.value is not None and str(item.value).strip()]
    if not valued:
        overdue = (
            request.due_window_end is not None and request.evaluated_at > request.due_window_end
        )
        return ReconciliationResult(
            state=EvidenceState.MISSING if overdue else EvidenceState.PENDING,
            value=None,
            reason_code="REQUIRED_VALUE_OVERDUE" if overdue else "AWAITING_REQUIRED_VALUE",
            superseded_observation_ids=trace,
        )

    groups: dict[str, list[ObservationFact]] = {}
    for item in valued:
        groups.setdefault(rule.normalizer(item.value), []).append(item)

    contributing = _ordered_ids(valued)
    if len(groups) > 1:
        active_ids = set(contributing)
        valid = sorted(
            (
                resolution
                for resolution in request.resolutions
                if resolution.field == request.field
                and resolution.authorised
                and resolution.observation_ids.issuperset(active_ids)
                and bool(resolution.authority_basis.strip())
                and bool(resolution.reason.strip())
                and rule.normalizer(resolution.chosen_value) in groups
            ),
            key=lambda item: str(item.id),
        )
        if valid:
            resolution = valid[-1]
            return ReconciliationResult(
                state=EvidenceState.VERIFIED_WITH_RESOLVED_CONFLICT,
                value=resolution.chosen_value,
                contributing_observation_ids=contributing,
                resolution_id=resolution.id,
                reason_code="AUTHORISED_RESOLUTION_ACCEPTED",
                superseded_observation_ids=trace,
            )
        return ReconciliationResult(
            state=EvidenceState.DISPUTED,
            value=None,
            contributing_observation_ids=contributing,
            reason_code="ACTIVE_VALUES_CONFLICT",
            superseded_observation_ids=trace,
        )

    items = next(iter(groups.values()))
    value = items[0].value
    newest = max(item.observed_at for item in items)
    if (
        rule.freshness_applies
        and rule.freshness_window is not None
        and request.evaluated_at > newest + rule.freshness_window
    ):
        return ReconciliationResult(
            EvidenceState.STALE,
            value,
            _ordered_ids(items),
            reason_code="EVIDENCE_FRESHNESS_EXPIRED",
            superseded_observation_ids=trace,
        )

    if any(item.source_type in rule.authoritative_source_types for item in items):
        state, reason = EvidenceState.VERIFIED, "ASSERTION_SPECIFIC_AUTHORITY"
    else:
        identities = {
            ("actor", item.source_actor_id)
            if item.source_actor_id is not None
            else ("organisation", item.source_organisation_id)
            for item in items
            if item.source_actor_id is not None or item.source_organisation_id is not None
        }
        state = EvidenceState.CORROBORATED if len(identities) >= 2 else EvidenceState.REPORTED
        reason = "INDEPENDENT_SOURCES_AGREE" if len(identities) >= 2 else "SINGLE_ATTRIBUTED_SOURCE"
    return ReconciliationResult(
        state,
        value,
        _ordered_ids(items),
        reason_code=reason,
        superseded_observation_ids=trace,
    )
