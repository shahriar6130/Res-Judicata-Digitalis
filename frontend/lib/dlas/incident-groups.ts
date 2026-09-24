"use client";

/* ------------------------------------------------------------------ *
 *  T3 — Multiple applicants, one incident ("group cases").
 *
 *  The DLO groups cases that share the same circumstances (e.g. workers
 *  hurt in the same factory fire). The group gives ONE view of all
 *  applicants and ONE copy of the common evidence — but the cases are
 *  LINKED, NOT MERGED: every applicant keeps their own record, private
 *  details, instructions and outcome (case-document guardrail).
 *
 *   • groupSuggestions()          rule-based "these look like the same
 *                                 incident" hints (advisory, reasons shown)
 *   • IncidentGroupService        create / addCase / removeCase / dissolve /
 *                                 uploadSharedEvidence — DLO only, audited
 *                                 on the group AND on every linked case
 *   • every applicant is told (SMS on the safe channel) and sees the group
 *     on their dashboard — never the other applicants' personal details.
 *  Data: db.incidentGroups[] + application.incidentGroupId.
 * ------------------------------------------------------------------ */

import { useMemo } from "react";
import { mutate, readDb, useDlasDb } from "./store";
import { FileStore } from "./files";
import { DlaoAuth, officerAuthorityRole, officerCanAccessApplication, useCurrentOfficer } from "./dlao";
import { incidentOf } from "./incident-taxonomy";
import { normalizePhone } from "./reference";
import type { ApplicationRecord, AuditEntry, DlasDb, DocType, IncidentGroup, SharedEvidence } from "./schema";

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;
const MAX_BYTES = 10 * 1024 * 1024;

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

const isClosed = (a: ApplicationRecord) => !!a.closedAt || ["REJECTED", "WITHDRAWN", "CLOSED"].includes(a.status);

function sms(db: DlasDb, a: ApplicationRecord, full: string) {
  const to = normalizePhone(a.data.safeContact.phone) ?? normalizePhone(a.data.applicant.phone);
  if (!to) return;
  const allowed = a.data.safeContact.smsAllowed;
  db.outbox.push({ msgId: rid("SMS"), kind: "SMS_CONFIRMATION", to, body: a.data.safeContact.neutralWordingRequired ? `Update on your reference ${a.caseId ?? a.applicationId}. Please check your DLAS page or the office will contact you at your safe time.` : full, sessionId: a.channel.sessionId, applicationId: a.applicationId, simulated: true, status: allowed ? "DELIVERED" : "SUPPRESSED_UNSAFE", at: now() });
  audit(db, a.audit, { actor: "system", role: "system", caseId: a.caseId ?? a.applicationId, action: allowed ? "notice.sms_sent" : "notice.sms_suppressed", detail: { to, neutral: a.data.safeContact.neutralWordingRequired } });
}

/* ------------------------------ suggestions ------------------------------ */

const STOP = new Set(["the", "and", "a", "of", "to", "in", "my", "me", "i", "was", "is", "for", "on", "at", "we", "our", "he", "she", "they", "it", "with", "from", "আমার", "আমি", "এবং", "ও", "করে", "হয়েছে", "আমাদের", "তার", "এই", "থেকে", "না", "দিয়ে", "জন্য"]);
const words = (s: string | null | undefined) => new Set((s ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

export type GroupSuggestion = { applicationIds: string[]; score: number; reasons: string[] };

/** Rule-based hints that cases may come from the same incident. Advisory — the DLO decides. */
export function groupSuggestions(apps: ApplicationRecord[]): GroupSuggestion[] {
  const open = apps.filter((a) => !isClosed(a) && !a.incidentGroupId);
  const pairs: { i: string; j: string; score: number; reasons: string[] }[] = [];
  for (let x = 0; x < open.length; x += 1) {
    for (let y = x + 1; y < open.length; y += 1) {
      const a = open[x];
      const b = open[y];
      const reasons: string[] = [];
      let score = 0;
      if (a.data.matter.category && a.data.matter.category === b.data.matter.category) {
        score += 20;
        reasons.push(`same matter type (${a.data.matter.category.toLowerCase().replaceAll("_", " ")})`);
      }
      const ia = incidentOf(a);
      const ib = incidentOf(b);
      if (ia.subcategory && ia.subcategory === ib.subcategory) {
        score += 15;
        reasons.push(`same category by rule (${ia.subcategory.toLowerCase().replaceAll("_", " ")})`);
      }
      const oa = a.data.matter.opposingParty?.split(",")[0]?.trim().toLowerCase();
      const ob = b.data.matter.opposingParty?.split(",")[0]?.trim().toLowerCase();
      if (oa && ob && oa === ob) {
        score += 30;
        reasons.push(`same other party (“${a.data.matter.opposingParty!.split(",")[0].trim()}”)`);
      }
      const wa = words(a.data.matter.summary);
      const wb = words(b.data.matter.summary);
      const shared = [...wa].filter((w) => wb.has(w));
      const jac = shared.length / Math.max(1, new Set([...wa, ...wb]).size);
      if (shared.length >= 3 && jac >= 0.15) {
        score += Math.round(35 * Math.min(1, jac * 2));
        reasons.push(`similar descriptions (shared words: ${shared.slice(0, 5).join(", ")})`);
      }
      const days = Math.abs(new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()) / 86_400_000;
      if (days <= 14) score += 5;
      if (score >= 50) pairs.push({ i: a.applicationId, j: b.applicationId, score, reasons });
    }
  }
  // join pairs into clusters
  const groups: GroupSuggestion[] = [];
  for (const p of pairs.sort((u, v) => v.score - u.score)) {
    const g = groups.find((x) => x.applicationIds.includes(p.i) || x.applicationIds.includes(p.j));
    if (g) {
      for (const id of [p.i, p.j]) if (!g.applicationIds.includes(id)) g.applicationIds.push(id);
      g.score = Math.max(g.score, p.score);
      for (const r of p.reasons) if (!g.reasons.some((x) => x.split(" (")[0] === r.split(" (")[0])) g.reasons.push(r);
    } else groups.push({ applicationIds: [p.i, p.j], score: p.score, reasons: [...p.reasons] });
  }
  return groups.sort((u, v) => v.applicationIds.length - u.applicationIds.length || v.score - u.score);
}

/* ------------------------------ service ------------------------------ */

function officer() {
  const o = DlaoAuth.current();
  if (!o) throw new Error("Legal Aid Officer login required");
  return o;
}
const roleOf = (o: ReturnType<typeof officer>) => (officerAuthorityRole(o) === "CHIEF_LEGAL_AID_OFFICER" ? "clo" : "dlao");

function linkCase(db: DlasDb, g: IncidentGroup, a: ApplicationRecord, o: ReturnType<typeof officer>, reason: string) {
  if (a.incidentGroupId && a.incidentGroupId !== g.groupId) throw new Error(`${a.caseId ?? a.applicationId} is already in another group`);
  if (isClosed(a)) throw new Error(`${a.caseId ?? a.applicationId} is closed`);
  a.incidentGroupId = g.groupId;
  if (!g.applicationIds.includes(a.applicationId)) g.applicationIds.push(a.applicationId);
  audit(db, a.audit, { actor: o.officerId, role: roleOf(o), caseId: a.caseId ?? a.applicationId, action: "incident_group.linked", detail: { groupId: g.groupId, title: g.title, officer: o.name, reason, linkedWith: g.applicationIds.filter((x) => x !== a.applicationId).length } });
  sms(db, a, `DLAS legal aid (${a.caseId ?? a.applicationId}): your case has been linked with other applications about the same incident (${g.title}). Common evidence is shared; your own details stay private. See your DLAS page.`);
  a.version += 1;
  a.updatedAt = now();
}

function withGroup<T>(groupId: string, fn: (db: DlasDb, g: IncidentGroup, o: ReturnType<typeof officer>) => T): T {
  const o = officer();
  return mutate((db) => {
    const g = (db.incidentGroups ?? []).find((x) => x.groupId === groupId);
    if (!g || g.office !== `DLAO-${o.district}`) throw new Error("This group is not in your office");
    const r = fn(db, g, o);
    g.updatedAt = now();
    return r;
  });
}

export const IncidentGroupService = {
  /** Group ≥ 2 cases of this office that share the same circumstances. */
  create(input: { title: string; description: string; incidentDate?: string | null; place?: string | null; applicationIds: string[]; reason: string }) {
    const o = officer();
    if (input.title.trim().length < 4) throw new Error("Give the incident a short title");
    if (input.reason.trim().length < 10) throw new Error("Say why these cases belong together (at least 10 characters)");
    const ids = [...new Set(input.applicationIds)];
    if (ids.length < 2) throw new Error("Choose at least two cases");
    return mutate((db) => {
      const apps = ids.map((id) => db.applications.find((x) => x.applicationId === id));
      for (const a of apps) if (!a || !officerCanAccessApplication(a, o)) throw new Error("Every case must be in your office");
      const g: IncidentGroup = {
        groupId: rid("GRP"),
        title: input.title.trim(),
        description: input.description.trim(),
        incidentDate: input.incidentDate || null,
        place: input.place?.trim() || null,
        office: `DLAO-${o.district}`,
        applicationIds: [],
        status: "ACTIVE",
        sharedEvidence: [],
        createdAt: now(),
        createdBy: o.officerId,
        createdByName: o.name,
        updatedAt: now(),
        audit: [],
      };
      (db.incidentGroups ??= []).push(g);
      for (const a of apps) linkCase(db, g, a!, o, input.reason.trim());
      audit(db, g.audit, { actor: o.officerId, role: roleOf(o), caseId: g.groupId, action: "incident_group.created", detail: { officer: o.name, applicationIds: g.applicationIds, reason: input.reason.trim(), rule: "LINK_NOT_MERGE" } });
      return g;
    });
  },

  addCase(groupId: string, applicationId: string, reason: string) {
    if (reason.trim().length < 10) throw new Error("Say why this case belongs to the group (at least 10 characters)");
    return withGroup(groupId, (db, g, o) => {
      if (g.status !== "ACTIVE") throw new Error("This group was dissolved");
      const a = db.applications.find((x) => x.applicationId === applicationId);
      if (!a || !officerCanAccessApplication(a, o)) throw new Error("That case is not in your office");
      linkCase(db, g, a, o, reason.trim());
      audit(db, g.audit, { actor: o.officerId, role: roleOf(o), caseId: g.groupId, action: "incident_group.case_added", detail: { applicationId, officer: o.name, reason: reason.trim() } });
      return g;
    });
  },

  /** Unlink one case. Its own record is untouched; shared evidence stays with the group. */
  removeCase(groupId: string, applicationId: string, reason: string) {
    if (reason.trim().length < 10) throw new Error("Say why this case is removed (at least 10 characters)");
    return withGroup(groupId, (db, g, o) => {
      const a = db.applications.find((x) => x.applicationId === applicationId);
      if (!a || a.incidentGroupId !== g.groupId) throw new Error("That case is not in this group");
      a.incidentGroupId = null;
      g.applicationIds = g.applicationIds.filter((x) => x !== applicationId);
      audit(db, a.audit, { actor: o.officerId, role: roleOf(o), caseId: a.caseId ?? a.applicationId, action: "incident_group.unlinked", detail: { groupId: g.groupId, officer: o.name, reason: reason.trim() } });
      audit(db, g.audit, { actor: o.officerId, role: roleOf(o), caseId: g.groupId, action: "incident_group.case_removed", detail: { applicationId, officer: o.name, reason: reason.trim() } });
      sms(db, a, `DLAS legal aid (${a.caseId ?? a.applicationId}): your case is no longer linked with the ${g.title} group. Your own case continues as before.`);
      a.version += 1;
      a.updatedAt = now();
      if (g.applicationIds.length < 2) {
        g.status = "DISSOLVED";
        for (const id of g.applicationIds) {
          const b = db.applications.find((x) => x.applicationId === id);
          if (b) b.incidentGroupId = null;
        }
        audit(db, g.audit, { actor: "system", role: "system", caseId: g.groupId, action: "incident_group.dissolved", detail: { reason: "fewer than two cases left" } });
      }
      return g;
    });
  },

  /** Upload ONE copy of a document that all linked cases rely on. Each case gets an audit reference, not a copy. */
  async uploadSharedEvidence(groupId: string, input: { file: File; docType: DocType; title: string; note: string }) {
    const o = officer();
    const f = input.file;
    if (!(f.type.startsWith("image/") || f.type === "application/pdf")) throw new Error("Please upload a photo or a PDF");
    if (f.size > MAX_BYTES) throw new Error("File is larger than 10 MB");
    if (input.title.trim().length < 3) throw new Error("Give the evidence a title");
    const evidenceId = rid("SEV");
    const preview = await FileStore.put(evidenceId, f, f.type);
    let sha: string | null = null;
    try {
      const h = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
      sha = Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      sha = null;
    }
    return withGroup(groupId, (db, g) => {
      if (g.status !== "ACTIVE") throw new Error("This group was dissolved");
      if (sha && g.sharedEvidence.some((e) => e.sha256 === sha)) throw new Error("This exact file is already in the group's shared evidence");
      const ev: SharedEvidence = { evidenceId, docType: input.docType, title: input.title.trim(), fileName: f.name, mimeType: f.type || null, sizeBytes: f.size, sha256: sha, preview, note: input.note.trim() || null, uploadedBy: o.officerId, uploadedByName: o.name, uploadedAt: now() };
      g.sharedEvidence.push(ev);
      audit(db, g.audit, { actor: o.officerId, role: roleOf(o), caseId: g.groupId, action: "incident_group.shared_evidence_added", detail: { evidenceId, title: ev.title, sha256: sha, bytes: f.size, visibleTo: g.applicationIds.length } });
      for (const id of g.applicationIds) {
        const a = db.applications.find((x) => x.applicationId === id);
        if (!a) continue;
        audit(db, a.audit, { actor: o.officerId, role: roleOf(o), caseId: a.caseId ?? a.applicationId, action: "incident_group.shared_evidence_linked", detail: { groupId: g.groupId, evidenceId, title: ev.title, sha256: sha, copy: false } });
        a.updatedAt = now();
      }
      return ev;
    });
  },
};

/* ------------------------------ read models ------------------------------ */

export const groupOf = (db: DlasDb, a: ApplicationRecord | null | undefined): IncidentGroup | null => (a?.incidentGroupId ? (db.incidentGroups ?? []).find((g) => g.groupId === a.incidentGroupId && g.status === "ACTIVE") ?? null : null);

/** DLO: the office's groups + suggestions over its open, ungrouped cases. */
export function useIncidentGroups() {
  const db = useDlasDb();
  const o = useCurrentOfficer();
  return useMemo(() => {
    if (!o) return { officer: null, groups: [] as IncidentGroup[], cases: [] as ApplicationRecord[], suggestions: [] as GroupSuggestion[] };
    const cases = db.applications.filter((a) => officerCanAccessApplication(a, o));
    const groups = (db.incidentGroups ?? []).filter((g) => g.office === `DLAO-${o.district}`).sort((x, y) => Number(x.status !== "ACTIVE") - Number(y.status !== "ACTIVE") || y.updatedAt.localeCompare(x.updatedAt));
    return { officer: o, groups, cases, suggestions: groupSuggestions(cases) };
  }, [db, o]);
}

export function useIncidentGroup(groupId: string) {
  const db = useDlasDb();
  const o = useCurrentOfficer();
  return useMemo(() => {
    const g = (db.incidentGroups ?? []).find((x) => x.groupId === groupId) ?? null;
    if (!g || !o || g.office !== `DLAO-${o.district}`) return { group: null, cases: [] as ApplicationRecord[] };
    return { group: g, cases: g.applicationIds.map((id) => db.applications.find((a) => a.applicationId === id)).filter(Boolean) as ApplicationRecord[] };
  }, [db, o, groupId]);
}

/** Citizen-safe projection of a group: no other applicant's name, phone or story. */
export function citizenGroupView(db: DlasDb, a: ApplicationRecord) {
  const g = groupOf(db, a);
  if (!g) return null;
  return {
    groupId: g.groupId,
    title: g.title,
    description: g.description,
    incidentDate: g.incidentDate,
    place: g.place,
    otherApplicants: g.applicationIds.filter((x) => x !== a.applicationId).length,
    linkedAt: [...a.audit].reverse().find((e) => e.action === "incident_group.linked")?.at ?? g.createdAt,
    sharedEvidence: g.sharedEvidence.map((e) => ({ evidenceId: e.evidenceId, title: e.title, docType: e.docType, fileName: e.fileName, uploadedAt: e.uploadedAt, preview: e.preview })),
  };
}

export function readGroup(groupId: string) {
  return (readDb().incidentGroups ?? []).find((g) => g.groupId === groupId) ?? null;
}
