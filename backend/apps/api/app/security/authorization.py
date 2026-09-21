"""Pure role/scope authorisation policy for future authenticated API dependencies.

This module deliberately does not authenticate a caller. A later session adapter must
construct ``ActorScope`` from verified server-side identity/session claims; request-body
roles, tenant IDs, office IDs and case assignments must never be trusted.
"""

from dataclasses import dataclass, field
from enum import Enum


class Role(str, Enum):
    DLAO_OFFICER = "DLAO_OFFICER"
    LEGAL_AID_STAFF = "LEGAL_AID_STAFF"
    PANEL_LAWYER = "PANEL_LAWYER"
    CITIZEN = "CITIZEN"


class Action(str, Enum):
    APPLICATION_LIST = "APPLICATION_LIST"
    APPLICATION_READ = "APPLICATION_READ"
    APPLICATION_VERIFY = "APPLICATION_VERIFY"
    APPLICATION_ASSESS = "APPLICATION_ASSESS"
    ELIGIBILITY_DECIDE = "ELIGIBILITY_DECIDE"
    PRIORITY_DECIDE = "PRIORITY_DECIDE"
    LAWYER_ASSIGN = "LAWYER_ASSIGN"
    CASE_LIST = "CASE_LIST"
    CASE_READ = "CASE_READ"
    CASE_PROGRESS_SUBMIT = "CASE_PROGRESS_SUBMIT"
    REPORT_READ = "REPORT_READ"
    AUDIT_READ = "AUDIT_READ"


@dataclass(frozen=True)
class ActorScope:
    actor_id: str
    tenant_id: str
    role: Role
    office_ids: frozenset[str] = field(default_factory=frozenset)
    assigned_case_ids: frozenset[str] = field(default_factory=frozenset)


@dataclass(frozen=True)
class ResourceScope:
    tenant_id: str
    office_id: str | None = None
    case_id: str | None = None
    citizen_actor_id: str | None = None
    assigned_lawyer_actor_id: str | None = None


@dataclass(frozen=True)
class AuthorizationDecision:
    allowed: bool
    reason_code: str


ROLE_ACTIONS: dict[Role, frozenset[Action]] = {
    Role.DLAO_OFFICER: frozenset(Action),
    Role.LEGAL_AID_STAFF: frozenset(
        {
            Action.APPLICATION_LIST,
            Action.APPLICATION_READ,
            Action.APPLICATION_VERIFY,
            Action.APPLICATION_ASSESS,
            Action.CASE_LIST,
            Action.CASE_READ,
            Action.REPORT_READ,
        }
    ),
    Role.PANEL_LAWYER: frozenset({Action.CASE_READ, Action.CASE_PROGRESS_SUBMIT}),
    Role.CITIZEN: frozenset({Action.APPLICATION_READ, Action.CASE_READ}),
}

HUMAN_DECISION_ACTIONS = frozenset(
    {
        Action.ELIGIBILITY_DECIDE,
        Action.PRIORITY_DECIDE,
        Action.LAWYER_ASSIGN,
    }
)


def _deny(reason_code: str) -> AuthorizationDecision:
    return AuthorizationDecision(allowed=False, reason_code=reason_code)


def authorize(
    actor: ActorScope,
    action: Action,
    resource: ResourceScope,
) -> AuthorizationDecision:
    """Return an explainable least-privilege decision; deny on missing scope."""
    if actor.tenant_id != resource.tenant_id:
        return _deny("TENANT_SCOPE_MISMATCH")

    if action not in ROLE_ACTIONS.get(actor.role, frozenset()):
        return _deny("ROLE_ACTION_NOT_ALLOWED")

    if action in HUMAN_DECISION_ACTIONS and actor.role is not Role.DLAO_OFFICER:
        return _deny("AUTHORISED_OFFICER_REQUIRED")

    if actor.role in {Role.DLAO_OFFICER, Role.LEGAL_AID_STAFF}:
        if resource.office_id is None:
            return _deny("OFFICE_SCOPE_REQUIRED")
        if resource.office_id not in actor.office_ids:
            return _deny("OFFICE_SCOPE_MISMATCH")
        return AuthorizationDecision(allowed=True, reason_code="OFFICE_SCOPED_ACCESS")

    if actor.role is Role.PANEL_LAWYER:
        if resource.case_id is None:
            return _deny("CASE_SCOPE_REQUIRED")
        if resource.case_id not in actor.assigned_case_ids:
            return _deny("CASE_ASSIGNMENT_REQUIRED")
        if resource.assigned_lawyer_actor_id != actor.actor_id:
            return _deny("LAWYER_RELATIONSHIP_MISMATCH")
        return AuthorizationDecision(allowed=True, reason_code="ASSIGNED_LAWYER_ACCESS")

    if actor.role is Role.CITIZEN:
        if resource.citizen_actor_id != actor.actor_id:
            return _deny("CITIZEN_RELATIONSHIP_REQUIRED")
        return AuthorizationDecision(allowed=True, reason_code="OWN_RECORD_ACCESS")

    return _deny("NO_APPLICABLE_POLICY")
