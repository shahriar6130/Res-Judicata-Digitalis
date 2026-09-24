"use client";

/* ------------------------------------------------------------------ *
 *  Mediation oversight (Feature 9) — officer / CLO side of the access model.
 *  Builds on lib/dlas/mediation-access.ts (role scopes, confidential notes).
 *
 *  • officerMediationRecord()  PUBLIC CASE RECORD projection for a Legal Aid
 *    Officer / CLO: sessions, attendance, outcomes, required records.
 *    Caucus notes are never included — only their count, so the officer
 *    knows confidential notes exist without seeing them.
 *  • MediationAccessLog.recordView()  sensitive views are audited
 *    (user, role, case, action, timestamp) — at most once per 30 minutes.
 *  • useDistrictMediationMonitor()  CLO-only district activity monitor.
 *  • auditRow()  one shape for every audit row: User · Role · Case · Action · Timestamp.
 * ------------------------------------------------------------------ */

import { useMemo } from "react";
import { mutate, useDlasDb } from "./store";
import { DlaoAuth, officerAuthorityRole, officerCanAccessApplication, useCurrentOfficer } from "./dlao";
import { useClock } from "./lawyer";
import { canAccessMediationScope, confidentialCaucusNotes, publicMediationWorkspace, type MediationAccessRole, type MediationScope } from "./mediation-access";
import { transportOf, workspaceStatus, finalOutcome } from "./mediation-workspace";
import type { ApplicationRecord, AuditEntry, DlaoOfficerAccount, DlasDb, MediationChannel } from "./schema";

const now = () => new Date().toISOString();

/* ------------------------------ audit rows ------------------------------ */

export type AuditRow = { seq: number; user: string; userId: string; role: AuditEntry["role"]; caseId: string; action: string; at: string; detail: Record<string, unknown> };

/** Who / which role / which case / what / when — for every audit entry, old or new. */
export function auditRow(e: AuditEntry, a?: Pick<ApplicationRecord, "caseId" | "applicationId">): AuditRow {
  const d = e.detail ?? {};
  const user = String(d.officer ?? d.mediator ?? d.lawyer ?? d.staff ?? d.officerName ?? e.actor);
  return { seq: e.seq, user, userId: e.actor, role: e.role, caseId: e.caseId ?? a?.caseId ?? a?.applicationId ?? String(d.caseId ?? "—"), action: e.action, at: e.at, detail: d };
}

const MEDIATION_ACTION = /^(mediation\.|settlement\.|mediator\.|pathway\.officer|pathway\.chosen)/;

/* ------------------------------ officer / CLO projection ------------------------------ */

export function officerAccessRole(o: DlaoOfficerAccount | undefined): MediationAccessRole | null {
  return o ? officerAuthorityRole(o) : null;
}

/** PUBLIC CASE RECORD of a mediation, as a Legal Aid Officer or CLO may see it. */
export function officerMediationRecord(a: ApplicationRecord) {
  const m = a.mediation;
  const pub = publicMediationWorkspace(m?.workspace ?? null);
  const current = m?.assignments.find((x) => x.status === "ASSIGNED") ?? null;
  return {
    status: workspaceStatus(m?.workspace ?? null),
    mediator: current ? { name: current.mediatorName, since: current.assignedAt } : null,
    sessions: (pub?.sessions ?? []).map((s) => ({
      sessionId: s.sessionId,
      number: s.number,
      status: s.status,
      channel: s.channel,
      scheduledFor: s.scheduledFor,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      place: s.channel === "PHYSICAL" ? [s.place, s.room].filter(Boolean).join(", ") || null : null,
      attendance: { applicant: s.attendance.APPLICANT.status, respondent: s.attendance.RESPONDENT.status },
      fallbacks: transportOf(s).fallbacks.length,
    })),
    outcomes: pub?.outcomes ?? [],
    finalOutcome: finalOutcome(m?.workspace ?? null),
    settlement: pub?.settlementWorkflow ? { agreementId: pub.settlementWorkflow.agreementId, status: pub.settlementWorkflow.status, resolved: !!pub.settlementWorkflow.resolution, certifiedBy: pub.settlementWorkflow.resolution?.certifyingOfficer ?? null, certifiedAt: pub.settlementWorkflow.resolution?.certificationTimestamp ?? null } : null,
    failure: pub?.failureRecord ? { recordId: pub.failureRecord.recordId, status: pub.failureRecord.status, createdAt: pub.failureRecord.createdAt } : null,
    /** Count only — the text is MEDIATOR CONFIDENTIAL. */
    confidentialNoteCount: confidentialCaucusNotes(m?.workspace ?? null).length,
    audit: a.audit.filter((e) => MEDIATION_ACTION.test(e.action) || e.role === "mediator").map((e) => auditRow(e, a)),
  };
}

export function useOfficerMediationRecord(a: ApplicationRecord) {
  const officer = useCurrentOfficer();
  return useMemo(() => {
    const role = officerAccessRole(officer);
    if (!officer || !role || !officerCanAccessApplication(a, officer) || !a.mediation) return null;
    return { role, can: (s: MediationScope) => canAccessMediationScope(role, s), record: officerMediationRecord(a) };
  }, [a, officer]);
}

/* ------------------------------ sensitive-view audit ------------------------------ */

export const MediationAccessLog = {
  /** Records that an officer / CLO opened a mediation record. Deduplicated per officer, case and surface for 30 minutes. */
  recordView(applicationId: string, surface: "MEDIATION_RECORD" | "DISTRICT_MONITOR_CASE") {
    const o = DlaoAuth.current();
    if (!o) return false;
    return mutate((db: DlasDb) => {
      const a = db.applications.find((x) => x.applicationId === applicationId);
      if (!a || !a.mediation || !officerCanAccessApplication(a, o)) return false;
      const last = [...a.audit].reverse().find((e) => e.action === "mediation.record_viewed" && e.actor === o.officerId && e.detail?.surface === surface);
      if (last && Date.now() - new Date(last.at).getTime() < 30 * 60_000) return false;
      const role = officerAuthorityRole(o);
      db.counters.auditSeq += 1;
      a.audit.push({ seq: db.counters.auditSeq, at: now(), actor: o.officerId, role: role === "CHIEF_LEGAL_AID_OFFICER" ? "clo" : "dlao", caseId: a.caseId ?? a.applicationId, action: "mediation.record_viewed", detail: { officer: o.name, authorityRole: role, surface, confidentialNotesExcluded: true } });
      return true;
    });
  },
};

/* ------------------------------ CLO district monitor ------------------------------ */

export type DistrictMediationRow = {
  a: ApplicationRecord;
  caseId: string;
  bucket: "AWAITING_ASSIGNMENT" | "ACTIVE" | "AWAITING_CERTIFICATION" | "RESOLVED" | "FAILED";
  mediator: string | null;
  status: ReturnType<typeof workspaceStatus>;
  lastActivity: string;
  track: "PRE_LITIGATION" | "COURT_REFERRED";
};

export function useDistrictMediationMonitor() {
  const db = useDlasDb();
  const officer = useCurrentOfficer();
  const t = useClock();
  return useMemo(() => {
    const role = officerAccessRole(officer);
    const allowed = !!role && canAccessMediationScope(role, "DISTRICT_MONITORING");
    if (!officer || !allowed) return { allowed: false as const, officer, role };
    const cases = db.applications.filter((a) => a.mediation && officerCanAccessApplication(a, officer));
    const rows: DistrictMediationRow[] = cases.map((a) => {
      const m = a.mediation!;
      const ws = m.workspace ?? null;
      const flow = ws?.settlementWorkflow ?? null;
      const bucket: DistrictMediationRow["bucket"] = ws?.failureRecord ? "FAILED" : flow?.resolution ? "RESOLVED" : flow ? "AWAITING_CERTIFICATION" : m.assignments.some((x) => x.status === "ASSIGNED") ? "ACTIVE" : "AWAITING_ASSIGNMENT";
      const cur = m.assignments.find((x) => x.status === "ASSIGNED") ?? null;
      return { a, caseId: a.caseId ?? a.applicationId, bucket, mediator: cur?.mediatorName ?? null, status: workspaceStatus(ws), lastActivity: a.updatedAt, track: m.track };
    });
    const week = 7 * 86_400_000;
    const sessions = cases.flatMap((a) => (a.mediation!.workspace?.sessions ?? []).map((s) => ({ a, s })));
    const recent = sessions.filter(({ s }) => {
      const when = new Date(s.startedAt ?? s.scheduledFor ?? 0).getTime();
      return when && Math.abs(when - t) <= week;
    });
    const byChannel: Record<MediationChannel, number> = { PHYSICAL: 0, VOICE: 0, ONLINE: 0 };
    for (const { s } of recent) byChannel[s.channel] += 1;
    const fallbacks = sessions.reduce((n, { s }) => n + transportOf(s).fallbacks.length, 0);
    const limited = cases.filter((a) => a.mediation!.workspace?.access.connectivity === "LIMITED").length;
    const ids = new Set(cases.map((a) => a.applicationId));
    const overdue = db.tasks.filter((x) => x.applicationId && ids.has(x.applicationId) && x.status !== "DONE" && /MEDIAT|SETTLEMENT/.test(x.type) && new Date(x.dueAt).getTime() < t);
    const mediators = db.mediators
      .filter((m) => officer.officeType === "SCLAC" || m.district === officer.district)
      .map((m) => {
        const mine = cases.filter((a) => a.mediation!.assignments.some((x) => x.mediatorId === m.mediatorId));
        return {
          m,
          active: mine.filter((a) => a.mediation!.assignments.some((x) => x.mediatorId === m.mediatorId && x.status === "ASSIGNED")).length,
          sessionsHeld: mine.reduce((n, a) => n + (a.mediation!.workspace?.sessions.filter((s) => s.status === "COMPLETED").length ?? 0), 0),
          settled: mine.filter((a) => finalOutcome(a.mediation!.workspace)?.kind === "SETTLEMENT_REACHED").length,
          failed: mine.filter((a) => finalOutcome(a.mediation!.workspace)?.kind === "MEDIATION_FAILED").length,
        };
      })
      .filter((x) => x.active || x.sessionsHeld || x.m.status === "ACTIVE")
      .sort((x, y) => y.active - x.active || x.m.name.localeCompare(y.m.name));
    const audit = cases
      .flatMap((a) => a.audit.filter((e) => MEDIATION_ACTION.test(e.action) || e.role === "mediator").map((e) => auditRow(e, a)))
      .sort((x, y) => y.at.localeCompare(x.at))
      .slice(0, 40);
    const count = (b: DistrictMediationRow["bucket"]) => rows.filter((r) => r.bucket === b).length;
    return {
      allowed: true as const,
      officer,
      role,
      rows: rows.sort((x, y) => y.lastActivity.localeCompare(x.lastActivity)),
      counts: { total: rows.length, awaitingAssignment: count("AWAITING_ASSIGNMENT"), active: count("ACTIVE"), awaitingCertification: count("AWAITING_CERTIFICATION"), resolved: count("RESOLVED"), failed: count("FAILED") },
      sessionsThisWeek: recent.length,
      byChannel,
      fallbacks,
      limited,
      overdue,
      mediators,
      audit,
    };
  }, [db, officer, t]);
}
