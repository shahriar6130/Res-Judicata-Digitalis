/* ------------------------------------------------------------------ *
 *  Audit trail (Feature 11) — WHO · WHAT · WHEN · CASE · STATUS.
 *
 *  • sealAuditHistory()  called by store.mutate() on every write:
 *      - history is APPEND-ONLY: an existing audit entry that is changed,
 *        removed or reordered makes the whole write fail (nothing saved);
 *      - every new application audit entry is stamped with the case
 *        STATUS after the action (`status`), so each row shows where the
 *        case stood when it happened.
 *  • describeAudit()     plain-language sentence + actor label per entry
 *    ("19:42 — Legal Aid Officer · Confirmed mandatory pre-case mediation").
 *  • caseActivity()      chronological trail of one case.
 *
 *  Pure — imports types only, so store.ts can use it without a cycle.
 * ------------------------------------------------------------------ */

import type { ApplicationRecord, AuditEntry, DlasDb } from "./schema";

type Bi = { bn: string; en: string };
const B = (bn: string, en: string): Bi => ({ bn, en });

/* ------------------------------ status stamp ------------------------------ */

/** Mediation stage of a case, from the shared record only. */
export function mediationStageOf(a: ApplicationRecord): string | null {
  const m = a.mediation;
  if (!m) return null;
  const ws = m.workspace ?? null;
  if (ws?.failureRecord) return `FAILURE_${ws.failureRecord.status}`;
  if (ws?.settlementWorkflow) return `SETTLEMENT_${ws.settlementWorkflow.status}`;
  const final = [...(ws?.outcomes ?? [])].reverse().find((o) => o.kind === "SETTLEMENT_REACHED" || o.kind === "MEDIATION_FAILED");
  if (final) return final.kind;
  const s = ws?.sessions ?? [];
  if (s.some((x) => x.status === "IN_PROGRESS")) return "SESSION_IN_PROGRESS";
  if (s.some((x) => x.status === "PAUSED")) return "SESSION_PAUSED";
  if (s.some((x) => x.status === "SCHEDULED")) return "SESSION_SCHEDULED";
  if (s.length) return "AWAITING_OUTCOME";
  return `ASSIGNMENT_${m.assignmentStatus}`;
}

export function statusSnapshot(a: ApplicationRecord): NonNullable<AuditEntry["status"]> {
  return { application: a.status, stage: a.stage, pathway: a.review?.pathway?.type ?? a.pathwayClassification?.final?.status ?? null, mediation: mediationStageOf(a) };
}

/* ------------------------------ append-only guard ------------------------------ */

type Fingerprint = Map<string, { entries: string[]; sample: boolean }>;

/** Stable identity of a record inside a collection. A record's OWN id comes first
 *  (an intake session later gains an applicationId link, but stays that session). */
const ID_KEYS = ["sessionId", "mediatorId", "lawyerId", "officerId", "staffId", "agentId", "operatorId", "citizenId", "applicationId"];

/** Every `audit` array in the DB, keyed by its path; `sample` marks illustrative records that may be removed wholesale. */
function auditArrays(db: unknown): Map<string, { list: AuditEntry[]; sample: boolean }> {
  const out = new Map<string, { list: AuditEntry[]; sample: boolean }>();
  const walk = (v: unknown, path: string, depth: number) => {
    if (!v || typeof v !== "object" || depth > 6) return;
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        const r = x && typeof x === "object" ? (x as Record<string, unknown>) : null;
        const key = r ? ID_KEYS.find((k) => typeof r[k] === "string") : undefined;
        walk(x, `${path}[${key && r ? String(r[key]) : i}]`, depth + 1);
      });
      return;
    }
    const r = v as Record<string, unknown>;
    for (const [k, x] of Object.entries(r)) {
      if (k === "audit" && Array.isArray(x)) out.set(`${path}.audit`, { list: x as AuditEntry[], sample: r.sample === true });
      else if (x && typeof x === "object") walk(x, `${path}.${k}`, depth + 1);
    }
  };
  walk(db, "db", 0);
  return out;
}

/** Snapshot of the audit history before a write. */
export function auditFingerprint(db: DlasDb): Fingerprint {
  const fp: Fingerprint = new Map();
  for (const [path, { list, sample }] of auditArrays(db)) fp.set(path, { entries: list.map((e) => JSON.stringify(e)), sample });
  return fp;
}

export class AuditTamperError extends Error {
  constructor(path: string, index: number) {
    super(`Audit history is append-only — entry ${index + 1} of ${path} was changed or removed. The change was not saved.`);
    this.name = "AuditTamperError";
  }
}

/**
 * Called by store.mutate() after the mutator ran and before persisting.
 * Throws AuditTamperError (so nothing is written) if any earlier entry changed;
 * stamps the status on new application entries.
 */
export function sealAuditHistory(before: Fingerprint, db: DlasDb): void {
  const now = auditArrays(db);
  for (const [path, { entries: old, sample }] of before) {
    const list = now.get(path)?.list;
    if (!list) {
      // Removing a whole illustrative sample record (e.g. sample mediators) is allowed; any real record is not.
      if (old.length && !sample) throw new AuditTamperError(path, 0);
      continue;
    }
    if (list.length < old.length) throw new AuditTamperError(path, list.length);
    for (let i = 0; i < old.length; i++) if (JSON.stringify(list[i]) !== old[i]) throw new AuditTamperError(path, i);
  }
  for (const a of db.applications) {
    const known = before.get(`db.applications[${a.applicationId}].audit`)?.entries.length ?? 0;
    if (a.audit.length <= known) continue;
    const snap = statusSnapshot(a);
    for (let i = known; i < a.audit.length; i++) if (!a.audit[i].status) a.audit[i].status = snap;
  }
}

/* ------------------------------ plain-language rendering ------------------------------ */

export const ROLE_LABEL: Record<AuditEntry["role"], Bi> = {
  applicant: B("আবেদনকারী", "Applicant"),
  representative: B("প্রতিনিধি", "Representative"),
  udc_operator: B("UDC অপারেটর", "UDC operator"),
  helpline_agent: B("হেল্পলাইন এজেন্ট", "Helpline agent"),
  system: B("সিস্টেম", "System"),
  dlao: B("লিগ্যাল এইড অফিসার", "Legal Aid Officer"),
  clo: B("চিফ লিগ্যাল এইড অফিসার", "CLO"),
  panel_lawyer: B("প্যানেল আইনজীবী", "Panel lawyer"),
  mediator: B("মধ্যস্থতাকারী", "Mediator"),
  dlo_staff: B("অফিস স্টাফ", "Office staff"),
  admin: B("DBLA / অ্যাডমিন", "DBLA / Admin"),
  debug: B("ডিবাগ", "Debug"),
};

/** Actions the system generates while a person triggered them: shown as "System", with who ran it. */
const SYSTEM_ACTIONS = new Set(["duplicate.flagged_for_review", "settlement.testimonial_sent_to_citizen", "settlement.appeal_window_lapsed", "incident.red_flagged", "incident.classified", "mediation.auto_offered_next", "mediation.offer_expired", "mediation.offers_exhausted", "pathway.system_assessed", "mediation.eligibility_checked", "mediation.conflict_detected", "notice.sms_sent", "notice.not_sent", "task.created", "task.closed", "lawyer.shortlist_generated", "lawyer.auto_offered_next", "lawyer.offer_expired", "lawyer.update_overdue", "lawyer.inactivity_pattern", "lawyer.red_flagged"]);

export type AuditCategory = "INTAKE" | "VERIFICATION" | "PATHWAY" | "MEDIATION" | "SETTLEMENT" | "FAILURE" | "LAWYER" | "NOTICE" | "ACCESS" | "OTHER";

const str = (v: unknown) => (v == null ? "" : String(v));
const words = (v: unknown) => str(v).replaceAll("_", " ").toLowerCase();
const side = (v: unknown, bn: boolean) => (str(v).toUpperCase() === "APPLICANT" ? (bn ? "আবেদনকারী" : "applicant") : str(v).toUpperCase() === "RESPONDENT" ? (bn ? "প্রতিপক্ষ" : "respondent") : words(v));
const OUTCOME: Record<string, Bi> = {
  SETTLEMENT_REACHED: B("নিষ্পত্তি হয়েছে", "Settlement reached"),
  MEDIATION_FAILED: B("মধ্যস্থতা ব্যর্থ", "Mediation failed"),
  NEEDS_FOLLOW_UP: B("ফলো-আপ দরকার", "Needs follow-up"),
  ADJOURNED: B("মুলতবি", "Adjourned"),
};

type D = Record<string, unknown>;
type Phrase = { cat: AuditCategory; key?: boolean; text: (d: D) => Bi };
const P = (cat: AuditCategory, text: (d: D) => Bi, key = true): Phrase => ({ cat, text, key });

const PHRASES: Record<string, Phrase> = {
  // intake & case
  "application.submitted": P("INTAKE", () => B("আবেদন জমা দেওয়া হয়েছে", "Application submitted")),
  "incident.red_flagged": P("INTAKE", (d) => B(`লাল পতাকা (নিয়ম): ${str(d.category)}${d.subcategory ? ` › ${str(d.subcategory)}` : ""}`, `RED FLAG by rule: ${str(d.category)}${d.subcategory ? ` › ${str(d.subcategory)}` : ""}`)),
  "incident.classified": P("INTAKE", (d) => B(`শ্রেণি (নিয়ম): ${str(d.category)}`, `Classified by rule: ${str(d.category)}`)),
  "incident.red_flag_confirmed": P("INTAKE", () => B("অফিসার লাল পতাকা নিশ্চিত করেছেন", "Officer confirmed the red flag")),
  "incident.red_flag_cleared": P("INTAKE", (d) => B(`অফিসার লাল পতাকা সরিয়েছেন — “${str(d.reason)}”`, `Officer cleared the red flag — “${str(d.reason)}”`)),
  "case.created": P("INTAKE", (d) => B(`কেস খোলা হয়েছে ${str(d.caseId)}`, `Case created ${str(d.caseId)}`)),
  "review.received": P("VERIFICATION", () => B("অফিসে আবেদন গ্রহণ", "Application received at the office")),
  "identity.verified": P("VERIFICATION", () => B("পরিচয় যাচাই করা হয়েছে", "Identity verified")),
  "nid.registry_check_simulated": P("VERIFICATION", () => B("NID রেজিস্ট্রি যাচাই (সিমুলেটেড)", "NID registry check (simulated)"), false),
  "document.received_at_office": P("VERIFICATION", () => B("নথি গ্রহণ চিহ্নিত", "Document marked received"), false),
  "document.classified": P("VERIFICATION", () => B("নথির ধরন নির্ধারণ", "Document classified"), false),
  "document.requested": P("VERIFICATION", () => B("নথি চাওয়া হয়েছে", "Document requested")),
  "document.uploaded": P("INTAKE", () => B("নথি আপলোড", "Document uploaded"), false),
  "facts.reviewed": P("VERIFICATION", () => B("তথ্য ও নথি পর্যালোচনা", "Facts and documents reviewed")),
  "eligibility.assessed": P("VERIFICATION", () => B("যোগ্যতা মূল্যায়ন", "Eligibility assessed")),
  "decision.recorded": P("VERIFICATION", (d) => B(`সিদ্ধান্ত রেকর্ড: ${words(d.decision)}`, `Decision recorded: ${words(d.decision)}`)),
  "application.verified": P("VERIFICATION", () => B("আবেদন যাচাই সম্পন্ন", "Application verified")),
  "applicant.info_requested": P("VERIFICATION", () => B("আবেদনকারীর কাছে তথ্য চাওয়া হয়েছে", "More information requested from the applicant")),
  "review.details_corrected": P("VERIFICATION", () => B("বিবরণ সংশোধন", "Details corrected")),
  "staff.story_checked": P("VERIFICATION", (d) => B(`স্টাফ প্রি-চেক: ${words(d.outcome)}`, `Staff pre-check: ${words(d.outcome)}`)),
  "status.changed": P("OTHER", (d) => B(`অবস্থা পরিবর্তন → ${words(d.to)}`, `Status changed → ${words(d.to)}`), false),
  "application.closed": P("OTHER", () => B("কেস বন্ধ", "Case closed")),
  // pathway
  "pathway.inputs_recorded": P("PATHWAY", () => B("পথ নির্ধারণের তথ্য রেকর্ড", "Pathway inputs recorded"), false),
  "pathway.system_assessed": P("PATHWAY", (d) => B(`আইনি পথ শ্রেণিবিন্যাস: ${words(d.result)} (পরামর্শমূলক)`, `Classified the legal pathway: ${words(d.result)} (advisory)`)),
  "pathway.officer_confirmed": P("PATHWAY", (d) => B(`${words(d.finalPathway)} নিশ্চিত করেছেন`, `Confirmed ${words(d.finalPathway)}`)),
  "pathway.officer_changed": P("PATHWAY", (d) => B(`পথ পরিবর্তন: ${words(d.systemClassification)} → ${words(d.finalPathway)}`, `Changed the pathway: ${words(d.systemClassification)} → ${words(d.finalPathway)}`)),
  "pathway.info_requested": P("PATHWAY", () => B("পথ নির্ধারণে আরও তথ্য চাওয়া হয়েছে", "Requested more information for the pathway")),
  "pathway.chosen": P("PATHWAY", (d) => B(`সেবার পথ: ${words(d.type ?? d.pathway)}`, `Routed to ${words(d.type ?? d.pathway)}`)),
  // mediator assignment
  "mediation.matter_opened": P("MEDIATION", () => B("মধ্যস্থতা ফাইল খোলা হয়েছে", "Mediation matter opened")),
  "mediation.case_type_set": P("MEDIATION", (d) => B(`মামলার ধরন: ${words(d.caseType)}`, `Case type set: ${words(d.caseType)}`), false),
  "mediation.eligibility_checked": P("MEDIATION", (d) => B(`যোগ্য মধ্যস্থতাকারীর তালিকা তৈরি (${str(d.eligible)} জন যোগ্য)`, `Generated eligible mediator list (${str(d.eligible)} eligible)`)),
  "mediation.conflict_detected": P("MEDIATION", (d) => B(`স্বার্থের সংঘাত শনাক্ত — নিয়োগ আটকানো (${str(d.mediatorName ?? d.mediatorId)})`, `Conflict detected — assignment blocked (${str(d.mediatorName ?? d.mediatorId)})`)),
  "mediation.mediator_recommended": P("MEDIATION", (d) => B(`মধ্যস্থতাকারী প্রস্তাব: ${str(d.mediator ?? d.mediatorName ?? d.mediatorId)}`, `Recommended mediator ${str(d.mediator ?? d.mediatorName ?? d.mediatorId)}`)),
  "mediation.recommendation_withdrawn": P("MEDIATION", () => B("প্রস্তাব প্রত্যাহার", "Recommendation withdrawn")),
  "mediation.mediator_assigned": P("MEDIATION", (d) => B(`মধ্যস্থতাকারী নিয়োগ নিশ্চিত: ${str(d.mediator)}`, `Confirmed mediator assignment: ${str(d.mediator)}`)),
  "mediation.mediator_offered": P("MEDIATION", (d) => B(`সেরা পছন্দ #${str(d.rank)} ${str(d.mediator)}-কে প্রস্তাব পাঠানো হয়েছে`, `Offered the case to best pick #${str(d.rank)} ${str(d.mediator)}`)),
  "mediation.auto_offered_next": P("MEDIATION", (d) => B(`পরবর্তী #${str(d.rank)} ${str(d.mediator)}-কে স্বয়ংক্রিয় প্রস্তাব`, `Automatically offered to the next pick #${str(d.rank)} ${str(d.mediator)}`)),
  "mediation.mediator_accepted": P("MEDIATION", (d) => B(`মধ্যস্থতাকারী কেস গ্রহণ করেছেন`, `Mediator accepted the case${d.via === "AUTO_NEXT" ? " (auto-next offer)" : ""}`)),
  "mediation.mediator_declined": P("MEDIATION", (d) => B(`মধ্যস্থতাকারী প্রত্যাখ্যান করেছেন — ${str(d.reason)}`, `Mediator declined — ${str(d.reason)}`)),
  "mediation.offer_expired": P("MEDIATION", (d) => B(`${str(d.mediator)} সময়মতো উত্তর দেননি — প্রস্তাবের মেয়াদ শেষ`, `${str(d.mediator)} did not answer in time — offer expired`)),
  "mediation.offer_withdrawn": P("MEDIATION", () => B("প্রস্তাব প্রত্যাহার", "Offer withdrawn by the officer")),
  "mediation.offers_exhausted": P("MEDIATION", () => B("আর কোনো যোগ্য মধ্যস্থতাকারী নেই — কর্মকর্তার সিদ্ধান্ত প্রয়োজন", "No eligible mediator left — the officer must decide")),
  "mediation.reassignment_requested": P("MEDIATION", () => B("পুনঃনিয়োগের অনুরোধ", "Reassignment requested")),
  "mediation.assignment_completed": P("MEDIATION", () => B("মধ্যস্থতা নিয়োগ সম্পন্ন", "Mediation assignment completed")),
  // workspace
  "mediation.workspace_opened": P("ACCESS", () => B("কর্মক্ষেত্র খোলা", "Opened the mediation workspace"), false),
  "mediation.access_updated": P("MEDIATION", () => B("যোগাযোগ ও প্রবেশযোগ্যতা হালনাগাদ", "Communication & accessibility updated"), false),
  "mediation.respondent_updated": P("MEDIATION", () => B("প্রতিপক্ষের তথ্য হালনাগাদ", "Respondent details updated"), false),
  "mediation.session_scheduled": P("MEDIATION", (d) => B(`সেশন ${str(d.number)} নির্ধারণ — ${words(d.channel)}`, `Scheduled session ${str(d.number)} — ${words(d.channel)}`)),
  "mediation.session_rescheduled": P("MEDIATION", (d) => B(`সেশন ${str(d.number)} পুনর্নির্ধারণ`, `Rescheduled session ${str(d.number)}`)),
  "mediation.session_started": P("MEDIATION", (d) => B(`মধ্যস্থতা সেশন ${str(d.number)} শুরু`, `Started mediation session ${str(d.number)}`)),
  "mediation.session_paused": P("MEDIATION", () => B("সেশন বিরতি", "Paused the session")),
  "mediation.session_resumed": P("MEDIATION", () => B("সেশন আবার শুরু", "Resumed the session")),
  "mediation.session_ended": P("MEDIATION", (d) => B(`সেশন ${str(d.number)} শেষ`, `Ended session ${str(d.number)}`)),
  "mediation.attendance_applicant": P("MEDIATION", (d) => B(`উপস্থিতি রেকর্ড — আবেদনকারী: ${words(d.status)}`, `Recorded attendance — applicant: ${words(d.status)}`)),
  "mediation.attendance_respondent": P("MEDIATION", (d) => B(`উপস্থিতি রেকর্ড — প্রতিপক্ষ: ${words(d.status)}`, `Recorded attendance — respondent: ${words(d.status)}`)),
  "mediation.caucus_opened": P("MEDIATION", (d) => B(`একান্ত আলোচনা (ককাস) শুরু — ${side(d.side, true)}`, `Opened a private caucus — ${side(d.side, false)}`)),
  "mediation.caucus_note_added": P("MEDIATION", (d) => B(`গোপন ককাস নোট যোগ — ${side(d.side, true)} (বিষয়বস্তু দেখানো হয় না)`, `Added a confidential caucus note — ${side(d.side, false)} (content not shown)`), false),
  "settlement.ai_draft_generated": P("SETTLEMENT", (d) => B(`সিমুলেটেড AI খসড়া ${str(d.draftId)} তৈরি — মধ্যস্থতাকারী সম্পাদনা করবেন`, `Simulated AI draft ${str(d.draftId)} generated — for the mediator to edit`)),
  "mediation.settlement_updated": P("SETTLEMENT", (d) => B(`নিষ্পত্তির আলোচনা সম্পাদনা${d.list ? ` — ${words(d.list)}` : ""}${d.op ? ` (${words(d.op)})` : ""}`, `Edited settlement terms${d.list ? ` — ${words(d.list)}` : ""}${d.op ? ` (${words(d.op)})` : ""}`)),
  "mediation.outcome_recorded": P("MEDIATION", (d) => { const o = OUTCOME[str(d.kind)]; return B(`ফলাফল রেকর্ড: ${o?.bn ?? words(d.kind)}`, `Recorded outcome: ${o?.en ?? words(d.kind)}`); }),
  "mediation.voice_call": P("MEDIATION", (d) => B(`পক্ষের সাথে ফোনে যোগাযোগ — ${side(d.side, true)}: ${words(d.state)} (সিমুলেটেড)`, `Party contacted by voice call — ${side(d.side, false)}: ${words(d.state)} (simulated)`)),
  "mediation.online_connection": P("MEDIATION", (d) => B(`অনলাইন সংযোগ — ${words(d.who)}: ${words(d.state)}`, `Online connection — ${words(d.who)}: ${words(d.state)}`), false),
  "mediation.venue_check_in": P("MEDIATION", (d) => B(`ভেন্যুতে উপস্থিত — ${side(d.side, true)}`, `Checked in at the venue — ${side(d.side, false)}`)),
  "mediation.channel_switched": P("MEDIATION", (d) => B(`চ্যানেল পরিবর্তন ${words(d.from)} → ${words(d.to)}`, `Switched channel ${words(d.from)} → ${words(d.to)}`)),
  "mediation.record_viewed": P("ACCESS", (d) => B(`মধ্যস্থতার রেকর্ড দেখা হয়েছে (${words(d.surface)})`, `Viewed the mediation record (${words(d.surface)})`), false),
  // settlement
  "settlement.terms_revised": P("SETTLEMENT", () => B("নিষ্পত্তির শর্ত সংশোধন", "Settlement terms revised")),
  "settlement.party_signed": P("SETTLEMENT", (d) => B(`পক্ষ চুক্তি সম্পাদন করেছেন — ${side(d.side, true)} (সিমুলেটেড স্বাক্ষর)`, `Party executed the agreement — ${side(d.side, false)} (simulated signature)`)),
  "settlement.mediator_confirmed": P("SETTLEMENT", () => B("মধ্যস্থতাকারী চুক্তি নিশ্চিত করেছেন", "Mediator confirmed the agreement")),
  "settlement.submitted_for_certification": P("SETTLEMENT", (d) => B(`চুক্তি ${str(d.agreementId)} অফিসারের যাচাইয়ের জন্য জমা`, `Agreement ${str(d.agreementId)} submitted for the officer's verification`)),
  "settlement.certified": P("SETTLEMENT", () => B("চুক্তি যাচাই করেছেন (লিগ্যাল এইড অফিসার)", "Verified the agreement (Legal Aid Officer)")),
  "settlement.testimonial_issued": P("SETTLEMENT", (d) => B(`নিষ্পত্তি প্রত্যয়নপত্র ${str(d.testimonialId)} ইস্যু করেছেন`, `Issued settlement testimonial ${str(d.testimonialId)}`)),
  "settlement.testimonial_sent_to_citizen": P("SETTLEMENT", () => B("প্রত্যয়নপত্র নাগরিকের কাছে পাঠানো হয়েছে — আপিলের সময় শুরু", "Testimonial sent to the citizen — appeal window opened")),
  "settlement.appeal_filed": P("SETTLEMENT", (d) => B(`নাগরিক আপিল করেছেন — “${str(d.reason)}”`, `Citizen appealed — “${str(d.reason)}”`)),
  "settlement.accepted_by_citizen": P("SETTLEMENT", () => B("নাগরিক নিষ্পত্তি মেনে নিয়েছেন", "Citizen accepted the settlement")),
  "settlement.appeal_accepted": P("SETTLEMENT", () => B("আপিল গৃহীত — আইনজীবী নিয়োগ হবে", "Appeal accepted — a panel lawyer will be assigned")),
  "settlement.appeal_rejected": P("SETTLEMENT", (d) => B(`আপিল প্রত্যাখ্যাত — “${str(d.reason)}”`, `Appeal rejected — “${str(d.reason)}”`)),
  "settlement.appeal_window_lapsed": P("SETTLEMENT", () => B("আপিলের সময় শেষ — আপিল হয়নি", "Appeal window ended with no appeal")),
  "case.ai_summary_generated": P("ACCESS", (d) => B(`সিমুলেটেড AI সারসংক্ষেপ দেখেছেন (${str(d.forRole)})`, `Viewed a simulated AI summary (${str(d.forRole)})`)),
  "incident_group.linked": P("OTHER", (d) => B(`একই ঘটনার গ্রুপে যুক্ত — ${str(d.title)}`, `Linked to same-incident group — ${str(d.title)}`)),
  "incident_group.unlinked": P("OTHER", () => B("গ্রুপ থেকে আলাদা করা হয়েছে", "Unlinked from the group")),
  "incident_group.shared_evidence_linked": P("OTHER", (d) => B(`গ্রুপের সাধারণ প্রমাণ যুক্ত — ${str(d.title)} (কপি নয়)`, `Group shared evidence linked — ${str(d.title)} (not copied)`)),
  "duplicate.flagged_for_review": P("OTHER", (d) => B(`সম্ভাব্য দ্বৈত/ঝুঁকি — পর্যালোচনার জন্য চিহ্নিত (${str(d.score)}/100)`, `Flagged for duplicate / risk review (${str(d.score)}/100)`)),
  "duplicate.review_decided": P("OTHER", (d) => B(`দ্বৈত পর্যালোচনা: ${str(d.outcome)} — “${str(d.note)}”`, `Duplicate review: ${str(d.outcome)} — “${str(d.note)}”`)),
  "case.closed": P("SETTLEMENT", () => B("কেস বন্ধ করা হয়েছে", "Case closed")),
  "settlement.follow_up_completed": P("SETTLEMENT", (d) => B(`নিষ্পত্তির ফলো-আপ সম্পন্ন: ${words(d.kind)}`, `Settlement follow-up completed: ${words(d.kind)}`)),
  "settlement.returned_for_correction": P("SETTLEMENT", () => B("সংশোধনের জন্য ফেরত", "Returned for correction")),
  "settlement.clarification_requested": P("SETTLEMENT", () => B("স্পষ্টীকরণ চাওয়া হয়েছে", "Requested clarification")),
  "mediation.authority_notification_recorded": P("SETTLEMENT", () => B("কর্তৃপক্ষকে জানানো রেকর্ড (ডেমো)", "Recorded the notice to the authority (demo)")),
  // failure & referral
  "mediation.failure_record_created": P("FAILURE", (d) => B(`ব্যর্থতার রেকর্ড তৈরি ${str(d.recordId)}`, `Failure record created ${str(d.recordId)}`)),
  "mediation.failure_more_information_requested": P("FAILURE", () => B("ব্যর্থতার রেকর্ডে আরও তথ্য চাওয়া হয়েছে", "More information requested on the failure record")),
  "mediation.failure_information_supplied": P("FAILURE", () => B("ব্যর্থতার রেকর্ডে তথ্য দেওয়া হয়েছে", "Information supplied on the failure record")),
  "mediation.referral_confirmed": P("FAILURE", (d) => B(`রেফারেল নিশ্চিত: ${words(d.pathway)}`, `Referral confirmed: ${words(d.pathway)}`)),
  "mediation.lawyer_handoff_created": P("LAWYER", () => B("আইনজীবী নিয়োগ শুরু", "Lawyer assignment initiated")),
  // lawyer
  "lawyer.shortlist_generated": P("LAWYER", () => B("আইনজীবী শর্টলিস্ট তৈরি", "Generated the lawyer shortlist")),
  "lawyer.offered": P("LAWYER", (d) => B(`আইনজীবীকে প্রস্তাব: ${str(d.lawyer ?? d.lawyerName ?? d.lawyerId)}`, `Offered to lawyer ${str(d.lawyer ?? d.lawyerName ?? d.lawyerId)}`)),
  "lawyer.accepted": P("LAWYER", () => B("আইনজীবী গ্রহণ করেছেন", "Lawyer accepted")),
  "lawyer.declined": P("LAWYER", () => B("আইনজীবী প্রত্যাখ্যান করেছেন", "Lawyer declined")),
  "lawyer.access_granted": P("LAWYER", () => B("আইনজীবীকে প্রবেশাধিকার", "Lawyer given case access"), false),
  "lawyer.representation_completed": P("LAWYER", (d) => B(`আইনজীবীর প্রতিনিধিত্ব সম্পন্ন — ${words(d.outcome)}`, `Lawyer representation completed — ${words(d.outcome)}`)),
  "lawyer.payment_approved": P("LAWYER", (d) => B(`আইনজীবীর পেমেন্ট অনুমোদিত — ${str(d.payableHearings)}টি শুনানি`, `Lawyer payment approved — ${str(d.payableHearings)} hearing(s)`)),
  "lawyer.payment_disbursed": P("LAWYER", (d) => B(`পেমেন্ট পাঠানো হয়েছে (সিমুলেটেড) — ${str(d.ref)}`, `Payment sent (simulated) — ${str(d.ref)}`)),
  "hearing.admin_added": P("LAWYER", (d) => B(`প্রশাসক শুনানি যোগ করেছেন — ${str(d.court)}`, `Administrator added a hearing — ${str(d.court)}`)),
  "hearing.admin_updated": P("LAWYER", () => B("প্রশাসক শুনানির সময়সূচি সংশোধন করেছেন", "Administrator corrected the hearing schedule")),
  // notices & tasks
  "notice.sms_sent": P("NOTICE", () => B("আবেদনকারীকে নিরাপদ SMS পাঠানো (সিমুলেটেড)", "Sent a safe SMS to the applicant (simulated)"), false),
  "notice.not_sent": P("NOTICE", (d) => B(`SMS পাঠানো হয়নি — ${words(d.reason)}`, `SMS not sent — ${words(d.reason)}`)),
  "task.created": P("OTHER", (d) => B(`কাজ খোলা: ${words(d.type)}`, `Task opened: ${words(d.type)}`), false),
  "task.closed": P("OTHER", (d) => B(`কাজ সম্পন্ন: ${words(d.type)}`, `Task closed: ${words(d.type)}`), false),
};

function fallback(action: string): Phrase {
  const [ns, rest] = action.includes(".") ? action.split(/\.(.+)/) : ["", action];
  const cat: AuditCategory = ns === "mediation" || ns === "mediator" ? "MEDIATION" : ns === "settlement" ? "SETTLEMENT" : ns === "pathway" ? "PATHWAY" : ns === "lawyer" || ns === "hearing" ? "LAWYER" : ns === "identity" || ns === "document" || ns === "review" ? "VERIFICATION" : ns === "session" || ns === "field" || ns === "application" ? "INTAKE" : "OTHER";
  const w = words(rest || action);
  return { cat, key: false, text: () => B(w, w.charAt(0).toUpperCase() + w.slice(1)) };
}

export type AuditView = {
  seq: number;
  at: string;
  who: Bi; // role label, or "System"
  name: string; // person / account name
  actorId: string;
  systemOnBehalfOf: string | null;
  what: Bi;
  action: string;
  caseId: string;
  status: AuditEntry["status"] | null;
  category: AuditCategory;
  key: boolean;
};

export function describeAudit(e: AuditEntry, a?: Pick<ApplicationRecord, "caseId" | "applicationId"> & Partial<Pick<ApplicationRecord, "mediation">>, names?: Map<string, string>): AuditView {
  const raw = (e.detail ?? {}) as D;
  const medName = raw.mediatorId ? a?.mediation?.assignments.find((x) => x.mediatorId === raw.mediatorId)?.mediatorName : undefined;
  const d: D = medName && !raw.mediatorName ? { ...raw, mediatorName: medName } : raw;
  const ph = e.action.startsWith("mediation.document_") ? P("MEDIATION", () => B(`নথি ${words(e.action.slice(19))}`, `Document ${words(e.action.slice(19))}`), false) : PHRASES[e.action] ?? fallback(e.action);
  // The actor's own name: the detail key that matches the actor's role, else the account directory, else nothing.
  const own = e.role === "dlao" || e.role === "clo" ? d.officer ?? d.officerName : e.role === "mediator" ? d.mediator : e.role === "panel_lawyer" ? d.lawyer : e.role === "dlo_staff" ? d.staff : undefined;
  const rawName = str(own ?? names?.get(e.actor) ?? (e.role === "system" ? "" : e.actor));
  // Door actors are recorded by role ("applicant"), not by a person's name — do not repeat the role.
  const name = rawName.toLowerCase() === e.role || rawName === "system" ? "" : rawName;
  const sys = SYSTEM_ACTIONS.has(e.action) || e.role === "system";
  return {
    seq: e.seq,
    at: e.at,
    who: sys ? ROLE_LABEL.system : ROLE_LABEL[e.role] ?? B(e.role, e.role),
    name: sys ? "" : name,
    actorId: e.actor,
    systemOnBehalfOf: sys && e.role !== "system" ? (name ? (name.toLowerCase().includes((ROLE_LABEL[e.role]?.en ?? e.role).toLowerCase()) ? name : `${name} (${ROLE_LABEL[e.role]?.en ?? e.role})`) : ROLE_LABEL[e.role]?.en ?? e.role) : null,
    what: ph.text(d),
    action: e.action,
    caseId: e.caseId ?? a?.caseId ?? a?.applicationId ?? "—",
    status: e.status ?? null,
    category: ph.cat,
    key: ph.key !== false,
  };
}

/** Account id → display name, for rows whose detail does not carry the actor's name. */
export function actorNames(db: Pick<DlasDb, "officers" | "mediators" | "lawyers">): Map<string, string> {
  const m = new Map<string, string>();
  for (const o of db.officers) m.set(o.officerId, o.name);
  for (const x of db.mediators) m.set(x.mediatorId, x.name);
  for (const l of db.lawyers) m.set(l.lawyerId, l.name);
  return m;
}

/** One case's trail, oldest first (chronological). Ties keep write order (seq). */
export function caseActivity(a: ApplicationRecord, names?: Map<string, string>): AuditView[] {
  return a.audit
    .map((e) => describeAudit(e, a, names))
    .sort((x, y) => x.at.localeCompare(y.at) || x.seq - y.seq);
}
