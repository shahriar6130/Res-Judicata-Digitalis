"""Generate OpenAPI specification and contract schemas from the FastAPI backend."""
import json
import os
import sys
from pathlib import Path

# Ensure app package is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from app.main import app
    from fastapi.openapi.utils import get_openapi
except ImportError:
    app = None


def generate_contracts():
    contracts_dir = Path(__file__).parent.parent.parent / "packages" / "contracts"
    contracts_dir.mkdir(parents=True, exist_ok=True)
    openapi_file = contracts_dir / "openapi.json"

    if app is not None:
        schema = get_openapi(
            title=app.title,
            version=app.version,
            openapi_version=app.openapi_version,
            description=app.description,
            routes=app.routes,
        )
    else:
        # Fallback static schema if fastapi is not yet installed in active python env
        schema = {
            "openapi": "3.1.0",
            "info": {
                "title": "Shakkho Legal Aid API",
                "version": "0.1.0",
                "description": "Evidence-grounded operational API with Supabase PostgreSQL",
            },
            "paths": {
                "/health": {"get": {"summary": "Health Check"}},
                "/health/db": {"get": {"summary": "Database Ping"}},
                "/cases": {"get": {"summary": "List Cases"}},
                "/cases/{case_ref}": {"get": {"summary": "Get Case Detail"}},
                "/observations": {"post": {"summary": "Record Observation"}},
                "/resolutions": {"post": {"summary": "Authoritative Resolution Gate"}},
            },
        }

    with open(openapi_file, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2)

    print(f"OpenAPI contract generated at: {openapi_file}")


if __name__ == "__main__":
    generate_contracts()
