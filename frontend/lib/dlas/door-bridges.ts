/* ------------------------------------------------------------------ *
 *  Door bridges — connect the team's EXISTING intake screens to the
 *  canonical shared record, without replacing their UI:
 *
 *    CitizenDoor → components/assisted-intake.tsx   (/dashboard/citizen#intake)
 *    UdcDoor     → components/udc/panels/new-intake + intake-workspace
 *                  (/dashboard/udc/intake/new → /dashboard/udc/intake/[temporaryId])
 *
 *  Each screen keeps its own local state; at every step it hands its
 *  data to the bridge, which maps it onto the SAME ApplicationData
 *  shape (and provenance) that IVR and USSD produce, through
 *  IntakeGateway. /debug therefore shows every door at every step.
 * ------------------------------------------------------------------ */

import { IntakeGateway, type CaptureTag, type SubmitResult } from "./gateway";
import { CitizenAuth } from "./citizen-auth";
import { FileStore } from "./files";
import { mapLegacyDistrict, mapLegacyMatter } from "./legacy-bridge";
import { bucketForTime, normalizePhone, SENSITIVE_DOC_TYPES } from "./reference";
import type {
  ContactMethod,
  DayCode,
  DeepPartial,
  ApplicationData,
  DocType,
  IntakeStep,
  LanguageCode,
  Relation,
  SafeTime,
} from "./schema";

/* ================================================================== *
 *  Citizen door (existing 5-step wizard)
 * ================================================================== */

/** Structural copy of lib/intake-store IntakeDraft (kept loose to avoid a UI import). */
export interface CitizenDraftLike {
  name: string;
  phone: string;
  actingFor: "self" | "family" | "neighbor" | null;
  proxyRel: string;
  proxyName: string;
  proxyPhone: string;
  nidNumber?: string;
  matter: string | null;
  partyName: string;
  partyAddress: string;
  description: string;
  documents: { id: string; name: string; mimeType: string; size: number; dataUrl: string }[];
  contactSlot: "anytime" | "custom" | null;
  contactDay: DayCode | "";
  contactTime: string;
  specialInstructions: string;
  consentOk: boolean;
}

const CITIZEN_KEY = "dlas.active.WEB_PORTAL";
const CITIZEN_ENTRY = "/dashboard/citizen#intake";


function mapRelation(text: string, actingFor: CitizenDraftLike["actingFor"]): Relation {
  if (actingFor === "neighbor") return "NEIGHBOUR";
  const t = text.toLowerCase();
  if (/ভাই|বোন|brother|sister|sibling/.test(t)) return "SIBLING";
  if (/স্বামী|স্ত্রী|husband|wife|spouse/.test(t)) return "SPOUSE";
  if (/মা|বাবা|mother|father|parent/.test(t)) return "PARENT";
  if (/ছেলে|মেয়ে|son|daughter|child/.test(t)) return "CHILD";
  return t.trim() ? "OTHER_RELATIVE" : "OTHER_RELATIVE";
}

function readKey(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeKey(key: string, v: string | null) {
  try {
    if (v) window.localStorage.setItem(key, v);
    else window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export function mapCitizenDraft(d: CitizenDraftLike, district: string | null): DeepPartial<ApplicationData> {
  const rep = d.actingFor === "family" || d.actingFor === "neighbor";
  const applicantPhone = normalizePhone(rep ? d.proxyPhone : d.phone);
  const method: ContactMethod = rep && !applicantPhone ? "VIA_REPRESENTATIVE" : "CALL";
  return {
    applicant: rep
      ? { fullName: d.proxyName.trim() || null, phone: applicantPhone, phoneOwnedByApplicant: applicantPhone ? true : null, district: mapLegacyDistrict(district), nidNumber: d.nidNumber?.trim() || null }
      : { fullName: d.name.trim() || null, phone: applicantPhone, phoneOwnedByApplicant: true, district: mapLegacyDistrict(district), nidNumber: d.nidNumber?.trim() || null },
    filedBy: rep
      ? { kind: "REPRESENTATIVE", name: d.name.trim() || null, phone: normalizePhone(d.phone), relation: mapRelation(d.proxyRel, d.actingFor), operatorId: null, centre: null }
      : { kind: "SELF", name: null, phone: null, relation: null, operatorId: null, centre: null },
    matter: {
      category: mapLegacyMatter(d.matter),
      summary: d.description.trim() || null,
      opposingParty: [d.partyName.trim(), d.partyAddress.trim()].filter(Boolean).join(", ") || null,
    },
    safeContact: {
      method,
      phone: method === "VIA_REPRESENTATIVE" ? normalizePhone(d.phone) : applicantPhone,
      safeTime: d.contactSlot === "anytime" ? "ANYTIME" : d.contactSlot === "custom" && d.contactTime ? bucketForTime(d.contactTime) : null,
      window: d.contactSlot === "custom" && d.contactDay && d.contactTime ? { day: d.contactDay, time: d.contactTime } : null,
      smsAllowed: true,
      voicemailAllowed: false,
      neutralWordingRequired: true,
      notes: d.specialInstructions.trim() || null,
    },
  };
}

async function hashDataUrl(dataUrl: string): Promise<string | null> {
  try {
    const bytes = await (await fetch(dataUrl)).arrayBuffer();
    const h = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export const CitizenDoor = {
  /** Current session for the wizard (creates one if needed). */
  ensure(lang: "bn" | "en" = "bn"): string {
    const existing = readKey(CITIZEN_KEY);
    const s = existing ? IntakeGateway.getSession(existing) : undefined;
    const citizenId = CitizenAuth.current()?.citizenId;
    // Resume only this account's unfinished session.
    if (s && s.step !== "SUBMITTED" && s.step !== "ABANDONED" && s.meta.citizenId === citizenId) return s.sessionId;
    const fresh = IntakeGateway.startSession({ channel: "WEB_PORTAL", entryPoint: CITIZEN_ENTRY, meta: { lang, ...(citizenId ? { citizenId } : {}) } });
    writeKey(CITIZEN_KEY, fresh.sessionId);
    return fresh.sessionId;
  },

  current() {
    const id = readKey(CITIZEN_KEY);
    return id ? IntakeGateway.getSession(id) : undefined;
  },

  requestOtp(phone: string) {
    return IntakeGateway.requestOtp(CitizenDoor.ensure(), phone);
  },

  verifyOtp(code: string) {
    return IntakeGateway.verifyOtp(CitizenDoor.ensure(), code);
  },

  /** Called when the wizard moves past `completedStep` (1–5). */
  sync(d: CitizenDraftLike, district: string | null, completedStep: number) {
    const sid = CitizenDoor.ensure();
    const tag: CaptureTag =
      d.actingFor === "family" || d.actingFor === "neighbor"
        ? { source: "REPRESENTATIVE_REPORTED", method: "WEB_FORM", by: `rep:${normalizePhone(d.phone) ?? "unknown"}` }
        : { source: "APPLICANT_STATED", method: "WEB_FORM", by: "applicant" };
    const step: IntakeStep | undefined = completedStep >= 4 ? "DOCUMENTS_ATTACHED" : completedStep >= 3 ? "DETAILS_CAPTURED" : undefined;
    IntakeGateway.capture(sid, mapCitizenDraft(d, district), tag, { step });
    return sid;
  },

  /** Final submit from step 5. Returns the gateway result (errors are shown by the wizard). */
  async submit(d: CitizenDraftLike, district: string | null): Promise<SubmitResult> {
    const rep = d.actingFor === "family" || d.actingFor === "neighbor";
    const by = rep ? `rep:${normalizePhone(d.phone) ?? "unknown"}` : "applicant";
    const tag: CaptureTag = rep
      ? { source: "REPRESENTATIVE_REPORTED", method: "WEB_FORM", by }
      : { source: "APPLICANT_STATED", method: "WEB_FORM", by };
    const sid = CitizenDoor.sync(d, district, 5);

    // Documents: metadata + SHA-256 of the bytes (bytes stay in the wizard's own draft store).
    const session = IntakeGateway.getSession(sid);
    for (const doc of d.documents) {
      if (session?.draft.documents.some((x) => x.docId === `DOC-${doc.id}`)) continue;
      IntakeGateway.attachDocument(
        sid,
        {
          docId: `DOC-${doc.id}`,
          type: "OTHER",
          status: "ATTACHED",
          fileName: doc.name,
          mimeType: doc.mimeType || null,
          sizeBytes: doc.size,
          sha256: await hashDataUrl(doc.dataUrl),
          sensitive: false,
          qualityNote: null,
          preview: await FileStore.put(`DOC-${doc.id}`, doc.dataUrl, doc.mimeType || "application/octet-stream"),
        },
        tag,
      );
    }
    IntakeGateway.ensureChecklist(sid, { source: "SYSTEM_DERIVED", method: "SYSTEM", by: "system", note: "checklist for matter" });

    IntakeGateway.capture(
      sid,
      {
        consent: {
          dataProcessing: d.consentOk,
          contactOnSafeChannel: d.consentOk,
          shareWithAssignedProviders: d.consentOk,
          method: d.consentOk ? "WEB_CHECKBOX" : null,
          readBackConfirmed: d.consentOk,
          recordedAt: new Date().toISOString(),
        },
      },
      tag,
    );
    // The applicant saw everything on screen and ticked consent → their own statements become confirmed.
    if (!rep && d.consentOk) {
      const s = IntakeGateway.getSession(sid);
      const paths = Object.entries(s?.provenance ?? {})
        .filter(([, p]) => p.source === "APPLICANT_STATED")
        .map(([k]) => k);
      if (paths.length) IntakeGateway.confirm(sid, paths, "applicant", "WEB_FORM");
    }
    IntakeGateway.setStep(sid, "REVIEWED", by);
    const r = IntakeGateway.submit(sid, by);
    if (r.ok) writeKey(CITIZEN_KEY, null);
    return r;
  },

  reset() {
    const s = CitizenDoor.current();
    if (s && s.step !== "SUBMITTED") IntakeGateway.abandon(s.sessionId);
    writeKey(CITIZEN_KEY, null);
  },
};

/* ================================================================== *
 *  UDC door (existing new-intake + workspace)
 * ================================================================== */

const UDC_ENTRY = "/dashboard/udc/intake";

const CONTACT_KIND_TO_METHOD: Record<string, ContactMethod> = {
  applicant_controlled_phone: "CALL",
  trusted_contact: "CALL",
  safe_scheduled_contact: "CALL",
  temporary_udc_number: "CALL",
  voice_16699_status: "CALL",
  dlao_follow_up: "VISIT_OFFICE",
  no_safe_phone: "VISIT_OFFICE",
};

const CHECKLIST_TO_DOC: Record<string, DocType> = {
  national_id: "NID",
  marriage_proof: "MARRIAGE_CERT",
  incident_evidence: "EVIDENCE_SCREENSHOT",
  deed: "LAND_DEED",
  tax_receipt: "OTHER",
  employer_letter: "EMPLOYMENT_PROOF",
  fir_copy: "POLICE_REPORT",
};

function udcLang(v: string): LanguageCode {
  return v === "bn" || v === "en" || v === "marma" ? v : "other";
}

export interface UdcStartInput {
  temporaryId: string;
  operatorId: string;
  centre: string;
  applicantName: string;
  district: string;
  matterType: string;
  primaryLanguage: string;
  interpreterName: string;
  contactKind: string;
  contactValue: string;
  safeTime: SafeTime | null;
  summaryOriginal: string;
  summaryBangla: string;
  freeNoticeAck: boolean;
  lang: "bn" | "en";
  nidNumber?: string;
}

export interface UdcConsentLike {
  topic: string;
  applicantResponse: "yes" | "no" | "ask_again";
  method: string;
}

export interface UdcCaptureLike {
  id: string;
  checklistItemId: string;
  bytes: number;
  sensitivity: "public" | "restricted";
  documentType: { bn: string; en: string };
  qualityFindings: { code: string; severity: "warn" | "block"; message: { en: string } }[];
}

function udcTag(operatorId: string, note?: string): CaptureTag {
  return { source: "OPERATOR_ENTERED", method: "OPERATOR_FORM", by: `udc:${operatorId}`, ...(note ? { note } : {}) };
}

export const UdcDoor = {
  /** "Start intake" on /dashboard/udc/intake/new. Idempotent per temporaryId. */
  start(i: UdcStartInput): string {
    let s = IntakeGateway.findSessionByClientRef(i.temporaryId);
    if (!s) {
      s = IntakeGateway.startSession({
        channel: "UDC_ASSISTED",
        entryPoint: `${UDC_ENTRY}/new`,
        meta: { operatorId: i.operatorId, centre: i.centre, clientRef: i.temporaryId, lang: i.lang },
        actor: `udc:${i.operatorId}`,
      });
      // The applicant is present at the UDC; the operator attests identity (no applicant OTP in this door).
      IntakeGateway.attestIdentity(s.sessionId, i.operatorId, "Applicant present at UDC");
    }
    const lang = udcLang(i.primaryLanguage);
    const translated = lang !== "bn";
    const phone = normalizePhone(i.contactValue);
    const method = CONTACT_KIND_TO_METHOD[i.contactKind] ?? "CALL";
    IntakeGateway.capture(
      s.sessionId,
      {
        applicant: {
          fullName: i.applicantName.trim() || null,
          district: mapLegacyDistrict(i.district),
          preferredLanguage: lang,
          phone,
          phoneOwnedByApplicant: i.contactKind === "applicant_controlled_phone" ? true : phone ? false : null,
          nidNumber: i.nidNumber?.trim() || null,
        },
        filedBy: { kind: "UDC_OPERATOR", name: null, phone: null, relation: null, operatorId: i.operatorId, centre: i.centre },
        matter: {
          category: mapLegacyMatter(i.matterType),
          summary: (translated ? i.summaryBangla : i.summaryOriginal || i.summaryBangla).trim() || null,
          summaryOriginal: translated ? i.summaryOriginal.trim() || null : null,
          translation: translated ? { from: lang, to: "bn", by: i.interpreterName || `udc:${i.operatorId}`, method: "HUMAN_INTERPRETER" } : null,
        },
        safeContact: {
          method,
          phone: method === "CALL" ? phone : null,
          safeTime: i.safeTime,
          smsAllowed: false,
          voicemailAllowed: false,
          neutralWordingRequired: true,
          notes: `contact route: ${i.contactKind}`,
        },
        freeServiceNoticeAcknowledged: i.freeNoticeAck,
      },
      udcTag(i.operatorId, translated ? `interpreter: ${i.interpreterName}` : undefined),
      { step: "DETAILS_CAPTURED" },
    );
    return s.sessionId;
  },

  sessionFor(temporaryId: string) {
    return IntakeGateway.findSessionByClientRef(temporaryId);
  },

  /** Consent checkboxes + free-service notice in the workspace. */
  syncConsents(temporaryId: string, consents: UdcConsentLike[], freeNotice: boolean) {
    const s = IntakeGateway.findSessionByClientRef(temporaryId);
    if (!s || s.step === "SUBMITTED") return;
    const yes = (t: string) => consents.some((c) => c.topic === t && c.applicantResponse === "yes");
    IntakeGateway.capture(
      s.sessionId,
      {
        consent: {
          dataProcessing: yes("submission_to_dlas"),
          contactOnSafeChannel: yes("safe_future_contact"),
          shareWithAssignedProviders: yes("submission_to_dlas"),
          method: consents.length ? "UDC_VERBAL_READBACK" : null,
          readBackConfirmed: consents.some((c) => c.method === "oral_with_readback" && c.applicantResponse === "yes"),
          recordedAt: new Date().toISOString(),
        },
        freeServiceNoticeAcknowledged: freeNotice || s.draft.freeServiceNoticeAcknowledged,
      },
      udcTag(s.meta.operatorId ?? "udc", "consent obtained orally with read-back"),
    );
  },

  /** Interpreter-recorded field (the workspace's translation chain). */
  syncTranslation(temporaryId: string, field: string, original: string, translated: string, interpreter: string | undefined) {
    const s = IntakeGateway.findSessionByClientRef(temporaryId);
    if (!s || s.step === "SUBMITTED") return;
    const note = `interpreted by ${interpreter ?? "—"}; original: ${original}`;
    const tag = udcTag(s.meta.operatorId ?? "udc", note);
    if (field === "applicant_name") {
      IntakeGateway.capture(s.sessionId, { applicant: { fullName: translated } }, tag);
    } else if (field === "problem") {
      const from = s.draft.applicant.preferredLanguage ?? "other";
      IntakeGateway.capture(
        s.sessionId,
        { matter: { summaryOriginal: original, summary: translated, translation: { from, to: "bn", by: interpreter ?? `udc:${s.meta.operatorId}`, method: "HUMAN_INTERPRETER" } } },
        tag,
      );
    } else if (field === "incident_date") {
      IntakeGateway.capture(s.sessionId, { matter: { incidentDate: translated } }, tag);
    } else {
      IntakeGateway.transcript(s.sessionId, [{ from: "USER", text: `${field}: ${original} → ${translated} (${note})` }]);
    }
  },

  /** Document captured by the UDC camera flow. */
  syncDocument(temporaryId: string, c: UdcCaptureLike, file?: { name: string; type: string }, preview?: "STORED" | "TOO_LARGE" | "NONE") {
    const s = IntakeGateway.findSessionByClientRef(temporaryId);
    if (!s || s.step === "SUBMITTED") return;
    const type = CHECKLIST_TO_DOC[c.checklistItemId] ?? "OTHER";
    const quality = c.qualityFindings.map((f) => `${f.severity}: ${f.message.en}`).join("; ");
    IntakeGateway.attachDocument(
      s.sessionId,
      {
        docId: `DOC-${c.id}`,
        type,
        status: "ATTACHED",
        fileName: file?.name ?? c.documentType.en,
        mimeType: file?.type || null,
        sizeBytes: c.bytes,
        sha256: null,
        sensitive: c.sensitivity === "restricted" || SENSITIVE_DOC_TYPES.includes(type),
        qualityNote: quality || null,
        preview: preview ?? "NONE",
      },
      udcTag(s.meta.operatorId ?? "udc"),
    );
    IntakeGateway.setStep(s.sessionId, "DOCUMENTS_ATTACHED");
  },

  /**
   * "Save + queue for sync" in the workspace: submit to the shared record first,
   * so the offline sync reuses the SAME Application ID. Seeded demo intakes that
   * never went through "new intake" are adopted from `fallback`. Missing fields
   * do not block the UDC (the applicant may have travelled far): the record is
   * created with validation gaps and a COMPLETE_MISSING_INFO task for the DLAO.
   */
  submit(temporaryId: string, fallback?: UdcStartInput): SubmitResult | { ok: false; notStarted: true } {
    let s = IntakeGateway.findSessionByClientRef(temporaryId);
    if (!s && fallback) {
      UdcDoor.start(fallback);
      s = IntakeGateway.findSessionByClientRef(temporaryId);
    }
    if (!s) return { ok: false, notStarted: true };
    const by = `udc:${s.meta.operatorId ?? "udc"}`;
    IntakeGateway.ensureChecklist(s.sessionId, { source: "SYSTEM_DERIVED", method: "SYSTEM", by: "system", note: "checklist for matter" });
    IntakeGateway.setStep(s.sessionId, "REVIEWED", by);
    return IntakeGateway.submit(s.sessionId, by, { clientRef: temporaryId, allowIncomplete: true });
  },
};
