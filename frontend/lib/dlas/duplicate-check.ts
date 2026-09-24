"use client";

/* ------------------------------------------------------------------ *
 *  T4 — Duplicate / fraud-risk check (DLO). Shown as an "AI scan";
 *  underneath it is deterministic fuzzy matching over several
 *  attributes — name (spelling-tolerant), phone, NID, other party,
 *  matter, story wording, district, filing time — with a confidence
 *  score and the evidence FOR and AGAINST each match.
 *
 *  Guardrail (case document): never auto-reject, never auto-merge,
 *  never label a person fraudulent. The scan only raises signals; a
 *  human compares the two records side by side and records a decision.
 *  Similar-but-different people ("trap cases") are shown as checked and
 *  kept apart. Data: db.duplicateReviews[] + audit on both cases.
 * ------------------------------------------------------------------ */

import { useMemo } from "react";
import { mutate, readDb, useDlasDb } from "./store";
import { DlaoAuth, officerAuthorityRole, officerCanAccessApplication, useCurrentOfficer } from "./dlao";
import { CitizenAuth } from "./citizen-auth";
import { CitizenDoor } from "./door-bridges";
import type { ApplicationRecord, AuditEntry, DlasDb, DuplicateReview, MatterCategory } from "./schema";

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;
export const DUPLICATE_RULES_VERSION = "dup-scan-sim-2026.09";

/* ------------------------------ fuzzy helpers ------------------------------ */

const TITLES = /\b(md|mohammad|mohammed|muhammad|mst|mosammat|mrs|mr|ms|sheikh|sk)\b\.?/g;
export function normName(s: string | null | undefined) {
  return (s ?? "").toLowerCase().replace(/[.\-']/g, " ").replace(TITLES, " ").replace(/\s+/g, " ").trim().split(" ").sort().join(" ");
}
function bigrams(s: string) {
  const t = ` ${s} `;
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i += 1) out.push(t.slice(i, i + 2));
  return out;
}
/** Dice coefficient over character bigrams — tolerant of Akter/Aktar, Das/Dash. */
export function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const x = bigrams(a);
  const y = bigrams(b);
  const pool = [...y];
  let hit = 0;
  for (const g of x) {
    const i = pool.indexOf(g);
    if (i >= 0) {
      hit += 1;
      pool.splice(i, 1);
    }
  }
  return (2 * hit) / (x.length + y.length);
}
const words = (s: string | null | undefined) => new Set((s ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2));
function jaccard(a: Set<string>, b: Set<string>) {
  const inter = [...a].filter((w) => b.has(w)).length;
  return inter / Math.max(1, new Set([...a, ...b]).size);
}
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/* ------------------------------ scoring ------------------------------ */

export type Evidence = { kind: "FOR" | "AGAINST" | "INFO"; text: string; weight: number };
export type PairKind = "POSSIBLE_DUPLICATE" | "RISK_SIGNAL" | "SIMILAR_BUT_DIFFERENT";
export type PairResult = { pairKey: string; aId: string; bId: string; score: number; kind: PairKind; headline: string; evidence: Evidence[] };

export const pairKey = (x: string, y: string) => [x, y].sort().join("~");

export function scorePair(a: ApplicationRecord, b: ApplicationRecord): PairResult | null {
  const ev: Evidence[] = [];
  let score = 0;
  const add = (kind: Evidence["kind"], text: string, weight: number) => {
    ev.push({ kind, text, weight });
    score += weight;
  };
  const na = normName(a.data.applicant.fullName);
  const nb = normName(b.data.applicant.fullName);
  const nameSim = similarity(na, nb);
  if (nameSim >= 0.92) add("FOR", `names match (${Math.round(nameSim * 100)}%): “${a.data.applicant.fullName}” / “${b.data.applicant.fullName}”`, 20);
  else if (nameSim >= 0.75) add("FOR", `names are close (${Math.round(nameSim * 100)}% — spelling variant?): “${a.data.applicant.fullName}” / “${b.data.applicant.fullName}”`, 12);
  else if (nameSim < 0.5) add("AGAINST", `names differ (${Math.round(nameSim * 100)}%)`, -10);

  const pa = digits(a.data.applicant.phone);
  const pb = digits(b.data.applicant.phone);
  const samePhone = !!pa && pa === pb;
  if (samePhone) add("FOR", `same phone number (…${pa.slice(-4)})`, 25);
  else if (pa && pb) add("INFO", "different phone numbers (people do change numbers)", 0);

  const ia = digits(a.data.applicant.nidNumber);
  const ib = digits(b.data.applicant.nidNumber);
  const sameNid = !!ia && ia === ib;
  if (sameNid) add("FOR", `same NID number (…${ia.slice(-4)})`, 45);
  else if (ia && ib) add("AGAINST", "different NID numbers", -35);
  else add("INFO", "NID missing on one record — cannot compare", 0);

  if (a.data.matter.category && a.data.matter.category === b.data.matter.category) add("FOR", `same matter (${a.data.matter.category.toLowerCase().replaceAll("_", " ")})`, 5);
  else add("AGAINST", "different matter types", -8);

  const oa = normName(a.data.matter.opposingParty?.split(",")[0]);
  const ob = normName(b.data.matter.opposingParty?.split(",")[0]);
  if (oa && ob) {
    const s = similarity(oa, ob);
    if (s >= 0.8) add("FOR", `same other party (“${a.data.matter.opposingParty!.split(",")[0].trim()}”)`, 10);
    else if (s < 0.4) add("AGAINST", `different other party (“${a.data.matter.opposingParty!.split(",")[0].trim()}” / “${b.data.matter.opposingParty!.split(",")[0].trim()}”)`, -10);
  }
  const js = jaccard(words(a.data.matter.summary), words(b.data.matter.summary));
  if (js >= 0.3) add("FOR", `stories are worded alike (${Math.round(js * 100)}% overlap)`, 15);
  else if (js >= 0.15) add("FOR", `stories overlap (${Math.round(js * 100)}%)`, 8);

  if (a.data.applicant.district && a.data.applicant.district !== b.data.applicant.district) add("AGAINST", "different districts", -5);
  const days = Math.abs(new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()) / 86_400_000;
  if (days <= 30) add("INFO", `filed ${days < 1 ? "the same day" : `${Math.round(days)} day(s) apart`}`, 3);

  score = Math.max(0, Math.min(100, score));
  const key = pairKey(a.applicationId, b.applicationId);
  // risk signals: an identifier shared by clearly different names — verify identity, do not accuse
  if (sameNid && nameSim < 0.5) return { pairKey: key, aId: a.applicationId, bId: b.applicationId, score: Math.max(score, 60), kind: "RISK_SIGNAL", headline: "One NID number on two different names — verify identity (could be a typing mistake)", evidence: ev };
  if (samePhone && nameSim < 0.5 && !sameNid) return { pairKey: key, aId: a.applicationId, bId: b.applicationId, score: Math.max(score, 45), kind: "RISK_SIGNAL", headline: "One phone number used by two different applicants — often a shared family, shop or UDC phone", evidence: ev };
  if (score >= 45) return { pairKey: key, aId: a.applicationId, bId: b.applicationId, score, kind: "POSSIBLE_DUPLICATE", headline: score >= 70 ? "Likely the same person filing twice — compare and decide" : "Possibly the same person — compare and decide", evidence: ev };
  // trap cases: look alike by name, but the identifiers say different people
  if (nameSim >= 0.9) return { pairKey: key, aId: a.applicationId, bId: b.applicationId, score, kind: "SIMILAR_BUT_DIFFERENT", headline: "Same-looking name, but NID / phone / matter point to different people — kept apart", evidence: ev };
  return null;
}

export function scanApplications(apps: ApplicationRecord[]) {
  const list = apps.filter((a) => !["WITHDRAWN"].includes(a.status));
  const out: PairResult[] = [];
  for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
    const r = scorePair(list[i], list[j]);
    if (r) out.push(r);
  }
  return out.sort((x, y) => (x.kind === "SIMILAR_BUT_DIFFERENT" ? 1 : 0) - (y.kind === "SIMILAR_BUT_DIFFERENT" ? 1 : 0) || y.score - x.score);
}

/* ------------------------------ service ------------------------------ */

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

export const DuplicateReviewService = {
  /** Record that the scan ran; flags new pairs on both cases (audit only — nothing else changes). */
  recordScan(results: PairResult[]) {
    const o = DlaoAuth.current();
    if (!o) throw new Error("Legal Aid Officer login required");
    return mutate((db) => {
      const reviews = (db.duplicateReviews ??= []);
      let flagged = 0;
      for (const r of results.filter((x) => x.kind !== "SIMILAR_BUT_DIFFERENT")) {
        if (reviews.some((v) => v.pairKey === r.pairKey)) continue;
        reviews.push({ reviewId: rid("DUP"), pairKey: r.pairKey, aId: r.aId, bId: r.bId, kind: r.kind as "POSSIBLE_DUPLICATE" | "RISK_SIGNAL", score: r.score, headline: r.headline, evidence: r.evidence, flaggedAt: now(), rulesVersion: DUPLICATE_RULES_VERSION, decision: null });
        for (const id of [r.aId, r.bId]) {
          const a = db.applications.find((x) => x.applicationId === id);
          if (a) audit(db, a.audit, { actor: "system", role: "system", caseId: a.caseId ?? a.applicationId, action: "duplicate.flagged_for_review", detail: { pairKey: r.pairKey, with: id === r.aId ? r.bId : r.aId, kind: r.kind, score: r.score, advisoryOnly: true } });
        }
        flagged += 1;
      }
      db.adminAudit.push({ seq: (db.counters.auditSeq += 1), at: now(), actor: o.officerId, role: "dlao", action: "duplicate.scan_run", detail: { office: `DLAO-${o.district}`, pairs: results.length, newlyFlagged: flagged, rulesVersion: DUPLICATE_RULES_VERSION } });
      return flagged;
    });
  },

  /** Human decision after the side-by-side review. Never rejects, merges or labels anyone. */
  decide(pairKeyValue: string, decision: NonNullable<DuplicateReview["decision"]>["outcome"], note: string) {
    const o = DlaoAuth.current();
    if (!o) throw new Error("Legal Aid Officer login required");
    if (note.trim().length < 10) throw new Error("Write what you checked (at least 10 characters)");
    return mutate((db) => {
      const v = (db.duplicateReviews ?? []).find((x) => x.pairKey === pairKeyValue);
      if (!v) throw new Error("Run the scan first");
      for (const id of [v.aId, v.bId]) {
        const a = db.applications.find((x) => x.applicationId === id);
        if (!a || !officerCanAccessApplication(a, o)) throw new Error("Both cases must be in your office");
      }
      v.decision = { outcome: decision, note: note.trim(), by: o.officerId, byName: o.name, at: now() };
      for (const id of [v.aId, v.bId]) {
        const a = db.applications.find((x) => x.applicationId === id)!;
        audit(db, a.audit, { actor: o.officerId, role: officerAuthorityRole(o) === "CHIEF_LEGAL_AID_OFFICER" ? "clo" : "dlao", caseId: a.caseId ?? a.applicationId, action: "duplicate.review_decided", detail: { pairKey: v.pairKey, with: id === v.aId ? v.bId : v.aId, outcome: decision, officer: o.name, note: note.trim(), noAutomaticAction: true } });
        a.updatedAt = now();
      }
      return v;
    });
  },
};

/* ------------------------------ read model ------------------------------ */

export function useDuplicateCheck() {
  const db = useDlasDb();
  const o = useCurrentOfficer();
  return useMemo(() => {
    if (!o) return { officer: null, apps: [] as ApplicationRecord[], results: [] as PairResult[], reviews: [] as DuplicateReview[] };
    const apps = db.applications.filter((a) => officerCanAccessApplication(a, o));
    const ids = new Set(apps.map((a) => a.applicationId));
    return { officer: o, apps, results: scanApplications(apps), reviews: (db.duplicateReviews ?? []).filter((v) => ids.has(v.aId) && ids.has(v.bId)) };
  }, [db, o]);
}

/** Open (undecided) flag for a case — for the case-page banner. */
export function openDuplicateFor(db: DlasDb, applicationId: string) {
  return (db.duplicateReviews ?? []).find((v) => !v.decision && (v.aId === applicationId || v.bId === applicationId)) ?? null;
}

/* ------------------------------ demo records (T4 acceptance: 10–15 incl. traps) ------------------------------ */

type DemoRec = { name: string; phone: string; nid: string; matter: string; party: string; description: string };
const DEMO: DemoRec[] = [
  // genuine duplicate 1 — same person, spelling variant, filed twice
  { name: "Shirin Akter (demo)", phone: "01712000101", nid: "1990123456", matter: "family", party: "Rubel Mia", description: "My husband Rubel Mia has not paid maintenance for me and my son for six months. He married again and left." },
  { name: "Shirin Aktar (demo)", phone: "01712000101", nid: "1990123456", matter: "family", party: "Rubel Mia", description: "Husband Rubel Mia stopped paying maintenance for me and my son six months ago, he married again." },
  // genuine duplicate 2 — changed phone, same NID and employer
  { name: "Md. Kamal Hossain (demo)", phone: "01813000202", nid: "2001555666", matter: "labour", party: "Nahar Textiles", description: "Nahar Textiles has not paid my wages for three months and dismissed me without notice." },
  { name: "Kamal Hossain (demo)", phone: "01913000999", nid: "2001555666", matter: "labour", party: "Nahar Textiles", description: "I was dismissed by Nahar Textiles without notice and three months wages are unpaid." },
  // possible duplicate 3 — same phone, NID missing on the second
  { name: "Rina Das (demo)", phone: "01614000303", nid: "1985777888", matter: "land", party: "Shyamal Das", description: "My uncle Shyamal Das occupied our family land and will not give my share." },
  { name: "Rina Dash (demo)", phone: "01614000303", nid: "", matter: "land", party: "Shyamal Das", description: "Uncle Shyamal Das took our family land and refuses my share of it." },
  // TRAP 1 — same name, different people
  { name: "Abdul Karim (demo)", phone: "01715000404", nid: "1970111222", matter: "land", party: "Hasan Ali", description: "Hasan Ali moved the boundary of my land in the village and built a wall." },
  { name: "Abdul Karim (demo)", phone: "01716000505", nid: "1982333444", matter: "labour", party: "Karim Traders", description: "Karim Traders did not pay my salary for two months." },
  // TRAP 2 — same name and matter, different people
  { name: "Fatema Begum (demo)", phone: "01717000606", nid: "1995444555", matter: "family", party: "Jalal Uddin", description: "My husband Jalal Uddin beats me and does not give maintenance." },
  { name: "Fatema Begum (demo)", phone: "01718000707", nid: "1996444556", matter: "family", party: "Selim Reza", description: "Selim Reza, my husband, divorced me and did not pay the dower." },
  // risk signal — one phone for two different people (e.g. a shop / UDC phone)
  { name: "Nasima Khatun (demo)", phone: "01719000808", nid: "1988999000", matter: "family", party: "Babul Mia", description: "Babul Mia my husband left and does not pay for the children." },
  { name: "Parveen Sultana (demo)", phone: "01719000808", nid: "1991222333", matter: "civil", party: "Rashed Khan", description: "Rashed Khan borrowed money from me and does not return it." },
  // risk signal — one NID on a different name
  { name: "Jahanara Begum (demo)", phone: "01720000909", nid: "1988999000", matter: "civil", party: "Monir Hossain", description: "Monir Hossain did not return the loan I gave him last year." },
];

/** Files the 13 fictional demo records through the normal citizen door (as each citizen), then restores the officer's session. */
export async function loadDuplicateDemo(district: string): Promise<number> {
  const keep = ["dlas.citizen.current", "dlas.active.WEB_PORTAL"].map((k) => [k, window.localStorage.getItem(k)] as const);
  let n = 0;
  try {
    for (const r of DEMO) {
      if (readDb().applications.some((a) => a.data.applicant.fullName === r.name && a.data.applicant.phone === r.phone)) continue;
      const login = CitizenAuth.login(r.phone);
      if (!login.ok) CitizenAuth.signUp(r.name, r.phone);
      window.localStorage.removeItem("dlas.active.WEB_PORTAL");
      CitizenDoor.requestOtp(r.phone);
      const sid = CitizenDoor.ensure();
      const otp = [...readDb().otp].reverse().find((x) => x.sessionId === sid);
      if (!otp) throw new Error("No OTP was issued");
      CitizenDoor.verifyOtp(otp.code);
      const res = await CitizenDoor.submit({ name: r.name, phone: r.phone, nidNumber: r.nid, actingFor: "self", proxyRel: "", proxyName: "", proxyPhone: "", matter: r.matter as MatterCategory, partyName: r.party, partyAddress: "", description: r.description, documents: [], contactSlot: "anytime", contactDay: "", contactTime: "", specialInstructions: "", consentOk: true }, district);
      if (!res.ok) throw new Error("A demo record was refused: " + r.name);
      n += 1;
    }
  } finally {
    for (const [k, v] of keep) {
      if (v === null) window.localStorage.removeItem(k);
      else window.localStorage.setItem(k, v);
    }
  }
  return n;
}
