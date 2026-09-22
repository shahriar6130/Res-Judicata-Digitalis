/* ------------------------------------------------------------------ *
 *  LawyerChangeRequestService — citizen-initiated lawyer-change
 *  workflow (separate from payment reconciliation and from pattern
 *  review per spec §27).
 *
 *  States (spec §30):
 *    submitted → triage → under_review → lawyer_response_requested
 *    → continuity_decision →
 *      {approved_for_reassignment | retained_with_action |
 *       clarification_required | escalated} →
 *    handover → new_lawyer_acceptance → completed
 *
 *  Reassignment ≠ misconduct: this service never auto-creates a
 *  pattern alert. It only records the citizen's request and the
 *  authorised officer's decision.
 * ------------------------------------------------------------------ */

import type {
  LawyerChangeHistoryItem,
  LawyerChangeReasonCategory,
  LawyerChangeRequest,
  LawyerChangeRequestState,
  StoreEnvelope,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

function makeId(prefix: string): string {
  return prefix + "-" + Math.random().toString(36).slice(2, 10);
}

export const LawyerChangeRequestService = {
  list(envelope: StoreEnvelope): LawyerChangeRequest[] {
    return envelope.lawyerChangeRequests ?? [];
  },

  find(envelope: StoreEnvelope, requestId: string): LawyerChangeRequest | undefined {
    return (envelope.lawyerChangeRequests ?? []).find((r) => r.requestId === requestId);
  },

  byCase(envelope: StoreEnvelope, caseId: string): LawyerChangeRequest[] {
    return (envelope.lawyerChangeRequests ?? []).filter((r) => r.caseId === caseId);
  },

  submit(input: {
    caseId: string;
    applicationId: string;
    currentLawyerId: string;
    submittedThrough: LawyerChangeRequest["submittedThrough"];
    reasonCategory: LawyerChangeReasonCategory;
    reasonNote: string;
    applicantName: string;
    actor: string;
    assistedBy?: string;
  }): LawyerChangeRequest {
    const envelope = read();
    const now = DemoTimeService.iso();
    const request: LawyerChangeRequest = {
      requestId: makeId("lcr"),
      caseId: input.caseId,
      applicationId: input.applicationId,
      applicantName: input.applicantName,
      submittedAt: now,
      submittedThrough: input.submittedThrough,
      submittedBy: input.assistedBy ?? input.actor,
      reasonCategory: input.reasonCategory,
      reasonNote: input.reasonNote,
      safeContactInstruction: input.assistedBy,
      urgency: "medium",
      state: "submitted",
      history: [
        {
          at: now,
          actor: input.actor,
          toState: "submitted",
          reason: input.reasonCategory,
          note: input.reasonNote,
        },
      ],
      auditEventIds: [],
    };
    write({
      ...envelope,
      lawyerChangeRequests: [...(envelope.lawyerChangeRequests ?? []), request],
    });
    AuditTrailService.log(
      {
        subject: request.requestId,
        subjectKind: "lawyer_change",
        action: "lawyer_change.submitted",
        actor: input.actor,
        payload: { caseId: input.caseId, reasonCategory: input.reasonCategory, currentLawyerId: input.currentLawyerId },
      },
      { kind: "officer_lookup", simulatedAt: now },
    );
    return request;
  },

  transition(input: {
    requestId: string;
    to: LawyerChangeRequestState;
    actor: string;
    payload?: Record<string, unknown>;
  }): LawyerChangeRequest | undefined {
    const envelope = read();
    let updated: LawyerChangeRequest | undefined;
    const list = (envelope.lawyerChangeRequests ?? []).map((r) => {
      if (r.requestId !== input.requestId) return r;
      const history: LawyerChangeHistoryItem[] = [
        ...r.history,
        {
          at: DemoTimeService.iso(),
          actor: input.actor,
          fromState: r.state,
          toState: input.to,
          reason: input.payload?.reason as string | undefined,
          note: input.payload?.note as string | undefined,
        },
      ];
      updated = { ...r, state: input.to, history };
      return updated;
    });
    write({ ...envelope, lawyerChangeRequests: list });
    if (updated) {
      const audit = AuditTrailService.log(
        {
          subject: input.requestId,
          subjectKind: "lawyer_change",
          action: `lawyer_change.${input.to}`,
          actor: input.actor,
          payload: { from: updated.history[updated.history.length - 1]?.fromState, to: input.to, ...input.payload },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
      updated.auditEventIds = [...updated.auditEventIds, audit.id];
      write({ ...envelope, lawyerChangeRequests: list.map((r) => (r.requestId === input.requestId ? updated! : r)) });
    }
    return updated;
  },

  triage(input: { requestId: string; actor: string; triageNotes: string }): LawyerChangeRequest | undefined {
    return this.transition({ requestId: input.requestId, to: "triage", actor: input.actor, payload: { note: input.triageNotes } });
  },

  startReview(input: { requestId: string; actor: string }): LawyerChangeRequest | undefined {
    return this.transition({ requestId: input.requestId, to: "under_review", actor: input.actor });
  },

  requestLawyerResponse(input: { requestId: string; actor: string; question: string }): LawyerChangeRequest | undefined {
    return this.transition({ requestId: input.requestId, to: "lawyer_response_requested", actor: input.actor, payload: { note: input.question } });
  },

  approveReassignment(input: { requestId: string; actor: string; reason: string }): LawyerChangeRequest | undefined {
    return this.transition({ requestId: input.requestId, to: "approved_for_reassignment", actor: input.actor, payload: { reason: input.reason } });
  },

  retainWithAction(input: { requestId: string; actor: string; reason: string; action: string }): LawyerChangeRequest | undefined {
    return this.transition({ requestId: input.requestId, to: "retained_with_action", actor: input.actor, payload: { reason: input.reason, note: input.action } });
  },

  requestClarification(input: { requestId: string; actor: string; question: string }): LawyerChangeRequest | undefined {
    return this.transition({ requestId: input.requestId, to: "clarification_required", actor: input.actor, payload: { note: input.question } });
  },

  escalate(input: { requestId: string; actor: string; reason: string }): LawyerChangeRequest | undefined {
    return this.transition({ requestId: input.requestId, to: "escalated", actor: input.actor, payload: { reason: input.reason } });
  },
};
