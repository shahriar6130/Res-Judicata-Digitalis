"use client";

/* ------------------------------------------------------------------ *
 *  Mediator best picks + offer / accept / auto-next.
 *
 *  1. rankCandidates()  after the hard filters, the eligible mediators are
 *     RANKED by a transparent, rule-based score (experience, free capacity,
 *     availability now, admin record, area match) — the "best picks".
 *     Advisory: the officer chooses whom to offer the case to.
 *  2. offer()           the officer sends the offer (usually to #1). The
 *     mediator gets an SMS + a task; the case waits for their answer.
 *  3. accept()          the mediator accepts → ASSIGNED, need-to-know access,
 *     scheduling task, applicant told, the office is notified.
 *     decline()         → the next-ranked eligible mediator is offered the
 *     case AUTOMATICALLY (re-checked live: conflicts, capacity…); the office
 *     is notified each time. No one left → back to the officer.
 *  4. sweepMediatorOffers()  an offer not answered by its deadline expires
 *     and moves to the next mediator the same way.
 *  Everything is on application.mediation.assignments[] + audit.
 * ------------------------------------------------------------------ */

import { useEffect, useMemo } from "react";
import { mutate, readDb, useDlasDb } from "./store";
import { withOfficerApp } from "./dlao";
import { MediatorAuth, useCurrentMediator } from "./mediation-workspace";
import { FILTER_LABELS, evaluateMediator } from "./mediator-assignment";
import { useClock } from "./lawyer";
import { handlingDistrict } from "./case-handling";
import type { ApplicationRecord, AuditEntry, DlasDb, MediationMatter, MediatorAssignmentRecord, MediatorCandidate, OfficeNotice, Task } from "./schema";

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;
export const OFFER_HOURS = 24;

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

/* ------------------------------ ranking ------------------------------ */

export type RankedMediator = { c: MediatorCandidate; rank: number; score: number; breakdown: { experience: number; capacity: number; availability: number; record: number; area: number } };

/** Transparent, rule-based ranking of ELIGIBLE mediators (0–100). Advisory — the officer picks. */
export function rankCandidates(cands: MediatorCandidate[]): RankedMediator[] {
  return cands
    .filter((c) => c.eligible)
    .map((c) => {
      const k = c.considerations;
      const experience = k.relevantExperience === "HIGH" ? 35 : k.relevantExperience === "MEDIUM" ? 22 : 10;
      const capacity = Math.round(30 * Math.max(0, 1 - k.currentLoad / Math.max(1, k.capacity)));
      const availability = k.availability === "AVAILABLE" ? 15 : k.availability === "LIMITED" ? 6 : 0;
      const record = k.record === "COMMENDED" ? 15 : k.record === "CONCERN" ? 0 : 8;
      const area = k.areaMatch ? 5 : 0;
      return { c, score: experience + capacity + availability + record + area, breakdown: { experience, capacity, availability, record, area }, rank: 0 };
    })
    .sort((x, y) => y.score - x.score || x.c.considerations.currentLoad - y.c.considerations.currentLoad || x.c.name.localeCompare(y.c.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Live ranking for a case (re-evaluated now, so conflicts / capacity changes are respected). */
function liveRanking(db: DlasDb, a: ApplicationRecord, matter: MediationMatter, exclude: Set<string>) {
  const district = handlingDistrict(a);
  const cands = db.mediators.filter((m) => m.district === district).map((m) => evaluateMediator(db, m, a, matter, Date.now()));
  return rankCandidates(cands).filter((r) => !exclude.has(r.c.mediatorId));
}

/** Mediators this case has already been offered to (declined / expired / withdrawn) — never re-offered automatically. */
const tried = (matter: MediationMatter) => new Set(matter.assignments.filter((x) => ["DECLINED", "EXPIRED", "OFFERED", "ASSIGNED", "REASSIGNMENT_REQUESTED"].includes(x.status)).map((x) => x.mediatorId));
export const openOffer = (matter: MediationMatter | null | undefined) => matter?.assignments.find((x) => x.status === "OFFERED") ?? null;

/* ------------------------------ helpers ------------------------------ */

function officeNotice(db: DlasDb, a: ApplicationRecord, kind: OfficeNotice["kind"], title: { bn: string; en: string }, body: string | null) {
  (db.officeNotices ??= []).push({ noticeId: rid("NTC"), office: a.routing.office, kind, applicationId: a.applicationId, caseRef: a.caseId ?? a.applicationId, transferId: null, title, body, at: now(), readBy: [] });
}

function smsMediator(db: DlasDb, a: ApplicationRecord, phone: string, body: string) {
  db.outbox.push({ msgId: rid("SMS"), kind: "SMS_CONFIRMATION", to: phone, body, sessionId: null, applicationId: a.applicationId, simulated: true, status: "DELIVERED", at: now() });
}

function offerTask(db: DlasDb, a: ApplicationRecord, mediatorId: string, rec: MediatorAssignmentRecord): Task {
  const t: Task = { taskId: rid("TSK"), type: "MEDIATOR_CASE_OFFER", applicationId: a.applicationId, sessionId: a.channel.sessionId, assignedRole: "MEDIATOR", assigneeId: mediatorId, office: a.routing.office, status: "OPEN", priority: a.routing.recommendedPriority, reason: `Mediation case offered to you (${a.caseId}) — accept or decline`, dueAt: rec.offer!.respondBy, createdAt: now(), context: { assignmentId: rec.assignmentId } };
  db.tasks.push(t);
  a.taskIds.push(t.taskId);
  return t;
}

/** Create an OFFERED assignment record for a ranked mediator. */
function makeOffer(db: DlasDb, a: ApplicationRecord, matter: MediationMatter, r: RankedMediator, by: { id: string; name: string }, via: "OFFICER_PICK" | "AUTO_NEXT", reason: string | null): MediatorAssignmentRecord {
  const m = db.mediators.find((x) => x.mediatorId === r.c.mediatorId)!;
  const run = matter.runs[matter.runs.length - 1];
  const rec: MediatorAssignmentRecord = {
    assignmentId: rid("MAS"),
    mediatorId: m.mediatorId,
    mediatorName: m.name,
    runId: run?.runId ?? "",
    status: "OFFERED",
    recommendedAt: now(),
    recommendedBy: by.id,
    recommendedByName: by.name,
    recommendationNote: reason,
    conflictCheck: { at: now(), clear: true, conflictIds: [] },
    assignedAt: null,
    assignedBy: null,
    assignedByName: null,
    reason,
    accessGrantedAt: null,
    accessRevokedAt: null,
    endedAt: null,
    endReason: null,
    endedBy: null,
    offer: { offeredAt: now(), respondBy: new Date(Date.now() + OFFER_HOURS * 3_600_000).toISOString(), via, rank: r.rank, score: r.score, respondedAt: null, declineReason: null },
  };
  matter.assignments.push(rec);
  matter.assignmentStatus = "AWAITING_MEDIATOR_ACCEPTANCE";
  const t = offerTask(db, a, m.mediatorId, rec);
  smsMediator(db, a, m.contact.phone, `DLAS: a mediation case (${a.caseId}) has been offered to you. Open the mediator portal to accept or decline by ${new Date(rec.offer!.respondBy).toLocaleString("en-GB")}.`);
  audit(db, a.audit, { actor: by.id, role: via === "AUTO_NEXT" ? "system" : "dlao", caseId: a.caseId ?? a.applicationId, action: via === "AUTO_NEXT" ? "mediation.auto_offered_next" : "mediation.mediator_offered", detail: { officer: via === "OFFICER_PICK" ? by.name : undefined, assignmentId: rec.assignmentId, mediatorId: m.mediatorId, mediator: m.name, rank: r.rank, score: r.score, breakdown: r.breakdown, respondBy: rec.offer!.respondBy, taskId: t.taskId, reason } });
  audit(db, m.audit, { actor: by.id, role: via === "AUTO_NEXT" ? "system" : "dlao", caseId: a.caseId ?? a.applicationId, action: "mediator.case_offered", detail: { applicationId: a.applicationId, assignmentId: rec.assignmentId, via } });
  return rec;
}

/** After a decline / expiry: offer to the next-ranked eligible mediator, or hand back to the officer. */
function offerNextOrReturn(db: DlasDb, a: ApplicationRecord, matter: MediationMatter, after: MediatorAssignmentRecord, why: string) {
  const next = liveRanking(db, a, matter, tried(matter))[0];
  if (next) {
    const rec = makeOffer(db, a, matter, next, { id: "system", name: "System (auto-next)" }, "AUTO_NEXT", `Automatic next offer after ${after.mediatorName} ${why}`);
    officeNotice(db, a, "MEDIATOR_DECLINED", { bn: `${after.mediatorName} ${why === "declined" ? "প্রত্যাখ্যান করেছেন" : "সময়মতো উত্তর দেননি"} — স্বয়ংক্রিয়ভাবে ${rec.mediatorName}-কে পাঠানো হয়েছে`, en: `${after.mediatorName} ${why} — offered automatically to ${rec.mediatorName} (#${rec.offer!.rank})` }, after.offer?.declineReason ?? null);
    return rec;
  }
  matter.assignmentStatus = matter.assignments.some((x) => x.status === "ASSIGNED") ? "ASSIGNED" : "RECOMMENDED";
  const t: Task = { taskId: rid("TSK"), type: "MEDIATOR_ASSIGNMENT", applicationId: a.applicationId, sessionId: a.channel.sessionId, assignedRole: "DLAO", office: a.routing.office, status: "OPEN", priority: "HIGH", reason: `No eligible mediator left to offer ${a.caseId} to — re-check eligibility, widen the panel or choose another pathway`, dueAt: new Date(Date.now() + 24 * 3_600_000).toISOString(), createdAt: now() };
  db.tasks.push(t);
  audit(db, a.audit, { actor: "system", role: "system", caseId: a.caseId ?? a.applicationId, action: "mediation.offers_exhausted", detail: { after: after.assignmentId, taskId: t.taskId } });
  officeNotice(db, a, "MEDIATOR_NONE_LEFT", { bn: `${after.mediatorName} ${why === "declined" ? "প্রত্যাখ্যান করেছেন" : "উত্তর দেননি"} — আর কোনো যোগ্য মধ্যস্থতাকারী নেই`, en: `${after.mediatorName} ${why} — no eligible mediator left; the officer must decide` }, after.offer?.declineReason ?? null);
  return null;
}

/* ------------------------------ services ------------------------------ */

export const MediatorOfferService = {
  /** Officer: send the case to a ranked mediator (normally the best pick). Conflicts are re-checked now. */
  offer(applicationId: string, mediatorId: string, reason: string) {
    return withOfficerApp(applicationId, (db, a, o) => {
      const matter = a.mediation;
      if (!matter) throw new Error("Open the mediation first");
      if (openOffer(matter)) throw new Error("An offer is already waiting for a mediator's answer");
      if (!matter.runs.length) throw new Error("Check eligible mediators first");
      const ranked = liveRanking(db, a, matter, new Set());
      const r = ranked.find((x) => x.c.mediatorId === mediatorId);
      if (!r) {
        const m = db.mediators.find((x) => x.mediatorId === mediatorId);
        const c = m ? evaluateMediator(db, m, a, matter, Date.now()) : null;
        throw new Error(c?.conflictIds.length ? "CONFLICT DETECTED — this mediator declared a conflict with this case" : `Not eligible now: ${c ? c.checks.filter((k) => !k.ok).map((k) => `${FILTER_LABELS[k.key].en} (${k.detail})`).join("; ") : "unknown mediator"}`);
      }
      // a still-pending legacy recommendation is replaced
      for (const x of matter.assignments) if (x.status === "AWAITING_OFFICER_CONFIRMATION") Object.assign(x, { status: "WITHDRAWN", endedAt: now(), endReason: "Replaced by an offer", endedBy: o.officerId });
      return makeOffer(db, a, matter, r, { id: o.officerId, name: o.name }, "OFFICER_PICK", reason.trim() || (r.rank === 1 ? "Best pick by the system ranking" : null));
    });
  },

  /** Officer: withdraw an offer that has not been answered (and choose again). */
  withdrawOffer(applicationId: string, reason: string) {
    if (reason.trim().length < 5) throw new Error("Give a short reason");
    return withOfficerApp(applicationId, (db, a, o) => {
      const rec = openOffer(a.mediation);
      if (!rec) throw new Error("No open offer");
      rec.status = "WITHDRAWN";
      rec.endedAt = now();
      rec.endReason = reason.trim();
      rec.endedBy = o.officerId;
      a.mediation!.assignmentStatus = a.mediation!.assignments.some((x) => x.status === "ASSIGNED") ? "ASSIGNED" : "RECOMMENDED";
      for (const t of db.tasks) if (t.type === "MEDIATOR_CASE_OFFER" && t.context?.assignmentId === rec.assignmentId && t.status !== "DONE") t.status = "DONE";
      audit(db, a.audit, { actor: o.officerId, role: "dlao", caseId: a.caseId ?? a.applicationId, action: "mediation.offer_withdrawn", detail: { officer: o.name, assignmentId: rec.assignmentId, mediatorId: rec.mediatorId, reason: rec.endReason } });
      return rec;
    });
  },

  /** Mediator: accept the offered case → assigned with need-to-know access. */
  accept(applicationId: string) {
    const me = MediatorAuth.current();
    if (!me) throw new Error("Mediator login required");
    return mutate((db) => {
      const a = db.applications.find((x) => x.applicationId === applicationId);
      const rec = openOffer(a?.mediation);
      if (!a || !rec || rec.mediatorId !== me.mediatorId) throw new Error("This case is not offered to you (or the offer has ended)");
      const matter = a.mediation!;
      const m = db.mediators.find((x) => x.mediatorId === me.mediatorId)!;
      const c = evaluateMediator(db, m, a, { ...matter, assignments: matter.assignments.filter((x) => x.assignmentId !== rec.assignmentId) }, Date.now());
      rec.conflictCheck = { at: now(), clear: c.conflictIds.length === 0, conflictIds: c.conflictIds };
      if (c.conflictIds.length) throw new Error("You declared a conflict with this case — decline the offer instead");
      const previous = matter.assignments.find((x) => x.status === "REASSIGNMENT_REQUESTED" && !x.endedAt);
      if (previous) previous.endedAt = now();
      rec.status = "ASSIGNED";
      rec.assignedAt = now();
      rec.assignedBy = me.mediatorId;
      rec.assignedByName = `${m.name} (accepted the offer)`;
      rec.accessGrantedAt = now();
      rec.offer = { ...rec.offer!, respondedAt: now() };
      matter.assignmentStatus = "ASSIGNED";
      for (const t of db.tasks) {
        if (t.applicationId !== a.applicationId || t.status === "DONE") continue;
        if ((t.type === "MEDIATOR_CASE_OFFER" && t.context?.assignmentId === rec.assignmentId) || t.type === "MEDIATOR_ASSIGNMENT" || t.type === "MEDIATOR_REASSIGNMENT") t.status = "DONE";
        if (t.type === "MEDIATION_SCHEDULING") t.assigneeId = m.mediatorId;
      }
      audit(db, a.audit, { actor: m.mediatorId, role: "mediator", caseId: a.caseId ?? a.applicationId, action: "mediation.mediator_accepted", detail: { mediator: m.name, assignmentId: rec.assignmentId, rank: rec.offer?.rank ?? null, via: rec.offer?.via ?? null, conflictCheck: "clear" } });
      audit(db, m.audit, { actor: m.mediatorId, role: "mediator", caseId: a.caseId ?? a.applicationId, action: "mediator.case_accepted", detail: { applicationId: a.applicationId, assignmentId: rec.assignmentId } });
      officeNotice(db, a, "MEDIATOR_ACCEPTED", { bn: `${m.name} মধ্যস্থতার কেসটি গ্রহণ করেছেন`, en: `${m.name} accepted the mediation case` }, null);
      // the applicant is told on the safe channel (neutral wording, simulated gateway)
      const to = a.data.safeContact.phone ?? a.data.applicant.phone;
      if (to) {
        db.outbox.push({ msgId: rid("SMS"), kind: "SMS_CONFIRMATION", to, body: a.data.safeContact.neutralWordingRequired ? `Update on your reference ${a.caseId}. The office will contact you at your safe time.` : `DLAS legal aid (${a.caseId}): a mediator has been assigned to your case. You will be contacted to arrange the session.`, sessionId: a.channel.sessionId, applicationId: a.applicationId, simulated: true, status: a.data.safeContact.smsAllowed ? "DELIVERED" : "SUPPRESSED_UNSAFE", at: now() });
        audit(db, a.audit, { actor: "system", role: "system", caseId: a.caseId ?? a.applicationId, action: a.data.safeContact.smsAllowed ? "notice.sms_sent" : "notice.sms_suppressed", detail: { to, neutral: a.data.safeContact.neutralWordingRequired } });
      }
      a.version += 1;
      a.updatedAt = now();
      return rec;
    });
  },

  /** Mediator: decline → the next-ranked mediator is offered the case automatically. */
  decline(applicationId: string, reason: string) {
    const me = MediatorAuth.current();
    if (!me) throw new Error("Mediator login required");
    if (reason.trim().length < 5) throw new Error("Give a short reason (e.g. not available, conflict)");
    return mutate((db) => {
      const a = db.applications.find((x) => x.applicationId === applicationId);
      const rec = openOffer(a?.mediation);
      if (!a || !rec || rec.mediatorId !== me.mediatorId) throw new Error("This case is not offered to you (or the offer has ended)");
      rec.status = "DECLINED";
      rec.endedAt = now();
      rec.endReason = reason.trim();
      rec.endedBy = me.mediatorId;
      rec.offer = { ...rec.offer!, respondedAt: now(), declineReason: reason.trim() };
      for (const t of db.tasks) if (t.type === "MEDIATOR_CASE_OFFER" && t.context?.assignmentId === rec.assignmentId && t.status !== "DONE") t.status = "DONE";
      audit(db, a.audit, { actor: me.mediatorId, role: "mediator", caseId: a.caseId ?? a.applicationId, action: "mediation.mediator_declined", detail: { mediator: me.name, assignmentId: rec.assignmentId, reason: rec.endReason } });
      const next = offerNextOrReturn(db, a, a.mediation!, rec, "declined");
      a.version += 1;
      a.updatedAt = now();
      return next;
    });
  },
};

/** Offers past their deadline expire and move to the next mediator. Safe to call often (no-op when nothing is due). */
export function sweepMediatorOffers(at = Date.now()): number {
  const due = readDb().applications.filter((a) => {
    const o = openOffer(a.mediation);
    return !!o?.offer && new Date(o.offer.respondBy).getTime() < at;
  });
  if (!due.length) return 0;
  return mutate((db) => {
    let n = 0;
    for (const a of db.applications) {
      const rec = openOffer(a.mediation);
      if (!rec?.offer || new Date(rec.offer.respondBy).getTime() >= at) continue;
      rec.status = "EXPIRED";
      rec.endedAt = now();
      rec.endReason = `No answer by ${rec.offer.respondBy}`;
      rec.endedBy = "system";
      for (const t of db.tasks) if (t.type === "MEDIATOR_CASE_OFFER" && t.context?.assignmentId === rec.assignmentId && t.status !== "DONE") t.status = "DONE";
      audit(db, a.audit, { actor: "system", role: "system", caseId: a.caseId ?? a.applicationId, action: "mediation.offer_expired", detail: { assignmentId: rec.assignmentId, mediatorId: rec.mediatorId, mediator: rec.mediatorName } });
      offerNextOrReturn(db, a, a.mediation!, rec, "did not answer in time");
      a.updatedAt = now();
      n += 1;
    }
    return n;
  });
}

/** Run the expiry sweep whenever the minute clock ticks (DLO and mediator screens). */
export function useMediatorOfferSweep() {
  const t = useClock();
  useEffect(() => {
    if (!t) return;
    try {
      sweepMediatorOffers(t);
    } catch {
      /* the sweep is best-effort; a failure shows up as an unanswered offer */
    }
  }, [t]);
}

/* ------------------------------ read models ------------------------------ */

/** Best picks for the officer: ranking of the eligible mediators right now. */
export function useMediatorBestPicks(a: ApplicationRecord) {
  const db = useDlasDb();
  const t = useClock();
  return useMemo(() => {
    const matter = a.mediation;
    if (!matter || !matter.runs.length) return { ranked: [] as RankedMediator[], offer: null, history: [] as MediatorAssignmentRecord[] };
    return {
      ranked: liveRanking(db, a, matter, new Set(matter.assignments.filter((x) => ["DECLINED", "EXPIRED"].includes(x.status)).map((x) => x.mediatorId))),
      offer: openOffer(matter),
      history: matter.assignments.filter((x) => x.offer),
      now: t,
    };
  }, [a, db, t]);
}

/** Cases offered to the signed-in mediator, waiting for their answer. Shows no personal data of the parties. */
export function useMyMediatorOffers() {
  const db = useDlasDb();
  const me = useCurrentMediator();
  return useMemo(() => {
    if (!me) return [];
    return db.applications
      .filter((a) => openOffer(a.mediation)?.mediatorId === me.mediatorId)
      .map((a) => ({ a, offer: openOffer(a.mediation)! }))
      .sort((x, y) => x.offer.offer!.respondBy.localeCompare(y.offer.offer!.respondBy));
  }, [db, me]);
}
