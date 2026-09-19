from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest

from app.domain.evidence import EvidenceState
from app.domain.reconciliation import (
    FieldPolicy,
    ObservationFact,
    ReconciliationPolicy,
    ReconciliationRequest,
    ResolutionFact,
    reconcile,
)

NOW = datetime(2026, 9, 20, 12, tzinfo=UTC)
FIELD = "hearing_date"
POLICY = ReconciliationPolicy(
    {FIELD: FieldPolicy(FIELD, authoritative_source_types=frozenset({"CAUSE_LIST"}))}
)


def uid(number: int) -> UUID:
    return UUID(int=number)


def observation(
    number: int,
    value="2026-09-28",
    *,
    actor: int | None = 100,
    organisation: int | None = None,
    source_type="LAWYER_REPORT",
    field=FIELD,
    observed_at=NOW,
    supersedes: int | None = None,
) -> ObservationFact:
    return ObservationFact(
        id=uid(number),
        field=field,
        value=value,
        source_type=source_type,
        source_actor_id=uid(actor) if actor else None,
        source_organisation_id=uid(organisation) if organisation else None,
        observed_at=observed_at,
        supersedes_observation_id=uid(supersedes) if supersedes else None,
    )


def run(*items, due=NOW + timedelta(days=1), policy=POLICY, resolutions=()):
    return reconcile(
        ReconciliationRequest(FIELD, due, NOW, tuple(items), tuple(resolutions)), policy
    )


def test_no_observation_before_deadline_is_pending():
    assert run().state is EvidenceState.PENDING


def test_no_required_value_after_deadline_is_missing():
    assert run(due=NOW - timedelta(seconds=1)).state is EvidenceState.MISSING


def test_one_attributed_lawyer_report_is_reported():
    assert run(observation(1)).state is EvidenceState.REPORTED


def test_two_independent_actors_agreeing_are_corroborated():
    assert (
        run(observation(1, actor=100), observation(2, actor=101)).state
        is EvidenceState.CORROBORATED
    )


def test_same_actor_using_two_channels_remains_reported():
    assert run(observation(1, actor=100), observation(2, actor=100)).state is EvidenceState.REPORTED


def test_uncontested_assertion_specific_authority_is_verified():
    assert (
        run(observation(1, actor=None, organisation=50, source_type="CAUSE_LIST")).state
        is EvidenceState.VERIFIED
    )


def test_lawyer_date_conflicting_with_court_date_is_disputed():
    result = run(observation(1), observation(2, "2026-09-30", source_type="CAUSE_LIST"))
    assert result.state is EvidenceState.DISPUTED


def test_conflicting_authoritative_records_remain_disputed():
    result = run(
        observation(1, source_type="CAUSE_LIST"),
        observation(2, "2026-09-30", source_type="CAUSE_LIST"),
    )
    assert result.state is EvidenceState.DISPUTED


def test_valid_officer_resolution_resolves_the_visible_conflict():
    resolution = ResolutionFact(
        uid(30),
        FIELD,
        "2026-09-30",
        frozenset({uid(1), uid(2)}),
        "Court order",
        "Signed order controls",
        authorised=True,
    )
    result = run(observation(1), observation(2, "2026-09-30"), resolutions=(resolution,))
    assert result.state is EvidenceState.VERIFIED_WITH_RESOLVED_CONFLICT
    assert result.resolution_id == uid(30)


def test_complete_but_unauthorised_resolution_does_not_resolve_conflict():
    resolution = ResolutionFact(
        uid(30),
        FIELD,
        "2026-09-30",
        frozenset({uid(1), uid(2)}),
        "Court order",
        "Signed order controls",
    )
    result = run(observation(1), observation(2, "2026-09-30"), resolutions=(resolution,))
    assert result.state is EvidenceState.DISPUTED


@pytest.mark.parametrize(
    ("references", "reason"),
    [(frozenset({uid(1)}), "Valid reason"), (frozenset({uid(1), uid(2)}), "")],
)
def test_resolution_without_all_evidence_references_or_reason_is_rejected(references, reason):
    resolution = ResolutionFact(
        uid(30), FIELD, "2026-09-30", references, "Court order", reason, authorised=True
    )
    result = run(observation(1), observation(2, "2026-09-30"), resolutions=(resolution,))
    assert result.state is EvidenceState.DISPUTED


def test_verified_time_sensitive_value_can_become_stale():
    policy = ReconciliationPolicy(
        {
            FIELD: FieldPolicy(
                FIELD,
                freshness_applies=True,
                freshness_window=timedelta(hours=24),
                authoritative_source_types=frozenset({"CAUSE_LIST"}),
            )
        }
    )
    result = run(
        observation(1, source_type="CAUSE_LIST", observed_at=NOW - timedelta(days=2)), policy=policy
    )
    assert result.state is EvidenceState.STALE


def test_unrelated_partial_observation_does_not_prevent_missing():
    result = run(
        observation(1, value="something", field="other_field"), due=NOW - timedelta(seconds=1)
    )
    assert result.state is EvidenceState.MISSING


def test_superseded_evidence_remains_traceable_but_not_active():
    result = run(observation(1, "2026-09-28"), observation(2, "2026-09-30", supersedes=1))
    assert result.state is EvidenceState.REPORTED
    assert result.value == "2026-09-30"
    assert result.superseded_observation_ids == (uid(1),)


def test_reconciliation_is_deterministic_regardless_of_input_order():
    first, second = observation(1, actor=100), observation(2, actor=101)
    assert run(first, second) == run(second, first)
