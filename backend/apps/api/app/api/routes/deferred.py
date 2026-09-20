from uuid import UUID

from fastapi import APIRouter, HTTPException, status

router = APIRouter(tags=["phase-2"])


@router.post("/milestones/{milestone_id}/resolutions", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def create_resolution(milestone_id: UUID) -> None:
    raise HTTPException(
        status_code=501,
        detail=(
            "Phase 2: validate officer authority and cited observations, persist the resolution, "
            "and atomically recompute the milestone projection."
        ),
    )


@router.post("/claim-packets/{packet_id}/submit", status_code=status.HTTP_501_NOT_IMPLEMENTED)
def submit_claim_packet(packet_id: UUID) -> None:
    raise HTTPException(
        status_code=501,
        detail=(
            "Phase 2: validate policy requirements, transition the packet, and record an auditable "
            "submission event."
        ),
    )
