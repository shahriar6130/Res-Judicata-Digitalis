/* ------------------------------------------------------------------ *
 *  ConversationalIntakeService — drives the T5 scripted assistant.
 *
 *  `nextTurn(...)` looks up the next step in the script, builds the
 *  utterance, appends it to the session, and (for caller turns)
 *  classifies the slot value. Falls into `uncertain=true` for
 *  categories the agent doesn't recognise.
 * ------------------------------------------------------------------ */

import type { IntakeSession, SlotKey, SlotValue } from "../types";
import { read } from "../persistence";
import {
  isKnownCategory,
  NEXT_STEP,
  T5_SCRIPT,
  T5Step,
  type T5Context,
} from "../assistants/t5.script";
import { IntakeSessionService } from "./intake-session.service";

export interface NextTurnInput {
  sessionId: string;
  lastUtterance?: { bn: string; en: string };
  step?: T5Step;
  actor: string;
}

function classify(slot: SlotKey, raw: string): SlotValue | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  if (slot === "category") {
    if (!isKnownCategory(text)) {
      return { value: text, confidence: "inferred", source: "caller" };
    }
    return { value: text.toLowerCase(), confidence: "stated", source: "caller" };
  }
  return { value: text, confidence: "stated", source: "caller" };
}

export const ConversationalIntakeService = {
  nextTurn(input: NextTurnInput): IntakeSession | undefined {
    const envelope = read();
    const session = envelope.sessions.find((s) => s.id === input.sessionId);
    if (!session) return undefined;

    const stepsTaken = inferStepsTaken(session);
    const nextStep = input.step ?? NEXT_STEP[stepsTaken[stepsTaken.length - 1] ?? "greeting"];
    const ctx: T5Context = {
      sessionId: input.sessionId,
      stepsTaken,
      uncertainSlots: [],
    };

    // Caller turn first (if provided), then T5 prompt.
    if (input.lastUtterance) {
      const slot = inferLastSlot(session, stepsTaken);
      const slotValue = slot ? classify(slot, input.lastUtterance.en) : undefined;
      IntakeSessionService.advance({
        sessionId: input.sessionId,
        speaker: "caller",
        text: input.lastUtterance,
        slot,
        slotValue,
        actor: input.actor,
      });
    }

    const t5 = T5_SCRIPT[nextStep](ctx);
    return IntakeSessionService.advance({
      sessionId: input.sessionId,
      speaker: "t5",
      text: t5.text,
      slot: t5.slot,
      actor: input.actor,
    });
  },

  markUncertain(sessionId: string, slot: SlotKey, actor: string): void {
    IntakeSessionService.advance({
      sessionId,
      speaker: "t5",
      text: {
        bn: "এই তথ্যে আমি নিশ্চিত নই—স্পষ্ট করা দরকার।",
        en: "I am not sure on this slot — clarification needed.",
      },
      slot,
      uncertain: true,
      actor,
    });
  },
};

function inferStepsTaken(session: IntakeSession): T5Step[] {
  const out: T5Step[] = ["greeting"];
  // Each T5 turn appends to the session; we approximate by counting
  // t5 turns: a fresh session is at greeting.
  const t5Turns = session.turns.filter((t) => t.speaker === "t5").length;
  const order: T5Step[] = [
    "greeting",
    "ask_for",
    "ask_category",
    "ask_date",
    "ask_office",
    "ask_safe_contact",
    "ask_verify",
    "readback",
    "done",
  ];
  for (let i = 0; i < Math.min(t5Turns, order.length); i += 1) {
    out.push(order[i]);
  }
  return out;
}

function inferLastSlot(session: IntakeSession, steps: T5Step[]): SlotKey | undefined {
  const last = steps[steps.length - 1];
  switch (last) {
    case "ask_for":
      return "caller_relation";
    case "ask_category":
      return "category";
    case "ask_date":
      return "incident_date";
    case "ask_office":
      return "office";
    case "ask_safe_contact":
      return "safe_contact_time";
    default:
      return undefined;
  }
}
