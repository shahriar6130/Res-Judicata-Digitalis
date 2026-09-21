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
} from "./types";

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
    return seedDemoData({
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
    });
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
    const fresh = seedDemoData({
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
    });
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
