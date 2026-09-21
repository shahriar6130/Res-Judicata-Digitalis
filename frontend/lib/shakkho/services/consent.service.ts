/* ------------------------------------------------------------------ *
 *  ConsentService — structured consent workflow for assisted intake.
 *
 *  Per Phase 5 §9: 8 topics × 4 methods, recorded with provenance.
 *  Read-back to the applicant is mandatory for every consent.
 * ------------------------------------------------------------------ */

import { publish } from "../event-bus";
import { makeId } from "./_internal/async-helpers";
import type {
  AssistanceConsent,
  ConsentMethod,
  ConsentTopic,
  LanguageCode,
} from "../types";

export const CONSENT_EVENT = "shakkho:consent";

const listeners = new Set<(c: AssistanceConsent) => void>();
function emit(c: AssistanceConsent): void {
  publish(CONSENT_EVENT, c);
  listeners.forEach((cb) => cb(c));
}

interface NoticeCopy {
  bn: string;
  en: string;
}

const TOPIC_NOTICES: Record<ConsentTopic, NoticeCopy> = {
  form_entry_assistance: {
    bn: "আমি আপনাকে ফর্ম পূরণে সাহায্য করব। আপনি যা বলবেন আমি লিখব।",
    en: "I will help you fill this form. I will write exactly what you say.",
  },
  human_translation_or_interpretation: {
    bn: "আমি আপনার ভাষায় কথা বলতে পারি এমন একজন ব্যক্তি আছেন — তিনি অনুবাদ করবেন।",
    en: "There is someone who can translate what you say into Bangla or English.",
  },
  document_photography_or_upload: {
    bn: "আমি আপনার কাগজপত্রের ছবি তুলব — শুধু আপনার অনুমতিতে।",
    en: "I will photograph your documents only with your permission.",
  },
  temporary_offline_storage: {
    bn: "নেটওয়ার্ক না থাকলে তথ্য এই ডিভাইসে সাময়িকভাবে রাখা হবে।",
    en: "If the network is down, your information is held temporarily on this device.",
  },
  submission_to_dlas: {
    bn: "তথ্য পাঠানো হবে আইনি সহায়তা ব্যবস্থায় (DLAS)।",
    en: "Your information will be sent to the District Legal Aid Support (DLAS).",
  },
  safe_future_contact: {
    bn: "পরে আপনার সাথে নিরাপদ সময়ে যোগাযোগ করা হবে।",
    en: "We will only contact you again at a time you say is safe.",
  },
  udc_phone_use: {
    bn: "জরুরি হলে আমার (ইউডিসি) ফোন নম্বর সাময়িকভাবে ব্যবহার করা যেতে পারে।",
    en: "If needed, my (UDC) phone may be used temporarily until you have a safer option.",
  },
  limited_post_submission_updates: {
    bn: "জমার পর আমি শুধু সীমিত আপডেট দেখতে পারব।",
    en: "After submission, I can only see limited updates on your case.",
  },
};

export const ConsentService = {
  topicNotices(): Record<ConsentTopic, NoticeCopy> {
    return TOPIC_NOTICES;
  },

  topics(): ConsentTopic[] {
    return Object.keys(TOPIC_NOTICES) as ConsentTopic[];
  },

  methods(): ConsentMethod[] {
    return [
      "oral_with_readback",
      "applicant_action_on_accessible_control",
      "witnessed_confirmation",
      "other_recorded_assisted_method",
    ];
  },

  /** Record the applicant response for one topic. */
  record(input: {
    topic: ConsentTopic;
    method: ConsentMethod;
    language: LanguageCode;
    explainedBy: string;
    interpreter?: string;
    applicantResponse: "yes" | "no" | "ask_again";
    witness?: string;
    note?: { bn: string; en: string };
  }): AssistanceConsent {
    const noticeVersion = "v2026-09-22";
    const consent: AssistanceConsent = {
      id: makeId("CNS"),
      topic: input.topic,
      noticeVersion,
      language: input.language,
      method: input.method,
      explainedBy: input.explainedBy,
      interpreter: input.interpreter,
      applicantResponse: input.applicantResponse,
      witness: input.witness,
      obtainedAt: new Date().toISOString(),
      note: input.note,
    };
    emit(consent);
    return consent;
  },

  withdraw(consent: AssistanceConsent, reason?: { bn: string; en: string }): AssistanceConsent {
    const updated: AssistanceConsent = {
      ...consent,
      applicantResponse: "no",
      withdrawnAt: new Date().toISOString(),
      note: reason ?? consent.note,
    };
    emit(updated);
    return updated;
  },

  /** `true` only when every required topic for the given channel has been answered `yes`. */
  allRequiredGranted(
    consents: AssistanceConsent[],
    required: ConsentTopic[],
  ): { ok: boolean; missing: ConsentTopic[] } {
    const granted = new Set(
      consents.filter((c) => c.applicantResponse === "yes").map((c) => c.topic),
    );
    const missing = required.filter((t) => !granted.has(t));
    return { ok: missing.length === 0, missing };
  },

  subscribe(cb: (c: AssistanceConsent) => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
