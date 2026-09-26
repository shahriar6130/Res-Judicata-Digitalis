"use client";

/* ------------------------------------------------------------------ *
 *  Step 2 — Verification & Eligibility (DLAO / SCLAC / LLAC)
 *
 *    Application received by relevant office      → receive()
 *    Verify application:
 *      identity                                    → verifyIdentity()
 *      documents & facts                           → reviewFacts() / markDocumentReceived()
 *      vulnerability & eligibility (advisory)      → assessEligibility()
 *    Eligible for legal aid?  (HUMAN decision)     → decide()
 *      No  → reject (reason required) → notify applicant → closed (REJECTED)
 *      Yes → create Case ID DLAS-YYYY-NNNNN → record eligibility details & notes (addNote)
 *
 *  Every function writes the ApplicationRecord in dlas.db.v1 and appends
 *  to its audit[] in the same write — nothing is kept anywhere else.
 *  The system only ever RECOMMENDS; eligibility, rejection and the Case ID
 *  happen only through decide(), called by a logged-in officer with a reason.
 * ------------------------------------------------------------------ */

import { useMemo, useSyncExternalStore } from "react";
import { mutate, readDb, useDlasDb } from "./store";
import { DISTRICTS, normalizePhone, officeFor } from "./reference";
import { validateApplication } from "./validate";
import { handlingDistrict } from "./case-handling";
import type {
  ApplicationRecord,
  AuditEntry,
  DistrictCode,
  DlaoOfficerAccount,
  DlaoReview,
  DlasDb,
  EligibilityRecommendation,
  EligibilityRuleset,
  DocType,
  FactStatus,
  PathwayType,
  FactsOutcome,
  IdentityOutcome,
  OfficeType,
  Task,
} from "./schema";
import { DOC_TYPES, MATTERS, label } from "./reference";

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

/* ================================================================== *
 *  Officer accounts
 * ================================================================== */

const CURRENT_KEY = "dlas.dlao.current";

function setCurrent(id: string | null) {
  try {
    if (id) window.localStorage.setItem(CURRENT_KEY, id);
    else window.localStorage.removeItem(CURRENT_KEY);
    window.dispatchEvent(new CustomEvent("dlas:db-changed"));
  } catch {
    /* storage unavailable */
  }
}

export type DlaoAuthResult =
  | { ok: true; account: DlaoOfficerAccount }
  | { ok: false; error: "INVALID_NAME" | "INVALID_PHONE" | "INVALID_DISTRICT" | "PHONE_TAKEN" | "NOT_FOUND" };

export const DlaoAuth = {
  signUp(input: { name: string; phone: string; officeType: OfficeType; district: string; authorityRole?: "LEGAL_AID_OFFICER" | "CHIEF_LEGAL_AID_OFFICER" }): DlaoAuthResult {
    const phone = normalizePhone(input.phone);
    if (input.name.trim().length < 2) return { ok: false, error: "INVALID_NAME" };
    if (!phone) return { ok: false, error: "INVALID_PHONE" };
    const needsDistrict = input.officeType !== "SCLAC";
    if (needsDistrict && !DISTRICTS.some((d) => d.code === input.district)) return { ok: false, error: "INVALID_DISTRICT" };
    if (readDb().officers.some((o) => o.phone === phone)) return { ok: false, error: "PHONE_TAKEN" };
    const account = mutate((db) => {
      const a: DlaoOfficerAccount = {
        officerId: rid("OFC"),
        name: input.name.trim(),
        phone,
        officeType: input.officeType,
        district: needsDistrict ? (input.district as DistrictCode) : null,
        authorityRole: input.authorityRole ?? "LEGAL_AID_OFFICER",
        createdAt: now(),
        lastLoginAt: now(),
        audit: [],
      };
      audit(db, a.audit, { actor: a.officerId, role: a.authorityRole === "CHIEF_LEGAL_AID_OFFICER" ? "clo" : "dlao", action: "officer.signed_up", detail: { officeType: a.officeType, district: a.district, authorityRole: a.authorityRole } });
      db.officers.push(a);
      return a;
    });
    setCurrent(account.officerId);
    return { ok: true, account };
  },

  login(rawPhone: string): DlaoAuthResult {
    const phone = normalizePhone(rawPhone);
    if (!phone) return { ok: false, error: "INVALID_PHONE" };
    const found = readDb().officers.find((o) => o.phone === phone);
    if (!found) return { ok: false, error: "NOT_FOUND" };
    const account = mutate((db) => {
      const a = db.officers.find((o) => o.officerId === found.officerId)!;
      a.lastLoginAt = now();
      audit(db, a.audit, { actor: a.officerId, role: "dlao", action: "officer.logged_in" });
      return a;
    });
    setCurrent(account.officerId);
    return { ok: true, account };
  },

  current(): DlaoOfficerAccount | undefined {
    try {
      const id = window.localStorage.getItem(CURRENT_KEY);
      return id ? readDb().officers.find((o) => o.officerId === id) : undefined;
    } catch {
      return undefined;
    }
  },

  logout() {
    setCurrent(null);
  },
};

export function officerAuthorityRole(o: Pick<DlaoOfficerAccount, "authorityRole" | "officeType">): "LEGAL_AID_OFFICER" | "CHIEF_LEGAL_AID_OFFICER" {
  return o.authorityRole ?? (o.officeType === "SCLAC" ? "CHIEF_LEGAL_AID_OFFICER" : "LEGAL_AID_OFFICER");
}

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

export function useCurrentOfficer(): DlaoOfficerAccount | undefined {
  const id = useSyncExternalStore(subscribe, currentId, () => null);
  const db = useDlasDb();
  return id ? db.officers.find((o) => o.officerId === id) : undefined;
}

/** The office code this officer reviews for (matches record.routing.office). */
export function officeCode(o: Pick<DlaoOfficerAccount, "officeType" | "district">): string {
  if (o.officeType === "SCLAC") return "SCLAC";
  return o.officeType === "LLAC" ? `LLAC-${o.district}` : officeFor(o.district);
}

export function officerCanAccessApplication(a: ApplicationRecord, o: DlaoOfficerAccount | undefined): boolean {
  if (!o) return false;
  if (o.officeType === "SCLAC") return true;
  // The handling district: the applicant's district, or the receiving office after an accepted DLAO → DLAO transfer.
  if (o.officeType === "LLAC") return handlingDistrict(a) === o.district && a.data.matter.category === "LABOUR";
  return handlingDistrict(a) === o.district;
}

/** Applications this officer's office is responsible for. SCLAC sees all districts. */
export function applicationsForOffice(db: DlasDb, o: DlaoOfficerAccount | undefined): ApplicationRecord[] {
  if (!o) return [];
  return db.applications.filter((a) => officerCanAccessApplication(a, o));
}

/* ================================================================== *
 *  Eligibility ruleset — lives in the JSON (dlas.db.v1.eligibilityRulesets)
 * ================================================================== */

/**
 * The working ruleset written into the JSON the first time an office uses
 * Step 2. It summarises the Legal Aid Services Policy 2014 income bands and
 * the categories assisted regardless of income, as publicly reported. It is a
 * WORKING DRAFT: whoever checks it against the primary Policy text should
 * correct it in the JSON (new version) — the UI always shows its version.
 */
const WORKING_RULESET: Omit<EligibilityRuleset, "createdAt"> = {
  version: "LASP-2014-working-v1",
  status: "WORKING_DRAFT",
  source: "Legal Aid Services Policy 2014 (as publicly summarised) — to be verified against the primary text",
  incomeThresholdAnnualBdt: { SUPREME_COURT: 150000, OTHER_COURTS: 100000 },
  exemptCategories: [
    { code: "CHILD", label: { bn: "শিশু / নাবালক", en: "Child / minor" } },
    { code: "TRAFFICKING_ACID_VICTIM", label: { bn: "পাচার বা এসিড সহিংসতার শিকার", en: "Trafficking or acid-violence victim" } },
    { code: "WOMEN_CHILD_OPPRESSION", label: { bn: "শারীরিক/মানসিক/যৌন নির্যাতনের শিকার নারী বা শিশু", en: "Woman/child victim of physical, mental or sexual oppression" } },
    { code: "DOMESTIC_VIOLENCE", label: { bn: "পারিবারিক সহিংসতার শিকার", en: "Domestic-violence victim" } },
    { code: "SHELTERLESS", label: { bn: "আশ্রয়হীন / ভবঘুরে", en: "Shelterless person" } },
    { code: "ETHNIC_MINORITY", label: { bn: "ক্ষুদ্র নৃ-গোষ্ঠী", en: "Ethnic minority community" } },
    { code: "DISABILITY_UNABLE_TO_WORK", label: { bn: "কর্মক্ষম নন এমন প্রতিবন্ধী ব্যক্তি", en: "Person with disability unable to work" } },
    { code: "UNEMPLOYED", label: { bn: "বেকার", en: "Unemployed" } },
    { code: "FREEDOM_FIGHTER_LOW_INCOME", label: { bn: "অসচ্ছল মুক্তিযোদ্ধা", en: "Freedom fighter below the income band" } },
    { code: "WIDOW_ABANDONED", label: { bn: "বিধবা / স্বামী-পরিত্যক্তা", en: "Widow / abandoned woman" } },
    { code: "VGD_CARD", label: { bn: "ভিজিডি কার্ডধারী", en: "VGD card holder" } },
    { code: "DISASTER_VICTIM", label: { bn: "দুর্যোগে ক্ষতিগ্রস্ত", en: "Disaster victim" } },
    { code: "LOW_INCOME_WORKER", label: { bn: "নিম্ন আয়ের শ্রমিক", en: "Worker earning below the band" } },
    { code: "OLD_AGE_ALLOWANCE", label: { bn: "বয়স্ক ভাতাভোগী", en: "Old-age allowance recipient" } },
    { code: "ASHRAYAN_ALLOTTEE", label: { bn: "আদর্শ গ্রাম / আশ্রয়ণের বরাদ্দপ্রাপ্ত", en: "Model-village housing allottee" } },
  ],
};

function ensureRuleset(db: DlasDb): EligibilityRuleset {
  if (!db.eligibilityRulesets.length) db.eligibilityRulesets.push({ ...WORKING_RULESET, createdAt: now() });
  return db.eligibilityRulesets[db.eligibilityRulesets.length - 1];
}

export function useEligibilityRuleset(): EligibilityRuleset {
  const db = useDlasDb();
  return db.eligibilityRulesets[db.eligibilityRulesets.length - 1] ?? { ...WORKING_RULESET, createdAt: "" };
}

/** Pure: the recommendation and its reasons. Never a decision. */
export function recommend(
  rs: EligibilityRuleset,
  input: { courtLevel: "SUPREME_COURT" | "OTHER_COURTS"; income: number | null; exempt: string[] },
): { band: DlaoReview["eligibility"]["incomeBand"]; recommendation: EligibilityRecommendation; reasons: string[] } {
  const threshold = rs.incomeThresholdAnnualBdt[input.courtLevel];
  const band = input.income == null ? "NOT_DISCLOSED" : input.income <= threshold ? "AT_OR_BELOW_THRESHOLD" : "ABOVE_THRESHOLD";
  const reasons: string[] = [];
  // Exempt categories are assisted regardless of income — checked first.
  if (input.exempt.length) {
    const names = input.exempt.map((c) => rs.exemptCategories.find((x) => x.code === c)?.label.en ?? c);
    reasons.push(`Falls in exempt category: ${names.join(", ")} — assisted regardless of income (${rs.version}).`);
    if (band === "ABOVE_THRESHOLD") reasons.push(`Declared income BDT ${input.income} is above the ${input.courtLevel} band of BDT ${threshold}, but the exempt category applies.`);
    return { band, recommendation: "ELIGIBLE_EXEMPT_CATEGORY", reasons };
  }
  if (band === "NOT_DISCLOSED") {
    reasons.push("No exempt category recorded and annual income not disclosed — cannot assess the means test.");
    return { band, recommendation: "INSUFFICIENT_INFORMATION", reasons };
  }
  if (band === "AT_OR_BELOW_THRESHOLD") {
    reasons.push(`Declared annual income BDT ${input.income} is at or below the ${input.courtLevel} band of BDT ${threshold} (${rs.version}).`);
    return { band, recommendation: "ELIGIBLE_INCOME", reasons };
  }
  reasons.push(`Declared annual income BDT ${input.income} is above the ${input.courtLevel} band of BDT ${threshold}, and no exempt category is recorded (${rs.version}).`);
  return { band, recommendation: "NOT_ELIGIBLE_INCOME", reasons };
}

/* ================================================================== *
 *  Review service
 * ================================================================== */

function me(): DlaoOfficerAccount {
  const o = DlaoAuth.current();
  if (!o) throw new Error("Officer login required");
  return o;
}

function withApp<T>(applicationId: string, fn: (db: DlasDb, a: ApplicationRecord, o: DlaoOfficerAccount) => T): T {
  const officer = me();
  return mutate((db) => {
    const a = db.applications.find((x) => x.applicationId === applicationId);
    if (!a) throw new Error(`Unknown application ${applicationId}`);
    if (!officerCanAccessApplication(a, officer)) throw new Error("This case is outside your office");
    const r = fn(db, a, officer);
    a.version += 1;
    a.updatedAt = now();
    return r;
  });
}

function logA(db: DlasDb, a: ApplicationRecord, o: DlaoOfficerAccount, action: string, detail?: Record<string, unknown>) {
  audit(db, a.audit, { actor: o.officerId, role: officerAuthorityRole(o) === "CHIEF_LEGAL_AID_OFFICER" ? "clo" : "dlao", caseId: a.caseId ?? a.applicationId, action, detail: { officer: o.name, ...detail } });
}

function openTask(db: DlasDb, a: ApplicationRecord, type: Task["type"], reason: string, hours: number, role: Task["assignedRole"] = "DLAO", context?: Record<string, unknown>): Task {
  const t: Task = {
    taskId: rid("TSK"),
    type,
    applicationId: a.applicationId,
    sessionId: a.channel.sessionId,
    assignedRole: role,
    office: a.routing.office,
    status: "OPEN",
    priority: a.routing.recommendedPriority,
    reason,
    dueAt: new Date(Date.now() + hours * 3600_000).toISOString(),
    createdAt: now(),
    ...(context ? { context } : {}),
  };
  db.tasks.push(t);
  a.taskIds.push(t.taskId);
  return t;
}

function closeTasks(db: DlasDb, a: ApplicationRecord, types: Task["type"][] | "ALL", o: DlaoOfficerAccount) {
  for (const t of db.tasks) {
    if (t.applicationId !== a.applicationId || t.status === "DONE") continue;
    if (types !== "ALL" && !types.includes(t.type)) continue;
    t.status = "DONE";
    logA(db, a, o, "task.closed", { taskId: t.taskId, type: t.type });
  }
}

function emptyReview(o: DlaoOfficerAccount): DlaoReview {
  return {
    officerId: o.officerId,
    officerName: o.name,
    office: officeCode(o),
    receivedAt: now(),
    identity: {
      state: "IN_PROGRESS",
      outcome: null,
      method: null,
      note: null,
      corrections: [],
      attempts: 0,
      at: null,
      nid: { status: null, formatValid: null, simulatedRegistryCheck: null },
    },
    facts: { state: "NOT_STARTED", items: [], missingEvidence: [], outcome: null, at: null },
    eligibility: {
      state: "NOT_STARTED",
      rulesetVersion: null,
      courtLevel: "OTHER_COURTS",
      declaredAnnualIncomeBdt: null,
      incomeBand: null,
      exemptCategories: [],
      vulnerabilityNotes: null,
      recommendation: null,
      reasons: [],
      advisoryOnly: true,
      at: null,
    },
    decision: null,
    notes: [],
    verifiedAt: null,
    pathway: null,
  };
}

/** Bangladesh NID numbers are 10 (smart card), 13 or 17 digits. */
export function nidFormatValid(n: string | null | undefined): boolean {
  if (!n) return false;
  const d = n.replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c))).replace(/\D/g, "");
  return d.length === 10 || d.length === 13 || d.length === 17;
}

const PATHWAY_LABEL: Record<PathwayType, { bn: string; en: string }> = {
  GRAM_ADALAT: { bn: "গ্রাম আদালত", en: "Gram Adalat (village court)" },
  MEDIATION: { bn: "মধ্যস্থতা", en: "Mediation" },
  LAWYER: { bn: "প্যানেল আইনজীবী", en: "Panel lawyer" },
  REFERRAL: { bn: "অন্য সেবায় রেফারেল", en: "Other referral" },
};
export function pathwayLabel(t: PathwayType, lang: "bn" | "en") {
  return PATHWAY_LABEL[t][lang];
}

/** Advisory only — the officer chooses, with a reason. */
export function recommendPathway(a: ApplicationRecord): { type: PathwayType; reasons: string[] } {
  const d = a.data;
  const urgent = d.urgency.flags.some((f) => f === "IMMEDIATE_DANGER" || f === "DETENTION" || f === "VIOLENCE_OR_THREAT");
  if (urgent) return { type: "LAWYER", reasons: ["Safety or liberty is at risk (urgency flags) — needs a lawyer, not a settlement meeting."] };
  switch (d.matter.category) {
    case "CRIMINAL_DEFENCE":
      return { type: "LAWYER", reasons: ["Criminal matter — representation in court is needed."] };
    case "VIOLENCE":
    case "CYBER_HARASSMENT":
      return { type: "LAWYER", reasons: ["Violence / harassment — mediation with the other party can be unsafe; a lawyer can seek protection."] };
    case "LABOUR":
      return { type: "LAWYER", reasons: ["Labour dispute — usually needs a claim before the labour court."] };
    case "FAMILY":
      return { type: "MEDIATION", reasons: ["Family / maintenance dispute — mediation is usually tried first when it is safe for the applicant."] };
    case "LAND":
    case "CIVIL_MONEY":
      return { type: "GRAM_ADALAT", reasons: ["Local civil / money / land dispute — may be heard by the union village court; the officer must check it is within that court's limits."] };
    default:
      return { type: "MEDIATION", reasons: ["No specific rule — mediation suggested as the least costly first step."] };
  }
}

const PATHWAY_TASK: Record<PathwayType, { type: Task["type"]; role: Task["assignedRole"]; reason: string }> = {
  GRAM_ADALAT: { type: "GRAM_ADALAT_REFERRAL", role: "GRAM_ADALAT", reason: "Refer to the union Gram Adalat and track acknowledgement" },
  MEDIATION: { type: "MEDIATION_SCHEDULING", role: "MEDIATOR", reason: "Schedule mediation (remote / hybrid / in person) and notify parties" },
  LAWYER: { type: "LAWYER_ASSIGNMENT", role: "DLAO", reason: "Assign a panel lawyer from the district panel" },
  REFERRAL: { type: "EXTERNAL_REFERRAL", role: "DLAO", reason: "Refer to the named service and track acknowledgement" },
};

/** The facts an officer checks, built from what the record actually holds. */
export function factChecklist(a: ApplicationRecord): { key: string; label: string; value: string | null }[] {
  const d = a.data;
  const items: { key: string; label: string; value: string | null }[] = [
    { key: "matter.category", label: "Type of problem", value: label(MATTERS, d.matter.category, "en") },
    { key: "matter.assistanceRole", label: "Legal aid requested for", value: d.matter.assistanceRole === "ALLEGED_PERSON_DEFENCE" ? "Defence of an alleged person" : d.matter.assistanceRole === "CLAIMANT" ? "Applicant / claimant" : null },
    { key: "matter.summary", label: "What happened", value: d.matter.summary },
    { key: "matter.incidentDate", label: "Incident date", value: d.matter.incidentDate },
    { key: "matter.opposingParty", label: "Other party", value: d.matter.opposingParty },
  ];
  if (d.matter.summaryOriginal) items.push({ key: "matter.summaryOriginal", label: "Applicant's own words (before translation)", value: d.matter.summaryOriginal });
  for (const doc of d.documents) {
    items.push({
      key: `documents.${doc.docId}`,
      label: `Document: ${label(DOC_TYPES, doc.type, "en")}${doc.sensitive ? " (restricted)" : ""}`,
      value: `${doc.status}${doc.fileName ? ` · ${doc.fileName}` : ""}${doc.qualityNote ? ` · ${doc.qualityNote}` : ""}`,
    });
  }
  return items;
}

function setUnderReview(db: DlasDb, a: ApplicationRecord, o: DlaoOfficerAccount, blocked: boolean) {
  const next = blocked ? "INFO_REQUESTED" : "UNDER_REVIEW";
  if (a.status !== next && (a.status === "SUBMITTED" || a.status === "UNDER_REVIEW" || a.status === "INFO_REQUESTED")) {
    logA(db, a, o, "status.changed", { from: a.status, to: next });
    a.status = next;
  }
}

function notify(db: DlasDb, a: ApplicationRecord, o: DlaoOfficerAccount, neutralBody: string, fullBody: string, context?: { kind: "DOCUMENT_REQUEST"; docId: string }) {
  const to = normalizePhone(a.data.safeContact.phone) ?? normalizePhone(a.data.applicant.phone);
  if (!to) {
    logA(db, a, o, "notice.not_sent", { reason: "no safe phone on record — applicant is told at the office / via 16699" });
    return;
  }
  const allowed = a.data.safeContact.smsAllowed;
  const body = a.data.safeContact.neutralWordingRequired ? neutralBody : fullBody;
  db.outbox.push({
    msgId: rid("SMS"),
    kind: "SMS_CONFIRMATION",
    to,
    body,
    sessionId: a.channel.sessionId,
    applicationId: a.applicationId,
    simulated: true,
    status: allowed ? "DELIVERED" : "SUPPRESSED_UNSAFE",
    at: now(),
    ...(context ? { context } : {}),
  });
  logA(db, a, o, allowed ? "notice.sms_sent" : "notice.sms_suppressed", { to, neutral: a.data.safeContact.neutralWordingRequired });
}

export const DlaoReviewService = {
  /** Correct intake details during verification; every changed field keeps its previous value in audit. */
  correctDetails(applicationId: string, changes: Record<string, string | boolean>, reason: string) {
    if (!reason.trim()) throw new Error("Enter a reason for the correction.");
    return withApp(applicationId, (db, a, o) => {
      if (!a.review) throw new Error("Receive the application first.");
      if (a.review.decision || a.status === "RESOLVED" || a.status === "CLOSED" || a.status === "WITHDRAWN") throw new Error("This application has already been decided or closed.");
      if (!applicationsForOffice(db, o).some((x) => x.applicationId === applicationId)) throw new Error("This application is outside your office.");
      const allowed: Record<string, string[]> = {
        applicant: ["fullName", "phone", "nidNumber", "district", "addressLine"],
        filedBy: ["name", "phone"],
        matter: ["category", "summary", "summaryOriginal", "incidentDate", "opposingParty"],
        safeContact: ["method", "phone", "safeTime", "notes", "smsAllowed", "voicemailAllowed", "neutralWordingRequired"],
        urgency: ["selfReportedUrgent"],
      };
      const edited: { path: string; from: unknown; to: unknown }[] = [];
      for (const [path, raw] of Object.entries(changes)) {
        const [section, field] = path.split(".");
        if (!section || !field || !allowed[section]?.includes(field)) throw new Error(`Cannot edit ${path} here.`);
        let value: string | boolean | null = typeof raw === "string" ? raw.trim() || null : raw;
        if (field === "phone" && value) {
          const phone = normalizePhone(String(value));
          if (!phone) throw new Error(`Invalid phone number for ${path}.`);
          value = phone;
        }
        if (path === "applicant.nidNumber" && value && !nidFormatValid(String(value))) throw new Error("NID must contain 10, 13 or 17 digits.");
        if (path === "applicant.district" && value && !DISTRICTS.some((d) => d.code === value)) throw new Error("Select a valid district.");
        if (path === "matter.category" && value && !MATTERS.some((m) => m.code === value)) throw new Error("Select a valid matter.");
        if (path === "matter.incidentDate" && value && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new Error("Enter a valid incident date.");
        if (path === "safeContact.method" && value && !["CALL", "SMS", "VIA_REPRESENTATIVE", "VISIT_OFFICE"].includes(String(value))) throw new Error("Select a valid contact method.");
        if (path === "safeContact.safeTime" && value && !["MORNING", "AFTERNOON", "EVENING", "ANYTIME"].includes(String(value))) throw new Error("Select a valid safe time.");
        const target = a.data[section as keyof typeof a.data] as unknown as Record<string, unknown>;
        const from = target[field] ?? null;
        if (from === value) continue;
        target[field] = value;
        a.provenance[path] = { source: "OFFICER_CORRECTED", method: "AGENT_FORM", confidence: "STATED", by: o.officerId, at: now(), note: reason.trim() };
        a.review.identity.corrections.push({ path, from: from == null ? null : String(from), to: value == null ? "" : String(value) });
        edited.push({ path, from, to: value });
      }
      if (!edited.length) return a;
      if (edited.some((x) => x.path.startsWith("applicant."))) {
        a.review.identity.state = "IN_PROGRESS";
        a.review.identity.outcome = null;
        a.review.verifiedAt = null;
      }
      if (edited.some((x) => x.path.startsWith("matter.") || x.path.startsWith("filedBy.") || x.path.startsWith("urgency."))) {
        a.review.facts.state = "IN_PROGRESS";
        a.review.facts.outcome = null;
        a.review.verifiedAt = null;
      }
      if (edited.some((x) => x.path === "matter.category" || x.path === "applicant.district")) {
        a.review.eligibility.state = "NOT_STARTED";
        a.review.eligibility.recommendation = null;
        a.review.eligibility.reasons = [];
      }
      if (edited.some((x) => x.path === "applicant.district")) {
        a.routing.office = officeFor(a.data.applicant.district);
        a.review.office = a.routing.office;
        for (const task of db.tasks) if (task.applicationId === applicationId && task.status !== "DONE") task.office = a.routing.office;
      }
      a.validation = validateApplication(a.data, a.identity, a.channel.code);
      logA(db, a, o, "review.details_corrected", { reason: reason.trim(), changes: edited });
      return a;
    });
  },
  /** "Application received by relevant office" — the officer opens it for review. */
  receive(applicationId: string) {
    return withApp(applicationId, (db, a, o) => {
      if (a.review) return a;
      ensureRuleset(db);
      a.review = emptyReview(o);
      a.stage = "VERIFICATION_REVIEW";
      logA(db, a, o, "review.received", { office: a.review.office });
      setUnderReview(db, a, o, false);
      return a;
    });
  },

  /** Identity / details verification. Corrections update the data with OFFICER_VERIFIED provenance. */
  verifyIdentity(
    applicationId: string,
    input: {
      outcome: IdentityOutcome;
      method: NonNullable<DlaoReview["identity"]["method"]>;
      note: string;
      nid: "MATCHES_DOCUMENT" | "MISMATCH" | "NOT_PROVIDED";
      corrections: { path: "applicant.fullName" | "applicant.phone" | "applicant.district" | "applicant.nidNumber"; to: string }[];
    },
  ) {
    return withApp(applicationId, (db, a, o) => {
      if (!a.review) throw new Error("Receive the application first");
      if (a.review.decision) throw new Error("Already decided");
      const r = a.review;
      if (input.outcome === "CONFIRMED" && input.nid === "MISMATCH") {
        throw new Error("NID does not match — record it as corrected (with the right number) or disputed");
      }
      r.identity.attempts += 1;
      r.identity.method = input.method;
      r.identity.note = input.note.trim() || null;
      r.identity.at = now();
      r.identity.outcome = input.outcome;
      if (input.outcome === "CORRECTED") {
        for (const c of input.corrections) {
          const [, field] = c.path.split(".") as ["applicant", "fullName" | "phone" | "district" | "nidNumber"];
          const from = (a.data.applicant[field] as string | null) ?? null;
          const to = field === "phone" ? normalizePhone(c.to) ?? c.to : c.to;
          if (from === to || !to) continue;
          (a.data.applicant as Record<string, unknown>)[field] = to;
          if (field === "district") a.routing.office = officeFor(to as DistrictCode);
          a.provenance[c.path] = { source: "OFFICER_VERIFIED", method: "AGENT_FORM", confidence: "CONFIRMED", by: o.officerId, at: now(), note: `corrected by officer; was: ${from ?? "—"}` };
          r.identity.corrections.push({ path: c.path, from, to });
        }
      } else if (input.outcome === "CONFIRMED") {
        for (const p of ["applicant.fullName", "applicant.phone", "applicant.district"]) {
          const prev = a.provenance[p];
          a.provenance[p] = { source: "OFFICER_VERIFIED", method: "AGENT_FORM", confidence: "CONFIRMED", by: o.officerId, at: now(), note: `confirmed by officer (${input.method}); originally ${prev?.source ?? "—"}` };
        }
      }
      r.identity.nid.status = input.nid;
      r.identity.nid.formatValid = a.data.applicant.nidNumber ? nidFormatValid(a.data.applicant.nidNumber) : null;
      if (input.nid !== "NOT_PROVIDED") {
        const prev = a.provenance["applicant.nidNumber"];
        if (input.nid === "MATCHES_DOCUMENT") {
          a.provenance["applicant.nidNumber"] = { source: "OFFICER_VERIFIED", method: "AGENT_FORM", confidence: "CONFIRMED", by: o.officerId, at: now(), note: `matches the NID document; originally ${prev?.source ?? "—"}` };
        }
      }
      const ok = (input.outcome === "CONFIRMED" || input.outcome === "CORRECTED") && input.nid !== "MISMATCH";
      r.identity.state = ok ? "COMPLETED" : "BLOCKED";
      logA(db, a, o, "identity.verified", { outcome: input.outcome, method: input.method, nid: input.nid, attempt: r.identity.attempts, corrections: r.identity.corrections.length });
      if (ok) {
        closeTasks(db, a, ["HUMAN_CALLBACK", "LOCAL_IDENTITY_VERIFICATION"], o);
        if (r.facts.state === "NOT_STARTED") r.facts.state = "IN_PROGRESS";
      } else {
        const t = openTask(db, a, "HUMAN_CALLBACK", input.outcome === "DISPUTED" ? "Identity disputed — reach the applicant on the safe channel" : "Applicant could not be reached safely — try again at the safe time", 48, "HELPLINE_AGENT", { outcome: input.outcome });
        logA(db, a, o, "task.created", { taskId: t.taskId, type: t.type });
        if (input.outcome === "UNREACHABLE") {
          notify(db, a, o, `We tried to reach you about reference ${a.applicationId}. We will call again at your safe time, or call 16699.`, `DLAS legal aid: we could not reach you about application ${a.applicationId}. We will call again at your safe time, or call 16699.`);
        }
      }
      setUnderReview(db, a, o, !ok);
      return a;
    });
  },

  /** A document promised for later was brought to the office. */
  markDocumentReceived(applicationId: string, docId: string, note: string) {
    return withApp(applicationId, (db, a, o) => {
      const d = a.data.documents.find((x) => x.docId === docId);
      if (!d) throw new Error("Unknown document");
      d.status = "ATTACHED";
      d.uploadedAt = now();
      d.uploadedVia = "OFFICE";
      d.qualityNote = note.trim() || d.qualityNote;
      for (const t of db.tasks) {
        if (t.applicationId === a.applicationId && t.status !== "DONE" && t.type === "DOCUMENT_FOLLOW_UP" && (t.context as { docId?: string } | undefined)?.docId === docId) {
          t.status = "DONE";
          logA(db, a, o, "task.closed", { taskId: t.taskId, type: t.type });
        }
      }
      a.provenance[`documents.${docId}`] = { source: "OFFICER_VERIFIED", method: "AGENT_FORM", confidence: "CONFIRMED", by: o.officerId, at: now(), note: "received at the office" };
      logA(db, a, o, "document.received_at_office", { docId, type: d.type });
      if (a.data.documents.every((x) => x.status === "ATTACHED")) closeTasks(db, a, ["DOCUMENT_FOLLOW_UP"], o);
      return a;
    });
  },

  /** Case / fact verification. Missing evidence or disputed facts block and open a follow-up task. */
  reviewFacts(applicationId: string, input: { items: { key: string; status: FactStatus; note: string }[]; missingEvidence: string[]; requestCall?: boolean }) {
    return withApp(applicationId, (db, a, o) => {
      const r = a.review;
      if (!r) throw new Error("Receive the application first");
      if (r.identity.state !== "COMPLETED") throw new Error("Verify identity first");
      if (r.decision) throw new Error("Already decided");
      closeTasks(db, a, ["DOCUMENT_REVIEW"], o); // the officer has now looked at newly uploaded documents
      const base = factChecklist(a);
      r.facts.items = base.map((b) => {
        const i = input.items.find((x) => x.key === b.key);
        return { ...b, status: i?.status ?? "NOT_REVIEWED", note: i?.note.trim() || null };
      });
      r.facts.missingEvidence = input.missingEvidence.map((m) => m.trim()).filter(Boolean);
      const disputed = r.facts.items.some((i) => i.status === "DISPUTED");
      const unreviewed = r.facts.items.some((i) => i.status === "NOT_REVIEWED");
      const outcome: FactsOutcome = r.facts.missingEvidence.length || unreviewed ? "INSUFFICIENT" : disputed ? "NEEDS_CLARIFICATION" : "SUFFICIENT";
      r.facts.outcome = outcome;
      r.facts.at = now();
      r.facts.state = outcome === "SUFFICIENT" ? "COMPLETED" : "BLOCKED";
      logA(db, a, o, "facts.reviewed", { outcome, missing: r.facts.missingEvidence, disputed: r.facts.items.filter((i) => i.status === "DISPUTED").map((i) => i.key) });
      if (outcome === "SUFFICIENT") {
        closeTasks(db, a, ["COMPLETE_MISSING_INFO", "DOCUMENT_FOLLOW_UP"], o);
        if (r.eligibility.state === "NOT_STARTED") r.eligibility.state = "IN_PROGRESS";
        // NID, documents and case facts all checked by the officer → the application is VERIFIED.
        if (!r.verifiedAt) {
          r.verifiedAt = now();
          logA(db, a, o, "application.verified", { nid: r.identity.nid.status, documents: a.data.documents.length });
        }
      } else {
        const t = openTask(db, a, "COMPLETE_MISSING_INFO", outcome === "NEEDS_CLARIFICATION" ? "Facts disputed — clarification needed from the applicant" : `Missing: ${r.facts.missingEvidence.join("; ") || "facts not yet reviewed"}`, 72, "DLAO", { missing: r.facts.missingEvidence });
        logA(db, a, o, "task.created", { taskId: t.taskId, type: t.type });
        // Something is absent or unclear → tell the applicant automatically (dashboard + SMS per safe-contact rules).
        if (r.facts.missingEvidence.length || outcome === "NEEDS_CLARIFICATION") {
          const what = r.facts.missingEvidence.length ? r.facts.missingEvidence.join("; ") : "some details need clarification";
          notify(
            db,
            a,
            o,
            `Update on your reference ${a.applicationId}. Please call 16699 or visit your UDC.`,
            `DLAS legal aid: for application ${a.applicationId} we still need: ${what}. Bring it to your UDC / legal aid office or call 16699.`,
          );
          logA(db, a, o, "applicant.info_requested", { missing: r.facts.missingEvidence, channels: input.requestCall ? ["DASHBOARD", "SMS", "CALL"] : ["DASHBOARD", "SMS"] });
        }
        // Optional: the officer also asks the helpline to phone the applicant at the safe time.
        if (input.requestCall && !db.tasks.some((x) => x.applicationId === a.applicationId && x.type === "HUMAN_CALLBACK" && x.status !== "DONE")) {
          const c = openTask(db, a, "HUMAN_CALLBACK", `Call the applicant at the safe time about: ${r.facts.missingEvidence.join("; ") || "details to clarify"}`, 48, "HELPLINE_AGENT", { purpose: "MISSING_INFO", safeTime: a.data.safeContact.safeTime });
          logA(db, a, o, "task.created", { taskId: c.taskId, type: c.type, assignedRole: c.assignedRole });
        }
      }
      setUnderReview(db, a, o, outcome !== "SUFFICIENT");
      return a;
    });
  },

  /** Vulnerability & eligibility — computes an ADVISORY recommendation from the JSON ruleset. */
  assessEligibility(applicationId: string, input: { courtLevel: "SUPREME_COURT" | "OTHER_COURTS"; income: number | null; exempt: string[]; vulnerabilityNotes: string }) {
    return withApp(applicationId, (db, a, o) => {
      const r = a.review;
      if (!r) throw new Error("Receive the application first");
      if (r.facts.state !== "COMPLETED") throw new Error("Complete fact verification first");
      if (r.decision) throw new Error("Already decided");
      const rs = ensureRuleset(db);
      const res = recommend(rs, input);
      r.eligibility = {
        state: "COMPLETED",
        rulesetVersion: rs.version,
        courtLevel: input.courtLevel,
        declaredAnnualIncomeBdt: input.income,
        incomeBand: res.band,
        exemptCategories: input.exempt,
        vulnerabilityNotes: input.vulnerabilityNotes.trim() || null,
        recommendation: res.recommendation,
        reasons: res.reasons,
        advisoryOnly: true,
        at: now(),
      };
      logA(db, a, o, "eligibility.assessed", { recommendation: res.recommendation, band: res.band, exempt: input.exempt, ruleset: rs.version, advisoryOnly: true });
      return a;
    });
  },

  /**
   * The HUMAN decision. Reason is mandatory, even when agreeing with the recommendation.
   *   ELIGIBLE     → Case ID DLAS-YYYY-NNNNN, status ACCEPTED, stage CASE_OPENED
   *   NOT_ELIGIBLE → status REJECTED, stage CLOSURE, applicant notified, application closed
   */
  decide(applicationId: string, input: { decision: "ELIGIBLE" | "NOT_ELIGIBLE"; reason: string }) {
    return withApp(applicationId, (db, a, o) => {
      const r = a.review;
      if (!r) throw new Error("Receive the application first");
      if (r.decision) throw new Error("Already decided");
      if (r.eligibility.state !== "COMPLETED" || !r.eligibility.recommendation) throw new Error("Complete the eligibility assessment first");
      if (input.reason.trim().length < 10) throw new Error("A reason of at least 10 characters is required");
      if (input.decision === "ELIGIBLE" && (r.identity.state !== "COMPLETED" || r.facts.state !== "COMPLETED")) {
        throw new Error("Identity and facts must be verified before accepting");
      }
      const rec = r.eligibility.recommendation;
      const recSaysEligible = rec === "ELIGIBLE_INCOME" || rec === "ELIGIBLE_EXEMPT_CATEGORY";
      const followed = (input.decision === "ELIGIBLE") === recSaysEligible && rec !== "INSUFFICIENT_INFORMATION";
      r.decision = { decision: input.decision, reason: input.reason.trim(), followedRecommendation: followed, by: o.officerId, byName: o.name, at: now() };
      a.routing.humanDecision = { priority: a.routing.recommendedPriority, by: o.officerId, at: now(), reason: input.reason.trim(), override: !followed };
      logA(db, a, o, "decision.recorded", { decision: input.decision, recommendation: rec, followedRecommendation: followed, reason: input.reason.trim() });

      if (input.decision === "ELIGIBLE") {
        const year = new Date().getFullYear();
        let caseId = "";
        do {
          db.counters.case += 1;
          caseId = `DLAS-${year}-${String(db.counters.case).padStart(5, "0")}`;
        } while (db.applications.some((x) => x.caseId === caseId));
        a.caseId = caseId;
        logA(db, a, o, "status.changed", { from: a.status, to: "ACCEPTED" });
        a.status = "ACCEPTED";
        a.stage = "CASE_OPENED";
        logA(db, a, o, "case.created", { caseId });
        closeTasks(db, a, ["ELIGIBILITY_REVIEW", "COMPLETE_MISSING_INFO"], o);
        notify(db, a, o, `Update on your reference ${a.applicationId}: new reference ${caseId}. Keep it safe.`, `DLAS legal aid: your application ${a.applicationId} is accepted. Case ID ${caseId}. The office will contact you.`);
      } else {
        logA(db, a, o, "status.changed", { from: a.status, to: "REJECTED" });
        a.status = "REJECTED";
        a.stage = "CLOSURE";
        a.closedAt = now();
        closeTasks(db, a, "ALL", o);
        notify(db, a, o, `Update on your reference ${a.applicationId}. Please call 16699 for details.`, `DLAS legal aid: application ${a.applicationId} was not accepted. Reason: ${input.reason.trim()}. Call 16699 to ask or appeal.`);
        logA(db, a, o, "application.closed", { outcome: "REJECTED" });
      }
      return a;
    });
  },

  /** SIMULATED national NID registry check: only the number's format can be checked in the prototype. */
  checkNidRegistry(applicationId: string) {
    return withApp(applicationId, (db, a, o) => {
      if (!a.review) throw new Error("Receive the application first");
      const n = a.data.applicant.nidNumber;
      const ok = nidFormatValid(n);
      a.review.identity.nid.simulatedRegistryCheck = {
        at: now(),
        result: ok ? "FORMAT_OK" : "FORMAT_INVALID",
        note: "Simulated — the Election Commission NID service is not connected; only the number format was checked. Compare with the NID document.",
      };
      a.review.identity.nid.formatValid = n ? ok : null;
      logA(db, a, o, "nid.registry_check_simulated", { result: ok ? "FORMAT_OK" : "FORMAT_INVALID", provided: !!n });
      return a;
    });
  },

  /** Ask the applicant for a document (e.g. the GD copy). The applicant is told automatically and can upload it from "My cases". */
  requestDocument(applicationId: string, input: { type: DocType; note: string }) {
    return withApp(applicationId, (db, a, o) => {
      if (!a.review) throw new Error("Receive the application first");
      if (a.review.decision) throw new Error("Already decided");
      const note = input.note.trim() || null;
      const req = { by: o.officerId, byName: o.name, at: now(), note };
      let d = a.data.documents.find((x) => x.type === input.type && x.status !== "ATTACHED");
      if (d) {
        d.requested = req;
      } else {
        d = { docId: rid("DOC"), type: input.type, status: "WILL_SUBMIT_LATER", fileName: null, mimeType: null, sizeBytes: null, sha256: null, sensitive: false, qualityNote: null, requested: req };
        a.data.documents.push(d);
      }
      a.provenance[`documents.${d.docId}`] = { source: "OFFICER_VERIFIED", method: "AGENT_FORM", confidence: "CONFIRMED", by: o.officerId, at: now(), note: "requested from the applicant by the officer" };
      const name = label(DOC_TYPES, input.type, "en");
      const t = openTask(db, a, "DOCUMENT_FOLLOW_UP", `Requested from applicant: ${name}${note ? ` — ${note}` : ""}`, 72, "DLAO", { docId: d.docId, docType: input.type, requested: true });
      logA(db, a, o, "document.requested", { docId: d.docId, type: input.type, note, taskId: t.taskId });
      notify(
        db,
        a,
        o,
        `Update on your reference ${a.applicationId}. Please log in to the portal or visit your UDC.`,
        `DLAS legal aid: please upload your ${name} for application ${a.applicationId} in the web portal (My cases), or bring it to your UDC. Help: 16699.`,
        { kind: "DOCUMENT_REQUEST", docId: d.docId },
      );
      return a;
    });
  },

  /** The officer says what an uploaded document actually is (e.g. "this is the NID"). */
  setDocumentType(applicationId: string, docId: string, type: DocType) {
    return withApp(applicationId, (db, a, o) => {
      const d = a.data.documents.find((x) => x.docId === docId);
      if (!d) throw new Error("Unknown document");
      const from = d.type;
      if (from === type) return a;
      d.type = type;
      a.provenance[`documents.${docId}.type`] = { source: "OFFICER_VERIFIED", method: "AGENT_FORM", confidence: "CONFIRMED", by: o.officerId, at: now(), note: `classified by officer; was ${from}` };
      logA(db, a, o, "document.classified", { docId, from, to: type });
      return a;
    });
  },

  /** After acceptance: where the case goes next. Officer choice, reason required; recommendation is advisory. */
  choosePathway(applicationId: string, input: { type: PathwayType; reason: string }) {
    return withApp(applicationId, (db, a, o) => commitPathway(db, a, o, input.type, input.reason, recommendPathway(a)));
  },

  /** "Record eligibility details and notes" — after acceptance (or on any reviewed record). */
  addNote(applicationId: string, text: string) {
    return withApp(applicationId, (db, a, o) => {
      if (!a.review) throw new Error("Receive the application first");
      if (text.trim().length < 3) throw new Error("Note is empty");
      a.review.notes.push({ at: now(), by: o.officerId, byName: o.name, text: text.trim() });
      logA(db, a, o, "note.added", { length: text.trim().length });
      return a;
    });
  },
};

/**
 * Writes the final pathway (review.pathway), opens the downstream task and notifies the
 * applicant. Used by choosePathway and by the legal-pathway classification (lib/dlas/pathway.ts).
 */
export function commitPathway(
  db: DlasDb,
  a: ApplicationRecord,
  o: DlaoOfficerAccount,
  type: PathwayType,
  reason: string,
  rec: { type: PathwayType; reasons: string[] },
  extra?: { label?: string; taskReason?: string },
) {
      const r = a.review;
      if (!r?.decision || r.decision.decision !== "ELIGIBLE" || !a.caseId) throw new Error("Only an accepted case (with a Case ID) can be sent to a pathway");
      if (r.pathway) throw new Error("Pathway already chosen");
      if (reason.trim().length < 10) throw new Error("A reason of at least 10 characters is required");
      const input = { type, reason };
      r.pathway = {
        type: input.type,
        recommended: rec.type,
        recommendationReasons: rec.reasons,
        followedRecommendation: rec.type === input.type,
        reason: input.reason.trim(),
        by: o.officerId,
        byName: o.name,
        at: now(),
      };
      a.stage = "SERVICE_DELIVERY";
      logA(db, a, o, "pathway.chosen", { pathway: input.type, recommended: rec.type, followedRecommendation: rec.type === input.type, reason: input.reason.trim() });
      const pt = PATHWAY_TASK[input.type];
      const t = openTask(db, a, pt.type, extra?.taskReason ?? pt.reason, input.type === "LAWYER" ? 48 : 72, pt.role, { caseId: a.caseId });
      logA(db, a, o, "task.created", { taskId: t.taskId, type: t.type, assignedRole: t.assignedRole });
      notify(
        db,
        a,
        o,
        `Update on your reference ${a.caseId}. The office will contact you at your safe time.`,
        `DLAS legal aid: case ${a.caseId} is referred to ${extra?.label ?? PATHWAY_LABEL[input.type].en}. The office will contact you.`,
      );
      return a;
}

/** Shared officer helpers for other Step-2 services (lib/dlas/pathway.ts). */
export { withApp as withOfficerApp, logA as logOfficerAction, openTask as openOfficeTask, notify as notifyApplicant };

/* ================================================================== *
 *  Queue view
 * ================================================================== */

export type QueueBucket = "NEW" | "IN_REVIEW" | "DECIDED";

export function bucketOf(a: ApplicationRecord): QueueBucket {
  if (a.status === "SUBMITTED") return "NEW";
  if (a.status === "UNDER_REVIEW" || a.status === "INFO_REQUESTED") return "IN_REVIEW";
  return "DECIDED";
}

export function subStage(a: ApplicationRecord): string {
  const r = a.review;
  if (!r) return "RECEIVED";
  if (r.decision) return r.decision.decision === "ELIGIBLE" ? (r.pathway ? `PATHWAY_${r.pathway.type}` : "CASE_OPENED") : "REJECTED";
  if (r.identity.state !== "COMPLETED") return r.identity.state === "BLOCKED" ? "IDENTITY_BLOCKED" : "IDENTITY";
  if (r.facts.state !== "COMPLETED") return r.facts.state === "BLOCKED" ? "FACTS_BLOCKED" : "FACTS";
  if (r.eligibility.state !== "COMPLETED") return "ELIGIBILITY";
  return "AWAITING_DECISION";
}

export function useOfficeQueue() {
  const db = useDlasDb();
  const o = useCurrentOfficer();
  return useMemo(() => {
    const list = applicationsForOffice(db, o).slice().sort((x, y) => x.submittedAt.localeCompare(y.submittedAt));
    return {
      officer: o,
      NEW: list.filter((a) => bucketOf(a) === "NEW"),
      IN_REVIEW: list.filter((a) => bucketOf(a) === "IN_REVIEW"),
      DECIDED: list.filter((a) => bucketOf(a) === "DECIDED").reverse(),
      tasks: db.tasks.filter((t) => t.status !== "DONE" && list.some((a) => a.applicationId === t.applicationId)),
    };
  }, [db, o]);
}
