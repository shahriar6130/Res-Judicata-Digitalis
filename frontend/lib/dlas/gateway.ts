/* ------------------------------------------------------------------ *
 *  IntakeGateway — the ONLY code that creates intake sessions,
 *  captures application fields, mints Application IDs and creates
 *  the first workflow tasks.
 *
 *  Every door calls the same functions:
 *
 *    startSession → (requestOtp → verifyOtp | verifyByNetwork | attestIdentity)
 *                 → capture(...)*  → confirm(...)*  → attachDocument(...)*
 *                 → setStep(...)   → submit()
 *
 *  submit() validates with the shared validator, mints APP-YYYY-NNNNN,
 *  writes ONE ApplicationRecord, opens human review tasks, queues a
 *  (simulated) confirmation SMS that respects the safe-contact rules,
 *  and mirrors a projection into the legacy helpline/DLAO store so the
 *  existing provider views see the same Application ID.
 *
 *  Nothing here decides eligibility or final priority — routing is
 *  advisory and `routing.humanDecision` stays null.
 * ------------------------------------------------------------------ */

import { mutate, readDb } from "./store";
import {
  SCHEMA_VERSION,
  emptyApplicationData,
  type ApplicationData,
  type ApplicationRecord,
  type AuditEntry,
  type CaptureMethod,
  type ChannelCode,
  type Confidence,
  type DeepPartial,
  type DlasDb,
  type DocumentRef,
  type IdentityMethod,
  type IntakeSession,
  type IntakeStep,
  type ProvenanceSource,
  type ProvenanceTag,
  type Task,
  type TaskType,
  type TranscriptLine,
  type ValidationResult,
} from "./schema";
import { validateApplication } from "./validate";
import { classifyIncident } from "./incident-taxonomy";
import { normalizePhone, officeFor, REQUIRED_DOCS } from "./reference";
import { legacyIdTaken, mirrorToLegacyStore } from "./legacy-bridge";

/* ---------------- small utils ---------------- */

const now = () => new Date().toISOString();
const rid = (prefix: string, n = 6) =>
  `${prefix}-${Math.random().toString(36).slice(2, 2 + n).toUpperCase().padEnd(n, "0")}`;
const addHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merge a patch into target, returning dotted leaf paths that changed. */
function mergeInto(target: Record<string, unknown>, patch: Record<string, unknown>, prefix = ""): string[] {
  const paths: string[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const path = prefix ? `${prefix}.${k}` : k;
    const cur = target[k];
    if (isPlainObject(v) && isPlainObject(cur)) {
      paths.push(...mergeInto(cur, v, path));
    } else {
      target[k] = structuredClone(v);
      paths.push(path);
    }
  }
  return paths;
}

function roleFor(source: ProvenanceSource): AuditEntry["role"] {
  switch (source) {
    case "REPRESENTATIVE_REPORTED":
      return "representative";
    case "OPERATOR_ENTERED":
      return "udc_operator";
    case "SYSTEM_DERIVED":
    case "AI_INFERRED":
      return "system";
    default:
      return "applicant";
  }
}

function confidenceFor(source: ProvenanceSource): Confidence {
  if (source === "APPLICANT_CONFIRMED") return "CONFIRMED";
  if (source === "AI_INFERRED") return "INFERRED";
  return "STATED";
}

function audit(
  db: DlasDb,
  list: AuditEntry[],
  entry: Omit<AuditEntry, "seq" | "at">,
): AuditEntry {
  db.counters.auditSeq += 1;
  const e: AuditEntry = { seq: db.counters.auditSeq, at: now(), ...entry };
  list.push(e);
  return e;
}

function findSession(db: DlasDb, sessionId: string): IntakeSession {
  const s = db.sessions.find((x) => x.sessionId === sessionId);
  if (!s) throw new Error(`Unknown intake session ${sessionId}`);
  return s;
}

function setStepInternal(s: IntakeSession, step: IntakeStep) {
  if (s.step === step) return;
  s.step = step;
  s.stepHistory.push({ step, at: now() });
}

function mintApplicationId(db: DlasDb): string {
  const year = new Date().getFullYear();
  let id = "";
  do {
    db.counters.application += 1;
    id = `APP-${year}-${String(30000 + db.counters.application)}`;
  } while (db.applications.some((a) => a.applicationId === id) || legacyIdTaken(id));
  return id;
}

/* ---------------- public API ---------------- */

export type CaptureTag = {
  source: ProvenanceSource;
  method: CaptureMethod;
  by: string;
  note?: string;
};

export type SubmitResult =
  | { ok: true; record: ApplicationRecord; duplicate: boolean }
  | { ok: false; validation: ValidationResult };

export const IntakeGateway = {
  /* ---------- session lifecycle ---------- */

  startSession(input: {
    channel: ChannelCode;
    entryPoint: string;
    simulated?: boolean;
    meta?: IntakeSession["meta"];
    actor?: string;
  }): IntakeSession {
    return mutate((db) => {
      const t = now();
      const s: IntakeSession = {
        sessionId: rid("SES"),
        channel: input.channel,
        entryPoint: input.entryPoint,
        simulated: input.simulated ?? false,
        step: "STARTED",
        stepHistory: [{ step: "STARTED", at: t }],
        identity: { phone: null, method: null, verified: false, verifiedAt: null, otpAttempts: 0 },
        meta: input.meta ?? {},
        draft: emptyApplicationData(),
        provenance: {},
        transcript: [],
        applicationId: null,
        lastValidation: null,
        audit: [],
        createdAt: t,
        updatedAt: t,
      };
      if (input.channel === "UDC_ASSISTED") {
        s.draft.filedBy = {
          kind: "UDC_OPERATOR",
          name: null,
          phone: null,
          relation: null,
          operatorId: input.meta?.operatorId ?? null,
          centre: input.meta?.centre ?? null,
        };
      }
      audit(db, s.audit, {
        actor: input.actor ?? "applicant",
        role: input.channel === "UDC_ASSISTED" ? "udc_operator" : "applicant",
        action: "session.started",
        detail: { channel: input.channel, entryPoint: input.entryPoint, simulated: s.simulated },
      });
      db.sessions.push(s);
      return s;
    });
  },

  /** The session a door opened for its own draft id (UDC temporaryId, etc.). */
  findSessionByClientRef(clientRef: string): IntakeSession | undefined {
    const all = readDb().sessions.filter((s) => s.meta.clientRef === clientRef);
    return all[all.length - 1];
  },

  /** Application ID already minted for a door's draft id, if any. */
  applicationIdForClientRef(clientRef: string): string | null {
    return readDb().applications.find((a) => a.channel.clientRef === clientRef)?.applicationId ?? null;
  },

  getSession(sessionId: string): IntakeSession | undefined {
    return readDb().sessions.find((s) => s.sessionId === sessionId);
  },

  abandon(sessionId: string, actor = "applicant"): void {
    mutate((db) => {
      const s = findSession(db, sessionId);
      if (s.step === "SUBMITTED") return;
      setStepInternal(s, "ABANDONED");
      audit(db, s.audit, { actor, role: "applicant", action: "session.abandoned" });
      s.updatedAt = now();
    });
  },

  setStep(sessionId: string, step: IntakeStep, actor = "applicant"): void {
    mutate((db) => {
      const s = findSession(db, sessionId);
      if (s.step === "SUBMITTED") return;
      const from = s.step;
      setStepInternal(s, step);
      if (from !== step) audit(db, s.audit, { actor, role: "system", action: "session.step", detail: { from, to: step } });
      s.updatedAt = now();
    });
  },

  /* ---------- identity ---------- */

  /** Sends a (simulated) SMS OTP. The code is visible in the SMS simulator / debug outbox. */
  requestOtp(sessionId: string, rawPhone: string): { ok: boolean; phone?: string; error?: string } {
    const phone = normalizePhone(rawPhone);
    if (!phone) return { ok: false, error: "INVALID_PHONE" };
    mutate((db) => {
      const s = findSession(db, sessionId);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      db.otp = db.otp.filter((o) => o.sessionId !== sessionId);
      db.otp.push({ sessionId, phone, code, expiresAt: addHours(0.25), consumed: false });
      db.outbox.push({
        msgId: rid("SMS"),
        kind: "SMS_OTP",
        to: phone,
        body: `Your one-time code is ${code}. Do not share it.`, // neutral wording
        sessionId,
        applicationId: null,
        simulated: true,
        status: "DELIVERED",
        at: now(),
      });
      s.identity.phone = phone;
      audit(db, s.audit, { actor: "system", role: "system", action: "identity.otp_sent", detail: { phone, gateway: "SIMULATED_SMS" } });
      s.updatedAt = now();
    });
    return { ok: true, phone };
  },

  verifyOtp(sessionId: string, code: string): { ok: boolean; error?: string; attemptsLeft?: number } {
    return mutate((db) => {
      const s = findSession(db, sessionId);
      const otp = db.otp.find((o) => o.sessionId === sessionId && !o.consumed);
      s.identity.otpAttempts += 1;
      const left = Math.max(0, 5 - s.identity.otpAttempts);
      if (!otp) return { ok: false, error: "NO_OTP_REQUESTED", attemptsLeft: left };
      if (new Date(otp.expiresAt).getTime() < Date.now()) return { ok: false, error: "OTP_EXPIRED", attemptsLeft: left };
      if (s.identity.otpAttempts > 5) {
        audit(db, s.audit, { actor: "system", role: "system", action: "identity.locked", detail: { reason: "too_many_attempts" } });
        return { ok: false, error: "TOO_MANY_ATTEMPTS", attemptsLeft: 0 };
      }
      if (otp.code !== code.trim()) {
        audit(db, s.audit, { actor: "applicant", role: "applicant", action: "identity.otp_failed", detail: { attemptsLeft: left } });
        return { ok: false, error: "WRONG_CODE", attemptsLeft: left };
      }
      otp.consumed = true;
      s.identity = { ...s.identity, method: "SMS_OTP", verified: true, verifiedAt: now() };
      setStepInternal(s, "IDENTITY_VERIFIED");
      audit(db, s.audit, { actor: "applicant", role: "applicant", action: "identity.verified", detail: { method: "SMS_OTP", phone: otp.phone } });
      s.updatedAt = now();
      return { ok: true };
    });
  },

  /** IVR caller-line id / USSD MSISDN — the mobile network vouches for the number (simulated). */
  verifyByNetwork(sessionId: string, rawPhone: string, method: Extract<IdentityMethod, "CALLER_LINE_ID" | "NETWORK_MSISDN">) {
    const phone = normalizePhone(rawPhone);
    if (!phone) return { ok: false as const, error: "INVALID_PHONE" };
    mutate((db) => {
      const s = findSession(db, sessionId);
      s.identity = { ...s.identity, phone, method, verified: true, verifiedAt: now() };
      setStepInternal(s, "IDENTITY_VERIFIED");
      audit(db, s.audit, { actor: "system", role: "system", action: "identity.verified", detail: { method, phone, simulated: true } });
      s.updatedAt = now();
    });
    return { ok: true as const, phone };
  },

  /** UDC: applicant has no own phone — operator attests identity in person. */
  attestIdentity(sessionId: string, operatorId: string, note: string) {
    mutate((db) => {
      const s = findSession(db, sessionId);
      s.identity = { ...s.identity, method: "OPERATOR_ATTESTED", verified: true, verifiedAt: now() };
      setStepInternal(s, "IDENTITY_VERIFIED");
      audit(db, s.audit, { actor: `udc:${operatorId}`, role: "udc_operator", action: "identity.attested", detail: { note } });
      s.updatedAt = now();
    });
  },

  /* ---------- data capture ---------- */

  /** Merge a partial ApplicationData into the draft and tag every changed field. */
  capture(
    sessionId: string,
    patch: DeepPartial<ApplicationData>,
    tag: CaptureTag,
    opts?: { step?: IntakeStep; transcript?: Omit<TranscriptLine, "at">[] },
  ): IntakeSession {
    return mutate((db) => {
      const s = findSession(db, sessionId);
      if (s.step === "SUBMITTED") throw new Error("Session already submitted — use a correction workflow");
      const paths = mergeInto(s.draft as unknown as Record<string, unknown>, patch as Record<string, unknown>);
      const pt: ProvenanceTag = {
        source: tag.source,
        method: tag.method,
        confidence: confidenceFor(tag.source),
        by: tag.by,
        at: now(),
        ...(tag.note ? { note: tag.note } : {}),
      };
      for (const p of paths) s.provenance[p] = pt;
      if (opts?.transcript) for (const l of opts.transcript) s.transcript.push({ ...l, at: now() });
      if (paths.length) {
        audit(db, s.audit, {
          actor: tag.by,
          role: roleFor(tag.source),
          action: "field.captured",
          detail: { paths, source: tag.source, method: tag.method },
        });
      }
      if (opts?.step) setStepInternal(s, opts.step);
      s.updatedAt = now();
      return s;
    });
  },

  /** Read-back confirmation: upgrade the given fields to APPLICANT_CONFIRMED. */
  confirm(sessionId: string, paths: string[], by: string, method: CaptureMethod): void {
    mutate((db) => {
      const s = findSession(db, sessionId);
      const t = now();
      for (const p of paths) {
        const prev = s.provenance[p];
        s.provenance[p] = {
          source: "APPLICANT_CONFIRMED",
          method,
          confidence: "CONFIRMED",
          by,
          at: t,
          note: prev ? `read back; originally ${prev.source} via ${prev.method}` : "read back",
        };
      }
      audit(db, s.audit, { actor: by, role: "applicant", action: "field.confirmed", detail: { paths, method } });
      s.updatedAt = t;
    });
  },

  transcript(sessionId: string, lines: Omit<TranscriptLine, "at">[]): void {
    mutate((db) => {
      const s = findSession(db, sessionId);
      for (const l of lines) s.transcript.push({ ...l, at: now() });
      s.updatedAt = now();
    });
  },

  /** Attach or replace a document reference (bytes are hashed, not stored). */
  attachDocument(sessionId: string, doc: DocumentRef, tag: CaptureTag): void {
    mutate((db) => {
      const s = findSession(db, sessionId);
      const i = s.draft.documents.findIndex((d) => d.docId === doc.docId || (d.type === doc.type && d.status !== "ATTACHED"));
      if (i >= 0) s.draft.documents[i] = doc;
      else s.draft.documents.push(doc);
      s.provenance[`documents.${doc.docId}`] = {
        source: tag.source,
        method: tag.method,
        confidence: confidenceFor(tag.source),
        by: tag.by,
        at: now(),
      };
      audit(db, s.audit, {
        actor: tag.by,
        role: roleFor(tag.source),
        action: doc.status === "ATTACHED" ? "document.attached" : "document.deferred",
        detail: { docId: doc.docId, type: doc.type, status: doc.status, sha256: doc.sha256 },
      });
      s.updatedAt = now();
    });
  },

  removeDocument(sessionId: string, docId: string, by: string): void {
    mutate((db) => {
      const s = findSession(db, sessionId);
      s.draft.documents = s.draft.documents.filter((d) => d.docId !== docId);
      delete s.provenance[`documents.${docId}`];
      audit(db, s.audit, { actor: by, role: "applicant", action: "document.removed", detail: { docId } });
      s.updatedAt = now();
    });
  },

  /** Ensure every required document for the matter has an entry (defaults to WILL_SUBMIT_LATER). */
  ensureChecklist(sessionId: string, tag: CaptureTag): void {
    const s = IntakeGateway.getSession(sessionId);
    const cat = s?.draft.matter.category;
    if (!s || !cat) return;
    if (s.draft.applicant.identityDocumentUnavailable) {
      for (const doc of s.draft.documents.filter((item) => item.type === "NID" && item.status !== "ATTACHED")) {
        IntakeGateway.removeDocument(sessionId, doc.docId, tag.by);
      }
    }
    for (const type of REQUIRED_DOCS[cat]) {
      if (type === "NID" && s.draft.applicant.identityDocumentUnavailable) continue;
      if (s.draft.documents.some((d) => d.type === type)) continue;
      IntakeGateway.attachDocument(
        sessionId,
        {
          docId: rid("DOC"),
          type,
          status: "WILL_SUBMIT_LATER",
          fileName: null,
          mimeType: null,
          sizeBytes: null,
          sha256: null,
          sensitive: false,
          qualityNote: null,
        },
        tag,
      );
    }
  },

  validate(sessionId: string): ValidationResult {
    return mutate((db) => {
      const s = findSession(db, sessionId);
      const v = validateApplication(s.draft, s.identity, s.channel);
      s.lastValidation = v;
      return v;
    });
  },

  /* ---------- submission ---------- */

  submit(sessionId: string, actor = "applicant", opts?: { allowIncomplete?: boolean; clientRef?: string; mirror?: boolean }): SubmitResult {
    const result = mutate((db): SubmitResult => {
      const s = findSession(db, sessionId);

      // Idempotency: a session submits once; a clientRef (offline temp id) maps to one record.
      if (s.applicationId) {
        const existing = db.applications.find((a) => a.applicationId === s.applicationId)!;
        return { ok: true, record: existing, duplicate: true };
      }
      if (opts?.clientRef) {
        const existing = db.applications.find((a) => a.channel.clientRef === opts.clientRef);
        if (existing) return { ok: true, record: existing, duplicate: true };
      }

      const validation = validateApplication(s.draft, s.identity, s.channel);
      s.lastValidation = validation;
      if (!validation.valid && !opts?.allowIncomplete) {
        audit(db, s.audit, { actor, role: "system", action: "submit.rejected_invalid", detail: { missing: validation.missing } });
        s.updatedAt = now();
        return { ok: false, validation };
      }

      const t = now();
      const applicationId = mintApplicationId(db);
      const d = s.draft;

      // Advisory routing — a recommendation, never a decision.
      const reasons: string[] = [];
      let priority: "NORMAL" | "HIGH" | "URGENT" = "NORMAL";
      // Rule-based incident category from the applicant's own words (no question to the citizen).
      const incident = classifyIncident({ matter: d.matter.category, summary: d.matter.summary }, now());
      if (incident.red) {
        priority = "URGENT";
        reasons.push(`RED FLAG (rule): ${incident.rule}`);
      }
      if (priority === "URGENT") {
        /* already urgent by rule */
      } else if (d.urgency.flags.includes("IMMEDIATE_DANGER") || d.urgency.flags.includes("DETENTION")) {
        priority = "URGENT";
        reasons.push("Applicant reports immediate danger / detention");
      } else if (d.urgency.flags.length || d.urgency.selfReportedUrgent) {
        priority = "HIGH";
        reasons.push(`Urgency flags: ${d.urgency.flags.join(", ") || "self-reported"}`);
      }
      if ((d.matter.category === "VIOLENCE" || d.matter.category === "CYBER_HARASSMENT") && priority === "NORMAL") {
        priority = "HIGH";
        reasons.push(`Matter category ${d.matter.category} is safety-sensitive`);
      }
      if (!reasons.length) reasons.push("No urgency signals");

      const office = officeFor(d.applicant.district);
      const captureMethod: CaptureMethod =
        s.channel === "IVR_16699" ? "IVR_DTMF" : s.channel === "USSD" ? "USSD_MENU" : s.channel === "UDC_ASSISTED" ? "OPERATOR_FORM" : s.channel === "HELPLINE_AGENT" ? "AGENT_FORM" : "WEB_FORM";

      // Office routing is system-derived — tag it.
      const provenance = { ...s.provenance };
      provenance["routing.office"] = { source: "SYSTEM_DERIVED", method: "SYSTEM", confidence: "STATED", by: "system", at: t, note: "from applicant.district" };

      const record: ApplicationRecord = {
        schemaVersion: SCHEMA_VERSION,
        applicationId,
        caseId: null,
        status: "SUBMITTED",
        stage: "ACCESS_APPLICATION",
        channel: {
          code: s.channel,
          captureMethod,
          sessionId: s.sessionId,
          entryPoint: s.entryPoint,
          simulated: s.simulated,
          clientRef: opts?.clientRef ?? null,
        },
        identity: { ...s.identity },
        data: structuredClone(d),
        provenance,
        validation,
        routing: { office, recommendedPriority: priority, reasons, advisoryOnly: true, humanDecision: null },
        taskIds: [],
        audit: [],
        review: null,
        lawyer: null,
        staffCheck: null,
        pathwayClassification: null,
        incident,
        mediation: null,
        aiTriage: s.aiTriage ?? [],
        agentHandoff: s.agentHandoff ?? null,
        closedAt: null,
        version: 1,
        createdAt: s.createdAt,
        submittedAt: t,
        updatedAt: t,
      };

      // Carry the session's history onto the record so the audit trail starts at the door.
      for (const e of s.audit) record.audit.push({ ...e });
      audit(db, record.audit, {
        actor,
        role: roleFor(s.provenance["applicant.fullName"]?.source ?? "APPLICANT_STATED"),
        action: "application.submitted",
        detail: { applicationId, channel: s.channel, sessionId: s.sessionId, valid: validation.valid },
      });
      audit(db, record.audit, { actor: "system", role: "system", action: incident.red ? "incident.red_flagged" : "incident.classified", detail: { category: incident.category, subcategory: incident.subcategory, rule: incident.rule, keywords: incident.matched.map((m) => m.keyword), rulesVersion: incident.rulesVersion } });

      // ---- workflow tasks (humans decide) ----
      const mkTask = (type: TaskType, reason: string, hours: number, p: Task["priority"], role: Task["assignedRole"] = "DLAO"): Task => ({
        taskId: rid("TSK"),
        type,
        applicationId,
        sessionId: s.sessionId,
        assignedRole: role,
        office,
        status: "OPEN",
        priority: p,
        reason,
        dueAt: addHours(hours),
        createdAt: t,
      });
      const tasks: Task[] = [
        mkTask("ELIGIBILITY_REVIEW", "New application — eligibility decision by authorised officer", priority === "NORMAL" ? 72 : 24, priority),
      ];
      if (priority === "URGENT" || d.urgency.flags.length) {
        tasks.push(mkTask("URGENT_SAFETY_REVIEW", reasons.join("; "), priority === "URGENT" ? 4 : 24, priority === "URGENT" ? "URGENT" : "HIGH"));
      }
      if (!validation.valid) {
        tasks.push({ ...mkTask("COMPLETE_MISSING_INFO", `Missing: ${validation.missing.join(", ")}`, 48, "NORMAL"), context: { missing: validation.missing } });
      }
      const pendingDocs = d.documents.filter((x) => x.status !== "ATTACHED");
      if (pendingDocs.length) {
        tasks.push({ ...mkTask("DOCUMENT_FOLLOW_UP", `${pendingDocs.length} document(s) pending`, 168, "NORMAL"), context: { docs: pendingDocs.map((x) => x.type) } });
      }
      if (d.applicant.identityDocumentUnavailable) {
        tasks.push({
          ...mkTask(
            "LOCAL_IDENTITY_VERIFICATION",
            "Applicant has no necessary identity document — sent to a local government representative for identity verification",
            72,
            "HIGH",
            "LOCAL_GOVT_REPRESENTATIVE",
          ),
          status: "IN_PROGRESS",
          context: {
            verificationStatus: "SENT_TO_LOCAL_GOVT_REPRESENTATIVE",
            district: d.applicant.district,
            requestedAt: t,
          },
        });
      }
      if (d.filedBy.kind === "REPRESENTATIVE") {
        tasks.push({
          ...mkTask("HUMAN_CALLBACK", "Filed by representative — reach applicant on safe channel to confirm", 72, "NORMAL", "HELPLINE_AGENT"),
          context: { representative: d.filedBy.name, relation: d.filedBy.relation },
        });
      }
      for (const task of tasks) {
        db.tasks.push(task);
        record.taskIds.push(task.taskId);
        audit(db, record.audit, { actor: "system", role: "system", action: "task.created", detail: { taskId: task.taskId, type: task.type, assignedRole: task.assignedRole, dueAt: task.dueAt } });
      }

      // ---- confirmation SMS (simulated), obeying safe-contact rules ----
      const smsTo = normalizePhone(d.safeContact.phone) ?? normalizePhone(d.applicant.phone);
      if (smsTo) {
        const allowed = d.safeContact.smsAllowed;
        const body = d.safeContact.neutralWordingRequired
          ? `Your reference number is ${applicationId}. Keep it safe.`
          : `DLAS legal aid: application ${applicationId} received. The office will contact you. Service is free.`;
        db.outbox.push({
          msgId: rid("SMS"),
          kind: "SMS_CONFIRMATION",
          to: smsTo,
          body,
          sessionId: s.sessionId,
          applicationId,
          simulated: true,
          status: allowed ? "DELIVERED" : "SUPPRESSED_UNSAFE",
          at: t,
        });
        audit(db, record.audit, {
          actor: "system",
          role: "system",
          action: allowed ? "notice.sms_sent" : "notice.sms_suppressed",
          detail: { to: smsTo, neutral: d.safeContact.neutralWordingRequired, reason: allowed ? undefined : "applicant did not allow SMS" },
        });
      }

      db.applications.push(record);
      s.applicationId = applicationId;
      setStepInternal(s, "SUBMITTED");
      audit(db, s.audit, { actor, role: "system", action: "session.submitted", detail: { applicationId } });
      s.updatedAt = t;
      return { ok: true, record, duplicate: false };
    });

    if (result.ok && !result.duplicate && opts?.mirror !== false) {
      try {
        mirrorToLegacyStore(result.record);
      } catch {
        // Legacy mirror is best-effort; the canonical record is already saved.
      }
    }
    return result;
  },

  /**
   * One-shot ingest used by older flows (legacy citizen wizard, UDC offline
   * sync, helpline agent). Creates a session, captures data, submits with
   * allowIncomplete so gaps become a COMPLETE_MISSING_INFO task — never lost.
   */
  ingest(input: {
    channel: ChannelCode;
    entryPoint: string;
    simulated?: boolean;
    data: DeepPartial<ApplicationData>;
    tag: CaptureTag;
    identity?: { phone: string | null; method: IdentityMethod; verified: boolean };
    clientRef?: string;
    mirror?: boolean;
    meta?: IntakeSession["meta"];
  }): SubmitResult {
    if (input.clientRef) {
      const existing = readDb().applications.find((a) => a.channel.clientRef === input.clientRef);
      if (existing) return { ok: true, record: existing, duplicate: true };
    }
    const s = IntakeGateway.startSession({
      channel: input.channel,
      entryPoint: input.entryPoint,
      simulated: input.simulated,
      meta: input.meta,
      actor: input.tag.by,
    });
    if (input.identity) {
      const id = input.identity;
      mutate((db) => {
        const ss = findSession(db, s.sessionId);
        ss.identity = { ...ss.identity, phone: normalizePhone(id.phone), method: id.method, verified: id.verified, verifiedAt: id.verified ? now() : null };
        if (id.verified) setStepInternal(ss, "IDENTITY_VERIFIED");
      });
    }
    IntakeGateway.capture(s.sessionId, input.data, input.tag, { step: "REVIEWED" });
    return IntakeGateway.submit(s.sessionId, input.tag.by, {
      allowIncomplete: true,
      clientRef: input.clientRef,
      mirror: input.mirror,
    });
  },

  /** Caller asks for a person (IVR 0 / USSD 0) — creates a real human callback task. */
  requestCallback(sessionId: string, reason: string): Task {
    return mutate((db) => {
      const s = findSession(db, sessionId);
      const task: Task = {
        taskId: rid("TSK"),
        type: "HUMAN_CALLBACK",
        applicationId: s.applicationId,
        sessionId,
        assignedRole: "HELPLINE_AGENT",
        office: officeFor(s.draft.applicant.district),
        status: "OPEN",
        priority: s.draft.urgency.selfReportedUrgent ? "URGENT" : "NORMAL",
        reason,
        dueAt: addHours(s.draft.urgency.selfReportedUrgent ? 1 : 24),
        createdAt: now(),
        context: { phone: s.identity.phone, step: s.step, transcriptLines: s.transcript.length },
      };
      db.tasks.push(task);
      audit(db, s.audit, { actor: "applicant", role: "applicant", action: "handoff.requested", detail: { taskId: task.taskId, reason } });
      s.updatedAt = now();
      return task;
    });
  },

  /* ---------- lookups ---------- */

  getApplication(applicationId: string): ApplicationRecord | undefined {
    return readDb().applications.find((a) => a.applicationId === applicationId);
  },
};

export type { ProvenanceTag };
