/* ------------------------------------------------------------------ *
 *  RepresentationService — state machine for `RepresentationAuthority`.
 *
 *  - `record(...)` creates a representation in `reported` state.
 *    It NEVER auto-confirms.
 *  - `confirm(...)` requires explicit caller confirmation and writes
 *    an audit event. Without confirmation, calling `submit(...)` on
 *    the parent application throws `RepresentationOutOfScopeError`.
 * ------------------------------------------------------------------ */

import type { RepresentationAuthority, StoreEnvelope } from "../types";
import { RepresentationOutOfScopeError } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";

function makeId(): string {
  return "rep-" + Math.random().toString(36).slice(2, 10);
}

export const RepresentationService = {
  list(envelope: StoreEnvelope): RepresentationAuthority[] {
    return [...envelope.representations];
  },

  findFor(
    envelope: StoreEnvelope,
    applicationId: string,
  ): RepresentationAuthority | undefined {
    return envelope.representations.find((r) => r.applicationId === applicationId);
  },

  record(input: {
    applicationId: string;
    callerName: string;
    callerRelation: string;
    actor: string;
    scopeNotes?: string;
  }): RepresentationAuthority {
    const now = new Date().toISOString();
    const existing = read().representations.find(
      (r) => r.applicationId === input.applicationId,
    );
    if (existing) {
      // Refresh the reported record; still NEVER auto-confirmed.
      const envelope = read();
      const updated: RepresentationAuthority = {
        ...existing,
        callerName: input.callerName,
        callerRelation: input.callerRelation,
        scopeNotes: input.scopeNotes,
        state: "reported",
        updatedAt: now,
      };
      write({
        ...envelope,
        representations: envelope.representations.map((r) =>
          r.id === existing.id ? updated : r,
        ),
      });
      AuditTrailService.log(
        {
          subject: input.applicationId,
          subjectKind: "representation",
          action: "representation.reported",
          actor: input.actor,
          payload: { callerName: input.callerName, relation: input.callerRelation },
        },
        { kind: "voice", simulatedAt: now },
      );
      return updated;
    }

    const record: RepresentationAuthority = {
      id: makeId(),
      applicationId: input.applicationId,
      callerName: input.callerName,
      callerRelation: input.callerRelation,
      scopeNotes: input.scopeNotes,
      state: "reported",
      recordedAt: now,
      updatedAt: now,
    };
    const envelope = read();
    write({ ...envelope, representations: [...envelope.representations, record] });
    AuditTrailService.log(
      {
        subject: input.applicationId,
        subjectKind: "representation",
        action: "representation.reported",
        actor: input.actor,
        payload: { callerName: input.callerName, relation: input.callerRelation },
      },
      { kind: "voice", simulatedAt: now },
    );
    return record;
  },

  confirm(input: {
    representationId: string;
    confirmedBy: string;
    actor: string;
  }): RepresentationAuthority {
    const envelope = read();
    const found = envelope.representations.find((r) => r.id === input.representationId);
    if (!found) {
      throw new RepresentationOutOfScopeError(
        "Representation not found — applicant must confirm directly.",
      );
    }
    const updated: RepresentationAuthority = {
      ...found,
      state: "confirmed",
      confirmedBy: input.confirmedBy,
      updatedAt: new Date().toISOString(),
    };
    write({
      ...envelope,
      representations: envelope.representations.map((r) =>
        r.id === found.id ? updated : r,
      ),
    });
    AuditTrailService.log(
      {
        subject: found.applicationId,
        subjectKind: "representation",
        action: "representation.confirmed",
        actor: input.actor,
        payload: { confirmedBy: input.confirmedBy },
      },
      { kind: "voice", simulatedAt: new Date().toISOString() },
    );
    return updated;
  },

  /**
   * Throws unless the representation is in `confirmed` state. Called by
   * ApplicationRecordService.submit via the intake panel.
   */
  assertConfirmedOrAbsent(applicationId: string): void {
    const envelope = read();
    const rep = envelope.representations.find(
      (r) => r.applicationId === applicationId,
    );
    if (!rep) return;
    if (rep.state !== "confirmed") {
      throw new RepresentationOutOfScopeError(
        "A representative has only reported — applicant confirmation is required before submission.",
      );
    }
  },
};
