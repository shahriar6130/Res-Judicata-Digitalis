/* ------------------------------------------------------------------ *
 *  CaseHandoverService — handover package builder + acknowledgement.
 *
 *  The handover package is a structured bundle that preserves
 *  critical context for the new lawyer: current stage, upcoming
 *  hearings, deadlines, safe contact, documents, previous filings,
 *  orders, last verified update, outstanding tasks, risks, required
 *  first action, author, version, and an explicit acknowledgement
 *  receipt.
 * ------------------------------------------------------------------ */

import type { CaseHandover, CaseStage, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";
import { HearingService } from "./hearing.service";
import { CaseProgressService } from "./case-progress.service";

function makeId(): string {
  return "hov-" + Math.random().toString(36).slice(2, 10);
}

export const CaseHandoverService = {
  list(envelope: StoreEnvelope): CaseHandover[] {
    return envelope.caseHandovers ?? [];
  },

  find(envelope: StoreEnvelope, handoverId: string): CaseHandover | undefined {
    return (envelope.caseHandovers ?? []).find((h) => h.handoverId === handoverId);
  },

  byCase(envelope: StoreEnvelope, caseId: string): CaseHandover[] {
    return (envelope.caseHandovers ?? []).filter((h) => h.caseId === caseId);
  },

  buildHandoverPackage(input: {
    caseId: string;
    reassignmentId: string;
    currentStage: CaseStage;
    requiredFirstAction: string;
    clientSafeContact?: string;
    builtBy: string;
  }): CaseHandover {
    const envelope = read();
    const now = DemoTimeService.iso();
    const hearings = HearingService.forCase(envelope, input.caseId);
    const upcoming = hearings
      .filter((h) => h.verificationStatus !== "completed" && h.verificationStatus !== "cancelled")
      .sort((a, b) => new Date(a.hearingDate).getTime() - new Date(b.hearingDate).getTime());
    const latestUpdate = CaseProgressService.latest(envelope, input.caseId);
    const handover: CaseHandover = {
      handoverId: makeId(),
      reassignmentId: input.reassignmentId,
      caseId: input.caseId,
      builtAt: now,
      builtBy: input.builtBy,
      currentStage: input.currentStage,
      upcomingHearing: upcoming[0],
      criticalDeadlines: upcoming.map((h) => ({ at: h.hearingDate, label: h.court })),
      clientSafeContact: input.clientSafeContact ?? "(see safe contact plan)",
      documents: [],
      previousFilings: [],
      orders: [],
      lastVerifiedUpdate: latestUpdate,
      outstandingTasks: [],
      risks: [],
      requiredFirstAction: input.requiredFirstAction,
      handoverAuthor: input.builtBy,
      packageVersion: 1,
    };
    write({
      ...envelope,
      caseHandovers: [...(envelope.caseHandovers ?? []), handover],
    });
    AuditTrailService.log(
      {
        subject: input.caseId,
        subjectKind: "case_handover",
        action: "case_handover.built",
        actor: input.builtBy,
        payload: { handoverId: handover.handoverId, reassignmentId: input.reassignmentId },
      },
      { kind: "officer_lookup", simulatedAt: now },
    );
    return handover;
  },

  ackReceipt(input: { handoverId: string; actor: string }): CaseHandover | undefined {
    const envelope = read();
    let updated: CaseHandover | undefined;
    const list = (envelope.caseHandovers ?? []).map((h) => {
      if (h.handoverId !== input.handoverId) return h;
      updated = { ...h, acknowledgedAt: DemoTimeService.iso(), acknowledgedBy: input.actor };
      return updated;
    });
    write({ ...envelope, caseHandovers: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.handoverId,
          subjectKind: "case_handover",
          action: "case_handover.acknowledged",
          actor: input.actor,
          payload: { caseId: updated.caseId },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },

  addFinalStatement(input: { handoverId: string; actor: string; statement: string }): CaseHandover | undefined {
    const envelope = read();
    let updated: CaseHandover | undefined;
    const list = (envelope.caseHandovers ?? []).map((h) => {
      if (h.handoverId !== input.handoverId) return h;
      updated = { ...h, finalHandoverStatement: input.statement, finalStatementAt: DemoTimeService.iso() };
      return updated;
    });
    write({ ...envelope, caseHandovers: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.handoverId,
          subjectKind: "case_handover",
          action: "case_handover.final_statement",
          actor: input.actor,
          payload: { statement: input.statement },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },
};
