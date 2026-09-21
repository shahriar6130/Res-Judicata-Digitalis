"""Human authority resolution gate endpoint (Phase 2)."""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter()


class ResolutionRequest(BaseModel):
    case_id: str
    conflict_field: str
    selected_value: str
    authority_basis: str
    evidence_reference: str


@router.post("/resolutions", tags=["Authoritative Decisions"])
def submit_resolution(payload: ResolutionRequest):
    """Authoritative DLAO resolution gate.

    Explicitly returns HTTP 501 in Phase 1 per project specification.
    Human resolution requires an authenticated legal officer role and audit hash chain.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "Resolution writes require the authenticated DLAO human-gate endpoint "
            "scheduled for Phase 2. Automatic machine resolution is explicitly prohibited."
        ),
    )
