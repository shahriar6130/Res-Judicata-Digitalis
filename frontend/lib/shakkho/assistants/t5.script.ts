/* ------------------------------------------------------------------ *
 *  T5 scripted assistant — deterministic Bangla intake decision tree.
 *
 *  No LLM call. Every utterance is a fixed string. The "next turn" is
 *  chosen by reading the latest caller utterance / slot, never by
 *  guessing intent.
 *
 *  Steps in order:
 *    1. greeting
 *    2. ask_for              (self_or_representative)
 *    3. ask_category
 *    4. ask_date
 *    5. ask_office
 *    6. ask_safe_contact
 *    7. ask_verify
 *    8. readback
 *    9. done
 *
 *  `uncertain` flips true on slots that fall outside the expected
 *  answer set so the panel can show a clarification card.
 * ------------------------------------------------------------------ */

import type { ConversationalIntakeTurn, SlotKey } from "../types";

export interface T5Context {
  sessionId: string;
  callerName?: string;
  applicantName?: string;
  representativeRelation?: string;
  stepsTaken: T5Step[];
  uncertainSlots: SlotKey[];
}

export type T5Step =
  | "greeting"
  | "ask_for"
  | "ask_category"
  | "ask_date"
  | "ask_office"
  | "ask_safe_contact"
  | "ask_verify"
  | "readback"
  | "done";

export const T5_SCRIPT: Record<
  T5Step,
  (ctx: T5Context) => ConversationalIntakeTurn
> = {
  greeting: () => ({
    speaker: "t5",
    text: {
      bn: "আসসালামু আলাইকুম, আমি টি-৫। আমি কীভাবে সাহায্য করতে পারি?",
      en: "Assalamu Alaikum, I am T5. How can I help?",
    },
    spokenAt: new Date().toISOString(),
  }),
  ask_for: () => ({
    speaker: "t5",
    text: {
      bn: "আপনি কি নিজের জন্য, নাকি অন্যের জন্য ফোন করছেন?",
      en: "Are you calling for yourself or for someone else?",
    },
    slot: "caller_relation",
    spokenAt: new Date().toISOString(),
  }),
  ask_category: () => ({
    speaker: "t5",
    text: {
      bn: "আপনার সমস্যাটি কোন ধরনের? পারিবারিক, ভূমি, শ্রম, ফৌজদারি বা অন্য?",
      en: "What type of matter is it? Family, land, labour, criminal or other?",
    },
    slot: "category",
    spokenAt: new Date().toISOString(),
  }),
  ask_date: () => ({
    speaker: "t5",
    text: {
      bn: "ঘটনাটি কখন ঘটেছে? প্রায় সময়ই যথেষ্ট।",
      en: "When did the incident happen? An approximate time is enough.",
    },
    slot: "incident_date",
    spokenAt: new Date().toISOString(),
  }),
  ask_office: () => ({
    speaker: "t5",
    text: {
      bn: "আপনার নিকটস্থ জেলা আইনি সহায়তা কার্যালয় কোনটি?",
      en: "Which district legal aid office is closest to you?",
    },
    slot: "office",
    spokenAt: new Date().toISOString(),
  }),
  ask_safe_contact: () => ({
    speaker: "t5",
    text: {
      bn: "কখন নিরাপদে কথা বলতে পারবেন? আমরা শুধু এই সময়েই যোগাযোগ করব।",
      en: "When is it safe to talk? We will only contact you at this time.",
    },
    slot: "safe_contact_time",
    spokenAt: new Date().toISOString(),
  }),
  ask_verify: () => ({
    speaker: "t5",
    text: {
      bn: "পরিচয় যাচাই করতে দুটি প্রশ্ন করব।",
      en: "I will ask two questions to verify your identity.",
    },
    spokenAt: new Date().toISOString(),
  }),
  readback: () => ({
    speaker: "t5",
    text: {
      bn: "এই সারসংক্ষেপটি ঠিক আছে কি?",
      en: "Is this read-back correct?",
    },
    spokenAt: new Date().toISOString(),
  }),
  done: () => ({
    speaker: "t5",
    text: {
      bn: "ধন্যবাদ। আপনার অস্থায়ী রসিদটি এসএমএস-এ পাঠানো হবে।",
      en: "Thank you. Your temporary receipt will be sent by SMS.",
    },
    spokenAt: new Date().toISOString(),
  }),
};

export const KNOWN_CATEGORIES = ["family", "land", "labour", "criminal", "other"] as const;

export const NEXT_STEP: Record<T5Step, T5Step> = {
  greeting: "ask_for",
  ask_for: "ask_category",
  ask_category: "ask_date",
  ask_date: "ask_office",
  ask_office: "ask_safe_contact",
  ask_safe_contact: "ask_verify",
  ask_verify: "readback",
  readback: "done",
  done: "done",
};

export function isKnownCategory(input: string): boolean {
  return (KNOWN_CATEGORIES as readonly string[]).includes(input.trim().toLowerCase());
}
