from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.api import HealthReadiness

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthReadiness)
def health(session: Session = Depends(get_db)) -> HealthReadiness:
    database = "ready"
    try:
        session.execute(text("SELECT 1"))
    except Exception:  # database status is intentionally reported independently
        database = "unavailable"
    return HealthReadiness(application="ready", database=database)
