"""Least-privilege tests for the DLAO authorisation foundation."""

from app.security.authorization import Action, ActorScope, ResourceScope, Role, authorize

TENANT = "tenant-demo"
OFFICE = "office-dhaka"
CASE = "case-001"


def actor(role: Role, actor_id: str = "actor-1") -> ActorScope:
    return ActorScope(
        actor_id=actor_id,
        tenant_id=TENANT,
        role=role,
        office_ids=frozenset({OFFICE}),
        assigned_case_ids=frozenset({CASE}),
    )


def resource(**overrides) -> ResourceScope:
    values = {
        "tenant_id": TENANT,
        "office_id": OFFICE,
        "case_id": CASE,
        "citizen_actor_id": "citizen-1",
        "assigned_lawyer_actor_id": "lawyer-1",
    }
    values.update(overrides)
    return ResourceScope(**values)


def test_dlao_can_make_office_scoped_human_decision():
    result = authorize(actor(Role.DLAO_OFFICER), Action.ELIGIBILITY_DECIDE, resource())
    assert result.allowed
    assert result.reason_code == "OFFICE_SCOPED_ACCESS"


def test_legal_aid_staff_can_prepare_but_not_make_eligibility_decision():
    staff = actor(Role.LEGAL_AID_STAFF)
    assert authorize(staff, Action.APPLICATION_ASSESS, resource()).allowed
    denied = authorize(staff, Action.ELIGIBILITY_DECIDE, resource())
    assert not denied.allowed
    assert denied.reason_code == "ROLE_ACTION_NOT_ALLOWED"


def test_office_scope_is_enforced_for_dlao_and_staff():
    denied = authorize(
        actor(Role.DLAO_OFFICER),
        Action.CASE_READ,
        resource(office_id="office-khulna"),
    )
    assert not denied.allowed
    assert denied.reason_code == "OFFICE_SCOPE_MISMATCH"


def test_panel_lawyer_access_requires_case_assignment_and_relationship():
    lawyer = actor(Role.PANEL_LAWYER, actor_id="lawyer-1")
    assert authorize(lawyer, Action.CASE_PROGRESS_SUBMIT, resource()).allowed

    unassigned = authorize(lawyer, Action.CASE_READ, resource(case_id="case-999"))
    assert not unassigned.allowed
    assert unassigned.reason_code == "CASE_ASSIGNMENT_REQUIRED"

    wrong_lawyer = authorize(
        lawyer,
        Action.CASE_READ,
        resource(assigned_lawyer_actor_id="lawyer-2"),
    )
    assert not wrong_lawyer.allowed
    assert wrong_lawyer.reason_code == "LAWYER_RELATIONSHIP_MISMATCH"


def test_citizen_can_read_only_own_record():
    citizen = actor(Role.CITIZEN, actor_id="citizen-1")
    assert authorize(citizen, Action.CASE_READ, resource()).allowed

    denied = authorize(citizen, Action.CASE_READ, resource(citizen_actor_id="citizen-2"))
    assert not denied.allowed
    assert denied.reason_code == "CITIZEN_RELATIONSHIP_REQUIRED"


def test_tenant_mismatch_is_denied_before_role_rules():
    denied = authorize(
        actor(Role.DLAO_OFFICER),
        Action.CASE_READ,
        resource(tenant_id="another-tenant"),
    )
    assert not denied.allowed
    assert denied.reason_code == "TENANT_SCOPE_MISMATCH"
