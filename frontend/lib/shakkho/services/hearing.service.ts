/* ------------------------------------------------------------------ *
 *  HearingService — hearings reported by lawyers / courts.
 *
 *  Verification states (per CaseHearing.verificationStatus):
 *    reported → awaiting_verification → verified →
 *    {rescheduled | cancelled | completed | result_overdue}
 *
 *  Version history is preserved — every change appends a
 *  HearingVersionEntry rather than mutating prior values.
 * ------------------------------------------------------------------ */

import type {
  CaseHearing,
  HearingResult,
  HearingVersionEntry,
  StoreEnvelope,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

function makeId(): string {
  return "hrv-" + Math.random().toString(36).slice(2, 10);
}

export const HearingService = {
  list(envelope: StoreEnvelope): CaseHearing[] {
    return envelope.caseHearings ?? [];
  },

  forCase(envelope: StoreEnvelope, caseId: string): CaseHearing[] {
    return (envelope.caseHearings ?? []).filter((h) => h.caseId === caseId);
  },

  find(envelope: StoreEnvelope, hearingId: string): CaseHearing | undefined {
    return (envelope.caseHearings ?? []).find((h) => h.hearingId === hearingId);
  },

  createHearing(input: {
    caseId: string;
    hearingDate: string;
    hearingTime?: string;
    court: string;
    source: CaseHearing["source"];
    sourceNote?: string;
    attendanceRequirement: CaseHearing["attendanceRequirement"];
    actor: string;
  }): CaseHearing {
    const envelope = read();
    const now = DemoTimeService.iso();
    const hearing: CaseHearing = {
      hearingId: makeId(),
      caseId: input.caseId,
      court: input.court,
      hearingDate: input.hearingDate,
      hearingTime: input.hearingTime,
      source: input.source,
      sourceNote: input.sourceNote,
      verificationStatus: "reported",
      attendanceRequirement: input.attendanceRequirement,
      reminderSchedule: [],
      versionHistory: [
        {
          version: 1,
          changedAt: now,
          changedBy: input.actor,
          newDate: input.hearingDate,
          reason: "Hearing created",
        },
      ],
      createdAt: now,
    };
    write({ ...envelope, caseHearings: [...(envelope.caseHearings ?? []), hearing] });
    AuditTrailService.log(
      {
        subject: hearing.hearingId,
        subjectKind: "hearing",
        action: "hearing.created",
        actor: input.actor,
        payload: { caseId: input.caseId, hearingDate: input.hearingDate },
      },
      { kind: "officer_lookup", simulatedAt: now },
    );
    return hearing;
  },

  verifyHearing(input: { hearingId: string; actor: string }): CaseHearing | undefined {
    return this.transition({
      hearingId: input.hearingId,
      to: "verified",
      actor: input.actor,
      payload: { verifiedAt: DemoTimeService.iso() },
    });
  },

  recordResult(input: { hearingId: string; actor: string; result: HearingResult }): CaseHearing | undefined {
    return this.transition({
      hearingId: input.hearingId,
      to: "completed",
      actor: input.actor,
      payload: { result: input.result },
    });
  },

  reschedule(input: { hearingId: string; actor: string; newHearingDate: string; reason: string }): CaseHearing | undefined {
    return this.transition({
      hearingId: input.hearingId,
      to: "rescheduled",
      actor: input.actor,
      payload: { newHearingDate: input.newHearingDate, reason: input.reason },
    });
  },

  cancel(input: { hearingId: string; actor: string; reason: string }): CaseHearing | undefined {
    return this.transition({
      hearingId: input.hearingId,
      to: "cancelled",
      actor: input.actor,
      payload: { reason: input.reason },
    });
  },

  markResultOverdue(input: { hearingId: string; actor: string }): CaseHearing | undefined {
    return this.transition({
      hearingId: input.hearingId,
      to: "result_overdue",
      actor: input.actor,
      payload: {},
    });
  },

  upcoming(envelope: StoreEnvelope, caseId?: string): CaseHearing[] {
    const now = DemoTimeService.now(envelope);
    return (envelope.caseHearings ?? []).filter((h) => {
      if (caseId && h.caseId !== caseId) return false;
      return new Date(h.hearingDate).getTime() >= now && h.verificationStatus !== "completed" && h.verificationStatus !== "cancelled";
    });
  },

  recalculateOverdue(actor = "system", windowDays = 7): void {
    const envelope = read();
    const now = DemoTimeService.now(envelope);
    let mutated = false;
    const list = (envelope.caseHearings ?? []).map((h) => {
      if (
        (h.verificationStatus === "reported" || h.verificationStatus === "verified" || h.verificationStatus === "awaiting_verification") &&
        new Date(h.hearingDate).getTime() + windowDays * 24 * 60 * 60 * 1000 < now
      ) {
        mutated = true;
        const audit = AuditTrailService.log(
          {
            subject: h.hearingId,
            subjectKind: "hearing",
            action: "hearing.result_overdue",
            actor,
            payload: { hearingDate: h.hearingDate },
          },
          { kind: "system", simulatedAt: DemoTimeService.iso() },
        );
        return {
          ...h,
          verificationStatus: "result_overdue" as CaseHearing["verificationStatus"],
          versionHistory: [
            ...h.versionHistory,
            {
              version: h.versionHistory.length + 1,
              changedAt: DemoTimeService.iso(),
              changedBy: actor,
              reason: "Result overdue (system recompute)",
            },
          ],
        };
      }
      return h;
    });
    if (mutated) write({ ...envelope, caseHearings: list });
  },

  transition(input: {
    hearingId: string;
    to: CaseHearing["verificationStatus"];
    actor: string;
    payload?: Record<string, unknown>;
  }): CaseHearing | undefined {
    const envelope = read();
    let updated: CaseHearing | undefined;
    const list = (envelope.caseHearings ?? []).map((h) => {
      if (h.hearingId !== input.hearingId) return h;
      const entry: HearingVersionEntry = {
        version: h.versionHistory.length + 1,
        changedAt: DemoTimeService.iso(),
        changedBy: input.actor,
        previousDate: h.hearingDate,
        newDate: (input.payload?.newHearingDate as string | undefined) ?? h.hearingDate,
        reason: (input.payload?.reason as string | undefined) ?? `Transition to ${input.to}`,
      };
      updated = {
        ...h,
        verificationStatus: input.to,
        versionHistory: [...h.versionHistory, entry],
        lastUpdatedBy: input.actor,
      };
      return updated;
    });
    write({ ...envelope, caseHearings: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.hearingId,
          subjectKind: "hearing",
          action: `hearing.${input.to}`,
          actor: input.actor,
          payload: { from: updated.verificationStatus, to: input.to, ...input.payload },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },
};
