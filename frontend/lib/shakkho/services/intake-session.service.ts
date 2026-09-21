/* ------------------------------------------------------------------ *
 *  IntakeSessionService — state machine for `IntakeSession`.
 *
 *  Every `advance(...)` call appends a turn, populates facts, and
 *  writes an audit event. `requestHandoff(...)` creates a
 *  `HumanHandoff` and forwards to the DLAO bridge when the target
 *  is `dlao`.
 * ------------------------------------------------------------------ */

import type {
  IntakeSession,
  IntakeStatus,
  ProvenanceEntry,
  SlotKey,
  SlotValue,
  StoreEnvelope,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { HumanHandoffService } from "./human-handoff.service";

function makeId(): string {
  return "ses-" + Math.random().toString(36).slice(2, 10);
}

export const IntakeSessionService = {
  list(envelope: StoreEnvelope): IntakeSession[] {
    return [...envelope.sessions];
  },

  find(envelope: StoreEnvelope, sessionId: string): IntakeSession | undefined {
    return envelope.sessions.find((s) => s.id === sessionId);
  },

  start(input: { actor: string; applicationId?: string }): IntakeSession {
    const now = new Date().toISOString();
    const session: IntakeSession = {
      id: makeId(),
      applicationId: input.applicationId,
      status: "active",
      channel: "helpline",
      turns: [],
      facts: {},
      startedAt: now,
      voiceAvailable: true,
    };
    const envelope = read();
    write({ ...envelope, sessions: [...envelope.sessions, session] });
    AuditTrailService.log(
      {
        subject: input.applicationId ?? session.id,
        subjectKind: "intake",
        action: "session.started",
        actor: input.actor,
      },
      { kind: "voice", simulatedAt: now },
    );
    return session;
  },

  advance(input: {
    sessionId: string;
    speaker: "t5" | "caller";
    text: { bn: string; en: string };
    slot?: SlotKey;
    slotValue?: SlotValue;
    uncertain?: boolean;
    actor: string;
  }): IntakeSession | undefined {
    const now = new Date().toISOString();
    const envelope = read();
    let updated: IntakeSession | undefined;
    const sessions = envelope.sessions.map((s) => {
      if (s.id !== input.sessionId) return s;
      const turn = {
        speaker: input.speaker,
        text: input.text,
        slot: input.slot,
        uncertain: input.uncertain,
        spokenAt: now,
      };
      const facts = input.slot && input.slotValue
        ? { ...s.facts, [input.slot]: input.slotValue }
        : s.facts;
      updated = { ...s, turns: [...s.turns, turn], facts, status: "in_progress" };
      return updated;
    });
    write({ ...envelope, sessions });
    if (updated) {
      const provenance: ProvenanceEntry | undefined =
        input.slot && input.slotValue
          ? {
              slot: input.slot,
              source: input.slotValue.source,
              confidence: input.slotValue.confidence,
              recordedAt: now,
              by: input.actor,
            }
          : undefined;
      AuditTrailService.log(
        {
          subject: updated.applicationId ?? updated.id,
          subjectKind: "intake",
          action: input.uncertain ? "session.uncertain" : "session.turn",
          actor: input.actor,
          payload: provenance ? { slot: provenance.slot, value: input.slotValue?.value } : undefined,
        },
        { kind: "voice", simulatedAt: now },
      );
    }
    return updated;
  },

  setStatus(
    sessionId: string,
    status: IntakeStatus,
    actor: string,
  ): IntakeSession | undefined {
    const envelope = read();
    let updated: IntakeSession | undefined;
    const sessions = envelope.sessions.map((s) => {
      if (s.id !== sessionId) return s;
      const next: IntakeSession = {
        ...s,
        status,
        ...(status === "interrupted" ? { interruptedAt: new Date().toISOString() } : {}),
      };
      updated = next;
      return next;
    });
    write({ ...envelope, sessions });
    if (updated) {
      AuditTrailService.log(
        {
          subject: updated.applicationId ?? updated.id,
          subjectKind: "intake",
          action: `session.status.${status}`,
          actor,
        },
        { kind: "voice", simulatedAt: new Date().toISOString() },
      );
    }
    return updated;
  },

  resume(sessionId: string, actor: string): IntakeSession | undefined {
    return this.setStatus(sessionId, "active", actor);
  },

  interrupt(sessionId: string, actor: string): IntakeSession | undefined {
    return this.setStatus(sessionId, "interrupted", actor);
  },

  requestHandoff(input: {
    sessionId: string;
    reason:
      | "voice_failure"
      | "unsafe_answer"
      | "rep_out_of_scope"
      | "uncertain"
      | "identity_mismatch"
      | "accessibility_specialist"
      | "dlao"
      | "general"
      | "press_0"
      | "urgency_urgent"
      | "verification_needed";
    targetRole: HumanHandoffInput["targetRole"];
    actor: string;
  }): void {
    const envelope = read();
    const session = envelope.sessions.find((s) => s.id === input.sessionId);
    if (!session) return;
    HumanHandoffService.create({
      applicationId: session.applicationId,
      intakeSessionId: session.id,
      reason: input.reason,
      targetRole: input.targetRole,
      actor: input.actor,
    });
    this.setStatus(session.id, "handoff_required", input.actor);
  },
};

type HumanHandoffInput = Parameters<typeof HumanHandoffService.create>[0];
