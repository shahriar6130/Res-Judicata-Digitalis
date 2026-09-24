"use client";

/* ------------------------------------------------------------------ *
 *  Feature 10 — Legal Aid Office control center (/dashboard/dlo#overview).
 *
 *  One read model over the shared record: for every case the office can
 *  see, work out WHERE it is (intake → pathway → mediation), WHO has to
 *  act next (this officer, the mediator, a party) and BY WHEN.
 *  Nothing here changes state — every next action links into the
 *  workflow that already owns the change (review steps, pathway panel,
 *  mediator assignment, settlement verification + testimonial, failure review).
 * ------------------------------------------------------------------ */

import { incidentOf, isRedFlagged } from "./incident-taxonomy";
import { useMemo } from "react";
import { useDlasDb } from "./store";
import { applicationsForOffice, officerAuthorityRole, subStage, useCurrentOfficer } from "./dlao";
import { useClock } from "./lawyer";
import { workspaceStatus } from "./mediation-workspace";
import { auditRow } from "./mediation-oversight";
import type { ApplicationRecord, DlaoOfficerAccount, DlasDb, MediationSession, Task } from "./schema";

export type ControlLane = "INTAKE" | "PATHWAY" | "MEDIATION" | "OTHER";

export type ControlStatus =
  // intake
  | "NEW"
  | "PENDING_VERIFICATION"
  | "INCOMPLETE"
  // pathway
  | "AWAITING_CLASSIFICATION"
  | "MANDATORY_AWAITING_CONFIRMATION"
  | "MEDIATION_AVAILABLE"
  | "LAWYER_PATHWAY"
  // mediation
  | "ASSIGNMENT_PENDING"
  | "AWAITING_OFFICER_CONFIRMATION"
  | "AWAITING_MEDIATOR_ACCEPTANCE"
  | "AWAITING_SCHEDULE"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "AWAITING_OUTCOME"
  | "OUTCOME_REVIEW"
  | "SETTLEMENT_EXECUTION"
  | "AGREEMENT_AWAITING_CERTIFICATION"
  | "FAILED"
  | "REFERRAL_PENDING"
  | "RESOLVED"
  // other
  | "REFERRED"
  | "REJECTED";

/** Who has to move the case next. OFFICER = the signed-in officer ("needs you"). */
export type ActionOwner = "OFFICER" | "CLO" | "MEDIATOR" | "PARTY" | "LAWYER" | "NONE";

export type QuickAction = "OPEN" | "VERIFY" | "REVIEW_PATHWAY" | "ASSIGN_MEDIATOR" | "SCHEDULE_MEDIATION" | "REVIEW_AGREEMENT" | "CERTIFY" | "REVIEW_FAILURE";

export type ControlRow = {
  a: ApplicationRecord;
  caseRef: string;
  lane: ControlLane;
  status: ControlStatus;
  owner: ActionOwner;
  next: { action: QuickAction; label: { bn: string; en: string }; href: string };
  deadline: { at: string; what: { bn: string; en: string }; state: "OVERDUE" | "DUE_SOON" | "LATER" } | null;
  urgent: boolean;
  mediator: string | null;
  lastAction: { action: string; user: string; at: string } | null;
  active: boolean;
};

const L = (bn: string, en: string) => ({ bn, en });
const caseHref = (a: ApplicationRecord) => `#app/${encodeURIComponent(a.applicationId)}`;
const settlementHref = (a: ApplicationRecord) => `/dashboard/dlo/settlements/${encodeURIComponent(a.applicationId)}`;
const failureHref = (a: ApplicationRecord) => `/dashboard/dlo/mediation-outcomes/${encodeURIComponent(a.applicationId)}`;
const HOUR = 3_600_000;
const REFERRAL_TASKS = new Set(["POST_MEDIATION_REFERRAL", "GRAM_ADALAT_REFERRAL"]);

export function isUrgent(a: ApplicationRecord): boolean {
  if (isRedFlagged(a)) return true; // rule-based red flag (lib/dlas/incident-taxonomy.ts), unless an officer cleared it
  const p = a.routing.humanDecision?.priority ?? a.routing.recommendedPriority;
  if (p === "URGENT" && incidentOf(a).officerReview?.decision === "CLEARED" && !a.routing.humanDecision) return false;
  return p === "URGENT" || a.pathwayClassification?.final?.status === "URGENT_ESCALATION";
}

function deadlineState(at: string, t: number): "OVERDUE" | "DUE_SOON" | "LATER" {
  const ms = new Date(at).getTime() - t;
  return ms < 0 ? "OVERDUE" : ms <= 48 * HOUR ? "DUE_SOON" : "LATER";
}

function nextSession(a: ApplicationRecord): MediationSession | null {
  return a.mediation?.workspace?.sessions.find((s) => s.status === "SCHEDULED") ?? null;
}

/** Where the case is and what has to happen next — pure, so it is testable. */
export function classifyCase(a: ApplicationRecord, tasks: Task[], o: Pick<DlaoOfficerAccount, "authorityRole" | "officeType">, t: number): ControlRow {
  const open = tasks.filter((x) => x.applicationId === a.applicationId && x.status !== "DONE");
  const m = a.mediation;
  const ws = m?.workspace ?? null;
  const r = a.review;
  const row = (lane: ControlLane, status: ControlStatus, owner: ActionOwner, action: QuickAction, label: { bn: string; en: string }, href = caseHref(a), active = true) => ({ lane, status, owner, next: { action, label, href }, active });

  let s: Pick<ControlRow, "lane" | "status" | "owner" | "next" | "active">;
  if (a.status === "SUBMITTED" || !r) s = row("INTAKE", "NEW", "OFFICER", "VERIFY", L("গ্রহণ ও যাচাই শুরু", "Receive & start verification"));
  else if (a.status === "INFO_REQUESTED") s = row("INTAKE", "INCOMPLETE", "PARTY", "OPEN", L("আবেদনকারীর তথ্যের অপেক্ষা — ফলো-আপ", "Waiting for applicant's information — follow up"));
  else if (!r.decision) {
    const st = subStage(a);
    const label =
      st === "IDENTITY" ? L("পরিচয় ও NID যাচাই", "Verify identity & NID")
      : st === "IDENTITY_BLOCKED" ? L("আটকে থাকা পরিচয় যাচাই সমাধান", "Resolve blocked identity check")
      : st === "FACTS" ? L("নথি ও তথ্য পর্যালোচনা", "Review documents & facts")
      : st === "FACTS_BLOCKED" ? L("আটকে থাকা নথি যাচাই সমাধান", "Resolve blocked document check")
      : st === "ELIGIBILITY" ? L("যোগ্যতা মূল্যায়ন", "Assess eligibility")
      : L("সিদ্ধান্ত রেকর্ড", "Record the decision");
    const incomplete = a.validation.missing.length > 0 || st.endsWith("BLOCKED");
    s = row("INTAKE", incomplete ? "INCOMPLETE" : "PENDING_VERIFICATION", "OFFICER", "VERIFY", label);
  } else if (r.decision.decision !== "ELIGIBLE") s = row("OTHER", "REJECTED", "NONE", "OPEN", L("বন্ধ — প্রত্যাখ্যাত", "Closed — not eligible"), caseHref(a), false);
  else if (!r.pathway) {
    const pc = a.pathwayClassification;
    const latest = pc?.assessments[pc.assessments.length - 1]?.result;
    if (latest === "MANDATORY_PRE_CASE_MEDIATION" || latest === "COURT_REFERRED_MEDIATION") s = row("PATHWAY", "MANDATORY_AWAITING_CONFIRMATION", "OFFICER", "REVIEW_PATHWAY", L("বাধ্যতামূলক মধ্যস্থতা নিশ্চিত / পরিবর্তন", "Confirm or change mandatory mediation"));
    else if (latest === "MEDIATION_AVAILABLE") s = row("PATHWAY", "MEDIATION_AVAILABLE", "OFFICER", "REVIEW_PATHWAY", L("মধ্যস্থতা প্রযোজ্য — পথ নির্ধারণ", "Mediation available — decide the pathway"));
    else s = row("PATHWAY", "AWAITING_CLASSIFICATION", "OFFICER", "REVIEW_PATHWAY", L("আইনি পথ শ্রেণিবিন্যাস", "Classify the legal pathway"));
  } else if (r.pathway.type === "LAWYER") {
    const assigned = !!a.lawyer?.access.some((x) => !x.revokedAt);
    s = row("PATHWAY", "LAWYER_PATHWAY", assigned ? "LAWYER" : "OFFICER", "OPEN", assigned ? L("আইনজীবীর হালনাগাদ পর্যবেক্ষণ", "Monitor the panel lawyer") : L("প্যানেল আইনজীবী নিয়োগ", "Assign a panel lawyer"));
  } else if (r.pathway.type === "MEDIATION" && m) {
    const flow = ws?.settlementWorkflow ?? null;
    const fail = ws?.failureRecord ?? null;
    const pendingDispatch = (m.authorityNotifications ?? []).some((n) => n.status === "PENDING_DISPATCH");
    const ws0 = workspaceStatus(ws);
    if (fail && fail.status !== "REFERRAL_CONFIRMED") s = row("MEDIATION", "FAILED", "OFFICER", "REVIEW_FAILURE", fail.status === "MORE_INFORMATION_REQUESTED" ? L("মধ্যস্থতাকারীর তথ্যের অপেক্ষা — ব্যর্থতা রেকর্ড", "Awaiting mediator's information — failure record") : L("ব্যর্থতা রেকর্ড পর্যালোচনা ও পরবর্তী পথ নিশ্চিত", "Review failure record & confirm next pathway"), failureHref(a));
    else if (fail) s = open.some((x) => REFERRAL_TASKS.has(x.type)) || fail.lawyerHandoff.status === "AWAITING_ASSIGNMENT" || pendingDispatch ? row("MEDIATION", "REFERRAL_PENDING", "OFFICER", "REVIEW_FAILURE", L("রেফারেল / হস্তান্তর সম্পন্ন করুন", "Complete the referral / handoff"), failureHref(a)) : row("MEDIATION", "RESOLVED", "NONE", "REVIEW_FAILURE", L("রেফারেল সম্পন্ন", "Referral completed"), failureHref(a), false);
    else if (flow?.status === "AWAITING_CLO_CERTIFICATION") s = row("MEDIATION", "AGREEMENT_AWAITING_CERTIFICATION", "OFFICER", "CERTIFY", L("চুক্তি যাচাই করুন (শেষ ধাপ)", "Verify the agreement (final step)"), settlementHref(a));
    else if (flow && flow.status !== "RESOLVED") {
      const owner: ActionOwner = flow.status === "AWAITING_MEDIATOR_CONFIRMATION" || flow.status === "RETURNED_FOR_CORRECTION" || flow.status === "CLARIFICATION_REQUESTED" ? "MEDIATOR" : "PARTY";
      s = row("MEDIATION", "SETTLEMENT_EXECUTION", owner, "REVIEW_AGREEMENT", owner === "MEDIATOR" ? L("মধ্যস্থতাকারীর নিশ্চিতকরণ / সংশোধনের অপেক্ষা", "Awaiting mediator confirmation / correction") : L("পক্ষদের স্বাক্ষরের অপেক্ষা", "Awaiting party signatures"), settlementHref(a));
    } else if (flow && !flow.testimonial) s = row("MEDIATION", "AGREEMENT_AWAITING_CERTIFICATION", "OFFICER", "CERTIFY", L("প্রত্যয়নপত্র তৈরি করে নাগরিককে পাঠান", "Generate the testimonial & send it to the citizen"), settlementHref(a));
    else if (flow?.appeal?.status === "FILED") s = row("MEDIATION", "AGREEMENT_AWAITING_CERTIFICATION", "OFFICER", "REVIEW_AGREEMENT", L("নাগরিকের আপিল — গ্রহণ (আইনজীবী) বা প্রত্যাখ্যান", "Citizen appealed — accept (lawyer) or reject"), settlementHref(a));
    else if (flow?.appeal?.status === "WINDOW_OPEN") s = row("MEDIATION", "RESOLVED", "PARTY", "REVIEW_AGREEMENT", L("প্রত্যয়নপত্র নাগরিকের কাছে — আপিলের সময় চলছে", "Testimonial with the citizen — appeal window open"), settlementHref(a));
    else if (flow) s = pendingDispatch ? row("MEDIATION", "REFERRAL_PENDING", "OFFICER", "REVIEW_AGREEMENT", L("কর্তৃপক্ষকে ফলাফল জানানো রেকর্ড করুন", "Record the outcome notice to the authority"), settlementHref(a)) : row("MEDIATION", "RESOLVED", "NONE", "REVIEW_AGREEMENT", L("বন্ধ — প্রত্যয়নপত্র ইস্যু হয়েছে", "Closed — testimonial issued"), settlementHref(a));
    else if (m.assignmentStatus === "AWAITING_OFFICER_CONFIRMATION") s = row("MEDIATION", "AWAITING_OFFICER_CONFIRMATION", "OFFICER", "ASSIGN_MEDIATOR", L("প্রস্তাবিত মধ্যস্থতাকারী নিশ্চিত করুন", "Confirm the recommended mediator"));
    else if (m.assignmentStatus === "AWAITING_MEDIATOR_ACCEPTANCE") {
      const off = m.assignments.find((x) => x.status === "OFFERED");
      s = row("MEDIATION", "AWAITING_MEDIATOR_ACCEPTANCE", "MEDIATOR", "ASSIGN_MEDIATOR", L(`${off?.mediatorName ?? "মধ্যস্থতাকারী"}-এর সম্মতির অপেক্ষা`, `Waiting for ${off?.mediatorName ?? "the mediator"} to accept (#${off?.offer?.rank ?? "?"}${off?.offer?.via === "AUTO_NEXT" ? ", auto-next" : ""})`));
    } else if (m.assignmentStatus !== "ASSIGNED" && m.assignmentStatus !== "COMPLETED") s = row("MEDIATION", "ASSIGNMENT_PENDING", "OFFICER", "ASSIGN_MEDIATOR", m.assignmentStatus === "REASSIGNMENT_REQUESTED" ? L("নতুন মধ্যস্থতাকারী নিয়োগ", "Reassign a mediator") : L("মধ্যস্থতাকারী নিয়োগ", "Assign a mediator"));
    else if (ws0 === "NOT_SCHEDULED") s = row("MEDIATION", "AWAITING_SCHEDULE", "MEDIATOR", "SCHEDULE_MEDIATION", L("মধ্যস্থতাকারী সেশন নির্ধারণ করবেন — ফলো-আপ", "Mediator to schedule the session — follow up"));
    else if (ws0 === "SCHEDULED") s = row("MEDIATION", "SCHEDULED", "MEDIATOR", "OPEN", L("নির্ধারিত সেশন", "Session scheduled"));
    else if (ws0 === "IN_PROGRESS" || ws0 === "PAUSED") s = row("MEDIATION", "IN_PROGRESS", "MEDIATOR", "OPEN", ws0 === "PAUSED" ? L("সেশন বিরতিতে", "Session paused") : L("সেশন চলছে", "Session in progress"));
    else if (ws0 === "AWAITING_OUTCOME") s = row("MEDIATION", "AWAITING_OUTCOME", "MEDIATOR", "OPEN", L("মধ্যস্থতাকারীর ফলাফল রেকর্ডের অপেক্ষা", "Awaiting mediator's outcome record"));
    else s = row("MEDIATION", "OUTCOME_REVIEW", "OFFICER", "OPEN", L("রেকর্ড করা ফলাফল পর্যালোচনা", "Review the recorded outcome"));
  } else if (r.pathway.type === "MEDIATION") s = row("MEDIATION", "ASSIGNMENT_PENDING", "OFFICER", "ASSIGN_MEDIATOR", L("মধ্যস্থতাকারী নিয়োগ", "Assign a mediator"));
  else {
    const pending = open.some((x) => REFERRAL_TASKS.has(x.type));
    s = row("OTHER", pending ? "REFERRAL_PENDING" : "REFERRED", pending ? "OFFICER" : "NONE", "OPEN", pending ? L("রেফারেল সম্পন্ন করুন", "Complete the referral") : L("রেফার করা হয়েছে", "Referred"), caseHref(a), pending);
  }

  // Deadline: the earliest open task, or the next scheduled session — whichever comes first.
  const cands: { at: string; what: { bn: string; en: string } }[] = open.map((x) => ({ at: x.dueAt, what: L(x.reason, x.reason) }));
  const ns = nextSession(a);
  if (ns?.scheduledFor) cands.push({ at: ns.scheduledFor, what: L(`সেশন ${ns.number}`, `Session ${ns.number}`) });
  const d = s.active ? cands.sort((x, y) => x.at.localeCompare(y.at))[0] ?? null : null;

  const last = a.audit[a.audit.length - 1];
  const lr = last ? auditRow(last, a) : null;
  const cur = m?.assignments.find((x) => x.status === "ASSIGNED" || x.status === "AWAITING_OFFICER_CONFIRMATION") ?? null;
  return {
    a,
    caseRef: a.caseId ?? a.applicationId,
    ...s,
    deadline: d && t ? { ...d, state: deadlineState(d.at, t) } : null,
    urgent: s.active && isUrgent(a),
    mediator: cur ? cur.mediatorName + (cur.status === "ASSIGNED" ? "" : " (?)") : null,
    lastAction: lr ? { action: lr.action, user: lr.user, at: lr.at } : null,
  };
}

const PRIORITY: Record<string, number> = { OVERDUE: 0, DUE_SOON: 1, LATER: 2 };

/** The office control center read model for the signed-in officer. */
export function officeControl(db: DlasDb, o: DlaoOfficerAccount, t: number) {
  const apps = applicationsForOffice(db, o);
  const rows = apps.map((a) => classifyCase(a, db.tasks, o, t));
  const active = rows.filter((r) => r.active);
  const count = (s: ControlStatus) => active.filter((r) => r.status === s).length;
  const ids = new Set(apps.map((a) => a.applicationId));
  const week = 7 * 24 * HOUR;

  const sessions = apps.flatMap((a) => (a.mediation?.workspace?.sessions ?? []).filter((s) => s.status === "SCHEDULED" && s.scheduledFor).map((s) => ({ a, s, at: s.scheduledFor! })));
  const upcoming = t ? sessions.filter((x) => { const ms = new Date(x.at).getTime() - t; return ms >= 0 && ms <= week; }).sort((x, y) => x.at.localeCompare(y.at)) : [];
  const overdueSessions = t ? sessions.filter((x) => new Date(x.at).getTime() < t) : [];
  const overdueMediationTasks = t ? db.tasks.filter((x) => x.applicationId && ids.has(x.applicationId) && x.status !== "DONE" && /^MEDIATION_/.test(x.type) && new Date(x.dueAt).getTime() < t) : [];
  const followUps = t ? db.tasks.filter((x) => x.applicationId && ids.has(x.applicationId) && x.status !== "DONE" && x.assignedRole === "DLAO" && new Date(x.dueAt).getTime() - t <= 48 * HOUR).sort((x, y) => x.dueAt.localeCompare(y.dueAt)) : [];

  const attention = active
    .filter((r) => r.owner === "OFFICER" || r.deadline?.state === "OVERDUE")
    .sort((x, y) => Number(y.urgent) - Number(x.urgent) || (PRIORITY[x.deadline?.state ?? "LATER"] - PRIORITY[y.deadline?.state ?? "LATER"]) || (x.deadline?.at ?? "9").localeCompare(y.deadline?.at ?? "9") || x.a.submittedAt.localeCompare(y.a.submittedAt));

  return {
    rows: rows.sort((x, y) => Number(y.urgent) - Number(x.urgent) || (x.deadline?.at ?? "9").localeCompare(y.deadline?.at ?? "9") || y.a.updatedAt.localeCompare(x.a.updatedAt)),
    attention,
    lanes: {
      INTAKE: { NEW: count("NEW"), PENDING_VERIFICATION: count("PENDING_VERIFICATION"), INCOMPLETE: count("INCOMPLETE") },
      PATHWAY: { AWAITING_CLASSIFICATION: count("AWAITING_CLASSIFICATION"), MANDATORY_AWAITING_CONFIRMATION: count("MANDATORY_AWAITING_CONFIRMATION"), MEDIATION_AVAILABLE: count("MEDIATION_AVAILABLE"), LAWYER_PATHWAY: count("LAWYER_PATHWAY"), URGENT: active.filter((r) => r.urgent).length },
      MEDIATION: {
        ASSIGNMENT_PENDING: count("ASSIGNMENT_PENDING"),
        AWAITING_OFFICER_CONFIRMATION: count("AWAITING_OFFICER_CONFIRMATION"),
        AWAITING_MEDIATOR_ACCEPTANCE: count("AWAITING_MEDIATOR_ACCEPTANCE"),
        AWAITING_SCHEDULE: count("AWAITING_SCHEDULE"),
        SCHEDULED: count("SCHEDULED"),
        IN_PROGRESS: count("IN_PROGRESS"),
        AWAITING_OUTCOME: count("AWAITING_OUTCOME") + count("OUTCOME_REVIEW"),
        AGREEMENT_AWAITING_CERTIFICATION: count("AGREEMENT_AWAITING_CERTIFICATION"),
        FAILED: count("FAILED"),
        REFERRAL_PENDING: count("REFERRAL_PENDING"),
      },
    },
    deadlines: {
      upcoming,
      overdue: { sessions: overdueSessions, tasks: overdueMediationTasks },
      certification: active.filter((r) => r.status === "AGREEMENT_AWAITING_CERTIFICATION"),
      followUps,
    },
  };
}

export function useOfficeControl() {
  const db = useDlasDb();
  const o = useCurrentOfficer();
  const t = useClock();
  return useMemo(() => (o ? { officer: o, clo: officerAuthorityRole(o) === "CHIEF_LEGAL_AID_OFFICER", now: t, ...officeControl(db, o, t) } : null), [db, o, t]);
}
