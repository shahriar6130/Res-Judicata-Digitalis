/* ------------------------------------------------------------------ *
 *  SafeContactPlanService — explicit safe-contact plan authored by
 *  DLAO / human agent. Required before any disclosure (address,
 *  call dispatch, etc).
 *
 *  Plans include preferred time, channel, witness, alternate time,
 *  risk note, and a verifiedBy + verifiedAt audit hook.
 * ------------------------------------------------------------------ */

import type { SafeContactPlan, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";

function makeId(): string {
  return "scp-" + Math.random().toString(36).slice(2, 10);
}

export const SafeContactPlanService = {
  list(envelope: StoreEnvelope): SafeContactPlan[] {
    return [...envelope.safeContactPlans];
  },

  find(envelope: StoreEnvelope, applicationId: string): SafeContactPlan | undefined {
    return envelope.safeContactPlans.find((s) => s.applicationId === applicationId);
  },

  upsert(input: {
    applicationId: string;
    preferredTime: { bn: string; en: string };
    channel: SafeContactPlan["channel"];
    witness?: string;
    alternateTime?: { bn: string; en: string };
    riskNote?: { bn: string; en: string };
    actor: string;
  }): SafeContactPlan {
    const envelope = read();
    const existing = this.find(envelope, input.applicationId);
    const now = new Date().toISOString();
    const basePlan: SafeContactPlan = {
      applicationId: input.applicationId,
      preferredTime: input.preferredTime,
      channel: input.channel,
      witness: input.witness,
      alternateTime: input.alternateTime,
      riskNote: input.riskNote,
      cleared: false,
    };
    const plan: SafeContactPlan = existing
      ? { ...existing, ...basePlan }
      : { ...basePlan };
    const list = existing
      ? envelope.safeContactPlans.map((s) =>
          s.applicationId === input.applicationId ? plan : s,
        )
      : [...envelope.safeContactPlans, plan];
    write({ ...envelope, safeContactPlans: list });
    AuditTrailService.log(
      {
        subject: input.applicationId,
        subjectKind: "application",
        action: existing ? "safe_contact_plan.updated" : "safe_contact_plan.created",
        actor: input.actor,
        payload: { channel: input.channel },
      },
      { kind: "voice", simulatedAt: now },
    );
    return plan;
  },

  verify(input: { applicationId: string; actor: string }): SafeContactPlan | undefined {
    const envelope = read();
    const existing = this.find(envelope, input.applicationId);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    const plan: SafeContactPlan = {
      ...existing,
      cleared: true,
      verifiedAt: now,
      verifiedBy: input.actor,
    };
    write({
      ...envelope,
      safeContactPlans: envelope.safeContactPlans.map((s) =>
        s.applicationId === input.applicationId ? plan : s,
      ),
    });
    AuditTrailService.log(
      {
        subject: input.applicationId,
        subjectKind: "application",
        action: "safe_contact_plan.verified",
        actor: input.actor,
      },
      { kind: "voice", simulatedAt: now },
    );
    return plan;
  },

  fail(input: {
    applicationId: string;
    actor: string;
    reason: { bn: string; en: string };
  }): SafeContactPlan | undefined {
    const envelope = read();
    const existing = this.find(envelope, input.applicationId);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    const plan: SafeContactPlan = {
      ...existing,
      cleared: false,
      riskNote: input.reason,
    };
    write({
      ...envelope,
      safeContactPlans: envelope.safeContactPlans.map((s) =>
        s.applicationId === input.applicationId ? plan : s,
      ),
    });
    AuditTrailService.log(
      {
        subject: input.applicationId,
        subjectKind: "application",
        action: "safe_contact_plan.failed",
        actor: input.actor,
        payload: { reason: input.reason },
      },
      { kind: "voice", simulatedAt: now },
    );
    return plan;
  },
};

/** Helper for default ids. */
export function newPlanId(): string {
  return makeId();
}
