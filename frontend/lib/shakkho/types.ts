/* ------------------------------------------------------------------ *
 *  Shared type surface for the helpline / 16699 workspace.
 *
 *  All services under `lib/shakkho/services/*` import from this file.
 *  Panels consume the same types so a slot filled in the call
 *  simulator shows up unchanged in the right-rail record.
 *
 *  Identifier conventions per architecture §8.4:
 *    - TEMP-xxxxx             offline / draft
 *    - APP-YYYY-XXXXX         submitted application (never case id)
 *    - DLAS-YYYY-XXXXX        accepted case (NOT minted in phase 1)
 *
 *  No LLM call lives in this file. Everything is plain data.
 * ------------------------------------------------------------------ */

export type ApplicationChannel =
  | "helpline"
  | "portal"
  | "in_person"
  | "udc"
  | "referral";

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "accepted"
  | "rejected"
  | "closed";

export type IntakeStatus =
  | "incoming"
  | "active"
  | "in_progress"
  | "waiting_for_caller"
  | "ai_handled"
  | "handoff_required"
  | "ready_for_confirmation"
  | "submitted"
  | "interrupted"
  | "facts_extracted"
  | "clarification_required"
  | "urgency_rules_applied"
  | "urgent_human_handoff_required"
  | "press_0_requested"
  | "human_handoff_created"
  | "handoff_acknowledged"
  | "human_intake_active"
  | "ready_for_submission"
  | "application_submitted"
  | "urgent_dlao_task_created"
  | "dlao_notified"
  | "applicant_contact_attempted"
  | "applicant_safely_verified"
  | "field_verification_in_progress"
  | "information_confirmed_or_corrected"
  | "verification_completed"
  | "unsafe_contact_failed"
  | "disclosure_blocked"
  | "safe_follow_up_created";

export type RepresentationState =
  | "reported"
  | "pending_confirmation"
  | "confirmed"
  | "limited"
  | "disputed"
  | "withdrawn";

export type Confidence = "stated" | "inferred" | "verified";

export type ProvenanceSource =
  | "caller"
  | "t5"
  | "officer_lookup"
  | "system"
  | "ivr"
  | "sms"
  | "ai_extracted"
  | "ripon_reported"
  | "ripon_corrected"
  | "ripon_confirmed"
  | "human_corrected"
  | "moyuri_pending"
  | "moyuri_confirmed"
  | "moyuri_corrected"
  | "moyuri_disputed"
  | "dlao_reopened";

export type SlotKey =
  | "applicant_name"
  | "category"
  | "office"
  | "incident_date"
  | "urgency_signals"
  | "safe_contact_time"
  | "consent"
  | "applicant_national_id_fragment"
  | "caller_relation"
  | "caller_name";

export interface SlotValue {
  value: string;
  confidence: Confidence;
  source: ProvenanceSource;
}

export interface ProvenanceEntry {
  slot: SlotKey;
  source: ProvenanceSource;
  confidence: Confidence;
  recordedAt: string;
  by: string;
}

export type UrgencyWeight = "low" | "medium" | "high" | "urgent";

export interface UrgencyIndicator {
  code:
    | "caller_reports_violence"
    | "identity_mismatch"
    | "threat_language"
    | "child_at_risk"
    | "self_reported"
    | "danger"
    | "time_critical_court_date"
    | "domestic_violence_disclosed"
    | "child_safeguarding"
    | "approaching_deadline"
    | "physical_safety_at_risk"
    | "evidence_disappearing";
  weight: UrgencyWeight;
  source: ProvenanceSource;
  notedAt: string;
  ruleId?: string;
  note?: { bn: string; en: string };
}

export type UrgencyLevel = "low" | "medium" | "high" | "urgent";

export interface UrgencyRule {
  id: string;
  description: { bn: string; en: string };
  /** Trigger when facts/turns match the predicate. */
  matches: (ctx: UrgencyContext) => boolean;
  level: UrgencyLevel;
}

export interface UrgencyContext {
  facts: Partial<Record<SlotKey, SlotValue>>;
  turns: ConversationalIntakeTurn[];
  indicators: UrgencyIndicator[];
}

export interface UrgencyEvaluation {
  level: UrgencyLevel;
  matchedRuleIds: string[];
  reasons: { bn: string; en: string }[];
  recommendedNextStatus: IntakeStatus;
  evaluatedAt: string;
}

export interface SafeContactRule {
  id: string;
  description: { bn: string; en: string };
  required: boolean;
}

export interface SafeContactEvaluation {
  cleared: boolean;
  reasons: { bn: string; en: string }[];
  evaluatedAt: string;
  rulesApplied: string[];
}

export interface SafeContactPlan {
  applicationId: string;
  preferredTime: { bn: string; en: string };
  channel: "phone" | "sms" | "in_person";
  witness?: string;
  alternateTime?: { bn: string; en: string };
  riskNote?: { bn: string; en: string };
  verifiedAt?: string;
  verifiedBy?: string;
  cleared: boolean;
}

export interface CallerVerification {
  id: string;
  sessionId: string;
  questions: { bn: string; en: string }[];
  responses: string[];
  passed: boolean | null;
  passedAt?: string;
  method: "knowledge_based" | "device" | "ivr";
}

export interface RepresentationAuthority {
  id: string;
  applicationId: string;
  callerName: string;
  callerRelation: string;
  state: RepresentationState;
  scopeNotes?: string;
  confirmedBy?: string;
  recordedAt: string;
  updatedAt: string;
}

export interface HumanHandoff {
  id: string;
  applicationId?: string;
  intakeSessionId?: string;
  reason:
    | "voice_failure"
    | "unsafe_answer"
    | "rep_out_of_scope"
    | "uncertain"
    | "identity_mismatch"
    | "accessibility_specialist"
    | "dlao"
    | "general"
    | "press_0"
    | "urgency_urgent"
    | "verification_needed";
  status: "queued" | "in_progress" | "acknowledged" | "completed" | "expired";
  targetRole: "dlao" | "officer" | "accessibility_specialist" | "supervisor" | "agent";
  assignedTo?: string;
  createdAt: string;
  completedAt?: string;
  acknowledgedAt?: string;
}

export type VerificationOutcome =
  | "applicant_confirmed"
  | "applicant_corrected"
  | "applicant_disputed"
  | "safe_contact_failed"
  | "unsafe_contact_failed";

export interface DlaoVerification {
  id: string;
  applicationId: string;
  handoffId: string;
  channel: "outbound_voice" | "in_person" | "ivr";
  attempts: number;
  outcome?: VerificationOutcome;
  safeContactCleared: boolean;
  corrections: { slot: SlotKey; oldValue: string; newValue: string }[];
  notes: { bn: string; en: string }[];
  createdAt: string;
  completedAt?: string;
  by: string;
}

export interface CommunicationEvent {
  id: string;
  sessionId: string;
  channel: "voice" | "sms" | "ivr" | "in_app" | "outbound_voice";
  direction: "inbound" | "outbound" | "system";
  actor: string;
  body: { bn: string; en: string };
  simulated: boolean;
  occurredAt: string;
}

export interface ConversationalIntakeTurn {
  speaker: "t5" | "caller";
  text: { bn: string; en: string };
  slot?: SlotKey;
  uncertain?: boolean;
  simulationTag?: "voice" | "sms" | "ivr";
  spokenAt: string;
}

export interface IntakeSession {
  id: string;
  applicationId?: string;
  status: IntakeStatus;
  channel: "helpline";
  turns: ConversationalIntakeTurn[];
  facts: Partial<Record<SlotKey, SlotValue>>;
  startedAt: string;
  endedAt?: string;
  interruptedAt?: string;
  voiceAvailable: boolean;
}

export interface SimulationMetadata {
  kind: "voice" | "sms" | "ivr" | "officer_lookup";
  note?: { bn: string; en: string };
  simulatedAt: string;
}

export interface AuditEvent {
  id: string;
  subject: string;
  subjectKind: "application" | "intake" | "representation" | "verification" | "handoff" | "communication" | "system" | "assisted_intake" | "document" | "sync_operation" | "sync_conflict" | "integrity" | "udc_session";
  action: string;
  actor: string;
  occurredAt: string;
  simulation?: SimulationMetadata;
  payload?: Record<string, unknown>;
}

export interface ApplicationRecord {
  applicationId: string;
  status: ApplicationStatus;
  channel: ApplicationChannel;
  office: string;
  intakeSessionId?: string;
  callerId?: string;
  applicantId?: string;
  representationId?: string;
  safeContact?: SafeContactEvaluation;
  urgencyIndicators: UrgencyIndicator[];
  facts: Partial<Record<SlotKey, SlotValue>>;
  provenance: ProvenanceEntry[];
  audit: string[];
  createdAt: string;
  submittedAt?: string;
}

export interface StoreEnvelope {
  v: 1;
  seededAt?: string;
  records: ApplicationRecord[];
  sessions: IntakeSession[];
  representations: RepresentationAuthority[];
  verifications: CallerVerification[];
  handoffs: HumanHandoff[];
  communications: CommunicationEvent[];
  audit: AuditEvent[];
  dlaoTasks: DlaoInboxTask[];
  /** Active call bar state — visible across helpline pages. */
  activeCallBar?: ActiveCallBarState;
  /** Human-agent intake continuation. */
  humanIntakes: HumanIntake[];
  /** DLAO field-verification records. */
  dlaoVerifications: DlaoVerification[];
  /** Safe-contact plans authored by DLAO / helpline. */
  safeContactPlans: SafeContactPlan[];
  /** Phase 5 — seeded offline drafts (Nuching + two extra). */
  offlineDrafts?: OfflineDraft[];
  /** Phase 5 — seeded sync conflicts (one demo entry). */
  syncConflicts?: SyncConflict[];
  /** Phase 5 — seeded integrity verifications. */
  integrityVerifications?: IntegrityVerification[];
  /** Phase 5 — performance comparison history. */
  performanceMeasurements?: PerformanceMeasurement[];
  /** Phase 5 — UDC assisted intakes (post-acknowledgement). */
  assistedIntakes?: AssistedIntake[];
  /** Phase 5 — temporary→authoritative id mapping. */
  idMappings?: TemporaryToAuthoritativeIdMap[];
  /** Phase 5 — last-known PWA capability snapshot. */
  pwaCapability?: PwaCapability;
}

export interface ActiveCallBarState {
  sessionId: string;
  callerName: string;
  applicantName?: string;
  channel: "voice" | "ivr";
  startedAt: string;
  muted: boolean;
  onHold: boolean;
  urgent: boolean;
  status: "ringing" | "active" | "on_hold" | "transferred" | "ended";
  /** Simulated IVR press-0 trigger. */
  route?: "ai" | "human" | "dlao";
}

export interface HumanIntake {
  id: string;
  sessionId: string;
  applicationId: string;
  agent: string;
  pickedUpAt: string;
  /** When the agent first took over; reset when caller hangs up. */
  status: "active" | "completed" | "transferred";
  notes: { bn: string; en: string }[];
  factOverrides: { slot: SlotKey; value: string }[];
  acknowledgedHandoffId?: string;
}

export interface DlaoInboxTask {
  id: string;
  applicationId: string;
  applicantName: string;
  reason: string;
  status: "queued" | "in_progress" | "completed";
  createdAt: string;
  notes?: string;
}

export class RepresentationOutOfScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepresentationOutOfScopeError";
  }
}

export class SafeContactBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeContactBlockedError";
  }
}

/* ================================================================== *
 *  Phase 5 — UDC Assisted Intake + Offline Sync + Integrity + PWA
 *
 *  - Every assisted field carries full provenance.
 *  - Offline state lives in IndexedDB, never only in component memory.
 *  - Sync uses an idempotency key + SHA-256 digest.
 *  - PWA capability is detected; nothing fabricated.
 * ================================================================== */

export type LanguageCode = "bn" | "en" | "marma" | "chakma" | "tripura" | "garo";
export type TranslationMethod =
  | "applicant_direct"
  | "human_interpreter"
  | "prototype_assistant"
  | "none";

export type ConsentTopic =
  | "form_entry_assistance"
  | "human_translation_or_interpretation"
  | "document_photography_or_upload"
  | "temporary_offline_storage"
  | "submission_to_dlas"
  | "safe_future_contact"
  | "udc_phone_use"
  | "limited_post_submission_updates";

export type ConsentMethod =
  | "oral_with_readback"
  | "applicant_action_on_accessible_control"
  | "witnessed_confirmation"
  | "other_recorded_assisted_method";

export interface AssistanceConsent {
  id: string;
  topic: ConsentTopic;
  /** Version of the notice text read to the applicant. */
  noticeVersion: string;
  language: LanguageCode;
  method: ConsentMethod;
  /** Who explained the notice aloud. */
  explainedBy: string;
  interpreter?: string;
  /** Applicant response — "yes" / "no" / "ask_again". */
  applicantResponse: "yes" | "no" | "ask_again";
  /** Witness for witnessed_confirmation. */
  witness?: string;
  obtainedAt: string;
  withdrawnAt?: string;
  note?: { bn: string; en: string };
}

export interface LanguagePreference {
  primary: LanguageCode;
  supportedInterface: LanguageCode;
  interpreterName?: string;
  interpreterLanguage?: LanguageCode;
  interpreterContact?: string;
}

export interface TranslationEvent {
  id: string;
  field: string;
  sourceLanguage: LanguageCode;
  originalText: string;
  translatedText?: string;
  personWhoSpoke: string;
  interpreterOrTranslator?: string;
  personWhoTyped: string;
  method: TranslationMethod;
  applicantConfirmation?: ReadBackConfirmation;
  uncertaintyNote?: { bn: string; en: string };
  occurredAt: string;
  auditReference?: string;
}

export type ReadBackStatus =
  | "not_yet_read_back"
  | "read_back_to_applicant"
  | "applicant_confirmed"
  | "applicant_corrected"
  | "interpreter_clarification_required"
  | "human_review_required";

export interface ReadBackConfirmation {
  status: ReadBackStatus;
  /** How the applicant confirmed: action, oral-with-readback, etc. */
  mechanism: ConsentMethod;
  confirmedAt?: string;
  /** If status === applicant_corrected, the prior value before correction. */
  priorValue?: string;
  note?: { bn: string; en: string };
}

export type ApplicantContactRouteKind =
  | "applicant_controlled_phone"
  | "trusted_contact"
  | "safe_scheduled_contact"
  | "voice_16699_status"
  | "dlao_follow_up"
  | "no_safe_phone"
  | "temporary_udc_number";

export interface ApplicantContactRoute {
  kind: ApplicantContactRouteKind;
  /** E.164 / Bangladeshi phone number — optional and never the UDC's. */
  value?: string;
  safeWindow?: { bn: string; en: string };
  expiresAt?: string;
  /** Explicit, recorded consent when the UDC number is used. */
  transactionOnly?: boolean;
  /** Reason that triggered the UDC-number fallback. */
  reason?: { bn: string; en: string };
  /** Follow-up task to establish safer applicant-controlled contact. */
  followUpTaskId?: string;
}

export interface AssistanceSession {
  id: string;
  /** Temporary offline UUID. Not an Application ID. */
  temporaryId: string;
  udcEntrepreneurId: string;
  applicantName: string;
  applicantSpokenLanguages: LanguageCode[];
  languagePreference: LanguagePreference;
  consents: AssistanceConsent[];
  translations: TranslationEvent[];
  applicantContact: ApplicantContactRoute;
  /** Soft-bound scope the UDC has within this session. */
  scopeNote?: { bn: string; en: string };
  startedAt: string;
  completedAt?: string;
}

export interface AssistedIntake {
  id: string;
  /** Temporary offline UUID while local. */
  temporaryId: string;
  assistanceSessionId: string;
  applicantName: string;
  district: string;
  matterType: string;
  languagePreference: LanguagePreference;
  consents: AssistanceConsent[];
  translations: TranslationEvent[];
  applicantContact: ApplicantContactRoute;
  documentCaptureIds: string[];
  checklistItemResults: { itemId: string; state: ChecklistItemState; note?: string }[];
  /** Confirmation chain per field — references translation.id. */
  readBacks: { field: string; confirmation: ReadBackConfirmation }[];
  freeServiceNoticeAcknowledged: boolean;
  state: AssistedIntakeState;
  /** Set after sync. */
  authoritativeApplicationId?: string;
  /** Local version counter. */
  localVersion: number;
  /** Last integrity digest. */
  integrityDigest?: string;
  /** Created/updated timestamps. */
  createdAt: string;
  updatedAt: string;
}

export type AssistedIntakeState =
  | "assisted_intake_started"
  | "local_draft"
  | "read_back_required"
  | "applicant_confirmed"
  | "ready_to_submit"
  | "queued_offline"
  | "synchronizing"
  | "synced"
  | "retry_scheduled"
  | "conflict_detected"
  | "integrity_review_required"
  | "manual_review_required"
  | "human_review"
  | "resolved"
  | "quality_review"
  | "accepted"
  | "retake_requested"
  | "limited_post_submission_access";

export type ChecklistItemState =
  | "required"
  | "optional"
  | "unavailable"
  | "uncertain"
  | "applicant_does_not_currently_have"
  | "captured"
  | "follow_up_required";

export interface ChecklistDefinition {
  id: string;
  matterType: string;
  notice: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  label: { bn: string; en: string };
  why: { bn: string; en: string };
  required: boolean;
}

export type DocumentQualityIssueCode =
  | "blur"
  | "glare"
  | "cropped_edges"
  | "low_contrast"
  | "missing_page"
  | "unreadable_text"
  | "wrong_document_category"
  | "duplicate_photograph"
  | "oversized_image"
  | "uncertain_orientation";

export interface DocumentQualityFinding {
  code: DocumentQualityIssueCode;
  message: { bn: string; en: string };
  guidance: { bn: string; en: string };
  severity: "warn" | "block";
}

export interface DocumentCapture {
  id: string;
  applicationOrDraftId: string;
  checklistItemId: string;
  capturedBy: string;
  capturedAt: string;
  pageCount: number;
  bytes: number;
  compressed: boolean;
  /** Indicates the page-order index in a multi-page capture. */
  pageOrder: number[];
  /** Quality outcome. */
  qualityFindings: DocumentQualityFinding[];
  /** Optional blob handle for IndexedDB storage. */
  blobKey?: string;
  /** Confirmed by applicant? */
  applicantConfirmed: boolean;
  /** Sensitivity classification. */
  sensitivity: "public" | "restricted";
  /** Document type. */
  documentType: { bn: string; en: string };
  /** Version (incremented on retake). */
  version: number;
}

/* ----- Offline persistence & sync queue ----- */

export type OfflineStatus =
  | "local_draft"
  | "ready_to_submit"
  | "queued_offline"
  | "synchronizing"
  | "synced"
  | "retry_scheduled"
  | "conflict_detected"
  | "manual_review_required"
  | "integrity_review_required"
  | "sync_failed_safely";

export interface OfflineDraft {
  id: string;
  /** Temporary offline UUID. NOT a Case ID. */
  temporaryId: string;
  /** Field snapshot for the assisted intake (JSON). */
  payload: Record<string, unknown>;
  /** Confirmed fields with full provenance. */
  confirmedFields: string[];
  provenance: TranslationEvent[];
  consent: AssistanceConsent[];
  documentMetadata: DocumentCapture[];
  /** Optional compressed image blob keys. */
  blobKeys: string[];
  syncStatus: OfflineStatus;
  /** Stable idempotency key for retries. */
  idempotencyKey: string;
  localVersion: number;
  lastModified: string;
  /** SHA-256 of the canonical payload (last good state). */
  integrityDigest: string;
  /** Last chained digest of local mutations. */
  chainDigest: string;
  retryCount: number;
  lastError?: string;
  /** Audit / local event reference. */
  lastEventRef?: string;
  /** Authoritative Application ID after sync. */
  authoritativeApplicationId?: string;
  /** Network profile at the time of queueing. */
  networkProfile: NetworkProfile;
}

export interface OfflineOperation {
  id: string;
  temporaryId: string;
  idempotencyKey: string;
  clientVersion: number;
  /** Simulated server version. */
  simulatedServerVersion: number;
  operationType: "submit_draft" | "update_draft" | "submit_documents" | "withdraw";
  payloadDigest: string;
  retryPolicy: { maxRetries: number; backoffMs: number };
  attempts: number;
  acknowledgement?: SyncReceipt;
  createdAt: string;
}

export interface SyncQueueItem {
  id: string;
  operation: OfflineOperation;
  draft: OfflineDraft;
  state: OfflineStatus;
  scheduledAt?: string;
  nextAction?: string;
  responsibleActor?: string;
  auditOrLocalEventRef?: string;
}

export interface SyncReceipt {
  id: string;
  temporaryId: string;
  authoritativeApplicationId: string;
  payloadDigest: string;
  serverAckAt: string;
  message: { bn: string; en: string };
  /** Verifies the synchronized payload matches acknowledged payload. */
  verificationId: string;
}

export interface IdempotencyRecord {
  key: string;
  operationType: OfflineOperation["operationType"];
  /** Result returned for first successful execution. */
  result?: SyncReceipt;
  attempts: number;
  lastAttemptAt: string;
  history: { at: string; outcome: "ok" | "duplicate" | "fail"; digest: string }[];
}

export type SyncConflictKind =
  | "field_value"
  | "document_status"
  | "safe_contact"
  | "representation"
  | "identity"
  | "consent";

export interface SyncConflict {
  id: string;
  temporaryId: string;
  kind: SyncConflictKind;
  fieldOrObject: string;
  baseVersion: string;
  authoritativeValue: string;
  authoritativeActor: string;
  authoritativeAt: string;
  offlineValue: string;
  offlineActor: string;
  offlineAt: string;
  provenance: { bn: string; en: string };
  safetyImplications?: { bn: string; en: string };
  suggestedMerge?: { kind: "accept_offline" | "keep_authoritative" | "preserve_both" | "defer_review"; note?: string };
  resolution?: ConflictResolution;
}

export type ConflictDecision =
  | "keep_authoritative_value"
  | "accept_offline_value"
  | "preserve_both_as_separate_facts"
  | "request_applicant_confirmation"
  | "defer_for_specialist_review";

export interface ConflictResolution {
  reviewer: string;
  decision: ConflictDecision;
  reason: { bn: string; en: string };
  resolvedAt: string;
  resultingVersion: string;
  resultingValue?: string;
  auditEventRef?: string;
}

export interface IntegrityDigest {
  algorithm: "sha-256";
  /** Hex digest. */
  hex: string;
  generatedAt: string;
  /** The canonical serialization that produced this digest. */
  canonicalForm: string;
}

export interface IntegrityVerification {
  id: string;
  temporaryId: string;
  submittedDigest: string;
  acknowledgedDigest: string;
  result: "pass" | "mismatch" | "unverifiable";
  verifiedAt: string;
  reviewer?: string;
  note?: { bn: string; en: string };
}

/* ----- Network condition + PWA ----- */

export type NetworkProfileKind =
  | "normal"
  | "slow"
  | "intermittent"
  | "offline"
  | "reconnected";

export interface NetworkProfile {
  kind: NetworkProfileKind;
  latencyMs: number;
  /** 0..1 simulated packet-loss probability. */
  packetLoss: number;
  /** Bytes/sec simulated bandwidth cap. */
  bandwidthBps: number;
  /** Plain-language status label (text + icon, not color alone). */
  statusLabel: { bn: string; en: string };
  /** When the profile last changed. */
  setAt: string;
}

export interface PwaCapability {
  /** Service worker registered. */
  serviceWorker: boolean;
  /** Web app manifest present. */
  manifest: boolean;
  /** BeforeInstallPrompt fired. */
  installPrompt: boolean;
  /** Standalone display mode. */
  standaloneDisplay: boolean;
  /** Notes — usually environment limitations. */
  notes: { bn: string; en: string }[];
  /** When this snapshot was taken. */
  capturedAt: string;
}

export interface CachePolicy {
  /** Safe to cache: app shell, fonts, icons, translations. */
  safeToCache: string[];
  /** Restricted local storage: active draft, consent, documents. */
  restrictedLocal: string[];
  /** Items that must never be cached by default. */
  neverCached: string[];
  /** Expiry for restricted items. */
  restrictedExpiryMs: number;
  notes: { bn: string; en: string };
}

export interface PerformanceMeasurement {
  id: string;
  mode: "normal" | "light";
  networkProfile: NetworkProfileKind;
  measurements: {
    appShellLoadMs: number;
    firstInteractionMs: number;
    transferredBytes: number;
    documentPreviewLoadMs: number;
    saveDraftMs: number;
    reopenDraftMs: number;
  };
  measuredAt: string;
  /** Honest labels — anything estimated. */
  estimates: string[];
  deviceAssumptions: string[];
}

export interface TemporaryToAuthoritativeIdMap {
  temporaryId: string;
  authoritativeApplicationId: string;
  syncedAt: string;
  syncReceiptId: string;
  actor: string;
  channel: "udc_offline_sync" | "helpline" | "portal" | "in_person";
}

/* ----- UDC authorization ----- */

export type UdcAction =
  | "intake.start"
  | "intake.resume"
  | "consent.record"
  | "translation.record"
  | "document.capture"
  | "document.quality.override"
  | "checklist.complete"
  | "draft.save"
  | "submission.queue"
  | "submission.sync"
  | "clarification.respond"
  | "post_submission.view"
  | "case_support.view_synced";

export interface UdcAuthorization {
  action: UdcAction;
  allowed: boolean;
  reason?: string;
}

/* ----- Audit extension is handled by the merged AuditEvent above ----- */
