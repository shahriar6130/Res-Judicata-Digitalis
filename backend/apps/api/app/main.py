from fastapi import FastAPI

from app.api.routes import cases, deferred, health, officer

app = FastAPI(
    title="Shakkho API",
    version="0.1.0",
    description="Evidence-grounded operational layer for Bangladesh legal aid services.",
)
app.include_router(health.router)
app.include_router(cases.router)
app.include_router(officer.router)
app.include_router(deferred.router)
