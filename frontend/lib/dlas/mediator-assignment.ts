"use client";

/* ------------------------------------------------------------------ *
 *  Mediator assignment (Feature 3) — completely separate from the panel
 *  lawyer engine (lib/dlas/lawyer.ts is not used here).
 *
 *    case confirmed into a mediation pathway (Feature 2)
 *      → application.mediation opened (assignmentStatus PENDING)
 *    officer runs the HARD FILTERS over the district's mediator registry
 *      1 active status · 2 valid certification · 3 jurisdiction (district + track)
 *      4 availability (incl. capacity) · 5 conflict of interest · 6 case type
 *      → snapshot stored (RECOMMENDED when at least one mediator is eligible)
 *    suitability facts shown side by side — experience, workload, availability,
 *      area, administrative record. No combined score, no "best mediator".
 *    officer RECOMMENDS one → AWAITING_OFFICER_CONFIRMATION
 *    officer CONFIRMS with a reason → conflict re-checked → ASSIGNED
 *      (case-based access granted, mediator + applicant notified — SMS simulated)
 *    REASSIGNMENT_REQUESTED (conflict / unavailability / other) → access revoked
 *    COMPLETED when the mediation concludes.
 *
 *  A declared conflict that matches the case blocks recommendation and
 *  confirmation ("CONFLICT DETECTED") and forces reassignment if it
 *  appears after assignment.
 * ------------------------------------------------------------------ */

import { useMemo } from "react";
import { useDlasDb } from "./store";
import { logOfficerAction, notifyApplicant, openOfficeTask, withOfficerApp } from "./dlao";
import { useClock } from "./lawyer";
import { handlingDistrict } from "./case-handling";
import { MEDIATION_CASE_TYPES, assignedMatters, availabilityNow, certificationState, lbl } from "./mediators";
import type {
  ApplicationRecord,
  AuditEntry,
  DlaoOfficerAccount,
  DlasDb,
  MediationCaseType,
  MediationMatter,
  MediationOrigin,
  MediationTrack,
  MediatorAssignmentRecord,
  MediatorCandidate,
  MediatorCandidateCheck,
  MediatorEligibilityRun,
  MediatorRecord,
  PathwayStatus,
} from "./schema";

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

/* ------------------------------ configuration ------------------------------ */

/** Pathway subcategory (Feature 2) → mediator case type (Feature 1). Data, not UI — change here or override per case. */
export const MEDIATION_CASE_TYPE_MAP: Record<string, MediationCaseType> = {
  DIVORCE: "FAMILY_MARITAL",
  CONJUGAL_RIGHTS: "CONJUGAL_RIGHTS",
  DOWER: "DOWER",
  MAINTENANCE: "SPOUSAL_MAINTENANCE",
  CUSTODY_GUARDIANSHIP: "CHILD_CUSTODY",
  DOWRY_DEMAND: "FAMILY_MARITAL",
  PARENTS_MAINTENANCE: "PARENTS_MAINTENANCE",
  MARITAL_RECONCILIATION: "FAMILY_MARITAL",
  OTHER_FAMILY: "FAMILY_MARITAL",
  PARTITION: "PROPERTY_PARTITION",
  PRE_EMPTION_AGRICULTURAL: "PROPERTY_PARTITION",
  PRE_EMPTION_NON_AGRICULTURAL: "PROPERTY_PARTITION",
  BOUNDARY_NEIGHBOUR: "NEIGHBOURHOOD_BOUNDARY",
  TITLE: "TITLE_DISPUTE",
  EVICTION: "EVICTION",
  HOUSE_RENT: "EVICTION",
  MONEY_CLAIM: "MONEY_SUIT",
};

export const FILTER_LABELS: Record<MediatorCandidateCheck["key"], { bn: string; en: string }> = {
  STATUS: { bn: "সক্রিয়", en: "Active status" },
  CERTIFICATION: { bn: "বৈধ সনদ", en: "Valid certification" },
  JURISDICTION: { bn: "এখতিয়ার", en: "Jurisdiction" },
  AVAILABILITY: { bn: "সময় ও সক্ষমতা", en: "Availability" },
  CONFLICT: { bn: "স্বার্থের সংঘাত", en: "Conflict of interest" },
  CASE_TYPE: { bn: "মামলার ধরন", en: "Case type" },
};

export const ASSIGNMENT_STATUS_LABELS: Record<MediationMatter["assignmentStatus"], { bn: string; en: string }> = {
  PENDING: { bn: "অপেক্ষমাণ", en: "Pending" },
  RECOMMENDED: { bn: "সুপারিশ প্রস্তুত", en: "Recommended" },
  AWAITING_OFFICER_CONFIRMATION: { bn: "কর্মকর্তার নিশ্চিতকরণের অপেক্ষায়", en: "Awaiting officer confirmation" },
  AWAITING_MEDIATOR_ACCEPTANCE: { bn: "মধ্যস্থতাকারীর সম্মতির অপেক্ষায়", en: "Awaiting mediator acceptance" },
  ASSIGNED: { bn: "নিয়োগকৃত", en: "Assigned" },
  REASSIGNMENT_REQUESTED: { bn: "পুনঃনিয়োগ প্রয়োজন", en: "Reassignment requested" },
  COMPLETED: { bn: "সম্পন্ন", en: "Completed" },
};

const MEDIATION_STATUSES: PathwayStatus[] = ["MANDATORY_PRE_CASE_MEDIATION", "MEDIATION_AVAILABLE", "COURT_REFERRED_MEDIATION"];

/* ------------------------------ matter ------------------------------ */

function trackOf(status: PathwayStatus): MediationTrack {
  return status === "COURT_REFERRED_MEDIATION" ? "COURT_REFERRED" : "PRE_LITIGATION";
}

export function mediationOriginOf(a: ApplicationRecord, status = a.mediation?.pathwayStatus): MediationOrigin {
  const recorded = a.pathwayClassification?.inputs.mediationOrigin;
  if (recorded) return recorded;
  if (status === "MANDATORY_PRE_CASE_MEDIATION") return "MANDATORY_PRE_CASE";
  if (a.pathwayClassification?.inputs.courtStatus === "APPEAL" || a.mediation?.caseType === "APPELLATE_REFERRAL") return "APPELLATE_REFERRAL";
  if (status === "COURT_REFERRED_MEDIATION") return "COURT_REFERRED";
  return "PRE_LITIGATION";
}

function mappedCaseType(a: ApplicationRecord, track: MediationTrack): MediationCaseType | null {
  const sub = a.pathwayClassification?.inputs.subcategory ?? null;
  const t = sub ? MEDIATION_CASE_TYPE_MAP[sub] : undefined;
  if (t) return t;
  if (track === "COURT_REFERRED") return "CIVIL_SUIT";
  return a.data.matter.category === "FAMILY" ? "FAMILY_MARITAL" : null;
}

/** Called when the officer finalises a mediation pathway (lib/dlas/pathway.ts) — or lazily for older cases. */
export function openMediationMatter(db: DlasDb, a: ApplicationRecord, status: PathwayStatus, o: DlaoOfficerAccount): MediationMatter {
  if (a.mediation) return a.mediation;
  const track = trackOf(status);
  const caseType = mappedCaseType(a, track);
  const origin = mediationOriginOf(a, status);
  a.mediation = { openedAt: now(), pathwayStatus: status, track, origin, caseType, caseTypeSource: "MAPPED", assignmentStatus: "PENDING", runs: [], assignments: [], authorityNotifications: [] };
  logOfficerAction(db, a, o, "mediation.matter_opened", { pathwayStatus: status, track, origin, caseType });
  const t = openOfficeTask(db, a, "MEDIATOR_ASSIGNMENT", "Check eligible mediators, recommend one and confirm the assignment", 48, "DLAO", { caseId: a.caseId });
  logOfficerAction(db, a, o, "task.created", { taskId: t.taskId, type: t.type });
  return a.mediation;
}

function matterOf(db: DlasDb, a: ApplicationRecord, o: DlaoOfficerAccount): MediationMatter {
  if (a.review?.pathway?.type !== "MEDIATION" || !a.caseId) throw new Error("This case is not in a mediation pathway");
  const status = a.pathwayClassification?.final?.status;
  return a.mediation ?? openMediationMatter(db, a, status && MEDIATION_STATUSES.includes(status) ? status : "MEDIATION_AVAILABLE", o);
}

export const currentAssignment = (m: MediationMatter | null) => m?.assignments.find((x) => x.status === "ASSIGNED") ?? null;
export const activeAssignments = (m: MediationMatter | null | undefined) => m?.assignments.filter((x) => x.status === "ASSIGNED") ?? [];
export const pendingAssignment = (m: MediationMatter | null) => m?.assignments.find((x) => x.status === "AWAITING_OFFICER_CONFIRMATION") ?? null;

/* ------------------------------ checks ------------------------------ */

const STOP = new Set(["md", "mohammad", "muhammad", "mst", "mrs", "mr", "sample", "the", "ltd", "and"]);
const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zঀ-৿ ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));

/** Two names refer to the same party when one contains the other or they share two meaningful words. */
function sameParty(x: string, y: string) {
  const a = tokens(x);
  const b = tokens(y);
  if (!a.length || !b.length) return false;
  const ja = a.join(" ");
  const jb = b.join(" ");
  if ((ja.length >= 4 && jb.includes(ja)) || (jb.length >= 4 && ja.includes(jb))) return true;
  return a.filter((w) => b.includes(w)).length >= 2;
}

/** Active declarations of this mediator that match this case: the case itself, a party, or the applicant's locality. */
export function conflictsFor(m: MediatorRecord, a: ApplicationRecord): string[] {
  const d = a.data;
  const parties = [d.applicant.fullName, d.matter.opposingParty, d.filedBy.name].filter((x): x is string => !!x && !!x.trim());
  const address = (d.applicant.addressLine ?? "").toLowerCase();
  return m.conflicts
    .filter((c) => c.status === "ACTIVE")
    .filter((c) => {
      if (c.applicationId && (c.applicationId === a.applicationId || c.applicationId === a.caseId)) return true;
      if (c.partyName && parties.some((p) => sameParty(c.partyName!, p))) return true;
      if (c.area && address && tokens(c.area).some((w) => address.includes(w))) return true;
      return false;
    })
    .map((c) => c.conflictId);
}

function experienceLevel(m: MediatorRecord): MediatorCandidate["considerations"]["relevantExperience"] {
  const e = m.experience;
  if (e.mediationsConducted >= 100 || e.years >= 8) return "HIGH";
  if (e.mediationsConducted >= 30 || e.years >= 3) return "MEDIUM";
  return "LOW";
}

/** Hard filters + suitability facts for one mediator against one case. No score. */
export function evaluateMediator(db: Pick<DlasDb, "applications">, m: MediatorRecord, a: ApplicationRecord, matter: Pick<MediationMatter, "track" | "caseType" | "assignments">, at: number): MediatorCandidate {
  const district = handlingDistrict(a);
  const load = m.workload.activeMatters + assignedMatters(db, m.mediatorId);
  const avail = availabilityNow(m, at);
  const cert = certificationState(m, at);
  const conflictIds = conflictsFor(m, a);
  const removedBefore = matter.assignments.some((s) => s.mediatorId === m.mediatorId && s.status === "REASSIGNMENT_REQUESTED");
  const alreadyAssigned = matter.assignments.some((s) => s.mediatorId === m.mediatorId && s.status === "ASSIGNED");
  const trackOk = m.tracks.includes(matter.track);
  const checks: MediatorCandidateCheck[] = [
    { key: "STATUS", ok: m.status === "ACTIVE", detail: m.status },
    { key: "CERTIFICATION", ok: cert === "VALID", detail: cert === "VALID" ? (m.certification.validUntil ? `valid until ${m.certification.validUntil}` : "verified") : cert },
    { key: "JURISDICTION", ok: m.district === district && trackOk, detail: m.district !== district ? `serves ${m.district}, case is in ${district ?? "—"}` : trackOk ? `${m.district} · ${matter.track === "COURT_REFERRED" ? "court-referred" : "pre-litigation"}` : `does not take ${matter.track === "COURT_REFERRED" ? "court-referred" : "pre-litigation"} matters` },
    { key: "AVAILABILITY", ok: avail !== "UNAVAILABLE" && load < m.availability.maxActiveMatters, detail: avail === "UNAVAILABLE" ? (m.availability.unavailableUntil ? `unavailable until ${m.availability.unavailableUntil}` : "unavailable") : load >= m.availability.maxActiveMatters ? `at capacity (${load}/${m.availability.maxActiveMatters})` : `${avail.toLowerCase()} · ${load}/${m.availability.maxActiveMatters}` },
    { key: "CONFLICT", ok: conflictIds.length === 0 && !removedBefore && !alreadyAssigned, detail: conflictIds.length ? `CONFLICT DETECTED — ${conflictIds.length} declaration(s) match this case` : removedBefore ? "previously removed from this case" : alreadyAssigned ? "already assigned to this case" : "no declared conflict with this case" },
    { key: "CASE_TYPE", ok: !!matter.caseType && m.caseTypes.includes(matter.caseType), detail: !matter.caseType ? "case type not set" : m.caseTypes.includes(matter.caseType) ? `handles ${lbl(MEDIATION_CASE_TYPES, matter.caseType, "en")}` : `does not handle ${lbl(MEDIATION_CASE_TYPES, matter.caseType, "en")}` },
  ];
  const complaints = m.adminRecord.filter((x) => x.kind === "COMPLAINT").length;
  const commendations = m.adminRecord.filter((x) => x.kind === "COMMENDATION").length;
  const addr = `${a.data.applicant.addressLine ?? ""}`.toLowerCase();
  const areaMatch = !!addr && m.operationalAreas.some((ar) => tokens(ar).some((w) => w.length >= 4 && addr.includes(w)));
  return {
    mediatorId: m.mediatorId,
    name: m.name,
    sample: m.sample,
    eligible: checks.every((c) => c.ok),
    checks,
    conflictIds,
    considerations: {
      relevantExperience: experienceLevel(m),
      experienceNote: `${m.experience.years} yrs · ${m.experience.mediationsConducted} mediations (${m.experience.settled} settled)${m.experience.note ? ` · ${m.experience.note}` : ""}`,
      currentLoad: load,
      capacity: m.availability.maxActiveMatters,
      availability: avail,
      days: m.availability.days,
      channels: m.availability.channels,
      areas: m.operationalAreas,
      areaMatch,
      record: complaints ? "CONCERN" : commendations ? "COMMENDED" : m.adminRecord.some((x) => x.kind === "NOTE" || x.kind === "TRAINING") ? "NOTES_ONLY" : "NO_ENTRIES",
      recordNote: `${complaints} complaint(s), ${commendations} commendation(s)`,
    },
  };
}

/* ------------------------------ read model ------------------------------ */

/** Live evaluation of every mediator in the case's district (what the officer sees before saving a run). */
export function useMediatorAssignment(a: ApplicationRecord) {
  const db = useDlasDb();
  const t = useClock();
  return useMemo(() => {
    const matter = a.mediation;
    const district = handlingDistrict(a);
    const track: MediationTrack = matter?.track ?? trackOf(a.pathwayClassification?.final?.status ?? "MEDIATION_AVAILABLE");
    const caseType = matter?.caseType ?? mappedCaseType(a, track);
    const pseudo = { track, caseType, assignments: matter?.assignments ?? [] };
    const pool = db.mediators.filter((m) => m.district === district);
    const live = pool.map((m) => evaluateMediator(db, m, a, pseudo, t));
    const currents = activeAssignments(matter);
    const current = currents[0] ?? null;
    const pending = pendingAssignment(matter);
    const byId = (id: string | undefined) => db.mediators.find((m) => m.mediatorId === id);
    const currentConflicts = current ? conflictsFor(byId(current.mediatorId)!, a) : [];
    const pendingLive = pending ? live.find((c) => c.mediatorId === pending.mediatorId) ?? null : null;
    return {
      matter,
      track,
      caseType,
      live,
      eligible: live.filter((c) => c.eligible),
      excluded: live.filter((c) => !c.eligible),
      lastRun: matter?.runs[matter.runs.length - 1] ?? null,
      current,
      currents,
      currentMediator: byId(current?.mediatorId),
      currentConflicts,
      pending,
      pendingLive,
      now: t,
    };
  }, [a, db, t]);
}

/* ------------------------------ actions (Legal Aid Officer) ------------------------------ */

function mediatorAudit(db: DlasDb, mediatorId: string, o: DlaoOfficerAccount, action: string, detail: Record<string, unknown>) {
  const m = db.mediators.find((x) => x.mediatorId === mediatorId);
  if (!m) return;
  const caseId = typeof detail.caseId === "string" ? detail.caseId : typeof detail.applicationId === "string" ? detail.applicationId : undefined;
  audit(db, m.audit, { actor: o.officerId, role: "dlao", ...(caseId ? { caseId } : {}), action, detail: { officer: o.name, ...detail } });
  m.updatedAt = now();
}

function smsMediator(db: DlasDb, a: ApplicationRecord, m: MediatorRecord, body: string) {
  db.outbox.push({ msgId: rid("SMS"), kind: "SMS_CONFIRMATION", to: m.contact.phone, body, sessionId: null, applicationId: a.applicationId, simulated: true, status: "DELIVERED", at: now() });
}

function closeTasks(db: DlasDb, a: ApplicationRecord, o: DlaoOfficerAccount, types: string[]) {
  for (const t of db.tasks) {
    if (t.applicationId !== a.applicationId || t.status === "DONE" || !types.includes(t.type)) continue;
    t.status = "DONE";
    logOfficerAction(db, a, o, "task.closed", { taskId: t.taskId, type: t.type });
  }
}

function liveCandidate(db: DlasDb, a: ApplicationRecord, matter: MediationMatter, mediatorId: string) {
  const m = db.mediators.find((x) => x.mediatorId === mediatorId);
  if (!m) throw new Error("Unknown mediator");
  return { m, c: evaluateMediator(db, m, a, matter, Date.now()) };
}

export const MediatorAssignmentService = {
  /** The officer corrects the mediation case type the filters use. */
  setCaseType(applicationId: string, caseType: MediationCaseType) {
    return withOfficerApp(applicationId, (db, a, o) => {
      const matter = matterOf(db, a, o);
      if (currentAssignment(matter) || pendingAssignment(matter)) throw new Error("Change the case type before a mediator is recommended");
      const from = matter.caseType;
      matter.caseType = caseType;
      matter.caseTypeSource = "OFFICER_SET";
      logOfficerAction(db, a, o, "mediation.case_type_set", { from, to: caseType });
      return matter;
    });
  },

  /** Run the hard filters and store the snapshot the officer decides from. */
  checkEligibility(applicationId: string) {
    return withOfficerApp(applicationId, (db, a, o) => {
      const matter = matterOf(db, a, o);
      if (matter.assignmentStatus === "COMPLETED") throw new Error("Mediation is completed");
      const t = Date.now();
      const candidates = db.mediators.filter((m) => m.district === handlingDistrict(a)).map((m) => evaluateMediator(db, m, a, matter, t));
      const run: MediatorEligibilityRun = { runId: rid("MER"), at: now(), by: o.officerId, byName: o.name, caseType: matter.caseType, track: matter.track, district: handlingDistrict(a), candidates };
      matter.runs.push(run);
      const eligible = candidates.filter((c) => c.eligible).length;
      if (!pendingAssignment(matter)) matter.assignmentStatus = activeAssignments(matter).length ? "ASSIGNED" : eligible ? "RECOMMENDED" : matter.assignmentStatus === "REASSIGNMENT_REQUESTED" ? "REASSIGNMENT_REQUESTED" : "PENDING";
      logOfficerAction(db, a, o, "mediation.eligibility_checked", {
        runId: run.runId,
        caseType: matter.caseType,
        track: matter.track,
        eligible,
        excluded: candidates.filter((c) => !c.eligible).map((c) => ({ mediatorId: c.mediatorId, failed: c.checks.filter((k) => !k.ok).map((k) => k.key) })),
        conflictsDetected: candidates.filter((c) => c.conflictIds.length).map((c) => c.mediatorId),
        advisoryOnly: true,
      });
      return run;
    });
  },

  /** The officer proposes one eligible mediator — nothing is assigned yet. */
  recommend(applicationId: string, mediatorId: string, note: string) {
    return withOfficerApp(applicationId, (db, a, o) => {
      const matter = matterOf(db, a, o);
      const run = matter.runs[matter.runs.length - 1];
      if (!run) throw new Error("Check eligible mediators first");
      const { m, c } = liveCandidate(db, a, matter, mediatorId);
      if (c.conflictIds.length) throw new Error("CONFLICT DETECTED — this mediator declared a conflict with this case and cannot be recommended");
      if (!c.eligible) throw new Error(`Not eligible: ${c.checks.filter((k) => !k.ok).map((k) => `${FILTER_LABELS[k.key].en} (${k.detail})`).join("; ")}`);
      const prev = pendingAssignment(matter);
      if (prev) {
        prev.status = "WITHDRAWN";
        prev.endedAt = now();
        prev.endReason = "Replaced by another recommendation";
        prev.endedBy = o.officerId;
      }
      const rec: MediatorAssignmentRecord = {
        assignmentId: rid("MAS"),
        mediatorId: m.mediatorId,
        mediatorName: m.name,
        runId: run.runId,
        status: "AWAITING_OFFICER_CONFIRMATION",
        recommendedAt: now(),
        recommendedBy: o.officerId,
        recommendedByName: o.name,
        recommendationNote: note.trim() || null,
        conflictCheck: { at: now(), clear: true, conflictIds: [] },
        assignedAt: null,
        assignedBy: null,
        assignedByName: null,
        reason: null,
        accessGrantedAt: null,
        accessRevokedAt: null,
        endedAt: null,
        endReason: null,
        endedBy: null,
      };
      matter.assignments.push(rec);
      matter.assignmentStatus = "AWAITING_OFFICER_CONFIRMATION";
      logOfficerAction(db, a, o, "mediation.mediator_recommended", { assignmentId: rec.assignmentId, mediatorId: m.mediatorId, runId: run.runId, note: rec.recommendationNote, replaced: prev?.assignmentId ?? null });
      return rec;
    });
  },

  /** Human decision: conflict and eligibility are re-checked now, then the mediator is assigned. */
  confirm(applicationId: string, assignmentId: string, reason: string) {
    if (reason.trim().length < 10) throw new Error("Give the assignment reason (at least 10 characters)");
    // A detected conflict is saved to the audit (and the conflict check) before the confirmation is refused.
    const out = withOfficerApp(applicationId, (db, a, o) => {
      const matter = matterOf(db, a, o);
      const rec = matter.assignments.find((x) => x.assignmentId === assignmentId);
      if (!rec || rec.status !== "AWAITING_OFFICER_CONFIRMATION") throw new Error("Nothing awaiting confirmation");
      const { m, c } = liveCandidate(db, a, matter, rec.mediatorId);
      rec.conflictCheck = { at: now(), clear: c.conflictIds.length === 0, conflictIds: c.conflictIds };
      if (c.conflictIds.length) {
        logOfficerAction(db, a, o, "mediation.conflict_detected", { assignmentId, mediatorId: m.mediatorId, conflictIds: c.conflictIds, at: "confirmation" });
        return null;
      }
      if (!c.eligible) throw new Error(`No longer eligible: ${c.checks.filter((k) => !k.ok).map((k) => `${FILTER_LABELS[k.key].en} (${k.detail})`).join("; ")}`);
      const previous = matter.assignments.find((x) => x.status === "REASSIGNMENT_REQUESTED" && !x.endedAt);
      if (previous) {
        previous.endedAt = now();
        previous.endedBy = o.officerId;
      }
      rec.status = "ASSIGNED";
      rec.assignedAt = now();
      rec.assignedBy = o.officerId;
      rec.assignedByName = o.name;
      rec.reason = reason.trim();
      rec.accessGrantedAt = now();
      matter.assignmentStatus = "ASSIGNED";
      logOfficerAction(db, a, o, "mediation.mediator_assigned", { assignmentId, mediatorId: m.mediatorId, mediator: m.name, reason: rec.reason, conflictCheck: "clear", replaces: previous?.assignmentId ?? null });
      mediatorAudit(db, m.mediatorId, o, "mediator.assigned_to_case", { applicationId: a.applicationId, caseId: a.caseId, assignmentId });
      closeTasks(db, a, o, ["MEDIATOR_ASSIGNMENT", "MEDIATOR_REASSIGNMENT"]);
      for (const t of db.tasks) if (t.applicationId === a.applicationId && t.type === "MEDIATION_SCHEDULING" && t.status !== "DONE") t.assigneeId = m.mediatorId;
      smsMediator(db, a, m, `DLAS: you have been assigned mediation case ${a.caseId} by ${o.name}. Open the mediator workspace for the case details.`);
      notifyApplicant(db, a, o, `Update on your reference ${a.caseId}. The office will contact you at your safe time.`, `DLAS legal aid (${a.caseId}): a mediator has been assigned to your case. The office will contact you to arrange the session.`);
      return rec;
    });
    if (!out) throw new Error("CONFLICT DETECTED — this mediator declared a conflict with this case. Withdraw and recommend another mediator.");
    return out;
  },

  /** Drop a recommendation that has not been confirmed. */
  withdraw(applicationId: string, assignmentId: string, reason: string) {
    if (reason.trim().length < 5) throw new Error("Give a short reason");
    return withOfficerApp(applicationId, (db, a, o) => {
      const matter = matterOf(db, a, o);
      const rec = matter.assignments.find((x) => x.assignmentId === assignmentId && x.status === "AWAITING_OFFICER_CONFIRMATION");
      if (!rec) throw new Error("Nothing awaiting confirmation");
      rec.status = "WITHDRAWN";
      rec.endedAt = now();
      rec.endReason = reason.trim();
      rec.endedBy = o.officerId;
      matter.assignmentStatus = matter.assignments.some((x) => x.status === "REASSIGNMENT_REQUESTED" && !x.endedAt) ? "REASSIGNMENT_REQUESTED" : matter.runs.length ? "RECOMMENDED" : "PENDING";
      logOfficerAction(db, a, o, "mediation.recommendation_withdrawn", { assignmentId, mediatorId: rec.mediatorId, reason: rec.endReason });
      return rec;
    });
  },

  /** Remove the assigned mediator (conflict found later, unavailable, request…). Access is revoked; a new assignment is required. */
  requestReassignment(applicationId: string, assignmentId: string, reason: string) {
    if (reason.trim().length < 10) throw new Error("Give the reason for reassignment (at least 10 characters)");
    return withOfficerApp(applicationId, (db, a, o) => {
      const matter = matterOf(db, a, o);
      const rec = matter.assignments.find((x) => x.assignmentId === assignmentId && x.status === "ASSIGNED");
      if (!rec) throw new Error("No mediator is assigned");
      rec.status = "REASSIGNMENT_REQUESTED";
      rec.accessRevokedAt = now();
      rec.endReason = reason.trim();
      matter.assignmentStatus = activeAssignments(matter).length ? "ASSIGNED" : "REASSIGNMENT_REQUESTED";
      logOfficerAction(db, a, o, "mediation.reassignment_requested", { assignmentId: rec.assignmentId, mediatorId: rec.mediatorId, reason: rec.endReason, accessRevoked: true });
      mediatorAudit(db, rec.mediatorId, o, "mediator.removed_from_case", { applicationId: a.applicationId, caseId: a.caseId, reason: rec.endReason });
      const m = db.mediators.find((x) => x.mediatorId === rec.mediatorId);
      if (m) smsMediator(db, a, m, `DLAS: your assignment to mediation case ${a.caseId} has ended; your access to the case is closed.`);
      const t = openOfficeTask(db, a, "MEDIATOR_REASSIGNMENT", `Reassign the mediator: ${reason.trim()}`, 24, "DLAO", { caseId: a.caseId, previous: rec.mediatorId });
      t.priority = "HIGH";
      logOfficerAction(db, a, o, "task.created", { taskId: t.taskId, type: t.type });
      return rec;
    });
  },

  /** The mediation concluded — the assignment is closed (outcome recording comes with the mediation workspace). */
  complete(applicationId: string, note: string) {
    if (note.trim().length < 10) throw new Error("Describe how the mediation concluded (at least 10 characters)");
    return withOfficerApp(applicationId, (db, a, o) => {
      const matter = matterOf(db, a, o);
      const active = activeAssignments(matter);
      if (!active.length) throw new Error("No mediator is assigned");
      for (const rec of active) {
        rec.status = "COMPLETED";
        rec.endedAt = now();
        rec.endReason = note.trim();
        rec.endedBy = o.officerId;
        rec.accessRevokedAt = now();
        mediatorAudit(db, rec.mediatorId, o, "mediator.case_completed", { applicationId: a.applicationId, caseId: a.caseId });
      }
      matter.assignmentStatus = "COMPLETED";
      logOfficerAction(db, a, o, "mediation.assignment_completed", { assignmentIds: active.map((x) => x.assignmentId), mediatorIds: active.map((x) => x.mediatorId), note: note.trim() });
      return active;
    });
  },
};

/** For tests / tools outside React. */
export function evaluateForCase(db: DlasDb, applicationId: string) {
  const a = db.applications.find((x) => x.applicationId === applicationId);
  if (!a?.mediation) return [];
  return db.mediators.filter((m) => m.district === handlingDistrict(a)).map((m) => evaluateMediator(db, m, a, a.mediation!, Date.now()));
}
