/* ------------------------------------------------------------------ *
 *  LawyerAvailabilityService — self-reported availability.
 *
 *  LawyerAvailability.status tracks Available | Busy | Unavailable |
 *  OnLeave | NotAcceptingNew. Stale availability is NEVER treated as
 *  misconduct — see InactivityPatternService for the dedicated
 *  pattern-review flow.
 * ------------------------------------------------------------------ */

import type { LawyerAvailability, LawyerAvailabilityStatus, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

function makeId(): string {
  return "av-" + Math.random().toString(36).slice(2, 10);
}

export const LawyerAvailabilityService = {
  list(envelope: StoreEnvelope): LawyerAvailability[] {
    return envelope.lawyerAvailabilities ?? [];
  },

  forLawyer(envelope: StoreEnvelope, lawyerId: string): LawyerAvailability | undefined {
    return (envelope.lawyerAvailabilities ?? []).find((a) => a.lawyerId === lawyerId);
  },

  setStatus(input: {
    lawyerId: string;
    status: LawyerAvailabilityStatus;
    actor: string;
    note?: string;
    expectedReturnAt?: string;
    reasonCategory?: LawyerAvailability["reasonCategory"];
    source?: LawyerAvailability["source"];
  }): LawyerAvailability {
    const envelope = read();
    const existing = (envelope.lawyerAvailabilities ?? []).find((a) => a.lawyerId === input.lawyerId);
    const now = DemoTimeService.iso();
    const next: LawyerAvailability = {
      availabilityId: existing?.availabilityId ?? makeId(),
      lawyerId: input.lawyerId,
      status: input.status,
      effectiveAt: now,
      expectedReturnAt: input.expectedReturnAt,
      reasonNote: input.note,
      reasonCategory: input.reasonCategory,
      lastConfirmedAt: now,
      source: input.source ?? "self_report",
    };
    const list = existing
      ? (envelope.lawyerAvailabilities ?? []).map((a) => (a.lawyerId === input.lawyerId ? next : a))
      : [...(envelope.lawyerAvailabilities ?? []), next];
    write({ ...envelope, lawyerAvailabilities: list });
    AuditTrailService.log(
      {
        subject: input.lawyerId,
        subjectKind: "lawyer_availability",
        action: "lawyer_availability.updated",
        actor: input.actor,
        payload: { from: existing?.status, to: input.status, note: input.note },
      },
      { kind: "officer_lookup", simulatedAt: now },
    );
    return next;
  },
};