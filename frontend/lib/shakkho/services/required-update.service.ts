/* ------------------------------------------------------------------ *
 *  RequiredUpdateService — scheduled required updates + reminders.
 *
 *  Required updates are state-machine records (scheduled → upcoming
 *  → due → reminded → overdue → explanation_received | completed |
 *  waived | escalated). Each is computed from a trigger
 *  (assignment_acceptance, upcoming_hearing, completed_hearing,
 *  received_order, case_stage, dlao_request, periodic_reporting).
 *
 *  Exceptions (leave, outage, waived, stayed, alt-channel) are
 *  evaluated by InactivityPatternService.evaluateExceptions before
 *  any pattern alert fires.
 * ------------------------------------------------------------------ */

import type {
  ProgressUpdateType,
  RequiredUpdate,
  RequiredUpdateState,
  RequiredUpdateTrigger,
  StoreEnvelope,
  UpdateReminder,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

function makeId(prefix: string): string {
  return prefix + "-" + Math.random().toString(36).slice(2, 10);
}

const DEFAULT_DUE_DAYS: Record<RequiredUpdateTrigger, number> = {
  assignment_acceptance: 3,
  upcoming_hearing: 5,
  completed_hearing: 7,
  received_order: 5,
  case_stage: 14,
  dlao_request: 3,
  periodic_reporting: 30,
};

export const RequiredUpdateService = {
  list(envelope: StoreEnvelope): RequiredUpdate[] {
    return envelope.requiredUpdates ?? [];
  },

  forCase(envelope: StoreEnvelope, caseId: string): RequiredUpdate[] {
    return (envelope.requiredUpdates ?? []).filter((u) => u.caseId === caseId);
  },

  overdueForLawyer(envelope: StoreEnvelope, lawyerId: string): RequiredUpdate[] {
    const caseIds = new Set(
      (envelope.lawyerAssignments ?? [])
        .filter((a) => a.lawyerId === lawyerId && a.state === "active")
        .map((a) => a.caseId),
    );
    return (envelope.requiredUpdates ?? []).filter(
      (u) => caseIds.has(u.caseId) && (u.state === "overdue" || u.state === "reminded"),
    );
  },

  scheduleFromTrigger(input: {
    caseId: string;
    lawyerId: string;
    trigger: RequiredUpdateTrigger;
    triggerSourceId?: string;
    requiredUpdateType: ProgressUpdateType;
    dueDays?: number;
    actor: string;
    note?: string;
  }): RequiredUpdate {
    const envelope = read();
    const dueDays = input.dueDays ?? DEFAULT_DUE_DAYS[input.trigger];
    const createdAt = DemoTimeService.iso(envelope);
    const dueAt = new Date(DemoTimeService.now(envelope) + dueDays * 24 * 60 * 60 * 1000).toISOString();
    const item: RequiredUpdate = {
      requirementId: makeId("rup"),
      caseId: input.caseId,
      lawyerId: input.lawyerId,
      trigger: input.trigger,
      requiredUpdateType: input.requiredUpdateType,
      createdAt,
      dueAt,
      reminderSchedule: [],
      state: "scheduled",
      notes: input.note,
    };
    write({ ...envelope, requiredUpdates: [...(envelope.requiredUpdates ?? []), item] });
    AuditTrailService.log(
      {
        subject: item.requirementId,
        subjectKind: "required_update",
        action: "required_update.scheduled",
        actor: input.actor,
        payload: { caseId: input.caseId, trigger: input.trigger, dueAt },
      },
      { kind: "officer_lookup", simulatedAt: createdAt },
    );
    return item;
  },

  sendReminder(input: { requirementId: string; actor: string; note?: string }): RequiredUpdate | undefined {
    const envelope = read();
    let updated: RequiredUpdate | undefined;
    const reminder: UpdateReminder = {
      reminderId: makeId("rmd"),
      requirementId: input.requirementId,
      sentAt: DemoTimeService.iso(),
      channel: "sms",
      outcome: "sent",
      recipientLawyerId:
        (envelope.requiredUpdates ?? []).find((u) => u.requirementId === input.requirementId)?.lawyerId ?? "",
      templateVersion: "v1",
      note: input.note,
    };
    const list = (envelope.requiredUpdates ?? []).map((u) => {
      if (u.requirementId !== input.requirementId) return u;
      const state: RequiredUpdateState = u.state === "scheduled" || u.state === "upcoming" || u.state === "due" ? "reminded" : u.state;
      updated = {
        ...u,
        state,
        reminderSchedule: [...u.reminderSchedule, { at: reminder.sentAt, channel: "sms" }],
      };
      return updated;
    });
    write({ ...envelope, requiredUpdates: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.requirementId,
          subjectKind: "required_update",
          action: "required_update.reminder_sent",
          actor: input.actor,
          payload: { reminderId: reminder.reminderId, newState: updated.state },
        },
        { kind: "sms", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },

  markCompleted(input: { requirementId: string; actor: string; updateId: string; note?: string }): RequiredUpdate | undefined {
    return this.transition({ requirementId: input.requirementId, to: "completed", actor: input.actor, payload: { completedByUpdateId: input.updateId, note: input.note } });
  },

  markExplanationReceived(input: { requirementId: string; actor: string; reason: string }): RequiredUpdate | undefined {
    return this.transition({
      requirementId: input.requirementId,
      to: "explanation_received",
      actor: input.actor,
      payload: { reason: input.reason },
    });
  },

  waive(input: { requirementId: string; actor: string; reason: string }): RequiredUpdate | undefined {
    const envelope = read();
    const target = (envelope.requiredUpdates ?? []).find((u) => u.requirementId === input.requirementId);
    if (!target) return undefined;
    return this.transition({
      requirementId: input.requirementId,
      to: "waived",
      actor: input.actor,
      payload: {
        reason: input.reason,
        exception: {
          exceptionId: makeId("exc"),
          reason: "waived_by_officer",
          notedBy: input.actor,
          notedAt: DemoTimeService.iso(),
          note: input.reason,
        },
      },
      extra: { exception: { exceptionId: makeId("exc"), reason: "waived_by_officer", notedBy: input.actor, notedAt: DemoTimeService.iso(), note: input.reason } },
    });
  },

  recalculateDue(actor = "system"): void {
    const envelope = read();
    const now = DemoTimeService.now(envelope);
    let mutated = false;
    const list = (envelope.requiredUpdates ?? []).map((u) => {
      const dueMs = new Date(u.dueAt).getTime();
      if ((u.state === "scheduled" || u.state === "upcoming") && dueMs <= now) {
        mutated = true;
        return { ...u, state: "due" as RequiredUpdateState };
      }
      if ((u.state === "due" || u.state === "reminded") && dueMs + 1 * 24 * 60 * 60 * 1000 <= now) {
        mutated = true;
        return { ...u, state: "overdue" as RequiredUpdateState };
      }
      return u;
    });
    if (mutated) write({ ...envelope, requiredUpdates: list });
  },

  transition(input: {
    requirementId: string;
    to: RequiredUpdateState;
    actor: string;
    payload?: Record<string, unknown>;
    extra?: Partial<RequiredUpdate>;
  }): RequiredUpdate | undefined {
    const envelope = read();
    let updated: RequiredUpdate | undefined;
    const list = (envelope.requiredUpdates ?? []).map((u) => {
      if (u.requirementId !== input.requirementId) return u;
      updated = { ...u, ...input.extra, state: input.to };
      return updated;
    });
    write({ ...envelope, requiredUpdates: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.requirementId,
          subjectKind: "required_update",
          action: `required_update.${input.to}`,
          actor: input.actor,
          payload: { from: updated.state, to: input.to, ...input.payload },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },
};