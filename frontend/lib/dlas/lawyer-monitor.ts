"use client";

/* ------------------------------------------------------------------ *
 *  DLAO lawyer monitoring — every panel lawyer in the officer's district
 *  (SCLAC: all), their daily attendance, case updates, missed hearings,
 *  overdue reports, and the officer's calls / summons / reminders.
 *
 *  Reads and writes localStorage["dlas.db.v1"] only:
 *    lawyers[].contacts[]  CALL (logged after a phone call made outside the system),
 *                          SUMMONS (appear at the office; lawyer acknowledges; DLAO records attended/missed),
 *                          REMINDER (message to the lawyer)
 *  SMS to the lawyer is SIMULATED (db.outbox). Every action is audited on the
 *  lawyer's account and, when tied to a case, on that case.
 * ------------------------------------------------------------------ */

import { useMemo } from "react";
import { mutate, useDlasDb } from "./store";
import { DlaoAuth, useCurrentOfficer } from "./dlao";
import { LawyerAuth, activeRedFlag, dayKey, hearingMissed, hearingState, lawyerStats, rulesOf, useClock } from "./lawyer";
import type { ApplicationRecord, AuditEntry, DlaoOfficerAccount, DlasDb, Hearing, HearingUpdate, LawyerAssignment, LawyerContact, PanelLawyerAccount } from "./schema";

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;
const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

export function officerSeesLawyer(o: DlaoOfficerAccount | undefined, l: PanelLawyerAccount): boolean {
  if (!o) return false;
  return o.officeType === "SCLAC" || l.district === o.district;
}

/* ------------------------------ read model ------------------------------ */

export type LawyerCaseRow = {
  a: ApplicationRecord;
  s: LawyerAssignment;
  nextHearing: Hearing | null;
  lastUpdate: (HearingUpdate & { hearingAt: string | null }) | null;
  overdue: number;
  due: number;
  missed: number;
};

export type MonitoredLawyer = {
  l: PanelLawyerAccount;
  todayStatus: "PRESENT" | "ABSENT" | null;
  stats: ReturnType<typeof lawyerStats>;
  missed90: number;
  overdueReports: number;
  pendingOffers: number;
  openSummons: number;
  cases: LawyerCaseRow[];
  pastCases: LawyerCaseRow[];
  lastReportAt: string | null;
  alerts: string[]; // short codes for sorting / tags
  redFlag: ReturnType<typeof activeRedFlag>; // active red flag (declined too many offers)
  declines: number; // declined offers counting towards the next red flag
  declineLimit: number;
};

function monitor(db: DlasDb, l: PanelLawyerAccount, t: number): MonitoredLawyer {
  const since = t - 90 * 86_400_000;
  const rows: LawyerCaseRow[] = [];
  const past: LawyerCaseRow[] = [];
  let missed90 = 0;
  let pendingOffers = 0;
  let lastReportAt: string | null = null;
  for (const a of db.applications) {
    const m = a.lawyer;
    if (!m) continue;
    for (const s of m.assignments.filter((x) => x.lawyerId === l.lawyerId)) {
      const hs = m.hearings.filter((h) => h.assignmentId === s.assignmentId);
      missed90 += hs.filter((h) => new Date(h.at).getTime() >= since && hearingMissed(h, t)).length;
      const ups = m.updates.filter((u) => hs.some((h) => h.hearingId === u.hearingId)).sort((x, y) => y.at.localeCompare(x.at));
      if (ups[0] && (!lastReportAt || ups[0].at > lastReportAt)) lastReportAt = ups[0].at;
      const row: LawyerCaseRow = {
        a,
        s,
        nextHearing: hs.filter((h) => hearingState(h, t) === "UPCOMING").sort((x, y) => x.at.localeCompare(y.at))[0] ?? null,
        lastUpdate: ups[0] ? { ...ups[0], hearingAt: hs.find((h) => h.hearingId === ups[0]!.hearingId)?.at ?? null } : null,
        overdue: hs.filter((h) => hearingState(h, t) === "OVERDUE").length,
        due: hs.filter((h) => hearingState(h, t) === "UPDATE_DUE").length,
        missed: hs.filter((h) => hearingMissed(h, t)).length,
      };
      if (s.status === "OFFERED") pendingOffers += 1;
      if (s.status === "ACCEPTED" || s.status === "OFFERED") rows.push(row);
      else if (s.status === "COMPLETED" || s.status === "WITHDRAWN") past.push(row);
    }
  }
  const stats = lawyerStats(db, l, null, t);
  const today = (l.attendance ?? []).find((d) => d.date === dayKey(t));
  const overdueReports = rows.reduce((n, r) => n + (r.s.status === "ACCEPTED" ? r.overdue : 0), 0);
  const openSummons = (l.contacts ?? []).filter((c) => c.kind === "SUMMONS" && (c.status === "SENT" || c.status === "ACKNOWLEDGED")).length;
  const alerts: string[] = [];
  if (overdueReports) alerts.push("OVERDUE");
  if (missed90 >= rulesOf(db).missedHearingsBeforeReassign) alerts.push("MISSED");
  if (today?.status === "ABSENT") alerts.push("ABSENT");
  if (!today) alerts.push("NOT_MARKED");
  if (openSummons) alerts.push("SUMMONED");
  const redFlag = activeRedFlag(l);
  if (redFlag) alerts.unshift("RED_FLAG");
  return { l, todayStatus: today?.status ?? null, stats, missed90, overdueReports, pendingOffers, openSummons, cases: rows, pastCases: past, lastReportAt, alerts, redFlag, declines: stats.declines ?? 0, declineLimit: rulesOf(db).declinesBeforeRedFlag };
}

/** All lawyers the logged-in officer supervises, most urgent first. */
export function useDistrictLawyers() {
  const db = useDlasDb();
  const o = useCurrentOfficer();
  const t = useClock();
  return useMemo(() => {
    const list = db.lawyers.filter((l) => officerSeesLawyer(o, l)).map((l) => monitor(db, l, t));
    const weight = (m: MonitoredLawyer) => (m.redFlag ? 1000 : 0) + m.overdueReports * 100 + m.missed90 * 50 + m.openSummons * 20 + (m.todayStatus === "ABSENT" ? 5 : 0) + m.cases.length;
    list.sort((x, y) => weight(y) - weight(x) || x.l.name.localeCompare(y.l.name));
    // Latest hearing reports across these lawyers (case updates feed).
    const ids = new Set(list.map((m) => m.l.lawyerId));
    const feed = db.applications
      .flatMap((a) =>
        (a.lawyer?.updates ?? [])
          .filter((u) => ids.has(u.by))
          .map((u) => ({ a, u, h: a.lawyer!.hearings.find((h) => h.hearingId === u.hearingId) ?? null })),
      )
      .sort((x, y) => y.u.at.localeCompare(x.u.at))
      .slice(0, 12);
    return { officer: o, list, feed, now: t };
  }, [db, o, t]);
}

/* ------------------------------ DLAO actions ------------------------------ */

function officer(): DlaoOfficerAccount {
  const o = DlaoAuth.current();
  if (!o) throw new Error("Officer login required");
  return o;
}

function withLawyer<T>(lawyerId: string, fn: (db: DlasDb, l: PanelLawyerAccount, o: DlaoOfficerAccount) => T): T {
  const o = officer();
  return mutate((db) => {
    const l = db.lawyers.find((x) => x.lawyerId === lawyerId);
    if (!l) throw new Error("Unknown lawyer");
    if (!officerSeesLawyer(o, l)) throw new Error("This lawyer is not on your district's panel");
    l.contacts = l.contacts ?? [];
    return fn(db, l, o);
  });
}

function logOnCase(db: DlasDb, applicationId: string | null, e: Omit<AuditEntry, "seq" | "at">) {
  if (!applicationId) return;
  const a = db.applications.find((x) => x.applicationId === applicationId);
  if (!a) return;
  audit(db, a.audit, e);
  a.version += 1;
  a.updatedAt = now();
}

function smsLawyer(db: DlasDb, l: PanelLawyerAccount, applicationId: string | null, body: string) {
  db.outbox.push({ msgId: rid("SMS"), kind: "SMS_CONFIRMATION", to: l.phone, body, sessionId: null, applicationId, simulated: true, status: "DELIVERED", at: now() });
}

function contact(o: DlaoOfficerAccount, c: Partial<LawyerContact> & Pick<LawyerContact, "kind" | "note" | "status">): LawyerContact {
  return {
    contactId: rid("CON"),
    at: now(),
    by: o.officerId,
    byName: o.name,
    applicationId: null,
    callOutcome: null,
    appearAt: null,
    place: null,
    acknowledgedAt: null,
    resolvedAt: null,
    resolutionNote: null,
    ...c,
  };
}

export const DlaoLawyerMonitor = {
  /** The officer phoned the lawyer (outside the system) and records what happened. */
  logCall(lawyerId: string, input: { outcome: "REACHED" | "NO_ANSWER" | "WRONG_NUMBER"; note: string; applicationId: string | null }) {
    if (input.note.trim().length < 3 && input.outcome === "REACHED") throw new Error("Write a short note on what was agreed");
    return withLawyer(lawyerId, (db, l, o) => {
      const c = contact(o, { kind: "CALL", note: input.note.trim(), status: "LOGGED", callOutcome: input.outcome, applicationId: input.applicationId });
      l.contacts.push(c);
      audit(db, l.audit, { actor: o.officerId, role: "dlao", action: "lawyer.call_logged", detail: { contactId: c.contactId, outcome: input.outcome, applicationId: input.applicationId } });
      logOnCase(db, input.applicationId, { actor: o.officerId, role: "dlao", action: "lawyer.call_logged", detail: { lawyerId, outcome: input.outcome, note: c.note } });
      return c;
    });
  },

  /** Summon the lawyer to the office. The lawyer is notified (SMS simulated) and acknowledges; the officer records attended / missed. */
  summon(lawyerId: string, input: { appearAt: string; place: string; reason: string; applicationId: string | null }) {
    const at = new Date(input.appearAt);
    if (Number.isNaN(at.getTime())) throw new Error("Choose the date and time to appear");
    if (input.reason.trim().length < 10) throw new Error("Give a reason of at least 10 characters");
    if (input.place.trim().length < 2) throw new Error("Where should the lawyer appear?");
    return withLawyer(lawyerId, (db, l, o) => {
      const c = contact(o, { kind: "SUMMONS", note: input.reason.trim(), status: "SENT", appearAt: at.toISOString(), place: input.place.trim(), applicationId: input.applicationId });
      l.contacts.push(c);
      audit(db, l.audit, { actor: o.officerId, role: "dlao", action: "lawyer.summoned", detail: { contactId: c.contactId, appearAt: c.appearAt, place: c.place, reason: c.note, applicationId: c.applicationId } });
      logOnCase(db, input.applicationId, { actor: o.officerId, role: "dlao", action: "lawyer.summoned", detail: { lawyerId, appearAt: c.appearAt, reason: c.note } });
      smsLawyer(db, l, input.applicationId, `DLAS: ${o.name} (legal aid office) asks you to appear at ${c.place} on ${fmt(c.appearAt!)}. Reason: ${c.note}. Please acknowledge in the lawyer portal.`);
      return c;
    });
  },

  /** Short reminder / instruction to the lawyer. */
  remind(lawyerId: string, input: { message: string; applicationId: string | null }) {
    if (input.message.trim().length < 5) throw new Error("Write the message");
    return withLawyer(lawyerId, (db, l, o) => {
      const c = contact(o, { kind: "REMINDER", note: input.message.trim(), status: "SENT", applicationId: input.applicationId });
      l.contacts.push(c);
      audit(db, l.audit, { actor: o.officerId, role: "dlao", action: "lawyer.reminded", detail: { contactId: c.contactId, applicationId: c.applicationId } });
      logOnCase(db, input.applicationId, { actor: o.officerId, role: "dlao", action: "lawyer.reminded", detail: { lawyerId, message: c.note } });
      smsLawyer(db, l, input.applicationId, `DLAS reminder from ${o.name}: ${c.note}`);
      return c;
    });
  },

  /** Record whether the lawyer came in for the summons. */
  /** The officer reviewed the declined offers and clears the red flag (note required). New declines count from now. */
  clearRedFlag(lawyerId: string, note: string) {
    if (note.trim().length < 10) throw new Error("Write what you reviewed / agreed (at least 10 characters)");
    return withLawyer(lawyerId, (db, l, o) => {
      const f = activeRedFlag(l);
      if (!f) throw new Error("No active red flag");
      f.status = "CLEARED";
      f.clearedAt = now();
      f.clearedBy = o.officerId;
      f.clearedByName = o.name;
      f.clearNote = note.trim();
      audit(db, l.audit, { actor: o.officerId, role: "dlao", action: "lawyer.red_flag_cleared", detail: { flagId: f.flagId, note: f.clearNote } });
      for (const t of db.tasks) {
        if (t.type !== "LAWYER_RED_FLAG" || t.status === "DONE" || (t.context as { flagId?: string } | undefined)?.flagId !== f.flagId) continue;
        t.status = "DONE";
        logOnCase(db, t.applicationId, { actor: o.officerId, role: "dlao", action: "task.closed", detail: { taskId: t.taskId, type: t.type, lawyerId } });
      }
      smsLawyer(db, l, null, `DLAS: ${o.name} has reviewed and cleared your red flag. Note: ${f.clearNote}`);
      return f;
    });
  },

  resolveSummons(lawyerId: string, contactId: string, input: { result: "ATTENDED" | "MISSED"; note: string }) {
    return withLawyer(lawyerId, (db, l, o) => {
      const c = l.contacts.find((x) => x.contactId === contactId && x.kind === "SUMMONS");
      if (!c) throw new Error("Unknown summons");
      if (c.status === "ATTENDED" || c.status === "MISSED") throw new Error("Already recorded");
      c.status = input.result;
      c.resolvedAt = now();
      c.resolutionNote = input.note.trim() || null;
      audit(db, l.audit, { actor: o.officerId, role: "dlao", action: "lawyer.summons_resolved", detail: { contactId, result: input.result, note: c.resolutionNote } });
      logOnCase(db, c.applicationId, { actor: o.officerId, role: "dlao", action: "lawyer.summons_resolved", detail: { lawyerId, result: input.result } });
      return c;
    });
  },
};

/* ------------------------------ lawyer side ------------------------------ */

export const LawyerContactService = {
  /** The lawyer confirms they have seen a summons / reminder. */
  acknowledge(contactId: string) {
    const me = LawyerAuth.current();
    if (!me) throw new Error("Lawyer login required");
    return mutate((db) => {
      const l = db.lawyers.find((x) => x.lawyerId === me.lawyerId)!;
      const c = (l.contacts ?? []).find((x) => x.contactId === contactId);
      if (!c) throw new Error("Unknown message");
      if (c.status !== "SENT") return c;
      c.status = "ACKNOWLEDGED";
      c.acknowledgedAt = now();
      audit(db, l.audit, { actor: l.lawyerId, role: "panel_lawyer", action: "lawyer.contact_acknowledged", detail: { contactId, kind: c.kind } });
      logOnCase(db, c.applicationId, { actor: l.lawyerId, role: "panel_lawyer", action: "lawyer.contact_acknowledged", detail: { contactId, kind: c.kind } });
      return c;
    });
  },
};

