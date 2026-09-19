from collections.abc import Generator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.models import Actor, Case, Commitment, Organisation
from app.db.session import get_db
from app.main import app


@pytest.fixture
def session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        yield db
    Base.metadata.drop_all(engine)


@pytest.fixture
def seeded(session: Session):
    now = datetime.now(UTC)
    organisation = Organisation(name="Legal Aid Office", organisation_type="LEGAL_AID")
    actor = Actor(organisation_id=None, role="LAWYER", name="Fixture Lawyer", active=True)
    case = Case(
        reference="SHK-TEST-001",
        case_type="CIVIL",
        opened_at=now - timedelta(days=10),
        sensitivity="STANDARD",
    )
    session.add_all([organisation, actor, case])
    session.flush()
    actor.organisation_id = organisation.id
    commitment = Commitment(
        case_id=case.id,
        stage="HEARING",
        expected_event="Next hearing date",
        responsible_actor_id=actor.id,
        due_window_start=now - timedelta(days=1),
        due_window_end=now + timedelta(days=1),
        freshness_window_hours=None,
    )
    session.add(commitment)
    session.commit()
    return case, commitment, actor, organisation


@pytest.fixture
def client(session: Session) -> Generator[TestClient, None, None]:
    def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
