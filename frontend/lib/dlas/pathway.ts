"use client";

/* ------------------------------------------------------------------ *
 *  Legal pathway — officer checkpoint (Feature 2).
 *
 *  SYSTEM RECOMMENDS → OFFICER REVIEWS → OFFICER CONFIRMS / CHANGES /
 *  ASKS FOR MORE INFORMATION → SYSTEM RECORDS THE DECISION.
 *
 *  application.pathwayClassification:
 *    inputs         officer-entered facts the rules read (subcategory, court status…)
 *    assessments[]  every system assessment (rule, matched conditions, warnings, snapshot)
 *    decisions[]    every officer action: CONFIRMED | CHANGED | INFO_REQUESTED
 *                   (system classification, previous classification, final pathway,
 *                   officer, time, reason)
 *    final          the officer-confirmed pathway — only a human action sets it
 *
 *  Confirming or changing also writes review.pathway through the existing
 *  commitPathway(), so the downstream task (mediation scheduling, lawyer
 *  engine, Gram Adalat / referral) starts exactly as before.
 * ------------------------------------------------------------------ */

import { useMemo } from "react";
import { useDlasDb } from "./store";
import { commitPathway, logOfficerAction, notifyApplicant, openOfficeTask, withOfficerApp } from "./dlao";
import { openMediationMatter } from "./mediator-assignment";
import { EMPTY_PATHWAY_INPUTS, REFERRAL_TARGETS, classifyPathway, isMediationStatus, pathwayRulesOf, pathwayTypeFor, statusLabel, trackFor } from "./pathway-rules";
import type { ApplicationRecord, DlaoOfficerAccount, DlasDb, PathwayAssessment, PathwayClassification, PathwayInputs, PathwayStatus, PathwayType, ReferralTarget } from "./schema";

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;

function classificationOf(a: ApplicationRecord): PathwayClassification {
  if (!a.pathwayClassification) a.pathwayClassification = { inputs: { ...EMPTY_PATHWAY_INPUTS }, assessments: [], decisions: [], final: null };
  return a.pathwayClassification;
}

function requireAccepted(a: ApplicationRecord) {
  if (a.review?.decision?.decision !== "ELIGIBLE" || !a.caseId) throw new Error("Only an accepted case (with a Case ID) gets a legal pathway");
}

type InputPatch = Pick<PathwayInputs, "subcategory" | "courtStatus" | "mediationOrigin" | "courtName" | "courtLevel" | "courtCaseNo" | "referralDate" | "referralOrderReference" | "referringAuthority" | "currentLitigationStage" | "referralDeadline">;

/** Save the officer-entered facts (STAFF_ENTERED) and record the system assessment if it changed. */
function saveInputsAndAssess(db: DlasDb, a: ApplicationRecord, o: DlaoOfficerAccount, patch: InputPatch): PathwayAssessment {
  const c = classificationOf(a);
  const clean: InputPatch = {
    subcategory: patch.subcategory || null,
    courtStatus: patch.courtStatus,
    mediationOrigin: patch.mediationOrigin,
    courtName: patch.courtName?.trim() || null,
    courtLevel: patch.courtLevel,
    courtCaseNo: patch.courtCaseNo?.trim() || null,
    referralDate: patch.referralDate || null,
    referralOrderReference: patch.referralOrderReference?.trim() || null,
    referringAuthority: patch.referringAuthority?.trim() || null,
    currentLitigationStage: patch.currentLitigationStage,
    referralDeadline: patch.referralDeadline || null,
  };
  const changed = (Object.keys(clean) as (keyof InputPatch)[]).filter((k) => c.inputs[k] !== clean[k]);
  if (changed.length) {
    c.inputs = { ...clean, setBy: o.officerId, setByName: o.name, setAt: now() };
    for (const k of changed) a.provenance[`pathway.inputs.${k}`] = { source: "OFFICER_ENTERED", method: "AGENT_FORM", confidence: "STATED", by: o.officerId, at: now(), note: "entered by the Legal Aid Officer for pathway classification" };
    logOfficerAction(db, a, o, "pathway.inputs_recorded", { changed, ...clean });
  }
  const draft = classifyPathway(a, c.inputs, pathwayRulesOf(db));
  const last = c.assessments[c.assessments.length - 1];
  const same = last && last.rulesVersion === draft.rulesVersion && last.result === draft.result && last.ruleId === draft.ruleId && JSON.stringify(last.inputs) === JSON.stringify(draft.inputs);
  if (same) return last;
  const { rule: _rule, ...rest } = draft;
  void _rule;
  const assessment: PathwayAssessment = { assessmentId: rid("PAS"), at: now(), ...rest };
  c.assessments.push(assessment);
  logOfficerAction(db, a, o, "pathway.system_assessed", { assessmentId: assessment.assessmentId, result: assessment.result, ruleId: assessment.ruleId, rulesVersion: assessment.rulesVersion, advisoryOnly: true });
  return assessment;
}

function previousSystem(c: PathwayClassification, current: PathwayAssessment): PathwayStatus | null {
  const i = c.assessments.findIndex((x) => x.assessmentId === current.assessmentId);
  return i > 0 ? c.assessments[i - 1].result : null;
}

function finalize(db: DlasDb, a: ApplicationRecord, o: DlaoOfficerAccount, action: "CONFIRMED" | "CHANGED", status: PathwayStatus, target: ReferralTarget | null, reason: string, assessment: PathwayAssessment) {
  const c = classificationOf(a);
  if (c.final) throw new Error("The pathway is already confirmed");
  const type: PathwayType | null = pathwayTypeFor(status, target);
  if (!type) throw new Error("“Requires officer review” cannot be a final pathway — choose a pathway");
  if (status === "OTHER_REFERRAL" && !target) throw new Error("Choose where to refer the case");
  const decision = {
    decisionId: rid("PDC"),
    action,
    assessmentId: assessment.assessmentId,
    systemClassification: assessment.result,
    previousSystemClassification: previousSystem(c, assessment),
    previousFinal: null,
    finalPathway: status,
    referralTarget: status === "OTHER_REFERRAL" ? target : null,
    reason: reason.trim(),
    by: o.officerId,
    byName: o.name,
    at: now(),
  };
  c.decisions.push(decision);
  c.final = { status, referralTarget: decision.referralTarget, decisionId: decision.decisionId, by: o.officerId, byName: o.name, at: decision.at };
  const targetLabel = decision.referralTarget ? REFERRAL_TARGETS.find((x) => x.code === decision.referralTarget)!.label.en : null;
  const label = `${statusLabel(status, "en")}${targetLabel ? ` — ${targetLabel}` : ""}`;
  logOfficerAction(db, a, o, action === "CONFIRMED" ? "pathway.officer_confirmed" : "pathway.officer_changed", {
    decisionId: decision.decisionId,
    systemClassification: assessment.result,
    finalPathway: status,
    referralTarget: decision.referralTarget,
    track: trackFor(status, null),
    reason: decision.reason,
  });
  // The system's own suggestion, mapped to the downstream type, is what "followed / override" compares against.
  const recType = pathwayTypeFor(assessment.result, null) ?? type;
  commitPathway(db, a, o, type, `${label}: ${decision.reason}`, { type: recType, reasons: [`Rule ${assessment.ruleId ?? "—"} → ${statusLabel(assessment.result, "en")}`] }, {
    label,
    taskReason: status === "COURT_REFERRED_MEDIATION" ? "Court-referred mediation — register the court reference, schedule and notify parties" : status === "MANDATORY_PRE_CASE_MEDIATION" ? "Mandatory pre-case mediation — schedule and notify parties" : undefined,
  });
  // "Followed the recommendation" means the officer confirmed the system's classification — not merely the same downstream service.
  a.review!.pathway!.followedRecommendation = action === "CONFIRMED";
  if (isMediationStatus(status)) openMediationMatter(db, a, status, o);
  if (status === "URGENT_ESCALATION") {
    const t = openOfficeTask(db, a, "URGENT_SAFETY_REVIEW", `Urgent escalation confirmed by ${o.name}: ${decision.reason}`, 4, "DLAO", { caseId: a.caseId, decisionId: decision.decisionId });
    t.priority = "URGENT";
    logOfficerAction(db, a, o, "task.created", { taskId: t.taskId, type: t.type, priority: t.priority });
  }
  return decision;
}

export const PathwayService = {
  /** Save the structured facts (and record the resulting system assessment). */
  saveInputs(applicationId: string, patch: InputPatch) {
    return withOfficerApp(applicationId, (db, a, o) => {
      requireAccepted(a);
      if (a.pathwayClassification?.final) throw new Error("The pathway is already confirmed");
      return saveInputsAndAssess(db, a, o, patch);
    });
  },

  /** Officer accepts the system's suggested pathway. */
  confirm(applicationId: string, patch: InputPatch, reason: string, target: ReferralTarget | null) {
    if (reason.trim().length < 10) throw new Error("Give a reason for confirming (at least 10 characters)");
    return withOfficerApp(applicationId, (db, a, o) => {
      requireAccepted(a);
      const s = saveInputsAndAssess(db, a, o, patch);
      if (s.result === "REQUIRES_OFFICER_REVIEW") throw new Error("The system could not suggest a pathway — use “Change pathway” to choose one");
      const t = s.result === "OTHER_REFERRAL" ? (target ?? pathwayRulesOf(db).rules.find((r) => r.ruleId === s.ruleId)?.referralTarget ?? null) : null;
      return finalize(db, a, o, "CONFIRMED", s.result, t, reason, s);
    });
  },

  /** Officer chooses a different pathway than the system suggested. */
  change(applicationId: string, patch: InputPatch, status: PathwayStatus, target: ReferralTarget | null, reason: string) {
    if (reason.trim().length < 10) throw new Error("Give a reason for the change (at least 10 characters)");
    return withOfficerApp(applicationId, (db, a, o) => {
      requireAccepted(a);
      const s = saveInputsAndAssess(db, a, o, patch);
      if (status === s.result) throw new Error("That is the system's suggestion — use “Confirm pathway”");
      return finalize(db, a, o, "CHANGED", status, target, reason, s);
    });
  },

  /** Officer needs more facts before deciding: records the request, opens a task, optionally tells the applicant (safe SMS). */
  requestInfo(applicationId: string, patch: InputPatch, what: string, notifyApplicantToo: boolean) {
    if (what.trim().length < 10) throw new Error("Say what information is needed (at least 10 characters)");
    return withOfficerApp(applicationId, (db, a, o) => {
      requireAccepted(a);
      const c = classificationOf(a);
      if (c.final) throw new Error("The pathway is already confirmed");
      const s = saveInputsAndAssess(db, a, o, patch);
      const decision = {
        decisionId: rid("PDC"),
        action: "INFO_REQUESTED" as const,
        assessmentId: s.assessmentId,
        systemClassification: s.result,
        previousSystemClassification: previousSystem(c, s),
        previousFinal: null,
        finalPathway: null,
        referralTarget: null,
        reason: what.trim(),
        by: o.officerId,
        byName: o.name,
        at: now(),
      };
      c.decisions.push(decision);
      const t = openOfficeTask(db, a, "COMPLETE_MISSING_INFO", `Legal pathway — information needed: ${what.trim()}`, 72, "DLAO", { caseId: a.caseId, decisionId: decision.decisionId, kind: "PATHWAY_INFO" });
      logOfficerAction(db, a, o, "pathway.info_requested", { decisionId: decision.decisionId, what: what.trim(), taskId: t.taskId, notified: notifyApplicantToo });
      if (notifyApplicantToo)
        notifyApplicant(db, a, o, `Update on your reference ${a.caseId}. The office needs a little more information and will contact you at your safe time.`, `DLAS legal aid (${a.caseId}): to decide the next step we need: ${what.trim()}. Please contact the office or reply at your safe time.`);
      return decision;
    });
  },
};

/** Read model for the Legal Pathway section: saved inputs, the live assessment for a draft, the history. */
export function usePathwayRules() {
  const db = useDlasDb();
  return useMemo(() => pathwayRulesOf(db), [db]);
}

export function assessDraft(a: ApplicationRecord, inputs: PathwayInputs, db: Pick<DlasDb, "pathwayRules">) {
  return classifyPathway(a, inputs, pathwayRulesOf(db));
}
