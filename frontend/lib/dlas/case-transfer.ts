"use client";

/* ------------------------------------------------------------------ *
 *  DLAO → DLAO case transfer.
 *
 *  request()  the handling office asks another district's DLAO to take a
 *             case, with a reason. The case stays with the sender until
 *             the receiver answers; the receiver sees a read-only summary.
 *  respond()  the receiving DLAO ACCEPTS (optional message) or REJECTS
 *             (message required). Accept → the receiving office handles the
 *             case (access, open tasks, mediator panel, lawyer shortlist).
 *             Reject → the sender gets a task with the message.
 *  cancel()   the sender withdraws a pending request.
 *
 *  Blocked while a mediator or panel lawyer is actively assigned — they
 *  belong to the sending district's panel; withdraw first.
 *  Everything is in the case audit (case.transfer_*).
 * ------------------------------------------------------------------ */

import { useMemo } from "react";
import { mutate, useDlasDb } from "./store";
import { DISTRICTS, officeFor } from "./reference";
import { DlaoAuth, notifyApplicant, officerCanAccessApplication, useCurrentOfficer } from "./dlao";
import { handlingDistrict, pendingTransfer } from "./case-handling";
import type { ApplicationRecord, CaseTransfer, DistrictCode, DlaoOfficerAccount, DlasDb, OfficeNotice, Task } from "./schema";

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;
const districtName = (d: DistrictCode | null) => DISTRICTS.find((x) => x.code === d)?.label.en ?? String(d ?? "—");

function me(): DlaoOfficerAccount {
  const o = DlaoAuth.current();
  if (!o) throw new Error("Legal Aid Officer login required");
  if (o.officeType !== "DLAO") throw new Error("Case transfer is between District Legal Aid Offices (DLAO)");
  return o;
}

function log(db: DlasDb, a: ApplicationRecord, o: DlaoOfficerAccount, action: string, detail: Record<string, unknown>) {
  db.counters.auditSeq += 1;
  a.audit.push({ seq: db.counters.auditSeq, at: now(), actor: o.officerId, role: o.authorityRole === "CHIEF_LEGAL_AID_OFFICER" ? "clo" : "dlao", caseId: a.caseId ?? a.applicationId, action, detail: { officer: o.name, office: officeFor(o.district), ...detail } });
}

function task(db: DlasDb, a: ApplicationRecord, office: string, type: Task["type"], reason: string, hours: number, context: Record<string, unknown>): Task {
  const t: Task = { taskId: rid("TSK"), type, applicationId: a.applicationId, sessionId: a.channel.sessionId, assignedRole: "DLAO", office, status: "OPEN", priority: a.routing.recommendedPriority, reason, dueAt: new Date(Date.now() + hours * 3_600_000).toISOString(), createdAt: now(), context };
  db.tasks.push(t);
  a.taskIds.push(t.taskId);
  return t;
}

/** An office-wide notification (every officer of that office sees it until they mark it read). */
function notice(db: DlasDb, office: string, kind: OfficeNotice["kind"], a: ApplicationRecord, tr: CaseTransfer, title: { bn: string; en: string }, body: string | null) {
  (db.officeNotices ??= []).push({ noticeId: rid("NTC"), office, kind, applicationId: a.applicationId, caseRef: a.caseId ?? a.applicationId, transferId: tr.transferId, title, body, at: now(), readBy: [] });
}

/** Why a case cannot be transferred right now (null = it can). */
export function transferBlocker(a: ApplicationRecord): string | null {
  if (a.closedAt || ["REJECTED", "WITHDRAWN", "RESOLVED", "CLOSED"].includes(a.status)) return "This case is closed";
  if (pendingTransfer(a)) return "A transfer request is already pending";
  if (a.mediation?.assignments.some((x) => x.status === "ASSIGNED" || x.status === "AWAITING_OFFICER_CONFIRMATION")) return "A mediator from this district's panel is assigned or awaiting confirmation — withdraw or complete the mediation assignment first";
  if (a.lawyer?.assignments.some((x) => x.status === "OFFERED" || x.status === "ACCEPTED") && !a.lawyer.completion) return "A panel lawyer from this district is offered or assigned — withdraw the lawyer first";
  return null;
}

export const CaseTransferService = {
  request(applicationId: string, input: { toDistrict: DistrictCode; reason: string }) {
    const o = me();
    const reason = input.reason.trim();
    if (reason.length < 10) throw new Error("Give the reason for the transfer (at least 10 characters)");
    if (!DISTRICTS.some((d) => d.code === input.toDistrict)) throw new Error("Choose the receiving district");
    return mutate((db) => {
      const a = db.applications.find((x) => x.applicationId === applicationId);
      if (!a || !officerCanAccessApplication(a, o)) throw new Error("This case is outside your office");
      const from = handlingDistrict(a);
      if (!from) throw new Error("The case has no district");
      if (input.toDistrict === from) throw new Error("The case is already handled by that district");
      const blocked = transferBlocker(a);
      if (blocked) throw new Error(blocked);
      const toOffice = officeFor(input.toDistrict);
      const tr: CaseTransfer = { transferId: rid("TRF"), fromOffice: officeFor(from), fromDistrict: from, toOffice, toDistrict: input.toDistrict, reason, status: "PENDING", requestedAt: now(), requestedBy: o.officerId, requestedByName: o.name, respondedAt: null, respondedBy: null, respondedByName: null, responseMessage: null, taskId: null };
      const t = task(db, a, toOffice, "CASE_TRANSFER_REVIEW", `Transfer request from ${districtName(from)} DLAO for ${a.caseId ?? a.applicationId}: ${reason}`, 48, { transferId: tr.transferId, fromOffice: tr.fromOffice });
      tr.taskId = t.taskId;
      (a.transfers ??= []).push(tr);
      notice(db, toOffice, "TRANSFER_RECEIVED", a, tr, { bn: `${districtName(from)} ডিএলএও থেকে কেস স্থানান্তরের অনুরোধ এসেছে`, en: `Case transfer received from ${districtName(from)} DLAO` }, reason);
      log(db, a, o, "case.transfer_requested", { transferId: tr.transferId, from: tr.fromOffice, to: toOffice, reason });
      a.updatedAt = now();
      a.version += 1;
      return tr;
    });
  },

  cancel(applicationId: string, note: string) {
    const o = me();
    return mutate((db) => {
      const a = db.applications.find((x) => x.applicationId === applicationId);
      if (!a || !officerCanAccessApplication(a, o)) throw new Error("This case is outside your office");
      const tr = pendingTransfer(a);
      if (!tr) throw new Error("No pending transfer");
      tr.status = "CANCELLED";
      tr.respondedAt = now();
      tr.respondedBy = o.officerId;
      tr.respondedByName = o.name;
      tr.responseMessage = note.trim() || null;
      for (const t of db.tasks) if (t.taskId === tr.taskId && t.status !== "DONE") t.status = "DONE";
      notice(db, tr.toOffice, "TRANSFER_CANCELLED", a, tr, { bn: `${districtName(tr.fromDistrict)} ডিএলএও স্থানান্তরের অনুরোধ বাতিল করেছে`, en: `${districtName(tr.fromDistrict)} DLAO cancelled the transfer request` }, note.trim() || null);
      log(db, a, o, "case.transfer_cancelled", { transferId: tr.transferId, to: tr.toOffice, note: note.trim() || null });
      a.updatedAt = now();
      a.version += 1;
      return tr;
    });
  },

  respond(applicationId: string, transferId: string, input: { decision: "ACCEPT" | "REJECT"; message: string }) {
    const o = me();
    const message = input.message.trim();
    if (input.decision === "REJECT" && message.length < 5) throw new Error("Write a message to the sending office explaining the rejection");
    return mutate((db) => {
      const a = db.applications.find((x) => x.applicationId === applicationId);
      const tr = a?.transfers?.find((x) => x.transferId === transferId);
      if (!a || !tr) throw new Error("Transfer not found");
      if (tr.status !== "PENDING") throw new Error("This transfer was already answered");
      if (tr.toOffice !== officeFor(o.district)) throw new Error("Only the receiving office can answer this transfer");
      tr.status = input.decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";
      tr.respondedAt = now();
      tr.respondedBy = o.officerId;
      tr.respondedByName = o.name;
      tr.responseMessage = message || null;
      for (const t of db.tasks) if (t.taskId === tr.taskId && t.status !== "DONE") t.status = "DONE";
      if (tr.status === "ACCEPTED") {
        const from = a.routing.office;
        a.routing.office = tr.toOffice;
        // open office work moves with the case
        for (const t of db.tasks) if (t.applicationId === a.applicationId && t.status !== "DONE" && t.assignedRole === "DLAO") t.office = tr.toOffice;
        log(db, a, o, "case.transfer_accepted", { transferId: tr.transferId, from, to: tr.toOffice, message: message || null });
        notice(db, tr.fromOffice, "TRANSFER_ACCEPTED", a, tr, { bn: `${districtName(tr.toDistrict)} ডিএলএও কেসটি গ্রহণ করেছে`, en: `${districtName(tr.toDistrict)} DLAO accepted the case` }, message || null);
        notifyApplicant(db, a, o, `Update on your reference ${a.caseId ?? a.applicationId}. The legal aid office will contact you at your safe time.`, `DLAS legal aid (${a.caseId ?? a.applicationId}): your case is now handled by the ${districtName(tr.toDistrict)} District Legal Aid Office.`);
      } else {
        const t = task(db, a, tr.fromOffice, "CASE_TRANSFER_REJECTED", `${districtName(tr.toDistrict)} DLAO rejected the transfer of ${a.caseId ?? a.applicationId}: “${message}”`, 24, { transferId: tr.transferId });
        log(db, a, o, "case.transfer_rejected", { transferId: tr.transferId, to: tr.toOffice, message, taskId: t.taskId });
        notice(db, tr.fromOffice, "TRANSFER_REJECTED", a, tr, { bn: `${districtName(tr.toDistrict)} ডিএলএও প্রত্যাখ্যান করেছে — কেস আপনার অফিসে ফিরে এসেছে`, en: `${districtName(tr.toDistrict)} DLAO rejected the transfer — the case is back with your office` }, message);
      }
      a.updatedAt = now();
      a.version += 1;
      return tr;
    });
  },
};

/** Incoming (to my office, pending) and outgoing (from my office) transfers. */
export function useCaseTransfers() {
  const db = useDlasDb();
  const o = useCurrentOfficer();
  return useMemo(() => {
    if (!o || o.officeType !== "DLAO") return { officer: o, office: null, incoming: [], outgoing: [], answered: [] };
    const office = officeFor(o.district);
    const all = db.applications.flatMap((a) => (a.transfers ?? []).map((t) => ({ a, t })));
    return {
      officer: o,
      office,
      incoming: all.filter(({ t }) => t.toOffice === office && t.status === "PENDING").sort((x, y) => x.t.requestedAt.localeCompare(y.t.requestedAt)),
      answered: all.filter(({ t }) => t.toOffice === office && t.status !== "PENDING").sort((x, y) => (y.t.respondedAt ?? "").localeCompare(x.t.respondedAt ?? "")),
      outgoing: all.filter(({ t }) => t.fromOffice === office).sort((x, y) => y.t.requestedAt.localeCompare(x.t.requestedAt)),
    };
  }, [db, o]);
}

/* ------------------------------ office notifications ------------------------------ */

export const OfficeNotices = {
  markRead(noticeIds: string[]) {
    const o = DlaoAuth.current();
    if (!o) return;
    mutate((db) => {
      for (const n of db.officeNotices ?? []) if (noticeIds.includes(n.noticeId) && !n.readBy.includes(o.officerId)) n.readBy.push(o.officerId);
    });
  },
};

/** Notifications for the signed-in officer's office: unread first, newest first. */
export function useOfficeNotices() {
  const db = useDlasDb();
  const o = useCurrentOfficer();
  return useMemo(() => {
    if (!o) return { all: [] as OfficeNotice[], unread: [] as OfficeNotice[] };
    const office = officeFor(o.district);
    const all = (db.officeNotices ?? []).filter((n) => n.office === office).sort((x, y) => y.at.localeCompare(x.at));
    return { all, unread: all.filter((n) => !n.readBy.includes(o.officerId)) };
  }, [db, o]);
}
