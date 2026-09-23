"use client";

/* ------------------------------------------------------------------ *
 *  Step 3 · LAWYER pathway — panel lawyers on the shared record.
 *
 *  Lifecycle (all in localStorage["dlas.db.v1"]):
 *   1. The engine suggests panel lawyers (availability + specialisation +
 *      recent missed hearings). ADVISORY — the DLAO picks.
 *   2. The DLAO offers the case → the lawyer is notified.
 *      Accept → assigned, full-record access granted.
 *      Decline / no answer in time → the DLAO is told to assign another.
 *   3. The lawyer records hearings and reports on each one. Every hearing
 *      result (attended / missed / not held) is stored per assignment in a
 *      ledger — used for payment once the case is completed.
 *   4. A report not filed by the deadline counts as a missed hearing and
 *      alerts the DLAO (no chase call). When a lawyer misses
 *      `missedHearingsBeforeReassign` hearings on a case, the DLAO is asked
 *      to assign another lawyer (human decision).
 *   5. On reassignment the old lawyer's access is revoked and the new lawyer
 *      gets the full history (documents, hearings, reports); upcoming
 *      hearings move to the new lawyer. The old assignment's payment is
 *      frozen as PENDING_CASE_COMPLETION.
 *   6. When the DLAO completes the representation, every assignment's
 *      payment moves to DLAO_REVIEW with the attended-hearing count.
 *  Separately (T1), missed hearings across `patternCases` cases raise a
 *  pattern review — review only, never a finding of misconduct.
 *
 *  Thresholds live in dlas.db.v1.lawyerRules (written on first use).
 * ------------------------------------------------------------------ */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { mutate, readDb, useDlasDb } from "./store";
import { DISTRICTS, MATTERS, label, normalizePhone } from "./reference";
import { DlaoAuth } from "./dlao";
import type {
  ApplicationRecord,
  AssignmentLedger,
  AuditEntry,
  DistrictCode,
  DlaoOfficerAccount,
  DlasDb,
  Hearing,
  HearingUpdate,
  LawyerAssignment,
  LawyerMatter,
  LawyerRuleset,
  MatterCategory,
  PanelLawyerAccount,
  Task,
} from "./schema";

export const DEFAULT_LAWYER_RULES: LawyerRuleset = {
  version: "LAWYER-RULES-demo-v1",
  source: "PROTOTYPE_RULE",
  offerResponseHours: 48,
  updateDueHours: 48,
  missedHearingsBeforeReassign: 2,
  patternCases: 3,
  patternWindowDays: 90,
  maxActiveCases: 10,
  feeBasis: "Paid per attended hearing at the district fee-schedule rate (DEMO_RATE in the prototype — no real fee values).",
};

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;
const addHours = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3600_000).toISOString();
const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

export function rulesOf(db: DlasDb): LawyerRuleset {
  return db.lawyerRules ?? DEFAULT_LAWYER_RULES;
}
function ensureRules(db: DlasDb): LawyerRuleset {
  if (!db.lawyerRules) db.lawyerRules = { ...DEFAULT_LAWYER_RULES };
  return db.lawyerRules;
}
export function useLawyerRules(): LawyerRuleset {
  return rulesOf(useDlasDb());
}

/* ================================================================== *
 *  Accounts
 * ================================================================== */

const CURRENT_KEY = "dlas.lawyer.current";

function setCurrent(id: string | null) {
  try {
    if (id) window.localStorage.setItem(CURRENT_KEY, id);
    else window.localStorage.removeItem(CURRENT_KEY);
    window.dispatchEvent(new CustomEvent("dlas:db-changed"));
  } catch {
    /* storage unavailable */
  }
}

export type LawyerAuthResult =
  | { ok: true; account: PanelLawyerAccount }
  | { ok: false; error: "INVALID_NAME" | "INVALID_PHONE" | "INVALID_DISTRICT" | "INVALID_BAR_NO" | "PHONE_TAKEN" | "NOT_FOUND" };

export const LawyerAuth = {
  signUp(input: { name: string; phone: string; district: string; barEnrolmentNo: string; practiceAreas: MatterCategory[] }): LawyerAuthResult {
    const phone = normalizePhone(input.phone);
    if (input.name.trim().length < 2) return { ok: false, error: "INVALID_NAME" };
    if (!phone) return { ok: false, error: "INVALID_PHONE" };
    if (!DISTRICTS.some((d) => d.code === input.district)) return { ok: false, error: "INVALID_DISTRICT" };
    if (input.barEnrolmentNo.trim().length < 3) return { ok: false, error: "INVALID_BAR_NO" };
    if (readDb().lawyers.some((l) => l.phone === phone)) return { ok: false, error: "PHONE_TAKEN" };
    const account = mutate((db) => {
      const a: PanelLawyerAccount = {
        lawyerId: rid("LAW"),
        name: input.name.trim(),
        phone,
        district: input.district as DistrictCode,
        barEnrolmentNo: input.barEnrolmentNo.trim(),
        practiceAreas: input.practiceAreas.filter((m) => MATTERS.some((x) => x.code === m)),
        createdAt: now(),
        lastLoginAt: now(),
        audit: [],
      };
      audit(db, a.audit, { actor: a.lawyerId, role: "panel_lawyer", action: "lawyer.signed_up", detail: { district: a.district, barEnrolmentNo: a.barEnrolmentNo, practiceAreas: a.practiceAreas } });
      db.lawyers.push(a);
      return a;
    });
    setCurrent(account.lawyerId);
    return { ok: true, account };
  },

  login(rawPhone: string): LawyerAuthResult {
    const phone = normalizePhone(rawPhone);
    if (!phone) return { ok: false, error: "INVALID_PHONE" };
    const found = readDb().lawyers.find((l) => l.phone === phone);
    if (!found) return { ok: false, error: "NOT_FOUND" };
    const account = mutate((db) => {
      const a = db.lawyers.find((l) => l.lawyerId === found.lawyerId)!;
      a.lastLoginAt = now();
      audit(db, a.audit, { actor: a.lawyerId, role: "panel_lawyer", action: "lawyer.logged_in" });
      return a;
    });
    setCurrent(account.lawyerId);
    return { ok: true, account };
  },

  current(): PanelLawyerAccount | undefined {
    try {
      const id = window.localStorage.getItem(CURRENT_KEY);
      return id ? readDb().lawyers.find((l) => l.lawyerId === id) : undefined;
    } catch {
      return undefined;
    }
  },

  logout() {
    setCurrent(null);
  },
};

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("dlas:db-changed", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("dlas:db-changed", cb);
  };
}
function currentId() {
  try {
    return window.localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

export function useCurrentLawyer(): PanelLawyerAccount | undefined {
  const id = useSyncExternalStore(subscribe, currentId, () => null);
  const db = useDlasDb();
  return id ? db.lawyers.find((l) => l.lawyerId === id) : undefined;
}

/** Minute-resolution clock so deadline states re-evaluate while a page stays open. */
function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 30_000);
  return () => window.clearInterval(id);
}
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;
export function useClock(): number {
  return useSyncExternalStore(subscribeClock, minuteNow, () => 0);
}

/* ================================================================== *
 *  Selectors
 * ================================================================== */

export function activeAssignment(a: ApplicationRecord): LawyerAssignment | null {
  return a.lawyer?.assignments.find((x) => x.status === "OFFERED" || x.status === "ACCEPTED") ?? null;
}

/** The lawyer currently holding full-record access (granted on acceptance, revoked on reassignment). */
export function hasCaseAccess(a: ApplicationRecord, lawyerId: string): boolean {
  return !!a.lawyer?.access.some((g) => g.lawyerId === lawyerId && !g.revokedAt);
}

export type HearingState = "UPCOMING" | "UPDATE_DUE" | "OVERDUE" | "REPORTED";

export function hearingState(h: Hearing, at = Date.now()): HearingState {
  if (h.updateId) return "REPORTED";
  if (new Date(h.at).getTime() > at) return "UPCOMING";
  return new Date(h.updateDueAt).getTime() < at ? "OVERDUE" : "UPDATE_DUE";
}

/** Missed = the lawyer reported NOT_ATTENDED, or no report arrived by the deadline. */
export function hearingMissed(h: Hearing, at = Date.now()): boolean {
  return h.result === "MISSED" || (!h.updateId && hearingState(h, at) === "OVERDUE");
}

export function computeLedger(a: ApplicationRecord, assignmentId: string, at = Date.now()): AssignmentLedger {
  const hs = (a.lawyer?.hearings ?? []).filter((h) => h.assignmentId === assignmentId);
  const ups = (a.lawyer?.updates ?? []).filter((u) => hs.some((h) => h.hearingId === u.hearingId));
  return {
    hearingsAttended: hs.filter((h) => h.result === "ATTENDED").length,
    hearingsMissed: hs.filter((h) => hearingMissed(h, at)).length,
    hearingsNotHeld: hs.filter((h) => h.result === "NOT_HELD").length,
    hearingsUnreported: hs.filter((h) => hearingState(h, at) === "UPDATE_DUE").length,
    updatesOnTime: ups.filter((u) => !u.late).length,
    updatesLate: ups.filter((u) => u.late).length,
    updatedAt: new Date(at).toISOString(),
  };
}

/** Keep every assignment's stored ledger (and accruing payment) in step with the hearings. */
function refreshLedgers(a: ApplicationRecord, at = Date.now()) {
  for (const s of a.lawyer?.assignments ?? []) {
    if (s.status === "OFFERED" || s.status === "DECLINED") continue;
    s.ledger = computeLedger(a, s.assignmentId, at);
    if (s.status === "ACCEPTED") s.payment = paymentFor(a, s, "ACCRUING");
  }
}

function paymentFor(a: ApplicationRecord, s: LawyerAssignment, status: NonNullable<LawyerAssignment["payment"]>["status"]): NonNullable<LawyerAssignment["payment"]> {
  const hs = (a.lawyer?.hearings ?? []).filter((h) => h.assignmentId === s.assignmentId && (h.result === "ATTENDED" || h.result === "NOT_HELD"));
  return {
    status,
    payableHearings: s.ledger.hearingsAttended,
    completedStages: hs.map((h) => ({ hearingId: h.hearingId, at: h.at, result: h.result as "ATTENDED" | "NOT_HELD" })),
    missedHearings: s.ledger.hearingsMissed,
    eligibleAmount: "DEMO_RATE",
    note:
      status === "ACCRUING"
        ? "Accruing — settled after the case is completed"
        : status === "PENDING_CASE_COMPLETION"
          ? "Assignment ended — settled with the rest of the case after completion"
          : "Case completed — DLAO to review and approve against the fee schedule",
    at: now(),
  };
}

export type LawyerSuggestion = {
  lawyer: PanelLawyerAccount;
  score: number;
  load: number;
  capacity: number;
  available: boolean;
  matchesMatter: boolean;
  missedRecent: number; // missed hearings in the rules window, across all cases
  previouslyOnCase: boolean;
  reasons: { bn: string; en: string }[];
};

/** Engine suggestion — ADVISORY. Availability (load vs capacity), specialisation, recent missed hearings. */
export function suggestLawyers(db: DlasDb, a: ApplicationRecord, at = Date.now()): LawyerSuggestion[] {
  const r = rulesOf(db);
  const district = a.data.applicant.district;
  const since = at - r.patternWindowDays * 86_400_000;
  return db.lawyers
    .filter((l) => !district || l.district === district)
    .map((l) => {
      const load = db.applications.filter((x) => x.lawyer?.assignments.some((s) => s.lawyerId === l.lawyerId && (s.status === "OFFERED" || s.status === "ACCEPTED"))).length;
      const missedRecent = db.applications.reduce((n, x) => {
        const mine = new Set((x.lawyer?.assignments ?? []).filter((s) => s.lawyerId === l.lawyerId).map((s) => s.assignmentId));
        return n + (x.lawyer?.hearings ?? []).filter((h) => h.assignmentId && mine.has(h.assignmentId) && new Date(h.at).getTime() >= since && hearingMissed(h, at)).length;
      }, 0);
      const matchesMatter = !!a.data.matter.category && l.practiceAreas.includes(a.data.matter.category);
      const previouslyOnCase = !!a.lawyer?.assignments.some((s) => s.lawyerId === l.lawyerId);
      const available = load < r.maxActiveCases;
      const reasons: { bn: string; en: string }[] = [];
      if (matchesMatter) reasons.push({ bn: "এই ধরনের মামলা করেন", en: "Practises this type of case" });
      reasons.push(available ? { bn: `চলমান ${load}/${r.maxActiveCases}`, en: `${load} of ${r.maxActiveCases} active cases` } : { bn: "সর্বোচ্চ মামলার সীমায়", en: "At capacity" });
      if (missedRecent) reasons.push({ bn: `সম্প্রতি ${missedRecent}টি শুনানি মিস`, en: `${missedRecent} missed hearing(s) recently` });
      else reasons.push({ bn: "সম্প্রতি কোনো শুনানি মিস নেই", en: "No recent missed hearings" });
      if (previouslyOnCase) reasons.push({ bn: "আগে এই মামলায় ছিলেন", en: "Was on this case before" });
      const score = (matchesMatter ? 3 : 0) + (available ? 2 * (1 - load / r.maxActiveCases) : -10) - 1.5 * missedRecent - (previouslyOnCase ? 5 : 0);
      return { lawyer: l, score: Math.round(score * 10) / 10, load, capacity: r.maxActiveCases, available, matchesMatter, missedRecent, previouslyOnCase, reasons };
    })
    .sort((x, y) => y.score - x.score);
}

export type LawyerCase = { a: ApplicationRecord; assignment: LawyerAssignment };

/** The logged-in lawyer's work, derived from the JSON only. */
export function useLawyerWork() {
  const db = useDlasDb();
  const me = useCurrentLawyer();
  const t = useClock();
  return useMemo(() => {
    const mine: LawyerCase[] = [];
    const past: LawyerCase[] = [];
    if (me) {
      for (const a of db.applications) {
        const list = a.lawyer?.assignments.filter((s) => s.lawyerId === me.lawyerId) ?? [];
        const live = list.find((s) => s.status === "OFFERED" || s.status === "ACCEPTED");
        if (live) mine.push({ a, assignment: live });
        else if (list.length) past.push({ a, assignment: list[list.length - 1]! });
      }
    }
    const accepted = mine.filter((c) => c.assignment.status === "ACCEPTED");
    // Only hearings this lawyer is responsible for.
    const hearings = accepted.flatMap((c) => (c.a.lawyer?.hearings ?? []).filter((h) => h.assignmentId === c.assignment.assignmentId).map((h) => ({ c, h, state: hearingState(h, t) })));
    return {
      me,
      offers: mine.filter((c) => c.assignment.status === "OFFERED"),
      accepted,
      past,
      upcoming: hearings.filter((x) => x.state === "UPCOMING").sort((x, y) => x.h.at.localeCompare(y.h.at)),
      due: hearings.filter((x) => x.state === "UPDATE_DUE").sort((x, y) => x.h.updateDueAt.localeCompare(y.h.updateDueAt)),
      overdue: hearings.filter((x) => x.state === "OVERDUE").sort((x, y) => x.h.updateDueAt.localeCompare(y.h.updateDueAt)),
      reported: hearings.filter((x) => x.state === "REPORTED"),
      tasks: me ? db.tasks.filter((x) => x.assigneeId === me.lawyerId && x.status !== "DONE") : [],
      now: t,
    };
  }, [db, me, t]);
}

/* ================================================================== *
 *  Shared write helpers
 * ================================================================== */

function matterOf(a: ApplicationRecord): LawyerMatter {
  if (!a.lawyer) a.lawyer = { assignments: [], hearings: [], updates: [], access: [], completion: null };
  return a.lawyer;
}

function openTask(db: DlasDb, a: ApplicationRecord, t: Omit<Task, "taskId" | "applicationId" | "sessionId" | "office" | "status" | "createdAt">): Task {
  const task: Task = { taskId: rid("TSK"), applicationId: a.applicationId, sessionId: a.channel.sessionId, office: a.routing.office, status: "OPEN", createdAt: now(), ...t };
  db.tasks.push(task);
  a.taskIds.push(task.taskId);
  return task;
}

function closeTasks(db: DlasDb, a: ApplicationRecord, actor: string, role: AuditEntry["role"], match: (t: Task) => boolean) {
  for (const t of db.tasks) {
    if (t.applicationId !== a.applicationId || t.status === "DONE" || !match(t)) continue;
    t.status = "DONE";
    audit(db, a.audit, { actor, role, action: "task.closed", detail: { taskId: t.taskId, type: t.type } });
  }
}

/** SMS to the applicant through the safe-contact rules (simulated gateway). */
function notifyClient(db: DlasDb, a: ApplicationRecord, actor: string, role: AuditEntry["role"], neutralBody: string, fullBody: string) {
  const to = normalizePhone(a.data.safeContact.phone) ?? normalizePhone(a.data.applicant.phone);
  if (!to) {
    audit(db, a.audit, { actor, role, action: "notice.not_sent", detail: { reason: "no safe phone on record — applicant is told at the office / via 16699" } });
    return;
  }
  const allowed = a.data.safeContact.smsAllowed;
  db.outbox.push({
    msgId: rid("SMS"),
    kind: "SMS_CONFIRMATION",
    to,
    body: a.data.safeContact.neutralWordingRequired ? neutralBody : fullBody,
    sessionId: a.channel.sessionId,
    applicationId: a.applicationId,
    simulated: true,
    status: allowed ? "DELIVERED" : "SUPPRESSED_UNSAFE",
    at: now(),
  });
  audit(db, a.audit, { actor, role, action: allowed ? "notice.sms_sent" : "notice.sms_suppressed", detail: { to, neutral: a.data.safeContact.neutralWordingRequired } });
}

/** Simulated SMS to a panel lawyer (offers, reminders, access changes). */
function smsLawyer(db: DlasDb, a: ApplicationRecord, lawyerId: string, body: string) {
  const l = db.lawyers.find((x) => x.lawyerId === lawyerId);
  if (!l) return;
  db.outbox.push({ msgId: rid("SMS"), kind: "SMS_CONFIRMATION", to: l.phone, body, sessionId: null, applicationId: a.applicationId, simulated: true, status: "DELIVERED", at: now() });
}

/** Missed-hearing threshold on this case → ask the DLAO to assign another lawyer (once per assignment). */
function checkReassign(db: DlasDb, a: ApplicationRecord, s: LawyerAssignment, at = Date.now()) {
  const r = rulesOf(db);
  if (s.status !== "ACCEPTED" || s.reassignFlaggedAt) return;
  const missed = computeLedger(a, s.assignmentId, at).hearingsMissed;
  if (missed < r.missedHearingsBeforeReassign) return;
  s.reassignFlaggedAt = now();
  const t = openTask(db, a, {
    type: "LAWYER_REASSIGN_REVIEW",
    assignedRole: "DLAO",
    priority: "HIGH",
    reason: `${s.lawyerName} has missed ${missed} hearing(s) on ${a.caseId} (rule: ${r.missedHearingsBeforeReassign}) — assign another panel lawyer`,
    dueAt: addHours(now(), 24),
    context: { assignmentId: s.assignmentId, lawyerId: s.lawyerId, missed, rule: r.version },
  });
  audit(db, a.audit, { actor: "system", role: "system", action: "lawyer.reassign_recommended", detail: { assignmentId: s.assignmentId, lawyerId: s.lawyerId, missed, threshold: r.missedHearingsBeforeReassign, taskId: t.taskId } });
}

/* ================================================================== *
 *  DLAO side — offer / withdraw & reassign / complete (human decisions)
 * ================================================================== */

function officer(): DlaoOfficerAccount {
  const o = DlaoAuth.current();
  if (!o) throw new Error("Officer login required");
  return o;
}

function withCase<T>(applicationId: string, fn: (db: DlasDb, a: ApplicationRecord) => T): T {
  return mutate((db) => {
    const a = db.applications.find((x) => x.applicationId === applicationId);
    if (!a) throw new Error(`Unknown case ${applicationId}`);
    const r = fn(db, a);
    refreshLedgers(a);
    a.version += 1;
    a.updatedAt = now();
    return r;
  });
}

export const DlaoLawyerService = {
  /** Offer the case to a panel lawyer (DLAO's choice; the engine only suggests). */
  assign(applicationId: string, input: { lawyerId: string; note: string }) {
    const o = officer();
    return withCase(applicationId, (db, a) => {
      const r = ensureRules(db);
      if (a.review?.pathway?.type !== "LAWYER" || !a.caseId) throw new Error("Choose the Panel lawyer pathway first");
      if (a.lawyer?.completion) throw new Error("Representation already completed");
      if (activeAssignment(a)) throw new Error("A lawyer is already assigned — reassign instead");
      const l = db.lawyers.find((x) => x.lawyerId === input.lawyerId);
      if (!l) throw new Error("Choose a lawyer from the panel");
      if (a.data.applicant.district && l.district !== a.data.applicant.district) throw new Error("This lawyer is not on this district's panel");
      const m = matterOf(a);
      const previous = [...m.assignments].reverse().find((x) => x.status === "WITHDRAWN");
      const suggestion = suggestLawyers(db, a);
      const s: LawyerAssignment = {
        assignmentId: rid("ASN"),
        lawyerId: l.lawyerId,
        lawyerName: l.name,
        status: "OFFERED",
        offeredAt: now(),
        offeredBy: o.officerId,
        offeredByName: o.name,
        note: input.note.trim() || null,
        respondBy: addHours(now(), r.offerResponseHours),
        respondedAt: null,
        declineReason: null,
        responseOverdueFlaggedAt: null,
        handoverFrom: previous?.assignmentId ?? null,
        reassignFlaggedAt: null,
        ledger: { hearingsAttended: 0, hearingsMissed: 0, hearingsNotHeld: 0, hearingsUnreported: 0, updatesOnTime: 0, updatesLate: 0, updatedAt: now() },
        payment: null,
      };
      m.assignments.push(s);
      closeTasks(db, a, o.officerId, "dlao", (t) => t.type === "LAWYER_ASSIGNMENT");
      const t = openTask(db, a, { type: "LAWYER_RESPONSE", assignedRole: "PANEL_LAWYER", assigneeId: l.lawyerId, priority: a.routing.recommendedPriority, reason: `Accept or decline case ${a.caseId}`, dueAt: s.respondBy, context: { assignmentId: s.assignmentId } });
      const rank = suggestion.findIndex((x) => x.lawyer.lawyerId === l.lawyerId);
      audit(db, a.audit, {
        actor: o.officerId,
        role: "dlao",
        action: "lawyer.offered",
        detail: { officer: o.name, assignmentId: s.assignmentId, lawyerId: l.lawyerId, lawyer: l.name, respondBy: s.respondBy, taskId: t.taskId, engineRank: rank + 1, followedTopSuggestion: rank === 0, handoverFrom: s.handoverFrom },
      });
      audit(db, l.audit, { actor: o.officerId, role: "dlao", action: "lawyer.offer_received", detail: { applicationId: a.applicationId, caseId: a.caseId } });
      smsLawyer(db, a, l.lawyerId, `DLAS: legal aid case ${a.caseId} is offered to you. Accept or decline in the lawyer portal by ${fmt(s.respondBy)}.`);
      return s;
    });
  },

  /** Take the case from the current lawyer (missed hearings, no answer, conflict…). Access is revoked; the DLAO then offers it to another lawyer. */
  withdraw(applicationId: string, reason: string) {
    const o = officer();
    if (reason.trim().length < 10) throw new Error("A reason of at least 10 characters is required");
    return withCase(applicationId, (db, a) => {
      const s = activeAssignment(a);
      if (!s) throw new Error("No active assignment");
      refreshLedgers(a);
      const wasAccepted = s.status === "ACCEPTED";
      s.status = "WITHDRAWN";
      s.respondedAt = s.respondedAt ?? now();
      s.declineReason = reason.trim();
      s.payment = wasAccepted ? paymentFor(a, s, "PENDING_CASE_COMPLETION") : null;
      for (const g of a.lawyer!.access) {
        if (g.lawyerId === s.lawyerId && !g.revokedAt) {
          g.revokedAt = now();
          g.revokeReason = reason.trim();
          audit(db, a.audit, { actor: o.officerId, role: "dlao", action: "lawyer.access_revoked", detail: { lawyerId: s.lawyerId, assignmentId: s.assignmentId, reason: reason.trim() } });
        }
      }
      closeTasks(db, a, o.officerId, "dlao", (t) => t.assigneeId === s.lawyerId || ((t.type === "LAWYER_UPDATE_OVERDUE" || t.type === "LAWYER_REASSIGN_REVIEW") && (t.context as { lawyerId?: string } | undefined)?.lawyerId === s.lawyerId));
      openTask(db, a, { type: "LAWYER_ASSIGNMENT", assignedRole: "DLAO", priority: "HIGH", reason: `Assign another panel lawyer — ${s.lawyerName} withdrawn: ${reason.trim()}`, dueAt: addHours(now(), 24) });
      audit(db, a.audit, {
        actor: o.officerId,
        role: "dlao",
        action: "lawyer.withdrawn",
        detail: { officer: o.name, assignmentId: s.assignmentId, lawyerId: s.lawyerId, reason: reason.trim(), hearingsAttended: s.ledger.hearingsAttended, hearingsMissed: s.ledger.hearingsMissed, payment: s.payment?.status ?? null },
      });
      smsLawyer(db, a, s.lawyerId, `DLAS: case ${a.caseId} has been reassigned by the legal aid office. Your access to the case record has ended.`);
      return s;
    });
  },

  /** The DLAO records that legal representation is finished → payments move to DLAO review. */
  complete(applicationId: string, input: { outcome: NonNullable<LawyerMatter["completion"]>["outcome"]; reason: string }) {
    const o = officer();
    if (input.reason.trim().length < 10) throw new Error("A reason of at least 10 characters is required");
    return withCase(applicationId, (db, a) => {
      const m = a.lawyer;
      if (!m || !m.assignments.some((s) => s.status === "ACCEPTED" || s.status === "WITHDRAWN")) throw new Error("No lawyer has worked on this case yet");
      if (m.completion) throw new Error("Already completed");
      refreshLedgers(a);
      m.completion = { outcome: input.outcome, reason: input.reason.trim(), by: o.officerId, byName: o.name, at: now() };
      for (const s of m.assignments) {
        if (s.status === "ACCEPTED") s.status = "COMPLETED";
        if (s.status === "COMPLETED" || s.status === "WITHDRAWN") s.payment = paymentFor(a, s, "DLAO_REVIEW");
      }
      a.stage = "OUTCOME";
      closeTasks(db, a, o.officerId, "dlao", (t) => t.assignedRole === "PANEL_LAWYER" || t.type.startsWith("LAWYER_"));
      audit(db, a.audit, {
        actor: o.officerId,
        role: "dlao",
        action: "lawyer.representation_completed",
        detail: { officer: o.name, outcome: input.outcome, reason: input.reason.trim(), payments: m.assignments.filter((s) => s.payment).map((s) => ({ assignmentId: s.assignmentId, lawyerId: s.lawyerId, payableHearings: s.payment!.payableHearings })) },
      });
      notifyClient(db, a, o.officerId, "dlao", `Update on your reference ${a.caseId}. Please call 16699 for details.`, `DLAS legal aid: the court stage of case ${a.caseId} is complete. The office will contact you about next steps.`);
      return m.completion;
    });
  },
};

/* ================================================================== *
 *  Lawyer side
 * ================================================================== */

function withMyCase<T>(applicationId: string, fn: (db: DlasDb, a: ApplicationRecord, me: PanelLawyerAccount, s: LawyerAssignment) => T): T {
  const me = LawyerAuth.current();
  if (!me) throw new Error("Lawyer login required");
  return withCase(applicationId, (db, a) => {
    const s = activeAssignment(a);
    if (!s || s.lawyerId !== me.lawyerId) throw new Error("This case is not assigned to you");
    return fn(db, a, me, s);
  });
}

function addHearingTo(db: DlasDb, a: ApplicationRecord, me: PanelLawyerAccount, s: LawyerAssignment, input: { at: string; court: string; purpose: string; notifyClient: boolean }): Hearing {
  const r = ensureRules(db);
  const at = new Date(input.at);
  if (Number.isNaN(at.getTime())) throw new Error("Enter the hearing date and time");
  if (input.court.trim().length < 2) throw new Error("Enter the court");
  const h: Hearing = {
    hearingId: rid("HRG"),
    assignmentId: s.assignmentId,
    result: null,
    at: at.toISOString(),
    court: input.court.trim(),
    purpose: input.purpose.trim() || null,
    addedBy: me.lawyerId,
    addedAt: now(),
    updateDueAt: addHours(at.toISOString(), r.updateDueHours),
    updateId: null,
    overdueFlaggedAt: null,
    clientNotifiedAt: null,
  };
  matterOf(a).hearings.push(h);
  const t = openTask(db, a, { type: "HEARING_UPDATE_DUE", assignedRole: "PANEL_LAWYER", assigneeId: me.lawyerId, priority: a.routing.recommendedPriority, reason: `Report on the ${fmt(h.at)} hearing (${h.court})`, dueAt: h.updateDueAt, context: { hearingId: h.hearingId } });
  audit(db, a.audit, { actor: me.lawyerId, role: "panel_lawyer", action: "hearing.added", detail: { lawyer: me.name, hearingId: h.hearingId, at: h.at, court: h.court, updateDueAt: h.updateDueAt, taskId: t.taskId } });
  a.provenance[`lawyer.hearings.${h.hearingId}`] = { source: "LAWYER_REPORTED", method: "AGENT_FORM", confidence: "STATED", by: me.lawyerId, at: now() };
  if (input.notifyClient && new Date(h.at).getTime() > Date.now()) {
    notifyClient(
      db,
      a,
      me.lawyerId,
      "panel_lawyer",
      `Update on your reference ${a.caseId ?? a.applicationId}. Please call 16699 for details.`,
      `DLAS legal aid: your next hearing for case ${a.caseId ?? a.applicationId} is on ${fmt(h.at)} at ${h.court}. Call 16699 if you cannot attend.`,
    );
    h.clientNotifiedAt = now();
  }
  return h;
}

export const LawyerService = {
  /** Accept → assigned. Full-record access is granted; on a reassignment the upcoming hearings move to this lawyer. */
  accept(applicationId: string) {
    return withMyCase(applicationId, (db, a, me, s) => {
      if (s.status !== "OFFERED") throw new Error("Already answered");
      const m = a.lawyer!;
      s.status = "ACCEPTED";
      s.respondedAt = now();
      m.access.push({ lawyerId: me.lawyerId, lawyerName: me.name, assignmentId: s.assignmentId, scope: "FULL_CASE_RECORD", grantedAt: now(), revokedAt: null, revokeReason: null });
      audit(db, a.audit, {
        actor: me.lawyerId,
        role: "panel_lawyer",
        action: "lawyer.access_granted",
        detail: { lawyerId: me.lawyerId, assignmentId: s.assignmentId, scope: "FULL_CASE_RECORD", documents: a.data.documents.length, hearings: m.hearings.length, updates: m.updates.length, handoverFrom: s.handoverFrom },
      });
      // Handover: upcoming, unreported hearings of the previous lawyer become this lawyer's.
      if (s.handoverFrom) {
        for (const h of m.hearings) {
          if (h.updateId || h.assignmentId === s.assignmentId || new Date(h.at).getTime() <= Date.now()) continue;
          const from = h.assignmentId;
          h.assignmentId = s.assignmentId;
          openTask(db, a, { type: "HEARING_UPDATE_DUE", assignedRole: "PANEL_LAWYER", assigneeId: me.lawyerId, priority: a.routing.recommendedPriority, reason: `Report on the ${fmt(h.at)} hearing (${h.court})`, dueAt: h.updateDueAt, context: { hearingId: h.hearingId } });
          audit(db, a.audit, { actor: me.lawyerId, role: "panel_lawyer", action: "hearing.handed_over", detail: { hearingId: h.hearingId, fromAssignment: from, toAssignment: s.assignmentId } });
        }
      }
      closeTasks(db, a, me.lawyerId, "panel_lawyer", (t) => t.type === "LAWYER_RESPONSE" && t.assigneeId === me.lawyerId);
      closeTasks(db, a, me.lawyerId, "panel_lawyer", (t) => t.type === "LAWYER_UPDATE_OVERDUE" && (t.context as { assignmentId?: string } | undefined)?.assignmentId === s.assignmentId);
      audit(db, a.audit, { actor: me.lawyerId, role: "panel_lawyer", action: "lawyer.accepted", detail: { lawyer: me.name, assignmentId: s.assignmentId, late: new Date(s.respondBy).getTime() < Date.now() } });
      notifyClient(
        db,
        a,
        me.lawyerId,
        "panel_lawyer",
        `Update on your reference ${a.caseId}. The office will contact you at your safe time.`,
        `DLAS legal aid: panel lawyer ${me.name} will represent you in case ${a.caseId}. You will be told the hearing dates.`,
      );
      return s;
    });
  },

  /** Decline (reason required) → the DLAO is told to assign another lawyer. */
  decline(applicationId: string, reason: string) {
    if (reason.trim().length < 10) throw new Error("A reason of at least 10 characters is required");
    return withMyCase(applicationId, (db, a, me, s) => {
      if (s.status !== "OFFERED") throw new Error("Already answered — ask the DLAO to reassign instead");
      s.status = "DECLINED";
      s.respondedAt = now();
      s.declineReason = reason.trim();
      closeTasks(db, a, me.lawyerId, "panel_lawyer", (t) => t.assigneeId === me.lawyerId || (t.type === "LAWYER_UPDATE_OVERDUE" && (t.context as { assignmentId?: string } | undefined)?.assignmentId === s.assignmentId));
      const t = openTask(db, a, { type: "LAWYER_ASSIGNMENT", assignedRole: "DLAO", priority: "HIGH", reason: `${me.name} declined: ${reason.trim()} — assign another panel lawyer`, dueAt: addHours(now(), 24) });
      audit(db, a.audit, { actor: me.lawyerId, role: "panel_lawyer", action: "lawyer.declined", detail: { lawyer: me.name, assignmentId: s.assignmentId, reason: reason.trim(), taskId: t.taskId } });
      return s;
    });
  },

  addHearing(applicationId: string, input: { at: string; court: string; purpose: string; notifyClient: boolean }) {
    return withMyCase(applicationId, (db, a, me, s) => {
      if (s.status !== "ACCEPTED") throw new Error("Accept the case first");
      return addHearingTo(db, a, me, s, input);
    });
  },

  /** Hearing report (self-reported, LAWYER_REPORTED). Sets the hearing result in the ledger; a next date creates the next hearing. */
  submitUpdate(
    applicationId: string,
    input: { hearingId: string; attendance: HearingUpdate["attendance"]; outcome: HearingUpdate["outcome"]; nextDate: string; nextCourt: string; note: string; notifyClient: boolean },
  ) {
    if (input.note.trim().length < 5) throw new Error("Write a short note on what happened");
    return withMyCase(applicationId, (db, a, me, s) => {
      if (s.status !== "ACCEPTED") throw new Error("Accept the case first");
      const m = a.lawyer!;
      const h = m.hearings.find((x) => x.hearingId === input.hearingId);
      if (!h) throw new Error("Choose the hearing you are reporting on");
      if (h.assignmentId !== s.assignmentId) throw new Error("This hearing belonged to the previous lawyer — you can read it but not report on it");
      if (h.updateId) throw new Error("This hearing already has a report");
      const u: HearingUpdate = {
        updateId: rid("UPD"),
        hearingId: h.hearingId,
        attendance: input.attendance,
        outcome: input.outcome,
        nextDate: input.nextDate ? new Date(input.nextDate).toISOString() : null,
        note: input.note.trim(),
        by: me.lawyerId,
        byName: me.name,
        at: now(),
        late: Date.now() > new Date(h.updateDueAt).getTime(),
      };
      m.updates.push(u);
      h.updateId = u.updateId;
      h.result = u.attendance === "ATTENDED" ? "ATTENDED" : u.attendance === "NOT_ATTENDED" ? "MISSED" : "NOT_HELD";
      a.provenance[`lawyer.updates.${u.updateId}`] = { source: "LAWYER_REPORTED", method: "AGENT_FORM", confidence: "STATED", by: me.lawyerId, at: now(), note: "self-reported by the panel lawyer" };
      closeTasks(db, a, me.lawyerId, "panel_lawyer", (t) => (t.type === "HEARING_UPDATE_DUE" || t.type === "LAWYER_UPDATE_OVERDUE") && (t.context as { hearingId?: string } | undefined)?.hearingId === h.hearingId);
      audit(db, a.audit, { actor: me.lawyerId, role: "panel_lawyer", action: "hearing.update_submitted", detail: { lawyer: me.name, updateId: u.updateId, hearingId: h.hearingId, attendance: u.attendance, result: h.result, outcome: u.outcome, nextDate: u.nextDate, late: u.late } });
      if (a.stage === "SERVICE_DELIVERY") a.stage = "FOLLOW_UP";
      if (u.nextDate) addHearingTo(db, a, me, s, { at: u.nextDate, court: input.nextCourt.trim() || h.court, purpose: "", notifyClient: input.notifyClient });
      checkReassign(db, a, s);
      return u;
    });
  },
};

/* ================================================================== *
 *  Deadline sweep — alerts to the DLAO without a chase call
 * ================================================================== */

type SweepPlan = { offers: [string, string][]; hearings: [string, string][]; reassign: [string, string][] };

function plan(db: DlasDb, t: number): SweepPlan {
  const r = rulesOf(db);
  const p: SweepPlan = { offers: [], hearings: [], reassign: [] };
  for (const a of db.applications) {
    const s = a.lawyer && !a.lawyer.completion ? activeAssignment(a) : null;
    if (!s) continue;
    if (s.status === "OFFERED" && !s.responseOverdueFlaggedAt && new Date(s.respondBy).getTime() < t) p.offers.push([a.applicationId, s.assignmentId]);
    if (s.status === "ACCEPTED") {
      for (const h of a.lawyer!.hearings) if (h.assignmentId === s.assignmentId && !h.overdueFlaggedAt && hearingState(h, t) === "OVERDUE") p.hearings.push([a.applicationId, h.hearingId]);
      if (!s.reassignFlaggedAt && computeLedger(a, s.assignmentId, t).hearingsMissed >= r.missedHearingsBeforeReassign) p.reassign.push([a.applicationId, s.assignmentId]);
    }
  }
  return p;
}

/** T1 pattern: missed hearings on ≥ patternCases different cases in the window. */
function patternPlan(db: DlasDb, t: number): { lawyerId: string; cases: string[]; missed: number }[] {
  const r = rulesOf(db);
  const since = t - r.patternWindowDays * 86_400_000;
  const by = new Map<string, { cases: Set<string>; missed: number }>();
  for (const a of db.applications) {
    for (const s of a.lawyer?.assignments ?? []) {
      const missed = (a.lawyer?.hearings ?? []).filter((h) => h.assignmentId === s.assignmentId && new Date(h.at).getTime() >= since && hearingMissed(h, t)).length;
      if (!missed) continue;
      const e = by.get(s.lawyerId) ?? { cases: new Set<string>(), missed: 0 };
      e.cases.add(a.applicationId);
      e.missed += missed;
      by.set(s.lawyerId, e);
    }
  }
  return [...by.entries()]
    .filter(([lawyerId, e]) => {
      if (e.cases.size < r.patternCases) return false;
      const reviews = db.tasks.filter((x) => x.type === "LAWYER_INACTIVITY_REVIEW" && (x.context as { lawyerId?: string } | undefined)?.lawyerId === lawyerId);
      if (reviews.some((x) => x.status !== "DONE")) return false;
      const covered = Math.max(0, ...reviews.map((x) => ((x.context as { cases?: unknown[] } | undefined)?.cases ?? []).length));
      return e.cases.size > covered;
    })
    .map(([lawyerId, e]) => ({ lawyerId, cases: [...e.cases], missed: e.missed }));
}

/** Idempotent: writes only when a deadline has newly passed. Returns the number of new alerts. */
export function sweepLawyerDeadlines(): number {
  const t = Date.now();
  const db0 = readDb();
  const p = plan(db0, t);
  if (!p.offers.length && !p.hearings.length && !p.reassign.length && !patternPlan(db0, t).length) return 0;
  return mutate((db) => {
    let n = 0;
    const touched = new Set<ApplicationRecord>();
    for (const [appId, asnId] of p.offers) {
      const a = db.applications.find((x) => x.applicationId === appId)!;
      const s = a.lawyer!.assignments.find((x) => x.assignmentId === asnId)!;
      s.responseOverdueFlaggedAt = now();
      openTask(db, a, { type: "LAWYER_UPDATE_OVERDUE", assignedRole: "DLAO", priority: "HIGH", reason: `${s.lawyerName} has not answered the offer for ${a.caseId} (due ${fmt(s.respondBy)}) — reassign or wait`, dueAt: addHours(now(), 24), context: { assignmentId: s.assignmentId, lawyerId: s.lawyerId, kind: "OFFER_RESPONSE" } });
      audit(db, a.audit, { actor: "system", role: "system", action: "lawyer.response_overdue", detail: { assignmentId: s.assignmentId, lawyerId: s.lawyerId, respondBy: s.respondBy } });
      touched.add(a);
      n += 1;
    }
    for (const [appId, hId] of p.hearings) {
      const a = db.applications.find((x) => x.applicationId === appId)!;
      const h = a.lawyer!.hearings.find((x) => x.hearingId === hId)!;
      const s = activeAssignment(a)!;
      h.overdueFlaggedAt = now();
      openTask(db, a, { type: "LAWYER_UPDATE_OVERDUE", assignedRole: "DLAO", priority: "HIGH", reason: `${s.lawyerName}: no report on the ${fmt(h.at)} hearing (${h.court}); due ${fmt(h.updateDueAt)} — counted as missed`, dueAt: addHours(now(), 24), context: { hearingId: h.hearingId, lawyerId: s.lawyerId, assignmentId: s.assignmentId, kind: "HEARING_UPDATE" } });
      audit(db, a.audit, { actor: "system", role: "system", action: "lawyer.update_overdue", detail: { hearingId: h.hearingId, lawyerId: s.lawyerId, updateDueAt: h.updateDueAt } });
      smsLawyer(db, a, s.lawyerId, `DLAS reminder: your report on the ${fmt(h.at)} hearing in case ${a.caseId} is overdue. Please report in the lawyer portal.`);
      touched.add(a);
      n += 1;
    }
    for (const a of db.applications) {
      const s = a.lawyer && !a.lawyer.completion ? activeAssignment(a) : null;
      if (s && !s.reassignFlaggedAt && p.reassign.some(([id]) => id === a.applicationId)) {
        checkReassign(db, a, s, t);
        touched.add(a);
        n += 1;
      }
    }
    for (const { lawyerId, cases, missed } of patternPlan(db, t)) {
      const a = db.applications.find((x) => x.applicationId === cases[cases.length - 1])!;
      const l = db.lawyers.find((x) => x.lawyerId === lawyerId);
      const r = rulesOf(db);
      openTask(db, a, {
        type: "LAWYER_INACTIVITY_REVIEW",
        assignedRole: "DLAO",
        priority: "HIGH",
        reason: `Pattern review: ${l?.name ?? lawyerId} has missed hearings on ${cases.length} cases (${missed} in total, last ${r.patternWindowDays} days; rule ${r.patternCases} cases). Review only — not a finding of misconduct.`,
        dueAt: addHours(now(), 72),
        context: { lawyerId, cases, missed, threshold: r.patternCases },
      });
      audit(db, a.audit, { actor: "system", role: "system", action: "lawyer.inactivity_pattern", detail: { lawyerId, cases, missed, threshold: r.patternCases } });
      if (l) audit(db, l.audit, { actor: "system", role: "system", action: "lawyer.inactivity_pattern", detail: { cases, missed } });
      n += 1;
    }
    for (const a of touched) {
      refreshLedgers(a, t);
      a.version += 1;
      a.updatedAt = now();
    }
    return n;
  });
}

/** Run the sweep when a workspace opens, on every record change, and once a minute (writes only on new alerts). */
export function useLawyerDeadlineSweep() {
  const db = useDlasDb();
  useEffect(() => {
    const run = () => {
      try {
        sweepLawyerDeadlines();
      } catch {
        /* storage full etc. — the alerts are raised on the next successful write */
      }
    };
    run();
    const id = window.setInterval(run, 60_000);
    return () => window.clearInterval(id);
  }, [db.updatedAt]);
}

export function lawyerDistrictLabel(l: PanelLawyerAccount, lang: "bn" | "en") {
  return label(DISTRICTS, l.district, lang);
}
