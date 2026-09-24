/* ------------------------------------------------------------------ *
 *  Mediation display labels + date formatting.
 *
 *  Single place that turns the mediation domain enums and stored
 *  timestamps into human-readable, bilingual (bn/en) text. The store
 *  keeps canonical machine values (e.g. "party_review", "blocked_unsafe")
 *  and ISO timestamps; every mediator-page surface renders through the
 *  helpers here so Bangla mode never leaks a raw enum or a snake_case
 *  code, and no date ever renders as "Invalid Date".
 *
 *  No new colors, fonts or design tokens — display text only.
 * ------------------------------------------------------------------ */

import type {
  ClauseDisposition,
  MediationMatterState,
  MediationParticipationMode,
  MediationSessionStatus,
  PartySignatureStatus,
  SettlementClauseOrigin,
  SettlementDraftStatus,
} from "@/lib/shakkho/types";

type Lang = "bn" | "en";
const pick = (lang: Lang, bn: string, en: string) => (lang === "bn" ? bn : en);

/* -------- dates -------------------------------------------------- */

const BENGALI_DIGIT = /[০-৯]/g;
/** Bengali numerals (০-৯) → ASCII (0-9). JS `Date` cannot parse Bengali
 *  digits, so any timestamp that reached the store in Bengali numerals
 *  must be normalised before `new Date(...)`. */
export function toAsciiDigits(value: string): string {
  return value.replace(BENGALI_DIGIT, (d) => String(d.charCodeAt(0) - 0x09e6));
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  let d = new Date(value);
  if (Number.isNaN(d.getTime())) d = new Date(toAsciiDigits(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Locale-aware date+time. Returns em dash for missing/unparseable input
 *  instead of "Invalid Date". */
export function fmtDateTime(value: string | undefined | null, lang: Lang): string {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleString(lang === "bn" ? "bn-BD-u-nu-beng" : "en-GB-u-nu-latn");
}

/** Date only (no time). */
export function fmtDate(value: string | undefined | null, lang: Lang): string {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(lang === "bn" ? "bn-BD-u-nu-beng" : "en-GB-u-nu-latn");
}

/* -------- enum label maps --------------------------------------- */

const STATE: Record<MediationMatterState, [string, string]> = {
  registered: ["নিবন্ধিত", "Registered"],
  party_contact_pending: ["পক্ষের সাথে যোগাযোগ বাকি", "Party contact pending"],
  scheduled: ["সময়সূচী নির্ধারিত", "Scheduled"],
  notices_sent: ["নোটিশ পাঠানো হয়েছে", "Notices sent"],
  documents_under_review: ["নথি পর্যালোচনাধীন", "Documents under review"],
  ready_for_session: ["অধিবেশনের জন্য প্রস্তুত", "Ready for session"],
  attendance_confirmed: ["উপস্থিতি নিশ্চিত", "Attendance confirmed"],
  in_session: ["অধিবেশন চলছে", "In session"],
  adjourned: ["মুলতবি", "Adjourned"],
  drafting: ["খসড়া তৈরি হচ্ছে", "Drafting"],
  draft_under_review: ["খসড়া পর্যালোচনাধীন", "Draft under review"],
  party_review: ["পক্ষের পর্যালোচনা", "Party review"],
  awaiting_signatures: ["স্বাক্ষরের অপেক্ষায়", "Awaiting signatures"],
  partially_signed: ["আংশিক স্বাক্ষরিত", "Partially signed"],
  signed: ["স্বাক্ষরিত", "Signed"],
  outcome_recorded: ["ফলাফল রেকর্ড হয়েছে", "Outcome recorded"],
  closed: ["বন্ধ", "Closed"],
  cancelled: ["বাতিল", "Cancelled"],
  no_show_rescheduled: ["অনুপস্থিত — পুনঃনির্ধারিত", "No-show — rescheduled"],
  no_settlement: ["নিষ্পত্তি হয়নি", "No settlement"],
};

const MODE: Record<MediationParticipationMode, [string, string]> = {
  in_person: ["সরাসরি", "In-person"],
  remote: ["দূরবর্তী", "Remote"],
  hybrid: ["হাইব্রিড", "Hybrid"],
};

const ROLE: Record<string, [string, string]> = {
  applicant: ["আবেদনকারী", "Applicant"],
  respondent: ["প্রতিবাদী", "Respondent"],
  mediator: ["মধ্যস্থতাকারী", "Mediator"],
};

const LANGUAGE: Record<string, [string, string]> = {
  bn: ["বাংলা", "Bangla"],
  en: ["ইংরেজি", "English"],
};

const NOTICE_STATUS: Record<string, [string, string]> = {
  not_sent: ["পাঠানো হয়নি", "Not sent"],
  sent: ["পাঠানো হয়েছে", "Sent"],
  delivered: ["পৌঁছেছে", "Delivered"],
  delivery_failed: ["পৌঁছানো ব্যর্থ", "Delivery failed"],
  acknowledged: ["প্রাপ্তি স্বীকৃত", "Acknowledged"],
};

const ATTENDANCE_STATUS: Record<string, [string, string]> = {
  pending: ["অপেক্ষমাণ", "Pending"],
  present: ["উপস্থিত", "Present"],
  absent: ["অনুপস্থিত", "Absent"],
  late: ["বিলম্বিত", "Late"],
  remote_connected: ["দূরবর্তীভাবে সংযুক্ত", "Remotely connected"],
};

const CONTACT_RESULT: Record<string, [string, string]> = {
  reached: ["যোগাযোগ হয়েছে", "Reached"],
  no_answer: ["সাড়া মেলেনি", "No answer"],
  blocked_unsafe: ["অনিরাপদ — অবরুদ্ধ", "Blocked (unsafe)"],
};

const DOC_STATUS: Record<string, [string, string]> = {
  pending_review: ["পর্যালোচনার অপেক্ষায়", "Pending review"],
  reviewed: ["পর্যালোচিত", "Reviewed"],
  unclear: ["অস্পষ্ট", "Unclear"],
  missing_requested: ["অনুপস্থিত — অনুরোধ করা হয়েছে", "Missing — requested"],
};

const SESSION_STATUS: Record<MediationSessionStatus, [string, string]> = {
  scheduled: ["নির্ধারিত", "Scheduled"],
  reminded: ["স্মরণ করানো হয়েছে", "Reminded"],
  in_progress: ["চলমান", "In progress"],
  paused: ["বিরতিতে", "Paused"],
  attended: ["উপস্থিত", "Attended"],
  no_show: ["অনুপস্থিত", "No-show"],
  adjourned: ["মুলতবি", "Adjourned"],
  rescheduled: ["পুনঃনির্ধারিত", "Rescheduled"],
  completed: ["সম্পন্ন", "Completed"],
};

const CONNECTION_STATUS: Record<string, [string, string]> = {
  connected: ["সংযুক্ত", "Connected"],
  interrupted: ["বিঘ্নিত", "Interrupted"],
  failed: ["ব্যর্থ", "Failed"],
  not_applicable: ["প্রযোজ্য নয়", "Not applicable"],
};

const DELIVERY_STATE: Record<string, [string, string]> = {
  draft: ["খসড়া", "Draft"],
  ready_to_send: ["পাঠানোর জন্য প্রস্তুত", "Ready to send"],
  sent: ["পাঠানো হয়েছে", "Sent"],
  delivered: ["পৌঁছেছে", "Delivered"],
  delivery_failed: ["পৌঁছানো ব্যর্থ", "Delivery failed"],
  acknowledged: ["প্রাপ্তি স্বীকৃত", "Acknowledged"],
  resend_required: ["পুনরায় পাঠাতে হবে", "Resend required"],
};

const CHANNEL: Record<string, [string, string]> = {
  sms: ["এসএমএস", "SMS"],
  voice_ivr: ["ভয়েস/আইভিআর", "Voice / IVR"],
  in_person: ["সরাসরি", "In-person"],
  helpline_callback: ["হেল্পলাইন কলব্যাক", "Helpline callback"],
};

const ORIGIN: Record<SettlementClauseOrigin, [string, string]> = {
  template: ["টেমপ্লেট", "Template"],
  ai_inferred: ["এআই-অনুমিত", "AI-inferred"],
  human_edited: ["মানব-সম্পাদিত", "Human-edited"],
};

const DISPOSITION: Record<ClauseDisposition, [string, string]> = {
  undisposed: ["অনিষ্পন্ন", "Undisposed"],
  accept: ["গ্রহণ", "Accept"],
  edit: ["সম্পাদনা", "Edit"],
  reject: ["প্রত্যাখ্যান", "Reject"],
  request_clarification: ["স্পষ্টীকরণ চান", "Request clarification"],
  mark_unresolved: ["অমীমাংসিত চিহ্নিত করুন", "Mark unresolved"],
};

const SEVERITY: Record<string, [string, string]> = {
  warning: ["সতর্কতা", "Warning"],
  blocking: ["অবরোধকারী", "Blocking"],
};

const DRAFT_STATUS: Record<SettlementDraftStatus, [string, string]> = {
  draft: ["খসড়া", "Draft"],
  human_reviewed: ["মানব-পর্যালোচিত", "Human-reviewed"],
  party_consent_pending: ["পক্ষের সম্মতির অপেক্ষায়", "Party consent pending"],
  party_consented: ["পক্ষ সম্মত", "Party consented"],
  finalized: ["চূড়ান্ত", "Finalized"],
  rejected_needs_rework: ["প্রত্যাখ্যাত — সংশোধন প্রয়োজন", "Rejected — needs rework"],
};

const SIGN_STATUS: Record<PartySignatureStatus, [string, string]> = {
  not_started: ["শুরু হয়নি", "Not started"],
  signed_online: ["অনলাইনে স্বাক্ষরিত", "Signed online"],
  signed_offline_pending_sync: ["অফলাইনে স্বাক্ষরিত — সিঙ্ক বাকি", "Signed offline — sync pending"],
  synced: ["সিঙ্ক হয়েছে", "Synced"],
  invalidated_document_changed: ["বাতিল — নথি পরিবর্তিত", "Invalidated — document changed"],
};

const SIGNING_STATUS: Record<string, [string, string]> = {
  awaiting_signatures: ["স্বাক্ষরের অপেক্ষায়", "Awaiting signatures"],
  partially_signed: ["আংশিক স্বাক্ষরিত", "Partially signed"],
  fully_synced_and_verified: ["সম্পূর্ণ সিঙ্ক ও যাচাইকৃত", "Fully synced & verified"],
  invalidated: ["বাতিল", "Invalidated"],
};

const PATHWAY: Record<string, [string, string]> = {
  pre_case: ["প্রাক-মামলা", "Pre-case"],
  post_case: ["মামলা-পরবর্তী", "Post-case"],
};

const CATEGORY: Record<string, [string, string]> = {
  maintenance: ["ভরণপোষণ", "Maintenance"],
  property: ["সম্পত্তি", "Property"],
  labour: ["শ্রম", "Labour"],
};

const OUTCOME: Record<string, [string, string]> = {
  settled: ["নিষ্পত্তি হয়েছে", "Settled"],
  partial: ["আংশিক নিষ্পত্তি", "Partially settled"],
  not_settled: ["নিষ্পত্তি হয়নি", "No settlement"],
};

/* Generic lookup: falls back to a de-snaked Title Case form so a value the
 * map has not yet learned still reads acceptably instead of raw snake_case. */
function fromMap(map: Record<string, [string, string]>, key: string | undefined | null, lang: Lang): string {
  if (!key) return "—";
  const entry = map[key];
  if (entry) return pick(lang, entry[0], entry[1]);
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const L = {
  state: (v: MediationMatterState | string | undefined, lang: Lang) => fromMap(STATE as Record<string, [string, string]>, v ?? undefined, lang),
  mode: (v: string | undefined, lang: Lang) => fromMap(MODE as Record<string, [string, string]>, v ?? undefined, lang),
  role: (v: string | undefined, lang: Lang) => fromMap(ROLE, v ?? undefined, lang),
  language: (v: string | undefined, lang: Lang) => fromMap(LANGUAGE, v ?? "bn", lang),
  noticeStatus: (v: string | undefined, lang: Lang) => fromMap(NOTICE_STATUS, v ?? "not_sent", lang),
  attendanceStatus: (v: string | undefined, lang: Lang) => fromMap(ATTENDANCE_STATUS, v ?? "pending", lang),
  contactResult: (v: string | undefined, lang: Lang) => (v ? fromMap(CONTACT_RESULT, v, lang) : "—"),
  docStatus: (v: string | undefined, lang: Lang) => fromMap(DOC_STATUS, v ?? undefined, lang),
  sessionStatus: (v: string | undefined, lang: Lang) => fromMap(SESSION_STATUS as Record<string, [string, string]>, v ?? undefined, lang),
  connectionStatus: (v: string | undefined, lang: Lang) => fromMap(CONNECTION_STATUS, v ?? undefined, lang),
  deliveryState: (v: string | undefined, lang: Lang) => fromMap(DELIVERY_STATE, v ?? undefined, lang),
  channel: (v: string | undefined, lang: Lang) => fromMap(CHANNEL, v ?? undefined, lang),
  origin: (v: string | undefined, lang: Lang) => fromMap(ORIGIN as Record<string, [string, string]>, v ?? undefined, lang),
  disposition: (v: string | undefined, lang: Lang) => fromMap(DISPOSITION as Record<string, [string, string]>, v ?? undefined, lang),
  severity: (v: string | undefined, lang: Lang) => fromMap(SEVERITY, v ?? undefined, lang),
  draftStatus: (v: string | undefined, lang: Lang) => fromMap(DRAFT_STATUS as Record<string, [string, string]>, v ?? undefined, lang),
  signStatus: (v: string | undefined, lang: Lang) => fromMap(SIGN_STATUS as Record<string, [string, string]>, v ?? undefined, lang),
  signingStatus: (v: string | undefined, lang: Lang) => fromMap(SIGNING_STATUS, v ?? undefined, lang),
  pathway: (v: string | undefined, lang: Lang) => fromMap(PATHWAY, v ?? undefined, lang),
  category: (v: string | undefined, lang: Lang) => fromMap(CATEGORY, v ?? undefined, lang),
  outcome: (v: string | undefined, lang: Lang) => fromMap(OUTCOME, v ?? undefined, lang),
};
