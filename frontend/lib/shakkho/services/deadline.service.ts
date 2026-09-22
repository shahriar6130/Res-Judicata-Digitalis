/* ------------------------------------------------------------------ *
 *  DeadlineService — computes referral deadlines and exposes overdue
 *  comparisons using DemoTimeService.now() so demo controls can advance
 *  past the acknowledgment deadline deterministically.
 *
 *  Defaults:
 *    acknowledgmentDeadline = now + 24h
 *    actionDeadline         = now + 72h
 *    escalationDeadline     = ackDeadline + 48h
 * ------------------------------------------------------------------ */

import type { ReferralDeadline, ReferralState } from "../types";
import { DemoTimeService } from "./demo-time.service";

const ONE_HOUR_MS = 60 * 60 * 1000;

export const DeadlineService = {
  compute(opts: {
    priority?: "standard" | "urgent" | "overdue";
    ackHours?: number;
    actionHours?: number;
  } = {}): ReferralDeadline {
    const ackHours = opts.ackHours ?? (opts.priority === "urgent" ? 8 : 24);
    const actionHours = opts.actionHours ?? (opts.priority === "urgent" ? 24 : 72);
    const now = DemoTimeService.now();
    const ack = now + ackHours * ONE_HOUR_MS;
    const action = ack + actionHours * ONE_HOUR_MS;
    return {
      acknowledgmentDeadline: new Date(ack).toISOString(),
      actionDeadline: new Date(action).toISOString(),
      escalationDeadline: new Date(action + 48 * ONE_HOUR_MS).toISOString(),
      computedAt: new Date(now).toISOString(),
    };
  },

  isOverdueAck(referral: { state: ReferralState; deadline: ReferralDeadline }): boolean {
    if (referral.state === "acknowledged" || referral.state === "accepted" ||
        referral.state === "completed" || referral.state === "superseded" ||
        referral.state === "withdrawn_by_authorized_user") return false;
    return DemoTimeService.now() > new Date(referral.deadline.acknowledgmentDeadline).getTime();
  },

  isOverdueAction(referral: { state: ReferralState; deadline: ReferralDeadline }): boolean {
    if (referral.state !== "accepted" && referral.state !== "action_in_progress") return false;
    return DemoTimeService.now() > new Date(referral.deadline.actionDeadline).getTime();
  },

  msUntilAck(deadline: ReferralDeadline): number {
    return new Date(deadline.acknowledgmentDeadline).getTime() - DemoTimeService.now();
  },

  msUntilAction(deadline: ReferralDeadline): number {
    return new Date(deadline.actionDeadline).getTime() - DemoTimeService.now();
  },
};