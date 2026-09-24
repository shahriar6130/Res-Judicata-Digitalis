"use client";

/* ------------------------------------------------------------------ *
 *  Mediation workspace (Feature 4) — /mediator (sign in) · /dashboard/mediator
 *
 *  The mediator's login IS their registry record (db.mediators): sign-in
 *  by phone; self sign-up creates a PENDING_VERIFICATION record that an
 *  officer must verify (Feature 1). A mediator can open a case only while
 *  their assignment on it is ASSIGNED (case-based access, Feature 3).
 *
 *  Everything is written to application.mediation.workspace and audited on
 *  the case with role "mediator":
 *    sessions[]   schedule → start → pause/resume → end, attendance per party
 *    caucus[]     CONFIDENTIAL mediator notes per side — never shown to the
 *                 other party, the applicant or the officer's screens;
 *                 the audit records that a note was added, never its text
 *    settlement[] issues / discussion / proposed / agreed / outstanding —
 *                 typed by the mediator; no AI, no generated amounts
 *    outcomes[]   Settlement reached / Mediation failed / Needs follow-up /
 *                 Adjourn — explicit mediator action; a settlement is NOT
 *                 legally final (party signatures + CLO certification follow)
 *
 *  Need-to-know: the read model below exposes no NID, phone numbers,
 *  address, eligibility/income data, officer notes or staff checks.
 * ------------------------------------------------------------------ */

import { useMemo, useSyncExternalStore } from "react";
import { mutate, readDb, useDlasDb } from "./store";
import { DISTRICTS, normalizePhone } from "./reference";
import { DlaoAuth, officerAuthorityRole, openOfficeTask, useCurrentOfficer } from "./dlao";
import { pathwayRulesOf, statusLabel } from "./pathway-rules";
import { confidentialCaucusNotes, mediatorCanAccessCase, officerCanAccessMediationCase } from "./mediation-access";
import { mediationOriginOf } from "./mediator-assignment";
import { draftSettlementPoints } from "./settlement-draft";
import type {
  ApplicationRecord,
  AuditEntry,
  DistrictCode,
  DlasDb,
  DocType,
  MediationCaseType,
  MediationChannel,
  MediationMatter,
  MediationOutcome,
  MediationSession,
  MediationWorkspace,
  OnlineConnectionState,
  OnlineParticipantKey,
  SessionTransport,
  VoiceCallState,
  MediatorAssignmentRecord,
  MediatorRecord,
  PartySide,
  SettlementItem,
  SettlementList,
  SettlementFollowUpKind,
  SettlementWorkflow,
  SettlementTestimonial,
  FailureReferralPathway,
  MediationFailureRecord,
} from "./schema";

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

/* ------------------------------ mediator login ------------------------------ */

const CURRENT_KEY = "dlas.mediator.current";

function setCurrent(id: string | null) {
  try {
    if (id) window.localStorage.setItem(CURRENT_KEY, id);
    else window.localStorage.removeItem(CURRENT_KEY);
    window.dispatchEvent(new CustomEvent("dlas:db-changed"));
  } catch {
    /* storage unavailable */
  }
}

export type MediatorAuthResult = { ok: true; mediator: MediatorRecord } | { ok: false; error: "INVALID_NAME" | "INVALID_PHONE" | "INVALID_DISTRICT" | "INVALID_QUALIFICATION" | "NO_CASE_TYPES" | "PHONE_TAKEN" | "NOT_FOUND" };

export const MediatorAuth = {
  /** Self-registration → ACTIVE immediately (auto-approved at sign-up). The office does not approve or reject mediators; it only assigns cases. */
  signUp(input: { name: string; phone: string; district: string; qualification: string; caseTypes: MediationCaseType[] }): MediatorAuthResult {
    const phone = normalizePhone(input.phone);
    if (input.name.trim().length < 3) return { ok: false, error: "INVALID_NAME" };
    if (!phone) return { ok: false, error: "INVALID_PHONE" };
    if (!DISTRICTS.some((d) => d.code === input.district)) return { ok: false, error: "INVALID_DISTRICT" };
    if (input.qualification.trim().length < 3) return { ok: false, error: "INVALID_QUALIFICATION" };
    if (!input.caseTypes.length) return { ok: false, error: "NO_CASE_TYPES" };
    if (readDb().mediators.some((m) => m.contact.phone === phone)) return { ok: false, error: "PHONE_TAKEN" };
    const mediator = mutate((db) => {
      const t = now();
      const court = input.caseTypes.some((c) => ["CIVIL_SUIT", "TITLE_DISPUTE", "MONEY_SUIT", "EVICTION", "APPELLATE_REFERRAL"].includes(c));
      const pre = input.caseTypes.some((c) => !["CIVIL_SUIT", "TITLE_DISPUTE", "MONEY_SUIT", "EVICTION", "APPELLATE_REFERRAL"].includes(c));
      const m: MediatorRecord = {
        mediatorId: rid("MED"),
        name: input.name.trim(),
        role: "PANEL_MEDIATOR",
        status: "ACTIVE",
        statusReason: "Auto-approved at sign-up",
        statusChangedAt: t,
        qualification: { kind: "OTHER", detail: input.qualification.trim() },
        certification: { status: "CERTIFIED", body: `Self-declared at sign-up: ${input.qualification.trim()}`, certificateNo: null, issuedOn: null, validUntil: null, verifiedBy: "system", verifiedByName: "Auto-approved at sign-up", verifiedAt: t },
        experience: { years: 0, mediationsConducted: 0, settled: 0, note: null },
        caseTypes: input.caseTypes,
        tracks: [...(pre ? (["PRE_LITIGATION"] as const) : []), ...(court ? (["COURT_REFERRED"] as const) : [])],
        district: input.district as DistrictCode,
        operationalAreas: [],
        languages: ["bn"],
        availability: { status: "AVAILABLE", days: ["SUN", "MON", "TUE", "WED", "THU"], channels: ["PHYSICAL", "VOICE"], maxActiveMatters: 10, unavailableUntil: null, note: null, updatedAt: t },
        workload: { activeMatters: 0, basis: "RECORDED", updatedAt: t },
        conflicts: [],
        adminRecord: [{ entryId: rid("MAR"), kind: "PROFILE", at: t, by: "self", byName: input.name.trim(), text: "Self-registered through /mediator — auto-approved (active)" }],
        contact: { phone, email: null, preferredChannel: "PHONE", office: null },
        sample: false,
        createdAt: t,
        createdBy: "self",
        updatedAt: t,
        audit: [],
      };
      audit(db, m.audit, { actor: m.mediatorId, role: "mediator", action: "mediator.self_registered", detail: { district: m.district, autoApproved: true } });
      db.mediators.push(m);
      return m;
    });
    setCurrent(mediator.mediatorId);
    return { ok: true, mediator };
  },

  login(rawPhone: string): MediatorAuthResult {
    const phone = normalizePhone(rawPhone);
    if (!phone) return { ok: false, error: "INVALID_PHONE" };
    const m = readDb().mediators.find((x) => x.contact.phone === phone);
    if (!m) return { ok: false, error: "NOT_FOUND" };
    mutate((db) => {
      const r = db.mediators.find((x) => x.mediatorId === m.mediatorId)!;
      audit(db, r.audit, { actor: r.mediatorId, role: "mediator", action: "mediator.logged_in" });
    });
    setCurrent(m.mediatorId);
    return { ok: true, mediator: m };
  },

  current(): MediatorRecord | undefined {
    try {
      const id = window.localStorage.getItem(CURRENT_KEY);
      return id ? readDb().mediators.find((x) => x.mediatorId === id) : undefined;
    } catch {
      return undefined;
    }
  },

  logout() {
    setCurrent(null);
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
const currentId = () => {
  try {
    return window.localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
};

export function useCurrentMediator(): MediatorRecord | undefined {
  const id = useSyncExternalStore(subscribe, currentId, () => null);
  const db = useDlasDb();
  return id ? db.mediators.find((x) => x.mediatorId === id) : undefined;
}

/* ------------------------------ access ------------------------------ */

export function activeAssignmentFor(a: ApplicationRecord, mediatorId: string): MediatorAssignmentRecord | null {
  return a.mediation?.assignments.find((x) => x.mediatorId === mediatorId && x.status === "ASSIGNED" && !x.accessRevokedAt) ?? null;
}

const emptyWorkspace = (a: ApplicationRecord): MediationWorkspace => {
  const method = a.data.safeContact.method;
  return {
    openedAt: now(),
    access: {
      channel: method === "VISIT_OFFICE" ? "PHYSICAL" : method === "CALL" || method === "SMS" ? "VOICE" : null,
      connectivity: "UNKNOWN",
      language: a.data.applicant.preferredLanguage,
      interpreter: a.data.applicant.preferredLanguage === "marma" || a.data.applicant.preferredLanguage === "other",
      accessibilityNotes: null,
      updatedAt: null,
    },
    respondent: { contactPreference: null, representation: "UNKNOWN", representativeName: null, verification: "NAMED_BY_APPLICANT", updatedAt: null },
    sessions: [],
    mediatorConfidential: { caucusNotes: [] },
    settlement: [],
    outcomes: [],
    settlementWorkflow: null,
    failureRecord: null,
  };
};

export const FINAL_OUTCOMES: MediationOutcome["kind"][] = ["SETTLEMENT_REACHED", "MEDIATION_FAILED"];
export const finalOutcome = (ws: MediationWorkspace | null | undefined) => [...(ws?.outcomes ?? [])].reverse().find((o) => FINAL_OUTCOMES.includes(o.kind)) ?? null;

export type WorkspaceStatus = "NOT_SCHEDULED" | "SCHEDULED" | "IN_PROGRESS" | "PAUSED" | "AWAITING_OUTCOME" | "OUTCOME_RECORDED";

export function workspaceStatus(ws: MediationWorkspace | null | undefined): WorkspaceStatus {
  if (!ws) return "NOT_SCHEDULED";
  if (finalOutcome(ws)) return "OUTCOME_RECORDED";
  const live = ws.sessions.find((s) => s.status === "IN_PROGRESS" || s.status === "PAUSED");
  if (live) return live.status === "PAUSED" ? "PAUSED" : "IN_PROGRESS";
  const last = ws.sessions[ws.sessions.length - 1];
  if (!last) return "NOT_SCHEDULED";
  if (last.status === "SCHEDULED") return "SCHEDULED";
  const lastOutcome = ws.outcomes[ws.outcomes.length - 1];
  return !lastOutcome || (last.endedAt && lastOutcome.at < last.endedAt) ? "AWAITING_OUTCOME" : "SCHEDULED";
}

/* ------------------------------ need-to-know read model ------------------------------ */

export type MediatorCaseView = ReturnType<typeof buildView>;

function buildView(db: DlasDb, a: ApplicationRecord, matter: MediationMatter, assignment: MediatorAssignmentRecord) {
  const d = a.data;
  const r = a.review;
  const rules = pathwayRulesOf(db);
  const sub = a.pathwayClassification?.inputs.subcategory ?? null;
  const subLabel = sub ? rules.subcategories[d.matter.category ?? "OTHER"]?.find((x) => x.code === sub)?.label ?? null : null;
  const ruleId = a.pathwayClassification?.assessments.find((x) => x.assessmentId === a.pathwayClassification?.decisions.find((y) => y.decisionId === a.pathwayClassification?.final?.decisionId)?.assessmentId)?.ruleId ?? null;
  const expected = new Set<DocType>(rules.rules.find((x) => x.ruleId === ruleId)?.expectedDocs ?? []);
  return {
    applicationId: a.applicationId,
    caseId: a.caseId ?? a.applicationId,
    createdAt: r?.decision?.at ?? a.submittedAt,
    disputeCategory: d.matter.category,
    disputeSubcategory: subLabel,
    summary: d.matter.summary,
    stage: a.stage,
    pathwayStatus: matter.pathwayStatus,
    pathwayLabel: statusLabel(matter.pathwayStatus, "en"),
    mandatory: matter.pathwayStatus === "MANDATORY_PRE_CASE_MEDIATION",
    track: matter.track,
    caseType: matter.caseType,
    origin: matter.origin ?? mediationOriginOf(a),
    courtRef: matter.track === "COURT_REFERRED" ? {
      courtName: a.pathwayClassification?.inputs.courtName ?? null,
      courtLevel: a.pathwayClassification?.inputs.courtLevel ?? null,
      caseNumber: a.pathwayClassification?.inputs.courtCaseNo ?? null,
      referralDate: a.pathwayClassification?.inputs.referralDate ?? null,
      referralOrderReference: a.pathwayClassification?.inputs.referralOrderReference ?? null,
      referringAuthority: a.pathwayClassification?.inputs.referringAuthority ?? null,
      currentLitigationStage: a.pathwayClassification?.inputs.currentLitigationStage ?? null,
      referralDeadline: a.pathwayClassification?.inputs.referralDeadline ?? null,
    } : null,
    officer: r?.officerName ?? null,
    assignedBy: assignment.assignedByName,
    assignedAt: assignment.assignedAt,
    applicant: {
      name: d.applicant.fullName,
      identityVerified: r?.identity.state === "COMPLETED",
      contact: {
        method: d.safeContact.method,
        safeTime: d.safeContact.safeTime,
        window: d.safeContact.window,
        smsAllowed: d.safeContact.smsAllowed,
        neutralWording: d.safeContact.neutralWordingRequired,
        note: d.safeContact.notes,
      },
      representation: d.filedBy.kind === "SELF" ? { kind: "SELF" as const, name: null, relation: null } : { kind: d.filedBy.kind, name: d.filedBy.name, relation: d.filedBy.relation },
      language: d.applicant.preferredLanguage,
      canRead: d.applicant.canRead,
      accessibility: d.applicant.accessibilityNeeds,
      childInvolved: d.urgency.flags.includes("CHILD_INVOLVED"),
    },
    respondent: { name: d.matter.opposingParty?.trim() || null },
    documents: d.documents
      .filter((x) => x.type !== "NID") // identity is shown as "verified", the NID itself is not needed
      .map((x) => ({
        doc: x,
        state: x.status !== "ATTACHED" ? ("PENDING" as const) : r?.facts.state === "COMPLETED" || a.provenance[`documents.${x.docId}`]?.source === "OFFICER_VERIFIED" ? ("VERIFIED" as const) : ("RECEIVED" as const),
        relevant: expected.has(x.type),
        restricted: x.sensitive,
        downloadable: x.status === "ATTACHED" && !x.sensitive && x.preview === "STORED",
      })),
  };
}

/** Everything the workspace needs for one case — only if this mediator currently holds it. */
export function useMediatorCase(applicationId: string) {
  const db = useDlasDb();
  const me = useCurrentMediator();
  return useMemo(() => {
    const a = db.applications.find((x) => x.applicationId === applicationId);
    const assignment = a && me ? activeAssignmentFor(a, me.mediatorId) : null;
    if (!a || !me || !assignment || !a.mediation) return { me, allowed: false as const, a: null, reason: !a ? "NOT_FOUND" : !me ? "LOGIN" : "NO_ACCESS" };
    const ws = a.mediation.workspace ?? null;
    const audit = a.audit.filter((e) => e.role === "mediator" || e.action.startsWith("mediation."));
    return { me, allowed: true as const, a, matter: a.mediation, ws, view: buildView(db, a, a.mediation, assignment), status: workspaceStatus(ws), audit };
  }, [db, me, applicationId]);
}

/** The mediator's own case list. */
export function useMyMediations() {
  const db = useDlasDb();
  const me = useCurrentMediator();
  return useMemo(() => {
    if (!me) return { me, active: [], past: [] };
    const rows = db.applications
      .filter((a) => a.mediation?.assignments.some((x) => x.mediatorId === me.mediatorId && !["AWAITING_OFFICER_CONFIRMATION", "WITHDRAWN", "OFFERED", "DECLINED", "EXPIRED"].includes(x.status)))
      .map((a) => {
        const asg = a.mediation!.assignments.filter((x) => x.mediatorId === me.mediatorId).slice(-1)[0];
        const ws = a.mediation!.workspace ?? null;
        const next = ws?.sessions.find((s) => s.status === "SCHEDULED") ?? null;
        return { a, assignment: asg, status: workspaceStatus(ws), next, outcome: finalOutcome(ws) };
      });
    return { me, active: rows.filter((r) => r.assignment.status === "ASSIGNED" && !r.assignment.accessRevokedAt), past: rows.filter((r) => !(r.assignment.status === "ASSIGNED" && !r.assignment.accessRevokedAt)) };
  }, [db, me]);
}

/* ------------------------------ actions (mediator only) ------------------------------ */

type Ctx = { db: DlasDb; a: ApplicationRecord; m: MediatorRecord; matter: MediationMatter; ws: MediationWorkspace };

function withMyCase<T>(applicationId: string, fn: (c: Ctx) => T, opts: { allowWhenFinal?: boolean } = {}): T {
  const me = MediatorAuth.current();
  if (!me) throw new Error("Mediator login required");
  return mutate((db) => {
    const a = db.applications.find((x) => x.applicationId === applicationId);
    if (!a || !a.mediation) throw new Error("Unknown case");
    if (!mediatorCanAccessCase(a, me.mediatorId)) throw new Error("You are not the assigned mediator for this case (or your access has ended)");
    const m = db.mediators.find((x) => x.mediatorId === me.mediatorId)!;
    if (!a.mediation.workspace) a.mediation.workspace = emptyWorkspace(a);
    const ws = a.mediation.workspace;
    if (!opts.allowWhenFinal && finalOutcome(ws)) throw new Error("The outcome is recorded — this mediation is closed for editing");
    const out = fn({ db, a, m, matter: a.mediation, ws });
    a.version += 1;
    a.updatedAt = now();
    return out;
  });
}

function log(c: Ctx, action: string, detail: Record<string, unknown> = {}) {
  audit(c.db, c.a.audit, { actor: c.m.mediatorId, role: "mediator", caseId: c.a.caseId ?? c.a.applicationId, action, detail: { mediator: c.m.name, ...detail } });
}

function liveSession(ws: MediationWorkspace) {
  return ws.sessions.find((s) => s.status === "IN_PROGRESS" || s.status === "PAUSED") ?? null;
}

/** Safe-contact SMS to the applicant (simulated gateway), audited as the mediator. */
function notifyApplicant(c: Ctx, neutral: string, full: string) {
  const a = c.a;
  const to = normalizePhone(a.data.safeContact.phone) ?? normalizePhone(a.data.applicant.phone);
  if (!to) return log(c, "notice.not_sent", { reason: "no safe phone on record" });
  const allowed = a.data.safeContact.smsAllowed;
  c.db.outbox.push({ msgId: rid("SMS"), kind: "SMS_CONFIRMATION", to, body: a.data.safeContact.neutralWordingRequired ? neutral : full, sessionId: a.channel.sessionId, applicationId: a.applicationId, simulated: true, status: allowed ? "DELIVERED" : "SUPPRESSED_UNSAFE", at: now() });
  log(c, allowed ? "notice.sms_sent" : "notice.sms_suppressed", { neutral: a.data.safeContact.neutralWordingRequired });
}

const newSession = (ws: MediationWorkspace, channel: MediationChannel, at: string | null, place: string | null): MediationSession => ({
  sessionId: rid("MSS"),
  number: ws.sessions.length + 1,
  channel,
  scheduledFor: at,
  place,
  status: "SCHEDULED",
  startedAt: null,
  endedAt: null,
  pauses: [],
  attendance: { APPLICANT: { status: "UNRECORDED", mode: null, at: null }, RESPONDENT: { status: "UNRECORDED", mode: null, at: null } },
  room: null,
  transport: emptyTransport(),
});

/* ------------------------------ transport (Feature 5, simulated) ------------------------------ */

function emptyTransport(): SessionTransport {
  const call = () => ({ state: "IDLE" as VoiceCallState, initiatedAt: null, connectedAt: null, endedAt: null, attempts: 0 });
  const p = () => ({ state: "NOT_JOINED" as OnlineConnectionState, at: null });
  return {
    voice: { APPLICANT: call(), RESPONDENT: call() },
    online: { roomId: `ROOM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, participants: { APPLICANT: p(), RESPONDENT: p(), MEDIATOR: p() } },
    checkIn: { APPLICANT: null, RESPONDENT: null },
    fallbacks: [],
    log: [],
  };
}

/** Sessions created before Feature 5 get an empty transport. */
export function transportOf(s: MediationSession): SessionTransport {
  return s.transport ?? emptyTransport();
}

function ensureTransport(s: MediationSession): SessionTransport {
  if (!s.transport) s.transport = emptyTransport();
  return s.transport;
}

/** Limited connectivity is shown when the mediator recorded it, or an online participant's link is weak / dropped. */
export function connectivityLimited(ws: MediationWorkspace | null | undefined, s: MediationSession | null): boolean {
  if (ws?.access.connectivity === "LIMITED") return true;
  if (!s || s.channel !== "ONLINE") return false;
  return Object.values(transportOf(s).online.participants).some((p) => p.state === "WEAK" || p.state === "DISCONNECTED");
}

const VOICE_NEXT: Record<VoiceCallState, VoiceCallState[]> = {
  IDLE: ["INITIATED"],
  INITIATED: ["CONNECTED", "NO_ANSWER"],
  CONNECTED: ["ENDED"],
  NO_ANSWER: ["INITIATED"],
  ENDED: ["INITIATED"],
};

export const SETTLEMENT_LISTS: { code: SettlementList; label: { bn: string; en: string }; hint: { bn: string; en: string } }[] = [
  { code: "ISSUES", label: { bn: "চিহ্নিত বিষয়", en: "Issues identified" }, hint: { bn: "কী নিয়ে বিরোধ", en: "What the dispute is about" } },
  { code: "DISCUSSION", label: { bn: "আলোচনার বিষয়", en: "Discussion points" }, hint: { bn: "সেশনে যা উঠে এসেছে", en: "What came up in the session" } },
  { code: "PROPOSED", label: { bn: "প্রস্তাবিত শর্ত", en: "Proposed terms" }, hint: { bn: "কোনো পক্ষের প্রস্তাব — এখনো সম্মত নয়", en: "Put forward by a party — not yet agreed" } },
  { code: "AGREED", label: { bn: "সম্মত শর্ত", en: "Agreed terms" }, hint: { bn: "উভয় পক্ষ মৌখিকভাবে সম্মত — স্বাক্ষর ও প্রত্যয়ন পরে", en: "Both parties said they agree — signatures and certification come later" } },
  { code: "OUTSTANDING", label: { bn: "অমীমাংসিত বিষয়", en: "Outstanding issues" }, hint: { bn: "যা এখনো মেলেনি", en: "Still unresolved" } },
];

function failurePathwaySuggestion(a: ApplicationRecord, proposed: FailureReferralPathway): MediationFailureRecord["systemSuggestion"] {
  if (a.mediation?.track === "COURT_REFERRED") return { pathway: "COURT_LEGAL_PATHWAY", reasons: ["The mediation was court-referred; return to the applicable court or legal process for officer review."], advisoryOnly: true };
  if (["CIVIL_SUIT", "TITLE_DISPUTE", "MONEY_SUIT", "EVICTION", "APPELLATE_REFERRAL"].includes(a.mediation?.caseType ?? "")) return { pathway: "LAWYER_ASSIGNMENT", reasons: ["The recorded case type commonly requires representation after mediation does not settle."], advisoryOnly: true };
  if (a.data.urgency.flags.length) return { pathway: "FURTHER_LEGAL_AID_REVIEW", reasons: ["The case has recorded urgency information that an officer should review before referral."], advisoryOnly: true };
  return { pathway: proposed, reasons: ["The suggestion follows the mediator's proposed referral and requires officer confirmation."], advisoryOnly: true };
}

export const MediationWorkspaceService = {
  /** Logged when the mediator opens the case (once per 30 minutes). Creates the workspace on first open. */
  open(applicationId: string) {
    return withMyCase(
      applicationId,
      (c) => {
        const last = [...c.a.audit].reverse().find((e) => e.action === "mediation.workspace_opened" && e.actor === c.m.mediatorId);
        if (last && Date.now() - new Date(last.at).getTime() < 30 * 60_000) return false;
        log(c, "mediation.workspace_opened");
        return true;
      },
      { allowWhenFinal: true },
    );
  },

  setAccess(applicationId: string, patch: Partial<Omit<MediationWorkspace["access"], "updatedAt">>) {
    return withMyCase(applicationId, (c) => {
      c.ws.access = { ...c.ws.access, ...patch, accessibilityNotes: patch.accessibilityNotes !== undefined ? patch.accessibilityNotes?.trim() || null : c.ws.access.accessibilityNotes, updatedAt: now() };
      log(c, "mediation.access_updated", { channel: c.ws.access.channel, connectivity: c.ws.access.connectivity, language: c.ws.access.language, interpreter: c.ws.access.interpreter });
    });
  },

  setRespondent(applicationId: string, patch: Partial<Omit<MediationWorkspace["respondent"], "updatedAt">>) {
    return withMyCase(applicationId, (c) => {
      c.ws.respondent = { ...c.ws.respondent, ...patch, representativeName: patch.representativeName !== undefined ? patch.representativeName?.trim() || null : c.ws.respondent.representativeName, updatedAt: now() };
      log(c, "mediation.respondent_updated", { representation: c.ws.respondent.representation, verification: c.ws.respondent.verification, contactPreference: c.ws.respondent.contactPreference });
    });
  },

  schedule(applicationId: string, input: { at: string; channel: MediationChannel; place: string; room?: string }) {
    return withMyCase(applicationId, (c) => {
      if (!input.at || Number.isNaN(new Date(input.at).getTime())) throw new Error("Choose the session date and time");
      if (liveSession(c.ws)) throw new Error("A session is in progress — end it first");
      if (input.channel === "PHYSICAL" && input.place.trim().length < 3) throw new Error("Give the location for an in-person session");
      const pending = c.ws.sessions.find((s) => s.status === "SCHEDULED");
      const s = pending ?? newSession(c.ws, input.channel, null, null);
      s.channel = input.channel;
      s.scheduledFor = new Date(input.at).toISOString();
      s.place = input.place.trim() || null;
      s.room = input.channel === "PHYSICAL" ? input.room?.trim() || null : null;
      ensureTransport(s);
      if (!pending) c.ws.sessions.push(s);
      log(c, pending ? "mediation.session_rescheduled" : "mediation.session_scheduled", { sessionId: s.sessionId, number: s.number, at: s.scheduledFor, channel: s.channel, place: s.place, room: s.room ?? null, limitedConnectivity: s.channel === "ONLINE" && c.ws.access.connectivity === "LIMITED" });
      for (const t of c.db.tasks)
        if (t.applicationId === c.a.applicationId && t.type === "MEDIATION_SCHEDULING" && t.status !== "DONE") {
          t.status = "DONE";
          log(c, "task.closed", { taskId: t.taskId, type: t.type });
        }
      notifyApplicant(c, `Update on your reference ${c.a.caseId}. The office will contact you at your safe time.`, `DLAS legal aid (${c.a.caseId}): mediation session ${s.number} is set for ${new Date(s.scheduledFor).toLocaleString("en-GB")} (${s.channel === "PHYSICAL" ? `${s.place}${s.room ? `, ${s.room}` : ""}` : s.channel === "VOICE" ? "by phone — the office will call you" : "online — a phone or in-person option stays available"}).`);
      return s;
    });
  },

  start(applicationId: string) {
    return withMyCase(applicationId, (c) => {
      if (liveSession(c.ws)) throw new Error("A session is already running");
      let s = c.ws.sessions.find((x) => x.status === "SCHEDULED");
      if (!s) {
        s = newSession(c.ws, c.ws.access.channel ?? "PHYSICAL", null, null);
        c.ws.sessions.push(s);
      }
      s.status = "IN_PROGRESS";
      s.startedAt = now();
      const tr = ensureTransport(s);
      if (s.channel === "ONLINE") {
        tr.online.participants.MEDIATOR = { state: "CONNECTED", at: now() };
        tr.log.push({ at: now(), kind: "ONLINE", who: "MEDIATOR", state: "CONNECTED" });
      }
      log(c, "mediation.session_started", { sessionId: s.sessionId, number: s.number, channel: s.channel, simulated: s.channel === "ONLINE" });
      return s;
    });
  },

  /** Simulated phone call to one party. Transport only — does not start, pause or end the mediation. */
  voiceCall(applicationId: string, side: PartySide, state: Exclude<VoiceCallState, "IDLE">) {
    return withMyCase(applicationId, (c) => {
      const s = liveSession(c.ws) ?? c.ws.sessions.find((x) => x.status === "SCHEDULED");
      if (!s) throw new Error("Schedule or start a session first");
      if (s.channel !== "VOICE") throw new Error("This session is not on the voice channel — switch channel first");
      const tr = ensureTransport(s);
      const call = tr.voice[side];
      if (!VOICE_NEXT[call.state].includes(state)) throw new Error(`Cannot go from ${call.state} to ${state}`);
      call.state = state;
      if (state === "INITIATED") {
        call.initiatedAt = now();
        call.connectedAt = null;
        call.endedAt = null;
        call.attempts += 1;
      }
      if (state === "CONNECTED") call.connectedAt = now();
      if (state === "ENDED" || state === "NO_ANSWER") call.endedAt = now();
      tr.log.push({ at: now(), kind: "VOICE", who: side, state });
      const safe = side === "APPLICANT" ? { method: c.a.data.safeContact.method, safeTime: c.a.data.safeContact.safeTime } : null;
      log(c, "mediation.voice_call", { sessionId: s.sessionId, side, state, attempt: call.attempts, simulated: true, safeContact: safe });
      return call;
    });
  },

  /** Online room simulator: a participant's connection state. Transport only. */
  onlineStatus(applicationId: string, who: OnlineParticipantKey, state: OnlineConnectionState) {
    return withMyCase(applicationId, (c) => {
      const s = liveSession(c.ws) ?? c.ws.sessions.find((x) => x.status === "SCHEDULED");
      if (!s) throw new Error("Schedule or start a session first");
      if (s.channel !== "ONLINE") throw new Error("This session is not on the online channel");
      const tr = ensureTransport(s);
      tr.online.participants[who] = { state, at: now() };
      tr.log.push({ at: now(), kind: "ONLINE", who, state });
      log(c, "mediation.online_connection", { sessionId: s.sessionId, who, state, simulated: true });
      return tr.online.participants[who];
    });
  },

  /** Physical: a party arrived at the venue (the mediator still records attendance). */
  checkIn(applicationId: string, side: PartySide) {
    return withMyCase(applicationId, (c) => {
      const s = liveSession(c.ws) ?? c.ws.sessions.find((x) => x.status === "SCHEDULED");
      if (!s || s.channel !== "PHYSICAL") throw new Error("No in-person session");
      const tr = ensureTransport(s);
      tr.checkIn[side] = now();
      tr.log.push({ at: now(), kind: "PHYSICAL", who: side, state: "CHECKED_IN" });
      log(c, "mediation.venue_check_in", { sessionId: s.sessionId, side });
    });
  },

  /** Voice / physical fallback (or any channel change). The mediation is never blocked — the session keeps its state, notes and attendance. */
  switchChannel(applicationId: string, to: MediationChannel, reason: string, place?: string, room?: string) {
    return withMyCase(applicationId, (c) => {
      const s = liveSession(c.ws) ?? c.ws.sessions.find((x) => x.status === "SCHEDULED");
      if (!s) throw new Error("No session to switch");
      if (s.channel === to) throw new Error("Already on this channel");
      if (reason.trim().length < 5) throw new Error("Say why the channel is changing");
      if (to === "PHYSICAL" && !(place?.trim() || s.place)) throw new Error("Give the location for the in-person fallback");
      const tr = ensureTransport(s);
      const from = s.channel;
      tr.fallbacks.push({ at: now(), from, to, reason: reason.trim() });
      tr.log.push({ at: now(), kind: "FALLBACK", who: "SESSION", state: `${from}→${to}` });
      s.channel = to;
      if (to === "PHYSICAL") {
        s.place = place?.trim() || s.place;
        s.room = room?.trim() || s.room || null;
      }
      if (to === "VOICE") for (const k of ["APPLICANT", "RESPONDENT"] as PartySide[]) if (tr.voice[k].state === "CONNECTED") tr.voice[k].state = "ENDED";
      log(c, "mediation.channel_switched", { sessionId: s.sessionId, from, to, reason: reason.trim(), sessionStatus: s.status, fallback: from === "ONLINE" });
      if (s.status === "SCHEDULED")
        notifyApplicant(c, `Update on your reference ${c.a.caseId}. The office will contact you at your safe time.`, `DLAS legal aid (${c.a.caseId}): your mediation session will now be ${to === "PHYSICAL" ? `in person at ${s.place}${s.room ? `, ${s.room}` : ""}` : to === "VOICE" ? "by phone — the office will call you" : "online"}.`);
      return s;
    });
  },

  pause(applicationId: string, reason: string) {
    return withMyCase(applicationId, (c) => {
      const s = liveSession(c.ws);
      if (!s || s.status !== "IN_PROGRESS") throw new Error("No running session to pause");
      s.status = "PAUSED";
      s.pauses.push({ from: now(), to: null, reason: reason.trim() || null });
      log(c, "mediation.session_paused", { sessionId: s.sessionId, reason: reason.trim() || null });
    });
  },

  resume(applicationId: string) {
    return withMyCase(applicationId, (c) => {
      const s = liveSession(c.ws);
      if (!s || s.status !== "PAUSED") throw new Error("The session is not paused");
      s.status = "IN_PROGRESS";
      const p = s.pauses[s.pauses.length - 1];
      if (p && !p.to) p.to = now();
      log(c, "mediation.session_resumed", { sessionId: s.sessionId });
    });
  },

  end(applicationId: string) {
    return withMyCase(applicationId, (c) => {
      const s = liveSession(c.ws);
      if (!s) throw new Error("No session is running");
      const missing = (["APPLICANT", "RESPONDENT"] as PartySide[]).filter((k) => s.attendance[k].status === "UNRECORDED");
      if (missing.length) throw new Error(`Record attendance first: ${missing.map((x) => x.toLowerCase()).join(", ")}`);
      const p = s.pauses[s.pauses.length - 1];
      if (p && !p.to) p.to = now();
      s.status = "COMPLETED";
      s.endedAt = now();
      log(c, "mediation.session_ended", { sessionId: s.sessionId, number: s.number, attendance: { applicant: s.attendance.APPLICANT.status, respondent: s.attendance.RESPONDENT.status } });
    });
  },

  markAttendance(applicationId: string, side: PartySide, status: "PRESENT" | "ABSENT" | "REPRESENTED", mode: MediationChannel | null) {
    return withMyCase(applicationId, (c) => {
      const s = liveSession(c.ws) ?? c.ws.sessions.find((x) => x.status === "SCHEDULED");
      if (!s) throw new Error("Schedule or start a session first");
      s.attendance[side] = { status, mode: status === "ABSENT" ? null : (mode ?? s.channel), at: now() };
      log(c, `mediation.attendance_${side.toLowerCase()}`, { sessionId: s.sessionId, status, mode: s.attendance[side].mode });
    });
  },

  /** CONFIDENTIAL — the audit records only that a note was added and for which side. */
  addCaucusNote(applicationId: string, side: PartySide, text: string) {
    return withMyCase(applicationId, (c) => {
      if (text.trim().length < 3) throw new Error("The note is empty");
      const n = { noteId: rid("CAU"), side, sessionId: liveSession(c.ws)?.sessionId ?? null, text: text.trim(), at: now(), by: c.m.mediatorId, byName: c.m.name };
      if (!c.ws.mediatorConfidential) c.ws.mediatorConfidential = { caucusNotes: confidentialCaucusNotes(c.ws) };
      const opened = !c.ws.mediatorConfidential.caucusNotes.some((x) => x.side === side && x.sessionId === n.sessionId);
      c.ws.mediatorConfidential.caucusNotes.push(n);
      if (opened) log(c, "mediation.caucus_opened", { side, sessionId: n.sessionId });
      log(c, "mediation.caucus_note_added", { side, noteId: n.noteId, confidential: true });
      return n;
    });
  },

  addItem(applicationId: string, list: SettlementList, text: string, fromDraft?: { draftId: string; draftText: string } | null) {
    return withMyCase(applicationId, (c) => {
      if (text.trim().length < 3) throw new Error("Write the point first");
      if (fromDraft && /\[[^\]]*\]/.test(text)) throw new Error("Replace the [bracketed] parts of the draft with what the parties actually said");
      const t = now();
      const source: SettlementItem["source"] = !fromDraft ? "MEDIATOR" : fromDraft.draftText.trim() === text.trim() ? "AI_DRAFT_UNCHANGED" : "AI_DRAFT_EDITED";
      const it: SettlementItem = { itemId: rid("STI"), list, text: text.trim(), status: "ACTIVE", at: t, updatedAt: t, by: c.m.mediatorId, history: [], source, aiDraftId: fromDraft?.draftId ?? null };
      c.ws.settlement.push(it);
      log(c, "mediation.settlement_updated", { op: "added", list, itemId: it.itemId, source, aiDraftId: fromDraft?.draftId ?? null });
      return it;
    });
  },

  /** SIMULATED AI draft of the five discussion boxes (template over the shared record — no caucus notes, no amounts). Saves no points; audited. */
  draftSettlementWithAi(applicationId: string) {
    return withMyCase(applicationId, (c) => {
      const d = draftSettlementPoints(c.a, c.ws, rid("AID"));
      log(c, "settlement.ai_draft_generated", { draftId: d.draftId, simulated: true, version: d.version, filled: Object.entries(d.texts).filter(([, v]) => v).map(([k]) => k), basis: d.basis });
      return d;
    });
  },

  editItem(applicationId: string, itemId: string, text: string) {
    return withMyCase(applicationId, (c) => {
      const it = c.ws.settlement.find((x) => x.itemId === itemId && x.status === "ACTIVE");
      if (!it) throw new Error("Unknown item");
      if (text.trim().length < 3) throw new Error("Write the point first");
      if (it.text === text.trim()) return it;
      it.history.push({ list: it.list, text: it.text, at: it.updatedAt });
      it.text = text.trim();
      it.updatedAt = now();
      log(c, "mediation.settlement_updated", { op: "edited", list: it.list, itemId });
      return it;
    });
  },

  moveItem(applicationId: string, itemId: string, list: SettlementList) {
    return withMyCase(applicationId, (c) => {
      const it = c.ws.settlement.find((x) => x.itemId === itemId && x.status === "ACTIVE");
      if (!it) throw new Error("Unknown item");
      if (it.list === list) return it;
      it.history.push({ list: it.list, text: it.text, at: it.updatedAt });
      const from = it.list;
      it.list = list;
      it.updatedAt = now();
      log(c, "mediation.settlement_updated", { op: "moved", from, to: list, itemId });
      return it;
    });
  },

  withdrawItem(applicationId: string, itemId: string) {
    return withMyCase(applicationId, (c) => {
      const it = c.ws.settlement.find((x) => x.itemId === itemId && x.status === "ACTIVE");
      if (!it) throw new Error("Unknown item");
      it.status = "WITHDRAWN";
      it.updatedAt = now();
      log(c, "mediation.settlement_updated", { op: "withdrawn", list: it.list, itemId });
    });
  },

  /** Explicit mediator decision. Settlement is recorded, not made legally final. */
  recordOutcome(
    applicationId: string,
    input: {
      kind: MediationOutcome["kind"];
      note: string;
      failureReason?: string;
      recommendedNext?: NonNullable<MediationOutcome["failure"]>["recommendedNext"];
      followUpBy?: string;
      nextSession?: { at: string; channel: MediationChannel; place: string };
      settlementTerms?: {
        issue: string;
        proposedResolution: string;
        agreedResolution: string;
        conditions: string;
        deadline: string;
        additionalTerms: string;
      };
      failureRecord?: {
        mediationDate: string;
        attendance: Record<PartySide, "PRESENT" | "ABSENT" | "REPRESENTED">;
        issuesDiscussed: string;
        outcome: string;
        reasonStatus: string;
        followUpRequirement: string;
        referralPathway: FailureReferralPathway;
      };
    },
  ) {
    return withMyCase(applicationId, (c) => {
      if (liveSession(c.ws)) throw new Error("End the session before recording the outcome");
      if (!c.ws.sessions.some((s) => s.status === "COMPLETED")) throw new Error("Hold at least one session before recording an outcome");
      if (input.kind !== "MEDIATION_FAILED" && input.note.trim().length < 10) throw new Error("Write a note on the outcome (at least 10 characters)");
      const agreed = c.ws.settlement.filter((x) => x.status === "ACTIVE" && x.list === "AGREED").map((x) => x.text);
      const outstanding = c.ws.settlement.filter((x) => x.status === "ACTIVE" && x.list === "OUTSTANDING").map((x) => x.text);
      const lastSession = [...c.ws.sessions].reverse().find((s) => s.status === "COMPLETED") ?? null;
      const o: MediationOutcome = {
        outcomeId: rid("MOC"),
        kind: input.kind,
        note: input.note.trim(),
        at: now(),
        by: c.m.mediatorId,
        byName: c.m.name,
        sessionId: lastSession?.sessionId ?? null,
        agreedTerms: agreed,
        outstanding,
        failure: null,
        followUpBy: null,
        nextSession: null,
        legalStatus: "ADJOURNED",
      };
      const caseId = c.a.caseId ?? c.a.applicationId;
      if (input.kind === "SETTLEMENT_REACHED") {
        const terms = input.settlementTerms;
        if (!terms) throw new Error("Record the settlement terms first");
        if ([terms.issue, terms.proposedResolution, terms.agreedResolution, terms.conditions].some((v) => v.trim().length < 3)) throw new Error("Complete the issue, proposed resolution, agreed resolution and conditions");
        if (!terms.deadline || Number.isNaN(new Date(terms.deadline).getTime())) throw new Error("Choose the settlement deadline");
        if (lastSession && (lastSession.attendance.APPLICANT.status === "ABSENT" || lastSession.attendance.RESPONDENT.status === "ABSENT")) throw new Error("Both parties must have attended (or been represented at) the last session");
        o.agreedTerms = [terms.agreedResolution.trim()];
        o.legalStatus = "AWAITING_SIGNATURES_AND_CERTIFICATION";
        const recordedAt = now();
        c.ws.settlementWorkflow = {
          agreementId: `AGR-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`,
          outcomeId: o.outcomeId,
          status: "TERMS_RECORDED",
          terms: {
            issue: terms.issue.trim(),
            proposedResolution: terms.proposedResolution.trim(),
            agreedResolution: terms.agreedResolution.trim(),
            conditions: terms.conditions.trim(),
            deadline: terms.deadline,
            additionalTerms: terms.additionalTerms.trim() || null,
            recordedAt,
            recordedBy: c.m.mediatorId,
            recordedByName: c.m.name,
            revision: 1,
          },
          execution: {
            APPLICANT: { status: "PENDING_SIGNATURE", signedAt: null, simulated: true },
            RESPONDENT: { status: "PENDING_SIGNATURE", signedAt: null, simulated: true },
          },
          mediatorConfirmation: { status: "PENDING_CONFIRMATION", mediatorId: null, mediatorName: null, confirmedAt: null },
          cloReview: { status: "PENDING", note: null, reviewedAt: null, reviewedBy: null, reviewedByName: null, history: [] },
          resolution: null,
        };
        const t = openOfficeTask(c.db, c.a, "MEDIATION_OUTCOME_REVIEW", "Settlement terms recorded — verify party execution and mediator confirmation, then complete CLO review. Not final until certified.", 72, "DLAO", { caseId, outcomeId: o.outcomeId, kind: o.kind });
        log(c, "task.created", { taskId: t.taskId, type: t.type });
        notifyApplicant(c, `Update on your reference ${caseId}. The office will contact you at your safe time.`, `DLAS legal aid (${caseId}): the mediation reached a settlement. It becomes final only after both parties sign and the Legal Aid Officer certifies it. The office will contact you.`);
      } else if (input.kind === "MEDIATION_FAILED") {
        const failure = input.failureRecord;
        if (!failure) throw new Error("Complete the mediation outcome record");
        if (!failure.mediationDate || Number.isNaN(new Date(failure.mediationDate).getTime())) throw new Error("Choose the mediation date");
        if (failure.issuesDiscussed.trim().length < 5) throw new Error("Record the issues discussed without confidential caucus content");
        if (failure.outcome.trim().length < 5) throw new Error("Record the mediation outcome");
        o.failure = { reason: failure.reasonStatus.trim() || failure.outcome.trim(), recommendedNext: failure.referralPathway === "LAWYER_ASSIGNMENT" ? "LAWYER_ASSISTANCE" : failure.referralPathway === "COURT_LEGAL_PATHWAY" ? "COURT_PROCESS" : failure.referralPathway === "OTHER_REFERRAL" ? "OTHER_REFERRAL" : "OFFICER_TO_DECIDE" };
        o.legalStatus = "FAILURE_RECORD_FOR_OFFICER";
        const createdAt = now();
        const suggestion = failurePathwaySuggestion(c.a, failure.referralPathway);
        c.ws.failureRecord = {
          recordId: rid("MFR"),
          outcomeId: o.outcomeId,
          status: "AWAITING_OFFICER_REVIEW",
          caseId,
          mediationType: c.matter.track,
          mediator: { mediatorId: c.m.mediatorId, name: c.m.name },
          mediationDate: failure.mediationDate,
          attendance: failure.attendance,
          issuesDiscussed: failure.issuesDiscussed.trim(),
          outcome: failure.outcome.trim(),
          reasonStatus: failure.reasonStatus.trim() || null,
          followUpRequirement: failure.followUpRequirement.trim() || null,
          mediatorProposedPathway: failure.referralPathway,
          systemSuggestion: suggestion,
          relevantProceduralInformation: { sessionId: lastSession?.sessionId ?? null, sessionNumber: lastSession?.number ?? null, channel: lastSession?.channel ?? null, completedAt: lastSession?.endedAt ?? null, confidentialCaucusExcluded: true },
          additionalInformation: [],
          officerReview: { action: null, selectedPathway: null, note: null, by: null, byName: null, at: null, history: [] },
          confirmedPathway: null,
          lawyerHandoff: { status: "NOT_APPLICABLE", taskId: null },
          createdAt,
        };
        const t = openOfficeTask(c.db, c.a, "MEDIATION_FAILURE_REVIEW", `Review formal mediation failure/referral record ${c.ws.failureRecord.recordId}. System suggestion: ${suggestion.pathway}; officer confirmation required.`, 48, "DLAO", { caseId, outcomeId: o.outcomeId, recordId: c.ws.failureRecord.recordId, suggestion: suggestion.pathway });
        t.priority = "HIGH";
        log(c, "task.created", { taskId: t.taskId, type: t.type });
        log(c, "mediation.failure_record_created", { recordId: c.ws.failureRecord.recordId, suggestion: suggestion.pathway, proposedPathway: failure.referralPathway, confidentialCaucusExcluded: true });
        notifyApplicant(c, `Update on your reference ${caseId}. The office will contact you at your safe time.`, `DLAS legal aid (${caseId}): the mediation did not reach a settlement. The office will tell you the next step.`);
      } else if (input.kind === "NEEDS_FOLLOW_UP") {
        if (!input.followUpBy) throw new Error("Choose the follow-up date");
        o.followUpBy = input.followUpBy;
        o.legalStatus = "FOLLOW_UP_PENDING";
        const t = openOfficeTask(c.db, c.a, "MEDIATION_FOLLOW_UP", `Mediator follow-up: ${o.note}`, Math.max(1, Math.round((new Date(input.followUpBy).getTime() - Date.now()) / 3_600_000)), "MEDIATOR", { caseId, outcomeId: o.outcomeId });
        t.assigneeId = c.m.mediatorId;
        log(c, "task.created", { taskId: t.taskId, type: t.type });
      } else {
        const ns = input.nextSession;
        if (!ns?.at || Number.isNaN(new Date(ns.at).getTime())) throw new Error("Choose the date of the next session");
        if (ns.channel === "PHYSICAL" && ns.place.trim().length < 3) throw new Error("Give the venue for the next in-person session");
        const s = newSession(c.ws, ns.channel, new Date(ns.at).toISOString(), ns.place.trim() || null);
        c.ws.sessions.push(s);
        o.nextSession = { at: s.scheduledFor!, channel: s.channel, place: s.place };
        o.legalStatus = "ADJOURNED";
        log(c, "mediation.session_scheduled", { sessionId: s.sessionId, number: s.number, at: s.scheduledFor, channel: s.channel, place: s.place, afterAdjournment: true });
        notifyApplicant(c, `Update on your reference ${caseId}. The office will contact you at your safe time.`, `DLAS legal aid (${caseId}): the mediation is adjourned. Next session: ${new Date(s.scheduledFor!).toLocaleString("en-GB")}.`);
      }
      c.ws.outcomes.push(o);
      log(c, "mediation.outcome_recorded", { outcomeId: o.outcomeId, kind: o.kind, legalStatus: o.legalStatus, agreedTerms: o.agreedTerms.length, outstanding: outstanding.length, recommendedNext: o.failure?.recommendedNext ?? null });
      return o;
    });
  },

  /** Prototype-only signature simulation. The record always carries the simulated marker. */
  simulatePartySignature(applicationId: string, side: PartySide) {
    return withMyCase(applicationId, (c) => {
      const flow = c.ws.settlementWorkflow;
      if (!flow || flow.resolution) throw new Error("No active settlement agreement");
      if (flow.status === "RETURNED_FOR_CORRECTION" || flow.status === "CLARIFICATION_REQUESTED") throw new Error("Address the officer's review before collecting signatures again");
      const signature = flow.execution[side];
      if (signature.status === "SIGNED") return signature;
      signature.status = "SIGNED";
      signature.signedAt = now();
      const both = Object.values(flow.execution).every((x) => x.status === "SIGNED");
      flow.status = both ? "AWAITING_MEDIATOR_CONFIRMATION" : "PARTY_EXECUTION";
      log(c, "settlement.party_signed", { agreementId: flow.agreementId, side, simulated: true });
      return signature;
    }, { allowWhenFinal: true });
  },

  confirmSettlement(applicationId: string) {
    return withMyCase(applicationId, (c) => {
      const flow = c.ws.settlementWorkflow;
      if (!flow || flow.resolution) throw new Error("No active settlement agreement");
      if (!Object.values(flow.execution).every((x) => x.status === "SIGNED")) throw new Error("Both parties must execute the agreement first");
      flow.mediatorConfirmation = { status: "CONFIRMED", mediatorId: c.m.mediatorId, mediatorName: c.m.name, confirmedAt: now() };
      flow.status = "AWAITING_CLO_CERTIFICATION";
      log(c, "settlement.mediator_confirmed", { agreementId: flow.agreementId });
      log(c, "settlement.submitted_for_certification", { agreementId: flow.agreementId, to: "LEGAL_AID_OFFICER" });
      return flow;
    }, { allowWhenFinal: true });
  },

  reviseSettlementTerms(applicationId: string, terms: { issue: string; proposedResolution: string; agreedResolution: string; conditions: string; deadline: string; additionalTerms: string }) {
    return withMyCase(applicationId, (c) => {
      const flow = c.ws.settlementWorkflow;
      if (!flow || !["RETURNED_FOR_CORRECTION", "CLARIFICATION_REQUESTED"].includes(flow.status)) throw new Error("The agreement is not open for correction");
      if ([terms.issue, terms.proposedResolution, terms.agreedResolution, terms.conditions].some((v) => v.trim().length < 3)) throw new Error("Complete all required settlement fields");
      if (!terms.deadline || Number.isNaN(new Date(terms.deadline).getTime())) throw new Error("Choose the settlement deadline");
      flow.terms = { ...flow.terms, issue: terms.issue.trim(), proposedResolution: terms.proposedResolution.trim(), agreedResolution: terms.agreedResolution.trim(), conditions: terms.conditions.trim(), deadline: terms.deadline, additionalTerms: terms.additionalTerms.trim() || null, recordedAt: now(), revision: flow.terms.revision + 1 };
      flow.execution = { APPLICANT: { status: "PENDING_SIGNATURE", signedAt: null, simulated: true }, RESPONDENT: { status: "PENDING_SIGNATURE", signedAt: null, simulated: true } };
      flow.mediatorConfirmation = { status: "PENDING_CONFIRMATION", mediatorId: null, mediatorName: null, confirmedAt: null };
      flow.cloReview.status = "PENDING";
      flow.cloReview.note = null;
      flow.status = "TERMS_RECORDED";
      log(c, "settlement.terms_revised", { agreementId: flow.agreementId, revision: flow.terms.revision });
      return flow;
    }, { allowWhenFinal: true });
  },

  provideFailureInformation(applicationId: string, text: string) {
    return withMyCase(applicationId, (c) => {
      const record = c.ws.failureRecord;
      if (!record || record.status !== "MORE_INFORMATION_REQUESTED") throw new Error("No information request is awaiting a response");
      if (text.trim().length < 5) throw new Error("Provide the requested procedural information");
      record.additionalInformation.push({ text: text.trim(), at: now(), by: c.m.mediatorId, byName: c.m.name });
      record.status = "AWAITING_OFFICER_REVIEW";
      for (const open of c.db.tasks) if (open.applicationId === c.a.applicationId && open.type === "MEDIATION_FOLLOW_UP" && open.status !== "DONE" && open.context?.recordId === record.recordId) open.status = "DONE";
      const task = openOfficeTask(c.db, c.a, "MEDIATION_FAILURE_REVIEW", `Additional information supplied for ${record.recordId}; complete officer review.`, 24, "DLAO", { recordId: record.recordId });
      task.priority = "HIGH";
      log(c, "mediation.failure_information_supplied", { recordId: record.recordId, taskId: task.taskId });
      return record;
    }, { allowWhenFinal: true });
  },

  logDocument(applicationId: string, docId: string, op: "viewed" | "downloaded") {
    return withMyCase(
      applicationId,
      (c) => {
        const d = c.a.data.documents.find((x) => x.docId === docId);
        if (!d || d.type === "NID") throw new Error("Not available to the mediator");
        if (op === "downloaded" && (d.sensitive || d.preview !== "STORED")) throw new Error("Download is not permitted for this document");
        log(c, `mediation.document_${op}`, { docId, type: d.type });
      },
      { allowWhenFinal: true },
    );
  },
};

export type SettlementFollowUpInput = { kind: SettlementFollowUpKind; dueAt: string; note: string };

function officerCanSeeSettlement(a: ApplicationRecord, officer: ReturnType<typeof DlaoAuth.current>) {
  return officerCanAccessMediationCase(a, officer);
}

/** Settlement verification is done by the Legal Aid Officer (DLO) of the handling office — no separate CLO step. */
function cloCanSeeSettlement(a: ApplicationRecord, officer: ReturnType<typeof DlaoAuth.current>) {
  return !!officer && officerCanSeeSettlement(a, officer);
}

function createAuthorityNotification(db: DlasDb, a: ApplicationRecord, kind: "SETTLEMENT_OUTCOME" | "FAILURE_RETURN", outcomeReference: string) {
  if (!a.mediation) throw new Error("No mediation matter exists");
  const authority = a.pathwayClassification?.inputs.referringAuthority?.trim() || a.pathwayClassification?.inputs.courtName?.trim() || "Referring court / authority";
  const task = openOfficeTask(db, a, "COURT_AUTHORITY_NOTIFICATION", `${kind === "SETTLEMENT_OUTCOME" ? "Record settlement outcome notice to" : "Record mediation return to"} ${authority}.`, 24, "DLAO", { kind, outcomeReference });
  const notification = { notificationId: rid("CAN"), kind, authority, status: "PENDING_DISPATCH" as const, simulated: true as const, outcomeReference, createdAt: now(), recordedSentAt: null, recordedSentBy: null, recordedSentByName: null, dispatchReference: null, note: null, taskId: task.taskId };
  (a.mediation.authorityNotifications ??= []).push(notification);
  return notification;
}

function withCloSettlement<T>(applicationId: string, fn: (db: DlasDb, a: ApplicationRecord, flow: SettlementWorkflow, officer: NonNullable<ReturnType<typeof DlaoAuth.current>>) => T): T {
  const officer = DlaoAuth.current();
  if (!officer) throw new Error("Legal Aid Officer login required");
  return mutate((db) => {
    const a = db.applications.find((x) => x.applicationId === applicationId);
    if (!a || !officerCanSeeSettlement(a, officer)) throw new Error("Settlement is outside your office");
    const flow = a.mediation?.workspace?.settlementWorkflow;
    if (!flow) throw new Error("No settlement agreement is awaiting review");
    const result = fn(db, a, flow, officer);
    a.version += 1;
    a.updatedAt = now();
    return result;
  });
}

export const SettlementVerificationService = {
  review(applicationId: string, action: "RETURNED_FOR_CORRECTION" | "CLARIFICATION_REQUESTED", note: string) {
    return withCloSettlement(applicationId, (db, a, flow, officer) => {
      if (flow.resolution) throw new Error("This agreement is already verified");
      if (note.trim().length < 5) throw new Error("Record what must be corrected or clarified");
      const at = now();
      flow.status = action;
      flow.cloReview = { ...flow.cloReview, status: action, note: note.trim(), reviewedAt: at, reviewedBy: officer.officerId, reviewedByName: officer.name, history: [...flow.cloReview.history, { action, note: note.trim(), at, by: officer.officerId, byName: officer.name }] };
      audit(db, a.audit, { actor: officer.officerId, role: roleOf(officer), caseId: a.caseId ?? a.applicationId, action: action === "RETURNED_FOR_CORRECTION" ? "settlement.returned_for_correction" : "settlement.clarification_requested", detail: { agreementId: flow.agreementId, officer: officer.name, note: note.trim() } });
      return flow;
    });
  },

  /** Step 1 — the Legal Aid Officer (DLO) verifies the signed, mediator-confirmed agreement and records the outcome. */
  verify(applicationId: string, input: { outcome: string; followUps?: SettlementFollowUpInput[] }) {
    return withCloSettlement(applicationId, (db, a, flow, officer) => {
      if (flow.resolution) throw new Error("This agreement is already verified");
      if (flow.status !== "AWAITING_CLO_CERTIFICATION" || !Object.values(flow.execution).every((x) => x.status === "SIGNED") || flow.mediatorConfirmation.status !== "CONFIRMED") throw new Error("Both parties must sign and the mediator must confirm before the officer can verify");
      input = { ...input, followUps: input.followUps ?? [] };
      if (input.outcome.trim().length < 3) throw new Error("Record the legal outcome");
      for (const item of input.followUps!) if (!item.dueAt || Number.isNaN(new Date(item.dueAt).getTime())) throw new Error("Choose a valid due date for every follow-up");
      const certificationTimestamp = now();
      const followUpRequirements = input.followUps!.map((item) => {
        const task = openOfficeTask(db, a, "SETTLEMENT_FOLLOW_UP", `${item.kind}: ${item.note.trim() || input.outcome.trim()}`, Math.max(1, Math.round((new Date(item.dueAt).getTime() - Date.now()) / 3_600_000)), "DLAO", { agreementId: flow.agreementId, kind: item.kind });
        task.dueAt = new Date(item.dueAt).toISOString();
        audit(db, a.audit, { actor: officer.officerId, role: roleOf(officer), caseId: a.caseId ?? a.applicationId, action: "task.created", detail: { taskId: task.taskId, type: task.type, followUpKind: item.kind } });
        return { kind: item.kind, dueAt: task.dueAt, note: item.note.trim() || null, taskId: task.taskId };
      });
      flow.cloReview = { ...flow.cloReview, status: "CERTIFIED", note: null, reviewedAt: certificationTimestamp, reviewedBy: officer.officerId, reviewedByName: officer.name, history: [...flow.cloReview.history, { action: "CERTIFIED", note: null, at: certificationTimestamp, by: officer.officerId, byName: officer.name }] };
      flow.resolution = { status: "RESOLVED", certificationTimestamp, certifyingOfficer: officer.name, certifyingOfficerId: officer.officerId, outcome: input.outcome.trim(), followUpRequirements };
      flow.status = "RESOLVED";
      a.stage = followUpRequirements.length ? "FOLLOW_UP" : "OUTCOME"; // the case stays open until the testimonial is issued
      for (const task of db.tasks) if (task.applicationId === a.applicationId && task.type === "MEDIATION_OUTCOME_REVIEW" && task.status !== "DONE") task.status = "DONE";
      if ((a.mediation?.origin ?? mediationOriginOf(a)) === "COURT_REFERRED" || (a.mediation?.origin ?? mediationOriginOf(a)) === "APPELLATE_REFERRAL") createAuthorityNotification(db, a, "SETTLEMENT_OUTCOME", flow.agreementId);
      audit(db, a.audit, { actor: officer.officerId, role: roleOf(officer), caseId: a.caseId ?? a.applicationId, action: "settlement.certified", detail: { agreementId: flow.agreementId, officer: officer.name, verifiedBy: "LEGAL_AID_OFFICER", outcome: input.outcome.trim(), followUps: followUpRequirements.length } });
      return flow;
    });
  },

  /** Step 2 — the officer generates the settlement testimonial; it is sent to the citizen and the appeal window opens (lib/dlas/settlement-appeal.ts). */
  issueTestimonial(applicationId: string) {
    return withCloSettlement(applicationId, (db, a, flow, officer) => {
      if (!flow.resolution) throw new Error("Verify the settlement first");
      if (flow.testimonial) throw new Error("The testimonial has already been issued");
      const at = now();
      const t: SettlementTestimonial = {
        testimonialId: rid("TST"),
        issuedAt: at,
        issuedBy: officer.officerId,
        issuedByName: officer.name,
        office: a.routing.office,
        caseRef: a.caseId ?? a.applicationId,
        agreementId: flow.agreementId,
        applicantName: a.data.applicant.fullName ?? "—",
        respondentName: a.data.matter.opposingParty || null,
        mediatorName: flow.mediatorConfirmation.mediatorName,
        matter: a.data.matter.category ?? "—",
        agreedResolution: flow.terms.agreedResolution,
        conditions: flow.terms.conditions,
        deadline: flow.terms.deadline ?? null,
        outcome: flow.resolution.outcome,
        partiesSignedAt: { APPLICANT: flow.execution.APPLICANT.signedAt, RESPONDENT: flow.execution.RESPONDENT.signedAt },
        mediatorConfirmedAt: flow.mediatorConfirmation.confirmedAt,
        verifiedAt: flow.resolution.certificationTimestamp,
        simulated: true,
      };
      flow.testimonial = t;
      // sent to the citizen; the appeal window opens — no appeal → resolved and closed by default
      a.status = "RESOLVED";
      a.stage = "OUTCOME";
      flow.appeal = { windowEndsAt: new Date(Date.now() + APPEAL_WINDOW_DAYS * 86_400_000).toISOString(), status: "WINDOW_OPEN", filedAt: null, filedBy: null, reason: null, taskId: null, decision: null, closedAt: null };
      for (const task of db.tasks) {
        if (task.applicationId !== a.applicationId || task.status === "DONE") continue;
        if (task.type === "COURT_AUTHORITY_NOTIFICATION") continue; // the outcome notice to a referring court still has to be recorded
        task.status = "DONE";
      }
      audit(db, a.audit, { actor: officer.officerId, role: roleOf(officer), caseId: t.caseRef, action: "settlement.testimonial_issued", detail: { testimonialId: t.testimonialId, agreementId: t.agreementId, officer: officer.name, simulated: true } });
      audit(db, a.audit, { actor: "system", role: "system", caseId: t.caseRef, action: "settlement.testimonial_sent_to_citizen", detail: { testimonialId: t.testimonialId, appealWindowEndsAt: flow.appeal.windowEndsAt, days: APPEAL_WINDOW_DAYS } });
      const to = normalizePhone(a.data.safeContact.phone) ?? normalizePhone(a.data.applicant.phone);
      if (to) {
        const allowed = a.data.safeContact.smsAllowed;
        db.outbox.push({ msgId: rid("SMS"), kind: "SMS_CONFIRMATION", to, body: a.data.safeContact.neutralWordingRequired ? `Update on your reference ${t.caseRef}. Please check your DLAS page or the office will contact you at your safe time.` : `DLAS legal aid (${t.caseRef}): your mediation is complete and testimonial ${t.testimonialId} is available on your DLAS page.`, sessionId: a.channel.sessionId, applicationId: a.applicationId, simulated: true, status: allowed ? "DELIVERED" : "SUPPRESSED_UNSAFE", at: now() });
        audit(db, a.audit, { actor: "system", role: "system", caseId: t.caseRef, action: allowed ? "notice.sms_sent" : "notice.sms_suppressed", detail: { to, neutral: a.data.safeContact.neutralWordingRequired } });
      }
      return t;
    });
  },
};

/** @deprecated kept for older callers — certification is now the Legal Aid Officer's verification. */
export const CloSettlementService = { review: SettlementVerificationService.review, certify: SettlementVerificationService.verify };

export const APPEAL_WINDOW_DAYS = 7;

const roleOf = (o: NonNullable<ReturnType<typeof DlaoAuth.current>>) => (officerAuthorityRole(o) === "CHIEF_LEGAL_AID_OFFICER" ? "clo" : "dlao");

export function useCloSettlements() {
  const db = useDlasDb();
  const officer = useCurrentOfficer();
  return useMemo(() => db.applications.filter((a) => cloCanSeeSettlement(a, officer) && !!a.mediation?.workspace?.settlementWorkflow).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [db, officer]);
}

export function useCloSettlement(applicationId: string) {
  const db = useDlasDb();
  const officer = useCurrentOfficer();
  const application = db.applications.find((a) => a.applicationId === applicationId && cloCanSeeSettlement(a, officer)) ?? null;
  return { officer, application, workflow: application?.mediation?.workspace?.settlementWorkflow ?? null };
}

export function useCloDistrictActivity() {
  const db = useDlasDb();
  const officer = useCurrentOfficer();
  return useMemo(() => {
    const cases = db.applications.filter((a) => cloCanSeeSettlement(a, officer) && !!a.mediation);
    return {
      total: cases.length,
      assigned: cases.filter((a) => a.mediation?.assignmentStatus === "ASSIGNED").length,
      inProgress: cases.filter((a) => ["IN_PROGRESS", "PAUSED"].includes(workspaceStatus(a.mediation?.workspace))).length,
      settlements: cases.filter((a) => !!a.mediation?.workspace?.settlementWorkflow).length,
      failures: cases.filter((a) => !!a.mediation?.workspace?.failureRecord).length,
      pendingCertification: cases.filter((a) => a.mediation?.workspace?.settlementWorkflow?.status === "AWAITING_CLO_CERTIFICATION").length,
    };
  }, [db, officer]);
}

function withFailureRecord<T>(applicationId: string, fn: (db: DlasDb, a: ApplicationRecord, record: MediationFailureRecord, officer: NonNullable<ReturnType<typeof DlaoAuth.current>>) => T): T {
  const officer = DlaoAuth.current();
  if (!officer) throw new Error("Legal Aid Officer login required");
  return mutate((db) => {
    const a = db.applications.find((x) => x.applicationId === applicationId);
    if (!a || !officerCanSeeSettlement(a, officer)) throw new Error("Mediation outcome is outside your office");
    const record = a.mediation?.workspace?.failureRecord;
    if (!record) throw new Error("No mediation failure/referral record exists");
    const result = fn(db, a, record, officer);
    a.version += 1;
    a.updatedAt = now();
    return result;
  });
}

export const MediationFailureReviewService = {
  requestMoreInformation(applicationId: string, note: string) {
    return withFailureRecord(applicationId, (db, a, record, officer) => {
      if (record.status === "REFERRAL_CONFIRMED") throw new Error("The referral is already confirmed");
      if (note.trim().length < 5) throw new Error("Specify the information required");
      const at = now();
      record.status = "MORE_INFORMATION_REQUESTED";
      record.officerReview = { ...record.officerReview, action: "MORE_INFORMATION_REQUESTED", selectedPathway: null, note: note.trim(), by: officer.officerId, byName: officer.name, at, history: [...record.officerReview.history, { action: "MORE_INFORMATION_REQUESTED", selectedPathway: null, note: note.trim(), by: officer.officerId, byName: officer.name, at }] };
      for (const task of db.tasks) if (task.applicationId === a.applicationId && task.type === "MEDIATION_FAILURE_REVIEW" && task.status !== "DONE") task.status = "DONE";
      const task = openOfficeTask(db, a, "MEDIATION_FOLLOW_UP", `Officer requests procedural information for ${record.recordId}: ${note.trim()}`, 24, "MEDIATOR", { recordId: record.recordId });
      task.assigneeId = record.mediator.mediatorId;
      audit(db, a.audit, { actor: officer.officerId, role: "dlao", caseId: a.caseId ?? a.applicationId, action: "mediation.failure_more_information_requested", detail: { recordId: record.recordId, officer: officer.name, note: note.trim(), taskId: task.taskId } });
      return record;
    });
  },

  confirmReferral(applicationId: string, input: { pathway: FailureReferralPathway; changed: boolean; note: string }) {
    return withFailureRecord(applicationId, (db, a, record, officer) => {
      if (record.status === "REFERRAL_CONFIRMED") throw new Error("The referral is already confirmed");
      if (record.status === "MORE_INFORMATION_REQUESTED") throw new Error("Wait for the mediator's requested information");
      if (input.note.trim().length < 5) throw new Error("Record the reason for the officer decision");
      if (input.changed && input.pathway === record.systemSuggestion.pathway) throw new Error("Choose a different pathway, or confirm the suggestion");
      const at = now();
      const action = input.changed ? "PATHWAY_CHANGED" as const : "CONFIRMED" as const;
      record.status = "REFERRAL_CONFIRMED";
      record.confirmedPathway = input.pathway;
      record.officerReview = { ...record.officerReview, action, selectedPathway: input.pathway, note: input.note.trim(), by: officer.officerId, byName: officer.name, at, history: [...record.officerReview.history, { action, selectedPathway: input.pathway, note: input.note.trim(), by: officer.officerId, byName: officer.name, at }] };
      for (const task of db.tasks) if (task.applicationId === a.applicationId && task.type === "MEDIATION_FAILURE_REVIEW" && task.status !== "DONE") task.status = "DONE";

      let handoffTask;
      if (input.pathway === "LAWYER_ASSIGNMENT") {
        if (!a.review) throw new Error("The case has no officer review record");
        const prior = a.review.pathway;
        a.review.pathway = { type: "LAWYER", recommended: prior?.recommended ?? "MEDIATION", recommendationReasons: [...(prior?.recommendationReasons ?? []), `Post-mediation referral ${record.recordId}: ${record.systemSuggestion.reasons.join(" ")}`], followedRecommendation: false, reason: input.note.trim(), by: officer.officerId, byName: officer.name, at };
        const classification = a.pathwayClassification;
        const assessment = classification?.assessments[classification.assessments.length - 1];
        if (classification && assessment) {
          const decisionId = rid("PDC");
          classification.decisions.push({ decisionId, action: "CHANGED", assessmentId: assessment.assessmentId, systemClassification: assessment.result, previousSystemClassification: classification.final?.status ?? null, previousFinal: classification.final?.status ?? null, finalPathway: "LAWYER_ASSISTANCE", referralTarget: null, reason: `Post-mediation referral ${record.recordId}: ${input.note.trim()}`, by: officer.officerId, byName: officer.name, at });
          classification.final = { status: "LAWYER_ASSISTANCE", referralTarget: null, decisionId, by: officer.officerId, byName: officer.name, at };
        }
        if (!a.lawyer) a.lawyer = { assignments: [], hearings: [], updates: [], access: [], shortlists: [], completion: null };
        handoffTask = openOfficeTask(db, a, "LAWYER_ASSIGNMENT", `Mediation failure handoff ${record.recordId}: create shortlist and assign a panel lawyer.`, 24, "DLAO", { recordId: record.recordId, source: "MEDIATION_FAILURE" });
        record.lawyerHandoff = { status: "AWAITING_ASSIGNMENT", taskId: handoffTask.taskId };
        audit(db, a.audit, { actor: officer.officerId, role: "dlao", caseId: a.caseId ?? a.applicationId, action: "mediation.lawyer_handoff_created", detail: { recordId: record.recordId, taskId: handoffTask.taskId, chain: ["MEDIATION", "FAILURE", "REFERRAL_RECORD", "LEGAL_AID_OFFICER", "LAWYER_ASSIGNMENT"] } });
      } else {
        const type = input.pathway === "OTHER_REFERRAL" ? "EXTERNAL_REFERRAL" : "POST_MEDIATION_REFERRAL";
        handoffTask = openOfficeTask(db, a, type, `Carry out confirmed post-mediation pathway ${input.pathway} from ${record.recordId}.`, 48, "DLAO", { recordId: record.recordId, pathway: input.pathway });
      }
      const origin = a.mediation?.origin ?? mediationOriginOf(a);
      if (input.pathway === "COURT_LEGAL_PATHWAY" && (origin === "COURT_REFERRED" || origin === "APPELLATE_REFERRAL")) createAuthorityNotification(db, a, "FAILURE_RETURN", record.recordId);
      a.stage = "SERVICE_DELIVERY";
      audit(db, a.audit, { actor: officer.officerId, role: "dlao", caseId: a.caseId ?? a.applicationId, action: "mediation.referral_confirmed", detail: { recordId: record.recordId, officer: officer.name, pathway: input.pathway, changed: input.changed, taskId: handoffTask.taskId } });
      return record;
    });
  },
};

export const CourtAuthorityService = {
  recordDispatch(applicationId: string, notificationId: string, dispatchReference: string, note: string) {
    const officer = DlaoAuth.current();
    if (!officer) throw new Error("Legal Aid Officer login required");
    return mutate((db) => {
      const a = db.applications.find((x) => x.applicationId === applicationId);
      if (!a || !officerCanSeeSettlement(a, officer)) throw new Error("Case is outside your office");
      const notification = a.mediation?.authorityNotifications?.find((x) => x.notificationId === notificationId);
      if (!notification) throw new Error("Unknown court authority notification");
      if (notification.status === "DEMO_RECORDED") return notification;
      if (dispatchReference.trim().length < 3) throw new Error("Record a dispatch reference");
      notification.status = "DEMO_RECORDED";
      notification.recordedSentAt = now();
      notification.recordedSentBy = officer.officerId;
      notification.recordedSentByName = officer.name;
      notification.dispatchReference = dispatchReference.trim();
      notification.note = note.trim() || null;
      const task = db.tasks.find((x) => x.taskId === notification.taskId);
      if (task) task.status = "DONE";
      audit(db, a.audit, { actor: officer.officerId, role: officerAuthorityRole(officer) === "CHIEF_LEGAL_AID_OFFICER" ? "clo" : "dlao", caseId: a.caseId ?? a.applicationId, action: "mediation.authority_notification_recorded", detail: { notificationId, kind: notification.kind, authority: notification.authority, simulated: true, dispatchReference: notification.dispatchReference } });
      a.version += 1;
      a.updatedAt = now();
      return notification;
    });
  },
};

export function useMediationFailureRecords() {
  const db = useDlasDb();
  const officer = useCurrentOfficer();
  return useMemo(() => db.applications.filter((a) => officerCanSeeSettlement(a, officer) && !!a.mediation?.workspace?.failureRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [db, officer]);
}

export function useMediationFailureRecord(applicationId: string) {
  const db = useDlasDb();
  const officer = useCurrentOfficer();
  const application = db.applications.find((a) => a.applicationId === applicationId && officerCanSeeSettlement(a, officer)) ?? null;
  return { officer, application, record: application?.mediation?.workspace?.failureRecord ?? null };
}
