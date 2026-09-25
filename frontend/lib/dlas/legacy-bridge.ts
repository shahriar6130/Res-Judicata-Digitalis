/* ------------------------------------------------------------------ *
 *  Bridge between the canonical DLAS record (`dlas.db.v1`) and the
 *  older helpline/DLAO store (`shakkho.helpline.v1`).
 *
 *  - mirrorToLegacyStore(record): writes a read-only projection into
 *    `shakkho.helpline.v1.records` so existing helpline look-up and
 *    DLAO views see the SAME Application ID. The canonical JSON stays
 *    in dlas.db.v1; the projection is never edited back.
 *  - legacyIdTaken(id): prevents minting an ID the seed data already uses.
 * ------------------------------------------------------------------ */

import { STORE_KEY as LEGACY_KEY, read as readLegacy, write as writeLegacy } from "../shakkho/persistence";
import { seedDemoData } from "../shakkho/seed";
import type {
  ApplicationRecord as LegacyRecord,
  ProvenanceSource as LegacySource,
  SlotKey,
  SlotValue,
} from "../shakkho/types";
import type { ApplicationRecord, ChannelCode, DistrictCode, MatterCategory, ProvenanceTag } from "./schema";
import { IntakeGateway } from "./gateway";
import { UdcAuth } from "./udc-auth";
import { DISTRICTS, MATTERS, SAFE_TIMES } from "./reference";

export function legacyIdTaken(id: string): boolean {
  try {
    return readLegacy().records.some((r) => r.applicationId === id);
  } catch {
    return false;
  }
}

function legacyChannel(code: ChannelCode): LegacyRecord["channel"] {
  switch (code) {
    case "IVR_16699":
      return "ivr";
    case "USSD":
      return "ussd";
    case "MOBILE_APP":
      return "mobile_app";
    case "UDC_ASSISTED":
      return "udc";
    case "HELPLINE_AGENT":
      return "helpline";
    default:
      return "portal";
  }
}

function legacySource(tag: ProvenanceTag | undefined): LegacySource {
  switch (tag?.source) {
    case "REPRESENTATIVE_REPORTED":
      return "ripon_reported";
    case "OPERATOR_ENTERED":
      return "field_officer";
    case "AI_INFERRED":
      return "ai_extracted";
    case "SYSTEM_DERIVED":
      return "system";
    default:
      return tag?.method === "IVR_DTMF" || tag?.method === "IVR_VOICE" ? "ivr" : "applicant";
  }
}

function legacyConfidence(tag: ProvenanceTag | undefined): SlotValue["confidence"] {
  if (tag?.confidence === "CONFIRMED") return "verified";
  if (tag?.confidence === "INFERRED") return "inferred";
  return "stated";
}

/* ---------------- legacy doors → canonical record ---------------- */

const LEGACY_MATTER: Record<string, MatterCategory> = {
  family: "FAMILY",
  land: "LAND",
  labour: "LABOUR",
  labor: "LABOUR",
  criminal: "CRIMINAL_DEFENCE",
  civil: "CIVIL_MONEY",
  violence: "VIOLENCE",
  cyber: "CYBER_HARASSMENT",
  sexual_harassment: "SEXUAL_HARASSMENT",
  security: "SECURITY",
};

export function mapLegacyMatter(v: unknown): MatterCategory | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const k = v.trim().toLowerCase();
  if (LEGACY_MATTER[k]) return LEGACY_MATTER[k];
  const hit = MATTERS.find((m) => m.code.toLowerCase() === k || m.label.en.toLowerCase().includes(k) || m.label.bn === v.trim());
  return hit?.code ?? "OTHER";
}

export function mapLegacyDistrict(v: unknown): DistrictCode | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const k = v.trim().toLowerCase();
  const hit = DISTRICTS.find((d) => d.code.toLowerCase() === k || d.label.en.toLowerCase() === k || k.includes(d.label.en.toLowerCase()) || v.includes(d.label.bn));
  return hit?.code ?? null;
}

/**
 * UDC offline drafts that reach the simulated DLAS server WITHOUT going
 * through the workspace submit (seeded demo drafts, sync-centre drains).
 * They get a canonical record (gaps → COMPLETE_MISSING_INFO task) so the
 * whole system has one ID scheme. Idempotent on temporaryId.
 */
export function ingestUdcOfflineDraft(temporaryId: string, payload: Record<string, unknown>): string | null {
  const operatorId = UdcAuth.current()?.operatorId ?? "udc-unknown";
  const r = IntakeGateway.ingest({
    channel: "UDC_ASSISTED",
    entryPoint: "/dashboard/udc (offline sync)",
    clientRef: temporaryId,
    mirror: false,
    identity: { phone: null, method: "OPERATOR_ATTESTED", verified: true },
    meta: { operatorId, clientRef: temporaryId },
    tag: { source: "OPERATOR_ENTERED", method: "OPERATOR_FORM", by: `udc:${operatorId}`, note: "offline draft sync" },
    data: {
      applicant: {
        fullName: typeof payload.applicant_name === "string" ? payload.applicant_name : null,
        district: mapLegacyDistrict(payload.district),
        preferredLanguage: payload.primary_language === "marma" ? "marma" : payload.primary_language === "en" ? "en" : payload.primary_language ? "other" : "bn",
      },
      filedBy: { kind: "UDC_OPERATOR", operatorId },
      matter: { category: mapLegacyMatter(payload.matter_type) },
      consent: {
        dataProcessing: Array.isArray(payload.consent_topics) && payload.consent_topics.includes("submission_to_dlas"),
        method: "UDC_VERBAL_READBACK",
        readBackConfirmed: Array.isArray(payload.consent_topics) && payload.consent_topics.length > 0,
      },
      freeServiceNoticeAcknowledged: payload.free_service_notice_acknowledged === true || payload.free_notice_acknowledged === true,
    },
  });
  return r.ok ? r.record.applicationId : null;
}

/** Helpline agent (T5 / Ripon flow) — the canonical gateway mints the ID for the legacy record. */
export function ingestLegacyHelplineRecord(r: LegacyRecord, actor: string): string | null {
  const f = r.facts;
  const rep = !!f.caller_name?.value;
  const res = IntakeGateway.ingest({
    channel: "HELPLINE_AGENT",
    entryPoint: "/dashboard/helpline (agent intake)",
    clientRef: r.applicationId,
    mirror: false,
    identity: { phone: null, method: "CALLER_LINE_ID", verified: !!r.callerId },
    meta: { operatorId: actor },
    tag: { source: rep ? "REPRESENTATIVE_REPORTED" : "OPERATOR_ENTERED", method: "AGENT_FORM", by: actor, note: "legacy helpline intake" },
    data: {
      applicant: { fullName: f.applicant_name?.value ?? null, district: mapLegacyDistrict(f.office?.value ?? r.office) },
      filedBy: rep
        ? { kind: "REPRESENTATIVE", name: f.caller_name?.value ?? null, relation: "OTHER" }
        : { kind: "HELPLINE_AGENT", operatorId: actor },
      matter: { category: mapLegacyMatter(f.category?.value), incidentDate: f.incident_date?.value ?? null },
      consent: {
        dataProcessing: !!f.consent?.value,
        method: "AGENT_VERBAL_READBACK",
        readBackConfirmed: !!f.consent?.value,
        recordedAt: new Date().toISOString(),
      },
    },
  });
  return res.ok ? res.record.applicationId : null;
}

export function mirrorToLegacyStore(r: ApplicationRecord): void {
  // The legacy seeder REPLACES records when it first runs, so seed first
  // or the projection would be wiped the next time a helpline page opens.
  let env = readLegacy();
  if (!env.seededAt) env = seedDemoData(env);
  if (env.records.some((x) => x.applicationId === r.applicationId)) return;
  const d = r.data;
  const slot = (value: string | null | undefined, path: string): SlotValue | undefined =>
    value ? { value, confidence: legacyConfidence(r.provenance[path]), source: legacySource(r.provenance[path]) } : undefined;

  const facts: Partial<Record<SlotKey, SlotValue>> = {};
  const put = (k: SlotKey, v: SlotValue | undefined) => {
    if (v) facts[k] = v;
  };
  put("applicant_name", slot(d.applicant.fullName, "applicant.fullName"));
  put("category", slot(MATTERS.find((m) => m.code === d.matter.category)?.label.en, "matter.category"));
  put("office", slot(r.routing.office, "routing.office"));
  put("incident_date", slot(d.matter.incidentDate, "matter.incidentDate"));
  put("safe_contact_time", slot(SAFE_TIMES.find((s) => s.code === d.safeContact.safeTime)?.label.en, "safeContact.safeTime"));
  put("consent", slot(d.consent.dataProcessing ? "yes" : null, "consent.dataProcessing"));
  if (d.filedBy.kind === "REPRESENTATIVE") {
    put("caller_name", slot(d.filedBy.name, "filedBy.name"));
    put("caller_relation", slot(d.filedBy.relation, "filedBy.relation"));
  }

  const projection: LegacyRecord = {
    applicationId: r.applicationId,
    status: "submitted",
    channel: legacyChannel(r.channel.code),
    office: `${DISTRICTS.find((x) => x.code === d.applicant.district)?.label.en ?? "Unrouted"} DLAO`,
    intakeSessionId: r.channel.sessionId,
    urgencyIndicators: [],
    facts,
    provenance: [],
    audit: [],
    createdAt: r.createdAt,
    submittedAt: r.submittedAt,
  };
  const next = { ...env, records: [...env.records, projection] };
  writeLegacy(next);
  // The legacy writer is debounced; persist now too so a second submit in the
  // same tick (or an immediate reload) reads the fresh envelope.
  try {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(next));
  } catch {
    /* quota — the debounced write will retry */
  }
}
