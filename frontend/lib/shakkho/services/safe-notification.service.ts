/* ------------------------------------------------------------------ *
 *  SafeNotificationService — citizen-facing strings pass through here.
 *
 *  Every payload is checked for restricted keywords (evidence names,
 *  intimate content markers, routing detail). If any are present the
 *  notification is REJECTED — we never want a citizen-facing string
 *  to leak sensitive material or internal notes.
 * ------------------------------------------------------------------ */

import type { CitizenSafeStatus, Referral, StoreEnvelope } from "../types";
import { read, write } from "../persistence";
import { AuditTrailService } from "./audit-trail.service";
import { DemoTimeService } from "./demo-time.service";

const RESTRICTED_KEYWORDS_EN = [
  "evidence", "screenshot", "image", "intimate", "rape", "assault",
  "fake image", "leaked", "threat", "jurisdiction", "disagreement",
  "routing", "internal note", "escalation note", "labour cell", "DLAO wrong",
  "suspect", "alleged perpetrator", "accused",
];
const RESTRICTED_KEYWORDS_BN = [
  "প্রমাণ", "স্ক্রিনশট", "ছবি", "অন্তরঙ্গ", "ধর্ষণ", "নির্যাতন",
  "ভুয়া ছবি", "ফাঁস", "হুমকি", "এখতিয়ার", "মতবিরোধ",
  "রাউটিং", "অভ্যন্তরীণ নোট", "শ্রম সেল", "সন্দেহভাজন",
  "অভিযুক্ত",
];

export const SafeNotificationService = {
  list(envelope: StoreEnvelope): CitizenSafeStatus[] {
    return envelope.citizenSafeStatuses ?? [];
  },

  buildForReferral(input: {
    applicationId: string;
    recordId: string;
    safeMessageBn: string;
    safeMessageEn: string;
    nextSafeAction?: string;
    approvedContactMethod: CitizenSafeStatus["approvedContactMethod"];
    clearedBy: string;
  }): CitizenSafeStatus | undefined {
    if (!this.isSafe(input.safeMessageBn, input.safeMessageEn, input.nextSafeAction)) return undefined;
    const envelope = read();
    const status: CitizenSafeStatus = {
      notificationId: "safe-" + Math.random().toString(36).slice(2, 10),
      applicationId: input.applicationId,
      recordId: input.recordId,
      generatedAt: DemoTimeService.iso(),
      safeMessageBn: input.safeMessageBn,
      safeMessageEn: input.safeMessageEn,
      nextSafeAction: input.nextSafeAction,
      approvedContactMethod: input.approvedContactMethod,
      clearedBy: input.clearedBy,
    };
    write({
      ...envelope,
      citizenSafeStatuses: [...(envelope.citizenSafeStatuses ?? []), status],
    });
    AuditTrailService.log(
      {
        subject: status.notificationId,
        subjectKind: "system",
        action: "safe_notification.created",
        actor: input.clearedBy,
        payload: { applicationId: input.applicationId, approvedContactMethod: input.approvedContactMethod },
      },
      { kind: "sms", simulatedAt: DemoTimeService.iso() },
    );
    return status;
  },

  isSafe(messageBn: string, messageEn: string, nextAction?: string): boolean {
    const lower = (messageBn + " " + messageEn + " " + (nextAction ?? "")).toLowerCase();
    if (RESTRICTED_KEYWORDS_EN.some((k) => lower.includes(k.toLowerCase()))) return false;
    if (RESTRICTED_KEYWORDS_BN.some((k) => messageBn.includes(k))) return false;
    return true;
  },

  safeMessageForReferral(referral: Referral, lang: "bn" | "en"): string {
    switch (referral.package.state) {
      case "draft":
      case "package_review":
      case "authorized":
      case "sending":
      case "delivered":
      case "awaiting_acknowledgment":
        return lang === "bn"
          ? "আপনার আবেদনটি জরুরি পর্যালোচনায় আছে।"
          : "Your application is under urgent human review.";
      case "overdue_acknowledgment":
        return lang === "bn"
          ? "আবেদনটি গ্রহণ করার জন্য অপেক্ষা করা হচ্ছে।"
          : "Your application is awaiting receipt confirmation by the receiving office.";
      case "acknowledged":
        return lang === "bn"
          ? "প্রাপ্তিস্থান কার্যালয় রেফারেলটি গ্রহণ করেছে।"
          : "The receiving office has acknowledged the referral.";
      case "information_requested":
      case "returned":
        return lang === "bn"
          ? "অতিরিক্ত তথ্য প্রয়োজন — নিরাপদ যোগাযোগের মাধ্যমে জানানো হবে।"
          : "Additional information is required — we will contact you through your safe channel.";
      case "accepted":
      case "action_in_progress":
        return lang === "bn"
          ? "দায়িত্বপ্রাপ্ত কার্যালয় পরবর্তী পদক্ষেপ নিচ্ছে।"
          : "The responsible office is taking the next action.";
      case "overdue_action":
        return lang === "bn"
          ? "প্রশাসনিক ফলো-আপ প্রয়োজন — নিরাপদ যোগাযোগের মাধ্যমে জানানো হবে।"
          : "Administrative follow-up is required — we will contact you through your safe channel.";
      case "escalation_required":
      case "escalated":
        return lang === "bn"
          ? "আবেদনটি সক্রিয় আছে। নিরাপদ যোগাযোগের মাধ্যমে আপডেট দেওয়া হবে।"
          : "Your application remains active. Updates will be sent through your safe channel.";
      case "completed":
        return lang === "bn" ? "আবেদনটির প্রাথমিক পর্যালোচনা সম্পন্ন হয়েছে।" : "Initial review of your application has been completed.";
      case "superseded":
      case "withdrawn_by_authorized_user":
        return lang === "bn" ? "আবেদনটি সক্রিয় আছে।" : "Your application remains active.";
      default:
        return lang === "bn" ? "আবেদনটি সক্রিয় আছে।" : "Your application remains active.";
    }
  },
};