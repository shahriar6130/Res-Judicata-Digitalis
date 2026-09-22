/* ------------------------------------------------------------------ *
 *  CaseProgressService — append-only progress updates from lawyers.
 *
 *  Each update records an UpdateType, event date, submission date,
 *  case stage, court, summary, source, supporting document, next
 *  action, responsible actor, citizen-visible summary, internal note.
 *  Updates are immutable.
 * ------------------------------------------------------------------ */

import type { CaseProgressUpdate, ProgressUpdateType, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

function makeId(): string {
  return "cpu-" + Math.random().toString(36).slice(2, 10);
}

export const CaseProgressService = {
  list(envelope: StoreEnvelope): CaseProgressUpdate[] {
    return envelope.caseProgressUpdates ?? [];
  },

  forCase(envelope: StoreEnvelope, caseId: string): CaseProgressUpdate[] {
    return (envelope.caseProgressUpdates ?? []).filter((u) => u.caseId === caseId);
  },

  recordProgress(input: {
    caseId: string;
    lawyerId: string;
    updateType: ProgressUpdateType;
    eventDate: string;
    caseStageAtUpdate?: CaseProgressUpdate["caseStageAtUpdate"];
    courtOrLocation?: string;
    summary: string;
    source?: string;
    supportingDocumentId?: string;
    nextHearingId?: string;
    nextAction?: string;
    responsibleActor?: string;
    citizenVisibleSummary?: string;
    internalNote?: string;
    actor: string;
  }): CaseProgressUpdate {
    const envelope = read();
    const update: CaseProgressUpdate = {
      updateId: makeId(),
      caseId: input.caseId,
      lawyerId: input.lawyerId,
      updateType: input.updateType,
      eventDate: input.eventDate,
      submissionDate: DemoTimeService.iso(),
      caseStageAtUpdate: input.caseStageAtUpdate,
      courtOrLocation: input.courtOrLocation,
      summary: input.summary,
      source: input.source,
      supportingDocumentId: input.supportingDocumentId,
      nextHearingId: input.nextHearingId,
      nextAction: input.nextAction,
      responsibleActor: input.responsibleActor,
      citizenVisibleSummary: input.citizenVisibleSummary,
      internalNote: input.internalNote,
      confirmationStatus: "submitted",
    };
    const audit = AuditTrailService.log(
      {
        subject: input.caseId,
        subjectKind: "case_progress",
        action: "case_progress.recorded",
        actor: input.actor,
        payload: { updateId: update.updateId, updateType: input.updateType },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    update.auditEventId = audit.id;
    write({
      ...envelope,
      caseProgressUpdates: [...(envelope.caseProgressUpdates ?? []), update],
    });
    return update;
  },

  latest(envelope: StoreEnvelope, caseId: string): CaseProgressUpdate | undefined {
    const updates = this.forCase(envelope, caseId);
    if (updates.length === 0) return undefined;
    return updates[updates.length - 1];
  },
};
