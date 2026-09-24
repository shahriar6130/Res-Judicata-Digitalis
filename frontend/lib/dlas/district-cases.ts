"use client";

/* ------------------------------------------------------------------ *
 *  District case register for the DLAO (/dashboard/dlo#cases) and the
 *  citizen-urgent list (#urgent). Read-only view over the shared record:
 *  every case the office handles, how long it has been running (age
 *  colour), when it was last updated (staleness colour), its state, and
 *  — for lawyer cases — the panel lawyer's hearings and overdue reports,
 *  so the officer can step in (summon, withdraw, reassign) from the
 *  existing lawyer screens.
 * ------------------------------------------------------------------ */

import { useMemo } from "react";
import { useDlasDb } from "./store";
import { applicationsForOffice, useCurrentOfficer } from "./dlao";
import { useClock } from "./lawyer";
import { classifyCase, type ControlRow } from "./office-control";
import { describeAudit, actorNames } from "./audit-trail";
import { pendingTransfer, acceptedTransfer } from "./case-handling";
import type { ApplicationRecord, UrgencyFlag } from "./schema";

export type Tone = "ok" | "warn" | "err" | "neutral";
const DAY = 86_400_000;

/** The citizen said it is urgent, or ticked an urgency flag, when filing. */
export function isCitizenUrgent(a: Pick<ApplicationRecord, "data">): boolean {
  return a.data.urgency.selfReportedUrgent || a.data.urgency.flags.length > 0;
}

export type DistrictCaseRow = {
  a: ApplicationRecord;
  control: ControlRow;
  closed: boolean;
  ageDays: number;
  ageTone: Tone; // green < 30 days · amber 30–90 · red > 90 (closed = neutral)
  lastUpdate: { at: string; text: { bn: string; en: string }; who: string } | null;
  staleDays: number;
  staleTone: Tone; // green ≤ 7 days · amber 8–14 · red > 14 without any update (closed = neutral)
  handler: { kind: "LAWYER" | "MEDIATOR"; id: string; name: string; status: string } | null;
  lawyer: { hearings: number; nextHearing: string | null; overdueReports: number; missed: number; lastReportAt: string | null } | null;
  urgent: { self: boolean; flags: UrgencyFlag[] };
  transfer: { pendingTo: string | null; receivedFrom: string | null };
};

export function districtCaseRow(a: ApplicationRecord, tasks: Parameters<typeof classifyCase>[1], o: Parameters<typeof classifyCase>[2], t: number, names: Map<string, string>): DistrictCaseRow {
  const control = classifyCase(a, tasks, o, t);
  const closed = !!a.closedAt || ["REJECTED", "WITHDRAWN", "RESOLVED", "CLOSED"].includes(a.status) || (!control.active && control.status !== "NEW");
  const end = closed ? new Date(a.closedAt ?? a.updatedAt).getTime() : t;
  const ageDays = t ? Math.max(0, Math.floor((end - new Date(a.submittedAt).getTime()) / DAY)) : 0;
  const last = a.audit[a.audit.length - 1] ?? null;
  const lv = last ? describeAudit(last, a, names) : null;
  const staleDays = t && last ? Math.max(0, Math.floor((t - new Date(last.at).getTime()) / DAY)) : 0;
  const asg = a.lawyer?.assignments.find((x) => x.status === "ACCEPTED" || x.status === "OFFERED") ?? null;
  const med = a.mediation?.assignments.find((x) => x.status === "ASSIGNED" || x.status === "AWAITING_OFFICER_CONFIRMATION") ?? null;
  const hearings = a.lawyer?.hearings ?? [];
  const future = hearings.filter((h) => new Date(h.at).getTime() > t).sort((x, y) => x.at.localeCompare(y.at));
  return {
    a,
    control,
    closed,
    ageDays,
    ageTone: closed ? "neutral" : ageDays > 90 ? "err" : ageDays >= 30 ? "warn" : "ok",
    lastUpdate: lv ? { at: lv.at, text: lv.what, who: lv.name || lv.who.en } : null,
    staleDays,
    staleTone: closed ? "neutral" : staleDays > 14 ? "err" : staleDays > 7 ? "warn" : "ok",
    handler: asg ? { kind: "LAWYER", id: asg.lawyerId, name: asg.lawyerName, status: asg.status } : med ? { kind: "MEDIATOR", id: med.mediatorId, name: med.mediatorName, status: med.status } : null,
    lawyer: a.lawyer && (asg || hearings.length)
      ? {
          hearings: hearings.length,
          nextHearing: future[0]?.at ?? null,
          overdueReports: hearings.filter((h) => !h.updateId && new Date(h.updateDueAt).getTime() < t).length,
          missed: hearings.filter((h) => h.result === "MISSED").length,
          lastReportAt: [...(a.lawyer.updates ?? [])].sort((x, y) => y.at.localeCompare(x.at))[0]?.at ?? null,
        }
      : null,
    urgent: { self: a.data.urgency.selfReportedUrgent, flags: a.data.urgency.flags },
    transfer: { pendingTo: pendingTransfer(a)?.toOffice ?? null, receivedFrom: acceptedTransfer(a)?.fromOffice ?? null },
  };
}

export function useDistrictCases() {
  const db = useDlasDb();
  const o = useCurrentOfficer();
  const t = useClock();
  return useMemo(() => {
    if (!o) return { officer: o, now: t, rows: [] as DistrictCaseRow[] };
    const names = actorNames(db);
    const rows = applicationsForOffice(db, o)
      .map((a) => districtCaseRow(a, db.tasks, o, t, names))
      .sort((x, y) => Number(x.closed) - Number(y.closed) || y.ageDays - x.ageDays);
    return { officer: o, now: t, rows };
  }, [db, o, t]);
}

/** Cases the citizen marked urgent when filing, newest first; open ones before closed. */
export function useUrgentCases() {
  const v = useDistrictCases();
  return useMemo(() => ({ ...v, rows: v.rows.filter((r) => isCitizenUrgent(r.a)).sort((x, y) => Number(x.closed) - Number(y.closed) || y.a.submittedAt.localeCompare(x.a.submittedAt)) }), [v]);
}
