/* ------------------------------------------------------------------ *
 *  ReassignmentService — human-decision record for reassignment.
 *
 *  A reassignment creates a continuity owner, freezes the prior
 *  assignment (via LawyerAssignmentService.reassign which sets
 *  supersededByAssignmentId), and preserves history. It is
 *  intentionally separate from the lawyer-change workflow and from
 *  pattern review.
 * ------------------------------------------------------------------ */

import type { LawyerChangeReview, Reassignment, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

function makeId(): string {
  return "rea-" + Math.random().toString(36).slice(2, 10);
}

export const ReassignmentService = {
  list(envelope: StoreEnvelope): Reassignment[] {
    return envelope.reassignments ?? [];
  },

  find(envelope: StoreEnvelope, reassignmentId: string): Reassignment | undefined {
    return (envelope.reassignments ?? []).find((r) => r.reassignmentId === reassignmentId);
  },

  byCase(envelope: StoreEnvelope, caseId: string): Reassignment[] {
    return (envelope.reassignments ?? []).filter((r) => r.caseId === caseId);
  },

  recordReassignmentDecision(input: {
    caseId: string;
    requestId: string;
    fromLawyerId: string;
    toLawyerId?: string;
    decision: LawyerChangeReview;
    continuityOwnerLawyerId?: string;
    freezePriorAssignment: boolean;
    handoverPackageId?: string;
    newLawyerAcceptanceDeadline?: string;
    actor: string;
  }): Reassignment {
    const envelope = read();
    const now = DemoTimeService.iso();
    const item: Reassignment = {
      reassignmentId: makeId(),
      requestId: input.requestId,
      caseId: input.caseId,
      fromLawyerId: input.fromLawyerId,
      toLawyerId: input.toLawyerId,
      recordedAt: now,
      recordedBy: input.actor,
      decision: input.decision,
      continuityOwnerLawyerId: input.continuityOwnerLawyerId,
      freezePriorAssignment: input.freezePriorAssignment,
      handoverPackageId: input.handoverPackageId,
      newLawyerAcceptanceDeadline: input.newLawyerAcceptanceDeadline,
      history: [
        {
          at: now,
          actor: input.actor,
          note: `Reassignment recorded: ${input.decision.decision} (${input.decision.reason})`,
        },
      ],
      auditEventIds: [],
    };
    const audit = AuditTrailService.log(
      {
        subject: input.caseId,
        subjectKind: "reassignment",
        action: `reassignment.${input.decision.decision}`,
        actor: input.actor,
        payload: {
          fromLawyerId: input.fromLawyerId,
          toLawyerId: input.toLawyerId,
          reason: input.decision.reason,
        },
      },
      { kind: "officer_lookup", simulatedAt: now },
    );
    item.auditEventIds.push(audit.id);
    write({
      ...envelope,
      reassignments: [...(envelope.reassignments ?? []), item],
    });
    return item;
  },
};
