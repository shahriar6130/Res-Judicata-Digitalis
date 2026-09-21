"""Shakkho FastAPI Application Entry Point."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import settings
from app.core.database import check_database_connection, get_engine
from app.models.base import Base

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger("shakkho.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown hooks."""
    logger.info("Initializing %s v%s...", settings.APP_NAME, settings.APP_VERSION)

    # Diagnostic check for Supabase database
    connected, message, latency = check_database_connection()
    if connected:
        logger.info("Database verified: %s (latency: %sms)", message, latency)
        # In development or testing, attempt to reflect or create tables if configured
        try:
            engine = get_engine()
            if engine is not None:
                Base.metadata.create_all(bind=engine)
                logger.info("Database schema tables verified.")
        except Exception as exc:
            logger.warning("Could not automatically run create_all on database: %s", exc)
    else:
        logger.warning(
            "Supabase PostgreSQL not yet connected: %s. "
            "Set SUPABASE_DATABASE_URL in .env to initiate the live database.",
            message,
        )

    yield

    logger.info("Shutting down %s...", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Evidence-grounded operational API for Bangladesh Legal Aid Services (Shakkho). "
        "Preserves conflicting observations, reconciles milestones, and connects to "
        "Supabase PostgreSQL."
    ),
    lifespan=lifespan,
)

# CORS middleware for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router)  # root convenience aliases for health and docs


@app.get("/", tags=["Root"])
def root_summary():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "database_backend": "Supabase PostgreSQL",
        "docs_url": "/docs",
        "openapi_url": "/openapi.json",
        "health_url": "/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
