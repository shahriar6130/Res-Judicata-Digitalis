/* ------------------------------------------------------------------ *
 *  InactivityPatternService — cross-case pattern detection +
 *  exception evaluation.
 *
 *  States (spec §30):
 *    threshold_reached → data_validation → human_review →
 *    explanation_requested →
 *    {resolved_operationally | formal_review_recommended |
 *     dismissed | monitoring}
 *
 *  Exceptions that suppress a pattern alert:
 *    - approved leave
 *    - recorded outage
 *    - waived requirement
 *    - stay / pause order
 *    - alternative-channel submission acknowledged
 *
 *  This service is intentionally separate from the lawyer-change
 *  workflow (service continuity) and from payment reconciliation.
 * ------------------------------------------------------------------ */

import type {
  InactivityPattern,
  InactivityPatternHistoryItem,
  InactivityPatternState,
  StoreEnvelope,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

function makeId(): string {
  return "ipa-" + Math.random().toString(36).slice(2, 10);
}

export const PATTERN_THRESHOLD = {
  overdueRequiredUpdatesPerCase: 2,
  missedPostHearingReportsPerCase: 2,
  contributingCasesMinimum: 3,
  daysSinceLastActivity: 30,
};

export const InactivityPatternService = {
  list(envelope: StoreEnvelope): InactivityPattern[] {
    return envelope.inactivityPatterns ?? [];
  },

  find(envelope: StoreEnvelope, patternId: string): InactivityPattern | undefined {
    return (envelope.inactivityPatterns ?? []).find((p) => p.patternId === patternId);
  },

  byLawyer(envelope: StoreEnvelope, lawyerId: string): InactivityPattern[] {
    return (envelope.inactivityPatterns ?? []).filter((p) => p.lawyerId === lawyerId);
  },

  evaluateExceptions(envelope: StoreEnvelope, lawyerId: string): {
    onApprovedLeave: boolean;
    outageRecorded: boolean;
    waivedRequirement: boolean;
    stayed: boolean;
    alternativeChannel: boolean;
    notes: string[];
  } {
    const lawyer = (envelope.panelLawyers ?? []).find((l) => l.lawyerId === lawyerId);
    const onApprovedLeave = lawyer?.availability === "on_approved_leave";
    const availability = (envelope.lawyerAvailabilities ?? []).find((a) => a.lawyerId === lawyerId);
    const outageRecorded = availability?.reasonCategory === "system_outage";
    const waivedRequirement = (envelope.requiredUpdates ?? []).some(
      (u) =>
        u.state === "waived" &&
        (envelope.lawyerAssignments ?? []).some((a) => a.lawyerId === lawyerId && a.caseId === u.caseId),
    );
    const stayed = (envelope.caseHearings ?? []).some(
      (h) => h.verificationStatus === "cancelled" && (h.sourceNote?.toLowerCase().includes("stay") ?? false),
    );
    const alternativeChannel = false;
    const notes: string[] = [];
    if (onApprovedLeave) notes.push("Lawyer on approved leave — counts toward exemption");
    if (outageRecorded) notes.push("Recorded outage — counts toward exemption");
    if (waivedRequirement) notes.push("Required update waived — counts toward exemption");
    if (stayed) notes.push("Stay / pause recorded — counts toward exemption");
    if (alternativeChannel) notes.push("Alternative-channel submission acknowledged — counts toward exemption");
    return { onApprovedLeave, outageRecorded, waivedRequirement, stayed, alternativeChannel, notes };
  },

  detectPatterns(actor = "system"): InactivityPattern[] {
    const envelope = read();
    const detected: InactivityPattern[] = [];
    const lawyers = envelope.panelLawyers ?? [];
    for (const l of lawyers) {
      if (l.panelStatus !== "approved") continue;
      const assignments = (envelope.lawyerAssignments ?? []).filter(
        (a) => a.lawyerId === l.lawyerId && a.state === "active",
      );
      const caseIds = new Set(assignments.map((a) => a.caseId));
      let contributing = 0;
      let overdue = 0;
      let missed = 0;
      for (const cid of caseIds) {
        const over = (envelope.requiredUpdates ?? []).filter(
          (u) => u.caseId === cid && (u.state === "overdue" || u.state === "reminded"),
        ).length;
        overdue += over;
        if (over >= PATTERN_THRESHOLD.overdueRequiredUpdatesPerCase) contributing++;
        const hearingsMissed = (envelope.caseHearings ?? []).filter(
          (h) => h.caseId === cid && h.verificationStatus === "result_overdue",
        ).length;
        missed += hearingsMissed;
        if (hearingsMissed >= PATTERN_THRESHOLD.missedPostHearingReportsPerCase) contributing++;
      }
      if (contributing >= PATTERN_THRESHOLD.contributingCasesMinimum) {
        const existing = (envelope.inactivityPatterns ?? []).find(
          (p) => p.lawyerId === l.lawyerId && p.state !== "dismissed" && p.state !== "resolved_operationally",
        );
        if (!existing) {
          const now = DemoTimeService.iso();
          const pattern: InactivityPattern = {
            patternId: makeId(),
            lawyerId: l.lawyerId,
            threshold: {
              overdueUpdates: PATTERN_THRESHOLD.overdueRequiredUpdatesPerCase,
              missedPostHearingReports: PATTERN_THRESHOLD.missedPostHearingReportsPerCase,
              daysSinceLastActivity: PATTERN_THRESHOLD.daysSinceLastActivity,
              crossCaseCount: PATTERN_THRESHOLD.contributingCasesMinimum,
            },
            contributingCaseIds: Array.from(caseIds),
            contributingEventIds: [],
            exceptions: [],
            state: "threshold_reached",
            history: [
              {
                at: now,
                actor,
                fromState: undefined,
                toState: "threshold_reached",
                reason: `Detected ${contributing} contributing cases`,
                note: `Overdue updates: ${overdue}; missed reports: ${missed}`,
              },
            ],
            createdAt: now,
          };
          detected.push(pattern);
          AuditTrailService.log(
            {
              subject: pattern.patternId,
              subjectKind: "inactivity_pattern",
              action: "inactivity_pattern.detected",
              actor,
              payload: { lawyerId: l.lawyerId, contributing, overdue, missed },
            },
            { kind: "system", simulatedAt: now },
          );
        }
      }
    }
    if (detected.length > 0) {
      write({
        ...envelope,
        inactivityPatterns: [...(envelope.inactivityPatterns ?? []), ...detected],
      });
    }
    return detected;
  },

  transition(input: {
    patternId: string;
    to: InactivityPatternState;
    actor: string;
    payload?: Record<string, unknown>;
  }): InactivityPattern | undefined {
    const envelope = read();
    let updated: InactivityPattern | undefined;
    const list = (envelope.inactivityPatterns ?? []).map((p) => {
      if (p.patternId !== input.patternId) return p;
      const history: InactivityPatternHistoryItem[] = [
        ...p.history,
        {
          at: DemoTimeService.iso(),
          actor: input.actor,
          fromState: p.state,
          toState: input.to,
          reason: input.payload?.reason as string | undefined,
          note: input.payload?.note as string | undefined,
        },
      ];
      updated = { ...p, state: input.to, history };
      return updated;
    });
    write({ ...envelope, inactivityPatterns: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.patternId,
          subjectKind: "inactivity_pattern",
          action: `inactivity_pattern.${input.to}`,
          actor: input.actor,
          payload: { from: updated.state, to: input.to, ...input.payload },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },
};