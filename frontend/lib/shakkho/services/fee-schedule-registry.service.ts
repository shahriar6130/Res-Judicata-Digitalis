/* ------------------------------------------------------------------ *
 *  FeeScheduleRegistryService — versioned fee schedule registry.
 *
 *  Each FeeSchedule is a versioned entry (referenced by reference +
 *  officialInstrument) that can be marked verified, expired, or
 *  superseded. The registry is the source of truth for the
 *  payment-reconciliation worksheet.
 * ------------------------------------------------------------------ */

import type { FeeSchedule, FeeScheduleStatus, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

function makeId(): string {
  return "fee-" + Math.random().toString(36).slice(2, 10);
}

export const FeeScheduleRegistryService = {
  list(envelope: StoreEnvelope): FeeSchedule[] {
    return envelope.feeSchedules ?? [];
  },

  find(envelope: StoreEnvelope, scheduleId: string): FeeSchedule | undefined {
    return (envelope.feeSchedules ?? []).find((f) => f.scheduleId === scheduleId);
  },

  forMatter(envelope: StoreEnvelope, matterType: string, stage: string): FeeSchedule | undefined {
    return (envelope.feeSchedules ?? []).find(
      (f) => f.matterType === matterType && f.stage === stage && f.status === "verified",
    );
  },

  createVersion(input: {
    officialInstrument: string;
    reference: string;
    effectiveDate: string;
    expiryDate?: string;
    matterType: string;
    courtOrServiceType: string;
    stage: string;
    authorizedAmount: number;
    requiredSupportingRecords: string[];
    approvalAuthority: string;
    officialSource: string;
    actor: string;
    notes?: string;
  }): FeeSchedule {
    const envelope = read();
    const item: FeeSchedule = {
      scheduleId: makeId(),
      officialInstrument: input.officialInstrument,
      reference: input.reference,
      effectiveDate: input.effectiveDate,
      expiryDate: input.expiryDate,
      matterType: input.matterType,
      courtOrServiceType: input.courtOrServiceType,
      stage: input.stage,
      authorizedAmount: input.authorizedAmount,
      currency: "BDT",
      requiredSupportingRecords: input.requiredSupportingRecords,
      approvalAuthority: input.approvalAuthority,
      officialSource: input.officialSource,
      status: "unverified",
      notes: input.notes,
      rulesetVersion: "R8-v0.1.0",
    };
    write({
      ...envelope,
      feeSchedules: [...(envelope.feeSchedules ?? []), item],
    });
    AuditTrailService.log(
      {
        subject: input.reference,
        subjectKind: "fee_schedule",
        action: "fee_schedule.created",
        actor: input.actor,
        payload: { scheduleId: item.scheduleId, matterType: input.matterType, stage: input.stage, amount: input.authorizedAmount },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return item;
  },

  markVerified(input: { scheduleId: string; actor: string }): FeeSchedule | undefined {
    const envelope = read();
    let updated: FeeSchedule | undefined;
    const list = (envelope.feeSchedules ?? []).map((f) => {
      if (f.scheduleId !== input.scheduleId) return f;
      updated = { ...f, status: "verified", verifiedBy: input.actor, verificationDate: DemoTimeService.iso() };
      return updated;
    });
    write({ ...envelope, feeSchedules: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.scheduleId,
          subjectKind: "fee_schedule",
          action: "fee_schedule.verified",
          actor: input.actor,
          payload: { matterType: updated.matterType, stage: updated.stage },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },

  markExpired(input: { scheduleId: string; actor: string }): FeeSchedule | undefined {
    return this.transition(input.scheduleId, "expired", input.actor);
  },

  supersede(input: { scheduleId: string; successorScheduleId: string; actor: string }): FeeSchedule | undefined {
    const envelope = read();
    let updated: FeeSchedule | undefined;
    const list = (envelope.feeSchedules ?? []).map((f) => {
      if (f.scheduleId !== input.scheduleId) return f;
      updated = { ...f, status: "superseded", supersededByScheduleId: input.successorScheduleId };
      return updated;
    });
    write({ ...envelope, feeSchedules: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.scheduleId,
          subjectKind: "fee_schedule",
          action: "fee_schedule.superseded",
          actor: input.actor,
          payload: { successorScheduleId: input.successorScheduleId },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },

  transition(scheduleId: string, to: FeeScheduleStatus, actor: string): FeeSchedule | undefined {
    const envelope = read();
    let updated: FeeSchedule | undefined;
    const list = (envelope.feeSchedules ?? []).map((f) => {
      if (f.scheduleId !== scheduleId) return f;
      updated = { ...f, status: to };
      return updated;
    });
    write({ ...envelope, feeSchedules: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: scheduleId,
          subjectKind: "fee_schedule",
          action: `fee_schedule.${to}`,
          actor,
          payload: { matterType: updated.matterType, stage: updated.stage },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },
};