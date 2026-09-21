/* ------------------------------------------------------------------ *
 *  UdcAuthorizationService — soft-bound scope.
 *
 *  Per Phase 5 §5: the UDC is permitted a fixed list of 13 actions
 *  and prohibited from 12 others. This service answers `authorize()`
 *  and emits an audit event for every decision.
 * ------------------------------------------------------------------ */

import { publish } from "../event-bus";
import type { UdcAction, UdcAuthorization } from "../types";

export const UDC_AUTH_EVENT = "shakkho:udc-auth";

const listeners = new Set<(a: UdcAuthorization) => void>();
function emit(a: UdcAuthorization): void {
  publish(UDC_AUTH_EVENT, a);
  listeners.forEach((cb) => cb(a));
}

/* The 13 permitted actions. Anything else is denied by default. */
const ALLOWED: ReadonlySet<UdcAction> = new Set<UdcAction>([
  "intake.start",
  "intake.resume",
  "consent.record",
  "translation.record",
  "document.capture",
  "document.quality.override",
  "checklist.complete",
  "draft.save",
  "submission.queue",
  "submission.sync",
  "clarification.respond",
  "post_submission.view",
  "case_support.view_synced",
]);

/* The 12 prohibited actions — documented so reviewers can audit. */
const PROHIBITED: readonly { code: string; bn: string; en: string }[] = [
  { code: "case_id.mint", bn: "কেস আইডি তৈরি", en: "Mint a Case ID" },
  { code: "case.assign.panel_lawyer", bn: "প্যানেল আইনজীবী নিয়োগ", en: "Assign panel lawyer" },
  { code: "case.dismiss", bn: "আবেদন বাতিল", en: "Dismiss application" },
  { code: "fee.set", bn: "ফি নির্ধারণ", en: "Set a fee" },
  { code: "mediation.schedule", bn: "মধ্যস্থতা সূচী", en: "Schedule mediation" },
  { code: "lawyer.directory.edit", bn: "আইনজীবী ডিরেক্টরি সম্পাদনা", en: "Edit lawyer directory" },
  { code: "applicant.contact.persist", bn: "আবেদনকারীর যোগাযোগ সংরক্ষণ", en: "Persist applicant contact outside the DLAS record" },
  { code: "external.share", bn: "তৃতীয় পক্ষের সাথে শেয়ার", en: "Share with third parties" },
  { code: "signed_legal_advice", bn: "আইনি পরামর্শ প্রদান", en: "Issue signed legal advice" },
  { code: "outcome.predict", bn: "ফলাফল পূর্বাভাস", en: "Predict outcome" },
  { code: "ai.recommend.action", bn: "AI সুপারিশ প্রদান", en: "Issue AI recommendation" },
  { code: "delete.synced", bn: "সিঙ্ক-কৃত রেকর্ড মুছে ফেলা", en: "Delete synced records" },
];

export const UdcAuthorizationService = {
  authorize(action: UdcAction): UdcAuthorization {
    const allowed = ALLOWED.has(action);
    const decision: UdcAuthorization = {
      action,
      allowed,
      reason: allowed
        ? undefined
        : `UDC entrepreneurs cannot perform ${action}; this is a case-support or DLAS responsibility.`,
    };
    emit(decision);
    return decision;
  },

  isAllowed(action: UdcAction): boolean {
    return ALLOWED.has(action);
  },

  permittedActions(): UdcAction[] {
    return [...ALLOWED];
  },

  prohibitedActions(): { code: string; bn: string; en: string }[] {
    return PROHIBITED.map((p) => ({ ...p }));
  },

  subscribe(cb: (a: UdcAuthorization) => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
