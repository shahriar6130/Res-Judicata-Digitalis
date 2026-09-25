"use client";

/* ------------------------------------------------------------------ *
 *  Appeal against the settlement testimonial.
 *
 *  After the DLO issues the testimonial it is sent to the citizen and an
 *  appeal window opens (APPEAL_WINDOW_DAYS). Then:
 *   • citizen accepts the settlement      → case CLOSED (resolved)
 *   • no appeal before the window ends    → case CLOSED (resolved by default)
 *   • citizen appeals (with a reason)     → DLO task + office notice
 *       – DLO ACCEPTS  → pathway becomes LAWYER; the DLO assigns a panel
 *                        lawyer with the existing shortlist / offer flow
 *       – DLO REJECTS  → case CLOSED (resolved)
 *  Data: application.mediation.workspace.settlementWorkflow.appeal + audit.
 * ------------------------------------------------------------------ */

import { useEffect } from "react";
import { mutate, readDb } from "./store";
import { CitizenAuth } from "./citizen-auth";
import { applicationsFor } from "./citizen-view";
import { DlaoAuth, officerAuthorityRole, officerCanAccessApplication, openOfficeTask } from "./dlao";
import { useClock } from "./lawyer";
import { normalizePhone } from "./reference";
import { APPEAL_WINDOW_DAYS } from "./mediation-workspace";
import type { ApplicationRecord, AuditEntry, DlasDb, SettlementAppeal } from "./schema";

export { APPEAL_WINDOW_DAYS };
const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

export const appealOf = (a: ApplicationRecord | null | undefined): SettlementAppeal | null => a?.mediation?.workspace?.settlementWorkflow?.appeal ?? null;
export const appealWindowOpen = (ap: SettlementAppeal | null, at = Date.now()) => !!ap && ap.status === "WINDOW_OPEN" && new Date(ap.windowEndsAt).getTime() > at;

function sms(db: DlasDb, a: ApplicationRecord, full: string) {
  const to = normalizePhone(a.data.safeContact.phone) ?? normalizePhone(a.data.applicant.phone);
  if (!to) return;
  const allowed = a.data.safeContact.smsAllowed;
  db.outbox.push({ msgId: rid("SMS"), kind: "SMS_CONFIRMATION", to, body: a.data.safeContact.neutralWordingRequired ? `Update on your reference ${a.caseId}. Please check your DLAS page or the office will contact you at your safe time.` : full, sessionId: a.channel.sessionId, applicationId: a.applicationId, simulated: true, status: allowed ? "DELIVERED" : "SUPPRESSED_UNSAFE", at: now() });
  audit(db, a.audit, { actor: "system", role: "system", caseId: a.caseId ?? a.applicationId, action: allowed ? "notice.sms_sent" : "notice.sms_suppressed", detail: { to, neutral: a.data.safeContact.neutralWordingRequired } });
}

/** Close the case as resolved (settled through mediation). */
function closeResolved(db: DlasDb, a: ApplicationRecord, ap: SettlementAppeal, why: string, actor: { id: string; role: AuditEntry["role"] }) {
  const at = now();
  ap.closedAt = at;
  a.status = "RESOLVED";
  a.stage = "CLOSURE";
  a.closedAt = at;
  for (const t of db.tasks) if (t.applicationId === a.applicationId && t.status !== "DONE" && t.type !== "COURT_AUTHORITY_NOTIFICATION") t.status = "DONE";
  audit(db, a.audit, { actor: actor.id, role: actor.role, caseId: a.caseId ?? a.applicationId, action: "case.closed", detail: { reason: why, outcome: "RESOLVED", testimonialId: a.mediation?.workspace?.settlementWorkflow?.testimonial?.testimonialId ?? null } });
  a.updatedAt = at;
  a.version += 1;
}

function withCitizenCase<T>(applicationId: string, fn: (db: DlasDb, a: ApplicationRecord, ap: SettlementAppeal, citizenId: string) => T): T {
  const me = CitizenAuth.current();
  if (!me) throw new Error("Please log in first");
  if (!applicationsFor(readDb(), me).some((x) => x.applicationId === applicationId)) throw new Error("This case is not yours");
  return mutate((db) => {
    const a = db.applications.find((x) => x.applicationId === applicationId)!;
    const ap = appealOf(a);
    if (!ap) throw new Error("There is no settlement testimonial to respond to yet");
    return fn(db, a, ap, me.citizenId);
  });
}

export const SettlementAppealService = {
  /** Citizen: appeal the testimonial within the window, with a reason. */
  file(applicationId: string, reason: string) {
    if (reason.trim().length < 10) throw new Error("Please explain why you disagree (at least 10 characters)");
    return withCitizenCase(applicationId, (db, a, ap, citizenId) => {
      if (!appealWindowOpen(ap)) throw new Error(ap.status === "FILED" ? "Your appeal is already with the office" : "The appeal window has closed");
      const t = openOfficeTask(db, a, "SETTLEMENT_APPEAL_REVIEW", `Citizen appealed the settlement testimonial for ${a.caseId}: accept (assign a lawyer) or reject (close as resolved).`, 48, "DLAO", { testimonialId: a.mediation?.workspace?.settlementWorkflow?.testimonial?.testimonialId ?? null });
      t.priority = "HIGH";
      Object.assign(ap, { status: "FILED", filedAt: now(), filedBy: citizenId, reason: reason.trim(), taskId: t.taskId });
      audit(db, a.audit, { actor: citizenId, role: "applicant", caseId: a.caseId ?? a.applicationId, action: "settlement.appeal_filed", detail: { reason: reason.trim(), taskId: t.taskId } });
      (db.officeNotices ??= []).push({ noticeId: rid("NTC"), office: a.routing.office, kind: "SETTLEMENT_APPEAL_FILED", applicationId: a.applicationId, caseRef: a.caseId ?? a.applicationId, transferId: null, title: { bn: "নাগরিক নিষ্পত্তির বিরুদ্ধে আপিল করেছেন", en: "The citizen appealed the settlement" }, body: reason.trim(), at: now(), readBy: [] });
      a.updatedAt = now();
      a.version += 1;
      return ap;
    });
  },

  /** Citizen: accept the settlement now (no appeal) → the case closes as resolved. */
  acceptSettlement(applicationId: string) {
    return withCitizenCase(applicationId, (db, a, ap, citizenId) => {
      if (!appealWindowOpen(ap)) throw new Error("This settlement is no longer open for a response");
      ap.status = "ACCEPTED_BY_CITIZEN";
      audit(db, a.audit, { actor: citizenId, role: "applicant", caseId: a.caseId ?? a.applicationId, action: "settlement.accepted_by_citizen", detail: {} });
      closeResolved(db, a, ap, "Citizen accepted the settlement testimonial", { id: citizenId, role: "applicant" });
      return ap;
    });
  },

  /** DLO: decide the appeal. ACCEPTED → lawyer pathway (the DLO assigns a panel lawyer); REJECTED → closed as resolved. */
  decide(applicationId: string, outcome: "ACCEPTED" | "REJECTED", reason: string) {
    const o = DlaoAuth.current();
    if (!o) throw new Error("Legal Aid Officer login required");
    if (reason.trim().length < 10) throw new Error("Record the reason for your decision (at least 10 characters)");
    return mutate((db) => {
      const a = db.applications.find((x) => x.applicationId === applicationId);
      if (!a || !officerCanAccessApplication(a, o)) throw new Error("This case is not in your office");
      const ap = appealOf(a);
      if (!ap || ap.status !== "FILED") throw new Error("There is no appeal waiting for a decision");
      const at = now();
      const role = officerAuthorityRole(o) === "CHIEF_LEGAL_AID_OFFICER" ? "clo" : "dlao";
      for (const t of db.tasks) if (t.taskId === ap.taskId && t.status !== "DONE") t.status = "DONE";
      let lawyerTaskId: string | null = null;
      if (outcome === "ACCEPTED") {
        // the case reopens on the LAWYER pathway (same handoff as a failed mediation)
        if (a.review) {
          const prior = a.review.pathway;
          a.review.pathway = { type: "LAWYER", recommended: prior?.recommended ?? "MEDIATION", recommendationReasons: [...(prior?.recommendationReasons ?? []), `Settlement appeal accepted: ${reason.trim()}`], followedRecommendation: false, reason: reason.trim(), by: o.officerId, byName: o.name, at };
        }
        const pc = a.pathwayClassification;
        const assessment = pc?.assessments[pc.assessments.length - 1];
        if (pc && assessment) {
          const decisionId = rid("PDC");
          pc.decisions.push({ decisionId, action: "CHANGED", assessmentId: assessment.assessmentId, systemClassification: assessment.result, previousSystemClassification: pc.final?.status ?? null, previousFinal: pc.final?.status ?? null, finalPathway: "LAWYER_ASSISTANCE", referralTarget: null, reason: `Settlement appeal accepted: ${reason.trim()}`, by: o.officerId, byName: o.name, at });
          pc.final = { status: "LAWYER_ASSISTANCE", referralTarget: null, decisionId, by: o.officerId, byName: o.name, at };
        }
        if (!a.lawyer) a.lawyer = { assignments: [], hearings: [], updates: [], access: [], shortlists: [], completion: null };
        const t = openOfficeTask(db, a, "LAWYER_ASSIGNMENT", `Settlement appeal accepted for ${a.caseId}: create the shortlist and assign a panel lawyer.`, 24, "DLAO", { source: "SETTLEMENT_APPEAL" });
        t.priority = "HIGH";
        lawyerTaskId = t.taskId;
        a.status = "ACCEPTED";
        a.stage = "SERVICE_DELIVERY";
        a.closedAt = null;
        ap.status = "ACCEPTED";
        ap.decision = { outcome, reason: reason.trim(), by: o.officerId, byName: o.name, at, lawyerTaskId };
        audit(db, a.audit, { actor: o.officerId, role, caseId: a.caseId ?? a.applicationId, action: "settlement.appeal_accepted", detail: { officer: o.name, reason: reason.trim(), lawyerTaskId, chain: ["TESTIMONIAL", "CITIZEN_APPEAL", "LEGAL_AID_OFFICER", "LAWYER_ASSIGNMENT"] } });
        sms(db, a, `DLAS legal aid (${a.caseId}): the office accepted your appeal. A panel lawyer will be assigned to your case and will contact you.`);
        a.updatedAt = at;
        a.version += 1;
      } else {
        ap.status = "REJECTED";
        ap.decision = { outcome, reason: reason.trim(), by: o.officerId, byName: o.name, at, lawyerTaskId: null };
        audit(db, a.audit, { actor: o.officerId, role, caseId: a.caseId ?? a.applicationId, action: "settlement.appeal_rejected", detail: { officer: o.name, reason: reason.trim() } });
        sms(db, a, `DLAS legal aid (${a.caseId}): the office reviewed your appeal and did not accept it. The mediated settlement stands and the case is closed as resolved. Reason: ${reason.trim()}`);
        closeResolved(db, a, ap, "Appeal rejected — the settlement stands", { id: o.officerId, role });
      }
      return ap;
    });
  },
};

/** Appeal windows that ended without an appeal → closed as resolved by default. Safe to call often. */
export function sweepSettlementAppeals(at = Date.now()): number {
  const due = readDb().applications.filter((a) => {
    const ap = appealOf(a);
    return ap?.status === "WINDOW_OPEN" && new Date(ap.windowEndsAt).getTime() <= at;
  });
  if (!due.length) return 0;
  return mutate((db) => {
    let n = 0;
    for (const a of db.applications) {
      const ap = appealOf(a);
      if (ap?.status !== "WINDOW_OPEN" || new Date(ap.windowEndsAt).getTime() > at) continue;
      ap.status = "LAPSED";
      audit(db, a.audit, { actor: "system", role: "system", caseId: a.caseId ?? a.applicationId, action: "settlement.appeal_window_lapsed", detail: { windowEndsAt: ap.windowEndsAt } });
      closeResolved(db, a, ap, `No appeal within ${APPEAL_WINDOW_DAYS} days — resolved by default`, { id: "system", role: "system" });
      n += 1;
    }
    return n;
  });
}

export function useSettlementAppealSweep() {
  const t = useClock();
  useEffect(() => {
    if (!t) return;
    try {
      sweepSettlementAppeals(t);
    } catch {
      /* best-effort; an unswept window is still shown as open */
    }
  }, [t]);
}
