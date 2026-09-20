from datetime import UTC, datetime

from app.db.models import MilestoneState
from app.domain.evidence import EvidenceState


def payload(commitment, actor, value="2026-09-28"):
    now = datetime.now(UTC).isoformat()
    return {
        "commitment_id": str(commitment.id),
        "field": "hearing_date",
        "value": value,
        "source_type": "LAWYER_REPORT",
        "source_actor_id": str(actor.id),
        "source_channel": "PHONE",
        "observed_at": now,
        "captured_at": now,
    }


def test_health_reports_application_and_database_readiness_separately(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"application": "ready", "database": "ready"}


def test_observation_requires_an_idempotency_key(client, seeded):
    case, commitment, actor, _ = seeded
    response = client.post(f"/cases/{case.id}/observations", json=payload(commitment, actor))
    assert response.status_code == 422


def test_observation_is_append_only_idempotent_and_recomputes_state(client, seeded, session):
    case, commitment, actor, _ = seeded
    body = payload(commitment, actor)
    first = client.post(
        f"/cases/{case.id}/observations", json=body, headers={"Idempotency-Key": "request-1"}
    )
    second = client.post(
        f"/cases/{case.id}/observations", json=body, headers={"Idempotency-Key": "request-1"}
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["observation"]["id"] == second.json()["observation"]["id"]
    assert first.json()["milestone_state"]["current_state"] == EvidenceState.REPORTED
    assert session.query(MilestoneState).one().current_value == "2026-09-28"


def test_reusing_idempotency_key_for_different_payload_is_conflict(client, seeded):
    case, commitment, actor, _ = seeded
    first = payload(commitment, actor)
    client.post(f"/cases/{case.id}/observations", json=first, headers={"Idempotency-Key": "same"})
    changed = {**first, "value": "2026-09-30"}
    response = client.post(
        f"/cases/{case.id}/observations", json=changed, headers={"Idempotency-Key": "same"}
    )
    assert response.status_code == 409


def test_timeline_returns_evidence_and_current_projection(client, seeded):
    case, commitment, actor, _ = seeded
    client.post(
        f"/cases/{case.id}/observations",
        json=payload(commitment, actor),
        headers={"Idempotency-Key": "timeline"},
    )
    response = client.get(f"/cases/{case.id}/timeline")
    assert response.status_code == 200
    assert response.json()["case"]["reference"] == "SHK-TEST-001"
    assert len(response.json()["observations"]) == 1


def test_officer_queue_filters_and_orders_actionable_states(client, seeded, session):
    case, commitment, *_ = seeded
    session.add(
        MilestoneState(
            commitment_id=commitment.id,
            field="hearing_date",
            current_state=EvidenceState.DISPUTED,
            current_value=None,
            last_evaluated_at=datetime.now(UTC),
        )
    )
    session.commit()
    response = client.get("/officer/queue", params={"state": "DISPUTED", "case_type": "CIVIL"})
    assert response.status_code == 200
    assert response.json()[0]["case_id"] == str(case.id)


def test_deferred_mutations_return_clear_not_implemented_responses(client):
    response = client.post("/milestones/00000000-0000-0000-0000-000000000001/resolutions")
    assert response.status_code == 501
    assert "Phase 2" in response.json()["detail"]
