/* ------------------------------------------------------------------ *
 *  LawyerWorklistService — pure derivation over envelope.
 *
 *  Builds the unified lawyer view by joining assignments + hearings
 *  + required updates + tasks. No new storage.
 * ------------------------------------------------------------------ */

import type { LawyerAssignment, StoreEnvelope } from "../types";

export const LawyerWorklistService = {
  forLawyer(envelope: StoreEnvelope, lawyerId: string): {
    active: LawyerAssignment[];
    awaitingResponse: LawyerAssignment[];
    handoverRequired: LawyerAssignment[];
    recentlyCompleted: LawyerAssignment[];
  } {
    const assignments = (envelope.lawyerAssignments ?? []).filter((a) => a.lawyerId === lawyerId);
    return {
      active: assignments.filter((a) => a.state === "active"),
      awaitingResponse: assignments.filter(
        (a) => a.state === "offered" || a.state === "awaiting_response" || a.state === "prepared",
      ),
      handoverRequired: assignments.filter((a) => a.state === "handover_required"),
      recentlyCompleted: assignments
        .filter((a) => a.state === "completed" || a.state === "ended" || a.state === "reassigned")
        .slice(-10),
    };
  },

  hearingsNext7Days(envelope: StoreEnvelope, lawyerId: string) {
    const now = Date.now() + (envelope.demoTimeOffsetMs ?? 0);
    const week = now + 7 * 24 * 60 * 60 * 1000;
    const caseIds = new Set(
      (envelope.lawyerAssignments ?? [])
        .filter((a) => a.lawyerId === lawyerId && a.state === "active")
        .map((a) => a.caseId),
    );
    return (envelope.caseHearings ?? []).filter((h) => {
      if (!caseIds.has(h.caseId)) return false;
      const t = new Date(h.hearingDate).getTime();
      return t >= now && t <= week;
    });
  },

  overdueUpdates(envelope: StoreEnvelope, lawyerId: string) {
    const caseIds = new Set(
      (envelope.lawyerAssignments ?? [])
        .filter((a) => a.lawyerId === lawyerId && a.state === "active")
        .map((a) => a.caseId),
    );
    return (envelope.requiredUpdates ?? []).filter(
      (u) => caseIds.has(u.caseId) && (u.state === "overdue" || u.state === "reminded"),
    );
  },

  countActive(envelope: StoreEnvelope, lawyerId: string): number {
    return (envelope.lawyerAssignments ?? []).filter(
      (a) => a.lawyerId === lawyerId && a.state === "active",
    ).length;
  },
};
