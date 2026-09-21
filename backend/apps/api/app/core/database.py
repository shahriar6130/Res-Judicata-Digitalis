"""Database engine, session management, and connection diagnostics for Supabase."""
import logging
import time
from typing import Generator, Optional, Tuple
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger(__name__)

Base = declarative_base()

# Initialize Engine lazily or conditionally
_engine = None
_SessionLocal = None


def get_engine():
    """Retrieve or construct the SQLAlchemy engine for Supabase PostgreSQL."""
    global _engine, _SessionLocal
    if _engine is not None:
        return _engine

    db_url = settings.effective_database_url
    if not db_url:
        logger.warning(
            "SUPABASE_DATABASE_URL or DATABASE_URL not set. Running in deferred database mode."
        )
        return None

    connect_args = {}
    if "sqlite" in db_url:
        connect_args["check_same_thread"] = False
    elif "supabase" in db_url or "pooler.supabase.com" in db_url or "sslmode" in db_url:
        # Supabase requires SSL and handles pooling
        connect_args["sslmode"] = "require"

    _engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20,
        connect_args=connect_args,
    )
    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _engine


def get_db() -> Generator[Optional[Session], None, None]:
    """FastAPI dependency yielding a database session."""
    engine = get_engine()
    if engine is None or _SessionLocal is None:
        # Yield None when database is not yet provisioned; handlers can inspect
        yield None
        return

    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> Tuple[bool, str, Optional[float]]:
    """Verify connectivity to the Supabase database instance.

    Returns:
        (connected: bool, message: str, latency_ms: Optional[float])
    """
    engine = get_engine()
    if engine is None:
        return (
            False,
            "Supabase database URL is not configured. Set SUPABASE_DATABASE_URL in .env.",
            None,
        )

    start_time = time.perf_counter()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        latency = (time.perf_counter() - start_time) * 1000
        return True, "Successfully connected to Supabase PostgreSQL database.", round(latency, 2)
    except Exception as exc:
        logger.error("Failed to connect to Supabase database: %s", exc)
        return False, f"Connection failed: {str(exc)}", None
