/* ------------------------------------------------------------------ *
 *  LawyerAuditService — typed wrapper around AuditTrailService.log
 *  for the lawyer-specific subject kinds.
 *
 *  Every new lawyer-side service funnels through here so the audit
 *  trail consistently tags the subject kind.
 * ------------------------------------------------------------------ */

import type { AuditEvent, SimulationMetadata } from "../types";
import { AuditTrailService } from "./audit-trail.service";

export const LawyerAuditService = {
  log(
    subjectKind:
      | "panel_lawyer"
      | "lawyer_assignment"
      | "lawyer_availability"
      | "hearing"
      | "case_progress"
      | "required_update"
      | "lawyer_change"
      | "reassignment"
      | "case_handover"
      | "inactivity_pattern"
      | "payment_reconciliation"
      | "fee_schedule"
      | "contact_attempt"
      | "voice_session",
    subject: string,
    action: string,
    actor: string,
    payload: Record<string, unknown>,
    simulation?: SimulationMetadata,
  ): AuditEvent {
    return AuditTrailService.log(
      { subject, subjectKind, action, actor, payload },
      simulation ?? { kind: "officer_lookup", simulatedAt: new Date().toISOString() },
    );
  },
};
