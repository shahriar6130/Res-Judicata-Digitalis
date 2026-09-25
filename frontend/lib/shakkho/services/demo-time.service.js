"use strict";
/* ------------------------------------------------------------------ *
 *  DemoTimeService — controls a forward-only time offset used to
 *  demonstrate deadline / escalation behaviour without faking the
 *  system clock.
 *
 *  Real `Date.now()` keeps advancing. The offset is ADDED to it for
 *  any computed deadline comparisons in the rest of the referral
 *  subsystem, so `Reset` simply zeros the offset.
 * ------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemoTimeService = void 0;
const persistence_1 = require("../persistence");
const audit_trail_service_1 = require("./audit-trail.service");
const ONE_HOUR_MS = 60 * 60 * 1000;
exports.DemoTimeService = {
    now(envelope) {
        const off = (envelope ?? (0, persistence_1.read)()).demoTimeOffsetMs ?? 0;
        return Date.now() + off;
    },
    iso(envelope) {
        return new Date(this.now(envelope)).toISOString();
    },
    /** Add an offset and audit it. */
    advance(hours, actor) {
        const envelope = (0, persistence_1.read)();
        const next = (envelope.demoTimeOffsetMs ?? 0) + hours * ONE_HOUR_MS;
        (0, persistence_1.write)({ ...envelope, demoTimeOffsetMs: next });
        audit_trail_service_1.AuditTrailService.log({
            subject: "system",
            subjectKind: "system",
            action: "demo_time.advanced",
            actor,
            payload: { addedHours: hours, totalOffsetMs: next },
        }, { kind: "voice", simulatedAt: new Date().toISOString() });
        return next;
    },
    reset(actor) {
        const envelope = (0, persistence_1.read)();
        (0, persistence_1.write)({ ...envelope, demoTimeOffsetMs: 0 });
        audit_trail_service_1.AuditTrailService.log({
            subject: "system",
            subjectKind: "system",
            action: "demo_time.reset",
            actor,
        }, { kind: "voice", simulatedAt: new Date().toISOString() });
    },
};
