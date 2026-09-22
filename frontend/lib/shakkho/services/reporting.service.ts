/* ------------------------------------------------------------------ *
 *  ReportingService — pure derivations over the envelope.
 *
 *  Used by the DLAO dashboard and the lawyer dashboard. No new
 *  storage is created — these views re-derive counts and lists from
 *  the canonical arrays.
 * ------------------------------------------------------------------ */

import type { StoreEnvelope } from "../types";

export const ReportingService = {
  assignmentsByState(envelope: StoreEnvelope) {
    const map = new Map<string, number>();
    for (const a of envelope.lawyerAssignments ?? []) {
      map.set(a.state, (map.get(a.state) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([state, count]) => ({ state, count }));
  },

  hearingsNext7Days(envelope: StoreEnvelope) {
    const now = Date.now() + (envelope.demoTimeOffsetMs ?? 0);
    const week = now + 7 * 24 * 60 * 60 * 1000;
    return (envelope.caseHearings ?? [])
      .filter((h) => {
        const t = new Date(h.hearingDate).getTime();
        return t >= now && t <= week && h.verificationStatus !== "completed" && h.verificationStatus !== "cancelled";
      })
      .sort((a, b) => new Date(a.hearingDate).getTime() - new Date(b.hearingDate).getTime());
  },

  overdueCaseUpdates(envelope: StoreEnvelope) {
    return (envelope.requiredUpdates ?? []).filter((u) => u.state === "overdue");
  },

  casesWithoutVerifiedFutureAction(envelope: StoreEnvelope) {
    const caseIds = new Set(
      (envelope.lawyerAssignments ?? []).filter((a) => a.state === "active").map((a) => a.caseId),
    );
    return Array.from(caseIds).filter((caseId) => {
      const hasFutureHearing = (envelope.caseHearings ?? []).some(
        (h) =>
          h.caseId === caseId &&
          h.verificationStatus === "verified" &&
          new Date(h.hearingDate).getTime() > Date.now() + (envelope.demoTimeOffsetMs ?? 0),
      );
      return !hasFutureHearing;
    });
  },

  citizenContactFailures(envelope: StoreEnvelope) {
    return (envelope.contactAttempts ?? []).filter(
      (a) => a.outcome === "no_answer" || a.outcome === "voicemail" || a.outcome === "sms_failed",
    );
  },

  reassignmentTurnaround(envelope: StoreEnvelope) {
    return (envelope.reassignments ?? []).map((r) => ({
      reassignmentId: r.reassignmentId,
      caseId: r.caseId,
      from: r.fromLawyerId,
      to: r.toLawyerId,
      recordedAt: r.recordedAt,
      decision: r.decision.decision,
    }));
  },

  handoverCompleteness(envelope: StoreEnvelope) {
    return (envelope.caseHandovers ?? []).map((h) => ({
      handoverId: h.handoverId,
      caseId: h.caseId,
      acknowledged: !!h.acknowledgedAt,
      builtAt: h.builtAt,
    }));
  },

  patternAlertsAwaitingReview(envelope: StoreEnvelope) {
    return (envelope.inactivityPatterns ?? []).filter(
      (p) => p.state === "threshold_reached" || p.state === "data_validation" || p.state === "human_review",
    );
  },

  paymentItemsAwaitingEvidence(envelope: StoreEnvelope) {
    return (envelope.paymentReconciliations ?? []).filter(
      (p) => p.state === "worksheet_prepared" || p.state === "evidence_review",
    );
  },

  casesAtRiskOfUnnecessaryTravel(envelope: StoreEnvelope) {
    const now = Date.now() + (envelope.demoTimeOffsetMs ?? 0);
    const upcoming = (envelope.caseHearings ?? []).filter(
      (h) =>
        h.verificationStatus !== "verified" &&
        h.verificationStatus !== "completed" &&
        new Date(h.hearingDate).getTime() > now,
    );
    return upcoming;
  },

  daysSinceLastActivity(envelope: StoreEnvelope, lawyerId: string): number {
    const caseIds = (envelope.lawyerAssignments ?? [])
      .filter((a) => a.lawyerId === lawyerId && a.state === "active")
      .map((a) => a.caseId);
    let latest = 0;
    const now = Date.now() + (envelope.demoTimeOffsetMs ?? 0);
    for (const cid of caseIds) {
      const lastUpdate = (envelope.caseProgressUpdates ?? []).filter((u) => u.caseId === cid);
      if (lastUpdate.length > 0) {
        const t = new Date(lastUpdate[lastUpdate.length - 1].submissionDate).getTime();
        const days = (now - t) / (24 * 60 * 60 * 1000);
        if (days > latest) latest = days;
      } else {
        return 9999;
      }
    }
    return Math.round(latest);
  },
};