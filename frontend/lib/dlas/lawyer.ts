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
 *  Shortlist (engine): when the DLAO clicks "Assign lawyer" the engine
 *  ranks the district panel on workload, win percentage, daily attendance
 *  and specialisation and keeps the top `shortlistSize`. The DLAO offers
 *  the case to one of them; if that lawyer declines (reason required) or
 *  does not answer in time, the engine automatically offers it to the next
 *  lawyer on the shortlist. When the shortlist runs out the DLAO is told.
 *  Lawyers register daily attendance (present / absent) in their dashboard.
 *  Separately (T1), missed hearings across `patternCases` cases raise a
 *  pattern review — review only, never a finding of misconduct.
 *
 *  Thresholds live in dlas.db.v1.lawyerRules (written on first use).
 * ------------------------------------------------------------------ */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { mutate, readDb, useDlasDb } from "./store";
import { DISTRICTS, MATTERS, label, normalizePhone } from "./reference";
import { DlaoAuth } from "./dlao";
import { handlingDistrict } from "./case-handling";
import type {
  LawyerRedFlag,
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
  LawyerClosureTestimonial,
  LawyerRuleset,
  LawyerShortlist,
  MatterCategory,
  PanelLawyerAccount,
  ShortlistCandidate,
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
  shortlistSize: 5,
  attendanceWindowDays: 30,
  weights: { workload: 35, winRate: 30, attendance: 25, specialisation: 10 },
  declinesBeforeRedFlag: 8,
};

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;
const addHours = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3600_000).toISOString();
const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

/** Rules from the JSON, with defaults filled in for fields added later. */
export function rulesOf(db: DlasDb): LawyerRuleset {
  const r = db.lawyerRules;
  return r ? { ...DEFAULT_LAWYER_RULES, ...r, weights: { ...DEFAULT_LAWYER_RULES.weights, ...(r.weights ?? {}) } } : DEFAULT_LAWYER_RULES;
}
function ensureRules(db: DlasDb): LawyerRuleset {
  db.lawyerRules = rulesOf(db) === DEFAULT_LAWYER_RULES ? { ...DEFAULT_LAWYER_RULES, weights: { ...DEFAULT_LAWYER_RULES.weights } } : rulesOf(db);
  return db.lawyerRules;
}

/** Local calendar date (YYYY-MM-DD) — attendance is per day. */
export function dayKey(at: number | string = Date.now()): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
        attendance: [],
        notificationsReadAt: null,
        contacts: [],
        redFlags: [],
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

  /** Register today's attendance (present / absent). Changing it the same day keeps one entry and is audited. */
  markAttendance(status: "PRESENT" | "ABSENT", via: { method: "SELF_DECLARED" | "BIOMETRIC_SIMULATED"; deviceId?: string | null } = { method: "SELF_DECLARED" }) {
    const me = LawyerAuth.current();
    if (!me) throw new Error("Lawyer login required");
    return mutate((db) => {
      const l = db.lawyers.find((x) => x.lawyerId === me.lawyerId)!;
      l.attendance = l.attendance ?? [];
      const date = dayKey();
      const prev = l.attendance.find((x) => x.date === date);
      if (prev?.status === status && (prev.method ?? "SELF_DECLARED") === via.method) return prev;
      const method = via.method;
      const before = prev?.status ?? null;
      if (prev) {
        prev.status = status;
        prev.at = now();
        prev.method = method;
        prev.deviceId = via.deviceId ?? null;
      } else l.attendance.push({ date, status, at: now(), method, deviceId: via.deviceId ?? null });
      audit(db, l.audit, { actor: l.lawyerId, role: "panel_lawyer", action: prev ? "attendance.changed" : "attendance.marked", detail: { date, status, from: before, method, deviceId: via.deviceId ?? null, simulated: method === "BIOMETRIC_SIMULATED" } });
      return l.attendance.find((x) => x.date === date)!;
    });
  },

  markNotificationsRead() {
    const me = LawyerAuth.current();
    if (!me) return;
    mutate((db) => {
      const l = db.lawyers.find((x) => x.lawyerId === me.lawyerId);
      if (l) l.notificationsReadAt = now();
    });
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
    if (s.status === "OFFERED" || s.status === "DECLINED" || s.status === "EXPIRED") continue;
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

/* ---------------- red flag: too many declined offers ---------------- */

export function activeRedFlag(l: PanelLawyerAccount): LawyerRedFlag | null {
  return [...(l.redFlags ?? [])].reverse().find((f) => f.status === "ACTIVE") ?? null;
}

/** Declined offers that count towards the next red flag (everything after the last flag the DLAO cleared). */
export function countedDeclines(db: DlasDb, l: PanelLawyerAccount): LawyerRedFlag["declines"] {
  const cleared = [...(l.redFlags ?? [])].reverse().find((f) => f.status === "CLEARED");
  const since = cleared?.clearedAt ?? "";
  const out: LawyerRedFlag["declines"] = [];
  for (const a of db.applications)
    for (const s of a.lawyer?.assignments ?? [])
      if (s.lawyerId === l.lawyerId && s.status === "DECLINED" && (s.respondedAt ?? "") > since)
        out.push({ applicationId: a.applicationId, caseId: a.caseId, assignmentId: s.assignmentId, at: s.respondedAt ?? s.offeredAt, reason: s.declineReason ?? null });
  return out.sort((x, y) => x.at.localeCompare(y.at));
}

/** After a decline: at the rule threshold the lawyer is red-flagged and the DLAO gets a review task (once per flag). */
function checkRedFlag(db: DlasDb, a: ApplicationRecord, lawyerId: string) {
  const l = db.lawyers.find((x) => x.lawyerId === lawyerId);
  if (!l || activeRedFlag(l)) return;
  const threshold = rulesOf(db).declinesBeforeRedFlag;
  const declines = countedDeclines(db, l);
  if (declines.length < threshold) return;
  const flag: LawyerRedFlag = { flagId: rid("RFL"), reason: "DECLINED_OFFERS", raisedAt: now(), threshold, declines, status: "ACTIVE", clearedAt: null, clearedBy: null, clearedByName: null, clearNote: null };
  l.redFlags = [...(l.redFlags ?? []), flag];
  audit(db, l.audit, { actor: "system", role: "system", action: "lawyer.red_flagged", detail: { flagId: flag.flagId, declines: declines.length, threshold } });
  audit(db, a.audit, { actor: "system", role: "system", action: "lawyer.red_flagged", detail: { lawyerId, flagId: flag.flagId, declines: declines.length, threshold } });
  openTask(db, a, {
    type: "LAWYER_RED_FLAG",
    assignedRole: "DLAO",
    priority: "HIGH",
    reason: `Red flag: ${l.name} has declined ${declines.length} case offers (rule ${threshold}). Review the reasons and clear the flag — advisory, the lawyer stays on the panel until you decide.`,
    dueAt: addHours(now(), 72),
    context: { lawyerId, flagId: flag.flagId, declines: declines.length, threshold },
  });
  smsLawyer(db, a, lawyerId, `DLAS: you have declined ${declines.length} case offers and are red-flagged for review by the legal aid office.`);
}

/* ---------------- engine: lawyer statistics & top-N shortlist ---------------- */

export type LawyerStats = ShortlistCandidate["stats"];

/** Workload, won/lost (from completed cases), daily attendance in the window — all from the JSON. */
export function lawyerStats(db: DlasDb, l: PanelLawyerAccount, a: ApplicationRecord | null, at = Date.now()): LawyerStats {
  const r = rulesOf(db);
  let active = 0;
  let won = 0;
  let lost = 0;
  for (const x of db.applications) {
    const mine = x.lawyer?.assignments.filter((s) => s.lawyerId === l.lawyerId) ?? [];
    if (mine.some((s) => s.status === "OFFERED" || s.status === "ACCEPTED")) active += 1;
    if (mine.some((s) => s.status === "COMPLETED")) {
      if (x.lawyer?.completion?.outcome === "WON") won += 1;
      if (x.lawyer?.completion?.outcome === "LOST") lost += 1;
    }
  }
  const since = dayKey(at - r.attendanceWindowDays * 86_400_000);
  const days = (l.attendance ?? []).filter((d) => d.date >= since);
  const presentDays = days.filter((d) => d.status === "PRESENT").length;
  const absentDays = days.filter((d) => d.status === "ABSENT").length;
  return {
    activeCases: active,
    capacity: r.maxActiveCases,
    won,
    lost,
    winPct: won + lost ? Math.round((won / (won + lost)) * 100) : null,
    presentDays,
    absentDays,
    attendancePct: presentDays + absentDays ? Math.round((presentDays / (presentDays + absentDays)) * 100) : null,
    absentToday: (l.attendance ?? []).some((d) => d.date === dayKey(at) && d.status === "ABSENT"),
    matchesMatter: !!a?.data.matter.category && l.practiceAreas.includes(a.data.matter.category),
    declines: countedDeclines(db, l).length,
    redFlagged: !!activeRedFlag(l),
  };
}

/** Score 0–100 from the rule weights. No record yet (win % / attendance) counts as neutral 50 %. */
export function scoreLawyer(db: DlasDb, st: LawyerStats): { score: number; breakdown: ShortlistCandidate["breakdown"] } {
  const w = rulesOf(db).weights;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const breakdown = {
    workload: r1(w.workload * Math.max(0, 1 - st.activeCases / Math.max(1, st.capacity))),
    winRate: r1((w.winRate * (st.winPct ?? 50)) / 100),
    attendance: st.absentToday ? 0 : r1((w.attendance * (st.attendancePct ?? 50)) / 100),
    specialisation: st.matchesMatter ? w.specialisation : 0,
  };
  return { score: r1(breakdown.workload + breakdown.winRate + breakdown.attendance + breakdown.specialisation), breakdown };
}

/** The engine's ranked picks for this case (district panel, minus lawyers who already declined / were removed). */
export function rankLawyers(db: DlasDb, a: ApplicationRecord, at = Date.now()): Omit<ShortlistCandidate, "outcome" | "reason" | "offeredAt">[] {
  const district = handlingDistrict(a); // follows an accepted DLAO → DLAO transfer
  const tried = new Set((a.lawyer?.assignments ?? []).filter((s) => s.status !== "ACCEPTED" && s.status !== "OFFERED").map((s) => s.lawyerId));
  return db.lawyers
    .filter((l) => (!district || l.district === district) && !tried.has(l.lawyerId))
    .map((l) => {
      const stats = lawyerStats(db, l, a, at);
      const { score, breakdown } = scoreLawyer(db, stats);
      return { lawyerId: l.lawyerId, name: l.name, rank: 0, score, breakdown, stats };
    })
    // Red-flagged lawyers go after everyone else (still listed — the DLAO decides).
    .sort((x, y) => Number(!!x.stats.redFlagged) - Number(!!y.stats.redFlagged) || y.score - x.score || x.stats.activeCases - y.stats.activeCases)
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

export function activeShortlist(a: ApplicationRecord): LawyerShortlist | null {
  return [...(a.lawyer?.shortlists ?? [])].reverse().find((x) => x.status === "ACTIVE") ?? null;
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
      today: me ? ((me.attendance ?? []).find((d) => d.date === dayKey(t)) ?? null) : null,
      now: t,
    };
  }, [db, me, t]);
}

/* ================================================================== *
 *  Shared write helpers
 * ================================================================== */

function matterOf(a: ApplicationRecord): LawyerMatter {
  if (!a.lawyer) a.lawyer = { assignments: [], hearings: [], updates: [], access: [], shortlists: [], completion: null };
  a.lawyer.changeRequests ??= [];
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

/** Create an OFFERED assignment for one shortlisted lawyer and notify them. */
function offerTo(db: DlasDb, a: ApplicationRecord, sl: LawyerShortlist, c: ShortlistCandidate, by: { id: string; name: string; role: AuditEntry["role"] }, via: "DLAO_CHOICE" | "AUTO_NEXT", note: string | null): LawyerAssignment {
  const r = ensureRules(db);
  const m = matterOf(a);
  const previous = [...m.assignments].reverse().find((x) => x.status === "WITHDRAWN");
  const s: LawyerAssignment = {
    assignmentId: rid("ASN"),
    lawyerId: c.lawyerId,
    lawyerName: c.name,
    status: "OFFERED",
    offeredAt: now(),
    offeredBy: by.id,
    offeredByName: by.name,
    note,
    respondBy: addHours(now(), r.offerResponseHours),
    respondedAt: null,
    declineReason: null,
    responseOverdueFlaggedAt: null,
    handoverFrom: previous?.assignmentId ?? null,
    shortlistId: sl.shortlistId,
    offeredVia: via,
    reassignFlaggedAt: null,
    ledger: { hearingsAttended: 0, hearingsMissed: 0, hearingsNotHeld: 0, hearingsUnreported: 0, updatesOnTime: 0, updatesLate: 0, updatedAt: now() },
    payment: null,
  };
  m.assignments.push(s);
  c.outcome = "OFFERED";
  c.offeredAt = now();
  const t = openTask(db, a, { type: "LAWYER_RESPONSE", assignedRole: "PANEL_LAWYER", assigneeId: c.lawyerId, priority: a.routing.recommendedPriority, reason: `New case ${a.caseId}: accept or decline`, dueAt: s.respondBy, context: { assignmentId: s.assignmentId } });
  audit(db, a.audit, {
    actor: by.id,
    role: by.role,
    action: via === "AUTO_NEXT" ? "lawyer.auto_offered_next" : "lawyer.offered",
    detail: { assignmentId: s.assignmentId, lawyerId: c.lawyerId, lawyer: c.name, shortlistId: sl.shortlistId, rank: c.rank, score: c.score, respondBy: s.respondBy, taskId: t.taskId, handoverFrom: s.handoverFrom },
  });
  const l = db.lawyers.find((x) => x.lawyerId === c.lawyerId);
  if (l) audit(db, l.audit, { actor: by.id, role: by.role, action: "lawyer.offer_received", detail: { applicationId: a.applicationId, caseId: a.caseId, via } });
  smsLawyer(db, a, c.lawyerId, `DLAS: new legal aid case ${a.caseId} offered to you. See "Case intake" in the lawyer portal and accept or decline by ${fmt(s.respondBy)}.`);
  return s;
}

/** After a decline / no answer: the engine offers the case to the next pending lawyer on the shortlist, or tells the DLAO it ran out. */
function autoOfferNext(db: DlasDb, a: ApplicationRecord, sl: LawyerShortlist, note: string | null) {
  const next = sl.candidates.filter((c) => c.outcome === "PENDING").sort((x, y) => x.rank - y.rank)[0];
  if (next) {
    offerTo(db, a, sl, next, { id: "system", name: "Engine — next on the DLAO shortlist", role: "system" }, "AUTO_NEXT", note);
    return;
  }
  sl.status = "EXHAUSTED";
  audit(db, a.audit, { actor: "system", role: "system", action: "lawyer.shortlist_exhausted", detail: { shortlistId: sl.shortlistId } });
  openTask(db, a, { type: "LAWYER_ASSIGNMENT", assignedRole: "DLAO", priority: "HIGH", reason: `All ${sl.candidates.length} shortlisted lawyers declined or did not answer for ${a.caseId} — ask the engine for a new shortlist`, dueAt: addHours(now(), 24), context: { shortlistId: sl.shortlistId } });
}

export const DlaoLawyerService = {
  /** "Assign lawyer": the engine ranks the district panel and keeps the top N (rules.shortlistSize). */
  createShortlist(applicationId: string) {
    const o = officer();
    return withCase(applicationId, (db, a) => {
      const r = ensureRules(db);
      if (a.review?.pathway?.type !== "LAWYER" || !a.caseId) throw new Error("Choose the Panel lawyer pathway first");
      if (a.lawyer?.completion) throw new Error("Representation already completed");
      if (activeAssignment(a)) throw new Error("A lawyer is already assigned or has an open offer");
      const ranked = rankLawyers(db, a).slice(0, r.shortlistSize);
      if (!ranked.length) throw new Error("No eligible lawyers on this district's panel (everyone registered has already declined or been removed)");
      const m = matterOf(a);
      for (const old of m.shortlists) if (old.status === "ACTIVE") old.status = "CANCELLED";
      const sl: LawyerShortlist = {
        shortlistId: rid("SHL"),
        createdAt: now(),
        by: o.officerId,
        byName: o.name,
        rulesVersion: r.version,
        status: "ACTIVE",
        candidates: ranked.map((c) => ({ ...c, outcome: "PENDING", reason: null, offeredAt: null })),
      };
      m.shortlists.push(sl);
      audit(db, a.audit, { actor: o.officerId, role: "dlao", action: "lawyer.shortlist_generated", detail: { officer: o.name, shortlistId: sl.shortlistId, candidates: sl.candidates.map((c) => ({ lawyerId: c.lawyerId, rank: c.rank, score: c.score })), weights: r.weights } });
      return sl;
    });
  },


  /** The DLAO offers the case to one lawyer from the active shortlist. */
  assign(applicationId: string, input: { lawyerId: string; note: string }) {
    const o = officer();
    return withCase(applicationId, (db, a) => {
      if (a.review?.pathway?.type !== "LAWYER" || !a.caseId) throw new Error("Choose the Panel lawyer pathway first");
      if (a.lawyer?.completion) throw new Error("Representation already completed");
      if (activeAssignment(a)) throw new Error("A lawyer is already assigned or has an open offer");
      const sl = activeShortlist(a);
      if (!sl) throw new Error("Click “Assign lawyer” to get the engine's shortlist first");
      const c = sl.candidates.find((x) => x.lawyerId === input.lawyerId);
      if (!c || c.outcome !== "PENDING") throw new Error("Choose a lawyer from the shortlist who has not been asked yet");
      closeTasks(db, a, o.officerId, "dlao", (t) => t.type === "LAWYER_ASSIGNMENT");
      const s = offerTo(db, a, sl, c, { id: o.officerId, name: o.name, role: "dlao" }, "DLAO_CHOICE", input.note.trim() || null);
      audit(db, a.audit, { actor: o.officerId, role: "dlao", action: "lawyer.dlao_choice", detail: { officer: o.name, lawyerId: c.lawyerId, rank: c.rank, followedTopPick: c.rank === Math.min(...sl.candidates.map((x) => x.rank)) } });
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

  /** DLAO approves a lawyer's payment against the fee schedule. Changing the computed hearing count needs a note. */
  approvePayment(applicationId: string, assignmentId: string, input: { payableHearings: number; note: string }) {
    const o = officer();
    return withCase(applicationId, (db, a) => {
      const s = a.lawyer?.assignments.find((x) => x.assignmentId === assignmentId);
      if (!s?.payment) throw new Error("No payment to review for this lawyer");
      if (s.payment.status !== "DLAO_REVIEW") throw new Error(s.payment.status === "APPROVED" || s.payment.status === "PAID" ? "Payment already approved" : "Complete the representation first");
      const computed = s.payment.completedStages.filter((x) => x.result === "ATTENDED").length || s.payment.payableHearings;
      const n = Math.floor(Number(input.payableHearings));
      if (!Number.isFinite(n) || n < 0 || n > s.payment.completedStages.length) throw new Error(`Payable hearings must be between 0 and ${s.payment.completedStages.length}`);
      if (n !== computed && input.note.trim().length < 10) throw new Error("You changed the hearing count — write a reason of at least 10 characters");
      s.payment.status = "APPROVED";
      s.payment.payableHearings = n;
      s.payment.approval = { payableHearings: n, computedHearings: computed, note: input.note.trim(), by: o.officerId, byName: o.name, at: now() };
      s.payment.note = `Approved by ${o.name}: ${n} hearing(s) × district fee (DEMO_RATE)`;
      audit(db, a.audit, { actor: o.officerId, role: "dlao", action: "lawyer.payment_approved", detail: { officer: o.name, assignmentId, lawyerId: s.lawyerId, payableHearings: n, computedHearings: computed, adjusted: n !== computed, note: input.note.trim() } });
      smsLawyer(db, a, s.lawyerId, `DLAS: payment for ${a.caseId} approved — ${n} hearing(s) at the district fee rate.`);
      return s.payment;
    });
  },

  /** SIMULATED payout (no payment gateway in the prototype) — records a demo transfer reference. */
  payLawyer(applicationId: string, assignmentId: string) {
    const o = officer();
    return withCase(applicationId, (db, a) => {
      const s = a.lawyer?.assignments.find((x) => x.assignmentId === assignmentId);
      if (!s?.payment) throw new Error("No payment for this lawyer");
      if (s.payment.status === "PAID") throw new Error("Already paid");
      if (s.payment.status !== "APPROVED") throw new Error("Approve the payment first");
      s.payment.status = "PAID";
      s.payment.disbursement = { ref: rid("SIMPAY"), method: "SIMULATED_TRANSFER", simulated: true, by: o.officerId, byName: o.name, at: now() };
      audit(db, a.audit, { actor: o.officerId, role: "dlao", action: "lawyer.payment_disbursed", detail: { officer: o.name, assignmentId, lawyerId: s.lawyerId, payableHearings: s.payment.payableHearings, ref: s.payment.disbursement.ref, simulated: true, note: "SIMULATED — no money moved" } });
      smsLawyer(db, a, s.lawyerId, `DLAS: payment for ${a.caseId} sent (simulated) — ref ${s.payment.disbursement.ref}.`);
      return s.payment;
    });
  },

  /** Final step on the lawyer path: the DLAO closes the case after every simulated payout is recorded. */
  closeCase(applicationId: string, reason: string) {
    const o = officer();
    if (reason.trim().length < 10) throw new Error("A closing note of at least 10 characters is required");
    return withCase(applicationId, (db, a) => {
      const m = a.lawyer;
      if (!m?.completion) throw new Error("Complete the representation first");
      if (a.closedAt || m.closure) throw new Error("This case is already closed");
      const unpaid = m.assignments.filter((s) => s.payment && s.payment.status !== "PAID");
      if (unpaid.length) throw new Error(`Approve and pay ${unpaid.map((s) => s.lawyerName).join(", ")} before closing`);
      const from = a.status;
      const at = now();
      m.closure = { reason: reason.trim(), by: o.officerId, byName: o.name, at };
      const testimonial: LawyerClosureTestimonial = {
        testimonialId: rid("TST"),
        issuedAt: at,
        issuedBy: o.officerId,
        issuedByName: o.name,
        office: a.routing.office,
        applicationId: a.applicationId,
        caseRef: a.caseId ?? a.applicationId,
        applicantName: a.data.applicant.fullName ?? "—",
        respondentName: a.data.matter.opposingParty || null,
        matter: a.data.matter.category,
        outcome: m.completion.outcome,
        outcomeReason: m.completion.reason,
        closureReason: reason.trim(),
        lawyerNames: [...new Set(m.assignments.filter((s) => s.status === "COMPLETED" || s.status === "WITHDRAWN").map((s) => s.lawyerName))],
        hearingsRecorded: m.hearings.length,
        simulated: true,
      };
      m.closureTestimonial = testimonial;
      a.status = "RESOLVED";
      a.stage = "CLOSURE";
      a.closedAt = at;
      closeTasks(db, a, o.officerId, "dlao", () => true);
      audit(db, a.audit, { actor: o.officerId, role: "dlao", action: "status.changed", detail: { from, to: "RESOLVED" } });
      audit(db, a.audit, { actor: o.officerId, role: "dlao", action: "application.closed", detail: { officer: o.name, pathway: "LAWYER", outcome: m.completion.outcome, reason: reason.trim(), payments: m.assignments.filter((s) => s.payment).map((s) => ({ lawyerId: s.lawyerId, status: s.payment!.status, payableHearings: s.payment!.payableHearings })) } });
      audit(db, a.audit, { actor: o.officerId, role: "dlao", action: "lawyer.closure_testimonial_issued", detail: { testimonialId: testimonial.testimonialId, officer: o.name, outcome: testimonial.outcome, simulated: true } });
      audit(db, a.audit, { actor: "system", role: "system", action: "lawyer.closure_testimonial_sent_to_citizen", detail: { testimonialId: testimonial.testimonialId, applicationId: a.applicationId } });
      notifyClient(db, a, o.officerId, "dlao", `Update on your reference ${testimonial.caseRef}. A closing record is available on your DLAS page.`, `DLAS legal aid: case ${testimonial.caseRef} is closed (outcome: ${m.completion.outcome.replace(/_/g, " ").toLowerCase()}). Testimonial ${testimonial.testimonialId} is available on your DLAS case page.`);
      return m.closure;
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
      const sl = m.shortlists.find((x) => x.shortlistId === s.shortlistId);
      if (sl) {
        sl.status = "ACCEPTED";
        const c = sl.candidates.find((x) => x.lawyerId === me.lawyerId);
        if (c) c.outcome = "ACCEPTED";
      }
      closeTasks(db, a, me.lawyerId, "panel_lawyer", (t) => t.type === "LAWYER_ASSIGNMENT");
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

  /** Decline (reason required) → the engine offers the case to the next lawyer on the DLAO's shortlist. */
  decline(applicationId: string, reason: string) {
    if (reason.trim().length < 10) throw new Error("A reason of at least 10 characters is required");
    return withMyCase(applicationId, (db, a, me, s) => {
      if (s.status !== "OFFERED") throw new Error("Already answered — ask the DLAO to reassign instead");
      s.status = "DECLINED";
      s.respondedAt = now();
      s.declineReason = reason.trim();
      closeTasks(db, a, me.lawyerId, "panel_lawyer", (t) => t.assigneeId === me.lawyerId);
      audit(db, a.audit, { actor: me.lawyerId, role: "panel_lawyer", action: "lawyer.declined", detail: { lawyer: me.name, assignmentId: s.assignmentId, reason: reason.trim() } });
      const sl = a.lawyer!.shortlists.find((x) => x.shortlistId === s.shortlistId);
      const c = sl?.candidates.find((x) => x.lawyerId === me.lawyerId);
      if (c) {
        c.outcome = "DECLINED";
        c.reason = reason.trim();
      }
      if (sl && sl.status === "ACTIVE") autoOfferNext(db, a, sl, s.note);
      else openTask(db, a, { type: "LAWYER_ASSIGNMENT", assignedRole: "DLAO", priority: "HIGH", reason: `${me.name} declined: ${reason.trim()} — assign another panel lawyer`, dueAt: addHours(now(), 24) });
      checkRedFlag(db, a, me.lawyerId);
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
      // PROTOTYPE: a future hearing may be reported early so the full flow can be demonstrated; it is marked, never hidden.
      const early = Date.now() < new Date(h.at).getTime();
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
        ...(early ? { beforeHearing: true } : {}),
      };
      m.updates.push(u);
      h.updateId = u.updateId;
      h.result = u.attendance === "ATTENDED" ? "ATTENDED" : u.attendance === "NOT_ATTENDED" ? "MISSED" : "NOT_HELD";
      a.provenance[`lawyer.updates.${u.updateId}`] = { source: "LAWYER_REPORTED", method: "AGENT_FORM", confidence: "STATED", by: me.lawyerId, at: now(), note: early ? "self-reported by the panel lawyer — PROTOTYPE: reported before the hearing date" : "self-reported by the panel lawyer" };
      closeTasks(db, a, me.lawyerId, "panel_lawyer", (t) => (t.type === "HEARING_UPDATE_DUE" || t.type === "LAWYER_UPDATE_OVERDUE") && (t.context as { hearingId?: string } | undefined)?.hearingId === h.hearingId);
      audit(db, a.audit, { actor: me.lawyerId, role: "panel_lawyer", action: "hearing.update_submitted", detail: { lawyer: me.name, updateId: u.updateId, hearingId: h.hearingId, attendance: u.attendance, result: h.result, outcome: u.outcome, nextDate: u.nextDate, late: u.late, beforeHearing: early } });
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
      // No answer in time → the offer expires and the engine moves to the next shortlisted lawyer.
      const a = db.applications.find((x) => x.applicationId === appId)!;
      const s = a.lawyer!.assignments.find((x) => x.assignmentId === asnId)!;
      s.responseOverdueFlaggedAt = now();
      s.status = "EXPIRED";
      s.respondedAt = now();
      closeTasks(db, a, "system", "system", (t) => t.type === "LAWYER_RESPONSE" && t.assigneeId === s.lawyerId);
      audit(db, a.audit, { actor: "system", role: "system", action: "lawyer.offer_expired", detail: { assignmentId: s.assignmentId, lawyerId: s.lawyerId, respondBy: s.respondBy } });
      smsLawyer(db, a, s.lawyerId, `DLAS: the offer for case ${a.caseId} has expired (no answer by ${fmt(s.respondBy)}).`);
      const sl = a.lawyer!.shortlists.find((x) => x.shortlistId === s.shortlistId);
      const c = sl?.candidates.find((x) => x.lawyerId === s.lawyerId);
      if (c) c.outcome = "NO_RESPONSE";
      if (sl && sl.status === "ACTIVE") autoOfferNext(db, a, sl, s.note);
      else openTask(db, a, { type: "LAWYER_ASSIGNMENT", assignedRole: "DLAO", priority: "HIGH", reason: `${s.lawyerName} did not answer the offer for ${a.caseId} — assign another panel lawyer`, dueAt: addHours(now(), 24) });
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

/* ================================================================== *
 *  Lawyer notifications — derived from the record (nothing stored but the read time)
 * ================================================================== */

export type LawyerNotification = {
  id: string;
  at: string;
  tone: "ok" | "warn" | "err" | "neutral";
  title: { bn: string; en: string };
  body: { bn: string; en: string };
  href: string;
  unread: boolean;
  contactId?: string; // summons / reminder that the lawyer can acknowledge
  needsAck?: boolean;
};

export function lawyerNotificationsFor(db: DlasDb, me: PanelLawyerAccount | undefined, t = Date.now()): LawyerNotification[] {
  if (!me) return [];
  const out: Omit<LawyerNotification, "unread">[] = [];
  const matterName = (a: ApplicationRecord, lang: "bn" | "en") => label(MATTERS, a.data.matter.category, lang);
  for (const a of db.applications) {
    const m = a.lawyer;
    if (!m) continue;
    const cid = a.caseId ?? a.applicationId;
    for (const s of m.assignments.filter((x) => x.lawyerId === me.lawyerId)) {
      if (s.status === "OFFERED")
        out.push({
          id: `off-${s.assignmentId}`,
          at: s.offeredAt,
          tone: "warn",
          title: { bn: `নতুন মামলা প্রস্তাব: ${cid}`, en: `New case offered: ${cid}` },
          body: {
            bn: `${matterName(a, "bn")} · ${s.offeredVia === "AUTO_NEXT" ? "আগের আইনজীবী প্রত্যাখ্যান করায় তালিকার পরের জন হিসেবে" : `${s.offeredByName} পাঠিয়েছেন`} · ${fmt(s.respondBy)}-এর মধ্যে উত্তর দিন`,
            en: `${matterName(a, "en")} · ${s.offeredVia === "AUTO_NEXT" ? "offered to you as next on the shortlist after another lawyer declined" : `sent by ${s.offeredByName}`} · answer by ${fmt(s.respondBy)}`,
          },
          href: "#intake",
        });
      if (s.status === "EXPIRED") out.push({ id: `exp-${s.assignmentId}`, at: s.respondedAt ?? s.respondBy, tone: "err", title: { bn: `প্রস্তাবের মেয়াদ শেষ: ${cid}`, en: `Offer expired: ${cid}` }, body: { bn: "সময়মতো উত্তর না দেওয়ায় মামলাটি তালিকার পরের আইনজীবীর কাছে গেছে।", en: "No answer in time — the case went to the next lawyer on the shortlist." }, href: "#intake" });
      if (s.status === "ACCEPTED" || s.status === "COMPLETED" || (s.status === "WITHDRAWN" && s.respondedAt && m.access.some((g) => g.assignmentId === s.assignmentId)))
        out.push({ id: `acc-${s.assignmentId}`, at: m.access.find((g) => g.assignmentId === s.assignmentId)?.grantedAt ?? s.respondedAt ?? s.offeredAt, tone: "ok", title: { bn: `আপনি মামলা নিয়েছেন: ${cid}`, en: `You took case ${cid}` }, body: { bn: s.handoverFrom ? "হস্তান্তরিত মামলা — আগের সব তথ্য দেখা যাবে।" : matterName(a, "bn"), en: s.handoverFrom ? "Handed-over case — the full earlier history is available." : matterName(a, "en") }, href: `#cases/${a.applicationId}` });
      if (s.status === "WITHDRAWN" && m.access.some((g) => g.assignmentId === s.assignmentId))
        out.push({ id: `wd-${s.assignmentId}`, at: m.access.find((g) => g.assignmentId === s.assignmentId)?.revokedAt ?? s.respondedAt ?? s.offeredAt, tone: "err", title: { bn: `মামলা অন্য আইনজীবীকে দেওয়া হয়েছে: ${cid}`, en: `Case reassigned: ${cid}` }, body: { bn: `আপনার প্রবেশাধিকার শেষ। কারণ: ${s.declineReason ?? "—"}`, en: `Your access has ended. Reason: ${s.declineReason ?? "—"}` }, href: "#cases" });
      if (s.status === "COMPLETED" && m.completion)
        out.push({ id: `done-${s.assignmentId}`, at: m.completion.at, tone: "ok", title: { bn: `মামলা সম্পন্ন: ${cid}`, en: `Case completed: ${cid}` }, body: { bn: `উপস্থিত শুনানি ${s.ledger.hearingsAttended} — পেমেন্ট পর্যালোচনায়।`, en: `${s.ledger.hearingsAttended} attended hearing(s) — sent for payment review.` }, href: "#cases" });
      if (s.payment?.approval)
        out.push({ id: `payok-${s.assignmentId}`, at: s.payment.approval.at, tone: "ok", title: { bn: `পেমেন্ট অনুমোদিত: ${cid}`, en: `Payment approved: ${cid}` }, body: { bn: `${s.payment.approval.payableHearings}টি শুনানি × জেলা ফি${s.payment.approval.payableHearings !== s.payment.approval.computedHearings ? ` (সংশোধিত: ${s.payment.approval.note})` : ""}`, en: `${s.payment.approval.payableHearings} hearing(s) × district fee${s.payment.approval.payableHearings !== s.payment.approval.computedHearings ? ` (adjusted: ${s.payment.approval.note})` : ""}` }, href: "#cases" });
      if (s.payment?.disbursement)
        out.push({ id: `paid-${s.assignmentId}`, at: s.payment.disbursement.at, tone: "ok", title: { bn: `পেমেন্ট পাঠানো হয়েছে (সিমুলেটেড): ${cid}`, en: `Payment sent (simulated): ${cid}` }, body: { bn: `রেফারেন্স ${s.payment.disbursement.ref} — প্রোটোটাইপে কোনো টাকা লেনদেন হয় না।`, en: `Ref ${s.payment.disbursement.ref} — no money moves in the prototype.` }, href: "#cases" });
      if (s.reassignFlaggedAt && s.status === "ACCEPTED")
        out.push({ id: `rf-${s.assignmentId}`, at: s.reassignFlaggedAt, tone: "err", title: { bn: `${cid}: শুনানি মিসের সীমা পার হয়েছে`, en: `${cid}: missed-hearing limit reached` }, body: { bn: "অফিস অন্য আইনজীবী দিতে পারে।", en: "The office may assign another lawyer." }, href: `#cases/${a.applicationId}` });
      if (s.status !== "ACCEPTED") continue;
      for (const h of m.hearings.filter((x) => x.assignmentId === s.assignmentId)) {
        const st = hearingState(h, t);
        if (st === "OVERDUE") out.push({ id: `od-${h.hearingId}`, at: h.updateDueAt, tone: "err", title: { bn: `প্রতিবেদন দেরি: ${cid}`, en: `Report overdue: ${cid}` }, body: { bn: `${fmt(h.at)}-এর শুনানি · ডিএলএও জেনেছেন`, en: `Hearing of ${fmt(h.at)} · the DLAO has been alerted` }, href: `#cases/${a.applicationId}` });
        if (st === "UPDATE_DUE") out.push({ id: `due-${h.hearingId}`, at: h.at, tone: "warn", title: { bn: `প্রতিবেদন দিন: ${cid}`, en: `Report due: ${cid}` }, body: { bn: `${fmt(h.at)}-এর শুনানি · শেষ সময় ${fmt(h.updateDueAt)}`, en: `Hearing of ${fmt(h.at)} · due ${fmt(h.updateDueAt)}` }, href: `#cases/${a.applicationId}` });
      }
    }
  }
  // Red flag for declined offers (and a warning two declines before it).
  const rf = activeRedFlag(me);
  const rules = rulesOf(db);
  if (rf)
    out.push({ id: `rfl-${rf.flagId}`, at: rf.raisedAt, tone: "err", title: { bn: "লাল পতাকা: অনেক প্রস্তাব প্রত্যাখ্যান", en: "Red flag: too many declined offers" }, body: { bn: `আপনি ${rf.declines.length}টি মামলার প্রস্তাব প্রত্যাখ্যান করেছেন (সীমা ${rf.threshold})। ডিএলএও পর্যালোচনা করবেন; ততদিন ইঞ্জিনের তালিকায় আপনি পরে থাকবেন।`, en: `You declined ${rf.declines.length} case offers (limit ${rf.threshold}). The DLAO will review; until then the engine lists you after other lawyers.` }, href: "#intake" });
  for (const f of (me.redFlags ?? []).filter((x) => x.status === "CLEARED"))
    out.push({ id: `rflc-${f.flagId}`, at: f.clearedAt ?? f.raisedAt, tone: "ok", title: { bn: "লাল পতাকা তুলে নেওয়া হয়েছে", en: "Red flag cleared" }, body: { bn: `${f.clearedByName ?? ""}: ${f.clearNote ?? ""}`, en: `${f.clearedByName ?? ""}: ${f.clearNote ?? ""}` }, href: "#notifications" });
  if (!rf) {
    const ds = countedDeclines(db, me);
    const n = ds.length;
    if (n > 0 && n >= rules.declinesBeforeRedFlag - 2)
      out.push({ id: `rflw-${n}`, at: ds[n - 1].at, tone: "warn", title: { bn: `সতর্কতা: ${n}/${rules.declinesBeforeRedFlag} প্রস্তাব প্রত্যাখ্যাত`, en: `Warning: ${n} of ${rules.declinesBeforeRedFlag} offers declined` }, body: { bn: `${rules.declinesBeforeRedFlag}টি প্রত্যাখ্যানে আপনাকে লাল পতাকা দেওয়া হবে।`, en: `At ${rules.declinesBeforeRedFlag} declines you will be red-flagged for DLAO review.` }, href: "#intake" });
  }

  // Calls, summons and reminders from the DLAO.
  for (const c of me.contacts ?? []) {
    const about = c.applicationId ? db.applications.find((x) => x.applicationId === c.applicationId) : null;
    const ref = about ? ` · ${about.caseId ?? about.applicationId}` : "";
    if (c.kind === "SUMMONS")
      out.push({
        id: `sum-${c.contactId}`,
        at: c.at,
        tone: c.status === "SENT" ? "err" : c.status === "MISSED" ? "err" : "ok",
        title: { bn: `অফিসে তলব: ${c.byName}`, en: `Summoned by ${c.byName}` },
        body: {
          bn: `${c.place ?? ""} · ${c.appearAt ? fmt(c.appearAt) : ""}${ref} · কারণ: ${c.note}${c.status === "ACKNOWLEDGED" ? " · আপনি নিশ্চিত করেছেন" : c.status === "ATTENDED" ? " · উপস্থিত ছিলেন" : c.status === "MISSED" ? " · উপস্থিত হননি" : ""}`,
          en: `${c.place ?? ""} · ${c.appearAt ? fmt(c.appearAt) : ""}${ref} · Reason: ${c.note}${c.status === "ACKNOWLEDGED" ? " · you acknowledged" : c.status === "ATTENDED" ? " · attended" : c.status === "MISSED" ? " · not attended" : ""}`,
        },
        href: "#notifications",
        contactId: c.contactId,
        needsAck: c.status === "SENT",
      });
    if (c.kind === "REMINDER")
      out.push({ id: `rem-${c.contactId}`, at: c.at, tone: c.status === "SENT" ? "warn" : "neutral", title: { bn: `বার্তা: ${c.byName}`, en: `Message from ${c.byName}` }, body: { bn: `${c.note}${ref}`, en: `${c.note}${ref}` }, href: c.applicationId ? `#cases/${c.applicationId}` : "#notifications", contactId: c.contactId, needsAck: c.status === "SENT" });
    if (c.kind === "CALL" && c.callOutcome !== "REACHED")
      out.push({ id: `call-${c.contactId}`, at: c.at, tone: "warn", title: { bn: "অফিস আপনাকে ফোন করেছিল", en: "The legal aid office tried to call you" }, body: { bn: `${c.byName}${ref}${c.note ? ` · ${c.note}` : ""}`, en: `${c.byName}${ref}${c.note ? ` · ${c.note}` : ""}` }, href: "#notifications" });
  }
  const today = dayKey(t);
  if (!(me.attendance ?? []).some((d) => d.date === today)) {
    const start = new Date(`${today}T00:00:00`).toISOString();
    out.push({ id: `att-${today}`, at: start, tone: "warn", title: { bn: "আজকের উপস্থিতি দিন", en: "Mark today's attendance" }, body: { bn: "উপস্থিতি পাতায় উপস্থিত বা অনুপস্থিত দিন।", en: "Mark present or absent on the Attendance page." }, href: "#attendance" });
  }
  const readAt = me.notificationsReadAt ?? "";
  return out.sort((x, y) => y.at.localeCompare(x.at)).map((n) => ({ ...n, unread: n.at > readAt }));
}

export function useLawyerNotifications(): LawyerNotification[] {
  const db = useDlasDb();
  const me = useCurrentLawyer();
  const t = useClock();
  return useMemo(() => lawyerNotificationsFor(db, me, t), [db, me, t]);
}
