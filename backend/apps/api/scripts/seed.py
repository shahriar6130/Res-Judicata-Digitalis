"""Seed script to populate initial development fixtures in Supabase PostgreSQL."""
import json
import logging
import os
import sys
from pathlib import Path

# Ensure app package is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import get_engine, Base
from app.core.config import settings
from app.models.entities import Application, Case, Observation, PromiseTask
from sqlalchemy.orm import sessionmaker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")


def run_seed():
    db_url = settings.effective_database_url
    if not db_url:
        logger.warning(
            "SUPABASE_DATABASE_URL not configured. Skipping live database seeding."
        )
        return

    engine = get_engine()
    if engine is None:
        logger.error("Could not obtain database engine.")
        return

    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    fixture_file = Path(__file__).parent.parent / "fixtures" / "development.json"
    if not fixture_file.exists():
        logger.warning("Fixture file %s not found.", fixture_file)
        return

    with open(fixture_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    tenant_id = data.get("tenant_id", "shakkho-dev-tenant")

    for case_data in data.get("cases", []):
        existing = session.query(Case).filter(Case.case_reference == case_data["case_reference"]).first()
        if existing:
            logger.info("Case %s already exists; skipping.", case_data["case_reference"])
            continue

        app_record = Application(
            tenant_id=tenant_id,
            official_id=case_data["official_id"],
            status="ADMITTED",
            channel="WEB_PWA",
            office_scope_id=data.get("office", {}).get("id", "OFFICE-DHK-CENTRAL"),
        )
        session.add(app_record)
        session.flush()

        case_record = Case(
            tenant_id=tenant_id,
            case_reference=case_data["case_reference"],
            application_id=app_record.id,
            office_scope_id=data.get("office", {}).get("id", "OFFICE-DHK-CENTRAL"),
            pathway=case_data.get("pathway", "LITIGATION"),
            status=case_data.get("status", "ACTIVE"),
            priority=case_data.get("priority", "NORMAL"),
            status_sentence_bn=case_data.get("status_sentence_bn"),
            status_sentence_en=case_data.get("status_sentence_en"),
        )
        session.add(case_record)
        session.flush()

        for obs in case_data.get("observations", []):
            o = Observation(
                tenant_id=tenant_id,
                case_id=case_record.id,
                source_role=obs.get("source_role", "CITIZEN"),
                source_actor_id=obs.get("source_actor_id", "actor-1"),
                channel=obs.get("channel", "WEB_PWA"),
                field_key=obs.get("field_key"),
                raw_value=obs.get("raw_value"),
                verified=False,
                is_disputed=False,
            )
            session.add(o)

        session.commit()
        logger.info("Successfully seeded case %s into Supabase database.", case_data["case_reference"])

    session.close()


if __name__ == "__main__":
    run_seed()
