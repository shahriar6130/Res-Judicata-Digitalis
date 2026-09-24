"use client";

/* ------------------------------------------------------------------ *
 *  Citizen view of the shared record.
 *
 *  The citizen dashboard (home, sidebar, "My cases", case detail) used
 *  hard-coded demo data. These hooks replace it with the
 *  LOGGED-IN citizen's own applications from localStorage["dlas.db.v1"]:
 *
 *    mine = applications where
 *      session.meta.citizenId === account.citizenId       (filed after login)
 *      OR applicant.phone === account.phone              (any door: IVR/USSD/UDC)
 *      OR filedBy.phone   === account.phone              (filed as representative)
 *    An application having an open follow-up task never grants access.
 *
 *  Output uses the existing CaseRecord / CitizenCaseSummary shapes so the
 *  existing UI renders unchanged. Nothing here is invented: timeline steps
 *  after the record's current stage are shown as "upcoming".
 * ------------------------------------------------------------------ */

import { useMemo, useSyncExternalStore } from "react";
import type { CaseRecord, CaseStatus, CitizenCaseSummary, DocumentRecord, TimelineEvent } from "../case-demo";
import { useDlasDb } from "./store";
import { DISTRICTS, DOC_TYPES, MATTERS, formatDateTime, label, safeTimeLabel } from "./reference";
import { PIPELINE, type ApplicationRecord, type PathwayType, type DocType, type CitizenAccount, type DlasDb, type UdcCentre } from "./schema";

const CURRENT_KEY = "dlas.citizen.current";

function subscribe(cb: () => void) {
  const on = () => cb();
  window.addEventListener("storage", on);
  window.addEventListener("dlas:db-changed", on);
  return () => {
    window.removeEventListener("storage", on);
    window.removeEventListener("dlas:db-changed", on);
  };
}
function currentId(): string | null {
  try {
    return window.localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

/** The logged-in citizen account (undefined when logged out or during SSR). */
export function useCurrentCitizen(): CitizenAccount | undefined {
  const id = useSyncExternalStore(subscribe, currentId, () => null);
  const db = useDlasDb();
  return id ? db.citizens.find((c) => c.citizenId === id) : undefined;
}

export function applicationsFor(db: DlasDb, account: CitizenAccount | undefined): ApplicationRecord[] {
  if (!account) return [];
  // Session ownership and phone matches are the only access paths.
  // Tasks describe work on an application; they do not identify its citizen.
  const sessionById = new Map(db.sessions.map((s) => [s.sessionId, s]));
  return db.applications
    .filter((a) => {
      const s = sessionById.get(a.channel.sessionId);
      if (s?.meta.citizenId === account.citizenId) return true;
      if (a.data.applicant.phone === account.phone) return true;
      if (a.data.filedBy.phone === account.phone) return true;
      return false;
    })
    .sort((x, y) => y.submittedAt.localeCompare(x.submittedAt));
}

function statusOf(a: ApplicationRecord): CaseStatus {
  switch (a.status) {
    case "UNDER_REVIEW":
    case "INFO_REQUESTED":
      return "under_review";
    case "ACCEPTED":
      return "approved";
    case "RESOLVED":
      return "resolved";
    case "REJECTED":
    case "WITHDRAWN":
    case "CLOSED":
      return "closed";
    default:
      return "submitted";
  }
}

const fmt = (iso: string, lang: "bn" | "en") =>
  new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

function title(a: ApplicationRecord): { bn: string; en: string } {
  const who = a.data.applicant.fullName ?? "—";
  const other = a.data.matter.opposingParty?.split(",")[0]?.trim();
  const matterBn = label(MATTERS, a.data.matter.category, "bn");
  const matterEn = label(MATTERS, a.data.matter.category, "en");
  return other
    ? { bn: `${who} বনাম ${other}`, en: `${who} v. ${other}` }
    : { bn: `${who} — ${matterBn}`, en: `${who} — ${matterEn}` };
}

export function toSummary(a: ApplicationRecord): CitizenCaseSummary {
  const t = title(a);
  const other = a.data.matter.opposingParty?.split(",")[0]?.trim() ?? "—";
  return {
    id: a.applicationId,
    displayId: a.caseId ? `#${a.caseId}` : `#${a.applicationId}`,
    status: statusOf(a),
    complainantBn: a.data.applicant.fullName ?? "—",
    complainantEn: a.data.applicant.fullName ?? "—",
    respondentBn: other,
    respondentEn: other,
    titleBn: t.bn,
    titleEn: t.en,
  };
}

const STAGE_TEXT: Record<string, { tBn: string; tEn: string; dBn: string; dEn: string }> = {
  ACCESS_APPLICATION: { tBn: "আবেদন জমা হয়েছে", tEn: "Application submitted", dBn: "আবেদন আইডি প্রদান করা হয়েছে", dEn: "Application ID issued" },
  VERIFICATION_REVIEW: { tBn: "যাচাই ও যোগ্যতা পর্যালোচনা", tEn: "Verification & eligibility review", dBn: "জেলা লিগ্যাল এইড অফিসার পর্যালোচনা করবেন", dEn: "The District Legal Aid Officer will review it" },
  CASE_OPENED: { tBn: "কেস খোলা", tEn: "Case opened", dBn: "গ্রহণের পর কেস আইডি দেওয়া হবে", dEn: "A Case ID is issued after acceptance" },
  SERVICE_DELIVERY: { tBn: "সেবা: মধ্যস্থতা / আইনজীবী / রেফারেল", tEn: "Service: mediation / lawyer / referral", dBn: "অফিসার সিদ্ধান্ত নেবেন", dEn: "Decided by the officer" },
  FOLLOW_UP: { tBn: "ফলো-আপ", tEn: "Follow-up", dBn: "", dEn: "" },
  OUTCOME: { tBn: "ফলাফল", tEn: "Outcome", dBn: "", dEn: "" },
  CLOSURE: { tBn: "নিষ্পত্তি", tEn: "Closure", dBn: "", dEn: "" },
};

function auditAt(a: ApplicationRecord, action: string): string | null {
  return a.audit.find((e) => e.action === action)?.at ?? null;
}

const PATHWAY_TEXT: Record<PathwayType, { bn: string; en: string }> = {
  GRAM_ADALAT: { bn: "গ্রাম আদালতে প্রেরিত", en: "Referred to the Gram Adalat (village court)" },
  MEDIATION: { bn: "মধ্যস্থতায় প্রেরিত — মধ্যস্থতাকারী যোগাযোগ করবেন", en: "Referred to mediation — a mediator will contact you" },
  REFERRAL: { bn: "অন্য সেবায় রেফার করা হয়েছে — অফিস বিস্তারিত জানাবে", en: "Referred to another service — the office will tell you the details" },
  LAWYER: { bn: "প্যানেল আইনজীবী নিয়োগ করা হবে", en: "A panel lawyer will be assigned" },
};
const FAILURE_PATHWAY_TEXT = {
  COURT_LEGAL_PATHWAY: { bn: "আদালত / আইনি পথ", en: "Court / legal pathway" },
  LAWYER_ASSIGNMENT: { bn: "আইনজীবী নিয়োগ", en: "Lawyer assignment" },
  FURTHER_LEGAL_AID_REVIEW: { bn: "আরও লিগ্যাল এইড পর্যালোচনা", en: "Further legal aid review" },
  OTHER_REFERRAL: { bn: "অন্য রেফারেল", en: "Other referral" },
} as const;

function timeline(a: ApplicationRecord): TimelineEvent[] {
  // Rejected: the record is closed after verification — show exactly that.
  if (a.status === "REJECTED" && a.review?.decision) {
    const d = a.review.decision;
    const recv = a.review.receivedAt;
    return [
      { id: "ACCESS_APPLICATION", titleBn: STAGE_TEXT.ACCESS_APPLICATION.tBn, titleEn: STAGE_TEXT.ACCESS_APPLICATION.tEn, descriptionBn: STAGE_TEXT.ACCESS_APPLICATION.dBn, descriptionEn: STAGE_TEXT.ACCESS_APPLICATION.dEn, dateBn: fmt(a.submittedAt, "bn"), dateEn: fmt(a.submittedAt, "en"), state: "completed" },
      { id: "VERIFICATION_REVIEW", titleBn: STAGE_TEXT.VERIFICATION_REVIEW.tBn, titleEn: STAGE_TEXT.VERIFICATION_REVIEW.tEn, descriptionBn: `${a.review.officerName} পর্যালোচনা করেছেন`, descriptionEn: `Reviewed by ${a.review.officerName}`, dateBn: fmt(recv, "bn"), dateEn: fmt(recv, "en"), state: "completed" },
      { id: "CLOSED", titleBn: "আবেদন গৃহীত হয়নি — বন্ধ", titleEn: "Not accepted — application closed", descriptionBn: `কারণ: ${d.reason} · প্রশ্ন বা আপিলের জন্য ১৬৬৯৯`, descriptionEn: `Reason: ${d.reason} · Call 16699 to ask or appeal`, dateBn: fmt(d.at, "bn"), dateEn: fmt(d.at, "en"), state: "completed" },
    ];
  }
  // Step 1 is done at submit; the next backbone stage is "current" (waiting on a human).
  const doneUpTo = PIPELINE.indexOf(a.stage);
  const base = PIPELINE.map((stage, i) => {
    const s = STAGE_TEXT[stage];
    const state: TimelineEvent["state"] = i <= doneUpTo ? "completed" : i === doneUpTo + 1 ? "current" : "upcoming";
    return {
      id: stage,
      titleBn: s.tBn,
      titleEn: s.tEn,
      descriptionBn: stage === "CASE_OPENED" && a.caseId ? `কেস আইডি ${a.caseId}` : stage === "SERVICE_DELIVERY" && a.review?.pathway ? `${PATHWAY_TEXT[a.review.pathway.type].bn}${lawyerLine(a, "bn")}` : stage === "FOLLOW_UP" ? nextHearingLine(a, "bn") ?? s.dBn : s.dBn,
      descriptionEn: stage === "CASE_OPENED" && a.caseId ? `Case ID ${a.caseId}` : stage === "SERVICE_DELIVERY" && a.review?.pathway ? `${PATHWAY_TEXT[a.review.pathway.type].en}${lawyerLine(a, "en")}` : stage === "FOLLOW_UP" ? nextHearingLine(a, "en") ?? s.dEn : s.dEn,
      dateBn: stageDate(a, i) ? fmt(stageDate(a, i)!, "bn") : "",
      dateEn: stageDate(a, i) ? fmt(stageDate(a, i)!, "en") : "",
      state,
    };
  });
  // Lawyer path: DLAO recorded the court outcome, then closed the case.
  const comp = a.lawyer?.completion;
  if (comp) {
    const o = base.find((x) => x.id === "OUTCOME");
    const word = { WON: ["জয়", "Won"], LOST: ["হার", "Lost"], SETTLED: ["আপস", "Settled"], WITHDRAWN_BY_CLIENT: ["আপনি প্রত্যাহার করেছেন", "Withdrawn by you"], OTHER: ["অন্যান্য", "Other"], JUDGMENT: ["রায়", "Judgment"] }[comp.outcome];
    if (o) Object.assign(o, { descriptionBn: `আদালতের ধাপ শেষ — ফলাফল: ${word[0]} · ${comp.reason}`, descriptionEn: `Court stage complete — outcome: ${word[1]} · ${comp.reason}` });
    const cl = a.lawyer?.closure;
    const c = base.find((x) => x.id === "CLOSURE");
    if (c && cl) Object.assign(c, { descriptionBn: `কেস বন্ধ করেছেন ${cl.byName} · ${cl.reason}`, descriptionEn: `Case closed by ${cl.byName} · ${cl.reason}`, state: "completed" as const });
  }
  const tst = a.mediation?.workspace?.settlementWorkflow?.testimonial;
  if (tst) {
    const c = base.find((x) => x.id === "CLOSURE");
    const ap = a.mediation?.workspace?.settlementWorkflow?.appeal ?? null;
    const closed = !!a.closedAt;
    const tail = ap?.status === "FILED" ? { bn: "আপনার আপিল অফিসে আছে", en: "your appeal is with the office" } : ap?.status === "ACCEPTED" ? { bn: "আপিল গৃহীত — আইনজীবী নিয়োগ হবে", en: "appeal accepted — a lawyer will be assigned" } : closed ? { bn: "কেস বন্ধ", en: "case closed" } : { bn: "মেনে নিন বা ৭ দিনের মধ্যে আপিল করুন", en: "accept it or appeal within 7 days" };
    if (c) Object.assign(c, { descriptionBn: `মধ্যস্থতায় নিষ্পত্তি যাচাই হয়েছে — প্রত্যয়নপত্র ${tst.testimonialId} · ${tail.bn}`, descriptionEn: `Mediated settlement verified — testimonial ${tst.testimonialId} · ${tail.en}`, dateBn: fmt(tst.issuedAt, "bn"), dateEn: fmt(tst.issuedAt, "en"), state: closed ? ("completed" as const) : ("current" as const) });
  }
  const failure = a.mediation?.workspace?.failureRecord;
  if (!failure) return base;
  const officerDone = failure.status === "REFERRAL_CONFIRMED";
  const lawyerAccepted = a.lawyer?.assignments.some((x) => x.status === "ACCEPTED") ?? false;
  const handoff: TimelineEvent[] = [
    { id: `mediation-failure-${failure.recordId}`, titleBn: "মধ্যস্থতায় সমঝোতা হয়নি", titleEn: "Mediation did not settle", descriptionBn: "আনুষ্ঠানিক ফলাফল ও রেফারেল রেকর্ড তৈরি হয়েছে", descriptionEn: "A formal outcome and referral record was created", dateBn: fmt(failure.createdAt, "bn"), dateEn: fmt(failure.createdAt, "en"), state: "completed" },
    { id: `officer-review-${failure.recordId}`, titleBn: "লিগ্যাল এইড অফিসার পর্যালোচনা", titleEn: "Legal Aid Officer review", descriptionBn: officerDone && failure.confirmedPathway ? `পরবর্তী পথ: ${FAILURE_PATHWAY_TEXT[failure.confirmedPathway].bn}` : failure.status === "MORE_INFORMATION_REQUESTED" ? "আরও প্রক্রিয়াগত তথ্য চাওয়া হয়েছে" : "পরবর্তী আইনি পথ নিশ্চিত করা বাকি", descriptionEn: officerDone && failure.confirmedPathway ? `Next pathway: ${FAILURE_PATHWAY_TEXT[failure.confirmedPathway].en}` : failure.status === "MORE_INFORMATION_REQUESTED" ? "More procedural information was requested" : "The next legal pathway is awaiting confirmation", dateBn: failure.officerReview.at ? fmt(failure.officerReview.at, "bn") : "", dateEn: failure.officerReview.at ? fmt(failure.officerReview.at, "en") : "", state: officerDone ? "completed" : "current" },
  ];
  if (failure.confirmedPathway === "LAWYER_ASSIGNMENT") handoff.push({ id: `lawyer-handoff-${failure.recordId}`, titleBn: "প্যানেল আইনজীবী নিয়োগ", titleEn: "Panel-lawyer assignment", descriptionBn: lawyerAccepted ? "আইনজীবী নিয়োগ গ্রহণ করেছেন" : "মধ্যস্থতা থেকে আইনজীবী নিয়োগ কার্যপ্রবাহে হস্তান্তর হয়েছে", descriptionEn: lawyerAccepted ? "A panel lawyer accepted the assignment" : "The case was handed from mediation to the lawyer-assignment workflow", dateBn: failure.officerReview.at ? fmt(failure.officerReview.at, "bn") : "", dateEn: failure.officerReview.at ? fmt(failure.officerReview.at, "en") : "", state: lawyerAccepted ? "completed" : "current" });
  return [...base, ...handoff];
}

/** " · Panel lawyer: X" once a lawyer has accepted the case. */
function lawyerLine(a: ApplicationRecord, lang: "bn" | "en"): string {
  const s = a.lawyer?.assignments.find((x) => x.status === "ACCEPTED" || x.status === "COMPLETED");
  if (s) return lang === "bn" ? ` · প্যানেল আইনজীবী: ${s.lawyerName}` : ` · Panel lawyer: ${s.lawyerName}`;
  if (a.review?.pathway?.type === "LAWYER" && !a.lawyer?.completion) return lang === "bn" ? " · আপনার জন্য আইনজীবী খোঁজা হচ্ছে" : " · Finding a panel lawyer for you";
  return "";
}

/** Next hearing, from the lawyer's record (no dates are invented). */
function nextHearingLine(a: ApplicationRecord, lang: "bn" | "en"): string | null {
  const t = new Date().toISOString();
  const h = (a.lawyer?.hearings ?? []).filter((x) => x.at > t).sort((x, y) => x.at.localeCompare(y.at))[0];
  if (!h) return null;
  return lang === "bn" ? `পরবর্তী শুনানি: ${formatDateTime(h.at, "bn")} · ${h.court}` : `Next hearing: ${formatDateTime(h.at, "en")} · ${h.court}`;
}

function stageDate(a: ApplicationRecord, i: number): string | null {
  if (i === 0) return a.submittedAt;
  if (i === 1) return a.review?.receivedAt ?? null;
  if (i === 2) return auditAt(a, "case.created");
  if (i === 3) return a.review?.pathway?.at ?? null;
  if (i === 5) return a.lawyer?.completion?.at ?? null;
  if (i === 6) return a.lawyer?.closure?.at ?? null;
  return null;
}

function documents(a: ApplicationRecord): DocumentRecord[] {
  const out: DocumentRecord[] = [
    { id: "application", kind: "application", status: "filed", metaBn: fmt(a.submittedAt, "bn"), metaEn: fmt(a.submittedAt, "en") },
  ];
  if (a.channel.code === "IVR_16699") out.push({ id: "voice", kind: "voice", status: "filed", metaBn: "১৬৬৯৯", metaEn: "16699" });
  const nid = a.data.documents.find((d) => d.type === "NID");
  if (nid) out.push({ id: nid.docId, kind: "id", status: nid.status === "ATTACHED" ? "filed" : "pending" });
  return out;
}

export function toCaseRecord(a: ApplicationRecord): CaseRecord {
  const t = title(a);
  const office = DISTRICTS.find((d) => d.code === a.data.applicant.district);
  const filer = a.data.filedBy.kind === "REPRESENTATIVE" ? a.data.filedBy.name : a.data.applicant.fullName;
  const other = a.data.matter.opposingParty?.split(",")[0]?.trim() ?? "—";
  return {
    id: a.applicationId,
    titleBn: t.bn,
    titleEn: t.en,
    displayId: a.caseId ? `#${a.caseId}` : `#${a.applicationId}`,
    officeBn: office ? `${office.label.bn} জেলা লিগ্যাল এইড অফিস` : "—",
    officeEn: office ? `${office.label.en} District Legal Aid Office` : "—",
    applicantBn: filer ?? "—",
    applicantEn: filer ?? "—",
    beneficiaryBn: a.data.applicant.fullName ?? "—",
    beneficiaryEn: a.data.applicant.fullName ?? "—",
    complainantBn: a.data.applicant.fullName ?? "—",
    complainantEn: a.data.applicant.fullName ?? "—",
    respondentBn: other,
    respondentEn: other,
    issueBn: a.data.matter.summary ?? label(MATTERS, a.data.matter.category, "bn"),
    issueEn: a.data.matter.summary ?? label(MATTERS, a.data.matter.category, "en"),
    submittedAtBn: fmt(a.submittedAt, "bn"),
    submittedAtEn: fmt(a.submittedAt, "en"),
    safeContactTimeBn: safeTimeLabel(a.data.safeContact, "bn"),
    safeContactTimeEn: safeTimeLabel(a.data.safeContact, "en"),
    status: statusOf(a),
    mediator: null,
    timeline: timeline(a),
    messages: [],
    documents: documents(a),
  };
}

/** The logged-in citizen's cases (newest first). */
export function useCitizenCases(): CitizenCaseSummary[] {
  const db = useDlasDb();
  const me = useCurrentCitizen();
  return useMemo(() => applicationsFor(db, me).map(toSummary), [db, me]);
}

/** Raw applications owned by the citizen (no transformation). */
export function useCitizenApplications(): ApplicationRecord[] {
  const db = useDlasDb();
  const me = useCurrentCitizen();
  return useMemo(() => applicationsFor(db, me), [db, me]);
}

/** The raw shared record for one of the logged-in citizen's applications (documents, provenance…). */
export function useCitizenApplication(id: string): ApplicationRecord | null {
  const db = useDlasDb();
  const me = useCurrentCitizen();
  return useMemo(() => applicationsFor(db, me).find((x) => x.applicationId === id) ?? null, [db, me, id]);
}

/** One of the logged-in citizen's cases, or null. */
export function useCitizenCase(id: string): CaseRecord | null {
  const db = useDlasDb();
  const me = useCurrentCitizen();
  return useMemo(() => {
    const a = applicationsFor(db, me).find((x) => x.applicationId === id);
    return a ? toCaseRecord(a) : null;
  }, [db, me, id]);
}

/* ------------------------------------------------------------------ *
 *  Notifications — derived from the citizen's own records (audit,
 *  open tasks, simulated SMS). Nothing is hard-coded.
 * ------------------------------------------------------------------ */

export type CitizenNotification = {
  id: string;
  at: string;
  icon: "shield" | "user" | "check" | "bell";
  title: { bn: string; en: string };
  body: { bn: string; en: string };
  href: string;
  unread: boolean;
};

export function notificationsFor(db: DlasDb, me: CitizenAccount | undefined): CitizenNotification[] {
  if (!me) return [];
  const readAt = me.notificationsReadAt ?? "";
  const out: Omit<CitizenNotification, "unread">[] = [];
  const apps = applicationsFor(db, me);
  for (const a of apps) {
    out.push({
      id: `sub-${a.applicationId}`,
      at: a.submittedAt,
      icon: "check",
      title: { bn: `আবেদন জমা হয়েছে · ${a.applicationId}`, en: `Application submitted · ${a.applicationId}` },
      body: { bn: `${label(MATTERS, a.data.matter.category, "bn")} — ${a.routing.office}`, en: `${label(MATTERS, a.data.matter.category, "en")} — ${a.routing.office}` },
      href: `cases/${a.applicationId}`,
    });
    for (const e of a.audit) {
      const d = (e.detail ?? {}) as { title?: string; groupId?: string };
      if (e.action === "incident_group.linked") out.push({ id: `grp-${e.seq}`, at: e.at, icon: "bell", title: { bn: `আপনার কেস একটি গ্রুপে যুক্ত · ${d.title ?? ""}`, en: `Your case was linked to a group · ${d.title ?? ""}` }, body: { bn: "একই ঘটনার অন্য কেসের সাথে — আপনার তথ্য গোপন থাকে", en: "With other cases from the same incident — your details stay private" }, href: `cases/${a.applicationId}` });
      if (e.action === "incident_group.shared_evidence_linked") out.push({ id: `sev-${e.seq}`, at: e.at, icon: "bell", title: { bn: `গ্রুপে নতুন সাধারণ প্রমাণ · ${d.title ?? ""}`, en: `New shared evidence in your group · ${d.title ?? ""}` }, body: { bn: "আপনার কেসের পাতায় দেখুন", en: "See it on your case page" }, href: `cases/${a.applicationId}` });
      if (e.action === "incident_group.unlinked") out.push({ id: `ugrp-${e.seq}`, at: e.at, icon: "bell", title: { bn: "আপনার কেস গ্রুপ থেকে আলাদা করা হয়েছে", en: "Your case is no longer in the group" }, body: { bn: "আপনার কেস আগের মতোই চলবে", en: "Your case continues as before" }, href: `cases/${a.applicationId}` });
    }
    for (const t of db.tasks.filter((x) => x.applicationId === a.applicationId && x.status !== "DONE")) {
      const map: Partial<Record<string, { icon: CitizenNotification["icon"]; bn: string; en: string }>> = {
        ELIGIBILITY_REVIEW: { icon: "shield", bn: "অফিসারের পর্যালোচনার অপেক্ষায়", en: "Waiting for officer review" },
        URGENT_SAFETY_REVIEW: { icon: "shield", bn: "জরুরি নিরাপত্তা পর্যালোচনা চলছে", en: "Urgent safety review in progress" },
        DOCUMENT_FOLLOW_UP: { icon: "bell", bn: "কিছু নথি পরে জমা দিতে হবে", en: "Some documents are still to be submitted" },
        COMPLETE_MISSING_INFO: { icon: "bell", bn: "কিছু তথ্য বাকি আছে", en: "Some information is missing" },
        HUMAN_CALLBACK: { icon: "user", bn: "সহায়তা কর্মী আপনাকে ফোন করবেন", en: "A helpline agent will call you back" },
      };
      const ctx = t.context as { docType?: DocType; requested?: boolean } | undefined;
      if (t.type === "DOCUMENT_FOLLOW_UP" && ctx?.requested && ctx.docType) {
        const noteBn = t.reason.includes(" — ") ? ` — ${t.reason.split(" — ").slice(1).join(" — ")}` : "";
        out.push({
          id: `task-${t.taskId}`,
          at: t.createdAt,
          icon: "bell",
          title: { bn: `নথি প্রয়োজন: ${label(DOC_TYPES, ctx.docType, "bn")}`, en: `Document needed: ${label(DOC_TYPES, ctx.docType, "en")}` },
          body: { bn: `${a.applicationId} · এখানে ক্লিক করে আপলোড করুন${noteBn}`, en: `${a.applicationId} · click to upload it${noteBn}` },
          href: `cases/${a.applicationId}`,
        });
        continue;
      }
      const m = map[t.type];
      if (!m) continue;
      out.push({
        id: `task-${t.taskId}`,
        at: t.createdAt,
        icon: m.icon,
        title: { bn: m.bn, en: m.en },
        body:
          t.type === "HUMAN_CALLBACK"
            ? { bn: `${a.applicationId} · আপনার নিরাপদ সময়ে: ${safeTimeLabel(a.data.safeContact, "bn")}`, en: `${a.applicationId} · at your safe time: ${safeTimeLabel(a.data.safeContact, "en")}` }
            : { bn: `${a.applicationId} · ${t.reason}`, en: `${a.applicationId} · ${t.reason}` },
        href: `cases/${a.applicationId}`,
      });
    }
  }
  for (const a of apps) {
    if (a.review && !a.review.decision) {
      out.push({ id: `rev-${a.applicationId}`, at: a.review.receivedAt, icon: "shield", title: { bn: "অফিস আপনার আবেদন পর্যালোচনা করছে", en: "The office is reviewing your application" }, body: { bn: `${a.applicationId} · ${a.review.office}`, en: `${a.applicationId} · ${a.review.office}` }, href: `cases/${a.applicationId}` });
    }
    const d = a.review?.decision;
    if (d?.decision === "ELIGIBLE" && a.caseId) {
      out.push({ id: `acc-${a.applicationId}`, at: d.at, icon: "check", title: { bn: `আবেদন গৃহীত — কেস আইডি ${a.caseId}`, en: `Application accepted — Case ID ${a.caseId}` }, body: { bn: a.applicationId, en: a.applicationId }, href: `cases/${a.applicationId}` });
    }
    const pw = a.review?.pathway;
    if (pw && a.caseId) {
      out.push({ id: `pw-${a.applicationId}`, at: pw.at, icon: "check", title: { bn: PATHWAY_TEXT[pw.type].bn, en: PATHWAY_TEXT[pw.type].en }, body: { bn: a.caseId, en: a.caseId }, href: `cases/${a.applicationId}` });
    }
    // While the engine's shortlist is being worked through, tell the citizen a lawyer is being found.
    const liveShortlist = [...(a.lawyer?.shortlists ?? [])].reverse().find((x) => x.status === "ACTIVE");
    if (liveShortlist && !(a.lawyer?.assignments ?? []).some((x) => x.status === "ACCEPTED")) {
      out.push({ id: `find-${liveShortlist.shortlistId}`, at: liveShortlist.createdAt, icon: "user", title: { bn: "আপনার জন্য প্যানেল আইনজীবী খোঁজা হচ্ছে", en: "Finding a panel lawyer for you" }, body: { bn: `${a.caseId ?? a.applicationId} · আইনজীবী গ্রহণ করলে জানানো হবে`, en: `${a.caseId ?? a.applicationId} · you'll be told when a lawyer accepts` }, href: `cases/${a.applicationId}` });
    }
    // One entry per lawyer who accepted (access granted) — a reassignment shows the new lawyer too.
    for (const g of a.lawyer?.access ?? []) {
      out.push({ id: `law-${g.assignmentId}`, at: g.grantedAt, icon: "user", title: { bn: `প্যানেল আইনজীবী নিয়োগ: ${g.lawyerName}`, en: `Panel lawyer assigned: ${g.lawyerName}` }, body: { bn: a.caseId ?? a.applicationId, en: a.caseId ?? a.applicationId }, href: `cases/${a.applicationId}` });
    }
    for (const h of a.lawyer?.hearings ?? []) {
      // A5: a missing lawyer report surfaces to the citizen before they travel.
      if (h.overdueFlaggedAt && !h.updateId) {
        out.push({ id: `hrgmiss-${h.hearingId}`, at: h.overdueFlaggedAt, icon: "bell", title: { bn: `আইনজীবী ${formatDateTime(h.at, "bn")}-এর শুনানির খবর দেননি`, en: `No lawyer report for the ${formatDateTime(h.at, "en")} hearing` }, body: { bn: "যাওয়ার আগে ১৬৬৯৯-এ কল করে পরবর্তী তারিখ নিশ্চিত করুন — অফিস জানে।", en: "Call 16699 to confirm the next date before you travel — the office has been alerted." }, href: `cases/${a.applicationId}` });
      }
      out.push({ id: `hrg-${h.hearingId}`, at: h.addedAt, icon: "bell", title: { bn: `শুনানি: ${formatDateTime(h.at, "bn")}`, en: `Hearing: ${formatDateTime(h.at, "en")}` }, body: { bn: `${a.caseId ?? a.applicationId} · ${h.court}`, en: `${a.caseId ?? a.applicationId} · ${h.court}` }, href: `cases/${a.applicationId}` });
    }
    const closureTestimonial = a.lawyer?.closureTestimonial;
    if (closureTestimonial) {
      out.push({
        id: `lawyer-testimonial-${closureTestimonial.testimonialId}`,
        at: closureTestimonial.issuedAt,
        icon: "check",
        title: { bn: "কেস বন্ধ — প্রত্যয়নপত্র প্রস্তুত", en: "Case closed — testimonial ready" },
        body: { bn: `${closureTestimonial.caseRef} · প্রত্যয়নপত্র ${closureTestimonial.testimonialId}`, en: `${closureTestimonial.caseRef} · Testimonial ${closureTestimonial.testimonialId}` },
        href: `cases/${a.applicationId}`,
      });
    }
    if (d?.decision === "NOT_ELIGIBLE") {
      out.push({ id: `rej-${a.applicationId}`, at: d.at, icon: "bell", title: { bn: "আবেদন গৃহীত হয়নি", en: "Application not accepted" }, body: { bn: `কারণ: ${d.reason}`, en: `Reason: ${d.reason}` }, href: `cases/${a.applicationId}` });
    }
  }
  for (const m of db.outbox.filter((x) => x.to === me.phone && x.kind === "SMS_CONFIRMATION")) {
    const messageContext = m.context;
    if (messageContext?.kind === "DOCUMENT_REQUEST") {
      const application = apps.find((a) => a.applicationId === m.applicationId);
      const document = application?.data.documents.find((d) => d.docId === messageContext.docId);
      if (document?.status === "ATTACHED") continue;
    }
    out.push({
      id: `sms-${m.msgId}`,
      at: m.at,
      icon: "bell",
      title: m.status === "DELIVERED" ? { bn: "এসএমএস পাঠানো হয়েছে (সিমুলেটেড)", en: "SMS sent (simulated)" } : { bn: "এসএমএস পাঠানো হয়নি — আপনার নির্দেশ অনুযায়ী", en: "SMS not sent — as you asked" },
      body: { bn: m.body, en: m.body },
      href: m.applicationId ? `cases/${m.applicationId}` : "home",
    });
  }
  return out
    .sort((x, y) => y.at.localeCompare(x.at))
    .map((n) => ({ ...n, unread: n.at > readAt }));
}

export function useCitizenNotifications(): CitizenNotification[] {
  const db = useDlasDb();
  const me = useCurrentCitizen();
  return useMemo(() => notificationsFor(db, me), [db, me]);
}

/* ------------------------------------------------------------------ *
 *  "My legal aid centre" — derived from the citizen's latest application.
 *  No officer is shown until a DLAO is actually assigned on the record.
 * ------------------------------------------------------------------ */

export type MyOffice = {
  district: { bn: string; en: string } | null;
  officeName: { bn: string; en: string } | null;
  applications: number;
  openTasks: number;
  safeTime: { bn: string; en: string } | null;
  latestApplicationId: string | null;
  /** UDC centres in the district of the latest application (demo directory + signed-up operators). */
  udcCentres: (UdcCentre & { operatorName: string | null })[];
};

export function useMyOffice(): MyOffice {
  const db = useDlasDb();
  const me = useCurrentCitizen();
  return useMemo(() => {
    const apps = applicationsFor(db, me);
    const latest = apps[0];
    const d = latest ? DISTRICTS.find((x) => x.code === latest.data.applicant.district) : undefined;
    return {
      district: d ? d.label : null,
      officeName: d ? { bn: `${d.label.bn} জেলা লিগ্যাল এইড অফিস`, en: `${d.label.en} District Legal Aid Office` } : null,
      applications: apps.length,
      openTasks: db.tasks.filter((t) => t.status !== "DONE" && apps.some((a) => a.applicationId === t.applicationId)).length,
      safeTime: latest?.data.safeContact.safeTime
        ? { bn: safeTimeLabel(latest.data.safeContact, "bn"), en: safeTimeLabel(latest.data.safeContact, "en") }
        : null,
      latestApplicationId: latest?.applicationId ?? null,
      udcCentres: d
        ? db.udcCentres
            .filter((c) => c.district === d.code)
            // Real, signed-up centres first; demo directory after.
            .sort((x, y) => (x.source === y.source ? 0 : x.source === "REGISTERED_OPERATOR" ? -1 : 1))
            .map((c) => ({ ...c, operatorName: c.operatorId ? db.udcOperators.find((o) => o.operatorId === c.operatorId)?.name ?? null : null }))
        : [],
    };
  }, [db, me]);
}
