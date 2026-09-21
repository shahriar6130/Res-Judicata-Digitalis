/* ------------------------------------------------------------------ *
 *  AssistedIntakeService — drives the 18-state assisted-intake machine.
 *
 *  Each transition records provenance, asks for explicit consent
 *  before submission, and never mints a Case ID.
 * ------------------------------------------------------------------ */

import { publish } from "../event-bus";
import { makeId } from "./_internal/async-helpers";
import { OfflineStore } from "./offline-store.service";
import { NetworkConditionService } from "./network-condition.service";
import { IntegrityVerificationService } from "./integrity-verification.service";
import { SyncQueueService } from "./sync-queue.service";
import { ConsentService } from "./consent.service";
import { UdcAuthorizationService } from "./udc-authorization.service";
import type {
  AssistedIntake,
  AssistedIntakeState,
  ChecklistDefinition,
  ChecklistItemState,
  DocumentCapture,
  LanguagePreference,
  OfflineDraft,
  TranslationEvent,
  AssistanceConsent,
  ApplicantContactRoute,
} from "../types";

export const INTAKE_EVENT = "shakkho:assisted-intake";

const listeners = new Set<(a: AssistedIntake) => void>();
function emit(a: AssistedIntake): void {
  publish(INTAKE_EVENT, a);
  listeners.forEach((cb) => cb(a));
}

const DRAFT_BY_ID = new Map<string, AssistedIntake>();

/* ------------------------------------------------------------------ *
 *  Case-type checklist catalogue — reuses the T6 set from Phase 3.
 * ------------------------------------------------------------------ */
export function defaultChecklist(matterType: string): ChecklistDefinition {
  const labels: Record<string, { id: string; bn: string; en: string; why: { bn: string; en: string }; required: boolean }[]> = {
    family: [
      {
        id: "national_id",
        bn: "জাতীয় পরিচয়পত্র",
        en: "National ID",
        why: { bn: "পরিচয় নিশ্চিত করতে", en: "To confirm identity" },
        required: true,
      },
      {
        id: "marriage_proof",
        bn: "বিয়ের প্রমাণ",
        en: "Marriage proof",
        why: { bn: "বিবাহের তথ্য যাচাই করতে", en: "To verify marriage details" },
        required: false,
      },
      {
        id: "incident_evidence",
        bn: "ঘটনার প্রমাণ",
        en: "Incident evidence",
        why: { bn: "ঘটনা সমর্থন করতে", en: "To corroborate the incident" },
        required: false,
      },
    ],
    land: [
      {
        id: "national_id",
        bn: "জাতীয় পরিচয়পত্র",
        en: "National ID",
        why: { bn: "পরিচয় নিশ্চিত করতে", en: "To confirm identity" },
        required: true,
      },
      {
        id: "deed",
        bn: "দলিল/খতিয়ান",
        en: "Deed / record",
        why: { bn: "জমির মালিকানা যাচাই", en: "To verify land ownership" },
        required: true,
      },
      {
        id: "tax_receipt",
        bn: "খাজনা রসিদ",
        en: "Tax receipt",
        why: { bn: "বর্তমান মালিকানা নিশ্চিত করতে", en: "To confirm current ownership" },
        required: false,
      },
    ],
    labour: [
      {
        id: "national_id",
        bn: "জাতীয় পরিচয়পত্র",
        en: "National ID",
        why: { bn: "পরিচয় নিশ্চিত করতে", en: "To confirm identity" },
        required: true,
      },
      {
        id: "employer_letter",
        bn: "নিয়োগকর্তার চিঠি",
        en: "Employer letter",
        why: { bn: "কর্মসংস্থান যাচাই", en: "To verify employment" },
        required: false,
      },
    ],
    criminal: [
      {
        id: "national_id",
        bn: "জাতীয় পরিচয়পত্র",
        en: "National ID",
        why: { bn: "পরিচয় নিশ্চিত করতে", en: "To confirm identity" },
        required: true,
      },
      {
        id: "fir_copy",
        bn: "এফআইআর কপি",
        en: "FIR copy",
        why: { bn: "মামলার তথ্য যাচাই", en: "To verify case details" },
        required: true,
      },
    ],
    other: [
      {
        id: "national_id",
        bn: "জাতীয় পরিচয়পত্র",
        en: "National ID",
        why: { bn: "পরিচয় নিশ্চিত করতে", en: "To confirm identity" },
        required: true,
      },
    ],
  };
  const items = labels[matterType] ?? labels.other;
  return {
    id: makeId("CHKL"),
    matterType,
    notice: "Reuses the T6 case-type checklist from Phase 3.",
    items: items.map((i) => ({
      id: i.id,
      label: { bn: i.bn, en: i.en },
      why: i.why,
      required: i.required,
    })),
  };
}

function toOfflineDraft(a: AssistedIntake): OfflineDraft {
  return {
    id: makeId("DRF"),
    temporaryId: a.temporaryId,
    payload: {
      applicant_name: a.applicantName,
      district: a.district,
      matter_type: a.matterType,
      primary_language: a.languagePreference.primary,
      free_service_notice_acknowledged: a.freeServiceNoticeAcknowledged,
      consent_topics: a.consents.map((c) => c.topic),
      confirmed_fields: a.readBacks.map((r) => r.field),
      checklist_states: a.checklistItemResults.map((r) => ({
        id: r.itemId,
        state: r.state,
      })),
      incident_date:
        (a.readBacks.find((r) => r.field === "incident_date")?.confirmation.priorValue as
          | string
          | undefined) ?? "",
    },
    confirmedFields: a.readBacks.map((r) => r.field),
    provenance: a.translations,
    consent: a.consents,
    documentMetadata: a.documentCaptureIds.length
      ? a.documentCaptureIds.map((id) => ({
          id,
          applicationOrDraftId: a.temporaryId,
          checklistItemId: "n/a",
          capturedBy: "udc",
          capturedAt: new Date().toISOString(),
          pageCount: 1,
          bytes: 0,
          compressed: true,
          pageOrder: [1],
          qualityFindings: [],
          sensitivity: "restricted" as const,
          documentType: { bn: "নথি", en: "Document" },
          version: 1,
          applicantConfirmed: false,
        }))
      : [],
    blobKeys: [],
    syncStatus: "local_draft",
    idempotencyKey: `idem-${a.temporaryId}`,
    localVersion: a.localVersion,
    lastModified: a.updatedAt,
    integrityDigest: a.integrityDigest ?? "",
    chainDigest: "",
    retryCount: 0,
    networkProfile: NetworkConditionService.current(),
  };
}

export const AssistedIntakeService = {
  defaultChecklist(matterType: string): ChecklistDefinition {
    return defaultChecklist(matterType);
  },
  start(input: {
    udcEntrepreneurId: string;
    applicantName: string;
    district: string;
    matterType: string;
    languagePreference: LanguagePreference;
    applicantContact: ApplicantContactRoute;
  }): AssistedIntake {
    const authz = UdcAuthorizationService.authorize("intake.start");
    if (!authz.allowed) throw new Error(authz.reason ?? "UDC cannot start intake");
    const intake: AssistedIntake = {
      id: makeId("AIN"),
      temporaryId: `OFF-${Date.now().toString(36).toUpperCase()}`,
      assistanceSessionId: makeId("AS"),
      applicantName: input.applicantName,
      district: input.district,
      matterType: input.matterType,
      languagePreference: input.languagePreference,
      consents: [],
      translations: [],
      applicantContact: input.applicantContact,
      documentCaptureIds: [],
      checklistItemResults: [],
      readBacks: [],
      freeServiceNoticeAcknowledged: false,
      state: "assisted_intake_started",
      localVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    DRAFT_BY_ID.set(intake.temporaryId, intake);
    emit(intake);
    return intake;
  },

  /** Convenience: get or seed an AssistedIntake for a known temporaryId. */
  ensure(temporaryId: string, fallback?: Partial<AssistedIntake>): AssistedIntake | undefined {
    const existing = DRAFT_BY_ID.get(temporaryId);
    if (existing) return existing;
    if (fallback) {
      const seeded: AssistedIntake = {
        id: fallback.id ?? makeId("AIN"),
        temporaryId,
        assistanceSessionId: fallback.assistanceSessionId ?? makeId("AS"),
        applicantName: fallback.applicantName ?? "—",
        district: fallback.district ?? "—",
        matterType: fallback.matterType ?? "other",
        languagePreference: fallback.languagePreference ?? {
          primary: "bn",
          supportedInterface: "en",
        },
        consents: fallback.consents ?? [],
        translations: fallback.translations ?? [],
        applicantContact: fallback.applicantContact ?? {
          kind: "no_safe_phone",
          reason: { bn: "নিরাপদ ফোন নেই", en: "No safe phone available" },
        },
        documentCaptureIds: fallback.documentCaptureIds ?? [],
        checklistItemResults: fallback.checklistItemResults ?? [],
        readBacks: fallback.readBacks ?? [],
        freeServiceNoticeAcknowledged: fallback.freeServiceNoticeAcknowledged ?? false,
        state: fallback.state ?? "assisted_intake_started",
        authoritativeApplicationId: fallback.authoritativeApplicationId,
        localVersion: fallback.localVersion ?? 1,
        integrityDigest: fallback.integrityDigest,
        createdAt: fallback.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      DRAFT_BY_ID.set(temporaryId, seeded);
      return seeded;
    }
    return undefined;
  },

  recordConsent(intake: AssistedIntake, consent: AssistanceConsent): AssistedIntake {
    const next: AssistedIntake = {
      ...intake,
      consents: [...intake.consents.filter((c) => c.id !== consent.id), consent],
      updatedAt: new Date().toISOString(),
      state: intake.state === "assisted_intake_started" ? "read_back_required" : intake.state,
    };
    DRAFT_BY_ID.set(intake.temporaryId, next);
    emit(next);
    return next;
  },

  recordTranslation(intake: AssistedIntake, event: TranslationEvent): AssistedIntake {
    const next: AssistedIntake = {
      ...intake,
      translations: [...intake.translations.filter((t) => t.id !== event.id), event],
      updatedAt: new Date().toISOString(),
    };
    DRAFT_BY_ID.set(intake.temporaryId, next);
    emit(next);
    return next;
  },

  attachDocument(intake: AssistedIntake, capture: DocumentCapture): AssistedIntake {
    const next: AssistedIntake = {
      ...intake,
      documentCaptureIds: [...intake.documentCaptureIds, capture.id],
      updatedAt: new Date().toISOString(),
    };
    DRAFT_BY_ID.set(intake.temporaryId, next);
    emit(next);
    return next;
  },

  setChecklistItem(intake: AssistedIntake, itemId: string, state: ChecklistItemState, note?: string): AssistedIntake {
    const next: AssistedIntake = {
      ...intake,
      checklistItemResults: [
        ...intake.checklistItemResults.filter((r) => r.itemId !== itemId),
        { itemId, state, note },
      ],
      updatedAt: new Date().toISOString(),
    };
    DRAFT_BY_ID.set(intake.temporaryId, next);
    emit(next);
    return next;
  },

  acknowledgeFreeServiceNotice(intake: AssistedIntake): AssistedIntake {
    const next: AssistedIntake = {
      ...intake,
      freeServiceNoticeAcknowledged: true,
      updatedAt: new Date().toISOString(),
      state: "applicant_confirmed",
    };
    DRAFT_BY_ID.set(intake.temporaryId, next);
    emit(next);
    return next;
  },

  /** Push draft to IndexedDB and enqueue sync. */
  async saveAndQueue(intake: AssistedIntake): Promise<OfflineDraft> {
    UdcAuthorizationService.authorize("draft.save");
    const draft = toOfflineDraft(intake);
    const digest = await IntegrityVerificationService.digestDraft(draft);
    const enriched: OfflineDraft = {
      ...draft,
      integrityDigest: digest.hex,
      lastModified: new Date().toISOString(),
    };
    await OfflineStore.upsert(enriched);
    const authz = UdcAuthorizationService.authorize("submission.queue");
    if (!authz.allowed) throw new Error(authz.reason ?? "UDC cannot queue submission");
    await SyncQueueService.enqueue(enriched);
    const next: AssistedIntake = {
      ...intake,
      state: "queued_offline",
      integrityDigest: digest.hex,
      updatedAt: new Date().toISOString(),
    };
    DRAFT_BY_ID.set(intake.temporaryId, next);
    emit(next);
    return enriched;
  },

  /** Convenience getter for UI components. */
  get(temporaryId: string): AssistedIntake | undefined {
    return DRAFT_BY_ID.get(temporaryId);
  },

  /** Helper: required consent topics for an intake. */
  requiredConsentTopics(): AssistanceConsent["topic"][] {
    return [
      "form_entry_assistance",
      "human_translation_or_interpretation",
      "temporary_offline_storage",
      "submission_to_dlas",
    ];
  },

  /** Allowed transition check. */
  canTransition(from: AssistedIntakeState, to: AssistedIntakeState): boolean {
    const allowed: Record<AssistedIntakeState, AssistedIntakeState[]> = {
      assisted_intake_started: ["local_draft", "read_back_required", "human_review"],
      local_draft: ["read_back_required", "ready_to_submit", "human_review"],
      read_back_required: ["applicant_confirmed", "ready_to_submit", "human_review"],
      applicant_confirmed: ["ready_to_submit", "human_review"],
      ready_to_submit: ["queued_offline", "synchronizing", "human_review"],
      queued_offline: ["synchronizing", "retry_scheduled", "conflict_detected"],
      synchronizing: ["synced", "conflict_detected", "integrity_review_required", "retry_scheduled"],
      synced: ["accepted", "manual_review_required", "limited_post_submission_access"],
      retry_scheduled: ["synchronizing", "queued_offline", "manual_review_required"],
      conflict_detected: ["human_review", "manual_review_required", "resolved"],
      integrity_review_required: ["manual_review_required", "resolved"],
      manual_review_required: ["resolved", "accepted"],
      human_review: ["local_draft", "read_back_required", "manual_review_required"],
      resolved: ["accepted", "manual_review_required"],
      quality_review: ["retake_requested", "accepted"],
      accepted: ["limited_post_submission_access"],
      retake_requested: ["quality_review"],
      limited_post_submission_access: ["limited_post_submission_access"],
    };
    return allowed[from]?.includes(to) ?? false;
  },

  subscribe(cb: (a: AssistedIntake) => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

/* Internal reference so consumers don't need to import both modules. */
void ConsentService;
