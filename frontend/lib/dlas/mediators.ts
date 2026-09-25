"use client";

/* ------------------------------------------------------------------ *
 *  Mediator registry (Feature 1) — /dashboard/dlo#mediators
 *
 *  Mediators are a separate role from panel lawyers: they conduct
 *  human-led mediation. The Legal Aid Officer adds and verifies them,
 *  sets their status, keeps their availability, conflict declarations
 *  and administrative record. Assignment does NOT happen here — the
 *  registry only exposes `assignmentReadiness()`, the hard filters the
 *  future "system recommends → officer confirms" step will reuse.
 *
 *  Stored in localStorage["dlas.db.v1"]:
 *    db.mediators[]   MediatorRecord (audit[] on every record)
 *  Sample mediators are loaded on request, flagged `sample: true`, and
 *  labelled everywhere as illustrative — not real people.
 * ------------------------------------------------------------------ */

import { useMemo } from "react";
import { mutate, readDb, useDlasDb } from "./store";
import { DlaoAuth, useCurrentOfficer } from "./dlao";
import { useClock } from "./lawyer";
import { DISTRICTS, normalizePhone } from "./reference";
import type {
  AuditEntry,
  DistrictCode,
  DlaoOfficerAccount,
  DlasDb,
  LanguageCode,
  MediationCaseType,
  MediationChannel,
  MediationTrack,
  MediatorAdminEntry,
  MediatorCertificationStatus,
  MediatorConflict,
  MediatorRecord,
  MediatorRole,
  MediatorStatus,
  Weekday,
} from "./schema";

type L = { bn: string; en: string };
const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;
const today = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const addDays = (days: number, t = Date.now()) => today(t + days * 86_400_000);

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

/* ------------------------------ reference ------------------------------ */

export const MEDIATOR_STATUSES: { code: MediatorStatus; label: L }[] = [
  { code: "ACTIVE", label: { bn: "সক্রিয়", en: "Active" } },
  { code: "PENDING_VERIFICATION", label: { bn: "যাচাই বাকি", en: "Pending verification" } },
  { code: "INACTIVE", label: { bn: "নিষ্ক্রিয়", en: "Inactive" } },
  { code: "SUSPENDED", label: { bn: "স্থগিত", en: "Suspended" } },
];

export const MEDIATOR_ROLES: { code: MediatorRole; label: L }[] = [
  { code: "LEGAL_AID_OFFICER", label: { bn: "লিগ্যাল এইড অফিসার (মধ্যস্থতাকারী)", en: "Legal Aid Officer (mediating)" } },
  { code: "PANEL_MEDIATOR", label: { bn: "প্যানেল মধ্যস্থতাকারী", en: "Panel mediator" } },
  { code: "COMMUNITY_MEDIATOR", label: { bn: "কমিউনিটি মধ্যস্থতাকারী", en: "Community mediator" } },
];

export const QUALIFICATIONS: { code: MediatorRecord["qualification"]["kind"]; label: L }[] = [
  { code: "ADVOCATE", label: { bn: "অ্যাডভোকেট", en: "Advocate" } },
  { code: "LAW_GRADUATE", label: { bn: "আইন স্নাতক", en: "Law graduate" } },
  { code: "RETIRED_JUDICIAL_OFFICER", label: { bn: "অবসরপ্রাপ্ত বিচার বিভাগীয় কর্মকর্তা", en: "Retired judicial officer" } },
  { code: "SOCIAL_WORK", label: { bn: "সমাজকর্ম", en: "Social work" } },
  { code: "OTHER", label: { bn: "অন্যান্য", en: "Other" } },
];

export const CERTIFICATION_STATUSES: { code: MediatorCertificationStatus; label: L }[] = [
  { code: "CERTIFIED", label: { bn: "সনদপ্রাপ্ত", en: "Certified" } },
  { code: "TRAINING_COMPLETED", label: { bn: "প্রশিক্ষণ সম্পন্ন", en: "Training completed" } },
  { code: "IN_TRAINING", label: { bn: "প্রশিক্ষণাধীন", en: "In training" } },
  { code: "NOT_TRAINED", label: { bn: "প্রশিক্ষণ নেই", en: "Not trained" } },
];

export const MEDIATION_CASE_TYPES: { code: MediationCaseType; track: MediationTrack; label: L }[] = [
  { code: "FAMILY_MARITAL", track: "PRE_LITIGATION", label: { bn: "পারিবারিক / দাম্পত্য বিরোধ", en: "Family / marital dispute" } },
  { code: "DOWER", track: "PRE_LITIGATION", label: { bn: "দেনমোহর", en: "Dower (denmohor)" } },
  { code: "SPOUSAL_MAINTENANCE", track: "PRE_LITIGATION", label: { bn: "স্ত্রীর ভরণপোষণ", en: "Spousal maintenance" } },
  { code: "CHILD_CUSTODY", track: "PRE_LITIGATION", label: { bn: "সন্তানের হেফাজত / অভিভাবকত্ব", en: "Child custody / guardianship" } },
  { code: "CONJUGAL_RIGHTS", track: "PRE_LITIGATION", label: { bn: "দাম্পত্য অধিকার পুনরুদ্ধার", en: "Restitution of conjugal rights" } },
  { code: "PARENTS_MAINTENANCE", track: "PRE_LITIGATION", label: { bn: "পিতা-মাতার ভরণপোষণ", en: "Parents' maintenance" } },
  { code: "PROPERTY_PARTITION", track: "PRE_LITIGATION", label: { bn: "সম্পত্তি বণ্টন", en: "Property partition" } },
  { code: "NEIGHBOURHOOD_BOUNDARY", track: "PRE_LITIGATION", label: { bn: "প্রতিবেশী / সীমানা বিরোধ", en: "Neighbourhood / boundary dispute" } },
  { code: "CIVIL_SUIT", track: "COURT_REFERRED", label: { bn: "দেওয়ানি মামলা", en: "Civil suit" } },
  { code: "TITLE_DISPUTE", track: "COURT_REFERRED", label: { bn: "স্বত্ব বিরোধ", en: "Title dispute" } },
  { code: "MONEY_SUIT", track: "COURT_REFERRED", label: { bn: "অর্থ আদায় মামলা", en: "Money suit" } },
  { code: "EVICTION", track: "COURT_REFERRED", label: { bn: "উচ্ছেদ", en: "Eviction" } },
  { code: "APPELLATE_REFERRAL", track: "COURT_REFERRED", label: { bn: "আপিল আদালতের রেফারেল", en: "Appellate referral" } },
];

export const MEDIATION_TRACKS: { code: MediationTrack; label: L }[] = [
  { code: "PRE_LITIGATION", label: { bn: "মামলা-পূর্ব", en: "Pre-litigation" } },
  { code: "COURT_REFERRED", label: { bn: "আদালত-প্রেরিত", en: "Court-referred" } },
];

export const WEEKDAYS: { code: Weekday; label: L }[] = [
  { code: "SAT", label: { bn: "শনি", en: "Sat" } },
  { code: "SUN", label: { bn: "রবি", en: "Sun" } },
  { code: "MON", label: { bn: "সোম", en: "Mon" } },
  { code: "TUE", label: { bn: "মঙ্গল", en: "Tue" } },
  { code: "WED", label: { bn: "বুধ", en: "Wed" } },
  { code: "THU", label: { bn: "বৃহস্পতি", en: "Thu" } },
  { code: "FRI", label: { bn: "শুক্র", en: "Fri" } },
];

export const MEDIATION_CHANNELS: { code: MediationChannel; label: L }[] = [
  { code: "PHYSICAL", label: { bn: "সশরীরে", en: "In person" } },
  { code: "VOICE", label: { bn: "ফোন / ভয়েস", en: "Phone / voice" } },
  { code: "ONLINE", label: { bn: "অনলাইন", en: "Online" } },
];

export const CONFLICT_KINDS: { code: MediatorConflict["kind"]; label: L }[] = [
  { code: "RELATIVE_OR_CLOSE_ASSOCIATE", label: { bn: "আত্মীয় / ঘনিষ্ঠ সম্পর্ক", en: "Relative / close associate" } },
  { code: "PRIOR_REPRESENTATION", label: { bn: "আগে পক্ষের প্রতিনিধিত্ব করেছেন", en: "Previously represented a party" } },
  { code: "FINANCIAL_INTEREST", label: { bn: "আর্থিক স্বার্থ", en: "Financial interest" } },
  { code: "EMPLOYMENT_RELATIONSHIP", label: { bn: "চাকরি / কর্মসম্পর্ক", en: "Employment relationship" } },
  { code: "OTHER", label: { bn: "অন্যান্য", en: "Other" } },
];

export const lbl = <T extends string>(list: { code: T; label: L }[], code: T | null | undefined, lang: "bn" | "en") => list.find((x) => x.code === code)?.label[lang] ?? code ?? "—";

/* ------------------------------ derived ------------------------------ */

export type CertificationState = "VALID" | "EXPIRED" | "UNVERIFIED" | "NOT_QUALIFYING";

/** Certificate state as of a date: must be CERTIFIED / TRAINING_COMPLETED, verified by an officer and not past validUntil. */
export function certificationState(m: MediatorRecord, at = Date.now()): CertificationState {
  const c = m.certification;
  if (c.status !== "CERTIFIED" && c.status !== "TRAINING_COMPLETED") return "NOT_QUALIFYING";
  if (c.validUntil && c.validUntil < today(at)) return "EXPIRED";
  if (!c.verifiedAt) return "UNVERIFIED";
  return "VALID";
}

/** Availability as of a date (UNAVAILABLE with a past "until" date counts as available again). */
export function availabilityNow(m: MediatorRecord, at = Date.now()): "AVAILABLE" | "LIMITED" | "UNAVAILABLE" {
  const a = m.availability;
  if (a.status === "UNAVAILABLE" && a.unavailableUntil && a.unavailableUntil < today(at)) return "AVAILABLE";
  return a.status;
}

/** Matters this mediator currently holds in this system (Feature 3 assignments). */
export function assignedMatters(db: Pick<DlasDb, "applications">, mediatorId: string) {
  return db.applications.filter((x) => x.mediation?.assignments.some((s) => s.mediatorId === mediatorId && s.status === "ASSIGNED")).length;
}

/** Current load = recorded baseline (matters outside this system / sample figure) + matters assigned here. */
export function mediatorLoad(m: MediatorRecord, db?: Pick<DlasDb, "applications">) {
  const here = db ? assignedMatters(db, m.mediatorId) : 0;
  const active = m.workload.activeMatters + here;
  return { active, here, baseline: m.workload.activeMatters, max: m.availability.maxActiveMatters, full: active >= m.availability.maxActiveMatters };
}

export type ReadinessCheck = { key: string; ok: boolean; label: L; detail: L };

/**
 * Case-independent hard filters, in the order of the mediator-assignment rule:
 * status → certification → availability → capacity. The future assignment step
 * adds the case-specific filters (jurisdiction, case type, track, conflicts with the parties).
 */
export function assignmentReadiness(m: MediatorRecord, at = Date.now(), db?: Pick<DlasDb, "applications">): { ready: boolean; checks: ReadinessCheck[] } {
  const cert = certificationState(m, at);
  const avail = availabilityNow(m, at);
  const load = mediatorLoad(m, db);
  const activeConflicts = m.conflicts.filter((c) => c.status === "ACTIVE").length;
  const checks: ReadinessCheck[] = [
    {
      key: "status",
      ok: m.status === "ACTIVE",
      label: { bn: "অবস্থা সক্রিয়", en: "Status is active" },
      detail: { bn: lbl(MEDIATOR_STATUSES, m.status, "bn"), en: lbl(MEDIATOR_STATUSES, m.status, "en") },
    },
    {
      key: "certification",
      ok: cert === "VALID",
      label: { bn: "বৈধ ও যাচাইকৃত সনদ / প্রশিক্ষণ", en: "Valid, verified certification / training" },
      detail:
        cert === "VALID"
          ? { bn: m.certification.validUntil ? `মেয়াদ ${m.certification.validUntil} পর্যন্ত` : "যাচাইকৃত", en: m.certification.validUntil ? `Valid until ${m.certification.validUntil}` : "Verified" }
          : cert === "EXPIRED"
            ? { bn: `মেয়াদ শেষ ${m.certification.validUntil}`, en: `Expired ${m.certification.validUntil}` }
            : cert === "UNVERIFIED"
              ? { bn: "কর্মকর্তা এখনো যাচাই করেননি", en: "Not yet verified by an officer" }
              : { bn: lbl(CERTIFICATION_STATUSES, m.certification.status, "bn"), en: lbl(CERTIFICATION_STATUSES, m.certification.status, "en") },
    },
    {
      key: "availability",
      ok: avail !== "UNAVAILABLE",
      label: { bn: "সময় আছে", en: "Available" },
      detail: avail === "UNAVAILABLE" ? { bn: m.availability.unavailableUntil ? `${m.availability.unavailableUntil} পর্যন্ত অনুপলব্ধ` : "অনুপলব্ধ", en: m.availability.unavailableUntil ? `Unavailable until ${m.availability.unavailableUntil}` : "Unavailable" } : avail === "LIMITED" ? { bn: "সীমিত", en: "Limited" } : { bn: "উপলব্ধ", en: "Available" },
    },
    {
      key: "capacity",
      ok: !load.full,
      label: { bn: "কাজের চাপ সীমার মধ্যে", en: "Workload below capacity" },
      detail: { bn: `${load.active}/${load.max}টি চলমান`, en: `${load.active}/${load.max} active matters` },
    },
    {
      key: "scope",
      ok: m.caseTypes.length > 0 && m.tracks.length > 0,
      label: { bn: "মামলার ধরন ও ধারা নির্ধারিত", en: "Case types and tracks recorded" },
      detail: { bn: `${m.caseTypes.length}টি ধরন`, en: `${m.caseTypes.length} case type(s)` },
    },
  ];
  // Conflicts are checked per case at assignment; here they are only counted.
  checks.push({
    key: "conflicts",
    ok: true,
    label: { bn: "স্বার্থের সংঘাত ঘোষণা", en: "Conflict declarations" },
    detail: { bn: `${activeConflicts}টি সক্রিয় — প্রতিটি মামলায় পক্ষের সাথে মিলিয়ে দেখা হবে`, en: `${activeConflicts} active — matched against each case's parties at assignment` },
  });
  return { ready: checks.every((c) => c.ok), checks };
}

/* ------------------------------ access ------------------------------ */

export function officerSeesMediator(o: DlaoOfficerAccount | undefined, m: MediatorRecord) {
  if (!o) return false;
  return o.officeType === "SCLAC" || m.district === o.district;
}

function officer(): DlaoOfficerAccount {
  const o = DlaoAuth.current();
  if (!o) throw new Error("Officer login required");
  return o;
}

function withMediator<T>(mediatorId: string, fn: (db: DlasDb, m: MediatorRecord, o: DlaoOfficerAccount) => T): T {
  const o = officer();
  return mutate((db) => {
    const m = db.mediators.find((x) => x.mediatorId === mediatorId);
    if (!m) throw new Error("Unknown mediator");
    if (!officerSeesMediator(o, m)) throw new Error("This mediator is not in your district's registry");
    const out = fn(db, m, o);
    m.updatedAt = now();
    return out;
  });
}

function record(m: MediatorRecord, o: { officerId: string; name: string }, kind: MediatorAdminEntry["kind"], text: string) {
  m.adminRecord.push({ entryId: rid("MAR"), kind, at: now(), by: o.officerId, byName: o.name, text });
}

/* ------------------------------ read model ------------------------------ */

export type MediatorFilters = {
  q: string;
  status: MediatorStatus | "";
  district: DistrictCode | "";
  caseType: MediationCaseType | "";
  availability: "AVAILABLE" | "LIMITED" | "UNAVAILABLE" | "";
  certification: CertificationState | "";
};

export const EMPTY_MEDIATOR_FILTERS: MediatorFilters = { q: "", status: "", district: "", caseType: "", availability: "", certification: "" };

export function useMediatorRegistry(filters: MediatorFilters = EMPTY_MEDIATOR_FILTERS) {
  const db = useDlasDb();
  const o = useCurrentOfficer();
  const t = useClock();
  return useMemo(() => {
    const visible = db.mediators.filter((m) => officerSeesMediator(o, m));
    const q = filters.q.trim().toLowerCase();
    const list = visible
      .filter((m) => !q || [m.name, m.mediatorId, m.contact.phone, m.qualification.detail, ...m.operationalAreas].some((x) => x.toLowerCase().includes(q)))
      .filter((m) => !filters.status || m.status === filters.status)
      .filter((m) => !filters.district || m.district === filters.district)
      .filter((m) => !filters.caseType || m.caseTypes.includes(filters.caseType))
      .filter((m) => !filters.availability || availabilityNow(m, t) === filters.availability)
      .filter((m) => !filters.certification || certificationState(m, t) === filters.certification)
      .sort((x, y) => MEDIATOR_STATUSES.findIndex((s) => s.code === x.status) - MEDIATOR_STATUSES.findIndex((s) => s.code === y.status) || x.name.localeCompare(y.name));
    return {
      officer: o,
      all: visible,
      list,
      samples: visible.filter((m) => m.sample).length,
      counts: {
        total: visible.length,
        active: visible.filter((m) => m.status === "ACTIVE").length,
        pending: visible.filter((m) => m.status === "PENDING_VERIFICATION").length,
        suspended: visible.filter((m) => m.status === "SUSPENDED").length,
        ready: visible.filter((m) => assignmentReadiness(m, t, db).ready).length,
        certIssues: visible.filter((m) => m.status === "ACTIVE" && certificationState(m, t) !== "VALID").length,
      },
    };
  }, [db, o, filters, t]);
}

export function useMediator(mediatorId: string) {
  const db = useDlasDb();
  const o = useCurrentOfficer();
  const m = db.mediators.find((x) => x.mediatorId === mediatorId);
  return { officer: o, m: m && officerSeesMediator(o, m) ? m : undefined, db };
}

/* ------------------------------ actions (officer) ------------------------------ */

export type MediatorProfileInput = {
  name: string;
  role: MediatorRole;
  qualification: MediatorRecord["qualification"];
  certification: Pick<MediatorRecord["certification"], "status" | "body" | "certificateNo" | "issuedOn" | "validUntil">;
  experience: MediatorRecord["experience"];
  caseTypes: MediationCaseType[];
  tracks: MediationTrack[];
  district: DistrictCode;
  operationalAreas: string[];
  languages: LanguageCode[];
  contact: MediatorRecord["contact"];
  activeMatters: number;
};

function validateProfile(db: DlasDb, input: MediatorProfileInput, selfId: string | null) {
  const phone = normalizePhone(input.contact.phone);
  if (input.name.trim().length < 3) throw new Error("Enter the mediator's full name");
  if (!phone) throw new Error("Enter a valid Bangladeshi mobile number");
  if (db.mediators.some((m) => m.contact.phone === phone && m.mediatorId !== selfId)) throw new Error("Another mediator already uses this phone number");
  if (!DISTRICTS.some((d) => d.code === input.district)) throw new Error("Choose a district");
  if (input.qualification.detail.trim().length < 3) throw new Error("Describe the qualification (e.g. LLB, University of Dhaka)");
  if (input.caseTypes.length === 0) throw new Error("Choose at least one case type the mediator handles");
  if (input.tracks.length === 0) throw new Error("Choose pre-litigation and/or court-referred");
  if (input.contact.email && !/^\S+@\S+\.\S+$/.test(input.contact.email)) throw new Error("The email address is not valid");
  const c = input.certification;
  if (c.issuedOn && c.validUntil && c.validUntil < c.issuedOn) throw new Error("'Valid until' is before 'issued on'");
  const e = input.experience;
  if (e.years < 0 || e.mediationsConducted < 0 || e.settled < 0 || e.settled > e.mediationsConducted) throw new Error("Check the experience numbers (settled cannot exceed mediations conducted)");
  if (input.activeMatters < 0) throw new Error("Current load cannot be negative");
  return phone;
}

export const MediatorRegistry = {
  /** New mediators always start as PENDING_VERIFICATION — an officer verifies the certificate, then activates. */
  create(input: MediatorProfileInput) {
    const o = officer();
    if (o.officeType !== "SCLAC" && input.district !== o.district) throw new Error("You can only add mediators to your own district");
    return mutate((db) => {
      const phone = validateProfile(db, input, null);
      const t = now();
      const m: MediatorRecord = {
        mediatorId: rid("MED"),
        name: input.name.trim(),
        role: input.role,
        status: "PENDING_VERIFICATION",
        statusReason: "New registration — certificate to be verified",
        statusChangedAt: t,
        qualification: { kind: input.qualification.kind, detail: input.qualification.detail.trim() },
        certification: { ...input.certification, verifiedBy: null, verifiedByName: null, verifiedAt: null },
        experience: { ...input.experience, note: input.experience.note?.trim() || null },
        caseTypes: input.caseTypes,
        tracks: input.tracks,
        district: input.district,
        operationalAreas: input.operationalAreas.map((a) => a.trim()).filter(Boolean),
        languages: input.languages.length ? input.languages : ["bn"],
        availability: { status: "AVAILABLE", days: ["SUN", "MON", "TUE", "WED", "THU"], channels: ["PHYSICAL", "VOICE"], maxActiveMatters: 10, unavailableUntil: null, note: null, updatedAt: t },
        workload: { activeMatters: input.activeMatters, basis: "RECORDED", updatedAt: t },
        conflicts: [],
        adminRecord: [],
        contact: { ...input.contact, phone, email: input.contact.email?.trim() || null, office: input.contact.office?.trim() || null },
        sample: false,
        createdAt: t,
        createdBy: o.officerId,
        updatedAt: t,
        audit: [],
      };
      record(m, o, "PROFILE", "Registered in the mediator registry (pending verification)");
      audit(db, m.audit, { actor: o.officerId, role: "dlao", action: "mediator.registered", detail: { officer: o.name, district: m.district, role: m.role } });
      db.mediators.push(m);
      return m;
    });
  },

  update(mediatorId: string, input: MediatorProfileInput) {
    return withMediator(mediatorId, (db, m, o) => {
      if (o.officeType !== "SCLAC" && input.district !== o.district) throw new Error("You can only keep mediators in your own district");
      const phone = validateProfile(db, input, m.mediatorId);
      const before = JSON.stringify({ n: m.name, r: m.role, q: m.qualification, c: m.certification, e: m.experience, ct: m.caseTypes, t: m.tracks, d: m.district, a: m.operationalAreas, l: m.languages, k: m.contact, w: m.workload.activeMatters });
      const certChanged =
        m.certification.status !== input.certification.status ||
        m.certification.certificateNo !== input.certification.certificateNo ||
        m.certification.validUntil !== input.certification.validUntil ||
        m.certification.body !== input.certification.body ||
        m.certification.issuedOn !== input.certification.issuedOn;
      m.name = input.name.trim();
      m.role = input.role;
      m.qualification = { kind: input.qualification.kind, detail: input.qualification.detail.trim() };
      // A changed certificate needs to be verified again.
      m.certification = certChanged ? { ...input.certification, verifiedBy: null, verifiedByName: null, verifiedAt: null } : m.certification;
      m.experience = { ...input.experience, note: input.experience.note?.trim() || null };
      m.caseTypes = input.caseTypes;
      m.tracks = input.tracks;
      m.district = input.district;
      m.operationalAreas = input.operationalAreas.map((a) => a.trim()).filter(Boolean);
      m.languages = input.languages.length ? input.languages : ["bn"];
      m.contact = { ...input.contact, phone, email: input.contact.email?.trim() || null, office: input.contact.office?.trim() || null };
      if (m.workload.activeMatters !== input.activeMatters) m.workload = { activeMatters: input.activeMatters, basis: m.sample ? "SAMPLE" : "RECORDED", updatedAt: now() };
      const after = JSON.stringify({ n: m.name, r: m.role, q: m.qualification, c: m.certification, e: m.experience, ct: m.caseTypes, t: m.tracks, d: m.district, a: m.operationalAreas, l: m.languages, k: m.contact, w: m.workload.activeMatters });
      if (before === after) return m;
      record(m, o, "PROFILE", certChanged ? "Profile edited — certification changed, needs verification again" : "Profile edited");
      audit(db, m.audit, { actor: o.officerId, role: "dlao", action: "mediator.updated", detail: { officer: o.name, certificationReset: certChanged } });
      return m;
    });
  },

  /** The officer has seen the certificate / training record. */
  verifyCertification(mediatorId: string, note: string) {
    return withMediator(mediatorId, (db, m, o) => {
      const c = m.certification;
      if (c.status !== "CERTIFIED" && c.status !== "TRAINING_COMPLETED") throw new Error("Only a completed training or certification can be verified");
      if (!c.body && !c.certificateNo) throw new Error("Record the certifying body or certificate number first (Edit)");
      if (c.validUntil && c.validUntil < today()) throw new Error("This certificate has expired — record the renewed certificate first");
      c.verifiedBy = o.officerId;
      c.verifiedByName = o.name;
      c.verifiedAt = now();
      record(m, o, "VERIFICATION", `Certificate verified${note.trim() ? ` — ${note.trim()}` : ""}`);
      audit(db, m.audit, { actor: o.officerId, role: "dlao", action: "mediator.certification_verified", detail: { certificateNo: c.certificateNo, body: c.body, note: note.trim() || null } });
      return m;
    });
  },

  /** Human decision with a reason. ACTIVE requires a valid, verified certification. */
  setStatus(mediatorId: string, status: MediatorStatus, reason: string) {
    return withMediator(mediatorId, (db, m, o) => {
      if (m.status === status) throw new Error("The mediator already has this status");
      if (reason.trim().length < 10) throw new Error("Give a reason (at least 10 characters)");
      if (status === "ACTIVE") {
        const cert = certificationState(m);
        if (cert !== "VALID") throw new Error(cert === "EXPIRED" ? "Certification has expired — cannot activate" : cert === "UNVERIFIED" ? "Verify the certificate before activating" : "Mediator has no completed training / certification — cannot activate");
      }
      const from = m.status;
      m.status = status;
      m.statusReason = reason.trim();
      m.statusChangedAt = now();
      record(m, o, "STATUS_CHANGE", `${from} → ${status}: ${reason.trim()}`);
      audit(db, m.audit, { actor: o.officerId, role: "dlao", action: "mediator.status_changed", detail: { from, to: status, reason: reason.trim() } });
      return m;
    });
  },

  setAvailability(mediatorId: string, input: Omit<MediatorRecord["availability"], "updatedAt">) {
    return withMediator(mediatorId, (db, m, o) => {
      if (input.maxActiveMatters < 1 || input.maxActiveMatters > 50) throw new Error("Maximum active matters must be between 1 and 50");
      if (input.status !== "UNAVAILABLE" && input.days.length === 0) throw new Error("Choose at least one working day");
      if (input.channels.length === 0) throw new Error("Choose at least one channel (in person / voice / online)");
      if (input.status === "UNAVAILABLE" && input.unavailableUntil && input.unavailableUntil < today()) throw new Error("'Unavailable until' is in the past");
      m.availability = { ...input, unavailableUntil: input.status === "UNAVAILABLE" ? input.unavailableUntil || null : null, note: input.note?.trim() || null, updatedAt: now() };
      record(m, o, "AVAILABILITY", `Availability: ${input.status}${m.availability.unavailableUntil ? ` until ${m.availability.unavailableUntil}` : ""} · ${input.days.join(", ") || "—"} · ${input.channels.join(", ")} · max ${input.maxActiveMatters}`);
      audit(db, m.audit, { actor: o.officerId, role: "dlao", action: "mediator.availability_set", detail: { ...m.availability } });
      return m;
    });
  },

  declareConflict(mediatorId: string, input: { kind: MediatorConflict["kind"]; source: MediatorConflict["source"]; partyName: string; applicationId: string; area: string; detail: string }) {
    return withMediator(mediatorId, (db, m, o) => {
      if (input.detail.trim().length < 10) throw new Error("Describe the conflict (at least 10 characters)");
      if (!input.partyName.trim() && !input.applicationId.trim() && !input.area.trim()) throw new Error("Name the party, the case or the locality the conflict applies to");
      const c: MediatorConflict = {
        conflictId: rid("COI"),
        kind: input.kind,
        source: input.source,
        partyName: input.partyName.trim() || null,
        applicationId: input.applicationId.trim() || null,
        area: input.area.trim() || null,
        detail: input.detail.trim(),
        declaredAt: now(),
        recordedBy: o.officerId,
        recordedByName: o.name,
        status: "ACTIVE",
        withdrawnAt: null,
        withdrawnReason: null,
      };
      m.conflicts.push(c);
      record(m, o, "NOTE", `Conflict declaration recorded (${c.kind}${c.partyName ? `: ${c.partyName}` : ""})`);
      audit(db, m.audit, { actor: o.officerId, role: "dlao", action: "mediator.conflict_declared", detail: { conflictId: c.conflictId, kind: c.kind, source: c.source, partyName: c.partyName, applicationId: c.applicationId, area: c.area } });
      return c;
    });
  },

  withdrawConflict(mediatorId: string, conflictId: string, reason: string) {
    return withMediator(mediatorId, (db, m, o) => {
      const c = m.conflicts.find((x) => x.conflictId === conflictId);
      if (!c) throw new Error("Unknown declaration");
      if (c.status === "WITHDRAWN") throw new Error("Already withdrawn");
      if (reason.trim().length < 10) throw new Error("Give a reason (at least 10 characters)");
      c.status = "WITHDRAWN";
      c.withdrawnAt = now();
      c.withdrawnReason = reason.trim();
      audit(db, m.audit, { actor: o.officerId, role: "dlao", action: "mediator.conflict_withdrawn", detail: { conflictId, reason: c.withdrawnReason } });
      return c;
    });
  },

  addRecord(mediatorId: string, kind: "NOTE" | "TRAINING" | "COMPLAINT" | "COMMENDATION", text: string) {
    return withMediator(mediatorId, (db, m, o) => {
      if (text.trim().length < 5) throw new Error("Write the entry (at least 5 characters)");
      record(m, o, kind, text.trim());
      audit(db, m.audit, { actor: o.officerId, role: "dlao", action: "mediator.record_added", detail: { kind, text: text.trim() } });
      return m;
    });
  },

  /** Illustrative sample mediators for the officer's district — flagged sample, never presented as real people. */
  loadSamples() {
    const o = officer();
    const district = o.district;
    if (!district) throw new Error("Sample mediators are loaded per district — this office has no district");
    return mutate((db) => {
      if (db.mediators.some((m) => m.sample && m.district === district)) throw new Error("Sample mediators are already loaded for this district");
      const d = DISTRICTS.find((x) => x.code === district)!.label.en;
      const t = now();
      const specs = sampleSpecs(d);
      const used = new Set(db.mediators.map((m) => m.contact.phone));
      const out: MediatorRecord[] = [];
      specs.forEach((s, i) => {
        let phone = `0170000${String(100 + i + (district.length % 7) * 10).padStart(4, "0")}`;
        while (used.has(phone)) phone = `0170000${String(Math.floor(1000 + Math.random() * 8999))}`;
        used.add(phone);
        const verified = s.verified ? { verifiedBy: o.officerId, verifiedByName: `${o.name} (sample data)`, verifiedAt: t } : { verifiedBy: null, verifiedByName: null, verifiedAt: null };
        const m: MediatorRecord = {
          mediatorId: rid("MED"),
          name: s.name,
          role: s.role,
          status: s.status,
          statusReason: s.statusReason,
          statusChangedAt: t,
          qualification: s.qualification,
          certification: { ...s.certification, ...verified },
          experience: s.experience,
          caseTypes: s.caseTypes,
          tracks: s.tracks,
          district,
          operationalAreas: s.areas,
          languages: s.languages,
          availability: { ...s.availability, updatedAt: t },
          workload: { activeMatters: s.load, basis: "SAMPLE", updatedAt: t },
          conflicts: s.conflicts.map((c) => ({ conflictId: rid("COI"), ...c, applicationId: null, declaredAt: t, recordedBy: o.officerId, recordedByName: o.name, status: "ACTIVE" as const, withdrawnAt: null, withdrawnReason: null })),
          adminRecord: [],
          contact: { phone, email: null, preferredChannel: s.preferred, office: s.office },
          sample: true,
          createdAt: t,
          createdBy: o.officerId,
          updatedAt: t,
          audit: [],
        };
        for (const [kind, text] of s.record) record(m, o, kind, text);
        audit(db, m.audit, { actor: o.officerId, role: "dlao", action: "mediator.sample_loaded", detail: { note: "Illustrative sample record — not a real person" } });
        db.mediators.push(m);
        out.push(m);
      });
      return out;
    });
  },

  /** Removes this district's sample mediators (real registrations are never deleted). */
  removeSamples() {
    const o = officer();
    return mutate((db) => {
      const before = db.mediators.length;
      db.mediators = db.mediators.filter((m) => !(m.sample && m.district === o.district));
      return before - db.mediators.length;
    });
  },
};

/* ------------------------------ sample data (illustrative) ------------------------------ */

type SampleSpec = {
  name: string;
  role: MediatorRole;
  status: MediatorStatus;
  statusReason: string | null;
  qualification: MediatorRecord["qualification"];
  certification: Pick<MediatorRecord["certification"], "status" | "body" | "certificateNo" | "issuedOn" | "validUntil">;
  verified: boolean;
  experience: MediatorRecord["experience"];
  caseTypes: MediationCaseType[];
  tracks: MediationTrack[];
  areas: string[];
  languages: LanguageCode[];
  availability: Omit<MediatorRecord["availability"], "updatedAt">;
  load: number;
  conflicts: Pick<MediatorConflict, "kind" | "source" | "partyName" | "area" | "detail">[];
  preferred: MediatorRecord["contact"]["preferredChannel"];
  office: string;
  record: [MediatorAdminEntry["kind"], string][];
};

function sampleSpecs(d: string): SampleSpec[] {
  const wk: Weekday[] = ["SUN", "MON", "TUE", "WED", "THU"];
  const body = "Legal aid mediation training (sample — illustrative body)";
  return [
    {
      name: "Farzana Akter",
      role: "LEGAL_AID_OFFICER",
      status: "ACTIVE",
      statusReason: "Verified and activated (sample)",
      qualification: { kind: "ADVOCATE", detail: `LLB (Hons), LLM; enrolled advocate, ${d} Bar (sample)` },
      certification: { status: "CERTIFIED", body, certificateNo: "MED-CERT-S-0101", issuedOn: addDays(-700), validUntil: addDays(400) },
      verified: true,
      experience: { years: 7, mediationsConducted: 140, settled: 96, note: "Mostly family and maintenance matters at the district legal aid office (sample)" },
      caseTypes: ["FAMILY_MARITAL", "DOWER", "SPOUSAL_MAINTENANCE", "CHILD_CUSTODY", "CONJUGAL_RIGHTS"],
      tracks: ["PRE_LITIGATION"],
      areas: [`${d} Sadar`, "District legal aid office"],
      languages: ["bn", "en"],
      availability: { status: "AVAILABLE", days: wk, channels: ["PHYSICAL", "VOICE", "ONLINE"], maxActiveMatters: 12, unavailableUntil: null, note: "Mediation sessions Sun–Thu, 10:00–16:00 (sample)" },
      load: 6,
      conflicts: [{ kind: "RELATIVE_OR_CLOSE_ASSOCIATE", source: "MEDIATOR_DECLARED", partyName: "Md. Selim Hossain (sample)", area: null, detail: "Brother-in-law — must not mediate any dispute involving him (sample declaration)" }],
      preferred: "PHONE",
      office: `District Legal Aid Office, ${d} (sample)`,
      record: [["TRAINING", "Completed refresher training on safe mediation in family disputes (sample)"]],
    },
    {
      name: "Md. Rafiqul Islam",
      role: "PANEL_MEDIATOR",
      status: "ACTIVE",
      statusReason: "Verified and activated (sample)",
      qualification: { kind: "RETIRED_JUDICIAL_OFFICER", detail: "Retired Joint District Judge (sample)" },
      certification: { status: "CERTIFIED", body, certificateNo: "MED-CERT-S-0102", issuedOn: addDays(-400), validUntil: addDays(700) },
      verified: true,
      experience: { years: 12, mediationsConducted: 210, settled: 131, note: "Court-referred civil and title matters (sample)" },
      caseTypes: ["CIVIL_SUIT", "TITLE_DISPUTE", "MONEY_SUIT", "EVICTION", "APPELLATE_REFERRAL", "PROPERTY_PARTITION"],
      tracks: ["COURT_REFERRED", "PRE_LITIGATION"],
      areas: [`${d} District Judge Court`, `${d} Sadar`],
      languages: ["bn", "en"],
      availability: { status: "LIMITED", days: ["SUN", "TUE", "THU"], channels: ["PHYSICAL", "VOICE"], maxActiveMatters: 10, unavailableUntil: null, note: "Three days a week (sample)" },
      load: 9,
      conflicts: [{ kind: "PRIOR_REPRESENTATION", source: "OFFICER_RECORDED", partyName: "Rahim Traders (sample)", area: null, detail: "Heard an earlier suit involving this firm while in service (sample declaration)" }],
      preferred: "PHONE",
      office: `${d} court premises (sample)`,
      record: [["COMMENDATION", "Consistently files session records on time (sample)"]],
    },
    {
      name: "Shirin Sultana",
      role: "COMMUNITY_MEDIATOR",
      status: "ACTIVE",
      statusReason: "Verified and activated (sample)",
      qualification: { kind: "SOCIAL_WORK", detail: "MSS in Social Welfare; union-level community mediator (sample)" },
      certification: { status: "TRAINING_COMPLETED", body, certificateNo: "MED-TRN-S-0103", issuedOn: addDays(-300), validUntil: null },
      verified: true,
      experience: { years: 4, mediationsConducted: 58, settled: 41, note: "Parents' maintenance and neighbour disputes (sample)" },
      caseTypes: ["PARENTS_MAINTENANCE", "NEIGHBOURHOOD_BOUNDARY", "FAMILY_MARITAL"],
      tracks: ["PRE_LITIGATION"],
      areas: [`${d} Sadar — union parishads`, "Upazila legal aid desk"],
      languages: ["bn"],
      availability: { status: "AVAILABLE", days: ["SAT", "SUN", "MON", "TUE", "WED"], channels: ["PHYSICAL", "VOICE"], maxActiveMatters: 8, unavailableUntil: null, note: null },
      load: 3,
      conflicts: [],
      preferred: "SMS",
      office: `Upazila legal aid desk, ${d} (sample)`,
      record: [],
    },
    {
      name: "Abdul Karim Mollah",
      role: "PANEL_MEDIATOR",
      status: "ACTIVE",
      statusReason: "Activated before certificate expiry (sample)",
      qualification: { kind: "ADVOCATE", detail: `LLB; advocate, ${d} Bar (sample)` },
      certification: { status: "CERTIFIED", body, certificateNo: "MED-CERT-S-0104", issuedOn: addDays(-1100), validUntil: addDays(-20) },
      verified: true,
      experience: { years: 9, mediationsConducted: 120, settled: 70, note: null },
      caseTypes: ["PROPERTY_PARTITION", "NEIGHBOURHOOD_BOUNDARY", "MONEY_SUIT"],
      tracks: ["PRE_LITIGATION", "COURT_REFERRED"],
      areas: [`${d} Sadar`],
      languages: ["bn"],
      availability: { status: "AVAILABLE", days: wk, channels: ["PHYSICAL"], maxActiveMatters: 10, unavailableUntil: null, note: null },
      load: 4,
      conflicts: [],
      preferred: "PHONE",
      office: `${d} Bar Association (sample)`,
      record: [["NOTE", "Certificate renewal requested — awaiting new certificate (sample)"]],
    },
    {
      name: "Nasrin Jahan",
      role: "PANEL_MEDIATOR",
      status: "PENDING_VERIFICATION",
      statusReason: "New registration — certificate to be verified (sample)",
      qualification: { kind: "LAW_GRADUATE", detail: "LLB (Hons) (sample)" },
      certification: { status: "IN_TRAINING", body, certificateNo: null, issuedOn: null, validUntil: null },
      verified: false,
      experience: { years: 1, mediationsConducted: 6, settled: 3, note: "Observed sessions as a trainee (sample)" },
      caseTypes: ["FAMILY_MARITAL", "SPOUSAL_MAINTENANCE"],
      tracks: ["PRE_LITIGATION"],
      areas: [`${d} Sadar`],
      languages: ["bn", "en"],
      availability: { status: "AVAILABLE", days: wk, channels: ["PHYSICAL", "ONLINE"], maxActiveMatters: 5, unavailableUntil: null, note: null },
      load: 0,
      conflicts: [],
      preferred: "PHONE",
      office: `District Legal Aid Office, ${d} (sample)`,
      record: [],
    },
    {
      name: "Harun-or-Rashid",
      role: "COMMUNITY_MEDIATOR",
      status: "SUSPENDED",
      statusReason: "Complaint under review: missed two scheduled sessions without notice (sample)",
      qualification: { kind: "OTHER", detail: "Retired school headmaster; trained community mediator (sample)" },
      certification: { status: "TRAINING_COMPLETED", body, certificateNo: "MED-TRN-S-0106", issuedOn: addDays(-900), validUntil: null },
      verified: true,
      experience: { years: 6, mediationsConducted: 75, settled: 44, note: null },
      caseTypes: ["NEIGHBOURHOOD_BOUNDARY", "PARENTS_MAINTENANCE"],
      tracks: ["PRE_LITIGATION"],
      areas: [`${d} — rural unions`],
      languages: ["bn"],
      availability: { status: "AVAILABLE", days: ["SAT", "SUN", "MON"], channels: ["PHYSICAL"], maxActiveMatters: 6, unavailableUntil: null, note: null },
      load: 2,
      conflicts: [{ kind: "OTHER", source: "OFFICER_RECORDED", partyName: null, area: "Home union (sample)", detail: "Lives in the same union — avoid disputes from that union (sample declaration)" }],
      preferred: "PHONE",
      office: `${d} (sample)`,
      record: [["COMPLAINT", "Two applicants reported the mediator did not attend scheduled sessions (sample)"]],
    },
    {
      name: "Taslima Begum",
      role: "LEGAL_AID_OFFICER",
      status: "INACTIVE",
      statusReason: "On leave (sample)",
      qualification: { kind: "ADVOCATE", detail: "LLB, LLM; advocate (sample)" },
      certification: { status: "CERTIFIED", body, certificateNo: "MED-CERT-S-0107", issuedOn: addDays(-500), validUntil: addDays(500) },
      verified: true,
      experience: { years: 5, mediationsConducted: 88, settled: 60, note: null },
      caseTypes: ["FAMILY_MARITAL", "DOWER", "CHILD_CUSTODY", "SPOUSAL_MAINTENANCE"],
      tracks: ["PRE_LITIGATION"],
      areas: [`${d} Sadar`],
      languages: ["bn", "en"],
      availability: { status: "UNAVAILABLE", days: wk, channels: ["PHYSICAL", "VOICE"], maxActiveMatters: 10, unavailableUntil: addDays(30), note: "On leave (sample)" },
      load: 0,
      conflicts: [],
      preferred: "EMAIL",
      office: `District Legal Aid Office, ${d} (sample)`,
      record: [],
    },
  ];
}

export function readMediators() {
  return readDb().mediators;
}
