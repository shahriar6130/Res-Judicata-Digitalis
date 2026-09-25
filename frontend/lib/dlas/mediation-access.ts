import type { ApplicationRecord, DlaoOfficerAccount, MediationWorkspace } from "./schema";
import { officerAuthorityRole, officerCanAccessApplication } from "./dlao";

export type MediationAccessRole = "CITIZEN" | "LEGAL_AID_OFFICER" | "CHIEF_LEGAL_AID_OFFICER" | "MEDIATOR" | "PANEL_LAWYER" | "DBLA_ADMIN";
export type MediationScope =
  | "PUBLIC_CASE_RECORD" | "VERIFIED_PARTY_INFORMATION" | "RELEVANT_DOCUMENTS" | "MEDIATION_STATUS"
  | "ATTENDANCE" | "COMMUNICATION_PREFERENCES" | "SAFETY_ACCESSIBILITY" | "SETTLEMENT_WORKSPACE"
  | "OUTCOME_RECORDING" | "VERIFICATION" | "PATHWAY" | "ASSIGNMENT" | "REQUIRED_RECORDS"
  | "AUDIT_HISTORY" | "AGREEMENT_CERTIFICATION" | "DISTRICT_MONITORING" | "INTERNAL_OFFICER_NOTES"
  | "MEDIATOR_CONFIDENTIAL_NOTES";

export const MEDIATION_ROLE_SCOPES: Record<MediationAccessRole, readonly MediationScope[]> = {
  CITIZEN: ["PUBLIC_CASE_RECORD", "MEDIATION_STATUS"],
  LEGAL_AID_OFFICER: ["PUBLIC_CASE_RECORD", "VERIFIED_PARTY_INFORMATION", "RELEVANT_DOCUMENTS", "MEDIATION_STATUS", "ATTENDANCE", "VERIFICATION", "PATHWAY", "ASSIGNMENT", "REQUIRED_RECORDS", "AUDIT_HISTORY", "INTERNAL_OFFICER_NOTES", "AGREEMENT_CERTIFICATION"],
  CHIEF_LEGAL_AID_OFFICER: ["PUBLIC_CASE_RECORD", "VERIFIED_PARTY_INFORMATION", "RELEVANT_DOCUMENTS", "MEDIATION_STATUS", "ATTENDANCE", "VERIFICATION", "PATHWAY", "ASSIGNMENT", "REQUIRED_RECORDS", "AUDIT_HISTORY", "INTERNAL_OFFICER_NOTES", "AGREEMENT_CERTIFICATION", "DISTRICT_MONITORING"],
  MEDIATOR: ["PUBLIC_CASE_RECORD", "VERIFIED_PARTY_INFORMATION", "RELEVANT_DOCUMENTS", "MEDIATION_STATUS", "ATTENDANCE", "COMMUNICATION_PREFERENCES", "SAFETY_ACCESSIBILITY", "SETTLEMENT_WORKSPACE", "OUTCOME_RECORDING", "MEDIATOR_CONFIDENTIAL_NOTES"],
  PANEL_LAWYER: ["PUBLIC_CASE_RECORD", "VERIFIED_PARTY_INFORMATION", "RELEVANT_DOCUMENTS", "MEDIATION_STATUS"],
  DBLA_ADMIN: ["PUBLIC_CASE_RECORD", "MEDIATION_STATUS", "REQUIRED_RECORDS", "AUDIT_HISTORY", "DISTRICT_MONITORING"],
};

export function officerMediationRole(o: DlaoOfficerAccount): "LEGAL_AID_OFFICER" | "CHIEF_LEGAL_AID_OFFICER" {
  return officerAuthorityRole(o);
}

export function officerCanAccessMediationCase(a: ApplicationRecord, o: DlaoOfficerAccount | undefined): boolean {
  return officerCanAccessApplication(a, o);
}

export function mediatorCanAccessCase(a: ApplicationRecord, mediatorId: string | undefined): boolean {
  return !!mediatorId && !!a.mediation?.assignments.some((x) => x.mediatorId === mediatorId && x.status === "ASSIGNED" && !x.accessRevokedAt);
}

export function lawyerCanAccessMediationCase(a: ApplicationRecord, lawyerId: string | undefined): boolean {
  return !!lawyerId && !!a.lawyer?.access.some((x) => x.lawyerId === lawyerId && !x.revokedAt);
}

export function confidentialCaucusNotes(ws: MediationWorkspace | null | undefined) {
  return ws?.mediatorConfidential?.caucusNotes ?? ws?.caucus ?? [];
}

/** Officer, citizen, lawyer and admin projections must never include caucus content. */
export function publicMediationWorkspace(ws: MediationWorkspace | null | undefined): Omit<MediationWorkspace, "caucus" | "mediatorConfidential"> | null {
  if (!ws) return null;
  const { caucus: _legacy, mediatorConfidential: _confidential, ...record } = ws;
  void _legacy;
  void _confidential;
  return record;
}

/** True when the role's need-to-know scope list includes the scope. */
export function canAccessMediationScope(role: MediationAccessRole, scope: MediationScope): boolean {
  return MEDIATION_ROLE_SCOPES[role].includes(scope);
}
