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
  | "OFFICER_CORRECTED" // edited during verification; still requires review confirmation
  | "LAWYER_REPORTED" // self-reported by the assigned panel lawyer (hearing updates)
  | "OFFICER_ENTERED" // structured fact entered by the officer that intake did not capture (e.g. court status)
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
  | "SEXUAL_HARASSMENT" // chosen by the applicant → always urgent (red)
  | "SECURITY" // personal safety / threats → always urgent (red)
  | "CIVIL_MONEY"
  | "OTHER";

/* ---------- Incident taxonomy (rule-based red flag) ---------- */
export type IncidentCategory = "VIOLENT_CRIME" | "SEXUAL_OFFENCE" | "PERSONAL_SAFETY" | "DOMESTIC_VIOLENCE" | "PROPERTY" | "FAMILY" | "LABOR" | "CIVIL" | "ADMINISTRATIVE" | "OTHER";
export type IncidentSubcategory =
  | "MURDER" | "ATTEMPTED_MURDER" | "ASSAULT" | "GRIEVOUS_BODILY_HARM" | "TORTURE"
  | "RAPE" | "SEXUAL_ASSAULT" | "SEXUAL_HARASSMENT" | "CHILD_SEXUAL_ABUSE"
  | "KIDNAPPING" | "HUMAN_TRAFFICKING" | "DEATH_THREAT" | "STALKING" | "MISSING_PERSON"
  | "PHYSICAL_ABUSE" | "PSYCHOLOGICAL_ABUSE" | "ECONOMIC_ABUSE" | "THREAT"
  | "LAND_DISPUTE" | "TENANCY" | "INHERITANCE" | "PROPERTY_DAMAGE"
  | "DIVORCE" | "CHILD_CUSTODY" | "MAINTENANCE" | "FAMILY_DISPUTE"
  | "UNPAID_WAGES" | "WRONGFUL_TERMINATION" | "WORKPLACE_HARASSMENT"
  | "CONTRACT" | "DEBT" | "COMPENSATION" | "OTHER_CIVIL_DISPUTE"
  | "DOCUMENTATION" | "GOVERNMENT_SERVICE" | "OTHER_ADMINISTRATIVE";
export interface IncidentClassification {
  category: IncidentCategory;
  subcategory: IncidentSubcategory | null;
  red: boolean; // VIOLENT_CRIME · SEXUAL_OFFENCE · PERSONAL_SAFETY · DOMESTIC_VIOLENCE
  matched: { category: IncidentCategory; subcategory: IncidentSubcategory | null; keyword: string }[];
  basis: "DESCRIPTION_KEYWORDS" | "MATTER_TYPE";
  rule: string; // plain words: which rule fired on which words
  rulesVersion: string;
  at: string;
  advisoryOnly: true;
  officerReview: { decision: "CONFIRMED" | "CLEARED"; reason: string | null; by: string; byName: string; at: string } | null;
}

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
  role: "applicant" | "representative" | "udc_operator" | "helpline_agent" | "system" | "dlao" | "clo" | "panel_lawyer" | "mediator" | "dlo_staff" | "admin" | "debug";
  caseId?: string; // explicit on sensitive case actions; older audit rows remain valid
  action: string; // e.g. "session.started", "field.captured", "application.submitted"
  detail?: Record<string, unknown>;
  /** Feature 11 — case status right after the action; stamped by the store on application audit rows (lib/dlas/audit-trail.ts). */
  status?: { application: ApplicationStatus; stage: PipelineStage; pathway: string | null; mediation: string | null };
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
  aiTriage?: AiTriage[]; // IVR story triage (SIMULATED AI, advisory) — lib/dlas/ivr-triage.ts
  agentHandoff?: AgentHandoff | null; // routed to a 16699 call-centre agent (AI escalation or emergency button)
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
  | "RESOLVED"
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
  lawyer: LawyerMatter | null; // Step 3 (LAWYER pathway) — assignment, hearings, updates
  staffCheck: StaffStoryCheck | null; // DLO office staff pre-check of the story (advisory for the officer)
  aiTriage?: AiTriage[]; // carried from the intake session (IVR)
  agentHandoff?: AgentHandoff | null; // carried from the intake session (IVR → call-centre agent)
  transfers?: CaseTransfer[]; // DLAO → DLAO transfer requests; the latest ACCEPTED one decides the handling office (lib/dlas/case-transfer.ts)
  mediation: MediationMatter | null; // Feature 3 — mediator assignment (separate from lawyer); later: sessions, outcome
  incident?: IncidentClassification | null;
  incidentGroupId?: string | null; // T3 — linked related-incident group (lib/dlas/incident-groups.ts) // rule-based category + red flag (lib/dlas/incident-taxonomy.ts); replaces the citizen's "is this urgent?" question
  pathwayClassification: PathwayClassification | null; // Feature 2 — rule-based system assessment + officer decisions (lib/dlas/pathway.ts)
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

export type PathwayType = "GRAM_ADALAT" | "MEDIATION" | "LAWYER" | "REFERRAL"; // REFERRAL = other external referral (police, OCC, labour, social services…)

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
  authorityRole?: "LEGAL_AID_OFFICER" | "CHIEF_LEGAL_AID_OFFICER"; // optional for stored v1 records
  createdAt: string;
  lastLoginAt: string | null;
  audit: AuditEntry[];
}

/* ---------- Panel lawyers (sign-up: name + phone + district + bar enrolment) ---------- */

/* ---------- DLO office staff (/dlo-stuff): see incoming cases, check the story only ---------- */

export interface OfficeStaffAccount {
  staffId: string; // STF-XXXXXX
  name: string;
  phone: string; // login id (no password in the prototype)
  district: DistrictCode; // the DLO office they work in
  createdAt: string;
  lastLoginAt: string | null;
  audit: AuditEntry[];
}

export type StoryCheckKey = "STORY_CLEAR" | "CATEGORY_MATCHES" | "OTHER_PARTY" | "URGENCY_CONSISTENT";

/** Staff read the applicant's story and check it hangs together. Advisory — the officer still verifies and decides. */
export interface StaffStoryCheck {
  outcome: "STORY_VERIFIED" | "NEEDS_CLARIFICATION";
  items: { key: StoryCheckKey; answer: "YES" | "NO" | "UNSURE" }[];
  note: string | null;
  by: string; // staffId
  byName: string;
  at: string;
  history: { outcome: StaffStoryCheck["outcome"]; note: string | null; by: string; byName: string; at: string }[];
}

export interface PanelLawyerAccount {
  lawyerId: string; // LAW-XXXXXX
  name: string;
  phone: string; // login id (no password in the prototype)
  district: DistrictCode; // district legal aid panel the lawyer sits on
  barEnrolmentNo: string; // self-declared; the DLAO checks it before empanelment
  practiceAreas: MatterCategory[];
  createdAt: string;
  lastLoginAt: string | null;
  attendance: LawyerDayAttendance[]; // daily present/absent the lawyer registers (one entry per date)
  notificationsReadAt: string | null;
  contacts: LawyerContact[]; // DLAO calls, summons and reminders to this lawyer
  redFlags: LawyerRedFlag[]; // raised by the rule after too many declined offers; cleared only by a DLAO
  audit: AuditEntry[];
}

/** Red flag: the lawyer declined `threshold` case offers since the last flag was cleared. Advisory — a DLAO reviews and clears it. */
export interface LawyerRedFlag {
  flagId: string; // RFL-XXXXXX
  reason: "DECLINED_OFFERS";
  raisedAt: string;
  threshold: number; // rule value when raised
  declines: { applicationId: string; caseId: string | null; assignmentId: string; at: string; reason: string | null }[];
  status: "ACTIVE" | "CLEARED";
  clearedAt: string | null;
  clearedBy: string | null; // officerId
  clearedByName: string | null;
  clearNote: string | null;
}

/** DLAO → lawyer contact log. Calls are made by phone outside the system and logged here; summons/reminders are sent (SMS simulated). */
export interface LawyerContact {
  contactId: string; // CON-XXXXXX
  kind: "CALL" | "SUMMONS" | "REMINDER";
  at: string;
  by: string; // officerId
  byName: string;
  applicationId: string | null; // the case it is about, if any
  note: string; // reason / message / call notes
  callOutcome: "REACHED" | "NO_ANSWER" | "WRONG_NUMBER" | null;
  appearAt: string | null; // summons: when to appear
  place: string | null; // summons: where
  status: "LOGGED" | "SENT" | "ACKNOWLEDGED" | "ATTENDED" | "MISSED";
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

export interface LawyerDayAttendance {
  date: string; // YYYY-MM-DD (lawyer's local date)
  status: "PRESENT" | "ABSENT";
  at: string; // when it was registered (last change)
  method?: "SELF_DECLARED" | "BIOMETRIC_SIMULATED"; // how PRESENT was registered (biometric = simulated fingerprint scanner)
  deviceId?: string | null;
}

export interface ShortlistCandidate {
  lawyerId: string;
  name: string;
  rank: number; // 1 = best score
  score: number; // 0–100
  breakdown: { workload: number; winRate: number; attendance: number; specialisation: number }; // points per factor
  stats: {
    activeCases: number;
    capacity: number;
    won: number;
    lost: number;
    winPct: number | null; // null = no decided cases yet
    presentDays: number;
    absentDays: number;
    attendancePct: number | null; // null = no days registered in the window
    absentToday: boolean;
    matchesMatter: boolean;
    declines?: number; // declined offers counting towards the red flag
    redFlagged?: boolean; // active red flag — ranked after unflagged lawyers
  };
  outcome: "PENDING" | "OFFERED" | "ACCEPTED" | "DECLINED" | "NO_RESPONSE";
  reason: string | null; // decline reason
  offeredAt: string | null;
}

/** Engine's top-N panel lawyers for a case. The DLAO picks one; on decline/no answer the engine offers the next. */
export interface LawyerShortlist {
  shortlistId: string; // SHL-XXXXXX
  createdAt: string;
  by: string; // officerId who asked the engine
  byName: string;
  rulesVersion: string;
  status: "ACTIVE" | "ACCEPTED" | "EXHAUSTED" | "CANCELLED";
  candidates: ShortlistCandidate[];
}

export type AssignmentStatus = "OFFERED" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "WITHDRAWN" | "COMPLETED";

/** Per-assignment attendance record — stored, so payment can be worked out after the case ends. */
export interface AssignmentLedger {
  hearingsAttended: number; // lawyer reported ATTENDED
  hearingsMissed: number; // lawyer reported NOT_ATTENDED, or no report by the deadline
  hearingsNotHeld: number; // court did not sit
  hearingsUnreported: number; // past hearings still waiting for a report (not yet overdue)
  updatesOnTime: number;
  updatesLate: number;
  updatedAt: string;
}

/** Stage-based payment reconciliation (T1). Amounts come from the fee schedule — never set here. */
export interface PaymentReconciliation {
  status: "ACCRUING" | "PENDING_CASE_COMPLETION" | "DLAO_REVIEW";
  payableHearings: number; // attended hearings
  completedStages: { hearingId: string; at: string; result: "ATTENDED" | "NOT_HELD" }[];
  missedHearings: number;
  eligibleAmount: "DEMO_RATE";
  note: string;
  at: string;
}

export interface LawyerAccessGrant {
  lawyerId: string;
  lawyerName: string;
  assignmentId: string;
  scope: "FULL_CASE_RECORD"; // case facts, client safe-contact, documents, hearing history
  grantedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

/** Lawyer workflow thresholds — live in the JSON (dlas.db.v1.lawyerRules), editable without code. */
export interface LawyerRuleset {
  version: string;
  source: "PROTOTYPE_RULE";
  offerResponseHours: number;
  updateDueHours: number;
  missedHearingsBeforeReassign: number; // per case → DLAO asked to assign another lawyer
  patternCases: number; // missed hearings on this many cases → separate pattern review (T1)
  patternWindowDays: number;
  maxActiveCases: number; // availability: lawyers at this load are flagged "at capacity"
  feeBasis: string;
  shortlistSize: number; // engine picks this many lawyers
  attendanceWindowDays: number; // daily attendance considered for the score
  weights: { workload: number; winRate: number; attendance: number; specialisation: number }; // points, sum 100
  declinesBeforeRedFlag: number; // declined offers (since the last cleared flag) → lawyer is red-flagged
}

export interface LawyerAssignment {
  assignmentId: string; // ASN-XXXXXX
  lawyerId: string;
  lawyerName: string;
  status: AssignmentStatus;
  offeredAt: string;
  offeredBy: string; // officerId
  offeredByName: string;
  note: string | null; // officer's instructions
  respondBy: string; // offer response deadline
  respondedAt: string | null;
  declineReason: string | null;
  responseOverdueFlaggedAt: string | null;
  handoverFrom: string | null; // previous assignmentId when this is a reassignment
  shortlistId?: string | null; // the engine shortlist this offer came from
  offeredVia?: "DLAO_CHOICE" | "AUTO_NEXT"; // AUTO_NEXT = engine offered the next shortlisted lawyer after a decline / no answer
  reassignFlaggedAt: string | null; // DLAO alerted: missed-hearing threshold reached
  ledger: AssignmentLedger;
  payment: PaymentReconciliation | null;
}

export interface Hearing {
  hearingId: string; // HRG-XXXXXX
  assignmentId: string | null; // the assignment responsible for this hearing (moves to the new lawyer on reassignment if still upcoming)
  result: "ATTENDED" | "MISSED" | "NOT_HELD" | null; // from the lawyer's report, or MISSED when no report by the deadline
  at: string; // ISO date-time of the hearing
  court: string;
  purpose: string | null;
  addedBy: string; // lawyerId or officerId
  addedAt: string;
  updateDueAt: string; // the lawyer's update is required by this time
  updateId: string | null; // set when the lawyer reports on this hearing
  overdueFlaggedAt: string | null; // when the DLAO was alerted
  clientNotifiedAt: string | null;
}

export interface HearingUpdate {
  updateId: string; // UPD-XXXXXX
  hearingId: string | null;
  attendance: "ATTENDED" | "NOT_ATTENDED" | "NOT_HELD";
  outcome: "ADJOURNED" | "HEARD" | "ORDER_PASSED" | "JUDGMENT" | "SETTLED" | "OTHER";
  nextDate: string | null; // next hearing (creates a new Hearing)
  note: string;
  by: string; // lawyerId
  byName: string;
  at: string;
  late: boolean; // submitted after updateDueAt
}

export interface LawyerMatter {
  assignments: LawyerAssignment[]; // history; at most one OFFERED/ACCEPTED at a time
  hearings: Hearing[];
  updates: HearingUpdate[];
  access: LawyerAccessGrant[]; // who may open the full record; revoked on reassignment
  shortlists: LawyerShortlist[];
  completion: { outcome: "WON" | "LOST" | "SETTLED" | "WITHDRAWN_BY_CLIENT" | "OTHER" | "JUDGMENT"; reason: string; by: string; byName: string; at: string } | null;
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
  | "LAWYER_ASSIGNMENT"
  | "LAWYER_RESPONSE" // panel lawyer: accept or decline an offer
  | "HEARING_UPDATE_DUE" // panel lawyer: report on a hearing
  | "LAWYER_UPDATE_OVERDUE" // DLAO: a required lawyer update is late (no chase call needed)
  | "LAWYER_REASSIGN_REVIEW" // DLAO: lawyer missed the threshold number of hearings on this case
  | "MEDIATOR_ASSIGNMENT" // DLAO: confirm a mediator for a case in the mediation pathway
  | "MEDIATION_OUTCOME_REVIEW" // DLAO: mediator recorded an outcome (settlement → signatures + certification; failed → failure record + pathway)
  | "MEDIATION_FAILURE_REVIEW" // DLAO: confirm/change the advisory next pathway after a formal failure record
  | "POST_MEDIATION_REFERRAL" // DLAO: carry out a confirmed court, further-review or other-referral handoff
  | "COURT_AUTHORITY_NOTIFICATION" // DLAO: record dispatch of a court-referred mediation outcome
  | "MEDIATION_FOLLOW_UP" // mediator: follow-up action after a session
  | "SETTLEMENT_FOLLOW_UP" // DLAO/CLO: compliance, party contact, deadline or enforcement monitoring after certification
  | "MEDIATOR_REASSIGNMENT" // DLAO: a mediator assignment needs replacing (conflict / unavailability / request)
  | "EXTERNAL_REFERRAL" // DLAO: refer to another service (police, OCC, labour, social services) and track acknowledgement
  | "LAWYER_RED_FLAG" // DLAO: lawyer declined too many case offers — review and clear
  | "LAWYER_INACTIVITY_REVIEW" // DLAO: repeated overdue updates across cases (T1 pattern alert)
  | "CASE_TRANSFER_REVIEW" // receiving DLAO: accept or reject a case transferred from another DLAO
  | "CASE_TRANSFER_REJECTED" // sending DLAO: see below
  | "MEDIATOR_CASE_OFFER" // mediator: a mediation case is offered to you — accept or decline
  | "SETTLEMENT_APPEAL_REVIEW" // DLO: the citizen appealed the settlement testimonial — accept (→ lawyer) or reject (→ closed)
  | "AGENT_LIVE_TRANSFER" // 16699 agent: the IVR assistant found the story critical or too complex — take the call
  | "EMERGENCY_CALL"; // 16699 agent: the caller pressed the IVR emergency button — sending DLAO: the receiving office rejected the transfer (with its message)

export interface Task {
  taskId: string; // TSK-XXXXXX
  type: TaskType;
  applicationId: string | null;
  sessionId: string | null;
  assignedRole: "DLAO" | "HELPLINE_AGENT" | "UDC_OPERATOR" | "MEDIATOR" | "GRAM_ADALAT" | "PANEL_LAWYER";
  assigneeId?: string | null; // e.g. LAW-XXXXXX when the task belongs to one person
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
  lawyers: PanelLawyerAccount[];
  lawyerRules: LawyerRuleset | null;
  officeStaff: OfficeStaffAccount[];
  pathwayRules: PathwayRuleset | null; // legal pathway rule table (null → DEFAULT_PATHWAY_RULES in lib/dlas/pathway-rules.ts)
  mediators: MediatorRecord[]; // mediator registry — separate from panel lawyers (lib/dlas/mediators.ts)
  udcCentres: UdcCentre[];
  eligibilityRulesets: EligibilityRuleset[];
  sessions: IntakeSession[];
  applications: ApplicationRecord[];
  tasks: Task[];
  outbox: SimMessage[];
  otp: OtpChallenge[];
  adminAudit: AuditEntry[];
  helplineAgents?: HelplineAgentAccount[]; // 16699 call-centre agents (created on first sign-up)
  officeNotices?: OfficeNotice[]; // office-wide notifications (DLAO case transfers) — lib/dlas/case-transfer.ts
  incidentGroups?: IncidentGroup[]; // T3 — related-incident groups (linked, not merged) — lib/dlas/incident-groups.ts
  updatedAt: string | null;
}

/** T3 — several applicants, one incident. The cases are LINKED (each keeps its own record,
 *  confidentiality, instructions and outcome); shared evidence is uploaded once for the group. */
export interface IncidentGroup {
  groupId: string; // GRP-XXXXXX
  title: string; // e.g. "Tazreen factory fire, 12 March 2026"
  description: string;
  incidentDate: string | null;
  place: string | null;
  office: string; // DLAO-<DISTRICT>
  applicationIds: string[];
  status: "ACTIVE" | "DISSOLVED";
  sharedEvidence: SharedEvidence[];
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  audit: AuditEntry[];
}

export interface SharedEvidence {
  evidenceId: string; // SEV-XXXXXX (also the FileStore key)
  docType: DocType;
  title: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  sha256: string | null;
  preview: "STORED" | "TOO_LARGE" | "NONE";
  note: string | null;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
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


/* ------------------------------------------------------------------ *
 *  Mediator registry (Feature 1). Mediators are NOT panel lawyers:
 *  they conduct human-led mediation; the Legal Aid Officer verifies them,
 *  sets their status and (later) confirms any assignment.
 * ------------------------------------------------------------------ */

export type MediatorStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
export type MediatorRole = "LEGAL_AID_OFFICER" | "PANEL_MEDIATOR" | "COMMUNITY_MEDIATOR";
export type MediationTrack = "PRE_LITIGATION" | "COURT_REFERRED";
export type MediationOrigin = "PRE_LITIGATION" | "MANDATORY_PRE_CASE" | "COURT_REFERRED" | "APPELLATE_REFERRAL";
export type CourtLevel = "SUPREME_COURT" | "DISTRICT_JUDGE" | "ADDITIONAL_DISTRICT_JUDGE" | "JOINT_DISTRICT_JUDGE" | "SENIOR_ASSISTANT_JUDGE" | "ASSISTANT_JUDGE" | "MAGISTRATE" | "TRIBUNAL" | "OTHER";
export type LitigationStage = "PLEADINGS" | "PRE_TRIAL" | "TRIAL" | "ARGUMENT" | "JUDGMENT_PENDING" | "APPEAL" | "OTHER";
export type MediationCaseType =
  | "FAMILY_MARITAL"
  | "DOWER"
  | "SPOUSAL_MAINTENANCE"
  | "CHILD_CUSTODY"
  | "CONJUGAL_RIGHTS"
  | "PARENTS_MAINTENANCE"
  | "PROPERTY_PARTITION"
  | "NEIGHBOURHOOD_BOUNDARY"
  | "CIVIL_SUIT"
  | "TITLE_DISPUTE"
  | "MONEY_SUIT"
  | "EVICTION"
  | "APPELLATE_REFERRAL";
export type MediatorCertificationStatus = "CERTIFIED" | "TRAINING_COMPLETED" | "IN_TRAINING" | "NOT_TRAINED";
export type MediationChannel = "PHYSICAL" | "VOICE" | "ONLINE";
export type Weekday = "SAT" | "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI";

export interface MediatorConflict {
  conflictId: string; // COI-XXXXXX
  kind: "RELATIVE_OR_CLOSE_ASSOCIATE" | "PRIOR_REPRESENTATION" | "FINANCIAL_INTEREST" | "EMPLOYMENT_RELATIONSHIP" | "OTHER";
  source: "MEDIATOR_DECLARED" | "OFFICER_RECORDED";
  partyName: string | null; // person / organisation the mediator must not mediate for or against
  applicationId: string | null; // a specific case, if the declaration is case-specific
  area: string | null; // locality, if the conflict is local (e.g. same union)
  detail: string;
  declaredAt: string;
  recordedBy: string; // officerId
  recordedByName: string;
  status: "ACTIVE" | "WITHDRAWN";
  withdrawnAt: string | null;
  withdrawnReason: string | null;
}

export interface MediatorAdminEntry {
  entryId: string; // MAR-XXXXXX
  kind: "NOTE" | "TRAINING" | "COMPLAINT" | "COMMENDATION" | "STATUS_CHANGE" | "VERIFICATION" | "AVAILABILITY" | "PROFILE";
  at: string;
  by: string;
  byName: string;
  text: string;
}

export interface MediatorRecord {
  mediatorId: string; // MED-XXXXXX
  name: string;
  role: MediatorRole;
  status: MediatorStatus;
  statusReason: string | null;
  statusChangedAt: string;
  qualification: { kind: "ADVOCATE" | "LAW_GRADUATE" | "RETIRED_JUDICIAL_OFFICER" | "SOCIAL_WORK" | "OTHER"; detail: string };
  certification: {
    status: MediatorCertificationStatus;
    body: string | null; // training / certifying body
    certificateNo: string | null;
    issuedOn: string | null; // YYYY-MM-DD
    validUntil: string | null; // YYYY-MM-DD; past = expired
    verifiedBy: string | null; // officer who checked the certificate
    verifiedByName: string | null;
    verifiedAt: string | null;
  };
  experience: { years: number; mediationsConducted: number; settled: number; note: string | null };
  caseTypes: MediationCaseType[];
  tracks: MediationTrack[];
  district: DistrictCode;
  operationalAreas: string[]; // upazilas / unions / court venues
  languages: LanguageCode[];
  availability: {
    status: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
    days: Weekday[];
    channels: MediationChannel[];
    maxActiveMatters: number;
    unavailableUntil: string | null; // YYYY-MM-DD
    note: string | null;
    updatedAt: string;
  };
  /** Until mediation matters exist, load is recorded (SAMPLE for sample records). Feature 3 computes it from assignments. */
  workload: { activeMatters: number; basis: "SAMPLE" | "RECORDED" | "RECORDS"; updatedAt: string };
  conflicts: MediatorConflict[];
  adminRecord: MediatorAdminEntry[];
  contact: { phone: string; email: string | null; preferredChannel: "PHONE" | "SMS" | "EMAIL"; office: string | null };
  sample: boolean; // illustrative sample record — not a real person
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  audit: AuditEntry[];
}


/* ------------------------------------------------------------------ *
 *  Legal pathway classification (Feature 2). A deterministic, configurable
 *  rule table suggests a pathway; the Legal Aid Officer confirms, changes
 *  or asks for more information. The system never finalises the pathway.
 * ------------------------------------------------------------------ */

export type PathwayStatus =
  | "MANDATORY_PRE_CASE_MEDIATION"
  | "MEDIATION_AVAILABLE"
  | "COURT_REFERRED_MEDIATION"
  | "LAWYER_ASSISTANCE"
  | "URGENT_ESCALATION"
  | "OTHER_REFERRAL"
  | "REQUIRES_OFFICER_REVIEW";

export type CourtStatus = "UNKNOWN" | "NONE" | "FILED_PENDING" | "REFERRED_FOR_MEDIATION" | "DECIDED" | "APPEAL";
export type ReferralTarget = "GRAM_ADALAT" | "POLICE" | "ONE_STOP_CRISIS_CENTRE" | "LABOUR_AUTHORITY" | "SOCIAL_SERVICES" | "OTHER";

/** Structured facts the rules read that intake does not capture — entered by the officer (STAFF_ENTERED). */
export interface PathwayInputs {
  subcategory: string | null; // code from the ruleset's subcategory list for the matter category
  courtStatus: CourtStatus;
  mediationOrigin: MediationOrigin | null;
  courtName: string | null;
  courtLevel: CourtLevel | null;
  courtCaseNo: string | null;
  referralDate: string | null; // court referral date, for court-referred mediation
  referralOrderReference: string | null;
  referringAuthority: string | null;
  currentLitigationStage: LitigationStage | null;
  referralDeadline: string | null;
  setBy: string | null;
  setByName: string | null;
  setAt: string | null;
}

export interface PathwayRuleCondition {
  categories?: MatterCategory[];
  subcategories?: string[];
  subcategoryMissing?: boolean;
  urgencyAny?: UrgencyFlag[];
  courtStatus?: CourtStatus[];
  mandatoryDistrictOnly?: boolean; // only where mandatory pre-case mediation is notified (ruleset.mandatoryPreCaseDistricts)
}

export interface PathwayRule {
  ruleId: string;
  enabled: boolean;
  when: PathwayRuleCondition; // all keys must match; within a list any value matches
  result: PathwayStatus;
  title: { bn: string; en: string };
  basis: { bn: string; en: string }; // plain-language explanation shown to the officer
  law: string | null; // statutory reference, for the officer to verify — not legal advice
  track: MediationTrack | null;
  referralTarget: ReferralTarget | null;
  expectedDocs: DocType[];
}

export interface PathwayRuleset {
  version: string;
  source: "PROTOTYPE_RULE";
  updatedAt: string;
  mandatoryPreCaseDistricts: DistrictCode[] | "ALL";
  mandatoryNote: { bn: string; en: string };
  subcategories: Record<MatterCategory, { code: string; label: { bn: string; en: string } }[]>;
  rules: PathwayRule[]; // evaluated in order; the first match wins
}

export interface PathwayAssessment {
  assessmentId: string; // PAS-XXXXXX
  at: string;
  rulesVersion: string;
  result: PathwayStatus;
  ruleId: string | null; // null = no rule matched
  matched: string[]; // conditions that matched, in plain words
  warnings: { bn: string; en: string }[];
  evidence: { docType: DocType; present: boolean }[];
  inputs: {
    category: MatterCategory | null;
    subcategory: string | null;
    courtStatus: CourtStatus;
    district: DistrictCode | null;
    urgencyFlags: UrgencyFlag[];
    otherPartyIdentified: boolean;
    documents: DocType[];
  };
}

export interface PathwayOfficerDecision {
  decisionId: string; // PDC-XXXXXX
  action: "CONFIRMED" | "CHANGED" | "INFO_REQUESTED";
  assessmentId: string;
  systemClassification: PathwayStatus;
  previousSystemClassification: PathwayStatus | null; // the assessment before this one, if the inputs changed
  previousFinal: PathwayStatus | null;
  finalPathway: PathwayStatus | null; // null for INFO_REQUESTED
  referralTarget: ReferralTarget | null;
  reason: string;
  by: string;
  byName: string;
  at: string;
}

export interface PathwayClassification {
  inputs: PathwayInputs;
  assessments: PathwayAssessment[];
  decisions: PathwayOfficerDecision[];
  final: { status: PathwayStatus; referralTarget: ReferralTarget | null; decisionId: string; by: string; byName: string; at: string } | null;
}


/* ------------------------------------------------------------------ *
 *  Mediator assignment (Feature 3) — completely separate from panel
 *  lawyer assignment. Hard filters decide eligibility; suitability facts
 *  are shown side by side (no single score, no "best mediator"); the
 *  Legal Aid Officer recommends and then confirms. lib/dlas/mediator-assignment.ts
 * ------------------------------------------------------------------ */

/** Assignment status of the case (the matter) and of each assignment record. */
export type MediatorAssignmentStatus = "PENDING" | "RECOMMENDED" | "AWAITING_OFFICER_CONFIRMATION" | "AWAITING_MEDIATOR_ACCEPTANCE" | "ASSIGNED" | "REASSIGNMENT_REQUESTED" | "COMPLETED";

export type MediatorFilterKey = "STATUS" | "CERTIFICATION" | "JURISDICTION" | "AVAILABILITY" | "CONFLICT" | "CASE_TYPE";

export interface MediatorCandidateCheck {
  key: MediatorFilterKey;
  ok: boolean;
  detail: string;
}

export interface MediatorCandidate {
  mediatorId: string;
  name: string;
  sample: boolean;
  eligible: boolean; // passed every hard filter
  checks: MediatorCandidateCheck[];
  conflictIds: string[]; // declarations that matched this case
  considerations: {
    relevantExperience: "HIGH" | "MEDIUM" | "LOW";
    experienceNote: string;
    currentLoad: number;
    capacity: number;
    availability: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
    days: Weekday[];
    channels: MediationChannel[];
    areas: string[];
    areaMatch: boolean; // an operational area mentions the applicant's address / district
    record: "CONCERN" | "COMMENDED" | "NO_ENTRIES" | "NOTES_ONLY";
    recordNote: string;
  };
}

/** One run of the hard filters — a snapshot the officer decides from. */
export interface MediatorEligibilityRun {
  runId: string; // MER-XXXXXX
  at: string;
  by: string;
  byName: string;
  caseType: MediationCaseType | null;
  track: MediationTrack;
  district: DistrictCode | null;
  candidates: MediatorCandidate[]; // every mediator in the district, eligible or not
}

export interface MediatorAssignmentRecord {
  assignmentId: string; // MAS-XXXXXX
  mediatorId: string;
  mediatorName: string;
  runId: string;
  status: "AWAITING_OFFICER_CONFIRMATION" | "OFFERED" | "DECLINED" | "EXPIRED" | "ASSIGNED" | "WITHDRAWN" | "REASSIGNMENT_REQUESTED" | "COMPLETED";
  recommendedAt: string;
  recommendedBy: string;
  recommendedByName: string;
  recommendationNote: string | null;
  conflictCheck: { at: string; clear: boolean; conflictIds: string[] }; // re-run at confirmation
  assignedAt: string | null;
  assignedBy: string | null;
  assignedByName: string | null;
  reason: string | null; // assignment reason
  accessGrantedAt: string | null; // case-based access for the mediator (need-to-know view)
  accessRevokedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  endedBy: string | null;
  /** Offer to the mediator (best-pick flow, lib/dlas/mediator-offers.ts): the mediator accepts or declines; a decline or expiry auto-offers the next-ranked mediator. */
  offer?: { offeredAt: string; respondBy: string; via: "OFFICER_PICK" | "AUTO_NEXT"; rank: number; score: number; respondedAt: string | null; declineReason: string | null };
}

export interface MediationMatter {
  openedAt: string;
  pathwayStatus: PathwayStatus; // MANDATORY_PRE_CASE / MEDIATION_AVAILABLE / COURT_REFERRED
  track: MediationTrack;
  origin?: MediationOrigin; // explicit in Feature 8; derived for records created before it
  caseType: MediationCaseType | null; // from the pathway subcategory; the officer can correct it
  caseTypeSource: "MAPPED" | "OFFICER_SET";
  assignmentStatus: MediatorAssignmentStatus;
  runs: MediatorEligibilityRun[];
  assignments: MediatorAssignmentRecord[];
  workspace?: MediationWorkspace | null; // Feature 4 — sessions, caucus, settlement discussion, outcome (mediator-owned)
  authorityNotifications?: CourtAuthorityNotification[];
}

export interface CourtAuthorityNotification {
  notificationId: string;
  kind: "SETTLEMENT_OUTCOME" | "FAILURE_RETURN";
  authority: string;
  status: "PENDING_DISPATCH" | "DEMO_RECORDED";
  simulated: true;
  outcomeReference: string;
  createdAt: string;
  recordedSentAt: string | null;
  recordedSentBy: string | null;
  recordedSentByName: string | null;
  dispatchReference: string | null;
  note: string | null;
  taskId: string;
}


/* ------------------------------------------------------------------ *
 *  Mediation workspace (Feature 4) — written only by the assigned
 *  mediator. Private caucus notes are confidential: never shown to the
 *  other party, the applicant, or the officer's screens.
 * ------------------------------------------------------------------ */

export type MediationSessionStatus = "SCHEDULED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";
export type PartySide = "APPLICANT" | "RESPONDENT";

export interface AttendanceMark {
  status: "UNRECORDED" | "PRESENT" | "ABSENT" | "REPRESENTED";
  mode: MediationChannel | null;
  at: string | null;
}

export interface MediationSession {
  sessionId: string; // MSS-XXXXXX
  number: number;
  channel: MediationChannel;
  scheduledFor: string | null;
  place: string | null; // physical: location / venue; voice & online: instructions
  room?: string | null; // physical: room
  status: MediationSessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  pauses: { from: string; to: string | null; reason: string | null }[];
  attendance: Record<PartySide, AttendanceMark>;
  transport?: SessionTransport; // Feature 5 — the channel is only transport; the mediator owns the process
}

/* ------------------------------------------------------------------ *
 *  Multi-channel transport (Feature 5). All SIMULATED in the prototype —
 *  no telephony or video service is connected. Channel changes never stop
 *  the mediation: a fallback is logged and the session continues.
 * ------------------------------------------------------------------ */

export type VoiceCallState = "IDLE" | "INITIATED" | "CONNECTED" | "NO_ANSWER" | "ENDED";
export type OnlineParticipantKey = "APPLICANT" | "RESPONDENT" | "MEDIATOR";
export type OnlineConnectionState = "NOT_JOINED" | "CONNECTED" | "WEAK" | "DISCONNECTED";

export interface SessionTransport {
  voice: Record<PartySide, { state: VoiceCallState; initiatedAt: string | null; connectedAt: string | null; endedAt: string | null; attempts: number }>;
  online: { roomId: string; participants: Record<OnlineParticipantKey, { state: OnlineConnectionState; at: string | null }> };
  checkIn: Record<PartySide, string | null>; // physical: time each party checked in at the venue
  fallbacks: { at: string; from: MediationChannel; to: MediationChannel; reason: string }[];
  log: { at: string; kind: "VOICE" | "ONLINE" | "PHYSICAL" | "FALLBACK"; who: PartySide | OnlineParticipantKey | "SESSION"; state: string }[];
}

export interface CaucusNote {
  noteId: string; // CAU-XXXXXX
  side: PartySide;
  sessionId: string | null;
  text: string;
  at: string;
  by: string;
  byName: string;
}

export type SettlementList = "ISSUES" | "DISCUSSION" | "PROPOSED" | "AGREED" | "OUTSTANDING";

export interface SettlementItem {
  itemId: string; // STI-XXXXXX
  list: SettlementList;
  text: string;
  status: "ACTIVE" | "WITHDRAWN";
  at: string;
  updatedAt: string;
  by: string;
  history: { list: SettlementList; text: string; at: string }[]; // every edit / move is kept
  /** Where the text came from: typed by the mediator, or started from the SIMULATED AI draft (edited or unchanged). */
  source?: "MEDIATOR" | "AI_DRAFT_EDITED" | "AI_DRAFT_UNCHANGED";
  aiDraftId?: string | null;
}

export interface MediationOutcome {
  outcomeId: string; // MOC-XXXXXX
  kind: "SETTLEMENT_REACHED" | "MEDIATION_FAILED" | "NEEDS_FOLLOW_UP" | "ADJOURNED";
  note: string;
  at: string;
  by: string;
  byName: string;
  sessionId: string | null;
  agreedTerms: string[]; // snapshot at the time of the outcome
  outstanding: string[];
  failure: { reason: string; recommendedNext: "LAWYER_ASSISTANCE" | "COURT_PROCESS" | "OTHER_REFERRAL" | "OFFICER_TO_DECIDE" } | null;
  followUpBy: string | null;
  nextSession: { at: string; channel: MediationChannel; place: string | null } | null;
  /** Never "legally final" here: a settlement still needs party signatures and the Legal Aid Officer's (DLO) verification. */
  legalStatus: "AWAITING_SIGNATURES_AND_CERTIFICATION" | "FAILURE_RECORD_FOR_OFFICER" | "FOLLOW_UP_PENDING" | "ADJOURNED";
}

/** Feature 6: the human-controlled settlement path after mediation succeeds. */
export type SettlementWorkflowStatus =
  | "TERMS_RECORDED"
  | "PARTY_EXECUTION"
  | "AWAITING_MEDIATOR_CONFIRMATION"
  | "AWAITING_CLO_CERTIFICATION" // legacy name — now: awaiting the Legal Aid Officer's (DLO) verification
  | "RETURNED_FOR_CORRECTION"
  | "CLARIFICATION_REQUESTED"
  | "RESOLVED";

export type SettlementFollowUpKind = "CHECK_COMPLIANCE" | "CONTACT_PARTY" | "REVIEW_DEADLINE" | "ENFORCEMENT_MONITORING";

export interface SettlementWorkflow {
  agreementId: string;
  outcomeId: string;
  status: SettlementWorkflowStatus;
  terms: {
    issue: string;
    proposedResolution: string;
    agreedResolution: string;
    conditions: string;
    deadline: string | null;
    additionalTerms: string | null;
    recordedAt: string;
    recordedBy: string;
    recordedByName: string;
    revision: number;
  };
  execution: Record<PartySide, { status: "PENDING_SIGNATURE" | "SIGNED"; signedAt: string | null; simulated: true }>;
  mediatorConfirmation: { status: "PENDING_CONFIRMATION" | "CONFIRMED"; mediatorId: string | null; mediatorName: string | null; confirmedAt: string | null };
  cloReview: {
    status: "PENDING" | "CERTIFIED" | "RETURNED_FOR_CORRECTION" | "CLARIFICATION_REQUESTED";
    note: string | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
    reviewedByName: string | null;
    history: { action: "CERTIFIED" | "RETURNED_FOR_CORRECTION" | "CLARIFICATION_REQUESTED"; note: string | null; at: string; by: string; byName: string }[];
  };
  resolution: {
    status: "RESOLVED";
    certificationTimestamp: string;
    certifyingOfficer: string;
    certifyingOfficerId: string;
    outcome: string;
    followUpRequirements: { kind: SettlementFollowUpKind; dueAt: string; note: string | null; taskId: string }[];
  } | null;
  /** Issued by the Legal Aid Officer (DLO) after verifying the settlement; issuing it CLOSES the case. Snapshot of what it certifies. */
  testimonial?: SettlementTestimonial | null;
  /** The citizen may appeal the testimonial within the window; no appeal → resolved and closed by default. */
  appeal?: SettlementAppeal | null;
}

export interface SettlementAppeal {
  windowEndsAt: string;
  status: "WINDOW_OPEN" | "FILED" | "ACCEPTED" | "REJECTED" | "ACCEPTED_BY_CITIZEN" | "LAPSED";
  filedAt: string | null;
  filedBy: string | null; // citizenId
  reason: string | null;
  taskId: string | null; // SETTLEMENT_APPEAL_REVIEW
  decision: { outcome: "ACCEPTED" | "REJECTED"; reason: string; by: string; byName: string; at: string; lawyerTaskId: string | null } | null;
  closedAt: string | null;
}

export interface SettlementTestimonial {
  testimonialId: string; // TST-…
  issuedAt: string;
  issuedBy: string; // officerId
  issuedByName: string;
  office: string; // DLAO-<DISTRICT>
  caseRef: string;
  agreementId: string;
  applicantName: string;
  respondentName: string | null;
  mediatorName: string | null;
  matter: string;
  agreedResolution: string;
  conditions: string;
  deadline: string | null;
  outcome: string;
  partiesSignedAt: { APPLICANT: string | null; RESPONDENT: string | null };
  mediatorConfirmedAt: string | null;
  verifiedAt: string;
  simulated: true; // no official seal / e-signature is connected in the prototype
}

export type FailureReferralPathway = "COURT_LEGAL_PATHWAY" | "LAWYER_ASSIGNMENT" | "FURTHER_LEGAL_AID_REVIEW" | "OTHER_REFERRAL";
export type MediationFailureStatus = "AWAITING_OFFICER_REVIEW" | "MORE_INFORMATION_REQUESTED" | "REFERRAL_CONFIRMED";

/** Feature 7: formal procedural record created when mediation does not settle. */
export interface MediationFailureRecord {
  recordId: string; // MFR-XXXXXX
  outcomeId: string;
  status: MediationFailureStatus;
  caseId: string;
  mediationType: MediationTrack;
  mediator: { mediatorId: string; name: string };
  mediationDate: string;
  attendance: Record<PartySide, AttendanceMark["status"]>;
  issuesDiscussed: string;
  outcome: string;
  reasonStatus: string | null;
  followUpRequirement: string | null;
  mediatorProposedPathway: FailureReferralPathway;
  systemSuggestion: { pathway: FailureReferralPathway; reasons: string[]; advisoryOnly: true };
  relevantProceduralInformation: {
    sessionId: string | null;
    sessionNumber: number | null;
    channel: MediationChannel | null;
    completedAt: string | null;
    confidentialCaucusExcluded: true;
  };
  additionalInformation: { text: string; at: string; by: string; byName: string }[];
  officerReview: {
    action: "CONFIRMED" | "PATHWAY_CHANGED" | "MORE_INFORMATION_REQUESTED" | null;
    selectedPathway: FailureReferralPathway | null;
    note: string | null;
    by: string | null;
    byName: string | null;
    at: string | null;
    history: { action: "CONFIRMED" | "PATHWAY_CHANGED" | "MORE_INFORMATION_REQUESTED"; selectedPathway: FailureReferralPathway | null; note: string; by: string; byName: string; at: string }[];
  };
  confirmedPathway: FailureReferralPathway | null;
  lawyerHandoff: { status: "NOT_APPLICABLE" | "AWAITING_ASSIGNMENT"; taskId: string | null };
  createdAt: string;
}

export interface MediationWorkspace {
  openedAt: string;
  access: {
    channel: MediationChannel | null;
    connectivity: "GOOD" | "LIMITED" | "UNKNOWN";
    language: LanguageCode | null;
    interpreter: boolean;
    accessibilityNotes: string | null;
    updatedAt: string | null;
  };
  respondent: {
    contactPreference: ContactMethod | null;
    representation: "UNKNOWN" | "UNREPRESENTED" | "REPRESENTED";
    representativeName: string | null;
    verification: "NAMED_BY_APPLICANT" | "IDENTITY_SEEN_BY_MEDIATOR";
    updatedAt: string | null;
  };
  sessions: MediationSession[];
  /** @deprecated v1 migration source. New writes use mediatorConfidential. */
  caucus?: CaucusNote[];
  mediatorConfidential?: { caucusNotes: CaucusNote[] };
  settlement: SettlementItem[];
  outcomes: MediationOutcome[];
  settlementWorkflow?: SettlementWorkflow | null;
  failureRecord?: MediationFailureRecord | null;
}

/* ---------- Case transfer between DLAO offices ---------- */

export type CaseTransferStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";

export interface CaseTransfer {
  transferId: string; // TRF-XXXXXX
  fromOffice: string; // DLAO-<DISTRICT>
  fromDistrict: DistrictCode;
  toOffice: string;
  toDistrict: DistrictCode;
  reason: string;
  status: CaseTransferStatus;
  requestedAt: string;
  requestedBy: string; // officerId
  requestedByName: string;
  respondedAt: string | null;
  respondedBy: string | null;
  respondedByName: string | null;
  responseMessage: string | null; // required when rejecting
  taskId: string | null; // the receiving office's CASE_TRANSFER_REVIEW task
}

/* ---------- IVR: simulated AI triage + hand-off to a 16699 call-centre agent ---------- */

export type TriageSeverity = "ROUTINE" | "SENSITIVE" | "CRITICAL";
export type TriageFindingCode =
  | "IMMEDIATE_DANGER"
  | "SELF_HARM"
  | "SEXUAL_VIOLENCE"
  | "PHYSICAL_VIOLENCE"
  | "CHILD_AT_RISK"
  | "DETENTION"
  | "TRAFFICKING"
  | "EVICTION_NOW"
  | "COMPLEX_LEGAL"
  | "DISTRESS"
  | "UNCLEAR";

export interface AiTriage {
  triageId: string; // TRG-XXXXXX
  at: string;
  engine: "SIMULATED_TRIAGE_V1"; // rule-based stand-in for an AI model — labelled as simulated everywhere
  simulated: true;
  advisoryOnly: true;
  language: "bn" | "en";
  inputChars: number; // the story itself stays in draft.matter.summary
  findings: { code: TriageFindingCode; severity: TriageSeverity; evidence: string }[];
  severity: TriageSeverity;
  decision: "CONTINUE_AUTOMATED" | "ROUTE_TO_AGENT";
  confidence: number; // 0..1, how sure the simulated model is
  reasons: string[];
}

export interface AgentHandoff {
  kind: "AI_ESCALATION" | "EMERGENCY";
  status: "WAITING" | "CONNECTED" | "COMPLETED" | "CLOSED";
  taskId: string;
  triageId: string | null;
  requestedAt: string;
  connectedAt: string | null;
  agentId: string | null;
  agentName: string | null;
  closedAt: string | null;
  outcome: string | null; // e.g. "APPLICATION_SUBMITTED", "REFERRED_TO_999", free text
}

export interface HelplineAgentAccount {
  agentId: string; // AGT-XXXXXX
  name: string;
  phone: string; // login id (no password in the prototype)
  createdAt: string;
  lastLoginAt: string | null;
  audit: AuditEntry[];
}

/* ---------- Office notifications (DLAO) ---------- */

export interface OfficeNotice {
  noticeId: string; // NTC-XXXXXX
  office: string; // DLAO-<DISTRICT> — every officer of the office sees it
  kind: "TRANSFER_RECEIVED" | "TRANSFER_ACCEPTED" | "TRANSFER_REJECTED" | "TRANSFER_CANCELLED" | "MEDIATOR_ACCEPTED" | "MEDIATOR_DECLINED" | "MEDIATOR_NONE_LEFT" | "SETTLEMENT_APPEAL_FILED";
  applicationId: string;
  caseRef: string;
  transferId: string | null;
  title: { bn: string; en: string };
  body: string | null; // the reason / the other office's message
  at: string;
  readBy: string[]; // officerIds who marked it read
}
