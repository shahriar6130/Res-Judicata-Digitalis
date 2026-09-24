"use strict";
/* ------------------------------------------------------------------ *
 *  AuditTrailService — append-only event log.
 *
 *  Every state-changing service call funnels through `log(...)` so the
 *  audit trail is the single source of truth for "who did what, when,
 *  and which simulation produced it".
 * ------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditTrailService = void 0;
const persistence_1 = require("../persistence");
function makeId() {
    return "aud-" + Math.random().toString(36).slice(2, 10);
}
exports.AuditTrailService = {
    log(partial, simulation) {
        const event = {
            ...partial,
            id: makeId(),
            occurredAt: new Date().toISOString(),
            simulation: simulation ?? { kind: "voice", simulatedAt: new Date().toISOString() },
        };
        const envelope = (0, persistence_1.read)();
        (0, persistence_1.write)({ ...envelope, audit: [...envelope.audit, event] });
        return event;
    },
    list(envelope) {
        return [...envelope.audit];
    },
    listFor(envelope, subject) {
        return envelope.audit.filter((a) => a.subject === subject);
    },
};
