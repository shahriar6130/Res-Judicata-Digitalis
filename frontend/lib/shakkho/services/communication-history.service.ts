/* ------------------------------------------------------------------ *
 *  CommunicationHistoryService — append-only log of voice / sms / ivr
 *  events with simulation metadata.
 * ------------------------------------------------------------------ */

import type { CommunicationEvent, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";

function makeId(): string {
  return "com-" + Math.random().toString(36).slice(2, 10);
}

export const CommunicationHistoryService = {
  list(envelope: StoreEnvelope): CommunicationEvent[] {
    return [...envelope.communications];
  },

  forSession(envelope: StoreEnvelope, sessionId: string): CommunicationEvent[] {
    return envelope.communications.filter((c) => c.sessionId === sessionId);
  },

  append(input: {
    sessionId: string;
    channel: CommunicationEvent["channel"];
    direction: CommunicationEvent["direction"];
    actor: string;
    body: { bn: string; en: string };
  }): CommunicationEvent {
    const event: CommunicationEvent = {
      id: makeId(),
      ...input,
      simulated: true,
      occurredAt: new Date().toISOString(),
    };
    const envelope = read();
    write({ ...envelope, communications: [...envelope.communications, event] });
    AuditTrailService.log(
      {
        subject: input.sessionId,
        subjectKind: "communication",
        action: `comm.${input.channel}.${input.direction}`,
        actor: input.actor,
      },
      { kind: input.channel === "sms" ? "sms" : input.channel === "ivr" ? "ivr" : "voice", simulatedAt: event.occurredAt },
    );
    return event;
  },

  smsSimulated(input: {
    sessionId: string;
    body: { bn: string; en: string };
    actor: string;
  }): CommunicationEvent {
    return this.append({
      sessionId: input.sessionId,
      channel: "sms",
      direction: "outbound",
      actor: input.actor,
      body: input.body,
    });
  },
};
