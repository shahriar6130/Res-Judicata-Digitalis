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
  | "referral"
  /* Canonical DLAS doors mirrored from lib/dlas (read-only projections). */
  | "ivr"
  | "ussd"
  | "mobile_app";

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
  | "field_officer"
  | "helpline"
  | "dlao"
  | "lawyer"
  | "applicant"
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
  kind: "voice" | "sms" | "ivr" | "officer_lookup" | "system";
  note?: { bn: string; en: string };
  simulatedAt: string;
}

export interface AuditEvent {
  id: string;
  subject: string;
  subjectKind: "application" | "intake" | "representation" | "verification" | "handoff" | "communication" | "system" | "assisted_intake" | "document" | "sync_operation" | "sync_conflict" | "integrity" | "udc_session" | "referral" | "evidence" | "escalation" | "panel_lawyer" | "lawyer_assignment" | "lawyer_availability" | "hearing" | "case_progress" | "required_update" | "lawyer_change" | "reassignment" | "case_handover" | "inactivity_pattern" | "payment_reconciliation" | "fee_schedule" | "contact_attempt" | "voice_session" | "mediation_matter" | "mediation_session" | "settlement_draft" | "signing_workflow" | "dlao_task";
  action: string;
  actor: string;
  occurredAt: string;
  simulation?: SimulationMetadata;
  payload?: Record<string, unknown>;
}

export interface ApplicationRecord {
  applicationId: string;
  /** Minted once when a panel-lawyer assignment is created or on seed for long-running cases. Preserved through reassignment. */
  caseId?: string;
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
  /** Prompt 8 — current case-stage label, owned by the lawyer + DLAO pair. */
  caseStage?: CaseStage;
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
  /** Prompt 7 — referrals (one per workflow object, keyed to the same applicationId). */
  referrals: Referral[];
  /** Prompt 7 — sensitive evidence store (per applicationId). */
  sensitiveEvidence: SensitiveEvidenceStore;
  /** Prompt 7 — authority directory (configured receiving bodies). */
  authorityDirectory: AuthorityDirectoryEntry[];
  /** Prompt 7 — versioned legal-basis registry. */
  legalBasis: LegalBasisEntry[];
  /** Prompt 7 — routing recommendations emitted by the routing service. */
  routingRecommendations: RoutingRecommendation[];
  /** Prompt 7 — delivery operations log. */
  deliveryOperations: DeliveryOperation[];
  /** Prompt 7 — escalation tasks (incl. jurisdiction tug-of-war). */
  escalationTasks: EscalationTask[];
  /** Prompt 7 — citizen-safe notification drafts. */
  citizenSafeStatuses: CitizenSafeStatus[];
  /** Prompt 7 — inbox projections (derived; mirrors for cross-tab updates). */
  referralInbox?: ReferralInboxItem[];
  escalationInbox?: EscalationInboxItem[];
  deliveryInbox?: DeliveryInboxItem[];
  /** Prompt 7 — sent reminders for overdue referrals. */
  referralReminders?: ReferralReminderItem[];
  /** Prompt 7 — demo time offset (ms added to wall clock). Used to fast-forward past deadlines. */
  demoTimeOffsetMs?: number;

  /* Prompt 8 — Long-running case, panel-lawyer workflow, accountability. */
  panelLawyers: PanelLawyer[];
  lawyerAvailabilities: LawyerAvailability[];
  lawyerAssignments: LawyerAssignment[];
  lawyerAssignmentResponses: AssignmentResponse[];
  caseHearings: CaseHearing[];
  caseProgressUpdates: CaseProgressUpdate[];
  requiredUpdates: RequiredUpdate[];
  updateReminders: UpdateReminder[];
  contactReliabilities: ContactReliability[];
  contactAttempts: ContactAttempt[];
  lawyerChangeRequests: LawyerChangeRequest[];
  lawyerChangeReviews: LawyerChangeReview[];
  reassignments: Reassignment[];
  caseHandovers: CaseHandover[];
  inactivityPatterns: InactivityPattern[];
  patternReviews: { reviewId: string; patternId: string; decision: PatternReviewDecision; recordedAt: string }[];
  feeSchedules: FeeSchedule[];
  paymentStages: PaymentStage[];
  paymentReconciliations: PaymentReconciliation[];
  voiceStatusSessions: VoiceStatusSession[];
  dlaoTaskItems: DlaoTaskItem[];

  /* Prompt 10 — mediation & settlement (B2, Flow 4, T7). */
  mediationMatters: MediationMatter[];
  mediationSessions: MediationSession[];
  settlementDrafts: SettlementDraft[];
  signingWorkflows: SigningWorkflow[];
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
  | "other_recorded_assisted_method"
  | "video_consent_capture";

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

/* ====================================================================
 *  Phase 6: Status visit + letter access (per prompt §11)
 * ==================================================================== */

/** A scheduled in-person 4 PM status visit at the UDC. */
export type StatusVisitState =
  | "presence_recorded"
  | "awaiting_applicant_auth"
  | "verified"
  | "ended"
  | "expired";

export interface StatusVisitSession {
  id: string;
  applicationId: string;
  udcEntrepreneurId: string;
  applicantDisplayName: string;
  applicantPresent: boolean;
  presenceMethod: "in_person_udc" | "video_call" | "ivr_16699";
  startedAt: string;
  endedAt?: string;
  expiresAt: string;
  state: StatusVisitState;
}

/** Single-session, purpose-bound token — NEVER opens letters. */
export interface StatusVisitToken {
  id: string;
  sessionId: string;
  applicationId: string;
  scope: "APPLICANT_ASSISTED_VIEW";
  purpose: "status_check" | "document_help" | "letter_help";
  issuedAt: string;
  expiresAt: string;
  authorizationMethod: "applicant_pin_ivr" | "biometric_local" | "human_alternative";
  /** Non-reversible identifier fingerprint — never the PIN itself. */
  applicantIdentifierHash: string;
  revoked: boolean;
}

/** Separate token that unlocks exactly one letter — never broader content. */
export interface LetterAccessToken {
  id: string;
  sessionId: string;
  applicationId: string;
  letterId: string;
  scope: "LETTER_ACCESS";
  purpose: "letter_read";
  issuedAt: string;
  expiresAt: string;
  authorizationMethod: "ivr_pin" | "human_alternative";
  revoked: boolean;
}

/** Audit-only record of an IVR/PIN attempt. The PIN itself is NEVER stored. */
export interface LetterAccessAttempt {
  id: string;
  applicationId: string;
  letterId: string;
  ivrCallId: string;
  at: string;
  outcome: "verified" | "mismatch" | "locked_out" | "human_alternative_used";
}

/* ====================================================================
 *  Prompt 7 — Referral workflow, sensitive evidence vault, jurisdiction escalation.
 *
 *  All types here plug into the existing StoreEnvelope + AuditTrailService.
 *  A referral is a workflow object attached to the same ApplicationRecord
 *  (or accepted Case ID) — never a second case record.
 * ==================================================================== */

export type ReferralType =
  | "sensitive_evidence_review"
  | "jurisdiction_transfer"
  | "specialist_assessment"
  | "external_authority";

export type ReferralPriority = "standard" | "urgent" | "overdue";

export type ReferralSensitivity = "standard" | "sensitive" | "highly_sensitive";

export type ReferralState =
  | "draft"
  | "package_review"
  | "authorized"
  | "sending"
  | "delivered"
  | "awaiting_acknowledgment"
  | "acknowledged"
  | "accepted"
  | "action_in_progress"
  | "completed"
  | "delivery_failed"
  | "information_requested"
  | "returned"
  | "overdue_acknowledgment"
  | "overdue_action"
  | "escalation_required"
  | "escalated"
  | "superseded"
  | "withdrawn_by_authorized_user";

export type ReferralReasonCategory =
  | "another_competent_authority_required"
  | "specialist_service_required"
  | "jurisdiction_dispute"
  | "sensitive_evidence_review"
  | "missing_information"
  | "external_deadline";

export type ReferralReturnReason =
  | "required_information_missing"
  | "required_document_missing"
  | "document_unreadable"
  | "package_corrupted"
  | "receiving_office_outside_route"
  | "duplicate_referral"
  | "existing_responsible_office"
  | "legal_basis_verification_required"
  | "other";

export interface ReferralDeadline {
  acknowledgmentDeadline: string;
  actionDeadline: string;
  escalationDeadline: string;
  /** ISO timestamps are real wall-clock + StoreEnvelope.demoTimeOffsetMs. */
  computedAt: string;
}

export interface ReferralParty {
  role: "sending_officer" | "receiving_officer" | "assigned_receiving_officer" | "responsible_officer";
  name: string;
  office: string;
  email?: string;
  phone?: string;
}

export interface ReferralDocumentSelection {
  documentId: string;
  /** "original" = the source-of-truth file; "derivative" = a redaction. */
  kind: "original" | "derivative";
  derivativeId?: string;
  sensitivity: ReferralSensitivity;
  /** Receiving role permitted to view this document. */
  receivingRolePermission: "sending_officer" | "receiving_officer" | "assigned_receiving_officer" | "reviewer";
  /** Why this document is included in the package. */
  purpose: string;
  integrityHash: string;
  included: boolean;
}

export interface ReferralHistoryItem {
  id: string;
  occurredAt: string;
  actor: string;
  role: string;
  action: string;
  fromState?: ReferralState;
  toState?: ReferralState;
  reason?: string;
  relatedTaskId?: string;
  auditEventId?: string;
  rulesetVersion?: string;
  payload?: Record<string, unknown>;
}

export interface ReferralPackage {
  referralId: string;
  applicationId: string;
  /** "DLAS-..." once the application has been accepted into a case. */
  caseId?: string;
  type: ReferralType;
  reasonCategory: ReferralReasonCategory;
  reason: string;
  expectedAction: string;
  priority: ReferralPriority;
  sensitivity: ReferralSensitivity;
  sendingOffice: string;
  receivingOffice: string;
  /** Authority directory entry referenced. */
  authorityDirectoryEntryId?: string;
  /** Routing recommendation issued at draft time. */
  routingRecommendationId?: string;
  /** History items. */
  history: ReferralHistoryItem[];
  /** Document selections (subset of original case documents). */
  documentSelections: ReferralDocumentSelection[];
  /** Selected case history entries from the shared record. */
  selectedHistoryIds: string[];
  /** Safe-contact rule applied. */
  safeContactRuleIds: string[];
  /** Applicant-notification rule applied. */
  applicantNotificationRule?: "no_contact" | "safe_follow_up" | "in_person_only";
  /** Sending officer. */
  sendingOfficer: ReferralParty;
  /** Receiving officer (assigned later). */
  receivingOfficer?: ReferralParty;
  /** Deadlines. */
  deadline: ReferralDeadline;
  /** Escalation path. */
  escalationOwner: string;
  /** State machine. */
  state: ReferralState;
  /** Operation id for delivery (idempotency). */
  operationId?: string;
  /** Acknowledgment. */
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  /** Acceptance (separate from acknowledgment). */
  acceptedAt?: string;
  acceptedBy?: string;
  /** Return — most recent. */
  returnedAt?: string;
  returnedBy?: string;
  returnReason?: ReferralReturnReason;
  returnNote?: string;
  /** Missing info request. */
  missingInformationRequest?: {
    requestedAt: string;
    requestedBy: string;
    note: string;
    resolvedAt?: string;
  };
  /** First action recorded by receiving office. */
  firstAction?: {
    recordedAt: string;
    recordedBy: string;
    note: string;
  };
  /** Last action deadline compliance. */
  completedAt?: string;
  /** Escalation task reference. */
  escalationTaskId?: string;
  /** Superseded by another referral. */
  supersededByReferralId?: string;
  /** Withdrawn by an authorized user. */
  withdrawnAt?: string;
  withdrawnBy?: string;
  withdrawalReason?: string;
  /** Integrity hash of the package as sent. */
  integrityHash?: string;
  /** Audit reference. */
  auditReference?: string;
  /** Creation/sent timestamps. */
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  /** Human priority decision. */
  humanPriorityDecision?: {
    decidedAt: string;
    decidedBy: string;
    decision: ReferralPriority;
    reason: string;
    informationReliedUpon: string;
    safetyAction: string;
    responsiblePerson: string;
    reviewDeadline: string;
    systemRecommendation: ReferralPriority;
    override: boolean;
    overrideReason?: string;
  };
  /** Reminder attempts. */
  remindersSent: { at: string; by: string; outcome: "sent" | "delivered" | "undeliverable" }[];
  /** Delivery attempts (idempotency). */
  deliveryAttempts: { operationId: string; at: string; outcome: string }[];
}

export interface Referral {
  referralId: string;
  /** Always equals the source ApplicationRecord.applicationId. */
  applicationId: string;
  /** Snapshot of the current state machine position. */
  package: ReferralPackage;
}

export interface SensitiveEvidenceItem {
  evidenceId: string;
  applicationId: string;
  /** "image" | "screenshot" | "message_export" | "document". */
  kind: "image" | "screenshot" | "message_export" | "document" | "audio";
  fileType: string;
  bytes: number;
  submittedBy: string;
  subject: string;
  sourceChannel: string;
  originalFilename?: string;
  capturedAt?: string;
  uploadedAt: string;
  version: number;
  hash: string;
  accessClassification: "standard" | "restricted" | "highly_restricted";
  verificationStatus: "received" | "verified" | "corrupted";
  sharingStatus: "private" | "shared_with_referral" | "redacted_derivative_created";
  retentionStatus: "active" | "scheduled_for_deletion";
}

export interface EvidenceDerivative {
  derivativeId: string;
  parentEvidenceId: string;
  transformation: "redaction" | "compression" | "crop" | "transcription";
  newHash: string;
  responsibleActor: string;
  createdAt: string;
  note?: string;
}

export interface EvidenceAccessPurpose {
  code:
    | "urgency_review"
    | "referral_package_preparation"
    | "applicant_requested_correction"
    | "authorized_legal_review"
    | "receiving_authority_review";
  labelBn: string;
  labelEn: string;
}

export const EVIDENCE_ACCESS_PURPOSES: EvidenceAccessPurpose[] = [
  {
    code: "urgency_review",
    labelBn: "জরুরি পর্যালোচনা",
    labelEn: "Urgency review",
  },
  {
    code: "referral_package_preparation",
    labelBn: "রেফারেল প্যাকেজ প্রস্তুতি",
    labelEn: "Referral-package preparation",
  },
  {
    code: "applicant_requested_correction",
    labelBn: "আবেদনকারী-অনুরোধিত সংশোধন",
    labelEn: "Applicant-requested correction",
  },
  {
    code: "authorized_legal_review",
    labelBn: "অনুমোদিত আইনি পর্যালোচনা",
    labelEn: "Authorized legal review",
  },
  {
    code: "receiving_authority_review",
    labelBn: "প্রাপ্তিস্থান কর্তৃপক্ষের পর্যালোচনা",
    labelEn: "Receiving-authority review",
  },
];

export interface EvidenceAccessGrant {
  grantId: string;
  evidenceId: string;
  applicationId: string;
  purpose: EvidenceAccessPurpose["code"];
  grantedTo: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string;
  reauthMethod: "pin_ivr" | "biometric_local" | "human_alternative" | "officer_supervisor_attestation";
  revokedAt?: string;
  revokedBy?: string;
  minimumNecessary: boolean;
}

export interface EvidenceAccessEvent {
  eventId: string;
  evidenceId: string;
  applicationId: string;
  grantId?: string;
  actor: string;
  role: string;
  purpose: EvidenceAccessPurpose["code"];
  action: "viewed" | "downloaded" | "shared_with_referral" | "redacted" | "denied" | "grant_created" | "grant_revoked";
  occurredAt: string;
  version: number;
  relatedTaskId?: string;
  auditEventId: string;
}

export interface SensitiveEvidenceStore {
  items: SensitiveEvidenceItem[];
  derivatives: EvidenceDerivative[];
  grants: EvidenceAccessGrant[];
  events: EvidenceAccessEvent[];
}

export interface AuthorityDirectoryEntry {
  entryId: string;
  displayNameBn: string;
  displayNameEn: string;
  type:
    | "district_legal_aid_office"
    | "labour_legal_aid_cell"
    | "authorized_legal_aid_unit"
    | "court_or_tribunal"
    | "other_competent_authority";
  geographicCoverage: string[];
  subjectCoverage: string[];
  intakeChannel: "secure_digital" | "paper" | "ivr" | "email";
  secureIntegration: "connected" | "planned" | "manual_only";
  acknowledgmentMethod: "secure_api" | "paper" | "ivr" | "manual";
  workingHours?: string;
  emergencyRoute?: string;
  requiredReferralFields: string[];
  acceptedDocumentTypes: string[];
  acknowledgmentDeadlineHours: number;
  escalationContact?: string;
  effectiveDate: string;
  expiryDate?: string;
  reviewDate: string;
  sourceOfAuthority: string;
  verificationStatus: "verified" | "unverified" | "expired";
  verifiedBy?: string;
  lastReviewedAt?: string;
  notes?: { bn: string; en: string };
}

export interface LegalBasisEntry {
  basisId: string;
  instrument: string;
  reference: string;
  effectiveDate: string;
  area: string;
  matterCategory: string;
  receivingAuthorityType: AuthorityDirectoryEntry["type"];
  requiredDocuments: string[];
  timeRequirement: string;
  humanReviewRequired: boolean;
  officialSource: string;
  verificationStatus: "verified" | "unverified" | "superseded";
  verifiedBy?: string;
  lastReviewedAt?: string;
  rulesetVersion: string;
  supersededByBasisId?: string;
  notes?: { bn: string; en: string };
}

export interface RoutingRecommendation {
  recommendationId: string;
  applicationId: string;
  generatedAt: string;
  recommendedDestination: { entryId: string; displayName: string; type: AuthorityDirectoryEntry["type"] };
  confidence:
    | "sufficient_for_human_review"
    | "incomplete"
    | "conflicting"
    | "no_verified_route";
  reasons: { bn: string; en: string }[];
  sourceFields: string[];
  missingOrUncertain: { bn: string; en: string }[];
  conflicts: { bn: string; en: string }[];
  rulesetVersion: string;
  /** Human override recorded. */
  humanDecision?: {
    decidedAt: string;
    decidedBy: string;
    accepted: boolean;
    modifiedDestinationEntryId?: string;
    reason: string;
    authorityForDecision: string;
  };
}

export interface DeliveryOperation {
  operationId: string;
  referralId: string;
  initiatedAt: string;
  initiatedBy: string;
  outcome:
    | "delivered_successfully"
    | "delivery_delayed"
    | "endpoint_unavailable"
    | "authentication_failure"
    | "duplicate_attempt"
    | "package_integrity_mismatch"
    | "delivered_acknowledgment_pending";
  message?: string;
  completedAt?: string;
}

export interface EscalationTask {
  escalationId: string;
  /** Either referralId or applicationId. */
  referralId?: string;
  applicationId: string;
  caseId?: string;
  reason:
    | "overdue_acknowledgment"
    | "overdue_action"
    | "repeated_transfer"
    | "missing_return_reason"
    | "expired_authority_entry"
    | "unverified_legal_basis";
  state:
    | "first_transfer"
    | "first_return"
    | "second_transfer"
    | "second_return"
    | "repeat_detected"
    | "human_review_required"
    | "human_decision_recorded"
    | "route_assigned"
    | "receiving_authority_acknowledged";
  history: { at: string; from: EscalationTask["state"]; to: EscalationTask["state"]; actor: string; reason: string }[];
  responsibleReviewer?: string;
  createdAt: string;
  resolvedAt?: string;
  humanDecision?: HumanRoutingDecision;
}

export interface HumanRoutingDecision {
  decisionId: string;
  escalationId: string;
  applicationId: string;
  decidedAt: string;
  decidedBy: string;
  decision: "select_final_route" | "return_to_sender" | "request_clarification" | "retain_temporarily" | "direct_coordinated_action";
  destinationEntryId?: string;
  reason: string;
  authorityForDecision: string;
  nextDeadline?: string;
  nextResponsibleOffice?: string;
  relatedReferralId?: string;
}

export interface CitizenSafeStatus {
  notificationId: string;
  applicationId: string;
  recordId: string;
  generatedAt: string;
  safeMessageBn: string;
  safeMessageEn: string;
  nextSafeAction?: string;
  approvedContactMethod: "phone" | "sms" | "in_person";
  clearedBy: string;
}

/* The StoreEnvelope extension — new top-level arrays. */
declare module "./types" {
  // intentionally empty; type augmentation lives below
}

export interface ReferralInboxItem {
  itemId: string;
  referralId: string;
  forOffice: string;
  state: ReferralState;
  createdAt: string;
  reason: string;
}

export interface EscalationInboxItem {
  itemId: string;
  escalationId: string;
  forReviewer: string;
  state: EscalationTask["state"];
  createdAt: string;
  reason: string;
}

export interface DeliveryInboxItem {
  itemId: string;
  operationId: string;
  referralId: string;
  forOffice: string;
  outcome: DeliveryOperation["outcome"];
  createdAt: string;
}

export interface ReferralReminderItem {
  itemId: string;
  referralId: string;
  attemptNumber: number;
  channel: "sms" | "voice" | "in_app";
  createdAt: string;
  outcome: "sent" | "delivered" | "undeliverable";
  recipientOffice: string;
}

/* ============================================================== *
 *  PROMPT 8 — Long-running case, panel-lawyer, accountability
 * ============================================================== */

export type CaseStage =
  | "intake"
  | "panel_assignment"
  | "lawyer_engagement"
  | "fact_gathering"
  | "filing"
  | "hearing_preparation"
  | "hearing_in_progress"
  | "order_received"
  | "adjourned"
  | "compliance"
  | "outcome_reported"
  | "case_closed"
  | "reassignment_pending"
  | "stayed";

export interface PanelLawyer {
  lawyerId: string;
  fullNameBn: string;
  fullNameEn: string;
  enrollmentNumber: string;
  barAssociation: string;
  panelStatus: "approved" | "unverified" | "expired" | "removed";
  courtEligibility: string[];
  matterCategories: string[];
  languages: ("bn" | "en")[];
  /** Self-reported, never treated as a guarantee. */
  availability: LawyerAvailabilityStatus;
  activeCaseCount: number;
  upcomingHearingCount: number;
  overdueRequiredUpdateCount: number;
  lastAssignmentAt?: string;
  conflictCheckCompleted?: boolean;
  joinedPanelAt: string;
  notes?: string;
}

export type LawyerAvailabilityStatus =
  | "available"
  | "busy"
  | "temporarily_unavailable"
  | "on_approved_leave"
  | "not_accepting_new";

export interface LawyerAvailability {
  availabilityId: string;
  lawyerId: string;
  status: LawyerAvailabilityStatus;
  effectiveAt: string;
  expectedReturnAt?: string;
  optionalCapacity?: "low" | "medium" | "high";
  reasonCategory?: "leave" | "illness" | "personal" | "training" | "court_duty" | "system_outage" | "other";
  reasonNote?: string;
  lastConfirmedAt: string;
  source: "self_report" | "dlao_recorded" | "system_detected";
}

export type AssignmentState =
  | "prepared"
  | "offered"
  | "awaiting_response"
  | "accepted"
  | "declined"
  | "expired"
  | "active"
  | "handover_required"
  | "reassigned"
  | "completed"
  | "ended";

export type AssignmentDeclineReason =
  | "conflict_of_interest"
  | "unavailable_during_critical_date"
  | "matter_outside_panel_scope"
  | "capacity_limitation"
  | "incomplete_assignment_package"
  | "other";

export interface LawyerAssignment {
  assignmentId: string;
  applicationId: string;
  caseId: string;
  lawyerId: string;
  state: AssignmentState;
  preparedBy: string;
  preparedAt: string;
  offeredAt?: string;
  responseDeadline?: string;
  reasonForAssignment: string;
  applicantPreferenceConsidered: boolean;
  conflictCheckCompleted: boolean;
  workloadReviewed: boolean;
  requiredFirstAction: string;
  acceptedAt?: string;
  declinedAt?: string;
  declineReason?: AssignmentDeclineReason;
  declineNote?: string;
  becameActiveAt?: string;
  endedAt?: string;
  endedReason?: string;
  /** Set when a successor assignment is created; original history is preserved. */
  supersededByAssignmentId?: string;
  history: AssignmentHistoryItem[];
  auditEventIds: string[];
}

export interface AssignmentHistoryItem {
  at: string;
  actor: string;
  fromState?: AssignmentState;
  toState: AssignmentState;
  reason?: string;
  note?: string;
  auditEventId?: string;
}

export interface AssignmentResponse {
  responseId: string;
  assignmentId: string;
  lawyerId: string;
  decision: "accepted" | "declined" | "request_clarification";
  at: string;
  declineReason?: AssignmentDeclineReason;
  note?: string;
  clarificationRequest?: string;
}

export interface CaseHearing {
  hearingId: string;
  caseId: string;
  court: string;
  hearingDate: string;
  hearingTime?: string;
  source: "court_cause_list" | "lawyer_recorded" | "dlao_recorded" | "applicant_reported" | "other";
  sourceDocument?: string;
  sourceNote?: string;
  verificationStatus: "reported" | "awaiting_verification" | "verified" | "rescheduled" | "cancelled" | "completed" | "result_overdue";
  attendanceRequirement: "must_attend" | "may_attend" | "no_attendance_required" | "unknown";
  responsibleLawyerId?: string;
  reminderSchedule: { at: string; channel: "sms" | "voice" | "in_app" }[];
  hearingResult?: HearingResult;
  nextHearingId?: string;
  lastUpdatedBy?: string;
  versionHistory: HearingVersionEntry[];
  createdAt: string;
}

export interface HearingVersionEntry {
  version: number;
  changedAt: string;
  changedBy: string;
  previousDate?: string;
  newDate?: string;
  reason: string;
}

export interface HearingResult {
  recordedAt: string;
  recordedBy: string;
  outcome: "hearing_held" | "adjourned" | "order_received" | "withdrawn" | "other";
  summary: string;
  orderReceived?: boolean;
  orderSummary?: string;
  nextHearingDate?: string;
}

export type ProgressUpdateType =
  | "assignment_accepted"
  | "client_contact_attempted"
  | "client_contact_completed"
  | "document_reviewed"
  | "filing_prepared"
  | "filing_submitted"
  | "hearing_attended"
  | "hearing_adjourned"
  | "order_received"
  | "next_hearing_recorded"
  | "additional_information_required"
  | "case_stage_changed"
  | "outcome_reported"
  | "unable_to_continue"
  | "other";

export interface CaseProgressUpdate {
  updateId: string;
  caseId: string;
  lawyerId: string;
  updateType: ProgressUpdateType;
  eventDate: string;
  submissionDate: string;
  caseStageAtUpdate?: CaseStage;
  courtOrLocation?: string;
  summary: string;
  source?: string;
  supportingDocumentId?: string;
  nextHearingId?: string;
  nextAction?: string;
  responsibleActor?: string;
  citizenVisibleSummary?: string;
  internalNote?: string;
  confirmationStatus: "draft" | "submitted" | "verified" | "disputed";
  auditEventId?: string;
}

export type RequiredUpdateTrigger =
  | "assignment_acceptance"
  | "upcoming_hearing"
  | "completed_hearing"
  | "received_order"
  | "case_stage"
  | "dlao_request"
  | "periodic_reporting";

export type RequiredUpdateState =
  | "scheduled"
  | "upcoming"
  | "due"
  | "reminded"
  | "overdue"
  | "explanation_received"
  | "completed"
  | "waived"
  | "escalated";

export interface RequiredUpdate {
  requirementId: string;
  caseId: string;
  lawyerId: string;
  trigger: RequiredUpdateTrigger;
  requiredUpdateType: ProgressUpdateType;
  createdAt: string;
  dueAt: string;
  reminderSchedule: { at: string; channel: "sms" | "voice" | "in_app" }[];
  state: RequiredUpdateState;
  completedByUpdateId?: string;
  exception?: UpdateException;
  escalationRuleId?: string;
  notes?: string;
}

export interface UpdateException {
  exceptionId: string;
  reason: "approved_leave" | "system_outage" | "waived_by_officer" | "case_stayed" | "alternative_channel_submission";
  notedBy: string;
  notedAt: string;
  note: string;
}

export interface UpdateReminder {
  reminderId: string;
  requirementId: string;
  sentAt: string;
  channel: "sms" | "voice" | "in_app";
  outcome: "sent" | "delivered" | "undeliverable" | "failed_delivery";
  recipientLawyerId: string;
  templateVersion: string;
  note?: string;
}

export type LawyerChangeReasonCategory =
  | "unable_to_contact_lawyer"
  | "no_case_update_received"
  | "hearing_information_not_provided"
  | "communication_accessibility_problem"
  | "safety_or_trust_concern"
  | "conflict_concern"
  | "lawyer_reported_inability_to_continue"
  | "other";

export type LawyerChangeRequestState =
  | "submitted"
  | "triage"
  | "under_review"
  | "lawyer_response_requested"
  | "continuity_decision"
  | "approved_for_reassignment"
  | "retained_with_action"
  | "clarification_required"
  | "escalated"
  | "handover"
  | "new_lawyer_acceptance"
  | "completed";

export interface LawyerChangeRequest {
  requestId: string;
  caseId: string;
  applicationId: string;
  applicantName: string;
  submittedAt: string;
  submittedThrough: "self" | "helpline_assisted" | "dlao_assisted" | "voice_ivr" | "field_officer" | "other";
  submittedBy: string;
  reasonCategory: LawyerChangeReasonCategory;
  reasonNote: string;
  supportingInfo?: string;
  safeContactInstruction?: string;
  urgency: "low" | "medium" | "high";
  requestedOutcome?: string;
  state: LawyerChangeRequestState;
  responsibleReviewer?: string;
  dueAt?: string;
  history: LawyerChangeHistoryItem[];
  auditEventIds: string[];
}

export interface LawyerChangeHistoryItem {
  at: string;
  actor: string;
  fromState?: LawyerChangeRequestState;
  toState: LawyerChangeRequestState;
  reason?: string;
  note?: string;
}

export type LawyerChangeDecision =
  | "keep_lawyer_corrective_action"
  | "request_immediate_update"
  | "arrange_communication_support"
  | "temporarily_assign_backup_support"
  | "reassign_lawyer"
  | "return_for_clarification"
  | "escalate_for_authorized_review"
  | "other";

export interface LawyerChangeReview {
  reviewId: string;
  requestId: string;
  decidedAt: string;
  decidedBy: string;
  decision: LawyerChangeDecision;
  reason: string;
  evidenceConsidered: string;
  effectiveDate?: string;
  nextAction?: string;
  nextReviewDate?: string;
}

export interface Reassignment {
  reassignmentId: string;
  requestId: string;
  caseId: string;
  fromLawyerId: string;
  toLawyerId?: string;
  recordedAt: string;
  recordedBy: string;
  decision: LawyerChangeReview;
  continuityOwnerLawyerId?: string;
  freezePriorAssignment: boolean;
  handoverPackageId?: string;
  newLawyerAcceptanceDeadline?: string;
  history: { at: string; actor: string; note: string }[];
  auditEventIds: string[];
}

export interface CaseHandover {
  handoverId: string;
  reassignmentId: string;
  caseId: string;
  builtAt: string;
  builtBy: string;
  currentStage: CaseStage;
  upcomingHearing?: CaseHearing;
  criticalDeadlines: { at: string; label: string }[];
  clientSafeContact: string;
  documents: string[];
  previousFilings: string[];
  orders: string[];
  lastVerifiedUpdate?: CaseProgressUpdate;
  outstandingTasks: string[];
  risks: string[];
  requiredFirstAction: string;
  handoverAuthor: string;
  packageVersion: number;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  finalHandoverStatement?: string;
  finalStatementAt?: string;
}

export type InactivityPatternState =
  | "threshold_reached"
  | "data_validation"
  | "human_review"
  | "explanation_requested"
  | "resolved_operationally"
  | "formal_review_recommended"
  | "dismissed"
  | "monitoring";

export interface InactivityPattern {
  patternId: string;
  lawyerId: string;
  threshold: { overdueUpdates: number; missedPostHearingReports: number; daysSinceLastActivity: number; crossCaseCount: number };
  contributingCaseIds: string[];
  contributingEventIds: string[];
  exceptions: string[];
  state: InactivityPatternState;
  history: InactivityPatternHistoryItem[];
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface InactivityPatternHistoryItem {
  at: string;
  actor: string;
  fromState?: InactivityPatternState;
  toState: InactivityPatternState;
  reason?: string;
  note?: string;
}

export interface PatternReviewDecision {
  decision: "dismiss_with_reason" | "request_explanations" | "correct_data" | "exclude_invalid_event" | "create_support_training_task" | "adjust_workload" | "initiate_formal_review" | "refer_to_authorized_committee" | "record_other_outcome";
  reason: string;
  decidedBy: string;
  decidedAt: string;
  nextReviewAt?: string;
}

export type FeeScheduleStatus = "verified" | "unverified" | "expired" | "superseded";

export interface FeeSchedule {
  scheduleId: string;
  officialInstrument: string;
  reference: string;
  effectiveDate: string;
  expiryDate?: string;
  matterType: string;
  courtOrServiceType: string;
  stage: string;
  authorizedAmount: number;
  currency: "BDT";
  requiredSupportingRecords: string[];
  approvalAuthority: string;
  officialSource: string;
  verifiedBy?: string;
  verificationDate?: string;
  status: FeeScheduleStatus;
  supersededByScheduleId?: string;
  notes?: string;
  rulesetVersion: string;
}

export type PaymentReconciliationState =
  | "not_started"
  | "worksheet_prepared"
  | "evidence_review"
  | "human_decision"
  | "approved"
  | "adjusted"
  | "returned"
  | "rejected"
  | "external_payment_pending"
  | "paid_or_closed";

export interface PaymentStage {
  stageId: string;
  caseId: string;
  scheduleId: string;
  stage: string;
  claimedAmount: number;
  verifiedAmount: number;
  approvedAmount: number;
  paidAmount: number;
  status: "not_claimed" | "draft_claim" | "submitted" | "evidence_required" | "under_review" | "eligible_stage_verified" | "approved" | "returned_for_clarification" | "partially_approved" | "rejected_with_reason" | "sent_to_external_payment" | "paid_externally" | "reconciliation_required";
  notes?: string;
}

export interface PaymentReconciliation {
  reconciliationId: string;
  caseId: string;
  state: PaymentReconciliationState;
  triggeredBy: "reassignment" | "dlao_review" | "lawyer_request" | "routine_cycle" | "exception";
  preparedAt: string;
  preparedBy: string;
  evidence: string[];
  humanDecision?: {
    decidedAt: string;
    decidedBy: string;
    outcome: "approved" | "adjusted" | "returned" | "rejected";
    reason: string;
    stageDecisions: { stageId: string; decision: "approved" | "adjusted" | "returned" | "rejected"; amount: number; note?: string }[];
  };
  externalPaymentStatus?: "sent" | "pending" | "paid" | "rejected";
  history: { at: string; actor: string; fromState: PaymentReconciliationState; toState: PaymentReconciliationState; reason?: string }[];
  auditEventIds: string[];
  disclaimerShown: boolean;
}

export interface ContactReliability {
  contactId: string;
  caseId: string;
  applicantId: string;
  number: string;
  numberOwner: "applicant" | "family" | "neighbor" | "shop" | "workplace" | "unknown" | "other";
  relationshipToApplicant?: string;
  channel: "phone" | "sms" | "voice_ivr" | "in_person" | "usd" | "other";
  safeToUse: boolean;
  permittedMessageType: "neutral_callback" | "safe_follow_up" | "in_person_only" | "none";
  mayMentionLegalAid: boolean;
  reliability: "high" | "medium" | "low" | "unknown";
  lastSuccessfulContactAt?: string;
  preferredTime?: string;
  reviewDate?: string;
  source: "applicant" | "field_officer" | "helpline" | "dlao" | "system" | "other";
  confirmationStatus: "confirmed" | "unconfirmed" | "disputed";
  notes?: string;
}

export interface ContactAttempt {
  attemptId: string;
  contactId: string;
  caseId: string;
  attemptedAt: string;
  channel: ContactReliability["channel"];
  outcome: "answered_by_applicant" | "answered_by_other" | "no_answer" | "voicemail" | "sms_delivered" | "sms_failed" | "in_person_completed" | "other";
  whoAnswered?: string;
  note?: string;
  attemptedBy: string;
}

export interface VoiceStatusSession {
  sessionId: string;
  caseId: string;
  startedAt: string;
  endedAt?: string;
  channel: "voice_ivr" | "telephony" | "app_audio";
  language: "bn" | "en";
  promptsPlayed: { at: string; key: VoiceStatusKey; playedText: string }[];
  keysPressed: { at: string; key: VoiceStatusKey }[];
  travelWarningPlayed: boolean;
  followUpTaskId?: string;
  endedReason?: "user_exit" | "human_handoff" | "connection_loss" | "completed";
}

export type VoiceStatusKey = "repeat" | "slower" | "back" | "human" | "exit" | "next" | "previous" | "play_status" | "play_next_step" | "play_responsible" | "play_callback";

export interface DlaoTaskItem {
  taskId: string;
  caseId?: string;
  applicationId?: string;
  type:
    | "assignment_preparation"
    | "lawyer_change_review"
    | "reassignment_continuity"
    | "verification_task_hearing_date"
    | "verification_task_update"
    | "pattern_review"
    | "payment_reconciliation"
    | "overdue_alert"
    | "other";
  title: string;
  detail: string;
  state: "queued" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  dueAt?: string;
  assignedTo?: string;
  relatedSubjectId?: string;
  auditEventIds: string[];
}

/* ------------------------------------------------------------------ *
 *  Prompt 10 — Mediation & settlement (B2, Flow 4, T7).
 *
 *  A MediationMatter always belongs to an accepted Case (`caseId` is
 *  required, never optional) — it is created after acceptance, per
 *  the case's own backbone rule, and stays attached to that Case ID
 *  through every session and the settlement draft.
 * ------------------------------------------------------------------ */

export type MediationMatterState =
  | "registered"
  | "party_contact_pending"
  | "scheduled"
  | "notices_sent"
  | "documents_under_review"
  | "ready_for_session"
  | "attendance_confirmed"
  | "in_session"
  | "adjourned"
  | "drafting"
  | "draft_under_review"
  | "party_review"
  | "awaiting_signatures"
  | "partially_signed"
  | "signed"
  | "outcome_recorded"
  | "closed"
  | "cancelled"
  | "no_show_rescheduled"
  | "no_settlement";

/** The 9-step stepper shown on the mediator case page. Each state above maps to exactly one step. */
export const MEDIATION_STEPS: { key: string; titleBn: string; titleEn: string; states: MediationMatterState[] }[] = [
  { key: "registration", titleBn: "নিবন্ধন", titleEn: "Registration", states: ["registered"] },
  { key: "parties", titleBn: "পক্ষ ও যোগাযোগ", titleEn: "Parties and contact", states: ["party_contact_pending"] },
  { key: "scheduling", titleBn: "সময়সূচী ও নোটিশ", titleEn: "Scheduling and notices", states: ["scheduled", "notices_sent"] },
  { key: "documents", titleBn: "নথি", titleEn: "Documents", states: ["documents_under_review"] },
  { key: "attendance", titleBn: "উপস্থিতি", titleEn: "Attendance", states: ["ready_for_session", "attendance_confirmed"] },
  { key: "session", titleBn: "মধ্যস্থতা অধিবেশন", titleEn: "Mediation session", states: ["in_session", "adjourned", "no_show_rescheduled"] },
  { key: "draft", titleBn: "নিষ্পত্তি খসড়া", titleEn: "Settlement draft", states: ["drafting", "draft_under_review"] },
  { key: "signing", titleBn: "পক্ষের পর্যালোচনা ও স্বাক্ষর", titleEn: "Party review and signing", states: ["party_review", "awaiting_signatures", "partially_signed", "signed"] },
  { key: "outcome", titleBn: "ফলাফল", titleEn: "Outcome", states: ["outcome_recorded", "closed", "no_settlement", "cancelled"] },
];

export type MediationParticipationMode = "in_person" | "remote" | "hybrid";

export interface MediationParty {
  role: "applicant" | "respondent";
  name: string;
  representedBy?: string;
  safeContact?: string;
  preferredLanguage?: "bn" | "en";
  accessibilityRequirement?: string;
  interpreterRequired?: boolean;
  participationMode?: MediationParticipationMode;
  noticeStatus?: "not_sent" | "sent" | "delivered" | "delivery_failed" | "acknowledged";
  attendanceStatus?: "pending" | "present" | "absent" | "late" | "remote_connected";
  contactedAt?: string;
  contactChannel?: string;
  contactResult?: "reached" | "no_answer" | "blocked_unsafe";
}

/** T7/T11 — structured mediator working notes, separated from citizen-visible fields (§12 of the mediator-case spec). */
export interface MediationSessionNotes {
  issuesIdentified: string;
  documentsConsidered: string;
  agreedFacts: string;
  disputedFacts: string;
  proposedTerms: string;
  unresolvedTerms: string;
  followUpRequirements: string;
  sessionResult: string;
  author: string;
  updatedAt: string;
  version: number;
}

export interface MediationHistoryItem {
  at: string;
  actor: string;
  fromState?: MediationMatterState;
  toState: MediationMatterState;
  reason?: string;
  note?: string;
  auditEventId?: string;
}

export interface MediationOutcome {
  decision: "settled" | "not_settled" | "partial";
  recordedBy: string;
  recordedAt: string;
  humanApprovedBy: string;
  settlementDraftId?: string;
  note?: string;
}

export interface MediationDocumentReview {
  documentId: string;
  status: "pending_review" | "reviewed" | "unclear" | "missing_requested";
  reviewedBy?: string;
  reviewedAt?: string;
  note?: string;
  followUpTaskId?: string;
}

export interface MediationMatter {
  matterId: string;
  /** Human-facing reference, distinct from the internal matterId (§6: "Mediation reference"). */
  mediationReference: string;
  caseId: string;
  applicationId?: string;
  pathway: "pre_case" | "post_case";
  referralSource?: string;
  courtOrTribunalRef?: string;
  registrationSource: string;
  assignedMediator: string;
  parties: MediationParty[];
  matterCategory: "maintenance" | "property" | "labour";
  state: MediationMatterState;
  participationMode: MediationParticipationMode;
  sessionIds: string[];
  documentIds: string[];
  documentReviews: MediationDocumentReview[];
  settlementDraftIds: string[];
  outcome?: MediationOutcome;
  history: MediationHistoryItem[];
  auditEventIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type MediationSessionStatus =
  | "scheduled"
  | "reminded"
  | "in_progress"
  | "paused"
  | "attended"
  | "no_show"
  | "adjourned"
  | "rescheduled"
  | "completed";

export type MediationNoticeDeliveryState =
  | "draft"
  | "ready_to_send"
  | "sent"
  | "delivered"
  | "delivery_failed"
  | "acknowledged"
  | "resend_required";

export interface MediationNotice {
  party: string;
  channel: "sms" | "voice_ivr" | "in_person" | "helpline_callback";
  sentAt: string;
  safeContactRespected: boolean;
  deliveryState: MediationNoticeDeliveryState;
  language: "bn" | "en";
}

export interface MediationAttendanceRecord {
  party: string;
  role: "applicant" | "respondent";
  attended: boolean;
  status: "present" | "absent" | "late" | "remote_connected";
  represented: boolean;
  identityCheck: "pending" | "completed";
  interpreterPresent: boolean;
  accessibilitySupportProvided: boolean;
  note?: string;
}

export interface MediationSession {
  sessionId: string;
  matterId: string;
  caseId: string;
  scheduledFor: string;
  expectedDurationMinutes?: number;
  mode: MediationParticipationMode;
  location?: string;
  remoteInstructions?: string;
  interpreterBooked?: boolean;
  accessibilityAccommodation?: string;
  inPersonFallbackPlanned?: boolean;
  /** Set when a remote/hybrid session had to fall back to in-person — an explicit, auditable event, never a silent retry. */
  fallbackTriggeredFrom?: { previousSessionId: string; reason: string };
  noticesSent: MediationNotice[];
  attendance: MediationAttendanceRecord[];
  /** Free-text log kept for backward compatibility; structured notes below are canonical. */
  mediatorNotes: string;
  structuredNotes?: MediationSessionNotes;
  connectionStatus?: "connected" | "interrupted" | "failed" | "not_applicable";
  startedAt?: string;
  pausedAt?: string;
  adjournedAt?: string;
  endedAt?: string;
  status: MediationSessionStatus;
  createdAt: string;
  auditEventIds: string[];
}

export type SettlementDraftCategory = "maintenance" | "property" | "labour";

export type SettlementClauseOrigin = "template" | "ai_inferred" | "human_edited";

export type ClauseDisposition = "undisposed" | "accept" | "edit" | "reject" | "request_clarification" | "mark_unresolved";

export interface SettlementClause {
  clauseId: string;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  origin: SettlementClauseOrigin;
  sourceNote?: string;
  required: boolean;
  disposition: ClauseDisposition;
  dispositionedBy?: string;
  dispositionedAt?: string;
}

export interface SettlementInconsistency {
  clauseIds: string[];
  description: { bn: string; en: string };
  severity: "warning" | "blocking";
}

export type SettlementDraftStatus =
  | "draft"
  | "human_reviewed"
  | "party_consent_pending"
  | "party_consented"
  | "finalized"
  | "rejected_needs_rework";

export interface SettlementConsent {
  party: string;
  consented: boolean;
  consentedAt?: string;
  method?: "in_person_read_back" | "witnessed" | "remote_confirmation";
}

/** §14 — the pre-signing review checklist. Every item must be true before signing opens; none are preselected. */
export interface SettlementConsentChecklist {
  finalDraftFrozen: boolean;
  partiesReceivedSameVersion: boolean;
  languageRecorded: boolean;
  plainLanguageExplanationProvided: boolean;
  interpreterOrAccessibilitySupportRecorded: boolean;
  questionsAndClarificationsRecorded: boolean;
  voluntaryConsentRecorded: boolean;
  unresolvedIssuesCleared: boolean;
  humanLegalReviewCompleted: boolean;
  requiredFormalitiesMarked: boolean;
}

export interface SettlementDraft {
  draftId: string;
  matterId: string;
  caseId: string;
  category: SettlementDraftCategory;
  templateId: string;
  templateVersion: string;
  clauses: SettlementClause[];
  inconsistencies: SettlementInconsistency[];
  formalityWarning: { bn: string; en: string };
  status: SettlementDraftStatus;
  version: number;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  consent: SettlementConsent[];
  consentChecklist: SettlementConsentChecklist;
  /** Set once finalized — the seam T11 (e-signature) picks up later. Not acted on in this phase. */
  finalizedForSigningAt?: string;
  frozenText?: string;
  frozenTextHash?: string;
  auditEventIds: string[];
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ *
 *  T11 — asynchronous e-signature status (party-signing workflow).
 *  The mediator page only shows/connects to this; it never signs on a
 *  party's behalf. See settlement-signing.service.ts.
 * ------------------------------------------------------------------ */

export type PartySignatureStatus =
  | "not_started"
  | "signed_online"
  | "signed_offline_pending_sync"
  | "synced"
  | "invalidated_document_changed";

export interface PartySignatureRecord {
  party: string;
  status: PartySignatureStatus;
  signedAt?: string;
  syncedAt?: string;
  offline?: boolean;
  signatureHex?: string;
}

export interface SigningWorkflow {
  signingId: string;
  draftId: string;
  matterId: string;
  caseId: string;
  documentVersion: number;
  documentHash: string;
  parties: PartySignatureRecord[];
  mediatorSignatureStatus: "not_applicable" | "pending" | "recorded";
  integrityVerified: boolean;
  verifiedAt?: string;
  status: "awaiting_signatures" | "partially_signed" | "fully_synced_and_verified" | "invalidated";
  createdAt: string;
  updatedAt: string;
  auditEventIds: string[];
}
