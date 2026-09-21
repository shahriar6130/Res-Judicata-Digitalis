/* ------------------------------------------------------------------ *
 *  HumanIntakeService — tracks the human-agent continuation of a
 *  16699 intake. Lives in the helpline envelope so the persistent
 *  call bar + agent workspace see the same state.
 * ------------------------------------------------------------------ */

import type {
  HumanIntake,
  HumanHandoff,
  StoreEnvelope,
  IntakeSession,
  SlotKey,
} from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";

function makeId(): string {
  return "hi-" + Math.random().toString(36).slice(2, 10);
}

export const HumanIntakeService = {
  list(envelope: StoreEnvelope): HumanIntake[] {
    return [...envelope.humanIntakes];
  },

  findFor(envelope: StoreEnvelope, sessionId: string): HumanIntake | undefined {
    return envelope.humanIntakes.find((h) => h.sessionId === sessionId);
  },

  pickUp(input: {
    sessionId: string;
    applicationId: string;
    agent: string;
    handoff: HumanHandoff;
  }): HumanIntake {
    const envelope = read();
    const existing = this.findFor(envelope, input.sessionId);
    if (existing) return existing;

    const intake: HumanIntake = {
      id: makeId(),
      sessionId: input.sessionId,
      applicationId: input.applicationId,
      agent: input.agent,
      pickedUpAt: new Date().toISOString(),
      status: "active",
      notes: [],
      factOverrides: [],
      acknowledgedHandoffId: input.handoff.id,
    };
    write({
      ...envelope,
      humanIntakes: [...envelope.humanIntakes, intake],
    });
    AuditTrailService.log(
      {
        subject: input.applicationId ?? input.sessionId,
        subjectKind: "system",
        action: "human_intake.picked_up",
        actor: input.agent,
        payload: { handoffId: input.handoff.id },
      },
      { kind: "voice", simulatedAt: intake.pickedUpAt },
    );
    return intake;
  },

  note(input: {
    sessionId: string;
    agent: string;
    text: { bn: string; en: string };
  }): HumanIntake | undefined {
    const envelope = read();
    let updated: HumanIntake | undefined;
    const humanIntakes = envelope.humanIntakes.map((h) => {
      if (h.sessionId !== input.sessionId) return h;
      updated = {
        ...h,
        notes: [...h.notes, input.text],
      };
      return updated;
    });
    write({ ...envelope, humanIntakes });
    return updated;
  },

  override(input: {
    sessionId: string;
    agent: string;
    slot: SlotKey;
    value: string;
  }): HumanIntake | undefined {
    const envelope = read();
    let updated: HumanIntake | undefined;
    const humanIntakes = envelope.humanIntakes.map((h) => {
      if (h.sessionId !== input.sessionId) return h;
      updated = {
        ...h,
        factOverrides: [...h.factOverrides, { slot: input.slot, value: input.value }],
      };
      return updated;
    });
    write({ ...envelope, humanIntakes });
    if (updated) {
      AuditTrailService.log(
        {
          subject: updated.applicationId ?? updated.sessionId,
          subjectKind: "intake",
          action: `human_intake.override.${input.slot}`,
          actor: input.agent,
          payload: { value: input.value },
        },
        { kind: "voice", simulatedAt: new Date().toISOString() },
      );
    }
    return updated;
  },

  complete(sessionId: string, agent: string): HumanIntake | undefined {
    const envelope = read();
    let updated: HumanIntake | undefined;
    const humanIntakes = envelope.humanIntakes.map((h) => {
      if (h.sessionId !== sessionId) return h;
      updated = { ...h, status: "completed" };
      return updated;
    });
    write({ ...envelope, humanIntakes });
    if (updated) {
      AuditTrailService.log(
        {
          subject: updated.applicationId ?? updated.sessionId,
          subjectKind: "system",
          action: "human_intake.completed",
          actor: agent,
        },
        { kind: "voice", simulatedAt: new Date().toISOString() },
      );
    }
    return updated;
  },
};

export function activeSession(envelope: StoreEnvelope): IntakeSession | undefined {
  return envelope.sessions.find(
    (s) =>
      s.status === "active" ||
      s.status === "in_progress" ||
      s.status === "ai_handled" ||
      s.status === "human_intake_active" ||
      s.status === "handoff_acknowledged",
  );
}
