"""Health and Supabase connection diagnostic endpoints."""
from datetime import datetime
from fastapi import APIRouter
from app.core.config import settings
from app.core.database import check_database_connection
from app.core.supabase_client import get_supabase_client
from app.schemas.health import HealthResponse, DatabaseDiagnostic

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["Diagnostics"])
def health_check():
    """Verify backend system status, Supabase database connection, and API client readiness."""
    connected, message, latency_ms = check_database_connection()

    pooler_mode = None
    db_url = settings.effective_database_url or ""
    if ":6543" in db_url:
        pooler_mode = "transaction_pooler (port 6543)"
    elif ":5432" in db_url:
        pooler_mode = "direct_or_session (port 5432)"

    supabase_client_ready = get_supabase_client() is not None

    return HealthResponse(
        status="ok" if connected else "degraded",
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        database=DatabaseDiagnostic(
            configured=bool(settings.effective_database_url),
            connected=connected,
            message=message,
            latency_ms=latency_ms,
            pooler_mode=pooler_mode,
        ),
        supabase_client_ready=supabase_client_ready,
        timestamp=datetime.utcnow().isoformat(),
        metadata={
            "supabase_url": settings.effective_supabase_url,
            "supabase_url_configured": bool(settings.effective_supabase_url),
            "service_role_configured": bool(settings.SUPABASE_SERVICE_ROLE_KEY),
            "anon_key_configured": bool(settings.SUPABASE_ANON_KEY),
        },
    )


@router.get("/health/db", tags=["Diagnostics"])
def database_ping():
    """Specific endpoint testing direct query ping to Supabase PostgreSQL."""
    connected, message, latency_ms = check_database_connection()
    return {
        "status": "connected" if connected else "disconnected",
        "message": message,
        "latency_ms": latency_ms,
        "configured": bool(settings.effective_database_url),
        "guidance": (
            "Connected to Supabase PostgreSQL."
            if connected
            else "Please provide SUPABASE_DATABASE_URL in your backend .env file or environment variables."
        ),
    }
