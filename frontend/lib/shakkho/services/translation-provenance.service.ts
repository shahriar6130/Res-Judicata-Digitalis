/* ------------------------------------------------------------------ *
 *  TranslationProvenanceService — provenance for every assisted field.
 *
 *  Captures the chain:
 *    spoken by [personWhoSpoke]
 *      → translated by [interpreterOrTranslator] (if any)
 *      → typed by [personWhoTyped]
 *      → confirmed via ReadBackConfirmation
 *
 *  Per Phase 5 §8: translation must be traceable end-to-end so any
 *  later correction can point at the source person, not just the
 *  resulting text.
 * ------------------------------------------------------------------ */

import { publish } from "../event-bus";
import { makeId } from "./_internal/async-helpers";
import type {
  LanguageCode,
  ReadBackConfirmation,
  ReadBackStatus,
  TranslationEvent,
  TranslationMethod,
} from "../types";

export const TRANSLATION_EVENT = "shakkho:translation";

const listeners = new Set<(t: TranslationEvent) => void>();
function emit(t: TranslationEvent): void {
  publish(TRANSLATION_EVENT, t);
  listeners.forEach((cb) => cb(t));
}

export const TranslationProvenanceService = {
  record(input: {
    field: string;
    sourceLanguage: LanguageCode;
    originalText: string;
    translatedText?: string;
    personWhoSpoke: string;
    interpreterOrTranslator?: string;
    personWhoTyped: string;
    method: TranslationMethod;
    uncertaintyNote?: { bn: string; en: string };
  }): TranslationEvent {
    const event: TranslationEvent = {
      id: makeId("TR"),
      field: input.field,
      sourceLanguage: input.sourceLanguage,
      originalText: input.originalText,
      translatedText: input.translatedText,
      personWhoSpoke: input.personWhoSpoke,
      interpreterOrTranslator: input.interpreterOrTranslator,
      personWhoTyped: input.personWhoTyped,
      method: input.method,
      uncertaintyNote: input.uncertaintyNote,
      occurredAt: new Date().toISOString(),
    };
    emit(event);
    return event;
  },

  attachReadBack(event: TranslationEvent, status: ReadBackStatus, priorValue?: string, note?: { bn: string; en: string }): TranslationEvent {
    const readBack: ReadBackConfirmation = {
      status,
      mechanism: status === "applicant_confirmed" ? "oral_with_readback" : "other_recorded_assisted_method",
      confirmedAt: new Date().toISOString(),
      priorValue,
      note,
    };
    const updated: TranslationEvent = { ...event, applicantConfirmation: readBack };
    emit(updated);
    return updated;
  },

  /** Chain summary — for the right-rail provenance strip. */
  chainSummary(event: TranslationEvent, lang: "bn" | "en" = "en"): string {
    const parts: string[] = [];
    parts.push(lang === "bn" ? `বলেছেন: ${event.personWhoSpoke}` : `Spoken by: ${event.personWhoSpoke}`);
    if (event.interpreterOrTranslator) {
      parts.push(
        lang === "bn"
          ? `অনুবাদ: ${event.interpreterOrTranslator}`
          : `Interpreted by: ${event.interpreterOrTranslator}`,
      );
    }
    parts.push(
      lang === "bn" ? `টাইপ: ${event.personWhoTyped}` : `Typed by: ${event.personWhoTyped}`,
    );
    if (event.applicantConfirmation) {
      parts.push(
        lang === "bn"
          ? `নিশ্চিত: ${event.applicantConfirmation.status}`
          : `Confirmed: ${event.applicantConfirmation.status}`,
      );
    }
    return parts.join(" → ");
  },

  subscribe(cb: (t: TranslationEvent) => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
