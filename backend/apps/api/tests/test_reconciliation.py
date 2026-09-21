"""Unit tests for pure deterministic evidence reconciliation domain."""
from app.domain.reconciliation import reconcile_case_observations


def test_reconcile_no_conflict():
    existing = [
        {"field_key": "HEARING_DATE", "raw_value": "2026-09-24", "source_role": "CITIZEN"}
    ]
    new_obs = {"field_key": "HEARING_DATE", "raw_value": "2026-09-24", "source_role": "LAWYER"}
    has_conflict, conflicts, outcome = reconcile_case_observations(existing, new_obs)

    assert not has_conflict
    assert len(conflicts) == 0
    assert outcome["status"] == "ACCEPTED_PENDING_GATE"


def test_reconcile_with_conflict():
    existing = [
        {"field_key": "HEARING_DATE", "raw_value": "2026-09-24", "source_role": "CITIZEN"}
    ]
    new_obs = {"field_key": "HEARING_DATE", "raw_value": "2026-09-28", "source_role": "LAWYER"}
    has_conflict, conflicts, outcome = reconcile_case_observations(existing, new_obs)

    assert has_conflict
    assert len(conflicts) == 1
    assert outcome["status"] == "REQUIRES_HUMAN_RESOLUTION"
