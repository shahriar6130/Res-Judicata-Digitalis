/* ------------------------------------------------------------------ *
 *  HumanHandoffService — creates `HumanHandoff` records and, when the
 *  target is `dlao`, publishes a task to the DLAO inbox bridge so the
 *  DLO dashboard picks it up without rewriting `OfficerDashboard`'s
 *  state arrays.
 * ------------------------------------------------------------------ */

import type {
  ApplicationRecord,
  DlaoInboxTask,
  HumanHandoff,
  StoreEnvelope,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { publishDlaoTask } from "../bridges/dlao-inbox.bridge";

function makeId(): string {
  return "hof-" + Math.random().toString(36).slice(2, 10);
}

export const HumanHandoffService = {
  list(envelope: StoreEnvelope): HumanHandoff[] {
    return [...envelope.handoffs];
  },

  listFor(envelope: StoreEnvelope, applicationId: string): HumanHandoff[] {
    return envelope.handoffs.filter((h) => h.applicationId === applicationId);
  },

  create(input: {
    applicationId?: string;
    intakeSessionId?: string;
    reason: HumanHandoff["reason"];
    targetRole: HumanHandoff["targetRole"];
    actor: string;
    assignedTo?: string;
  }): HumanHandoff {
    const record: HumanHandoff = {
      id: makeId(),
      applicationId: input.applicationId,
      intakeSessionId: input.intakeSessionId,
      reason: input.reason,
      status: "queued",
      targetRole: input.targetRole,
      assignedTo: input.assignedTo,
      createdAt: new Date().toISOString(),
    };
    const envelope = read();
    write({ ...envelope, handoffs: [...envelope.handoffs, record] });
    AuditTrailService.log(
      {
        subject: input.applicationId ?? input.intakeSessionId ?? record.id,
        subjectKind: "handoff",
        action: `handoff.${input.reason}`,
        actor: input.actor,
        payload: { targetRole: input.targetRole },
      },
      { kind: "voice", simulatedAt: record.createdAt },
    );
    if (input.targetRole === "dlao" && input.applicationId) {
      const task: DlaoInboxTask = {
        id: "dlao-" + record.id,
        applicationId: input.applicationId,
        applicantName: "—",
        reason: input.reason,
        status: "queued",
        createdAt: record.createdAt,
      };
      publishDlaoTask(task);
    }
    return record;
  },

  complete(handoffId: string, actor: string): HumanHandoff | undefined {
    const envelope = read();
    let updated: HumanHandoff | undefined;
    const handoffs = envelope.handoffs.map((h) => {
      if (h.id !== handoffId) return h;
      updated = { ...h, status: "completed", completedAt: new Date().toISOString() };
      return updated;
    });
    write({ ...envelope, handoffs });
    if (updated) {
      AuditTrailService.log(
        {
          subject: updated.applicationId ?? updated.id,
          subjectKind: "handoff",
          action: "handoff.completed",
          actor,
        },
        { kind: "voice", simulatedAt: new Date().toISOString() },
      );
    }
    return updated;
  },
};

/* Re-export so intake-session.service.ts can build a HumanHandoffInput
   shape without an import cycle through human-handoff → intake-session. */
export type HumanHandoffInput = {
  applicationId?: string;
  intakeSessionId?: string;
  reason: HumanHandoff["reason"];
  targetRole: HumanHandoff["targetRole"];
  actor: string;
};

/* Helper that the helpline workspace uses to pair the application
   record with a default handoff reason when the agent clicks
   "Handoff to DLAO". */
export function handoffRecordToDlao(
  record: ApplicationRecord,
  reason: HumanHandoff["reason"],
  actor: string,
): HumanHandoff {
  return HumanHandoffService.create({
    applicationId: record.applicationId,
    reason,
    targetRole: "dlao",
    actor,
  });
}
