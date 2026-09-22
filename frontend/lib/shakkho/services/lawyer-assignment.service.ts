/* ------------------------------------------------------------------ *
 *  LawyerAssignmentService — full state machine for panel-lawyer
 *  case assignments.
 *
 *  States (spec §30):
 *    prepared → offered → awaiting_response →
 *    {accepted | declined | expired} →
 *    {active → handover_required → reassigned | completed | ended}
 *
 *  Each transition appends AssignmentHistoryItem + AuditEvent.
 *  Reassignment freezes the prior assignment rather than mutating it
 *  (the successor assignment gets a new assignmentId, the prior's
 *  `supersededByAssignmentId` is set).
 * ------------------------------------------------------------------ */

import type {
  AssignmentDeclineReason,
  AssignmentHistoryItem,
  AssignmentResponse,
  AssignmentState,
  LawyerAssignment,
  StoreEnvelope,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

function makeId(prefix: string): string {
  return prefix + "-" + Math.random().toString(36).slice(2, 10);
}

export const LawyerAssignmentService = {
  list(envelope: StoreEnvelope): LawyerAssignment[] {
    return envelope.lawyerAssignments ?? [];
  },

  find(envelope: StoreEnvelope, assignmentId: string): LawyerAssignment | undefined {
    return (envelope.lawyerAssignments ?? []).find((a) => a.assignmentId === assignmentId);
  },

  byCase(envelope: StoreEnvelope, caseId: string): LawyerAssignment[] {
    return (envelope.lawyerAssignments ?? []).filter((a) => a.caseId === caseId);
  },

  activeForLawyer(envelope: StoreEnvelope, lawyerId: string): LawyerAssignment[] {
    return (envelope.lawyerAssignments ?? []).filter(
      (a) => a.lawyerId === lawyerId && a.state === "active",
    );
  },

  prepareAssignment(input: {
    caseId: string;
    applicationId: string;
    lawyerId: string;
    actor: string;
    responseDeadline: string;
    reasons: string[];
    applicantPreferenceConsidered: boolean;
    conflictCheckCompleted: boolean;
    workloadReviewed: boolean;
    requiredFirstAction: string;
    notes?: string;
  }): LawyerAssignment {
    const envelope = read();
    const assignmentId = makeId("asn");
    const now = DemoTimeService.iso();
    const assignment: LawyerAssignment = {
      assignmentId,
      applicationId: input.applicationId,
      caseId: input.caseId,
      lawyerId: input.lawyerId,
      state: "prepared",
      preparedBy: input.actor,
      preparedAt: now,
      reasonForAssignment: input.reasons.join("; "),
      applicantPreferenceConsidered: input.applicantPreferenceConsidered,
      conflictCheckCompleted: input.conflictCheckCompleted,
      workloadReviewed: input.workloadReviewed,
      requiredFirstAction: input.requiredFirstAction,
      responseDeadline: input.responseDeadline,
      history: [
        {
          at: now,
          actor: input.actor,
          toState: "prepared",
          reason: "Prepared for offer.",
          note: input.notes,
        },
      ],
      auditEventIds: [],
    };
    write({
      ...envelope,
      lawyerAssignments: [...(envelope.lawyerAssignments ?? []), assignment],
    });
    AuditTrailService.log(
      {
        subject: assignmentId,
        subjectKind: "lawyer_assignment",
        action: "lawyer_assignment.prepared",
        actor: input.actor,
        payload: { caseId: input.caseId, lawyerId: input.lawyerId },
      },
      { kind: "officer_lookup", simulatedAt: now },
    );
    return assignment;
  },

  offerTo(input: { assignmentId: string; actor: string }): LawyerAssignment | undefined {
    return this.transition({ assignmentId: input.assignmentId, to: "offered", actor: input.actor });
  },

  recordResponse(input: {
    assignmentId: string;
    lawyerId: string;
    decision: AssignmentResponse["decision"];
    actor: string;
    declineReason?: AssignmentDeclineReason;
    note?: string;
  }): LawyerAssignment | undefined {
    const envelope = read();
    const response: AssignmentResponse = {
      responseId: makeId("arsp"),
      assignmentId: input.assignmentId,
      lawyerId: input.lawyerId,
      decision: input.decision,
      at: DemoTimeService.iso(),
      declineReason: input.declineReason,
      note: input.note,
    };
    write({
      ...envelope,
      lawyerAssignmentResponses: [...(envelope.lawyerAssignmentResponses ?? []), response],
    });
    AuditTrailService.log(
      {
        subject: input.assignmentId,
        subjectKind: "lawyer_assignment",
        action: "lawyer_assignment.response_recorded",
        actor: input.actor,
        payload: { decision: input.decision, reason: input.declineReason },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return this.find({ ...envelope, lawyerAssignmentResponses: [...(envelope.lawyerAssignmentResponses ?? []), response] }, input.assignmentId);
  },

  accept(input: { assignmentId: string; actor: string }): LawyerAssignment | undefined {
    return this.transition({ assignmentId: input.assignmentId, to: "accepted", actor: input.actor });
  },

  decline(input: { assignmentId: string; actor: string; reason: AssignmentDeclineReason; note?: string }): LawyerAssignment | undefined {
    return this.transition({
      assignmentId: input.assignmentId,
      to: "declined",
      actor: input.actor,
      payload: { reason: input.reason, note: input.note },
    });
  },

  expireOffer(input: { assignmentId: string; actor: string }): LawyerAssignment | undefined {
    return this.transition({ assignmentId: input.assignmentId, to: "expired", actor: input.actor });
  },

  markActive(input: { assignmentId: string; actor: string }): LawyerAssignment | undefined {
    return this.transition({ assignmentId: input.assignmentId, to: "active", actor: input.actor });
  },

  requestHandover(input: { assignmentId: string; actor: string; reason: string }): LawyerAssignment | undefined {
    return this.transition({
      assignmentId: input.assignmentId,
      to: "handover_required",
      actor: input.actor,
      payload: { reason: input.reason },
    });
  },

  complete(input: { assignmentId: string; actor: string }): LawyerAssignment | undefined {
    return this.transition({ assignmentId: input.assignmentId, to: "completed", actor: input.actor });
  },

  endAssignment(input: { assignmentId: string; actor: string; reason: string }): LawyerAssignment | undefined {
    return this.transition({
      assignmentId: input.assignmentId,
      to: "ended",
      actor: input.actor,
      payload: { reason: input.reason },
    });
  },

  reassign(input: { assignmentId: string; actor: string; successorAssignmentId: string; reason: string }): LawyerAssignment | undefined {
    return this.transition({
      assignmentId: input.assignmentId,
      to: "reassigned",
      actor: input.actor,
      payload: { successorAssignmentId: input.successorAssignmentId, reason: input.reason },
      extra: { supersededByAssignmentId: input.successorAssignmentId, endedAt: DemoTimeService.iso(), endedReason: input.reason },
    });
  },

  transition(input: {
    assignmentId: string;
    to: AssignmentState;
    actor: string;
    payload?: Record<string, unknown>;
    extra?: Partial<LawyerAssignment>;
  }): LawyerAssignment | undefined {
    const envelope = read();
    let updated: LawyerAssignment | undefined;
    const list = (envelope.lawyerAssignments ?? []).map((a) => {
      if (a.assignmentId !== input.assignmentId) return a;
      const history: AssignmentHistoryItem[] = [
        ...a.history,
        {
          at: DemoTimeService.iso(),
          actor: input.actor,
          fromState: a.state,
          toState: input.to,
          reason: input.payload?.reason as string | undefined,
          note: input.payload?.note as string | undefined,
        },
      ];
      updated = {
        ...a,
        ...input.extra,
        state: input.to,
        history,
        auditEventIds: a.auditEventIds,
      };
      return updated;
    });
    write({ ...envelope, lawyerAssignments: list });
    if (updated) {
      const audit = AuditTrailService.log(
        {
          subject: input.assignmentId,
          subjectKind: "lawyer_assignment",
          action: `lawyer_assignment.${input.to}`,
          actor: input.actor,
          payload: { from: updated.history[updated.history.length - 1]?.fromState, to: input.to, ...input.payload },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
      updated.auditEventIds = [...updated.auditEventIds, audit.id];
      write({ ...envelope, lawyerAssignments: list.map((a) => (a.assignmentId === input.assignmentId ? updated! : a)) });
    }
    return updated;
  },

  recalculateExpired(actor = "system"): void {
    const envelope = read();
    const now = DemoTimeService.now(envelope);
    let mutated = false;
    const list = (envelope.lawyerAssignments ?? []).map((a) => {
      if (
        (a.state === "offered" || a.state === "awaiting_response") &&
        a.responseDeadline &&
        new Date(a.responseDeadline).getTime() < now
      ) {
        mutated = true;
        const audit = AuditTrailService.log(
          {
            subject: a.assignmentId,
            subjectKind: "lawyer_assignment",
            action: "lawyer_assignment.expired",
            actor,
            payload: { responseDeadline: a.responseDeadline },
          },
          { kind: "system", simulatedAt: DemoTimeService.iso() },
        );
        return {
          ...a,
          state: "expired" as AssignmentState,
          auditEventIds: [...a.auditEventIds, audit.id],
          history: [
            ...a.history,
            {
              at: DemoTimeService.iso(),
              actor,
              fromState: a.state,
              toState: "expired" as AssignmentState,
              reason: "Response deadline passed",
              note: a.responseDeadline,
            },
          ],
        };
      }
      return a;
    });
    if (mutated) write({ ...envelope, lawyerAssignments: list });
  },
};
