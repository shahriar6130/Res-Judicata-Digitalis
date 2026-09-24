/* ------------------------------------------------------------------ *
 *  Mediation lifecycle (Feature 12) — one case, citizen to closure,
 *  read ONLY from the shared record (application + audit + tasks).
 *
 *  Each stage says who owns it (citizen · system · officer · mediator ·
 *  party · panel lawyer · DBLA) and which human checkpoint it is:
 *  SYSTEM SUGGESTION → OFFICER REVIEW REQUIRED → OFFICER CONFIRMED →
 *  MEDIATOR ACTION → COMPLETED.
 *  Two branches after the session: settlement (→ DLO verification →
 *  testimonial → case closed) and failure (→ failure record → officer review → panel lawyer).
 *
 *  Works for every mediation case, not only the demo. Pure.
 * ------------------------------------------------------------------ */

import type { ApplicationRecord, AuditEntry, Task } from "./schema";

type Bi = { bn: string; en: string };
const B = (bn: string, en: string): Bi => ({ bn, en });

export type LifecycleLane = "CITIZEN" | "SYSTEM" | "OFFICER" | "MEDIATOR" | "PARTY" | "CLO" | "LAWYER" | "DBLA";
export type Checkpoint =
  | "CITIZEN_ACTION"
  | "SYSTEM_CHECK"
  | "SYSTEM_SUGGESTION"
  | "OFFICER_REVIEW_REQUIRED"
  | "OFFICER_CONFIRMED"
  | "MEDIATOR_ACTION"
  | "PARTY_ACTION"
  | "LAWYER_ACTION"
  | "COMPLETED"
  | "OVERSIGHT";
export type StageState = "DONE" | "CURRENT" | "UPCOMING";
export type LifecycleBranch = "SETTLEMENT" | "FAILURE";

export type StageKey =
  | "submitted"
  | "intake"
  | "verification"
  | "case_id"
  | "pathway_suggested"
  | "pathway_confirmed"
  | "eligibility"
  | "recommended"
  | "assigned"
  | "workspace"
  | "contact"
  | "session"
  | "settlement"
  | "execution"
  | "mediator_confirmation"
  | "dlo_verification"
  | "testimonial"
  | "closed"
  | "failed"
  | "failure_review"
  | "legal_pathway"
  | "shortlist"
  | "lawyer_offer"
  | "lawyer_accepted"
  | "oversight";

export type LifecycleStage = {
  key: StageKey;
  lane: LifecycleLane;
  title: Bi;
  /** What this stage is for — one line a judge can read. */
  purpose: Bi;
  state: StageState;
  checkpoint: Checkpoint;
  /** Who did it and when (from the audit), once done. */
  by: { name: string; role: string; at: string } | null;
  /** Facts from the record that prove it happened. */
  facts: string[];
  /** The real screen that owns this step. */
  href: string;
};

const find = (a: ApplicationRecord, action: string | RegExp, pred?: (e: AuditEntry) => boolean) =>
  [...a.audit].reverse().find((e) => (typeof action === "string" ? e.action === action : action.test(e.action)) && (!pred || pred(e))) ?? null;
const first = (a: ApplicationRecord, action: string) => a.audit.find((e) => e.action === action) ?? null;
const words = (s: unknown) => String(s ?? "").replaceAll("_", " ").toLowerCase();
const ROLE: Record<string, string> = { applicant: "Applicant", representative: "Representative", udc_operator: "UDC operator", helpline_agent: "Helpline agent", system: "System", dlao: "Legal Aid Officer", clo: "CLO", mediator: "Mediator", panel_lawyer: "Panel lawyer", dlo_staff: "Office staff", admin: "DBLA / Admin", debug: "Debug" };
const by = (e: AuditEntry | null) => {
  if (!e) return null;
  const d = e.detail ?? {};
  const name = String(d.officer ?? d.mediator ?? d.lawyer ?? d.staff ?? "");
  return { name: name && name.toLowerCase() !== e.role ? name : "", role: ROLE[e.role] ?? e.role, at: e.at };
};

/** Which branch the case is on (null until the mediator records a final outcome). */
export function lifecycleBranch(a: ApplicationRecord): LifecycleBranch | null {
  const ws = a.mediation?.workspace;
  if (ws?.failureRecord || ws?.outcomes.some((o) => o.kind === "MEDIATION_FAILED")) return "FAILURE";
  if (ws?.settlementWorkflow || ws?.outcomes.some((o) => o.kind === "SETTLEMENT_REACHED")) return "SETTLEMENT";
  return null;
}

export function mediationLifecycle(a: ApplicationRecord, tasks: Task[], expected: LifecycleBranch = "SETTLEMENT") {
  const id = encodeURIComponent(a.applicationId);
  const officerHref = `/dashboard/dlo#app/${id}`;
  const mediatorHref = `/dashboard/mediator#case/${id}`;
  const r = a.review;
  const pc = a.pathwayClassification;
  const m = a.mediation;
  const ws = m?.workspace ?? null;
  const flow = ws?.settlementWorkflow ?? null;
  const fail = ws?.failureRecord ?? null;
  const assigned = m?.assignments.find((x) => x.assignedAt) ?? null;
  const recommended = [...(m?.assignments ?? [])].reverse().find((x) => x.status !== "WITHDRAWN") ?? null;
  const declined = m?.assignments.filter((x) => x.status === "DECLINED" || x.status === "EXPIRED") ?? [];
  const completedSession = ws?.sessions.find((s) => s.status === "COMPLETED") ?? null;
  const branch = lifecycleBranch(a) ?? expected;
  const lawyerOffer = a.lawyer?.assignments[a.lawyer.assignments.length - 1] ?? null;
  const lawyerAccess = a.lawyer?.access.find((x) => !x.revokedAt) ?? null;
  const caucus = ws?.mediatorConfidential?.caucusNotes.length ?? ws?.caucus?.length ?? 0;

  type Draft = Omit<LifecycleStage, "state" | "checkpoint"> & { done: boolean; pending: Checkpoint; doneAs: Checkpoint };
  const S = (key: StageKey, lane: LifecycleLane, title: Bi, purpose: Bi, done: boolean, pending: Checkpoint, doneAs: Checkpoint, ev: AuditEntry | null, facts: (string | false | null | undefined)[], href: string, who?: string): Draft => {
    const b = done ? by(ev) : null;
    // System and party stages are recorded by a person's action — say so instead of crediting the person.
    const shown = !b ? null : lane === "SYSTEM" ? { name: b.name || b.role !== "System" ? `run by ${b.name || b.role}` : "", role: "System", at: b.at } : lane === "PARTY" ? { name: `recorded by ${b.name || b.role}`, role: "Parties", at: b.at } : { ...b, name: who ?? b.name };
    return { key, lane, title, purpose, done, pending, doneAs, by: shown, facts: done ? facts.filter((f): f is string => !!f) : [], href };
  };
  const d0 = pc?.decisions.find((d) => d.action !== "INFO_REQUESTED") ?? null;

  const common: Draft[] = [
    S("submitted", "CITIZEN", B("নাগরিক আবেদন জমা দেন", "Citizen submits the application"), B("নাগরিক নিজের ভাষায় সমস্যা বলেন — ওয়েব, UDC, হেল্পলাইন বা IVR থেকে।", "The citizen describes the problem in their own words — web, UDC, helpline or IVR."),
      !!first(a, "application.submitted"), "CITIZEN_ACTION", "CITIZEN_ACTION", first(a, "application.submitted"), [`${a.channel.code}`, `${words(a.data.matter.category)}`], "/dashboard/citizen"),
    S("intake", "SYSTEM", B("ইনটেক যাচাই ও রেফারেন্স", "Intake checks & reference number"), B("প্রযুক্তি: ফোন OTP, আবশ্যিক তথ্য, সঠিক অফিসে পাঠানো, অগ্রাধিকার পরামর্শ।", "Technology: phone OTP, required fields, routing to the right office, advisory priority."),
      !!first(a, "application.submitted"), "SYSTEM_CHECK", "SYSTEM_CHECK", first(a, "application.submitted"), [a.applicationId, a.validation.valid ? "required fields complete" : `missing: ${a.validation.missing.join(", ")}`, `routed to ${a.routing.office}`, `priority suggestion: ${a.routing.recommendedPriority} (advisory)`], officerHref),
    S("verification", "OFFICER", B("লিগ্যাল এইড অফিসারের যাচাই", "Legal Aid Officer verification"), B("মানুষ যাচাই করেন: পরিচয় ও NID, নথি, তথ্য, যোগ্যতা।", "A person checks identity & NID, documents, facts and eligibility."),
      r?.eligibility.state === "COMPLETED", "OFFICER_REVIEW_REQUIRED", "OFFICER_CONFIRMED", find(a, "eligibility.assessed"), [r ? `identity: ${words(r.identity.outcome)}` : null, r ? `facts: ${words(r.facts.outcome)}` : null, "eligibility assessed"], officerHref),
    S("case_id", "OFFICER", B("যোগ্যতার সিদ্ধান্ত → কেস আইডি", "Eligibility decision → case ID"), B("কেস আইডি শুধু কর্মকর্তা গ্রহণ করলেই তৈরি হয় — সিস্টেম নিজে কেস খোলে না।", "A case ID exists only after an officer accepts — the system never opens a case by itself."),
      !!a.caseId, "OFFICER_REVIEW_REQUIRED", "OFFICER_CONFIRMED", find(a, "case.created"), [a.caseId ?? "", r?.decision ? `decision: ${words(r.decision.decision)} — “${r.decision.reason}”` : null], officerHref),
    S("pathway_suggested", "SYSTEM", B("সিস্টেম আইনি পথ চিহ্নিত করে", "System identifies the legal pathway"), B("নিয়মভিত্তিক পরামর্শ (AI নয়): বিরোধের ধরন ও আদালতের অবস্থা থেকে।", "Rule-based suggestion (not AI) from the dispute type and court status."),
      !!pc?.assessments.length, "SYSTEM_SUGGESTION", "SYSTEM_SUGGESTION", find(a, "pathway.system_assessed"), [pc?.assessments.length ? `suggests: ${words(pc.assessments[pc.assessments.length - 1].result)}` : null, pc?.assessments.length ? `rule ${pc.assessments[pc.assessments.length - 1].ruleId ?? "—"} · ${pc.assessments[pc.assessments.length - 1].rulesVersion}` : null, "advisory only"], officerHref),
    S("pathway_confirmed", "OFFICER", B("কর্মকর্তা পথ নিশ্চিত করেন", "Officer confirms the pathway"), B("সিদ্ধান্ত কর্মকর্তার: নিশ্চিত, পরিবর্তন বা আরও তথ্য — কারণসহ রেকর্ড।", "The officer decides — confirm, change or ask for more — with a recorded reason."),
      !!d0, "OFFICER_REVIEW_REQUIRED", "OFFICER_CONFIRMED", first(a, "pathway.officer_confirmed") ?? first(a, "pathway.officer_changed"), [d0 ? `${d0.action === "CONFIRMED" ? "confirmed" : "changed to"}: ${words(d0.finalPathway)}` : null, d0 ? `“${d0.reason}”` : null], officerHref),
    S("eligibility", "SYSTEM", B("মধ্যস্থতাকারীর যোগ্যতা যাচাই", "Mediator eligibility check"), B("৬টি কঠোর ফিল্টার: অবস্থা, সনদ, এলাকা, সময়, স্বার্থের সংঘাত, মামলার ধরন। কোনো 'সেরা' স্কোর নেই।", "Six hard filters: status, certification, jurisdiction, availability, conflict, case type. No 'best' score."),
      !!m?.runs.length, "SYSTEM_SUGGESTION", "SYSTEM_SUGGESTION", find(a, "mediation.eligibility_checked"), [m?.runs.length ? `${m.runs[m.runs.length - 1].candidates.filter((c) => c.eligible).length} eligible of ${m.runs[m.runs.length - 1].candidates.length} in the district` : null], officerHref),
    S("recommended", "OFFICER", B("কর্মকর্তা সেরা পছন্দকে প্রস্তাব পাঠান", "Officer sends the offer to a best pick"), B("সিস্টেম যোগ্যদের ক্রম দেখায় (অভিজ্ঞতা, কাজের চাপ, সময়, রেকর্ড); কর্মকর্তা কাকে প্রস্তাব দেবেন বেছে নেন।", "The system ranks the eligible mediators (experience, workload, availability, record); the officer chooses whom to offer the case to."),
      !!recommended, "OFFICER_REVIEW_REQUIRED", "OFFICER_CONFIRMED", find(a, "mediation.mediator_offered") ?? find(a, "mediation.mediator_recommended"), [recommended ? `${recommended.mediatorName}${recommended.offer ? ` · rank #${recommended.offer.rank} (${recommended.offer.score}/100)` : ""}` : null, declined.length ? `${declined.length} declined / no answer → offered to the next automatically` : null], officerHref),
    S("assigned", "MEDIATOR", B("মধ্যস্থতাকারী কেস গ্রহণ করেন", "Mediator accepts the case"), B("প্রস্তাব পেয়ে মধ্যস্থতাকারী গ্রহণ বা প্রত্যাখ্যান করেন; প্রত্যাখ্যান হলে পরবর্তী জনকে স্বয়ংক্রিয়ভাবে প্রস্তাব যায়। গ্রহণের পর শুধু প্রয়োজনীয় তথ্য দেখেন।", "The mediator accepts or declines the offer; a decline auto-offers the next-ranked mediator. After accepting they see need-to-know data only."),
      !!assigned, "MEDIATOR_ACTION", "MEDIATOR_ACTION", find(a, "mediation.mediator_accepted") ?? find(a, "mediation.mediator_assigned"), [assigned ? `${assigned.mediatorName} accepted${assigned.offer?.via === "AUTO_NEXT" ? " (auto-next offer)" : ""}` : null, assigned?.conflictCheck ? (assigned.conflictCheck.clear ? "conflict check clear" : "conflict found") : null], mediatorHref),
    S("workspace", "MEDIATOR", B("মধ্যস্থতাকারীর কর্মক্ষেত্র", "Mediator workspace"), B("মধ্যস্থতাকারী শুধু নিজের নিয়োগকৃত কেস দেখেন; NID ও ফোন নম্বর লুকানো।", "The mediator sees only assigned cases; NID and phone numbers stay hidden."),
      !!first(a, "mediation.workspace_opened") || !!ws?.sessions.length, "MEDIATOR_ACTION", "MEDIATOR_ACTION", first(a, "mediation.workspace_opened"), ["need-to-know view"], mediatorHref),
    S("contact", "MEDIATOR", B("পক্ষদের সাথে যোগাযোগ", "Party contact"), B("সেশন নির্ধারণ; আবেদনকারীকে নিরাপদ সময়ে নিরপেক্ষ SMS (সিমুলেটেড)।", "Session scheduled; neutral SMS to the applicant at their safe time (simulated)."),
      !!ws?.sessions.length, "MEDIATOR_ACTION", "MEDIATOR_ACTION", first(a, "mediation.session_scheduled"), [ws?.sessions[0] ? `session 1 · ${words(ws.sessions[0].channel)}${ws.sessions[0].place ? ` · ${ws.sessions[0].place}` : ""}` : null, find(a, "notice.sms_sent") ? "safe SMS sent (simulated gateway)" : null], mediatorHref),
    S("session", "MEDIATOR", B("মধ্যস্থতা সেশন", "Mediation session"), B("মধ্যস্থতাকারী সেশন পরিচালনা করেন: উপস্থিতি, একান্ত আলোচনা (গোপন), আলোচ্য বিষয়।", "The mediator runs the session: attendance, private caucus (confidential), issues."),
      !!completedSession, "MEDIATOR_ACTION", "MEDIATOR_ACTION", find(a, "mediation.session_ended"), [completedSession ? `attendance: applicant ${words(completedSession.attendance.APPLICANT.status)}, respondent ${words(completedSession.attendance.RESPONDENT.status)}` : null, caucus ? `${caucus} confidential caucus note(s) — content never shown outside the mediator workspace` : null], mediatorHref),
  ];

  const settlement: Draft[] = [
    S("settlement", "MEDIATOR", B("নিষ্পত্তি রেকর্ড", "Settlement recorded"), B("মধ্যস্থতাকারী পক্ষদের সম্মত শর্ত লেখেন — চাইলে সিমুলেটেড AI খসড়া থেকে শুরু করে সম্পাদনা করেন; খসড়া কোনো টাকার অঙ্ক দেয় না। এখনো চূড়ান্ত নয়।", "The mediator writes the terms the parties agreed — optionally starting from a simulated AI draft they edit; the draft never sets amounts. Not final yet."),
      !!flow, "MEDIATOR_ACTION", "MEDIATOR_ACTION", find(a, "mediation.outcome_recorded", (e) => e.detail?.kind === "SETTLEMENT_REACHED"), [flow ? flow.agreementId : null, flow ? `“${flow.terms.agreedResolution}”` : null], mediatorHref),
    S("execution", "PARTY", B("পক্ষদের চুক্তি সম্পাদন", "Parties execute the agreement"), B("দুই পক্ষই স্বাক্ষর করেন (প্রোটোটাইপে সিমুলেটেড)। 'Accept' ক্লিক করলেই চুক্তি হয় না।", "Both parties sign (simulated in the prototype). Clicking 'accept' is not an agreement."),
      !!flow && Object.values(flow.execution).every((x) => x.status === "SIGNED"), "PARTY_ACTION", "PARTY_ACTION", find(a, "settlement.party_signed"), ["applicant signed", "respondent signed", "simulated signature"], mediatorHref),
    S("mediator_confirmation", "MEDIATOR", B("মধ্যস্থতাকারীর নিশ্চিতকরণ", "Mediator confirmation"), B("মধ্যস্থতাকারী নিশ্চিত করে লিগ্যাল এইড অফিসারের (DLO) কাছে যাচাইয়ের জন্য পাঠান।", "The mediator confirms and submits the agreement to the Legal Aid Officer (DLO) for verification."),
      flow?.mediatorConfirmation.status === "CONFIRMED", "MEDIATOR_ACTION", "MEDIATOR_ACTION", find(a, "settlement.submitted_for_certification") ?? find(a, "settlement.mediator_confirmed"), ["submitted for DLO verification"], mediatorHref),
    S("dlo_verification", "OFFICER", B("লিগ্যাল এইড অফিসারের যাচাই", "Legal Aid Officer (DLO) verification"), B("শেষ ধাপে লিগ্যাল এইড অফিসার (DLO) শর্ত, দুই পক্ষের স্বাক্ষর ও মধ্যস্থতাকারীর নিশ্চিতকরণ দেখে যাচাই করেন — তবেই এটি বৈধ ফলাফল।", "At the very end the Legal Aid Officer (DLO) checks the terms, both signatures and the mediator's confirmation, then verifies — only then is it a valid outcome."),
      !!flow?.resolution, "OFFICER_REVIEW_REQUIRED", "OFFICER_CONFIRMED", find(a, "settlement.certified"), [flow?.resolution ? `verified by ${flow.resolution.certifyingOfficer}` : null, flow?.resolution ? `“${flow.resolution.outcome}”` : null], `/dashboard/dlo/settlements/${id}`),
    S("testimonial", "OFFICER", B("নিষ্পত্তি প্রত্যয়নপত্র (টেস্টিমোনিয়াল)", "Settlement testimonial"), B("যাচাইয়ের পর DLO প্রত্যয়নপত্র তৈরি করে নাগরিককে পাঠান; নাগরিক ৭ দিনের মধ্যে আপিল করতে পারেন।", "After verifying, the DLO generates the testimonial and sends it to the citizen, who can appeal within 7 days."),
      !!flow?.testimonial, "OFFICER_REVIEW_REQUIRED", "OFFICER_CONFIRMED", find(a, "settlement.testimonial_issued"), [flow?.testimonial ? flow.testimonial.testimonialId : null, flow?.testimonial ? `issued by ${flow.testimonial.issuedByName}` : null, "DEMO / SIMULATED seal"], `/dashboard/dlo/settlements/${id}`),
    S("closed", "CITIZEN", B("নাগরিকের উত্তর → কেস বন্ধ", "Citizen's response → case closed"), B("নাগরিক মেনে নিলে, ৭ দিনে আপিল না করলে, বা DLO আপিল প্রত্যাখ্যান করলে কেস নিষ্পন্ন হিসেবে বন্ধ হয়। আপিল গৃহীত হলে DLO প্যানেল আইনজীবী নিয়োগ করেন।", "The case closes as resolved when the citizen accepts, does not appeal within 7 days, or the DLO rejects the appeal. If the DLO accepts an appeal, a panel lawyer is assigned."),
      !!flow?.testimonial && !!a.closedAt, "COMPLETED", "COMPLETED", find(a, "case.closed"), [flow?.appeal ? `appeal window: ${words(flow.appeal.status)}` : null, `application status: ${words(a.status)}`, a.closedAt ? "closed" : null], "/dashboard/citizen"),
  ];

  const failure: Draft[] = [
    S("failed", "MEDIATOR", B("মধ্যস্থতা ব্যর্থ — আনুষ্ঠানিক রেকর্ড", "Mediation failed — formal record"), B("মধ্যস্থতাকারী কারণসহ ব্যর্থতার রেকর্ড করেন (গোপন আলোচনা বাদে); সিস্টেম পরবর্তী পথ প্রস্তাব করে।", "The mediator records the failure with reasons (no caucus content); the system suggests a next pathway."),
      !!fail, "MEDIATOR_ACTION", "MEDIATOR_ACTION", find(a, "mediation.failure_record_created") ?? find(a, "mediation.outcome_recorded"), [fail ? fail.recordId : null, fail ? `system suggestion: ${words(fail.systemSuggestion.pathway)} (advisory)` : null], mediatorHref),
    S("failure_review", "OFFICER", B("কর্মকর্তার ব্যর্থতা / রেফারেল পর্যালোচনা", "Officer reviews the failure / referral"), B("প্রস্তাবিত পথ কর্মকর্তা নিশ্চিত বা পরিবর্তন করেন, কারণসহ।", "The officer confirms or changes the suggested pathway, with a reason."),
      fail?.status === "REFERRAL_CONFIRMED", "OFFICER_REVIEW_REQUIRED", "OFFICER_CONFIRMED", find(a, "mediation.referral_confirmed"), [fail?.confirmedPathway ? `confirmed: ${words(fail.confirmedPathway)}` : null, fail?.officerReview.note ? `“${fail.officerReview.note}”` : null], `/dashboard/dlo/mediation-outcomes/${id}`),
    S("legal_pathway", "OFFICER", B("উপযুক্ত আইনি পথ", "Appropriate legal pathway"), B("কেস আইনজীবী পথে যায় — প্রতিনিধিত্ব / মামলা।", "The case moves to the lawyer pathway — representation / litigation."),
      r?.pathway?.type === "LAWYER" || (!!fail && fail.status === "REFERRAL_CONFIRMED" && fail.confirmedPathway !== "LAWYER_ASSIGNMENT"), "OFFICER_REVIEW_REQUIRED", "OFFICER_CONFIRMED", find(a, "mediation.referral_confirmed"), [r?.pathway ? `pathway: ${words(r.pathway.type)}` : null, find(a, "mediation.lawyer_handoff_created") ? "lawyer assignment task opened for the office" : null], officerHref),
    S("shortlist", "SYSTEM", B("আইনজীবী শর্টলিস্ট", "Panel lawyer shortlist"), B("নিয়মভিত্তিক ক্রম: এলাকা, বিষয়, কাজের চাপ, উপস্থিতি — কর্মকর্তার বিবেচনার জন্য।", "Rule-based ranking — district, practice area, workload, attendance — for the officer to consider."),
      !!a.lawyer?.shortlists.length, "SYSTEM_SUGGESTION", "SYSTEM_SUGGESTION", find(a, "lawyer.shortlist_generated"), [a.lawyer?.shortlists.length ? `${a.lawyer.shortlists[a.lawyer.shortlists.length - 1].candidates.length} lawyer(s) shortlisted` : null], officerHref),
    S("lawyer_offer", "OFFICER", B("কর্মকর্তা আইনজীবীকে কেস দেন", "Officer offers the case to a lawyer"), B("কাকে প্রস্তাব দেওয়া হবে তা কর্মকর্তা ঠিক করেন।", "The officer decides who is offered the case."),
      !!lawyerOffer, "OFFICER_REVIEW_REQUIRED", "OFFICER_CONFIRMED", find(a, "lawyer.dlao_choice") ?? find(a, "lawyer.offered"), [lawyerOffer ? lawyerOffer.lawyerName : null], officerHref),
    S("lawyer_accepted", "LAWYER", B("প্যানেল আইনজীবী দায়িত্ব নেন", "Panel lawyer takes the case"), B("আইনজীবী গ্রহণ করলে পূর্ণ কেস রেকর্ডে প্রবেশ পান; প্রতিনিধিত্ব শুরু।", "On acceptance the lawyer gets the full case record; representation begins."),
      !!lawyerAccess, "LAWYER_ACTION", "COMPLETED", find(a, "lawyer.access_granted") ?? find(a, "lawyer.accepted"), [lawyerAccess ? `${lawyerAccess.lawyerName} — full case record` : null], "/dashboard/lawyer#intake", lawyerAccess?.lawyerName),
  ];

  const oversight = S("oversight", "DBLA", B("DBLA তত্ত্বাবধান", "DBLA oversight"), B("জাতীয় সংস্থা সব জেলার মধ্যস্থতা ও অডিট দেখে — কোনো সিদ্ধান্ত বদলায় না।", "The national body sees mediation and audit across districts — it changes no decision."), true, "OVERSIGHT", "OVERSIGHT", null, ["read-only monitoring"], "/dashboard/admin#mediation");

  const drafts = [...common, ...(branch === "FAILURE" ? failure : settlement)];
  const cur = drafts.findIndex((d) => !d.done);
  const stages: LifecycleStage[] = [...drafts, oversight].map((d, i) => {
    const state: StageState = d.key === "oversight" ? "DONE" : d.done ? "DONE" : i === cur ? "CURRENT" : "UPCOMING";
    const { done: _d, pending, doneAs, ...rest } = d;
    void _d;
    return { ...rest, state, checkpoint: state === "DONE" ? doneAs : pending };
  });
  return { branch, branchKnown: lifecycleBranch(a) !== null, stages, current: cur >= 0 ? stages[cur] : null, complete: cur < 0 };
}
