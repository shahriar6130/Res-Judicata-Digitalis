"""Health and system diagnostic schemas."""
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class DatabaseDiagnostic(BaseModel):
    configured: bool = Field(..., description="Whether Supabase DB URL is provided")
    connected: bool = Field(..., description="Whether ping succeeded")
    message: str = Field(..., description="Status message or diagnostic recommendation")
    latency_ms: Optional[float] = Field(None, description="Roundtrip query latency in milliseconds")
    pooler_mode: Optional[str] = Field(None, description="Connection pooler mode (transaction / session)")


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    environment: str
    database: DatabaseDiagnostic
    supabase_client_ready: bool
    timestamp: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
