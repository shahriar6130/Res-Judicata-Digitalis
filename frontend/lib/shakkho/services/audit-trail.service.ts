/* ------------------------------------------------------------------ *
 *  AuditTrailService — append-only event log.
 *
 *  Every state-changing service call funnels through `log(...)` so the
 *  audit trail is the single source of truth for "who did what, when,
 *  and which simulation produced it".
 * ------------------------------------------------------------------ */

import type { AuditEvent, SimulationMetadata, StoreEnvelope } from "../types";
import { read, write } from "../persistence";

function makeId(): string {
  return "aud-" + Math.random().toString(36).slice(2, 10);
}

export const AuditTrailService = {
  log(
    partial: Omit<AuditEvent, "id" | "occurredAt" | "simulation">,
    simulation?: SimulationMetadata,
  ): AuditEvent {
    const event: AuditEvent = {
      ...partial,
      id: makeId(),
      occurredAt: new Date().toISOString(),
      simulation: simulation ?? { kind: "voice", simulatedAt: new Date().toISOString() },
    };
    const envelope = read();
    write({ ...envelope, audit: [...envelope.audit, event] });
    return event;
  },

  list(envelope: StoreEnvelope): AuditEvent[] {
    return [...envelope.audit];
  },

  listFor(envelope: StoreEnvelope, subject: string): AuditEvent[] {
    return envelope.audit.filter((a) => a.subject === subject);
  },
};
