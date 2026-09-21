/* ------------------------------------------------------------------ *
 *  DlaoVerificationService — DLAO field-verification of a helpline
 *  handoff. Records each attempt, captures corrections, and closes
 *  with one of four outcomes (confirm / correct / dispute / unsafe).
 *
 *  Used by /dashboard/dlao/applications/[applicationId].
 * ------------------------------------------------------------------ */

import type {
  DlaoVerification,
  SlotKey,
  StoreEnvelope,
  VerificationOutcome,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { SafeContactPlanService } from "./safe-contact-plan.service";

function makeId(): string {
  return "dver-" + Math.random().toString(36).slice(2, 10);
}

export const DlaoVerificationService = {
  list(envelope: StoreEnvelope): DlaoVerification[] {
    return [...envelope.dlaoVerifications];
  },

  find(envelope: StoreEnvelope, applicationId: string): DlaoVerification | undefined {
    return envelope.dlaoVerifications.find((v) => v.applicationId === applicationId);
  },

  start(input: {
    applicationId: string;
    handoffId: string;
    channel: DlaoVerification["channel"];
    actor: string;
  }): DlaoVerification {
    const envelope = read();
    const existing = this.find(envelope, input.applicationId);
    const base = {
      id: makeId(),
      applicationId: input.applicationId,
      handoffId: input.handoffId,
      channel: input.channel,
      attempts: 1,
      corrections: [],
      notes: [],
      createdAt: new Date().toISOString(),
      safeContactCleared: false,
      by: input.actor,
    };
    const verification: DlaoVerification = existing
      ? {
          ...existing,
          ...base,
          attempts: existing.attempts + 1,
        }
      : base;
    const list = existing
      ? envelope.dlaoVerifications.map((v) =>
          v.applicationId === input.applicationId ? verification : v,
        )
      : [...envelope.dlaoVerifications, verification];
    write({ ...envelope, dlaoVerifications: list });
    AuditTrailService.log(
      {
        subject: input.applicationId,
        subjectKind: "application",
        action: "dlao_verification.attempted",
        actor: input.actor,
        payload: { channel: input.channel, attempt: verification.attempts },
      },
      { kind: "outbound_voice" as never, simulatedAt: verification.createdAt },
    );
    return verification;
  },

  correct(input: {
    applicationId: string;
    slot: SlotKey;
    oldValue: string;
    newValue: string;
    actor: string;
  }): DlaoVerification | undefined {
    const envelope = read();
    let updated: DlaoVerification | undefined;
    const list = envelope.dlaoVerifications.map((v) => {
      if (v.applicationId !== input.applicationId) return v;
      updated = {
        ...v,
        corrections: [
          ...v.corrections,
          { slot: input.slot, oldValue: input.oldValue, newValue: input.newValue },
        ],
      };
      return updated;
    });
    write({ ...envelope, dlaoVerifications: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.applicationId,
          subjectKind: "application",
          action: `dlao_verification.corrected.${input.slot}`,
          actor: input.actor,
          payload: { oldValue: input.oldValue, newValue: input.newValue },
        },
        { kind: "outbound_voice" as never, simulatedAt: new Date().toISOString() },
      );
    }
    return updated;
  },

  close(input: {
    applicationId: string;
    outcome: VerificationOutcome;
    note: { bn: string; en: string };
    actor: string;
  }): DlaoVerification | undefined {
    const envelope = read();
    let updated: DlaoVerification | undefined;
    const list = envelope.dlaoVerifications.map((v) => {
      if (v.applicationId !== input.applicationId) return v;
      updated = {
        ...v,
        outcome: input.outcome,
        notes: [...v.notes, input.note],
        completedAt: new Date().toISOString(),
        safeContactCleared:
          input.outcome !== "unsafe_contact_failed" && input.outcome !== "applicant_disputed",
      };
      return updated;
    });
    write({ ...envelope, dlaoVerifications: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.applicationId,
          subjectKind: "application",
          action: `dlao_verification.${input.outcome}`,
          actor: input.actor,
          payload: { note: input.note },
        },
        { kind: "outbound_voice" as never, simulatedAt: new Date().toISOString() },
      );
      if (input.outcome === "applicant_disputed" || input.outcome === "unsafe_contact_failed") {
        SafeContactPlanService.fail({
          applicationId: input.applicationId,
          actor: input.actor,
          reason: input.note,
        });
      }
    }
    return updated;
  },
};
