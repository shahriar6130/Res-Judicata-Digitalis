/* ------------------------------------------------------------------ *
 *  DemoTimeService — controls a forward-only time offset used to
 *  demonstrate deadline / escalation behaviour without faking the
 *  system clock.
 *
 *  Real `Date.now()` keeps advancing. The offset is ADDED to it for
 *  any computed deadline comparisons in the rest of the referral
 *  subsystem, so `Reset` simply zeros the offset.
 * ------------------------------------------------------------------ */

import type { StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";

const ONE_HOUR_MS = 60 * 60 * 1000;

export const DemoTimeService = {
  now(envelope?: StoreEnvelope): number {
    const off = (envelope ?? read()).demoTimeOffsetMs ?? 0;
    return Date.now() + off;
  },

  iso(envelope?: StoreEnvelope): string {
    return new Date(this.now(envelope)).toISOString();
  },

  /** Add an offset and audit it. */
  advance(hours: number, actor: string): number {
    const envelope = read();
    const next = (envelope.demoTimeOffsetMs ?? 0) + hours * ONE_HOUR_MS;
    write({ ...envelope, demoTimeOffsetMs: next });
    AuditTrailService.log(
      {
        subject: "system",
        subjectKind: "system",
        action: "demo_time.advanced",
        actor,
        payload: { addedHours: hours, totalOffsetMs: next },
      },
      { kind: "voice", simulatedAt: new Date().toISOString() },
    );
    return next;
  },

  reset(actor: string): void {
    const envelope = read();
    write({ ...envelope, demoTimeOffsetMs: 0 });
    AuditTrailService.log(
      {
        subject: "system",
        subjectKind: "system",
        action: "demo_time.reset",
        actor,
      },
      { kind: "voice", simulatedAt: new Date().toISOString() },
    );
  },
};