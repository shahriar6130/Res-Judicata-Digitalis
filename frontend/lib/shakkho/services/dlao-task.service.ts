/* ------------------------------------------------------------------ *
 *  DlaoTaskService — DLAO working queue items.
 *
 *  Mirrors the existing `DlaoTaskItem` interface.  Used by the lawyer
 *  workflow to drop travel-prevention follow-ups and overdue alerts
 *  onto the DLAO inbox.
 * ------------------------------------------------------------------ */

import type { DlaoTaskItem, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

function makeId(): string {
  return "dtk-" + Math.random().toString(36).slice(2, 10);
}

export const DlaoTaskService = {
  list(envelope: StoreEnvelope): DlaoTaskItem[] {
    return envelope.dlaoTaskItems ?? [];
  },

  open(envelope: StoreEnvelope): DlaoTaskItem[] {
    return (envelope.dlaoTaskItems ?? []).filter((t) => t.state === "queued" || t.state === "in_progress");
  },

  find(envelope: StoreEnvelope, taskId: string): DlaoTaskItem | undefined {
    return (envelope.dlaoTaskItems ?? []).find((t) => t.taskId === taskId);
  },

  createTask(input: {
    subject: string;
    subjectKind: string;
    reason: string;
    priority: DlaoTaskItem["priority"];
    summary: string;
    details?: Record<string, unknown>;
    dueAt?: string;
    caseId?: string;
    applicationId?: string;
    type?: DlaoTaskItem["type"];
    actor: string;
  }): DlaoTaskItem {
    const envelope = read();
    const task: DlaoTaskItem = {
      taskId: makeId(),
      caseId: input.caseId,
      applicationId: input.applicationId,
      type: input.type ?? "other",
      title: input.summary,
      detail: JSON.stringify(input.details ?? {}),
      state: "queued",
      priority: input.priority,
      createdAt: DemoTimeService.iso(),
      dueAt: input.dueAt,
      relatedSubjectId: input.subject,
      auditEventIds: [],
    };
    const audit = AuditTrailService.log(
      {
        subject: task.taskId,
        subjectKind: "panel_lawyer",
        action: "dlao_task.created",
        actor: input.actor,
        payload: { reason: input.reason, subjectKind: input.subjectKind, summary: input.summary },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    task.auditEventIds.push(audit.id);
    write({
      ...envelope,
      dlaoTaskItems: [...(envelope.dlaoTaskItems ?? []), task],
    });
    return task;
  },

  transition(input: { taskId: string; to: DlaoTaskItem["state"]; actor: string; note?: string }): DlaoTaskItem | undefined {
    const envelope = read();
    let updated: DlaoTaskItem | undefined;
    const list = (envelope.dlaoTaskItems ?? []).map((t) => {
      if (t.taskId !== input.taskId) return t;
      updated = { ...t, state: input.to };
      return updated;
    });
    write({ ...envelope, dlaoTaskItems: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.taskId,
          subjectKind: "panel_lawyer",
          action: `dlao_task.${input.to}`,
          actor: input.actor,
          payload: { note: input.note },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },
};
