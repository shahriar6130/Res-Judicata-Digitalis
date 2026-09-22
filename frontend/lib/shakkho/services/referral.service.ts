/* ------------------------------------------------------------------ *
 *  ReferralService — the state machine and CRUD for referrals.
 *
 *  Referral state machine (per Prompt 7 spec §27):
 *    draft → package_review → authorized → sending → delivered →
 *    awaiting_acknowledgment → acknowledged → accepted →
 *    action_in_progress → completed
 *
 *  Branches: delivery_failed, information_requested, returned,
 *  overdue_acknowledgment, overdue_action, escalation_required,
 *  escalated, superseded, withdrawn_by_authorized_user.
 *
 *  Every transition appends a ReferralHistoryItem and writes an
 *  AuditEvent with subjectKind "referral".
 * ------------------------------------------------------------------ */

import type {
  ApplicationRecord,
  AuditEvent,
  Referral,
  ReferralHistoryItem,
  ReferralPackage,
  ReferralParty,
  ReferralPriority,
  ReferralReasonCategory,
  ReferralReturnReason,
  ReferralSensitivity,
  ReferralState,
  ReferralType,
  StoreEnvelope,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DeadlineService } from "./deadline.service";
import { DemoTimeService } from "./demo-time.service";

function makeId(prefix: string): string {
  return prefix + "-" + Math.random().toString(36).slice(2, 10);
}

const RULESET_VERSION = "R7-v0.1.0";

export const ReferralService = {
  list(envelope: StoreEnvelope): Referral[] {
    return envelope.referrals ?? [];
  },

  find(envelope: StoreEnvelope, referralId: string): Referral | undefined {
    return (envelope.referrals ?? []).find((r) => r.referralId === referralId);
  },

  byApplication(envelope: StoreEnvelope, applicationId: string): Referral[] {
    return (envelope.referrals ?? []).filter((r) => r.applicationId === applicationId);
  },

  createDraft(input: {
    applicationId: string;
    type: ReferralType;
    reasonCategory: ReferralReasonCategory;
    reason: string;
    expectedAction: string;
    priority: ReferralPriority;
    sensitivity: ReferralSensitivity;
    sendingOffice: string;
    receivingOffice: string;
    authorityDirectoryEntryId?: string;
    routingRecommendationId?: string;
    sendingOfficer: ReferralParty;
    escalationOwner: string;
    selectedHistoryIds?: string[];
    safeContactRuleIds?: string[];
    applicantNotificationRule?: ReferralPackage["applicantNotificationRule"];
    actor: string;
  }): Referral {
    const envelope = read();
    const referralId = makeId("ref");
    const pkg: ReferralPackage = {
      referralId,
      applicationId: input.applicationId,
      type: input.type,
      reasonCategory: input.reasonCategory,
      reason: input.reason,
      expectedAction: input.expectedAction,
      priority: input.priority,
      sensitivity: input.sensitivity,
      sendingOffice: input.sendingOffice,
      receivingOffice: input.receivingOffice,
      authorityDirectoryEntryId: input.authorityDirectoryEntryId,
      routingRecommendationId: input.routingRecommendationId,
      history: [],
      documentSelections: [],
      selectedHistoryIds: input.selectedHistoryIds ?? [],
      safeContactRuleIds: input.safeContactRuleIds ?? [],
      applicantNotificationRule: input.applicantNotificationRule ?? "safe_follow_up",
      sendingOfficer: input.sendingOfficer,
      deadline: DeadlineService.compute({ priority: input.priority }),
      escalationOwner: input.escalationOwner,
      state: "draft",
      createdAt: DemoTimeService.iso(),
      remindersSent: [],
      deliveryAttempts: [],
    };
    pkg.history.push(historyItem("referral.draft_created", input.actor, undefined, "draft", pkg, {}));
    const referral: Referral = { referralId, applicationId: input.applicationId, package: pkg };
    write({
      ...envelope,
      referrals: [...(envelope.referrals ?? []), referral],
    });
    AuditTrailService.log(
      {
        subject: referralId,
        subjectKind: "referral",
        action: "referral.draft_created",
        actor: input.actor,
        payload: { applicationId: input.applicationId, state: "draft" },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return referral;
  },

  transition(input: {
    referralId: string;
    to: ReferralState;
    actor: string;
    reason?: string;
    relatedTaskId?: string;
    payload?: Record<string, unknown>;
    extra?: Partial<ReferralPackage>;
  }): Referral | undefined {
    const envelope = read();
    let updated: Referral | undefined;
    const list = (envelope.referrals ?? []).map((r) => {
      if (r.referralId !== input.referralId) return r;
      const pkg: ReferralPackage = { ...r.package, ...input.extra, state: input.to };
      pkg.history = [
        ...pkg.history,
        historyItem(`referral.${input.to}`, input.actor, r.package.state, input.to, pkg, input.payload ?? {}),
      ];
      updated = { ...r, package: pkg };
      return updated;
    });
    write({ ...envelope, referrals: list });
    if (updated) {
      const audit = AuditTrailService.log(
        {
          subject: input.referralId,
          subjectKind: "referral",
          action: `referral.${input.to}`,
          actor: input.actor,
          payload: { from: updated.package.history[updated.package.history.length - 1]?.fromState, to: input.to, reason: input.reason, relatedTaskId: input.relatedTaskId },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
      updated.package.history[updated.package.history.length - 1].auditEventId = audit.id;
      write({ ...envelope, referrals: list.map((r) => (r.referralId === input.referralId ? updated! : r)) });
    }
    return updated;
  },

  recordHumanPriority(input: {
    referralId: string;
    decision: ReferralPriority;
    reason: string;
    informationReliedUpon: string;
    safetyAction: string;
    responsiblePerson: string;
    reviewDeadline: string;
    systemRecommendation: ReferralPriority;
    override: boolean;
    overrideReason?: string;
    actor: string;
  }): Referral | undefined {
    const envelope = read();
    let updated: Referral | undefined;
    const list = (envelope.referrals ?? []).map((r) => {
      if (r.referralId !== input.referralId) return r;
      const pkg: ReferralPackage = {
        ...r.package,
        priority: input.decision,
        humanPriorityDecision: {
          decidedAt: DemoTimeService.iso(),
          decidedBy: input.actor,
          decision: input.decision,
          reason: input.reason,
          informationReliedUpon: input.informationReliedUpon,
          safetyAction: input.safetyAction,
          responsiblePerson: input.responsiblePerson,
          reviewDeadline: input.reviewDeadline,
          systemRecommendation: input.systemRecommendation,
          override: input.override,
          overrideReason: input.overrideReason,
        },
        deadline: DeadlineService.compute({ priority: input.decision }),
      };
      pkg.history = [
        ...pkg.history,
        historyItem("referral.human_priority_recorded", input.actor, r.package.state, r.package.state, pkg, {
          decision: input.decision,
          override: input.override,
        }),
      ];
      updated = { ...r, package: pkg };
      return updated;
    });
    write({ ...envelope, referrals: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.referralId,
          subjectKind: "referral",
          action: "referral.human_priority_recorded",
          actor: input.actor,
          payload: { decision: input.decision, override: input.override },
        },
        { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },

  authorizePackage(input: { referralId: string; actor: string; confirmationFlags: string[] }): Referral | undefined {
    const requiredFlags = [
      "destination_reviewed",
      "minimum_necessary_selected",
      "sensitive_restricted",
      "legal_basis_checked",
      "expected_action_clear",
      "deadline_appropriate",
      "citizen_safe_communication_configured",
    ];
    const missing = requiredFlags.filter((f) => !input.confirmationFlags.includes(f));
    if (missing.length > 0) {
      throw new Error("Authorisation incomplete: " + missing.join(", "));
    }
    return this.transition({
      referralId: input.referralId,
      to: "authorized",
      actor: input.actor,
      reason: "Authorized by sending officer",
      payload: { confirmationFlags: input.confirmationFlags },
    });
  },

  send(input: { referralId: string; actor: string; operationId: string }): Referral | undefined {
    const envelope = read();
    const ref = (envelope.referrals ?? []).find((r) => r.referralId === input.referralId);
    if (!ref) return undefined;
    const audit = AuditTrailService.log(
      {
        subject: input.referralId,
        subjectKind: "referral",
        action: "referral.sent",
        actor: input.actor,
        payload: { operationId: input.operationId, sendingOffice: ref.package.sendingOffice, receivingOffice: ref.package.receivingOffice },
      },
      { kind: "sms", simulatedAt: DemoTimeService.iso() },
    );
    return this.transition({
      referralId: input.referralId,
      to: "sending",
      actor: input.actor,
      reason: "Sent through Secure Referral Exchange Simulator",
      payload: { operationId: input.operationId, auditEventId: audit.id },
      extra: {
        sentAt: DemoTimeService.iso(),
        operationId: input.operationId,
        integrityHash: "sha256-" + Math.random().toString(36).slice(2, 18).padEnd(16, "0"),
        deliveryAttempts: [
          ...ref.package.deliveryAttempts,
          { operationId: input.operationId, at: DemoTimeService.iso(), outcome: "sent" },
        ],
      },
    });
  },

  markDelivered(input: { referralId: string; actor: string; operationId: string; outcome: string; message?: string }): Referral | undefined {
    const envelope = read();
    const ref = (envelope.referrals ?? []).find((r) => r.referralId === input.referralId);
    if (!ref) return undefined;
    const nextState: ReferralState = input.outcome === "delivered_successfully" ? "awaiting_acknowledgment" : "delivery_failed";
    AuditTrailService.log(
      {
        subject: input.referralId,
        subjectKind: "referral",
        action: `referral.delivery_${input.outcome}`,
        actor: input.actor,
        payload: { operationId: input.operationId, message: input.message },
      },
      { kind: "sms", simulatedAt: DemoTimeService.iso() },
    );
    return this.transition({
      referralId: input.referralId,
      to: nextState,
      actor: input.actor,
      reason: `Delivery outcome: ${input.outcome}`,
      payload: { operationId: input.operationId, message: input.message },
      extra: {
        deliveredAt: nextState === "awaiting_acknowledgment" ? DemoTimeService.iso() : ref.package.deliveredAt,
      },
    });
  },

  acknowledge(input: { referralId: string; actor: string; receivingOffice: string; note?: string }): Referral | undefined {
    AuditTrailService.log(
      {
        subject: input.referralId,
        subjectKind: "referral",
        action: "referral.acknowledged",
        actor: input.actor,
        payload: { receivingOffice: input.receivingOffice, note: input.note },
      },
      { kind: "voice", simulatedAt: DemoTimeService.iso() },
    );
    return this.transition({
      referralId: input.referralId,
      to: "acknowledged",
      actor: input.actor,
      reason: `Acknowledged by ${input.receivingOffice}`,
      payload: { receivingOffice: input.receivingOffice, note: input.note },
      extra: { acknowledgedAt: DemoTimeService.iso(), acknowledgedBy: input.actor },
    });
  },

  accept(input: { referralId: string; actor: string; receivingOffice: string; receivingOfficer?: ReferralParty }): Referral | undefined {
    AuditTrailService.log(
      {
        subject: input.referralId,
        subjectKind: "referral",
        action: "referral.accepted",
        actor: input.actor,
        payload: { receivingOffice: input.receivingOffice },
      },
      { kind: "voice", simulatedAt: DemoTimeService.iso() },
    );
    return this.transition({
      referralId: input.referralId,
      to: "accepted",
      actor: input.actor,
      reason: `Accepted by ${input.receivingOffice}`,
      payload: { receivingOffice: input.receivingOffice },
      extra: { acceptedAt: DemoTimeService.iso(), acceptedBy: input.actor, receivingOfficer: input.receivingOfficer },
    });
  },

  recordReturn(input: { referralId: string; actor: string; reason: ReferralReturnReason; note?: string }): Referral | undefined {
    AuditTrailService.log(
      {
        subject: input.referralId,
        subjectKind: "referral",
        action: "referral.returned",
        actor: input.actor,
        payload: { reason: input.reason, note: input.note },
      },
      { kind: "voice", simulatedAt: DemoTimeService.iso() },
    );
    return this.transition({
      referralId: input.referralId,
      to: "returned",
      actor: input.actor,
      reason: `Returned: ${input.reason}`,
      payload: { reason: input.reason, note: input.note },
      extra: {
        returnedAt: DemoTimeService.iso(),
        returnedBy: input.actor,
        returnReason: input.reason,
        returnNote: input.note,
      },
    });
  },

  requestMissingInformation(input: { referralId: string; actor: string; note: string }): Referral | undefined {
    const envelope = read();
    const ref = (envelope.referrals ?? []).find((r) => r.referralId === input.referralId);
    if (!ref) return undefined;
    AuditTrailService.log(
      {
        subject: input.referralId,
        subjectKind: "referral",
        action: "referral.missing_information_requested",
        actor: input.actor,
        payload: { note: input.note },
      },
      { kind: "voice", simulatedAt: DemoTimeService.iso() },
    );
    return this.transition({
      referralId: input.referralId,
      to: "information_requested",
      actor: input.actor,
      reason: "Missing information requested",
      payload: { note: input.note },
      extra: {
        missingInformationRequest: {
          requestedAt: DemoTimeService.iso(),
          requestedBy: input.actor,
          note: input.note,
        },
      },
    });
  },

  assignReceivingOfficer(input: { referralId: string; officer: ReferralParty; actor: string }): Referral | undefined {
    AuditTrailService.log(
      {
        subject: input.referralId,
        subjectKind: "referral",
        action: "referral.receiving_officer_assigned",
        actor: input.actor,
        payload: { officerName: input.officer.name, office: input.officer.office },
      },
      { kind: "voice", simulatedAt: DemoTimeService.iso() },
    );
    return this.transition({
      referralId: input.referralId,
      to: "action_in_progress",
      actor: input.actor,
      reason: `Receiving officer assigned: ${input.officer.name}`,
      payload: { officerName: input.officer.name },
      extra: { receivingOfficer: input.officer },
    });
  },

  recordFirstAction(input: { referralId: string; actor: string; note: string }): Referral | undefined {
    AuditTrailService.log(
      {
        subject: input.referralId,
        subjectKind: "referral",
        action: "referral.first_action_recorded",
        actor: input.actor,
        payload: { note: input.note },
      },
      { kind: "voice", simulatedAt: DemoTimeService.iso() },
    );
    return this.transition({
      referralId: input.referralId,
      to: "action_in_progress",
      actor: input.actor,
      reason: "First action recorded",
      payload: { note: input.note },
      extra: { firstAction: { recordedAt: DemoTimeService.iso(), recordedBy: input.actor, note: input.note } },
    });
  },

  markCompleted(input: { referralId: string; actor: string; note?: string }): Referral | undefined {
    AuditTrailService.log(
      {
        subject: input.referralId,
        subjectKind: "referral",
        action: "referral.completed",
        actor: input.actor,
        payload: { note: input.note },
      },
      { kind: "voice", simulatedAt: DemoTimeService.iso() },
    );
    return this.transition({
      referralId: input.referralId,
      to: "completed",
      actor: input.actor,
      reason: input.note ?? "Completed",
      extra: { completedAt: DemoTimeService.iso() },
    });
  },

  supersede(input: { referralId: string; supersededByReferralId: string; actor: string; reason: string }): Referral | undefined {
    AuditTrailService.log(
      {
        subject: input.referralId,
        subjectKind: "referral",
        action: "referral.superseded",
        actor: input.actor,
        payload: { supersededByReferralId: input.supersededByReferralId, reason: input.reason },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return this.transition({
      referralId: input.referralId,
      to: "superseded",
      actor: input.actor,
      reason: `Superseded by ${input.supersededByReferralId}: ${input.reason}`,
      extra: { supersededByReferralId: input.supersededByReferralId },
    });
  },

  withdraw(input: { referralId: string; actor: string; reason: string }): Referral | undefined {
    AuditTrailService.log(
      {
        subject: input.referralId,
        subjectKind: "referral",
        action: "referral.withdrawn",
        actor: input.actor,
        payload: { reason: input.reason },
      },
      { kind: "officer_lookup", simulatedAt: DemoTimeService.iso() },
    );
    return this.transition({
      referralId: input.referralId,
      to: "withdrawn_by_authorized_user",
      actor: input.actor,
      reason: input.reason,
      extra: { withdrawnAt: DemoTimeService.iso(), withdrawnBy: input.actor, withdrawalReason: input.reason },
    });
  },

  recordReminder(input: { referralId: string; actor: string; outcome: "sent" | "delivered" | "undeliverable" }): Referral | undefined {
    const envelope = read();
    let updated: Referral | undefined;
    const list = (envelope.referrals ?? []).map((r) => {
      if (r.referralId !== input.referralId) return r;
      const pkg: ReferralPackage = {
        ...r.package,
        remindersSent: [...r.package.remindersSent, { at: DemoTimeService.iso(), by: input.actor, outcome: input.outcome }],
      };
      pkg.history = [
        ...pkg.history,
        historyItem("referral.reminder_sent", input.actor, r.package.state, r.package.state, pkg, { outcome: input.outcome }),
      ];
      updated = { ...r, package: pkg };
      return updated;
    });
    write({ ...envelope, referrals: list });
    if (updated) {
      AuditTrailService.log(
        {
          subject: input.referralId,
          subjectKind: "referral",
          action: "referral.reminder_sent",
          actor: input.actor,
          payload: { outcome: input.outcome },
        },
        { kind: "sms", simulatedAt: DemoTimeService.iso() },
      );
    }
    return updated;
  },

  /** Counters used by the dashboard — always derived. */
  counters(envelope: StoreEnvelope): {
    awaitingAcknowledgment: number;
    acknowledgedAwaitingAction: number;
    returned: number;
    overdueAcknowledgment: number;
    overdueAction: number;
    drafts: number;
    completed: number;
    escalated: number;
  } {
    const refs = envelope.referrals ?? [];
    let awaitingAcknowledgment = 0;
    let acknowledgedAwaitingAction = 0;
    let returned = 0;
    let overdueAcknowledgment = 0;
    let overdueAction = 0;
    let drafts = 0;
    let completed = 0;
    let escalated = 0;
    for (const r of refs) {
      const s = r.package.state;
      if (s === "awaiting_acknowledgment") awaitingAcknowledgment++;
      if (s === "acknowledged" || s === "accepted") acknowledgedAwaitingAction++;
      if (s === "returned" || s === "information_requested") returned++;
      if (s === "overdue_acknowledgment") overdueAcknowledgment++;
      if (s === "overdue_action") overdueAction++;
      if (s === "draft" || s === "package_review" || s === "authorized" || s === "sending") drafts++;
      if (s === "completed") completed++;
      if (s === "escalated" || s === "escalation_required") escalated++;
    }
    return { awaitingAcknowledgment, acknowledgedAwaitingAction, returned, overdueAcknowledgment, overdueAction, drafts, completed, escalated };
  },

  /** Mark overdue references by transitioning their state. Idempotent. */
  recalculateOverdue(actor = "system"): void {
    const envelope = read();
    const list = (envelope.referrals ?? []).map((r) => {
      const overAck = DeadlineService.isOverdueAck(r.package);
      const overAct = DeadlineService.isOverdueAction(r.package);
      if (r.package.state === "awaiting_acknowledgment" && overAck) {
        const audit = AuditTrailService.log(
          {
            subject: r.referralId,
            subjectKind: "referral",
            action: "referral.overdue_acknowledgment",
            actor,
            payload: { ackDeadline: r.package.deadline.acknowledgmentDeadline },
          },
          { kind: "system", simulatedAt: DemoTimeService.iso() },
        );
        const pkg: ReferralPackage = {
          ...r.package,
          state: "overdue_acknowledgment",
          history: [
            ...r.package.history,
            historyItem("referral.overdue_acknowledgment", actor, r.package.state, "overdue_acknowledgment", r.package, {
              auditEventId: audit.id,
            }),
          ],
        };
        return { ...r, package: pkg };
      }
      if (
        (r.package.state === "accepted" || r.package.state === "action_in_progress") &&
        overAct
      ) {
        const audit = AuditTrailService.log(
          {
            subject: r.referralId,
            subjectKind: "referral",
            action: "referral.overdue_action",
            actor,
            payload: { actionDeadline: r.package.deadline.actionDeadline },
          },
          { kind: "system", simulatedAt: DemoTimeService.iso() },
        );
        const pkg: ReferralPackage = {
          ...r.package,
          state: "overdue_action",
          history: [
            ...r.package.history,
            historyItem("referral.overdue_action", actor, r.package.state, "overdue_action", r.package, {
              auditEventId: audit.id,
            }),
          ],
        };
        return { ...r, package: pkg };
      }
      return r;
    });
    write({ ...envelope, referrals: list });
  },

  /** History events for a referral, derived from package.history. */
  historyFor(referral: Referral): ReferralHistoryItem[] {
    return referral.package.history;
  },

  /** Audit events touching a referral, derived from store.audit. */
  auditFor(envelope: StoreEnvelope, referralId: string): AuditEvent[] {
    return envelope.audit.filter(
      (a) => a.subject === referralId || a.payload?.referralId === referralId,
    );
  },
};

function historyItem(
  action: string,
  actor: string,
  from: ReferralState | undefined,
  to: ReferralState,
  pkg: ReferralPackage,
  payload: Record<string, unknown>,
): ReferralHistoryItem {
  return {
    id: makeId("hi"),
    occurredAt: DemoTimeService.iso(),
    actor,
    role: actor,
    action,
    fromState: from,
    toState: to,
    payload,
    rulesetVersion: RULESET_VERSION,
  };
}
