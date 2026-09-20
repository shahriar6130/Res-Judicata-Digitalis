import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from app.db.models import Actor, Case, Commitment, Observation, Organisation
from app.db.session import SessionLocal
from app.services.milestones import recompute_milestone

FIXTURES = Path(__file__).parents[1] / "fixtures" / "development.json"


def seed() -> None:
    definitions = json.loads(FIXTURES.read_text())
    now = datetime.now(UTC)
    with SessionLocal.begin() as session:
        if session.scalar(select(Case.id).where(Case.reference.like("SHK-DEMO-%"))):
            print("Development fixtures already exist; no changes made.")
            return
        legal_aid = Organisation(name="District Legal Aid Office", organisation_type="LEGAL_AID")
        court = Organisation(name="Demo Court", organisation_type="COURT")
        lawyer = Actor(role="LAWYER", name="Demo Lawyer", active=True)
        officer = Actor(role="OFFICER", name="Demo Officer", active=True)
        session.add_all([legal_aid, court, lawyer, officer])
        session.flush()
        lawyer.organisation_id = legal_aid.id
        officer.organisation_id = legal_aid.id
        actors = {"lawyer": lawyer, "officer": officer}
        organisations = {"court": court}
        for index, definition in enumerate(definitions, 1):
            case = Case(
                reference=f"SHK-DEMO-{index:03d}",
                case_type="CIVIL",
                opened_at=now - timedelta(days=index),
                sensitivity="STANDARD",
            )
            session.add(case)
            session.flush()
            commitment = Commitment(
                case_id=case.id,
                stage="HEARING" if definition["field"] == "hearing_date" else "CLIENT_CONTACT",
                expected_event=definition["field"].replace("_", " ").title(),
                responsible_actor_id=officer.id,
                due_window_start=now - timedelta(hours=24),
                due_window_end=now + timedelta(hours=definition["due_offset_hours"]),
                freshness_window_hours=definition.get("freshness_window_hours"),
            )
            session.add(commitment)
            session.flush()
            observed_at = now + timedelta(hours=definition.get("observed_offset_hours", 0))
            for item in definition["observations"]:
                actor = actors.get(item.get("actor"))
                organisation = organisations.get(item.get("organisation"))
                session.add(
                    Observation(
                        commitment_id=commitment.id,
                        field=definition["field"],
                        value=item["value"],
                        source_type=item["source_type"],
                        source_actor_id=actor.id if actor else None,
                        source_organisation_id=organisation.id if organisation else None,
                        source_channel="FIXTURE",
                        observed_at=observed_at,
                        captured_at=now,
                    )
                )
            session.flush()
            recompute_milestone(session, commitment, definition["field"], now)
    print(f"Seeded {len(definitions)} development cases from {FIXTURES.name}.")


if __name__ == "__main__":
    seed()
