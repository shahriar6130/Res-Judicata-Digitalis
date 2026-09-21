"""Application configuration and environment settings for Supabase."""
from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Project Information
    APP_NAME: str = "Shakkho Legal Aid API"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "info"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Supabase PostgreSQL Connection
    # Can be provided as SUPABASE_DATABASE_URL or DATABASE_URL
    SUPABASE_DATABASE_URL: Optional[str] = Field(
        default=None,
        description="Supabase PostgreSQL pooled or direct connection string",
    )
    DATABASE_URL: Optional[str] = Field(
        default=None,
        description="Primary database connection string",
    )

    # Supabase API & Auth Service
    SUPABASE_URL: Optional[str] = Field(
        default=None,
        description="Supabase Project API URL (e.g. https://xxx.supabase.co)",
    )
    SUPABASE_ANON_KEY: Optional[str] = Field(
        default=None,
        description="Supabase public/anon API key",
    )
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = Field(
        default=None,
        description="Supabase service role key (backend operations)",
    )

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://res-judicata-digitalis.vercel.app",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    @property
    def effective_supabase_url(self) -> Optional[str]:
        """Resolve Supabase API URL from explicit SUPABASE_URL or when passed via SUPABASE_DATABASE_URL."""
        if self.SUPABASE_URL and self.SUPABASE_URL.startswith("http"):
            return self.SUPABASE_URL
        raw = self.SUPABASE_DATABASE_URL or ""
        if raw.startswith("http://") or raw.startswith("https://"):
            return raw.rstrip("/")
        return self.SUPABASE_URL

    @property
    def effective_database_url(self) -> Optional[str]:
        """Resolve effective PostgreSQL connection string with driver normalization."""
        raw_url = self.DATABASE_URL
        if not raw_url and self.SUPABASE_DATABASE_URL and not self.SUPABASE_DATABASE_URL.startswith("http"):
            raw_url = self.SUPABASE_DATABASE_URL

        if not raw_url:
            return None
        # Handle Heroku/legacy postgres:// format by upgrading to postgresql://
        if raw_url.startswith("postgres://"):
            raw_url = raw_url.replace("postgres://", "postgresql://", 1)
        return raw_url

    @property
    def is_supabase_configured(self) -> bool:
        """Return True if either Supabase DB connection or Supabase URL is set."""
        return bool(self.effective_database_url or self.effective_supabase_url)


settings = Settings()
