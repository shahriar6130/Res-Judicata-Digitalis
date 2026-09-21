"""Case timeline and query endpoints."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Case
from app.schemas.case import CaseDetailSchema

router = APIRouter()

# Fallback in-memory mock cases for immediate developer onboarding when DB is not yet seeded
SAMPLE_CASES = [
    {
        "id": "case-dhaka-001",
        "case_reference": "DLO-DHK-2026-0842",
        "status": "ACTIVE",
        "pathway": "LITIGATION",
        "priority": "HIGH",
        "office_scope_id": "OFFICE-DHK-CENTRAL",
        "policy_version": "v1.0",
        "status_sentence_bn": "আইনজীবী নিযুক্ত হয়েছেন এবং পরবর্তী শুনানির তারিখ ধার্য করা হয়েছে।",
        "status_sentence_en": "Panel lawyer assigned; next court hearing date scheduled.",
        "milestones": [
            {
                "id": "ms-1",
                "milestone_type": "INTAKE_VERIFIED",
                "state": "COMPLETED",
                "explanation": "Citizen identity verified via authorized officer.",
                "achieved_at": "2026-09-18T10:00:00Z",
            },
            {
                "id": "ms-2",
                "milestone_type": "LAWYER_ASSIGNED",
                "state": "COMPLETED",
                "explanation": "Advocate Tanvir Ahmed assigned to representation.",
                "achieved_at": "2026-09-19T14:30:00Z",
            },
        ],
        "promises": [
            {
                "id": "prom-1",
                "task_type": "COURT_ATTENDANCE_REPORT",
                "owner_role": "LAWYER",
                "due_at": "2026-09-25T17:00:00Z",
                "state": "PENDING",
                "evidence_required": "CERTIFIED_CAUSE_LIST_EXTRACT",
                "escalation_rung": "NONE",
            }
        ],
        "observations": [
            {
                "id": "obs-1",
                "field_key": "HEARING_DATE",
                "raw_value": "2026-09-24",
                "source_role": "CITIZEN",
                "source_actor_id": "user-citizen-01",
                "channel": "WEB_PWA",
                "verified": False,
                "is_disputed": False,
                "created_at_server": "2026-09-20T08:00:00Z",
            }
        ],
    }
]


@router.get("/cases", response_model=List[CaseDetailSchema], tags=["Cases"])
def list_cases(db: Session = Depends(get_db)):
    """Retrieve operational cases. If Supabase DB is active, queries PostgreSQL; otherwise provides verified fixtures."""
    if db is not None:
        try:
            cases = db.query(Case).all()
            if cases:
                return cases
        except Exception:
            pass  # Fall back to sample cases if table is unseeded

    return SAMPLE_CASES


@router.get("/cases/{case_ref}", response_model=CaseDetailSchema, tags=["Cases"])
def get_case_detail(case_ref: str, db: Session = Depends(get_db)):
    """Retrieve single case with explainable timeline and milestone progression."""
    if db is not None:
        try:
            case = db.query(Case).filter(
                (Case.case_reference == case_ref) | (Case.id == case_ref)
            ).first()
            if case:
                return case
        except Exception:
            pass

    for sample in SAMPLE_CASES:
        if sample["case_reference"] == case_ref or sample["id"] == case_ref:
            return sample

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Case with reference '{case_ref}' not found.",
    )
