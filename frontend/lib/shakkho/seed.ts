/* ------------------------------------------------------------------ *
 *  Idempotent seed for the helpline store. Installs the demo
 *  records the prompt requires:
 *
 *    1. Moyuri / Ripon draft          (TEMP-MOY-01, ripon-as-caller)
 *    2. Straightforward self-applicant intake (TEMP-SAF-02)
 *    3. Existing status lookup        (APP-2026-10482, in_review)
 *    4. Accepted case lookup          (DLAS-2026-10482, accepted)
 *    5. Ambiguous intake              (TEMP-AMB-04, handoff_required)
 *    6. Failed non-visual verification (TEMP-VER-05)
 *    7. Interrupted call              (TEMP-NCH-06)
 *    8. Incoming calls (3)            (ses-incoming-1..3)
 *    9. Urgent DLAO task              (TEMP-URG-08, urgent_human_handoff_required)
 *   10. Status inquiry                (ses-status-01, submitted APP-...)
 *   11. Nuching Marma UDC draft       (OFF-NUCH-01)
 *   12. Two more offline drafts      (OFF-RANG-02, OFF-BAND-03)
 *   13. Server-conflict demo         (CONFLICT-NUCH-01)
 *   14. Integrity PASS + MISMATCH    (int-* ids)
 *   15. Performance normal + light   (perf-normal, perf-light)
 *
 *  Existing `TEMP-NCH-03` placeholder stays untouched.
 *
 *  Seed runs lazily on the first read; reloading never duplicates
 *  rows because `seededAt` is set after the first install.
 * ------------------------------------------------------------------ */

import type {
  ApplicationRecord,
  AuditEvent,
  CallerVerification,
  CommunicationEvent,
  DlaoInboxTask,
  HumanHandoff,
  IntakeSession,
  OfflineDraft,
  RepresentationAuthority,
  StoreEnvelope,
  SyncConflict,
  IntegrityVerification,
  PerformanceMeasurement,
  TemporaryToAuthoritativeIdMap,
  AssistedIntake,
  Referral,
  ReferralPackage,
  AuthorityDirectoryEntry,
  LegalBasisEntry,
  SensitiveEvidenceStore,
  EscalationTask,
  CitizenSafeStatus,
  RoutingRecommendation,
  PanelLawyer,
  LawyerAvailability,
  LawyerAssignment,
  AssignmentResponse,
  CaseHearing,
  CaseProgressUpdate,
  RequiredUpdate,
  UpdateReminder,
  ContactReliability,
  ContactAttempt,
  LawyerChangeRequest,
  LawyerChangeReview,
  Reassignment,
  CaseHandover,
  InactivityPattern,
  FeeSchedule,
  PaymentStage,
  PaymentReconciliation,
  VoiceStatusSession,
  DlaoTaskItem,
} from "./types";

/* Empty envelope used by scenario resets. Mirrors the shape that
   `persistence.ts#EMPTY` exposes but without the singleton caveat. */
function buildEmptyEnvelope(): StoreEnvelope {
  return {
    v: 1,
    records: [],
    sessions: [],
    representations: [],
    verifications: [],
    handoffs: [],
    communications: [],
    audit: [],
    dlaoTasks: [],
    humanIntakes: [],
    dlaoVerifications: [],
    safeContactPlans: [],
    referrals: [],
    sensitiveEvidence: { items: [], derivatives: [], grants: [], events: [] },
    authorityDirectory: [],
    legalBasis: [],
    routingRecommendations: [],
    deliveryOperations: [],
    escalationTasks: [],
    citizenSafeStatuses: [],
    demoTimeOffsetMs: 0,
    panelLawyers: [],
    lawyerAvailabilities: [],
    lawyerAssignments: [],
    lawyerAssignmentResponses: [],
    caseHearings: [],
    caseProgressUpdates: [],
    requiredUpdates: [],
    updateReminders: [],
    contactReliabilities: [],
    contactAttempts: [],
    lawyerChangeRequests: [],
    lawyerChangeReviews: [],
    reassignments: [],
    caseHandovers: [],
    inactivityPatterns: [],
    patternReviews: [],
    feeSchedules: [],
    paymentStages: [],
    paymentReconciliations: [],
    voiceStatusSessions: [],
    dlaoTaskItems: [],
  };
}

export function seedDemoData(envelope: StoreEnvelope): StoreEnvelope {
  if (envelope.seededAt) return envelope;

  const now = new Date().toISOString();
  const baseRecord = (
    applicationId: string,
    status: ApplicationRecord["status"],
    channel: ApplicationRecord["channel"],
    office: string,
  ): ApplicationRecord => ({
    applicationId,
    status,
    channel,
    office,
    urgencyIndicators: [],
    facts: {},
    provenance: [],
    audit: [],
    createdAt: now,
  });

  const records: ApplicationRecord[] = [
    {
      ...baseRecord("TEMP-MOY-01", "draft", "helpline", "জয়পুরহাট জেলা আইনি সহায়তা কেন্দ্র"),
      safeContact: {
        cleared: true,
        reasons: [
          { bn: "নিরাপদ সময় নিশ্চিত", en: "Safe time confirmed" },
        ],
        evaluatedAt: now,
        rulesApplied: ["safe_time_window"],
      },
      urgencyIndicators: [
        {
          code: "self_reported",
          weight: "low",
          source: "caller",
          notedAt: now,
        },
      ],
      facts: {
        applicant_name: { value: "ময়ূরী বেগম", confidence: "stated", source: "caller" },
        category: { value: "land", confidence: "stated", source: "caller" },
        office: { value: "জয়পুরহাট", confidence: "stated", source: "caller" },
        incident_date: { value: "২০২৬-০৮-২৮", confidence: "stated", source: "caller" },
        safe_contact_time: { value: "সন্ধ্যা ৬টার পর", confidence: "stated", source: "caller" },
        caller_relation: { value: "neighbour", confidence: "stated", source: "caller" },
        caller_name: { value: "রিপন আলম", confidence: "stated", source: "caller" },
      },
    },
    {
      ...baseRecord("TEMP-SAF-02", "draft", "helpline", "রাজশাহী জেলা আইনি সহায়তা কেন্দ্র"),
      facts: {
        applicant_name: { value: "রিপন আলম", confidence: "stated", source: "caller" },
        category: { value: "land", confidence: "stated", source: "caller" },
        office: { value: "রাজশাহী", confidence: "stated", source: "caller" },
        consent: { value: "yes", confidence: "stated", source: "caller" },
      },
    },
    {
      ...baseRecord("APP-2026-10482", "in_review", "helpline", "ঢাকা জেলা আইনি সহায়তা কেন্দ্র"),
      facts: {
        applicant_name: { value: "আনিকা তাবাসসুম", confidence: "verified", source: "officer_lookup" },
        category: { value: "family", confidence: "verified", source: "officer_lookup" },
      },
      submittedAt: now,
    },
    {
      ...baseRecord("DLAS-2026-10482", "accepted", "helpline", "ঢাকা জেলা আইনি সহায়তা কেন্দ্র"),
      facts: {
        applicant_name: { value: "আনিকা তাবাসসুম", confidence: "verified", source: "officer_lookup" },
        category: { value: "family", confidence: "verified", source: "officer_lookup" },
      },
      submittedAt: now,
    },
    {
      ...baseRecord("TEMP-AMB-04", "draft", "helpline", "সিলেট জেলা আইনি সহায়তা কেন্দ্র"),
      urgencyIndicators: [
        {
          code: "threat_language",
          weight: "high",
          source: "caller",
          notedAt: now,
          ruleId: "UR-05-threat-language",
        },
      ],
      facts: {
        applicant_name: { value: "রহিম মিয়া", confidence: "stated", source: "caller" },
        category: { value: "other", confidence: "inferred", source: "t5" },
      },
    },
    {
      ...baseRecord("TEMP-VER-05", "draft", "helpline", "চট্টগ্রাম জেলা আইনি সহায়তা কেন্দ্র"),
      facts: {
        applicant_name: { value: "সাবরিনা ইসলাম", confidence: "stated", source: "caller" },
        category: { value: "labour", confidence: "stated", source: "caller" },
      },
    },
    {
      ...baseRecord("TEMP-NCH-06", "draft", "helpline", "খুলনা জেলা আইনি সহায়তা কেন্দ্র"),
      facts: {
        applicant_name: { value: "আবির হোসেন", confidence: "stated", source: "caller" },
        category: { value: "criminal", confidence: "inferred", source: "t5" },
      },
    },
    {
      ...baseRecord("TEMP-URG-08", "draft", "helpline", "রাজশাহী জেলা আইনি সহায়তা কেন্দ্র"),
      urgencyIndicators: [
        {
          code: "physical_safety_at_risk",
          weight: "urgent",
          source: "caller",
          notedAt: now,
          ruleId: "UR-01-physical-safety",
          note: {
            bn: "কলার শারীরিক হুমকির কথা জানিয়েছেন",
            en: "Caller reported physical safety threat",
          },
        },
      ],
      facts: {
        applicant_name: { value: "নাদিয়া আক্তার", confidence: "stated", source: "caller" },
        category: { value: "family", confidence: "stated", source: "caller" },
        office: { value: "রাজশাহী", confidence: "stated", source: "caller" },
      },
    },
    /* Prompt 7 — Nuching (urgent sensitive, Jhenaidah). */
    {
      ...baseRecord("APP-2026-NBILA-01", "in_review", "helpline", "ঝিনাইদহ জেলা আইনি সহায়তা কেন্দ্র"),
      urgencyIndicators: [
        {
          code: "self_reported",
          weight: "urgent",
          source: "caller",
          notedAt: now,
          ruleId: "UR-07-spreading-harm",
          note: {
            bn: "ছড়িয়ে পড়া ক্ষতি — সাবমিট করা উপাদান অত্যন্ত সংবেদনশীল",
            en: "Spreading harm — submitted material is highly sensitive",
          },
        },
        {
          code: "physical_safety_at_risk",
          weight: "high",
          source: "caller",
          notedAt: now,
          ruleId: "UR-08-pressure-reported",
          note: {
            bn: "আবেদনকারী চাপের কথা জানিয়েছেন",
            en: "Applicant reported pressure",
          },
        },
      ],
      facts: {
        applicant_name: { value: "নুচিং", confidence: "stated", source: "caller" },
        category: { value: "other", confidence: "inferred", source: "t5" },
        office: { value: "ঝিনাইদহ", confidence: "stated", source: "caller" },
        safe_contact_time: { value: "সন্ধ্যা ৬টার পর", confidence: "stated", source: "caller" },
      },
      submittedAt: now,
    },
    /* Prompt 7 — Rahim (compensation, jurisdiction tug-of-war). */
    {
      ...baseRecord("APP-2026-RAHIM-01", "in_review", "helpline", "ঢাকা জেলা আইনি সহায়তা কেন্দ্র"),
      facts: {
        applicant_name: { value: "রহিম মিয়া", confidence: "stated", source: "caller" },
        category: { value: "labour", confidence: "stated", source: "caller" },
        office: { value: "ঢাকা", confidence: "stated", source: "caller" },
      },
      submittedAt: now,
    },
    /* Prompt 8 — Abdul Malek (A5 Barguna, ~7 months old). */
    {
      ...baseRecord("APP-2026-MALEK-01", "in_review", "helpline", "বরগুনা জেলা আইনি সহায়তা কেন্দ্র"),
      caseId: "CASE-MALEK-01",
      caseStage: "hearing_preparation",
      facts: {
        applicant_name: { value: "আব্দুল মালেক", confidence: "stated", source: "field_officer" },
        category: { value: "compensation", confidence: "stated", source: "field_officer" },
        office: { value: "বরগুনা", confidence: "stated", source: "field_officer" },
        safe_contact_time: { value: "সন্ধ্যা", confidence: "stated", source: "field_officer" },
      },
      submittedAt: "২০২৬-০২-১৫T10:00:00.000Z",
      createdAt: "২০২৬-০২-১৫T10:00:00.000Z",
    },
    /* Prompt 8 — Marzina Begum (T1 lawyer-change). */
    {
      ...baseRecord("APP-2026-MARZINA-01", "in_review", "helpline", "ঢাকা জেলা আইনি সহায়তা কেন্দ্র"),
      caseId: "CASE-MARZINA-01",
      caseStage: "hearing_in_progress",
      facts: {
        applicant_name: { value: "মারজিনা বেগম", confidence: "stated", source: "caller" },
        category: { value: "family", confidence: "stated", source: "caller" },
        office: { value: "ঢাকা", confidence: "stated", source: "caller" },
        safe_contact_time: { value: "দুপুর ২টা থেকে ৪টা", confidence: "stated", source: "caller" },
      },
      submittedAt: "২০২৬-০৪-১০T09:00:00.000Z",
      createdAt: "২০২৬-০৪-১০T09:00:00.000Z",
    },
    /* Prompt 8 — Two additional cases to feed the cross-case inactivity pattern. */
    {
      ...baseRecord("APP-2026-RAHELA-01", "in_review", "helpline", "গাইবান্ধা জেলা আইনি সহায়তা কেন্দ্র"),
      caseId: "CASE-RAHELA-01",
      caseStage: "hearing_in_progress",
      facts: {
        applicant_name: { value: "রাহেলা বেগম", confidence: "stated", source: "field_officer" },
        category: { value: "family", confidence: "stated", source: "field_officer" },
        office: { value: "গাইবান্ধা", confidence: "stated", source: "field_officer" },
      },
      submittedAt: "২০২৬-০৫-২০T09:00:00.000Z",
      createdAt: "২০২৬-০৫-২০T09:00:00.000Z",
    },
    {
      ...baseRecord("APP-2026-SALIM-01", "in_review", "helpline", "চট্টগ্রাম জেলা আইনি সহায়তা কেন্দ্র"),
      caseId: "CASE-SALIM-01",
      caseStage: "compliance",
      facts: {
        applicant_name: { value: "সালিম মিয়া", confidence: "stated", source: "caller" },
        category: { value: "land", confidence: "stated", source: "caller" },
        office: { value: "চট্টগ্রাম", confidence: "stated", source: "caller" },
      },
      submittedAt: "২০২৬-০৬-০৫T09:00:00.000Z",
      createdAt: "২০২৬-০৬-০৫T09:00:00.000Z",
    },
  ];

  const representations: RepresentationAuthority[] = [
    {
      id: "rep-moy-01",
      applicationId: "TEMP-MOY-01",
      callerName: "রিপন আলম",
      callerRelation: "প্রতিবেশী",
      state: "reported",
      recordedAt: now,
      updatedAt: now,
    },
  ];

  const verifications: CallerVerification[] = [
    {
      id: "ver-ver-05",
      sessionId: "ses-ver-05",
      questions: [
        { bn: "আপনার জাতীয় পরিচয়পত্রের শেষ ৪ সংখ্যা?", en: "Last 4 digits of your national ID?" },
        { bn: "গত সপ্তাহে কোন দিন প্রথম যোগাযোগ হয়েছিল?", en: "What day last week did we first contact you?" },
      ],
      responses: ["০০০০", "—"],
      passed: false,
      method: "knowledge_based",
    },
  ];

  const sessions: IntakeSession[] = [
    {
      id: "ses-moy-01",
      applicationId: "TEMP-MOY-01",
      status: "ai_handled",
      channel: "helpline",
      turns: [],
      facts: {},
      startedAt: now,
      voiceAvailable: true,
    },
    {
      id: "ses-amb-04",
      applicationId: "TEMP-AMB-04",
      status: "handoff_required",
      channel: "helpline",
      turns: [],
      facts: {},
      startedAt: now,
      voiceAvailable: true,
    },
    {
      id: "ses-ver-05",
      applicationId: "TEMP-VER-05",
      status: "handoff_required",
      channel: "helpline",
      turns: [],
      facts: {},
      startedAt: now,
      voiceAvailable: true,
    },
    {
      id: "ses-nch-06",
      applicationId: "TEMP-NCH-06",
      status: "interrupted",
      channel: "helpline",
      turns: [],
      facts: {},
      startedAt: now,
      interruptedAt: now,
      voiceAvailable: true,
    },
    {
      id: "ses-urg-08",
      applicationId: "TEMP-URG-08",
      status: "urgent_human_handoff_required",
      channel: "helpline",
      turns: [],
      facts: {},
      startedAt: now,
      voiceAvailable: true,
    },
    {
      id: "ses-status-01",
      applicationId: "APP-2026-10482",
      status: "submitted",
      channel: "helpline",
      turns: [],
      facts: {},
      startedAt: now,
      voiceAvailable: true,
    },
    // Three incoming calls waiting for the helpline agent.
    {
      id: "ses-incoming-1",
      status: "incoming",
      channel: "helpline",
      turns: [],
      facts: {},
      startedAt: now,
      voiceAvailable: true,
    },
    {
      id: "ses-incoming-2",
      status: "incoming",
      channel: "helpline",
      turns: [],
      facts: {},
      startedAt: now,
      voiceAvailable: true,
    },
    {
      id: "ses-incoming-3",
      status: "incoming",
      channel: "helpline",
      turns: [],
      facts: {},
      startedAt: now,
      voiceAvailable: true,
    },
  ];

  const handoffs: HumanHandoff[] = [
    {
      id: "hof-amb-04",
      applicationId: "TEMP-AMB-04",
      intakeSessionId: "ses-amb-04",
      reason: "uncertain",
      status: "queued",
      targetRole: "dlao",
      createdAt: now,
    },
    {
      id: "hof-ver-05",
      applicationId: "TEMP-VER-05",
      intakeSessionId: "ses-ver-05",
      reason: "voice_failure",
      status: "queued",
      targetRole: "dlao",
      createdAt: now,
    },
    {
      id: "hof-urg-08",
      applicationId: "TEMP-URG-08",
      intakeSessionId: "ses-urg-08",
      reason: "urgency_urgent",
      status: "queued",
      targetRole: "dlao",
      createdAt: now,
    },
  ];

  const communications: CommunicationEvent[] = [
    {
      id: "com-1",
      sessionId: "ses-moy-01",
      channel: "voice",
      direction: "system",
      actor: "t5",
      body: {
        bn: "কল সংযুক্ত (সিমুলেটেড)।",
        en: "Call connected (simulated).",
      },
      simulated: true,
      occurredAt: now,
    },
  ];

  const audit: AuditEvent[] = [
    {
      id: "aud-1",
      subject: "TEMP-MOY-01",
      subjectKind: "application",
      action: "seed",
      actor: "system",
      occurredAt: now,
      simulation: { kind: "voice", simulatedAt: now },
    },
  ];

  const dlaoTasks: DlaoInboxTask[] = [
    {
      id: "dlao-amb-04",
      applicationId: "TEMP-AMB-04",
      applicantName: "রহিম মিয়া",
      reason: "uncertain",
      status: "queued",
      createdAt: now,
    },
    {
      id: "dlao-ver-05",
      applicationId: "TEMP-VER-05",
      applicantName: "সাবরিনা ইসলাম",
      reason: "voice_failure",
      status: "queued",
      createdAt: now,
    },
    {
      id: "dlao-urg-08",
      applicationId: "TEMP-URG-08",
      applicantName: "নাদিয়া আক্তার",
      reason: "urgency_urgent",
      status: "queued",
      createdAt: now,
      notes: "শারীরিক নিরাপত্তা হুমকি — ২৪ ঘণ্টার মধ্যে যোগাযোগ",
    },
  ];

  const safeContactPlans = [
    {
      applicationId: "TEMP-MOY-01",
      preferredTime: { bn: "সন্ধ্যা ৬টার পর", en: "After 6 PM" },
      channel: "phone" as const,
      witness: "প্রতিবেশী রিপন আলম",
      alternateTime: { bn: "সকাল ১০টা — ইউডিসিতে", en: "10 AM — at UDC" },
      cleared: true,
      verifiedAt: now,
      verifiedBy: "agent",
    },
  ];

  /* ---------------------------------------------------------------- *
   *  Phase 5 — UDC assisted-intake demo data (Nuching Marma).
   * ---------------------------------------------------------------- */
  const networkProfile = {
    kind: "normal" as const,
    latencyMs: 80,
    packetLoss: 0,
    bandwidthBps: 1_200_000,
    statusLabel: { bn: "সাধারণ নেটওয়ার্ক", en: "Normal network" },
    setAt: now,
  };

  const offlineDrafts: OfflineDraft[] = [
    {
      id: "drf-nuch-01",
      temporaryId: "OFF-NUCH-01",
      payload: {
        applicant_name: "নুচিং মারমা",
        applicant_name_typed_en: "Nuching Marma",
        district: "খাগড়াছড়ি",
        matters: ["land"],
        primary_language: "marma",
        interface_language: "bn",
        interpreter_name: "উচাই মারমা",
        free_service_notice_acknowledged: true,
        checklist_states: [
          { id: "national_id", state: "required" },
          { id: "deed", state: "uncertain" },
        ],
        confirmed_fields: [
          "applicant_name",
          "district",
          "matter_type",
          "primary_language",
          "consent_topics",
        ],
        incident_date: "২০২৬-০৭-১২",
      },
      confirmedFields: [
        "applicant_name",
        "district",
        "matter_type",
        "primary_language",
        "consent_topics",
      ],
      provenance: [
        {
          id: "tr-nuch-name",
          field: "applicant_name",
          sourceLanguage: "marma",
          originalText: "Nuching Marma (in Marma)",
          translatedText: "নুচিং মারমা",
          personWhoSpoke: "আবেদনকারী",
          interpreterOrTranslator: "উচাই মারমা",
          personWhoTyped: "ইউডিসি উদ্যোক্তা রহমান",
          method: "human_interpreter",
          occurredAt: now,
          applicantConfirmation: {
            status: "applicant_confirmed",
            mechanism: "oral_with_readback",
            confirmedAt: now,
          },
        },
        {
          id: "tr-nuch-district",
          field: "district",
          sourceLanguage: "marma",
          originalText: "Khagrachari (in Marma)",
          translatedText: "খাগড়াছড়ি",
          personWhoSpoke: "আবেদনকারী",
          interpreterOrTranslator: "উচাই মারমা",
          personWhoTyped: "রহমান",
          method: "human_interpreter",
          occurredAt: now,
          applicantConfirmation: {
            status: "applicant_confirmed",
            mechanism: "oral_with_readback",
            confirmedAt: now,
          },
        },
        {
          id: "tr-nuch-date",
          field: "incident_date",
          sourceLanguage: "marma",
          originalText: "12 July 2026 (in Marma)",
          translatedText: "২০২৬-০৭-১২",
          personWhoSpoke: "আবেদনকারী",
          interpreterOrTranslator: "উচাই মারমা",
          personWhoTyped: "রহমান",
          method: "human_interpreter",
          occurredAt: now,
          applicantConfirmation: {
            status: "applicant_confirmed",
            mechanism: "oral_with_readback",
            confirmedAt: now,
            note: { bn: "আবেদনকারী নিজে শুনে নিশ্চিত করেছেন", en: "Applicant heard and confirmed" },
          },
        },
      ],
      consent: [
        {
          id: "cns-nuch-form",
          topic: "form_entry_assistance",
          noticeVersion: "v2026-09-22",
          language: "marma",
          method: "oral_with_readback",
          explainedBy: "রহমান",
          interpreter: "উচাই মারমা",
          applicantResponse: "yes",
          obtainedAt: now,
        },
        {
          id: "cns-nuch-interp",
          topic: "human_translation_or_interpretation",
          noticeVersion: "v2026-09-22",
          language: "marma",
          method: "oral_with_readback",
          explainedBy: "রহমান",
          interpreter: "উচাই মারমা",
          applicantResponse: "yes",
          obtainedAt: now,
        },
        {
          id: "cns-nuch-offline",
          topic: "temporary_offline_storage",
          noticeVersion: "v2026-09-22",
          language: "marma",
          method: "oral_with_readback",
          explainedBy: "রহমান",
          interpreter: "উচাই মারমা",
          applicantResponse: "yes",
          obtainedAt: now,
        },
        {
          id: "cns-nuch-submit",
          topic: "submission_to_dlas",
          noticeVersion: "v2026-09-22",
          language: "marma",
          method: "oral_with_readback",
          explainedBy: "রহমান",
          interpreter: "উচাই মারমা",
          applicantResponse: "yes",
          obtainedAt: now,
        },
      ],
      documentMetadata: [
        {
          id: "doc-nuch-1",
          applicationOrDraftId: "OFF-NUCH-01",
          checklistItemId: "national_id",
          capturedBy: "রহমান",
          capturedAt: now,
          pageCount: 1,
          bytes: 28_000,
          compressed: true,
          pageOrder: [1],
          qualityFindings: [
            {
              code: "blur",
              message: { bn: "ছবি ঝাপসা", en: "Image is blurry" },
              guidance: { bn: "স্থির হয়ে আবার ছবি তুলুন", en: "Hold still and retake" },
              severity: "warn",
            },
          ],
          sensitivity: "restricted",
          documentType: { bn: "জাতীয় পরিচয়পত্র", en: "National ID" },
          version: 1,
          applicantConfirmed: true,
        },
      ],
      blobKeys: [],
      syncStatus: "local_draft",
      idempotencyKey: "idem-OFF-NUCH-01",
      localVersion: 3,
      lastModified: now,
      integrityDigest:
        "0000000000000000000000000000000000000000000000000000000000000000",
      chainDigest: "",
      retryCount: 0,
      networkProfile,
    },
    /* Two more offline drafts (Rangamati + Bandarban). */
    {
      id: "drf-rang-02",
      temporaryId: "OFF-RANG-02",
      payload: {
        applicant_name: "অনুপম চাকমা",
        district: "রাঙামাটি",
        matter_type: "family",
        primary_language: "chakma",
      },
      confirmedFields: ["applicant_name", "district", "matter_type"],
      provenance: [],
      consent: [],
      documentMetadata: [],
      blobKeys: [],
      syncStatus: "queued_offline",
      idempotencyKey: "idem-OFF-RANG-02",
      localVersion: 2,
      lastModified: now,
      integrityDigest:
        "0000000000000000000000000000000000000000000000000000000000000000",
      chainDigest: "",
      retryCount: 0,
      networkProfile,
    },
    {
      id: "drf-band-03",
      temporaryId: "OFF-BAND-03",
      payload: {
        applicant_name: "সুমন ত্রিপুরা",
        district: "বান্দরবান",
        matter_type: "labour",
        primary_language: "tripura",
      },
      confirmedFields: ["applicant_name", "district"],
      provenance: [],
      consent: [],
      documentMetadata: [],
      blobKeys: [],
      syncStatus: "queued_offline",
      idempotencyKey: "idem-OFF-BAND-03",
      localVersion: 1,
      lastModified: now,
      integrityDigest:
        "0000000000000000000000000000000000000000000000000000000000000000",
      chainDigest: "",
      retryCount: 0,
      networkProfile,
    },
  ];

  const syncConflicts: SyncConflict[] = [
    {
      id: "conf-nuch-01",
      temporaryId: "OFF-NUCH-01",
      kind: "field_value",
      fieldOrObject: "incident_date",
      baseVersion: "v2",
      authoritativeValue: "২০২৬-০৭-১২",
      authoritativeActor: "dlao_field_verification",
      authoritativeAt: now,
      offlineValue: "২০২৬-০৭-১৪",
      offlineActor: "udc_entrepreneur",
      offlineAt: now,
      provenance: {
        bn: "অফলাইন খসড়ায় তারিখ ভিন্ন — মানব পর্যালোচনা প্রয়োজন",
        en: "Offline draft disagrees on date — needs human review",
      },
      safetyImplications: {
        bn: "আইনি সময়সীমা প্রভাবিত হতে পারে",
        en: "May affect legal deadlines",
      },
      suggestedMerge: { kind: "defer_review", note: "defer to DLAO" },
    },
  ];

  const integrityVerifications: IntegrityVerification[] = [
    {
      id: "int-pass-01",
      temporaryId: "OFF-RANG-02",
      submittedDigest:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      acknowledgedDigest:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      result: "pass",
      verifiedAt: now,
      note: { bn: "পেলোড অক্ষত", en: "Payload intact" },
    },
    {
      id: "int-mis-02",
      temporaryId: "OFF-BAND-03",
      submittedDigest:
        "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
      acknowledgedDigest:
        "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543211",
      result: "mismatch",
      verifiedAt: now,
      note: {
        bn: "অখণ্ডতা পরীক্ষায় মিল নেই — পর্যালোচনা প্রয়োজন",
        en: "Integrity mismatch — review required",
      },
    },
  ];

  const performanceMeasurements: PerformanceMeasurement[] = [
    {
      id: "perf-normal",
      mode: "normal",
      networkProfile: "normal",
      measurements: {
        appShellLoadMs: 48,
        firstInteractionMs: 92,
        transferredBytes: 56_000,
        documentPreviewLoadMs: 220,
        saveDraftMs: 18,
        reopenDraftMs: 9,
      },
      measuredAt: now,
      estimates: [
        "App-shell time measured against the local Next.js dev server",
        "First interaction is end-of-script execution of the workload loop",
      ],
      deviceAssumptions: ["Desktop browser, running on this device"],
    },
    {
      id: "perf-light",
      mode: "light",
      networkProfile: "slow",
      measurements: {
        appShellLoadMs: 110,
        firstInteractionMs: 174,
        transferredBytes: 22_000,
        documentPreviewLoadMs: 470,
        saveDraftMs: 64,
        reopenDraftMs: 32,
      },
      measuredAt: now,
      estimates: [
        "Light mode drops visual chrome but keeps the same shell load",
        "Slow network simulated by adding 1800 ms latency cap",
      ],
      deviceAssumptions: ["Mid-range Android handset, no service worker"],
    },
  ];

  const idMappings: TemporaryToAuthoritativeIdMap[] = [
    {
      temporaryId: "OFF-NUCH-01",
      authoritativeApplicationId: "APP-2026-20001",
      syncedAt: now,
      syncReceiptId: "rcv-seed-001",
      actor: "udc_entrepreneur",
      channel: "udc_offline_sync",
    },
    {
      temporaryId: "OFF-RANG-02",
      authoritativeApplicationId: "APP-2026-20002",
      syncedAt: now,
      syncReceiptId: "rcv-seed-002",
      actor: "udc_entrepreneur",
      channel: "udc_offline_sync",
    },
  ];

  const assistedIntakes: AssistedIntake[] = [
    {
      id: "ain-nuch",
      temporaryId: "OFF-NUCH-01",
      assistanceSessionId: "as-nuch-01",
      applicantName: "নুচিং মারমা",
      district: "খাগড়াছড়ি",
      matterType: "land",
      languagePreference: {
        primary: "marma",
        supportedInterface: "bn",
        interpreterName: "উচাই মারমা",
        interpreterLanguage: "marma",
        interpreterContact: "+8801XXXXXXXXX",
      },
      consents: offlineDrafts[0].consent,
      translations: offlineDrafts[0].provenance,
      applicantContact: {
        kind: "trusted_contact",
        value: "+8801XXXXXXXXX (প্রতিবেশী)",
        safeWindow: { bn: "বিকাল ৩-৫টা", en: "3-5 PM" },
      },
      documentCaptureIds: ["doc-nuch-1"],
      checklistItemResults: [
        { itemId: "national_id", state: "captured" },
        { itemId: "deed", state: "uncertain" },
      ],
      readBacks: offlineDrafts[0].provenance.map((t) => ({
        field: t.field,
        confirmation: t.applicantConfirmation ?? {
          status: "read_back_to_applicant",
          mechanism: "oral_with_readback",
        },
      })),
      freeServiceNoticeAcknowledged: true,
      state: "local_draft",
      localVersion: 3,
      createdAt: now,
      updatedAt: now,
    },
  ];

  /* ---------------------------------------------------------------- *
   *  Prompt 7 — Referral workflow + sensitive evidence + jurisdiction escalation seeds.
   * ---------------------------------------------------------------- */

  const authorityDirectory: AuthorityDirectoryEntry[] = [
    {
      entryId: "auth-dlao-jhenaidah",
      displayNameBn: "ঝিনাইদহ জেলা আইনি সহায়তা কেন্দ্র",
      displayNameEn: "Jhenaidah District Legal Aid Office",
      type: "district_legal_aid_office",
      geographicCoverage: ["ঝিনাইদহ", "Jhenaidah"],
      subjectCoverage: ["sensitive", "labour", "family", "land"],
      intakeChannel: "secure_digital",
      secureIntegration: "connected",
      acknowledgmentMethod: "secure_api",
      workingHours: "09:00–17:00 BST",
      emergencyRoute: "জরুরি যোগাযোগ: ঝিনাইদহ জেলা আইনি সহায়তা কর্মকর্তা",
      requiredReferralFields: ["reason", "expected_action", "deadline", "priority"],
      acceptedDocumentTypes: ["application_record", "redacted_derivative"],
      acknowledgmentDeadlineHours: 24,
      escalationContact: "জেলা প্রশাসক, ঝিনাইদহ",
      effectiveDate: "2026-01-01",
      reviewDate: "2027-01-01",
      sourceOfAuthority: "আইনি সহায়তা সেবা আইন ২০২৬",
      verificationStatus: "verified",
      verifiedBy: "system-admin",
      lastReviewedAt: now,
    },
    {
      entryId: "auth-labour-cell",
      displayNameBn: "শ্রম আইনি সহায়তা সেল",
      displayNameEn: "Labour Legal Aid Cell",
      type: "labour_legal_aid_cell",
      geographicCoverage: ["জাতীয়", "National"],
      subjectCoverage: ["labour", "compensation", "wages"],
      intakeChannel: "secure_digital",
      secureIntegration: "connected",
      acknowledgmentMethod: "secure_api",
      workingHours: "09:00–17:00 BST",
      emergencyRoute: "জরুরি যোগাযোগ: শ্রম সেল প্রধান",
      requiredReferralFields: ["reason", "expected_action", "deadline", "compensation_amount"],
      acceptedDocumentTypes: ["employment_contract", "termination_letter", "wage_record"],
      acknowledgmentDeadlineHours: 24,
      escalationContact: "শ্রম মন্ত্রণালয়",
      effectiveDate: "2026-01-01",
      reviewDate: "2027-01-01",
      sourceOfAuthority: "শ্রম আইন ২০০৬",
      verificationStatus: "verified",
      verifiedBy: "system-admin",
      lastReviewedAt: now,
    },
    {
      entryId: "auth-dlao-dhaka",
      displayNameBn: "ঢাকা জেলা আইনি সহায়তা কেন্দ্র",
      displayNameEn: "Dhaka District Legal Aid Office",
      type: "district_legal_aid_office",
      geographicCoverage: ["ঢাকা", "Dhaka"],
      subjectCoverage: ["labour", "family", "land", "criminal"],
      intakeChannel: "secure_digital",
      secureIntegration: "connected",
      acknowledgmentMethod: "secure_api",
      workingHours: "09:00–17:00 BST",
      requiredReferralFields: ["reason", "expected_action", "deadline"],
      acceptedDocumentTypes: ["application_record", "redacted_derivative"],
      acknowledgmentDeadlineHours: 24,
      escalationContact: "জেলা প্রশাসক, ঢাকা",
      effectiveDate: "2026-01-01",
      reviewDate: "2027-01-01",
      sourceOfAuthority: "আইনি সহায়তা সেবা আইন ২০২৬",
      verificationStatus: "verified",
      verifiedBy: "system-admin",
      lastReviewedAt: now,
    },
    {
      entryId: "auth-other-govt",
      displayNameBn: "দায়িত্বপ্রাপ্ত সরকারি কর্তৃপক্ষ",
      displayNameEn: "Authorized Competent Government Authority",
      type: "other_competent_authority",
      geographicCoverage: ["জাতীয়", "National"],
      subjectCoverage: ["sensitive", "external"],
      intakeChannel: "secure_digital",
      secureIntegration: "manual_only",
      acknowledgmentMethod: "manual",
      workingHours: "09:00–17:00 BST",
      emergencyRoute: "জরুরি যোগাযোগ: দায়িত্বপ্রাপ্ত কর্তৃপক্ষ",
      requiredReferralFields: ["reason", "expected_action", "legal_basis"],
      acceptedDocumentTypes: ["redacted_derivative"],
      acknowledgmentDeadlineHours: 48,
      escalationContact: "মন্ত্রিপরিষদ বিভাগ",
      effectiveDate: "2026-01-01",
      reviewDate: "2027-01-01",
      sourceOfAuthority: "দায়িত্বপ্রাপ্ত সরকারি কর্তৃপক্ষ — যাচাইকৃত",
      verificationStatus: "verified",
      verifiedBy: "system-admin",
      lastReviewedAt: now,
    },
  ];

  const legalBasis: LegalBasisEntry[] = [
    {
      basisId: "lb-sensitive-001",
      instrument: "আইনি সহায়তা সেবা আইন ২০২৬",
      reference: "§12, §15",
      effectiveDate: "2026-01-01",
      area: "জাতীয়",
      matterCategory: "sensitive",
      receivingAuthorityType: "other_competent_authority",
      requiredDocuments: ["redacted_derivative", "applicant_consent"],
      timeRequirement: "Same-day for urgent",
      humanReviewRequired: true,
      officialSource: "বাংলাদেশ জাতীয় সংসদ",
      verificationStatus: "verified",
      verifiedBy: "system-admin",
      lastReviewedAt: now,
      rulesetVersion: "R7-v0.1.0",
    },
    {
      basisId: "lb-labour-001",
      instrument: "শ্রম আইন ২০০৬",
      reference: "§120, §123",
      effectiveDate: "2006-01-01",
      area: "জাতীয়",
      matterCategory: "labour",
      receivingAuthorityType: "labour_legal_aid_cell",
      requiredDocuments: ["employment_contract", "termination_letter"],
      timeRequirement: "30 days",
      humanReviewRequired: true,
      officialSource: "বাংলাদেশ জাতীয় সংসদ",
      verificationStatus: "verified",
      verifiedBy: "system-admin",
      lastReviewedAt: now,
      rulesetVersion: "R7-v0.1.0",
    },
    {
      basisId: "lb-dlao-001",
      instrument: "আইনি সহায়তা সেবা আইন ২০২৬",
      reference: "§10, §11",
      effectiveDate: "2026-01-01",
      area: "জেলা",
      matterCategory: "standard",
      receivingAuthorityType: "district_legal_aid_office",
      requiredDocuments: ["application_record"],
      timeRequirement: "7 days",
      humanReviewRequired: true,
      officialSource: "বাংলাদেশ জাতীয় সংসদ",
      verificationStatus: "verified",
      verifiedBy: "system-admin",
      lastReviewedAt: now,
      rulesetVersion: "R7-v0.1.0",
    },
  ];

  /* Sensitive evidence vault — Nuching's 3 placeholders. */
  const sensitiveEvidence: SensitiveEvidenceStore = {
    items: [
      {
        evidenceId: "ev-nb-01",
        applicationId: "APP-2026-NBILA-01",
        kind: "image",
        fileType: "image/jpeg",
        bytes: 0,
        submittedBy: "নুচিং (আবেদনকারী)",
        subject: "Sensitive image evidence — preview restricted",
        sourceChannel: "in_app_upload",
        originalFilename: "(masked)",
        capturedAt: now,
        uploadedAt: now,
        version: 1,
        hash: "sha256-0000000000000000",
        accessClassification: "highly_restricted",
        verificationStatus: "received",
        sharingStatus: "private",
        retentionStatus: "active",
      },
      {
        evidenceId: "ev-nb-02",
        applicationId: "APP-2026-NBILA-01",
        kind: "screenshot",
        fileType: "image/png",
        bytes: 0,
        submittedBy: "নুচিং (আবেদনকারী)",
        subject: "Submitted screenshot — content hidden",
        sourceChannel: "in_app_upload",
        originalFilename: "(masked)",
        capturedAt: now,
        uploadedAt: now,
        version: 1,
        hash: "sha256-0000000000000001",
        accessClassification: "highly_restricted",
        verificationStatus: "received",
        sharingStatus: "private",
        retentionStatus: "active",
      },
      {
        evidenceId: "ev-nb-03",
        applicationId: "APP-2026-NBILA-01",
        kind: "message_export",
        fileType: "text/plain",
        bytes: 0,
        submittedBy: "নুচিং (আবেদনকারী)",
        subject: "Message export — restricted access",
        sourceChannel: "in_app_upload",
        originalFilename: "(masked)",
        capturedAt: now,
        uploadedAt: now,
        version: 1,
        hash: "sha256-0000000000000002",
        accessClassification: "restricted",
        verificationStatus: "received",
        sharingStatus: "private",
        retentionStatus: "active",
      },
    ],
    derivatives: [],
    grants: [],
    events: [],
  };

  /* Nuching referral — awaiting acknowledgment (ref-nb-01). */
  function buildSeedReferral(input: {
    referralId: string;
    applicationId: string;
    sendingOffice: string;
    receivingOffice: string;
    state: ReferralPackage["state"];
    extra?: Partial<ReferralPackage>;
    sentAt?: string;
  }): Referral {
    const deadline = (() => {
      const ackHours = 24;
      const actionHours = 72;
      const t0 = new Date(now).getTime();
      return {
        acknowledgmentDeadline: new Date(t0 + ackHours * 3600_000).toISOString(),
        actionDeadline: new Date(t0 + (ackHours + actionHours) * 3600_000).toISOString(),
        escalationDeadline: new Date(t0 + (ackHours + actionHours + 24) * 3600_000).toISOString(),
        computedAt: now,
      };
    })();
    const pkg: ReferralPackage = {
      referralId: input.referralId,
      applicationId: input.applicationId,
      type: "sensitive_evidence_review",
      reasonCategory: "another_competent_authority_required",
      reason: "Sensitive material may require another competent authority; needs restricted review.",
      expectedAction: "Acknowledge, review safe metadata, decide on further restricted review.",
      priority: "urgent",
      sensitivity: "highly_sensitive",
      sendingOffice: input.sendingOffice,
      receivingOffice: input.receivingOffice,
      authorityDirectoryEntryId: "auth-dlao-jhenaidah",
      history: [],
      documentSelections: [],
      selectedHistoryIds: [],
      safeContactRuleIds: ["safe_time_window"],
      applicantNotificationRule: "safe_follow_up",
      sendingOfficer: {
        role: "sending_officer",
        name: "মোঃ আরিফ হোসেন",
        office: input.sendingOffice,
      },
      deadline,
      escalationOwner: "জেলা প্রশাসক, ঝিনাইদহ",
      state: input.state,
      sentAt: input.sentAt,
      deliveredAt: input.state !== "draft" && input.state !== "package_review" && input.state !== "authorized" ? input.sentAt : undefined,
      remindersSent: [],
      deliveryAttempts: [],
      createdAt: now,
      ...input.extra,
    };
    return { referralId: input.referralId, applicationId: input.applicationId, package: pkg };
  }

  const referrals: Referral[] = [
    /* Nuching — awaiting acknowledgment (primary demo). */
    {
      ...buildSeedReferral({
        referralId: "ref-nb-01",
        applicationId: "APP-2026-NBILA-01",
        sendingOffice: "ঝিনাইদহ জেলা আইনি সহায়তা কেন্দ্র",
        receivingOffice: "দায়িত্বপ্রাপ্ত সরকারি কর্তৃপক্ষ",
        state: "awaiting_acknowledgment",
        sentAt: now,
      }),
      package: {
        ...buildSeedReferral({
          referralId: "ref-nb-01",
          applicationId: "APP-2026-NBILA-01",
          sendingOffice: "ঝিনাইদহ জেলা আইনি সহায়তা কেন্দ্র",
          receivingOffice: "দায়িত্বপ্রাপ্ত সরকারি কর্তৃপক্ষ",
          state: "awaiting_acknowledgment",
          sentAt: now,
        }).package,
        humanPriorityDecision: {
          decidedAt: now,
          decidedBy: "মোঃ আরিফ হোসেন",
          decision: "urgent",
          reason: "Spreading harm + sensitive material",
          informationReliedUpon: "Applicant-reported indicators + safe-contact review",
          safetyAction: "Restrict sensitive access to authorized roles only",
          responsiblePerson: "মোঃ আরিফ হোসেন",
          reviewDeadline: new Date(new Date(now).getTime() + 8 * 3600_000).toISOString(),
          systemRecommendation: "urgent",
          override: false,
        },
        history: [
          {
            id: "hi-nb-01-1",
            occurredAt: now,
            actor: "system",
            role: "system",
            action: "referral.draft_created",
            fromState: undefined,
            toState: "draft",
            rulesetVersion: "R7-v0.1.0",
          },
          {
            id: "hi-nb-01-2",
            occurredAt: now,
            actor: "মোঃ আরিফ হোসেন",
            role: "sending_officer",
            action: "referral.authorized",
            fromState: "package_review",
            toState: "authorized",
            reason: "Sending officer confirmed all 7 authorisations",
            rulesetVersion: "R7-v0.1.0",
          },
          {
            id: "hi-nb-01-3",
            occurredAt: now,
            actor: "মোঃ আরিফ হোসেন",
            role: "sending_officer",
            action: "referral.sent",
            fromState: "authorized",
            toState: "sending",
            reason: "Sent through Secure Referral Exchange Simulator",
            rulesetVersion: "R7-v0.1.0",
          },
          {
            id: "hi-nb-01-4",
            occurredAt: now,
            actor: "system",
            role: "system",
            action: "referral.awaiting_acknowledgment",
            fromState: "sending",
            toState: "awaiting_acknowledgment",
            reason: "Delivery outcome: delivered_successfully",
            rulesetVersion: "R7-v0.1.0",
          },
        ],
      },
    },
    /* Nuching — acknowledged, awaiting action (ref-nb-02). */
    buildSeedReferral({
      referralId: "ref-nb-02",
      applicationId: "APP-2026-NBILA-01",
      sendingOffice: "ঝিনাইদহ জেলা আইনি সহায়তা কেন্দ্র",
      receivingOffice: "ঝিনাইদহ জেলা আইনি সহায়তা কেন্দ্র (নিজস্ব সেল)",
      state: "acknowledged",
      sentAt: now,
      extra: {
        acknowledgedAt: now,
        acknowledgedBy: "সহকারী কর্মকর্তা",
        documentSelections: [
          {
            documentId: "ev-nb-03",
            kind: "derivative",
            sensitivity: "highly_sensitive",
            receivingRolePermission: "receiving_officer",
            purpose: "For initial review of message export metadata",
            integrityHash: "sha256-0000000000000002",
            included: true,
          },
        ],
        history: [
          { id: "hi-nb-02-1", occurredAt: now, actor: "system", role: "system", action: "referral.draft_created", fromState: undefined, toState: "draft", rulesetVersion: "R7-v0.1.0" },
          { id: "hi-nb-02-2", occurredAt: now, actor: "system", role: "system", action: "referral.awaiting_acknowledgment", fromState: "sending", toState: "awaiting_acknowledgment", rulesetVersion: "R7-v0.1.0" },
          { id: "hi-nb-02-3", occurredAt: now, actor: "সহকারী কর্মকর্তা", role: "receiving_officer", action: "referral.acknowledged", fromState: "awaiting_acknowledgment", toState: "acknowledged", reason: "Package received; needs first action.", rulesetVersion: "R7-v0.1.0" },
        ],
      },
    }),
    /* Nuching — returned with missing_information (ref-nb-03). */
    buildSeedReferral({
      referralId: "ref-nb-03",
      applicationId: "APP-2026-NBILA-01",
      sendingOffice: "ঝিনাইদহ জেলা আইনি সহায়তা কেন্দ্র",
      receivingOffice: "দায়িত্বপ্রাপ্ত সরকারি কর্তৃপক্ষ",
      state: "returned",
      sentAt: now,
      extra: {
        returnedAt: now,
        returnedBy: "প্রাপ্তিস্থান কর্মকর্তা",
        returnReason: "required_information_missing",
        returnNote: "আবেদনকারীর সম্মতি ও পরিচয় যাচাইকরণ প্রয়োজন।",
        history: [
          { id: "hi-nb-03-1", occurredAt: now, actor: "system", role: "system", action: "referral.draft_created", fromState: undefined, toState: "draft", rulesetVersion: "R7-v0.1.0" },
          { id: "hi-nb-03-2", occurredAt: now, actor: "system", role: "system", action: "referral.awaiting_acknowledgment", fromState: "sending", toState: "awaiting_acknowledgment", rulesetVersion: "R7-v0.1.0" },
          { id: "hi-nb-03-3", occurredAt: now, actor: "system", role: "system", action: "referral.acknowledged", fromState: "awaiting_acknowledgment", toState: "acknowledged", reason: "Acknowledged by receiving office", rulesetVersion: "R7-v0.1.0" },
          { id: "hi-nb-03-4", occurredAt: now, actor: "প্রাপ্তিস্থান কর্মকর্তা", role: "receiving_officer", action: "referral.returned", fromState: "acknowledged", toState: "returned", reason: "Returned: required_information_missing", rulesetVersion: "R7-v0.1.0" },
        ],
      },
    }),
    /* Nuching — overdue (ref-nb-04). */
    buildSeedReferral({
      referralId: "ref-nb-04",
      applicationId: "APP-2026-NBILA-01",
      sendingOffice: "ঝিনাইদহ জেলা আইনি সহায়তা কেন্দ্র",
      receivingOffice: "দায়িত্বপ্রাপ্ত সরকারি কর্তৃপক্ষ",
      state: "overdue_acknowledgment",
      sentAt: now,
      extra: {
        deadline: {
          acknowledgmentDeadline: new Date(new Date(now).getTime() - 4 * 3600_000).toISOString(),
          actionDeadline: new Date(new Date(now).getTime() + 68 * 3600_000).toISOString(),
          escalationDeadline: new Date(new Date(now).getTime() + 92 * 3600_000).toISOString(),
          computedAt: now,
        },
        remindersSent: [
          { at: now, by: "system", outcome: "sent" },
        ],
        history: [
          { id: "hi-nb-04-1", occurredAt: now, actor: "system", role: "system", action: "referral.draft_created", fromState: undefined, toState: "draft", rulesetVersion: "R7-v0.1.0" },
          { id: "hi-nb-04-2", occurredAt: now, actor: "system", role: "system", action: "referral.awaiting_acknowledgment", fromState: "sending", toState: "awaiting_acknowledgment", rulesetVersion: "R7-v0.1.0" },
          { id: "hi-nb-04-3", occurredAt: now, actor: "system", role: "system", action: "referral.overdue_acknowledgment", fromState: "awaiting_acknowledgment", toState: "overdue_acknowledgment", rulesetVersion: "R7-v0.1.0" },
          { id: "hi-nb-04-4", occurredAt: now, actor: "system", role: "system", action: "referral.reminder_sent", fromState: "overdue_acknowledgment", toState: "overdue_acknowledgment", rulesetVersion: "R7-v0.1.0" },
        ],
      },
    }),
    /* Rahim — first transfer (Dhaka DLAO → Labour Cell). */
    buildSeedReferral({
      referralId: "ref-rh-01",
      applicationId: "APP-2026-RAHIM-01",
      sendingOffice: "ঢাকা জেলা আইনি সহায়তা কেন্দ্র",
      receivingOffice: "শ্রম আইনি সহায়তা সেল",
      state: "returned",
      sentAt: now,
      extra: {
        type: "jurisdiction_transfer",
        reasonCategory: "jurisdiction_dispute",
        expectedAction: "Take over labour compensation determination.",
        priority: "standard",
        sensitivity: "standard",
        authorityDirectoryEntryId: "auth-labour-cell",
        returnedAt: now,
        returnedBy: "শ্রম সেল প্রধান",
        returnReason: "receiving_office_outside_route",
        returnNote: "প্রাপ্তিস্থান কার্যালয় এই বিষয়ে সরাসরি এখতিয়ারের বাইরে বলে মনে হচ্ছে।",
        history: [
          { id: "hi-rh-01-1", occurredAt: now, actor: "system", role: "system", action: "referral.draft_created", fromState: undefined, toState: "draft", rulesetVersion: "R7-v0.1.0" },
          { id: "hi-rh-01-2", occurredAt: now, actor: "system", role: "system", action: "referral.awaiting_acknowledgment", fromState: "sending", toState: "awaiting_acknowledgment", rulesetVersion: "R7-v0.1.0" },
          { id: "hi-rh-01-3", occurredAt: now, actor: "system", role: "system", action: "referral.returned", fromState: "awaiting_acknowledgment", toState: "returned", reason: "Returned: receiving_office_outside_route", rulesetVersion: "R7-v0.1.0" },
        ],
      },
    }),
    /* Rahim — second transfer. */
    buildSeedReferral({
      referralId: "ref-rh-02",
      applicationId: "APP-2026-RAHIM-01",
      sendingOffice: "ঢাকা জেলা আইনি সহায়তা কেন্দ্র",
      receivingOffice: "শ্রম আইনি সহায়তা সেল",
      state: "returned",
      sentAt: now,
      extra: {
        type: "jurisdiction_transfer",
        reasonCategory: "jurisdiction_dispute",
        expectedAction: "Take over labour compensation determination.",
        priority: "standard",
        sensitivity: "standard",
        authorityDirectoryEntryId: "auth-labour-cell",
        supersededByReferralId: undefined,
        returnedAt: now,
        returnedBy: "শ্রম সেল প্রধান",
        returnReason: "legal_basis_verification_required",
        returnNote: "আইনি ভিত্তি যাচাই করা প্রয়োজন।",
        history: [
          { id: "hi-rh-02-1", occurredAt: now, actor: "system", role: "system", action: "referral.draft_created", fromState: undefined, toState: "draft", rulesetVersion: "R7-v0.1.0" },
          { id: "hi-rh-02-2", occurredAt: now, actor: "system", role: "system", action: "referral.awaiting_acknowledgment", fromState: "sending", toState: "awaiting_acknowledgment", rulesetVersion: "R7-v0.1.0" },
          { id: "hi-rh-02-3", occurredAt: now, actor: "system", role: "system", action: "referral.returned", fromState: "awaiting_acknowledgment", toState: "returned", reason: "Returned: legal_basis_verification_required", rulesetVersion: "R7-v0.1.0" },
        ],
      },
    }),
  ];

  /* Rahim's pre-staged escalation. */
  const escalationTasks: EscalationTask[] = [
    {
      escalationId: "escal-rh-01",
      applicationId: "APP-2026-RAHIM-01",
      caseId: "APP-2026-RAHIM-01",
      reason: "repeated_transfer",
      state: "repeat_detected",
      history: [
        { at: now, from: "first_transfer", to: "first_return", actor: "system", reason: "First transfer returned: receiving_office_outside_route" },
        { at: now, from: "first_return", to: "second_transfer", actor: "system", reason: "Second transfer attempted" },
        { at: now, from: "second_transfer", to: "second_return", actor: "system", reason: "Second transfer returned: legal_basis_verification_required" },
        { at: now, from: "second_return", to: "repeat_detected", actor: "system", reason: "Two transfer-return cycles detected" },
      ],
      createdAt: now,
    },
  ];

  /* Citizen-safe notification draft for Nuching. */
  const citizenSafeStatuses: CitizenSafeStatus[] = [
    {
      notificationId: "safe-nb-01",
      applicationId: "APP-2026-NBILA-01",
      recordId: "APP-2026-NBILA-01",
      generatedAt: now,
      safeMessageBn: "আপনার আবেদনটি জরুরি পর্যালোচনায় আছে। নিরাপদ যোগাযোগের মাধ্যমে পরবর্তী আপডেট দেওয়া হবে।",
      safeMessageEn: "Your application is under urgent human review. Updates will be sent through your safe channel.",
      nextSafeAction: "DLAO officer will contact you through the safe window you provided.",
      approvedContactMethod: "phone",
      clearedBy: "system",
    },
  ];

  /* Routing recommendation for Nuching. */
  const routingRecommendations: RoutingRecommendation[] = [
    {
      recommendationId: "rec-nb-01",
      applicationId: "APP-2026-NBILA-01",
      generatedAt: now,
      recommendedDestination: {
        entryId: "auth-other-govt",
        displayName: "Authorized Competent Government Authority",
        type: "other_competent_authority",
      },
      confidence: "sufficient_for_human_review",
      reasons: [
        { bn: "বিষয় ক্যাটাগরি ও জেলার ভিত্তিতে “দায়িত্বপ্রাপ্ত সরকারি কর্তৃপক্ষ” প্রযোজ্য।", en: "Based on matter category and district, the authorized competent authority applies." },
      ],
      sourceFields: ["matter_category", "applicant_district", "current_office"],
      missingOrUncertain: [],
      conflicts: [],
      rulesetVersion: "R7-v0.1.0",
    },
  ];

  /* ====================================================================
   * PROMPT 8 — Panel-lawyer workflow, hearings, change-requests,
   * pattern review, payment reconciliation, voice status, contact
   * reliability.
   *
   * Seeded data follows the PDF scenarios:
   *  - Abdul Malek's seven-month-old Barguna case (A5).
   *  - Marzina Begum's T1 lawyer-change scenario.
   *  - One panel lawyer on approved leave (trap-case for pattern review).
   *  - One lawyer whose update delay was caused by a recorded system
   *    outage (trap-case for pattern review).
   *  - Cross-case inactivity on one shared lawyer, so the repeated
   *    inactivity pattern has at least three contributing cases.
   *  - Marzina's payment reconciliation worksheet.
   *  - One voice-status session for Malek.
   *  - Several ContactAttempt records for Malek's shop-owned number
   *    (failed), and a Marzina contact (successful, applicant).
   * ==================================================================== */

  const panelLawyers: PanelLawyer[] = [
    {
      lawyerId: "law-moinul",
      fullNameBn: "অ্যাডভোকেট মইনুল হক",
      fullNameEn: "Advocate Moinul Haque",
      enrollmentNumber: "BAR-DHA-2018-1142",
      barAssociation: "Dhaka Bar Association",
      panelStatus: "approved",
      courtEligibility: ["Barguna District Court", "Barisal Division", "Supreme Court of Bangladesh (Appellate)"],
      matterCategories: ["compensation", "land", "labour"],
      languages: ["bn", "en"],
      availability: "busy",
      activeCaseCount: 2,
      upcomingHearingCount: 2,
      overdueRequiredUpdateCount: 3,
      lastAssignmentAt: "২০২৬-০২-১৮T09:00:00.000Z",
      conflictCheckCompleted: true,
      joinedPanelAt: "২০২৪-০১-১০T00:00:00.000Z",
      notes: "Cross-case inactivity contributor (Malek, Marzina, Rahela, Salim).",
    },
    {
      lawyerId: "law-sharmin",
      fullNameBn: "অ্যাডভোকেট শারমিন আক্তার",
      fullNameEn: "Advocate Sharmin Akhter",
      enrollmentNumber: "BAR-DHA-2019-2210",
      barAssociation: "Dhaka Bar Association",
      panelStatus: "approved",
      courtEligibility: ["Dhaka District Court", "Family Court Dhaka"],
      matterCategories: ["family", "labour"],
      languages: ["bn", "en"],
      availability: "available",
      activeCaseCount: 1,
      upcomingHearingCount: 1,
      overdueRequiredUpdateCount: 0,
      lastAssignmentAt: "২০২৬-০৭-২০T09:00:00.000Z",
      conflictCheckCompleted: true,
      joinedPanelAt: "২০২৪-০৩-০৫T00:00:00.000Z",
    },
    {
      lawyerId: "law-rafiq",
      fullNameBn: "অ্যাডভোকেট রফিকুল ইসলাম",
      fullNameEn: "Advocate Rafiqul Islam",
      enrollmentNumber: "BAR-CHT-2017-0988",
      barAssociation: "Chittagong Bar Association",
      panelStatus: "approved",
      courtEligibility: ["Chittagong District Court", "Land Survey Tribunal"],
      matterCategories: ["land", "labour"],
      languages: ["bn"],
      availability: "on_approved_leave",
      activeCaseCount: 1,
      upcomingHearingCount: 0,
      overdueRequiredUpdateCount: 0,
      lastAssignmentAt: "২০২৬-০৫-২৮T09:00:00.000Z",
      conflictCheckCompleted: true,
      joinedPanelAt: "২০২৩-১১-১২T00:00:00.000Z",
      notes: "On approved leave 2026-08-01 to 2026-09-30. Trap-case for pattern review.",
    },
    {
      lawyerId: "law-nasreen",
      fullNameBn: "অ্যাডভোকেট নাসরিন সুলতানা",
      fullNameEn: "Advocate Nasreen Sultana",
      enrollmentNumber: "BAR-DHA-2020-3320",
      barAssociation: "Dhaka Bar Association",
      panelStatus: "approved",
      courtEligibility: ["Dhaka District Court", "Labour Court Dhaka"],
      matterCategories: ["labour", "compensation"],
      languages: ["bn", "en"],
      availability: "temporarily_unavailable",
      activeCaseCount: 1,
      upcomingHearingCount: 0,
      overdueRequiredUpdateCount: 1,
      lastAssignmentAt: "২০২৬-০৬-১৫T09:00:00.000Z",
      conflictCheckCompleted: true,
      joinedPanelAt: "২২০২৪-০৮-২০T00:00:00.000Z",
      notes: "Update delay caused by recorded system outage 2026-08-12 to 2026-08-14. Trap-case for pattern review.",
    },
    {
      lawyerId: "law-kabir",
      fullNameBn: "অ্যাডভোকেট কবির হোসেন",
      fullNameEn: "Advocate Kabir Hossain",
      enrollmentNumber: "BAR-BAR-2018-0440",
      barAssociation: "Barisal Bar Association",
      panelStatus: "approved",
      courtEligibility: ["Barguna District Court", "Barisal District Court"],
      matterCategories: ["compensation", "land"],
      languages: ["bn"],
      availability: "available",
      activeCaseCount: 0,
      upcomingHearingCount: 0,
      overdueRequiredUpdateCount: 0,
      lastAssignmentAt: "২০২৬-০১-০৫T09:00:00.000Z",
      conflictCheckCompleted: true,
      joinedPanelAt: "২০২৪-০৫-১৫T00:00:00.000Z",
    },
    {
      lawyerId: "law-rahima",
      fullNameBn: "অ্যাডভোকেট রাহিমা খাতুন",
      fullNameEn: "Advocate Rahima Khatun",
      enrollmentNumber: "BAR-DHA-2016-1108",
      barAssociation: "Dhaka Bar Association",
      panelStatus: "approved",
      courtEligibility: ["Dhaka Family Court", "Women & Children Repression Prevention Tribunal"],
      matterCategories: ["family", "women_children"],
      languages: ["bn", "en"],
      availability: "available",
      activeCaseCount: 0,
      upcomingHearingCount: 0,
      overdueRequiredUpdateCount: 0,
      lastAssignmentAt: "২০২৬-০৩-১০T09:00:00.000Z",
      conflictCheckCompleted: true,
      joinedPanelAt: "২০২৩-০৭-০১T00:00:00.000Z",
    },
  ];

  const lawyerAvailabilities: LawyerAvailability[] = [
    {
      availabilityId: "av-moinul-01",
      lawyerId: "law-moinul",
      status: "busy",
      effectiveAt: "২০২৬-০৮-২০T09:00:00.000Z",
      expectedReturnAt: "২০২৬-০৯-১৫T00:00:00.000Z",
      optionalCapacity: "low",
      reasonCategory: "court_duty",
      reasonNote: "Heavy hearing schedule in Barisal Division.",
      lastConfirmedAt: "২০২৬-০৮-২৫T09:00:00.000Z",
      source: "self_report",
    },
    {
      availabilityId: "av-rafiq-01",
      lawyerId: "law-rafiq",
      status: "on_approved_leave",
      effectiveAt: "২০২৬-০৮-০১T00:00:00.000Z",
      expectedReturnAt: "২০২৬-০৯-৩০T00:00:00.000Z",
      optionalCapacity: "low",
      reasonCategory: "leave",
      reasonNote: "Approved family leave.",
      lastConfirmedAt: "২০২৬-০৮-০১T00:00:00.000Z",
      source: "self_report",
    },
    {
      availabilityId: "av-nasreen-01",
      lawyerId: "law-nasreen",
      status: "temporarily_unavailable",
      effectiveAt: "২০২৬-০৮-১২T00:00:00.000Z",
      expectedReturnAt: "২০২৬-০৮-২০T00:00:00.000Z",
      optionalCapacity: "low",
      reasonCategory: "system_outage",
      reasonNote: "Recorded system outage 2026-08-12 to 2026-08-14 prevented submission.",
      lastConfirmedAt: "২০২৬-০৮-১৫T00:00:00.000Z",
      source: "dlao_recorded",
    },
  ];

  const lawyerAssignments: LawyerAssignment[] = [
    /* Malek's assignment — currently active, lawyer Moinul. */
    {
      assignmentId: "as-malek-01",
      applicationId: "APP-2026-MALEK-01",
      caseId: "CASE-MALEK-01",
      lawyerId: "law-moinul",
      state: "active",
      preparedBy: "ড্যাশবোর্ড কর্মকর্তা",
      preparedAt: "২০২৬-০২-১৮T09:00:00.000Z",
      offeredAt: "২০২৬-০২-১৮T10:00:00.000Z",
      responseDeadline: "২০২৬-০২-২০T17:00:00.000Z",
      reasonForAssignment: "Compensation matter, Barguna District Court, Bangla-medium.",
      applicantPreferenceConsidered: true,
      conflictCheckCompleted: true,
      workloadReviewed: true,
      requiredFirstAction: "Initial client contact within 7 days.",
      acceptedAt: "২০২৬-০২-১৯T11:00:00.000Z",
      becameActiveAt: "২০২৬-০২-১৯T11:00:00.000Z",
      history: [
        { at: "২০২৬-০২-১৮T09:00:00.000Z", actor: "ড্যাশবোর্ড কর্মকর্তা", toState: "prepared", reason: "Prepared for offer." },
        { at: "২০২৬-০২-১৮T10:00:00.000Z", actor: "ড্যাশবোর্ড কর্মকর্তা", fromState: "prepared", toState: "offered", reason: "Offered to Advocate Moinul." },
        { at: "২০২৬-০২-১৮T10:00:00.000Z", actor: "ড্যাশবোর্ড কর্মকর্তা", fromState: "offered", toState: "awaiting_response", reason: "Awaiting lawyer response." },
        { at: "২০২৬-০২-১৯T11:00:00.000Z", actor: "law-moinul", fromState: "awaiting_response", toState: "accepted", reason: "Accepted by lawyer." },
        { at: "২০২৬-০২-১৯T11:00:00.000Z", actor: "law-moinul", fromState: "accepted", toState: "active", reason: "Assignment became active." },
      ],
      auditEventIds: [],
    },
    /* Marzina's assignment — currently active, lawyer Moinul (later flagged for reassignment). */
    {
      assignmentId: "as-marzina-01",
      applicationId: "APP-2026-MARZINA-01",
      caseId: "CASE-MARZINA-01",
      lawyerId: "law-moinul",
      state: "active",
      preparedBy: "ড্যাশবোর্ড কর্মকর্তা",
      preparedAt: "২০২৬-০৪-১৫T09:00:00.000Z",
      offeredAt: "২০২৬-০৪-১৫T10:00:00.000Z",
      responseDeadline: "২০২৬-০৪-১৭T17:00:00.000Z",
      reasonForAssignment: "Family matter, Dhaka Family Court.",
      applicantPreferenceConsidered: true,
      conflictCheckCompleted: true,
      workloadReviewed: true,
      requiredFirstAction: "Initial client contact within 7 days.",
      acceptedAt: "২০২৬-০৪-১৬T10:00:00.000Z",
      becameActiveAt: "২০২৬-০৪-১৬T10:00:00.000Z",
      history: [
        { at: "২০২৬-০৪-১৫T09:00:00.000Z", actor: "ড্যাশবোর্ড কর্মকর্তা", toState: "prepared" },
        { at: "২০২৬-০৪-১৫T10:00:00.000Z", actor: "ড্যাশবোর্ড কর্মকর্তা", fromState: "prepared", toState: "offered" },
        { at: "২০২৬-০৪-১৫T10:00:00.000Z", actor: "ড্যাশবোর্ড কর্মকর্তা", fromState: "offered", toState: "awaiting_response" },
        { at: "২০২৬-০৪-১৬T10:00:00.000Z", actor: "law-moinul", fromState: "awaiting_response", toState: "accepted" },
        { at: "২০২৬-০৪-১৬T10:00:00.000Z", actor: "law-moinul", fromState: "accepted", toState: "active" },
      ],
      auditEventIds: [],
    },
    /* Rahela — same lawyer Moinul, second inactivity contributor. */
    {
      assignmentId: "as-rahela-01",
      applicationId: "APP-2026-RAHELA-01",
      caseId: "CASE-RAHELA-01",
      lawyerId: "law-moinul",
      state: "active",
      preparedBy: "ড্যাশবোর্ড কর্মকর্তা",
      preparedAt: "২০২৬-০৫-২৫T09:00:00.000Z",
      offeredAt: "২০২৬-০৫-২৫T10:00:00.000Z",
      responseDeadline: "২০২৬-০৫-২৭T17:00:00.000Z",
      reasonForAssignment: "Family matter, Gaibandha.",
      applicantPreferenceConsidered: false,
      conflictCheckCompleted: true,
      workloadReviewed: true,
      requiredFirstAction: "Initial client contact within 7 days.",
      acceptedAt: "২০২৬-০৫-২৬T10:00:00.000Z",
      becameActiveAt: "২০২৬-০৫-২৬T10:00:00.000Z",
      history: [
        { at: "২০২৬-০৫-২৫T09:00:00.000Z", actor: "ড্যাশবোর্ড কর্মকর্তা", toState: "prepared" },
        { at: "২০২৬-০৫-২৫T10:00:00.000Z", actor: "ড্যাশবোর্ড কর্মকর্তা", fromState: "prepared", toState: "offered" },
        { at: "২০২৬-০৫-২৬T10:00:00.000Z", actor: "law-moinul", fromState: "offered", toState: "accepted" },
        { at: "২০২৬-০৫-২৬T10:00:00.000Z", actor: "law-moinul", fromState: "accepted", toState: "active" },
      ],
      auditEventIds: [],
    },
    /* Salim — third contributor. */
    {
      assignmentId: "as-salim-01",
      applicationId: "APP-2026-SALIM-01",
      caseId: "CASE-SALIM-01",
      lawyerId: "law-moinul",
      state: "active",
      preparedBy: "ড্যাশবোর্ড কর্মকর্তা",
      preparedAt: "২০২৬-০৬-১০T09:00:00.000Z",
      offeredAt: "২০২৬-০৬-১০T10:00:00.000Z",
      responseDeadline: "২০২৬-০৬-১২T17:00:00.000Z",
      reasonForAssignment: "Land matter, Chittagong.",
      applicantPreferenceConsidered: false,
      conflictCheckCompleted: true,
      workloadReviewed: true,
      requiredFirstAction: "Initial client contact within 7 days.",
      acceptedAt: "২০২৬-০৬-১১T10:00:00.000Z",
      becameActiveAt: "২০২৬-০৬-১১T10:00:00.000Z",
      history: [
        { at: "২০২৬-০৬-১০T09:00:00.000Z", actor: "ড্যাশবোর্ড কর্মকর্তা", toState: "prepared" },
        { at: "২০২৬-০৬-১০T10:00:00.000Z", actor: "ড্যাশবোর্ড কর্মকর্তা", fromState: "prepared", toState: "offered" },
        { at: "২০২৬-০৬-১১T10:00:00.000Z", actor: "law-moinul", fromState: "offered", toState: "accepted" },
        { at: "২০২৬-০৬-১১T10:00:00.000Z", actor: "law-moinul", fromState: "accepted", toState: "active" },
      ],
      auditEventIds: [],
    },
    /* New assignment awaiting response (for the worklist demo). */
    {
      assignmentId: "as-newdemo-01",
      applicationId: "APP-2026-MALEK-01",
      caseId: "CASE-MALEK-01",
      lawyerId: "law-sharmin",
      state: "awaiting_response",
      preparedBy: "ড্যাশবোর্ড কর্মকর্তা",
      preparedAt: now,
      offeredAt: now,
      responseDeadline: new Date(new Date(now).getTime() + 48 * 3600 * 1000).toISOString(),
      reasonForAssignment: "Backup candidate for Barguna compensation matter.",
      applicantPreferenceConsidered: false,
      conflictCheckCompleted: true,
      workloadReviewed: true,
      requiredFirstAction: "Review case materials and respond.",
      history: [
        { at: now, actor: "ড্যাশবোর্ড কর্মকর্তা", toState: "prepared" },
        { at: now, actor: "ড্যাশবোর্ড কর্মকর্তা", fromState: "prepared", toState: "offered" },
        { at: now, actor: "ড্যাশবোর্ড কর্মকর্তা", fromState: "offered", toState: "awaiting_response" },
      ],
      auditEventIds: [],
    },
  ];

  const lawyerAssignmentResponses: AssignmentResponse[] = [
    {
      responseId: "resp-malek-01",
      assignmentId: "as-malek-01",
      lawyerId: "law-moinul",
      decision: "accepted",
      at: "২০২৬-০২-১৯T11:00:00.000Z",
      note: "Compensation matter within scope. Will begin client contact within 7 days.",
    },
    {
      responseId: "resp-marzina-01",
      assignmentId: "as-marzina-01",
      lawyerId: "law-moinul",
      decision: "accepted",
      at: "২০২৬-০৪-১৬T10:00:00.000Z",
    },
    {
      responseId: "resp-decline-demo",
      assignmentId: "as-decline-demo",
      lawyerId: "law-nasreen",
      decision: "declined",
      at: "২০২৬-০৭-০৫T10:00:00.000Z",
      declineReason: "capacity_limitation",
      note: "Currently over capacity for new compensation matters.",
    },
  ];

  const caseHearings: CaseHearing[] = [
    /* Malek — past verified hearing. */
    {
      hearingId: "hr-malek-01",
      caseId: "CASE-MALEK-01",
      court: "Barguna District Court",
      hearingDate: "২০২৬-০৩-১০T10:00:00.000Z",
      source: "court_cause_list",
      sourceNote: "Court cause list published 2026-03-05.",
      verificationStatus: "completed",
      attendanceRequirement: "must_attend",
      responsibleLawyerId: "law-moinul",
      reminderSchedule: [],
      hearingResult: {
        recordedAt: "২০২৬-০৩-১০T16:00:00.000Z",
        recordedBy: "law-moinul",
        outcome: "adjourned",
        summary: "Adjourned to next date pending witness availability.",
        nextHearingDate: "২০২৬-০৪-১৫T10:00:00.000Z",
      },
      nextHearingId: "hr-malek-02",
      lastUpdatedBy: "law-moinul",
      versionHistory: [{ version: 1, changedAt: "২০২৬-০২-২৫T09:00:00.000Z", changedBy: "law-moinul", newDate: "২০২৬-০৩-১০T10:00:00.000Z", reason: "Initial scheduling" }],
      createdAt: "২০২৬-০২-২৫T09:00:00.000Z",
    },
    /* Malek — past hearing held, result overdue (post-hearing update not submitted). */
    {
      hearingId: "hr-malek-02",
      caseId: "CASE-MALEK-01",
      court: "Barguna District Court",
      hearingDate: "২০২৬-০৪-১৫T10:00:00.000Z",
      source: "court_cause_list",
      sourceNote: "Court cause list published 2026-04-10.",
      verificationStatus: "result_overdue",
      attendanceRequirement: "must_attend",
      responsibleLawyerId: "law-moinul",
      reminderSchedule: [],
      hearingResult: {
        recordedAt: "২০২৬-০৪-১৫T16:00:00.000Z",
        recordedBy: "law-moinul",
        outcome: "adjourned",
        summary: "Adjourned for settlement negotiation; next date to be informed.",
        nextHearingDate: "২০২৬-০৭-২০T10:00:00.000Z",
      },
      nextHearingId: "hr-malek-03",
      lastUpdatedBy: "law-moinul",
      versionHistory: [
        { version: 1, changedAt: "২০২৬-০৩-২০T09:00:00.000Z", changedBy: "law-moinul", newDate: "২০২৬-০৪-১৫T10:00:00.000Z", reason: "Initial scheduling" },
        { version: 2, changedAt: "২০২৬-০৪-১০T10:00:00.000Z", changedBy: "court", previousDate: "২০২৬-০৪-১৫T10:00:00.000Z", newDate: "২০২৬-০৪-১৫T10:00:00.000Z", reason: "Source confirmation from court cause list." },
      ],
      createdAt: "২০২৬-০৩-২০T09:00:00.000Z",
    },
    /* Malek — upcoming hearing, source is "lawyer_recorded" (UNVERIFIED). */
    {
      hearingId: "hr-malek-03",
      caseId: "CASE-MALEK-01",
      court: "Barguna District Court",
      hearingDate: "২০২৬-০৭-২০T10:00:00.000Z",
      source: "lawyer_recorded",
      sourceNote: "Mentioned by Advocate Moinul after the 2026-04-15 adjournment.",
      verificationStatus: "awaiting_verification",
      attendanceRequirement: "must_attend",
      responsibleLawyerId: "law-moinul",
      reminderSchedule: [
        { at: "২০২৬-০৭-১৫T09:00:00.000Z", channel: "sms" },
        { at: "২০২৬-০৭-১৮T09:00:00.000Z", channel: "voice" },
      ],
      lastUpdatedBy: "law-moinul",
      versionHistory: [{ version: 1, changedAt: "২০২৬-০৪-১৫T16:00:00.000Z", changedBy: "law-moinul", newDate: "২০২৬-০৭-২০T10:00:00.000Z", reason: "Recorded after adjournment" }],
      createdAt: "২০২৬-০৪-১৫T16:00:00.000Z",
    },
    /* Marzina — past hearing held, no required post-hearing update. */
    {
      hearingId: "hr-marzina-01",
      caseId: "CASE-MARZINA-01",
      court: "Dhaka Family Court",
      hearingDate: "২০২৬-০৬-১২T11:00:00.000Z",
      source: "court_cause_list",
      verificationStatus: "result_overdue",
      attendanceRequirement: "must_attend",
      responsibleLawyerId: "law-moinul",
      reminderSchedule: [],
      hearingResult: {
        recordedAt: "২০২৬-০৬-১২T16:30:00.000Z",
        recordedBy: "law-moinul",
        outcome: "hearing_held",
        summary: "Hearing held; arguments concluded; order reserved.",
      },
      lastUpdatedBy: "law-moinul",
      versionHistory: [{ version: 1, changedAt: "২০২৬-০৫-৩০T09:00:00.000Z", changedBy: "law-moinul", newDate: "২০২৬-০৬-১২T11:00:00.000Z", reason: "Initial scheduling" }],
      createdAt: "২০২৬-০৫-৩০T09:00:00.000Z",
    },
    /* Marzina — upcoming hearing, awaiting verification. */
    {
      hearingId: "hr-marzina-02",
      caseId: "CASE-MARZINA-01",
      court: "Dhaka Family Court",
      hearingDate: "২০২৬-০৯-২২T11:00:00.000Z",
      source: "court_cause_list",
      sourceNote: "Court cause list published 2026-09-15.",
      verificationStatus: "verified",
      attendanceRequirement: "must_attend",
      responsibleLawyerId: "law-moinul",
      reminderSchedule: [],
      lastUpdatedBy: "dlao",
      versionHistory: [{ version: 1, changedAt: "২০২৬-০৯-১৫T09:00:00.000Z", changedBy: "dlao", newDate: "২০২৬-০৯-২২T11:00:00.000Z", reason: "Cause list confirmation" }],
      createdAt: "২০২৬-০৯-১৫T09:00:00.000Z",
    },
    /* Rahela — upcoming hearing. */
    {
      hearingId: "hr-rahela-01",
      caseId: "CASE-RAHELA-01",
      court: "Gaibandha District Court",
      hearingDate: "২০২৬-০৯-২৫T10:00:00.000Z",
      source: "court_cause_list",
      verificationStatus: "verified",
      attendanceRequirement: "must_attend",
      responsibleLawyerId: "law-moinul",
      reminderSchedule: [],
      lastUpdatedBy: "dlao",
      versionHistory: [{ version: 1, changedAt: "২০২৬-০৮-২৫T09:00:00.000Z", changedBy: "dlao", newDate: "২০২৬-০৯-২৫T10:00:00.000Z", reason: "Cause list confirmation" }],
      createdAt: "২০২৬-০৮-২৫T09:00:00.000Z",
    },
  ];

  const caseProgressUpdates: CaseProgressUpdate[] = [
    /* Malek — one valid update after the first hearing. */
    {
      updateId: "up-malek-01",
      caseId: "CASE-MALEK-01",
      lawyerId: "law-moinul",
      updateType: "hearing_attended",
      eventDate: "২০২৬-০৩-১০T10:00:00.000Z",
      submissionDate: "২০২৬-০৩-১০T16:30:00.000Z",
      caseStageAtUpdate: "hearing_in_progress",
      courtOrLocation: "Barguna District Court",
      summary: "Attended hearing. Witness unavailable; court adjourned.",
      source: "lawyer_recorded",
      nextHearingId: "hr-malek-02",
      nextAction: "Re-confirm witness availability.",
      responsibleActor: "law-moinul",
      citizenVisibleSummary: "আদালত শুনানি স্থগিত করেছে — পরবর্তী তারিখ শীঘ্রই জানানো হবে।",
      confirmationStatus: "submitted",
    },
    /* Malek — no post-hearing update for the 2026-04-15 hearing (the missed-update failure). */
    /* Marzina — one valid early update. */
    {
      updateId: "up-marzina-01",
      caseId: "CASE-MARZINA-01",
      lawyerId: "law-moinul",
      updateType: "client_contact_completed",
      eventDate: "২০২৬-০৪-২০T14:00:00.000Z",
      submissionDate: "২০২৬-০৪-২০T17:00:00.000Z",
      caseStageAtUpdate: "lawyer_engagement",
      summary: "Initial client contact completed; documents collected.",
      nextAction: "Prepare for next hearing.",
      responsibleActor: "law-moinul",
      citizenVisibleSummary: "আইনজীবী আপনার সাথে যোগাযোগ করেছেন এবং নথি সংগ্রহ করেছেন।",
      confirmationStatus: "submitted",
    },
  ];

  const requiredUpdates: RequiredUpdate[] = [
    /* Malek — post-hearing update for 2026-04-15 hearing is OVERDUE. */
    {
      requirementId: "ru-malek-01",
      caseId: "CASE-MALEK-01",
      lawyerId: "law-moinul",
      trigger: "completed_hearing",
      requiredUpdateType: "hearing_attended",
      createdAt: "২০২৬-০৪-১৫T16:30:00.000Z",
      dueAt: "২০২৬-০৪-২২T17:00:00.000Z",
      reminderSchedule: [
        { at: "২০২৬-০৪-১৮T09:00:00.000Z", channel: "sms" },
        { at: "২০২৬-০৪-২১T09:00:00.000Z", channel: "voice" },
      ],
      state: "overdue",
    },
    /* Malek — second missed (post-hearing) for the upcoming hearing. */
    {
      requirementId: "ru-malek-02",
      caseId: "CASE-MALEK-01",
      lawyerId: "law-moinul",
      trigger: "upcoming_hearing",
      requiredUpdateType: "next_hearing_recorded",
      createdAt: "২০২৬-০৬-২০T09:00:00.000Z",
      dueAt: "২০২৬-০৬-২৭T17:00:00.000Z",
      reminderSchedule: [
        { at: "২০২৬-০৬-২৫T09:00:00.000Z", channel: "sms" },
      ],
      state: "overdue",
    },
    /* Marzina — post-hearing update for 2026-06-12 hearing is OVERDUE. */
    {
      requirementId: "ru-marzina-01",
      caseId: "CASE-MARZINA-01",
      lawyerId: "law-moinul",
      trigger: "completed_hearing",
      requiredUpdateType: "order_received",
      createdAt: "২০২৬-০৬-১২T16:30:00.000Z",
      dueAt: "২০২৬-০৬-১৯T17:00:00.000Z",
      reminderSchedule: [{ at: "২০২৬-০৬-১৭T09:00:00.000Z", channel: "sms" }],
      state: "overdue",
    },
    /* Marzina — second missed (pre-hearing preparation update). */
    {
      requirementId: "ru-marzina-02",
      caseId: "CASE-MARZINA-01",
      lawyerId: "law-moinul",
      trigger: "upcoming_hearing",
      requiredUpdateType: "filing_prepared",
      createdAt: "২০২৬-০৮-২৫T09:00:00.000Z",
      dueAt: "২০২৬-০৯-০১T17:00:00.000Z",
      reminderSchedule: [{ at: "২০২৬-০৮-৩০T09:00:00.000Z", channel: "sms" }],
      state: "overdue",
    },
  ];

  const updateReminders: UpdateReminder[] = [
    {
      reminderId: "rem-malek-01-1",
      requirementId: "ru-malek-01",
      sentAt: "২০২৬-০৪-১৮T09:00:00.000Z",
      channel: "sms",
      outcome: "delivered",
      recipientLawyerId: "law-moinul",
      templateVersion: "P8-reminder-v1",
      note: "First reminder sent after hearing.",
    },
    {
      reminderId: "rem-malek-01-2",
      requirementId: "ru-malek-01",
      sentAt: "২০২৬-০৪-২১T09:00:00.000Z",
      channel: "voice",
      outcome: "undeliverable",
      recipientLawyerId: "law-moinul",
      templateVersion: "P8-reminder-v1",
      note: "Second reminder — voice line unavailable.",
    },
  ];

  const contactReliabilities: ContactReliability[] = [
    /* Malek — shop-owned phone number. */
    {
      contactId: "ct-malek-shop",
      caseId: "CASE-MALEK-01",
      applicantId: "APP-2026-MALEK-01",
      number: "+8801711-XXXXXX",
      numberOwner: "shop",
      relationshipToApplicant: "Local shop where applicant shops; shop owner owns the phone.",
      channel: "phone",
      safeToUse: false,
      permittedMessageType: "neutral_callback",
      mayMentionLegalAid: false,
      reliability: "low",
      preferredTime: "unknown",
      source: "field_officer",
      confirmationStatus: "confirmed",
      notes: "Phone belongs to local shop owner. Do not disclose legal-aid involvement, matter type, or lawyer name. Use neutral callback wording.",
    },
    /* Malek — helpline contact channel. */
    {
      contactId: "ct-malek-helpline",
      caseId: "CASE-MALEK-01",
      applicantId: "APP-2026-MALEK-01",
      number: "16699",
      numberOwner: "other",
      relationshipToApplicant: "DLAS helpline IVR.",
      channel: "voice_ivr",
      safeToUse: true,
      permittedMessageType: "safe_follow_up",
      mayMentionLegalAid: true,
      reliability: "high",
      source: "system",
      confirmationStatus: "confirmed",
      notes: "Primary accessible status route — no smartphone required.",
    },
    /* Marzina — applicant's own number. */
    {
      contactId: "ct-marzina-mobile",
      caseId: "CASE-MARZINA-01",
      applicantId: "APP-2026-MARZINA-01",
      number: "+8801811-XXXXXX",
      numberOwner: "applicant",
      channel: "phone",
      safeToUse: true,
      permittedMessageType: "safe_follow_up",
      mayMentionLegalAid: true,
      reliability: "medium",
      lastSuccessfulContactAt: "২০২৬-০৪-২০T14:00:00.000Z",
      preferredTime: "দুপুর ২টা থেকে ৪টা",
      source: "applicant",
      confirmationStatus: "confirmed",
    },
  ];

  const contactAttempts: ContactAttempt[] = [
    /* Malek's shop number — three failed attempts (one answered by shop, two no answer). */
    {
      attemptId: "att-malek-shop-01",
      contactId: "ct-malek-shop",
      caseId: "CASE-MALEK-01",
      attemptedAt: "২০২৬-০৮-২৫T11:00:00.000Z",
      channel: "phone",
      outcome: "answered_by_other",
      whoAnswered: "দোকানের কর্মচারী",
      note: "Shop staff answered. No legal-aid disclosure made.",
      attemptedBy: "helpline",
    },
    {
      attemptId: "att-malek-shop-02",
      contactId: "ct-malek-shop",
      caseId: "CASE-MALEK-01",
      attemptedAt: "২০২৬-০৮-২৮T11:00:00.000Z",
      channel: "phone",
      outcome: "no_answer",
      attemptedBy: "helpline",
    },
    {
      attemptId: "att-malek-shop-03",
      contactId: "ct-malek-shop",
      caseId: "CASE-MALEK-01",
      attemptedAt: "২০২৬-০৯-০২T15:00:00.000Z",
      channel: "phone",
      outcome: "no_answer",
      attemptedBy: "helpline",
    },
    /* Marzina — one successful applicant contact. */
    {
      attemptId: "att-marzina-01",
      contactId: "ct-marzina-mobile",
      caseId: "CASE-MARZINA-01",
      attemptedAt: "২০২৬-০৪-২০T14:00:00.000Z",
      channel: "phone",
      outcome: "answered_by_applicant",
      attemptedBy: "law-moinul",
    },
  ];

  const lawyerChangeRequests: LawyerChangeRequest[] = [
    {
      requestId: "lcr-marzina-01",
      caseId: "CASE-MARZINA-01",
      applicationId: "APP-2026-MARZINA-01",
      applicantName: "মারজিনা বেগম",
      submittedAt: "২০২৬-০৯-০৫T10:00:00.000Z",
      submittedThrough: "helpline_assisted",
      submittedBy: "helpline",
      reasonCategory: "no_case_update_received",
      reasonNote: "আইনজীবীর সাথে যোগাযোগ করা যায়নি এবং শুনানির ফলাফল সম্পর্কে কোনো আপডেট পাওয়া যায়নি।",
      safeContactInstruction: "অনুগ্রহ করে দুপুর ২টা থেকে ৪টার মধ্যে যোগাযোগ করুন।",
      urgency: "medium",
      requestedOutcome: "নতুন আইনজীবী নিয়োগ",
      state: "submitted",
      dueAt: "২০২৬-০৯-১২T17:00:00.000Z",
      history: [{ at: "২০২৬-০৯-০৫T10:00:00.000Z", actor: "helpline", toState: "submitted", reason: "Citizen request received via helpline." }],
      auditEventIds: [],
    },
  ];

  const feeSchedules: FeeSchedule[] = [
    {
      scheduleId: "fs-bd-2026-v1",
      officialInstrument: "National Legal Aid Schedule",
      reference: "BD-LAS-2026-01",
      effectiveDate: "২০২৬-০১-০১",
      matterType: "compensation",
      courtOrServiceType: "District Court",
      stage: "preparation",
      authorizedAmount: 3500,
      currency: "BDT",
      requiredSupportingRecords: ["case_progress_update", "hearing_record"],
      approvalAuthority: "National Legal Aid Board",
      officialSource: "Circular ref. NLAS/2026/01",
      verifiedBy: "অ্যাডমিনিস্ট্রেটিভ কর্মকর্তা",
      verificationDate: "২০২৬-০১-১০",
      status: "verified",
      rulesetVersion: "P8-fee-v1",
    },
    {
      scheduleId: "fs-bd-2026-v2",
      officialInstrument: "National Legal Aid Schedule",
      reference: "BD-LAS-2026-01",
      effectiveDate: "২০২৬-০১-০১",
      matterType: "compensation",
      courtOrServiceType: "District Court",
      stage: "hearing_attended",
      authorizedAmount: 4500,
      currency: "BDT",
      requiredSupportingRecords: ["hearing_record", "case_progress_update"],
      approvalAuthority: "National Legal Aid Board",
      officialSource: "Circular ref. NLAS/2026/01",
      verifiedBy: "অ্যাডমিনিস্ট্রেটিভ কর্মকর্তা",
      verificationDate: "২০২৬-০১-১০",
      status: "verified",
      rulesetVersion: "P8-fee-v1",
    },
    {
      scheduleId: "fs-bd-2025-v0",
      officialInstrument: "National Legal Aid Schedule",
      reference: "BD-LAS-2025-04",
      effectiveDate: "২০২৫-০৪-০১",
      expiryDate: "২০২৫-১২-৩১",
      matterType: "compensation",
      courtOrServiceType: "District Court",
      stage: "preparation",
      authorizedAmount: 3000,
      currency: "BDT",
      requiredSupportingRecords: ["case_progress_update"],
      approvalAuthority: "National Legal Aid Board",
      officialSource: "Circular ref. NLAS/2025/04",
      status: "expired",
      rulesetVersion: "P8-fee-v0",
      notes: "Superseded by fs-bd-2026-v1 effective 2026-01-01.",
    },
  ];

  const paymentStages: PaymentStage[] = [
    {
      stageId: "ps-marzina-prep",
      caseId: "CASE-MARZINA-01",
      scheduleId: "fs-bd-2026-v1",
      stage: "preparation",
      claimedAmount: 3500,
      verifiedAmount: 3500,
      approvedAmount: 0,
      paidAmount: 0,
      status: "under_review",
      notes: "Claimed 2026-04-22. Under review.",
    },
    {
      stageId: "ps-marzina-hearing",
      caseId: "CASE-MARZINA-01",
      scheduleId: "fs-bd-2026-v2",
      stage: "hearing_attended",
      claimedAmount: 4500,
      verifiedAmount: 0,
      approvedAmount: 0,
      paidAmount: 0,
      status: "evidence_required",
      notes: "Awaiting post-hearing update from lawyer.",
    },
  ];

  const paymentReconciliations: PaymentReconciliation[] = [
    {
      reconciliationId: "pr-marzina-01",
      caseId: "CASE-MARZINA-01",
      state: "worksheet_prepared",
      triggeredBy: "reassignment",
      preparedAt: "২০২৬-০৯-১০T10:00:00.000Z",
      preparedBy: "dlao",
      evidence: ["ps-marzina-prep", "ps-marzina-hearing"],
      history: [{ at: "২০২৬-০৯-১০T10:00:00.000Z", actor: "dlao", fromState: "not_started", toState: "worksheet_prepared", reason: "Reassignment triggered reconciliation." }],
      auditEventIds: [],
      disclaimerShown: false,
    },
  ];

  const inactivityPatterns: InactivityPattern[] = [
    {
      patternId: "ip-moinul-01",
      lawyerId: "law-moinul",
      threshold: { overdueUpdates: 2, missedPostHearingReports: 2, daysSinceLastActivity: 14, crossCaseCount: 3 },
      contributingCaseIds: ["CASE-MALEK-01", "CASE-MARZINA-01", "CASE-RAHELA-01"],
      contributingEventIds: ["ru-malek-01", "ru-malek-02", "ru-marzina-01", "ru-marzina-02"],
      exceptions: ["law-rafiq", "law-nasreen"],
      state: "data_validation",
      history: [
        { at: "২০২৬-০৯-১০T09:00:00.000Z", actor: "system", toState: "threshold_reached", reason: "Cross-case inactivity detected (3+ cases, 2+ overdue updates each)." },
        { at: "২০২৬-০৯-১০T09:05:00.000Z", actor: "system", fromState: "threshold_reached", toState: "data_validation", reason: "Evaluating exceptions (leave, outage, waived, stayed)." },
      ],
      createdAt: "২০২৬-০৯-১০T09:00:00.000Z",
    },
  ];

  const voiceStatusSessions: VoiceStatusSession[] = [
    {
      sessionId: "vs-malek-01",
      caseId: "CASE-MALEK-01",
      startedAt: "২০২৬-০৯-১২T18:30:00.000Z",
      endedAt: "২০২৬-০৯-১২T18:35:00.000Z",
      channel: "voice_ivr",
      language: "bn",
      promptsPlayed: [
        { at: "২০২৬-০৯-১২T18:30:30.000Z", key: "play_status", playedText: "আপনার আবেদনটি সক্রিয় আছে।" },
        { at: "২০২৬-০৯-১২T18:31:30.000Z", key: "play_next_step", playedText: "পরবর্তী শুনানির তারিখ এখনো নিশ্চিত হয়নি। যাত্রা করার আগে অনুগ্রহ করে আইনি সহায়তা কার্যালয়ে যোগাযোগ করুন।" },
      ],
      keysPressed: [
        { at: "২০২৬-০৯-১২T18:30:00.000Z", key: "play_status" },
        { at: "২০২৬-০৯-১২T18:31:00.000Z", key: "play_next_step" },
        { at: "২০২৬-০৯-১২T18:32:00.000Z", key: "exit" },
      ],
      travelWarningPlayed: true,
      endedReason: "user_exit",
    },
  ];

  const dlaoTaskItems: DlaoTaskItem[] = [
    {
      taskId: "dlao-task-malek-verify",
      caseId: "CASE-MALEK-01",
      applicationId: "APP-2026-MALEK-01",
      type: "verification_task_hearing_date",
      title: "Verify Malek's upcoming hearing date (lawyer-recorded, unverified)",
      detail: "Hearing hr-malek-03 is awaiting_verification. Confirm with Barguna District Court cause list before any travel advisory is given to the applicant.",
      state: "queued",
      priority: "high",
      createdAt: "২০২৬-০৯-১২T18:35:00.000Z",
      dueAt: "২০২৬-০৯-১৫T17:00:00.000Z",
      relatedSubjectId: "hr-malek-03",
      auditEventIds: [],
    },
    {
      taskId: "dlao-task-overdue-malek",
      caseId: "CASE-MALEK-01",
      applicationId: "APP-2026-MALEK-01",
      type: "overdue_alert",
      title: "Overdue required update on Malek's case (post-hearing)",
      detail: "Two required updates missed by Advocate Moinul Haque. No automatic reassignment.",
      state: "queued",
      priority: "high",
      createdAt: "২০২৬-০৯-১০T09:00:00.000Z",
      relatedSubjectId: "ru-malek-01",
      auditEventIds: [],
    },
    {
      taskId: "dlao-task-overdue-marzina",
      caseId: "CASE-MARZINA-01",
      applicationId: "APP-2026-MARZINA-01",
      type: "overdue_alert",
      title: "Overdue required update on Marzina's case (post-hearing)",
      detail: "Two required updates missed by Advocate Moinul Haque.",
      state: "queued",
      priority: "high",
      createdAt: "২০২৬-০৯-১০T09:00:00.000Z",
      relatedSubjectId: "ru-marzina-01",
      auditEventIds: [],
    },
    {
      taskId: "dlao-task-pattern-moinul",
      type: "pattern_review",
      title: "Repeated-inactivity pattern review (Advocate Moinul)",
      detail: "Cross-case inactivity on 3 active cases. Evaluate leave/outage/waived exceptions before surfacing.",
      state: "queued",
      priority: "medium",
      createdAt: "২০২৬-০৯-১০T09:05:00.000Z",
      relatedSubjectId: "ip-moinul-01",
      auditEventIds: [],
    },
    {
      taskId: "dlao-task-payment-marzina",
      caseId: "CASE-MARZINA-01",
      applicationId: "APP-2026-MARZINA-01",
      type: "payment_reconciliation",
      title: "Payment reconciliation worksheet (Marzina)",
      detail: "Reassignment-triggered reconciliation. Two payment stages to review.",
      state: "queued",
      priority: "medium",
      createdAt: "২০২৬-০৯-১০T10:00:00.000Z",
      relatedSubjectId: "pr-marzina-01",
      auditEventIds: [],
    },
    {
      taskId: "dlao-task-changereq-marzina",
      caseId: "CASE-MARZINA-01",
      applicationId: "APP-2026-MARZINA-01",
      type: "lawyer_change_review",
      title: "Lawyer-change request — Marzina Begum",
      detail: "Citizen requests new lawyer due to no case update received. Two missed required updates confirmed.",
      state: "queued",
      priority: "high",
      createdAt: "২০২৬-০৯-০৫T10:00:00.000Z",
      relatedSubjectId: "lcr-marzina-01",
      auditEventIds: [],
    },
  ];

  return {
    v: 1,
    seededAt: now,
    records,
    sessions,
    representations,
    verifications,
    handoffs,
    communications,
    audit,
    dlaoTasks,
    humanIntakes: [],
    dlaoVerifications: [],
    safeContactPlans,
    offlineDrafts,
    syncConflicts,
    integrityVerifications,
    performanceMeasurements,
    assistedIntakes,
    idMappings,
    referrals,
    sensitiveEvidence,
    authorityDirectory,
    legalBasis,
    routingRecommendations,
    deliveryOperations: [],
    escalationTasks,
    citizenSafeStatuses,
    demoTimeOffsetMs: 0,
    panelLawyers,
    lawyerAvailabilities,
    lawyerAssignments,
    lawyerAssignmentResponses,
    caseHearings,
    caseProgressUpdates,
    requiredUpdates,
    updateReminders,
    contactReliabilities,
    contactAttempts,
    lawyerChangeRequests,
    lawyerChangeReviews: [],
    reassignments: [],
    caseHandovers: [],
    inactivityPatterns,
    patternReviews: [],
    feeSchedules,
    paymentStages,
    paymentReconciliations,
    voiceStatusSessions,
    dlaoTaskItems,
  };
}

export function resetScenario(
  envelope: StoreEnvelope,
  scenarioId: string,
): StoreEnvelope {
  const next: StoreEnvelope = {
    ...envelope,
    records: [...envelope.records],
    sessions: [...envelope.sessions],
    representations: [...envelope.representations],
    verifications: [...envelope.verifications],
    handoffs: [...envelope.handoffs],
    communications: [...envelope.communications],
    audit: [...envelope.audit],
    dlaoTasks: [...envelope.dlaoTasks],
    humanIntakes: [...envelope.humanIntakes],
    dlaoVerifications: [...envelope.dlaoVerifications],
    safeContactPlans: [...envelope.safeContactPlans],
    offlineDrafts: envelope.offlineDrafts ? [...envelope.offlineDrafts] : undefined,
    syncConflicts: envelope.syncConflicts ? [...envelope.syncConflicts] : undefined,
    integrityVerifications: envelope.integrityVerifications ? [...envelope.integrityVerifications] : undefined,
    performanceMeasurements: envelope.performanceMeasurements ? [...envelope.performanceMeasurements] : undefined,
    assistedIntakes: envelope.assistedIntakes ? [...envelope.assistedIntakes] : undefined,
    idMappings: envelope.idMappings ? [...envelope.idMappings] : undefined,
    pwaCapability: envelope.pwaCapability,
  };
  const _now = new Date().toISOString();
  void _now;

  // `demo` rewinds the entire store to the seeded deterministic state.
  if (scenarioId === "demo") {
    return seedDemoData(buildEmptyEnvelope());
  }

  if (scenarioId === "moyuri-ripon" || scenarioId === "ripon") {
    next.records = next.records.map((r) =>
      r.applicationId === "TEMP-MOY-01" ? { ...r, status: "draft" } : r,
    );
  }

  if (scenarioId === "urgent-nadia") {
    next.records = next.records.map((r) =>
      r.applicationId === "TEMP-URG-08" ? { ...r, status: "draft" } : r,
    );
  }

  if (scenarioId === "dlao-tasks") {
    next.dlaoTasks = next.dlaoTasks.filter(
      (t) => t.reason !== "unsafe_answer" && t.reason !== "verification_failed",
    );
  }

  if (scenarioId === "nuching-offline") {
    // Re-seed everything and keep Nuching as the only "local draft".
    const fresh = seedDemoData(buildEmptyEnvelope());
    fresh.offlineDrafts = fresh.offlineDrafts?.map((d) =>
      d.temporaryId === "OFF-NUCH-01"
        ? { ...d, syncStatus: "local_draft", retryCount: 0, lastError: undefined }
        : { ...d, syncStatus: "queued_offline" },
    );
    fresh.syncConflicts = fresh.syncConflicts;
    fresh.assistedIntakes = fresh.assistedIntakes?.map((a) =>
      a.temporaryId === "OFF-NUCH-01" ? { ...a, state: "local_draft" } : a,
    );
    return fresh;
  }

  return next;
}
