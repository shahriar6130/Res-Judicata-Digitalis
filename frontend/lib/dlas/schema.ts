/* ------------------------------------------------------------------ *
 *  DLAS shared record — canonical JSON schema (v1)
 *
 *  "Five doors, one record." Every intake channel (Web portal,
 *  Mobile app, IVR 16699, USSD, UDC assisted, helpline agent) writes
 *  the SAME `ApplicationRecord` shape through `IntakeGateway`. A
 *  channel is an interface, never a separate case system.
 *
 *  Rules baked into the shape:
 *    - `provenance[path]` tags EVERY data field with who said it and
 *      how it was captured (applicant-confirmed vs representative-
 *      reported vs operator-entered vs AI-inferred).
 *    - `audit[]` lives on every record and on every intake session.
 *    - `routing.*` is ADVISORY. `humanDecision` stays null until an
 *      authorised officer acts (eligibility is never automated).
 *    - `caseId` stays null until acceptance (backbone rule).
 *
 *  Full contract with examples: docs/architecture/DATA-CONTRACTS.md
 * ------------------------------------------------------------------ */

export const SCHEMA_VERSION = "dlas.application.v1" as const;

/* ---------- Channels (the doors) ---------- */

export type ChannelCode =
  | "WEB_PORTAL"
  | "MOBILE_APP"
  | "IVR_16699"
  | "USSD"
  | "UDC_ASSISTED"
  | "HELPLINE_AGENT";

export type CaptureMethod =
  | "WEB_FORM"
  | "IVR_DTMF"
  | "IVR_VOICE"
  | "USSD_MENU"
  | "USSD_TEXT"
  | "OPERATOR_FORM"
  | "AGENT_FORM"
  | "SYSTEM";

/* ---------- Provenance ---------- */

export type ProvenanceSource =
  | "APPLICANT_STATED" // applicant typed/said it, not yet read back
  | "APPLICANT_CONFIRMED" // applicant heard/saw a read-back and confirmed
  | "REPRESENTATIVE_REPORTED" // said by a representative (e.g. Ripon for Moyuri)
  | "OPERATOR_ENTERED" // UDC/helpline typed it on the applicant's behalf
  | "AI_INFERRED" // speech-to-text / classifier output, unconfirmed
  | "OFFICER_VERIFIED" // checked/corrected by an authorised DLAO officer
  | "SYSTEM_DERIVED"; // computed by the platform (office, timestamps…)

export type Confidence = "CONFIRMED" | "STATED" | "INFERRED";

export interface ProvenanceTag {
  source: ProvenanceSource;
  method: CaptureMethod;
  confidence: Confidence;
  by: string; // actor id, e.g. "applicant", "rep:Ripon", "udc:UDC-OP-014"
  at: string; // ISO timestamp
  note?: string;
}

/* ---------- Enumerations shared by every channel ---------- */

export type DistrictCode =
  | "DHAKA"
  | "JOYPURHAT"
  | "JHENAIDAH"
  | "KHAGRACHARI"
  | "BARGUNA"
  | "CHATTOGRAM"
  | "RAJSHAHI"
  | "SYLHET";

export type MatterCategory =
  | "FAMILY"
  | "VIOLENCE"
  | "LAND"
  | "CYBER_HARASSMENT"
  | "LABOUR"
  | "CRIMINAL_DEFENCE"
  | "CIVIL_MONEY"
  | "OTHER";

export type Gender = "FEMALE" | "MALE" | "OTHER" | "UNDISCLOSED";
export type LanguageCode = "bn" | "en" | "marma" | "other";
export type AccessibilityNeed = "VISUAL" | "HEARING" | "LOW_LITERACY" | "SPEECH";
export type FiledByKind = "SELF" | "REPRESENTATIVE" | "UDC_OPERATOR" | "HELPLINE_AGENT";
export type Relation =
  | "SPOUSE"
  | "SIBLING"
  | "PARENT"
  | "CHILD"
  | "OTHER_RELATIVE"
  | "NEIGHBOUR"
  | "OTHER";
export type ContactMethod = "CALL" | "SMS" | "VIA_REPRESENTATIVE" | "VISIT_OFFICE";
export type SafeTime = "MORNING" | "AFTERNOON" | "EVENING" | "ANYTIME";
export type DayCode = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";
export type UrgencyFlag =
  | "IMMEDIATE_DANGER"
  | "VIOLENCE_OR_THREAT"
  | "ONLINE_HARASSMENT"
  | "EVICTION"
  | "DETENTION"
  | "CHILD_INVOLVED";
export type DocType =
  | "NID"
  | "BIRTH_CERT"
  | "MARRIAGE_CERT"
  | "LAND_DEED"
  | "POLICE_REPORT"
  | "MEDICAL"
  | "EVIDENCE_SCREENSHOT"
  | "EMPLOYMENT_PROOF"
  | "OTHER";
export type DocStatus = "ATTACHED" | "WILL_SUBMIT_LATER" | "NOT_AVAILABLE";
export type ConsentMethod =
  | "WEB_CHECKBOX"
  | "IVR_DTMF_1"
  | "USSD_OPTION_1"
  | "UDC_VERBAL_READBACK"
  | "AGENT_VERBAL_READBACK";
export type IdentityMethod =
  | "SMS_OTP" // web/mobile/UDC applicant's own phone
  | "CALLER_LINE_ID" // IVR — network-provided caller number
  | "NETWORK_MSISDN" // USSD — session bound to SIM by operator
  | "OPERATOR_ATTESTED"; // UDC — no own phone, operator attests in person

/* ---------- The data every door must produce ---------- */

export interface DocumentRef {
  docId: string;
  type: DocType;
  status: DocStatus;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null; // integrity hash of the attached bytes
  sensitive: boolean; // restricted access (e.g. intimate images)
  qualityNote: string | null; // e.g. "blurred — retake requested"
  preview?: "STORED" | "TOO_LARGE" | "NONE"; // officer-viewable copy in localStorage["dlas.files.v1"]
  requested?: { by: string; byName: string; at: string; note: string | null } | null; // DLAO asked the applicant for it
  uploadedAt?: string | null; // when the file was attached after submission
  uploadedVia?: "APPLICANT_WEB" | "UDC" | "OFFICE" | null;
}

export interface ApplicationData {
  applicant: {
    fullName: string | null;
    phone: string | null; // 01XXXXXXXXX
    phoneOwnedByApplicant: boolean | null; // false => UDC/shop/relative number
    nidNumber: string | null; // 10, 13 or 17 digits — verified by the DLAO in Step 2
    gender: Gender | null;
    district: DistrictCode | null;
    addressLine: string | null;
    preferredLanguage: LanguageCode | null;
    canRead: boolean | null;
    accessibilityNeeds: AccessibilityNeed[];
  };
  filedBy: {
    kind: FiledByKind;
    name: string | null;
    phone: string | null;
    relation: Relation | null;
    operatorId: string | null; // UDC operator / helpline agent id
    centre: string | null; // UDC centre name
  };
  matter: {
    category: MatterCategory | null;
    summary: string | null; // in Bangla/English as recorded
    summaryOriginal: string | null; // applicant's own words if translated
    translation: {
      from: LanguageCode;
      to: LanguageCode;
      by: string; // interpreter / operator id
      method: "HUMAN_INTERPRETER" | "OPERATOR_TRANSLATION";
    } | null;
    incidentDate: string | null; // YYYY-MM-DD
    opposingParty: string | null;
  };
  urgency: {
    selfReportedUrgent: boolean;
    flags: UrgencyFlag[];
  };
  safeContact: {
    method: ContactMethod | null;
    phone: string | null; // the SAFE number (may differ from applicant.phone)
    safeTime: SafeTime | null;
    smsAllowed: boolean;
    voicemailAllowed: boolean;
    neutralWordingRequired: boolean; // no "legal aid"/case words in SMS
    notes: string | null; // special instructions, e.g. "only WhatsApp"
    window: { day: DayCode; time: string } | null; // exact day + "HH:MM" when the person gave one
  };
  documents: DocumentRef[];
  consent: {
    dataProcessing: boolean;
    contactOnSafeChannel: boolean;
    shareWithAssignedProviders: boolean;
    method: ConsentMethod | null;
    readBackConfirmed: boolean;
    noticeVersion: string;
    recordedAt: string | null;
  };
  freeServiceNoticeAcknowledged: boolean;
}

/* ---------- Audit ---------- */

export interface AuditEntry {
  seq: number;
  at: string;
  actor: string;
  role: "applicant" | "representative" | "udc_operator" | "helpline_agent" | "system" | "dlao" | "debug";
  action: string; // e.g. "session.started", "field.captured", "application.submitted"
  detail?: Record<string, unknown>;
}

/* ---------- Intake session (pre-submission, per door) ---------- */

export type IntakeStep =
  | "STARTED"
  | "IDENTITY_VERIFIED"
  | "DETAILS_CAPTURED"
  | "DOCUMENTS_ATTACHED"
  | "REVIEWED"
  | "SUBMITTED"
  | "ABANDONED";

export const INTAKE_STEPS: IntakeStep[] = [
  "STARTED",
  "IDENTITY_VERIFIED",
  "DETAILS_CAPTURED",
  "DOCUMENTS_ATTACHED",
  "REVIEWED",
  "SUBMITTED",
];

export interface TranscriptLine {
  at: string;
  from: "SYSTEM" | "USER";
  text: string;
  nodeId?: string;
}

export interface IntakeSession {
  sessionId: string; // SES-XXXXXX
  channel: ChannelCode;
  entryPoint: string; // "/dashboard/citizen#intake", "tel:16699", "*16699#", "/dashboard/udc/intake/new"
  simulated: boolean; // true for IVR/USSD/SMS gateway simulators
  step: IntakeStep;
  stepHistory: { step: IntakeStep; at: string }[];
  identity: {
    phone: string | null;
    method: IdentityMethod | null;
    verified: boolean;
    verifiedAt: string | null;
    otpAttempts: number;
  };
  meta: {
    operatorId?: string;
    centre?: string;
    callerId?: string;
    msisdn?: string;
    lang?: "bn" | "en";
    clientRef?: string;
    citizenId?: string; // logged-in citizen account that opened the session // the door's own draft id (e.g. UDC temporaryId)
  };
  draft: ApplicationData;
  provenance: Record<string, ProvenanceTag>;
  transcript: TranscriptLine[]; // IVR prompts / USSD screens / chat
  applicationId: string | null; // set once submitted
  lastValidation: ValidationResult | null;
  audit: AuditEntry[];
  createdAt: string;
  updatedAt: string;
}

/* ---------- Application record (post-submission, the shared record) ---------- */

export type ApplicationStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INFO_REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "CLOSED";

/** The backbone from the case document, in order. */
export type PipelineStage =
  | "ACCESS_APPLICATION"
  | "VERIFICATION_REVIEW"
  | "CASE_OPENED"
  | "SERVICE_DELIVERY"
  | "FOLLOW_UP"
  | "OUTCOME"
  | "CLOSURE";

export const PIPELINE: PipelineStage[] = [
  "ACCESS_APPLICATION",
  "VERIFICATION_REVIEW",
  "CASE_OPENED",
  "SERVICE_DELIVERY",
  "FOLLOW_UP",
  "OUTCOME",
  "CLOSURE",
];

export interface ValidationResult {
  valid: boolean;
  missing: string[]; // dotted field paths
  errors: { path: string; code: string; message: string }[];
  warnings: { path: string; code: string; message: string }[];
}

export interface ApplicationRecord {
  schemaVersion: typeof SCHEMA_VERSION;
  applicationId: string; // APP-YYYY-NNNNN — minted ONLY by IntakeGateway
  caseId: string | null; // DLAS-YYYY-NNNNN — only after human acceptance
  status: ApplicationStatus;
  stage: PipelineStage;
  channel: {
    code: ChannelCode;
    captureMethod: CaptureMethod;
    sessionId: string;
    entryPoint: string;
    simulated: boolean;
    clientRef: string | null; // offline temp id / legacy id (idempotency)
  };
  identity: IntakeSession["identity"];
  data: ApplicationData;
  provenance: Record<string, ProvenanceTag>;
  validation: ValidationResult;
  routing: {
    office: string; // DLAO-<DISTRICT>
    recommendedPriority: "NORMAL" | "HIGH" | "URGENT";
    reasons: string[];
    advisoryOnly: true;
    humanDecision: null | {
      priority: "NORMAL" | "HIGH" | "URGENT";
      by: string;
      at: string;
      reason: string;
      override: boolean;
    };
  };
  taskIds: string[];
  audit: AuditEntry[];
  review: DlaoReview | null; // Step 2 — set once an office receives the application
  closedAt: string | null;
  version: number;
  createdAt: string;
  submittedAt: string;
  updatedAt: string;
}

/* ---------- Step 2 · Verification & eligibility (DLAO / SCLAC / LLAC) ---------- */

export type StepState = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";

export type IdentityOutcome = "CONFIRMED" | "CORRECTED" | "DISPUTED" | "UNREACHABLE";
export type FactStatus = "CORROBORATED" | "DISPUTED" | "UNVERIFIABLE" | "NOT_REVIEWED";
export type FactsOutcome = "SUFFICIENT" | "NEEDS_CLARIFICATION" | "INSUFFICIENT";
export type EligibilityRecommendation =
  | "ELIGIBLE_INCOME"
  | "ELIGIBLE_EXEMPT_CATEGORY"
  | "NOT_ELIGIBLE_INCOME"
  | "INSUFFICIENT_INFORMATION";

export interface DlaoReview {
  officerId: string;
  officerName: string;
  office: string; // DLAO-<DISTRICT> or SCLAC / LLAC-<DISTRICT>
  receivedAt: string;
  identity: {
    state: StepState;
    outcome: IdentityOutcome | null;
    method: "PHONE_CALL" | "OFFICE_VISIT" | "UDC_VIDEO" | "DOCUMENT_CHECK" | null;
    note: string | null;
    corrections: { path: string; from: string | null; to: string }[];
    attempts: number;
    at: string | null;
    nid: {
      status: "MATCHES_DOCUMENT" | "MISMATCH" | "NOT_PROVIDED" | null;
      formatValid: boolean | null;
      simulatedRegistryCheck: { at: string; result: "FORMAT_OK" | "FORMAT_INVALID"; note: string } | null;
    };
  };
  facts: {
    state: StepState;
    items: { key: string; label: string; value: string | null; status: FactStatus; note: string | null }[];
    missingEvidence: string[];
    outcome: FactsOutcome | null;
    at: string | null;
  };
  eligibility: {
    state: StepState;
    rulesetVersion: string | null;
    courtLevel: "SUPREME_COURT" | "OTHER_COURTS";
    declaredAnnualIncomeBdt: number | null; // null = not disclosed
    incomeBand: "AT_OR_BELOW_THRESHOLD" | "ABOVE_THRESHOLD" | "NOT_DISCLOSED" | null;
    exemptCategories: string[]; // EligibilityRuleset.exemptCategories[].code
    vulnerabilityNotes: string | null;
    recommendation: EligibilityRecommendation | null;
    reasons: string[];
    advisoryOnly: true;
    at: string | null;
  };
  decision: {
    decision: "ELIGIBLE" | "NOT_ELIGIBLE";
    reason: string; // mandatory, even when agreeing with the recommendation
    followedRecommendation: boolean;
    by: string;
    byName: string;
    at: string;
  } | null;
  notes: { at: string; by: string; byName: string; text: string }[];
  verifiedAt: string | null; // identity + documents + case facts all checked by the officer
  pathway: {
    type: PathwayType;
    recommended: PathwayType;
    recommendationReasons: string[];
    followedRecommendation: boolean;
    reason: string;
    by: string;
    byName: string;
    at: string;
  } | null;
}

export type PathwayType = "GRAM_ADALAT" | "MEDIATION" | "LAWYER";

export interface EligibilityRuleset {
  version: string;
  status: "WORKING_DRAFT"; // to be checked against the Legal Aid Services Policy text by the team
  source: string;
  incomeThresholdAnnualBdt: { SUPREME_COURT: number; OTHER_COURTS: number };
  exemptCategories: { code: string; label: { bn: string; en: string } }[];
  createdAt: string;
}

/* ---------- UDC centre directory (citizen "my legal aid centre" → UDC list) ---------- */

export interface UdcCentre {
  centreId: string;
  name: { bn: string; en: string };
  area: { bn: string; en: string }; // upazila / pourashava
  district: DistrictCode;
  hours: { bn: string; en: string };
  services: string[]; // ASSISTED_APPLICATION, DOCUMENT_SCAN, STATUS_CHECK, VIDEO_CONSENT
  source: "DEMO_DIRECTORY" | "REGISTERED_OPERATOR";
  operatorId: string | null; // set when a real UDC operator signed up for this centre
  createdAt: string;
}

/* ---------- DLAO officer accounts (sign-up: name + phone + office) ---------- */

export type OfficeType = "DLAO" | "SCLAC" | "LLAC";

export interface DlaoOfficerAccount {
  officerId: string; // OFC-XXXXXX
  name: string;
  phone: string; // login id (no password in the prototype)
  officeType: OfficeType;
  district: DistrictCode | null; // null for SCLAC (national, Supreme Court)
  createdAt: string;
  lastLoginAt: string | null;
  audit: AuditEntry[];
}

/* ---------- Tasks (human work items created by the workflow) ---------- */

export type TaskType =
  | "ELIGIBILITY_REVIEW"
  | "URGENT_SAFETY_REVIEW"
  | "COMPLETE_MISSING_INFO"
  | "DOCUMENT_FOLLOW_UP"
  | "DOCUMENT_REVIEW"
  | "HUMAN_CALLBACK"
  | "GRAM_ADALAT_REFERRAL"
  | "MEDIATION_SCHEDULING"
  | "LAWYER_ASSIGNMENT";

export interface Task {
  taskId: string; // TSK-XXXXXX
  type: TaskType;
  applicationId: string | null;
  sessionId: string | null;
  assignedRole: "DLAO" | "HELPLINE_AGENT" | "UDC_OPERATOR" | "MEDIATOR" | "GRAM_ADALAT";
  office: string | null;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  priority: "NORMAL" | "HIGH" | "URGENT";
  reason: string;
  dueAt: string;
  createdAt: string;
  context?: Record<string, unknown>;
}

/* ---------- Simulated external gateways ---------- */

export interface SimMessage {
  msgId: string;
  kind: "SMS_OTP" | "SMS_CONFIRMATION" | "VOICE_OTP";
  to: string;
  body: string;
  sessionId: string | null;
  applicationId: string | null;
  simulated: true;
  status: "DELIVERED" | "SUPPRESSED_UNSAFE";
  at: string;
}

export interface OtpChallenge {
  sessionId: string;
  phone: string;
  code: string; // demo only — visible in the SMS simulator
  expiresAt: string;
  consumed: boolean;
}

/* ---------- Citizen accounts (simple sign-up: name + phone) ---------- */

export interface CitizenAccount {
  citizenId: string; // CIT-XXXXXX
  name: string;
  phone: string; // 01XXXXXXXXX — the login id (no password in the prototype)
  createdAt: string;
  lastLoginAt: string | null;
  notificationsReadAt: string | null; // "mark all as read" watermark
  audit: AuditEntry[];
}

/* ---------- UDC operator accounts (sign-up: name + phone + centre) ---------- */

export interface UdcOperatorAccount {
  operatorId: string; // UDC-XXXXXX — written as filedBy.operatorId on every assisted record
  name: string;
  phone: string; // 01XXXXXXXXX — the login id (no password in the prototype)
  centre: string; // UDC centre name, e.g. "Dighinala Union Digital Centre"
  district: DistrictCode;
  createdAt: string;
  lastLoginAt: string | null;
  audit: AuditEntry[];
}

/* ---------- The whole localStorage database ---------- */

export interface DlasDb {
  v: 1;
  schemaVersion: typeof SCHEMA_VERSION;
  counters: { application: number; case: number; auditSeq: number };
  citizens: CitizenAccount[];
  udcOperators: UdcOperatorAccount[];
  officers: DlaoOfficerAccount[];
  udcCentres: UdcCentre[];
  eligibilityRulesets: EligibilityRuleset[];
  sessions: IntakeSession[];
  applications: ApplicationRecord[];
  tasks: Task[];
  outbox: SimMessage[];
  otp: OtpChallenge[];
  updatedAt: string | null;
}

/* ---------- Helpers ---------- */

export function emptyApplicationData(): ApplicationData {
  return {
    applicant: {
      fullName: null,
      phone: null,
      phoneOwnedByApplicant: null,
      nidNumber: null,
      gender: null,
      district: null,
      addressLine: null,
      preferredLanguage: null,
      canRead: null,
      accessibilityNeeds: [],
    },
    filedBy: { kind: "SELF", name: null, phone: null, relation: null, operatorId: null, centre: null },
    matter: {
      category: null,
      summary: null,
      summaryOriginal: null,
      translation: null,
      incidentDate: null,
      opposingParty: null,
    },
    urgency: { selfReportedUrgent: false, flags: [] },
    safeContact: {
      method: null,
      phone: null,
      safeTime: null,
      smsAllowed: false,
      voicemailAllowed: false,
      neutralWordingRequired: true,
      notes: null,
      window: null,
    },
    documents: [],
    consent: {
      dataProcessing: false,
      contactOnSafeChannel: false,
      shareWithAssignedProviders: false,
      method: null,
      readBackConfirmed: false,
      noticeVersion: "CONSENT-NOTICE-v1",
      recordedAt: null,
    },
    freeServiceNoticeAcknowledged: false,
  };
}

/** Deep partial used for patching a draft. Arrays are replaced whole. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[]
    ? U[]
    : T[K] extends object | null
      ? DeepPartial<NonNullable<T[K]>> | null
      : T[K];
};
