/* ------------------------------------------------------------------ *
 *  EscalationService — repeated-transfer detector + escalation task
 *  lifecycle for the jurisdiction tug-of-war scenario.
 *
 *  Triggers an escalation when the same case has been transferred or
 *  returned twice between the same or related destinations, OR when
 *  the configured return threshold is reached.
 *
 *  The system NEVER decides jurisdiction — only a human reviewer
 *  records a HumanRoutingDecision.
 * ------------------------------------------------------------------ */

import type {
  EscalationTask,
  HumanRoutingDecision,
  StoreEnvelope,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

const RULESET_VERSION = "R7-v0.1.0";
const RETURN_THRESHOLD = 2;

export const EscalationService = {
  list(envelope: StoreEnvelope): EscalationTask[] {
    return envelope.escalationTasks ?? [];
  },

  find(envelope: StoreEnvelope, escalationId: string): EscalationTask | undefined {
    return (envelope.escalationTasks ?? []).find((e) => e.escalationId === escalationId);
  },

  /**
   * Inspect a case's referrals; if any referral has been transferred
   * and returned twice between related destinations, create an
   * escalation.
   */
  detectRepeatedTransfer(input: { applicationId: string; actor: string }): EscalationTask | undefined {
    const envelope = read();
    const refs = (envelope.referrals ?? []).filter((r) => r.applicationId === input.applicationId);
    const returns = refs.filter(
      (r) =>
        r.package.state === "returned" ||
        r.package.history.some((h) => h.toState === "returned"),
    );
    const transfers = refs.filter((r) => r.package.history.some((h) => h.action === "referral.sent"));
    if (returns.length < RETURN_THRESHOLD) return undefined;
    const existing = (envelope.escalationTasks ?? []).find(
      (e) => e.applicationId === input.applicationId && e.reason === "repeated_transfer" && e.state !== "receiving_authority_acknowledged",
    );
    if (existing) return existing;
    const escalation: EscalationTask = {
      escalationId: "escal-" + Math.random().toString(36).slice(2, 10),
      applicationId: input.applicationId,
      reason: "repeated_transfer",
      state: "repeat_detected",
      history: [
        {
          at: DemoTimeService.iso(),
          from: "second_return",
          to: "repeat_detected",
          actor: input.actor,
          reason: `Detected ${transfers.length} transfers and ${returns.length} returns`,
        },
      ],
      createdAt: DemoTimeService.iso(),
    };
    write({
      ...envelope,
      escalationTasks: [...(envelope.escalationTasks ?? []), escalation],
    });
    AuditTrailService.log(
      {
        subject: escalation.escalationId,
        subjectKind: "escalation",
        action: "escalation.repeat_detected",
        actor: input.actor,
        payload: { applicationId: input.applicationId, transfers: transfers.length, returns: returns.length, rulesetVersion: RULESET_VERSION },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return escalation;
  },

  /** Create the canonical jurisdiction-tug-of-war escalation (for seeding). */
  seedJurisdictionEscalation(input: { applicationId: string; caseId: string; actor: string }): EscalationTask {
    const envelope = read();
    const escalation: EscalationTask = {
      escalationId: "escal-tug-" + Math.random().toString(36).slice(2, 8),
      applicationId: input.applicationId,
      caseId: input.caseId,
      reason: "repeated_transfer",
      state: "repeat_detected",
      history: [
        { at: DemoTimeService.iso(), from: "first_transfer", to: "first_return", actor: input.actor, reason: "Initial transfer to Labour Legal Aid Cell" },
        { at: DemoTimeService.iso(), from: "first_return", to: "second_transfer", actor: input.actor, reason: "Returned with reason: jurisdiction unclear" },
        { at: DemoTimeService.iso(), from: "second_transfer", to: "second_return", actor: input.actor, reason: "Returned with reason: receiving office outside route" },
        { at: DemoTimeService.iso(), from: "second_return", to: "repeat_detected", actor: input.actor, reason: "Two transfer-return cycles detected" },
      ],
      createdAt: DemoTimeService.iso(),
    };
    write({
      ...envelope,
      escalationTasks: [...(envelope.escalationTasks ?? []), escalation],
    });
    AuditTrailService.log(
      {
        subject: escalation.escalationId,
        subjectKind: "escalation",
        action: "escalation.seeded",
        actor: input.actor,
        payload: { applicationId: input.applicationId, state: escalation.state },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return escalation;
  },

  transition(input: {
    escalationId: string;
    to: EscalationTask["state"];
    actor: string;
    reason: string;
  }): EscalationTask | undefined {
    const envelope = read();
    let updated: EscalationTask | undefined;
    const list = (envelope.escalationTasks ?? []).map((e) => {
      if (e.escalationId !== input.escalationId) return e;
      updated = {
        ...e,
        state: input.to,
        history: [
          ...e.history,
          { at: DemoTimeService.iso(), from: e.state, to: input.to, actor: input.actor, reason: input.reason },
        ],
      };
      return updated;
    });
    write({ ...envelope, escalationTasks: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.escalationId,
          subjectKind: "escalation",
          action: `escalation.${input.to}`,
          actor: input.actor,
          payload: { reason: input.reason },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },

  recordHumanRoutingDecision(input: {
    escalationId: string;
    applicationId: string;
    decision: HumanRoutingDecision["decision"];
    decidedBy: string;
    reason: string;
    authorityForDecision: string;
    destinationEntryId?: string;
    nextDeadline?: string;
    nextResponsibleOffice?: string;
    relatedReferralId?: string;
  }): HumanRoutingDecision | undefined {
    const envelope = read();
    const decision: HumanRoutingDecision = {
      decisionId: "dec-" + Math.random().toString(36).slice(2, 10),
      escalationId: input.escalationId,
      applicationId: input.applicationId,
      decidedAt: DemoTimeService.iso(),
      decidedBy: input.decidedBy,
      decision: input.decision,
      destinationEntryId: input.destinationEntryId,
      reason: input.reason,
      authorityForDecision: input.authorityForDecision,
      nextDeadline: input.nextDeadline,
      nextResponsibleOffice: input.nextResponsibleOffice,
      relatedReferralId: input.relatedReferralId,
    };
    AuditTrailService.log(
      {
        subject: input.escalationId,
        subjectKind: "escalation",
        action: "escalation.human_decision_recorded",
        actor: input.decidedBy,
        payload: {
          decision: input.decision,
          reason: input.reason,
          authorityForDecision: input.authorityForDecision,
        },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    write({
      ...envelope,
      escalationTasks: (envelope.escalationTasks ?? []).map((e) =>
        e.escalationId === input.escalationId
          ? {
              ...e,
              state: "human_decision_recorded",
              humanDecision: decision,
              history: [
                ...e.history,
                { at: DemoTimeService.iso(), from: e.state, to: "human_decision_recorded", actor: input.decidedBy, reason: input.reason },
              ],
            }
          : e,
      ),
    });
    return decision;
  },

  /** Human reviewer confirms the chosen office acknowledged the case. */
  markRouteAcknowledged(input: { escalationId: string; actor: string }): EscalationTask | undefined {
    return this.transition({
      escalationId: input.escalationId,
      to: "receiving_authority_acknowledged",
      actor: input.actor,
      reason: "Receiving authority acknowledged the human-assigned route",
    });
  },

  /**
   * Convenience: compute repeated-transfer stats for the UI.
   */
  statsForApplication(envelope: StoreEnvelope, applicationId: string): {
    transfers: number;
    returns: number;
    destinations: string[];
    returnReasons: { reason: string; note?: string; at: string }[];
  } {
    const refs = (envelope.referrals ?? []).filter((r) => r.applicationId === applicationId);
    const transfers = refs.filter((r) => r.package.history.some((h) => h.action === "referral.sent"));
    const returns = refs.filter((r) => r.package.history.some((h) => h.toState === "returned"));
    const destinations = Array.from(new Set(refs.map((r) => r.package.receivingOffice)));
    const returnReasons = refs
      .filter((r) => r.package.returnReason)
      .map((r) => ({
        reason: r.package.returnReason!,
        note: r.package.returnNote,
        at: r.package.returnedAt ?? r.package.sentAt ?? "",
      }));
    return { transfers: transfers.length, returns: returns.length, destinations, returnReasons };
  },
};