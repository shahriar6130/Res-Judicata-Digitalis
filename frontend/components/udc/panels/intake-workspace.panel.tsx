"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ensureSeeded,
  useHelplineStore,
  useOfflineStore,
  AssistedIntakeService,
  ConsentService,
  TranslationProvenanceService,
  DocumentCaptureService,
  DocumentQualityService,
  OfflineStore,
  SyncQueueService,
  NetworkConditionService,
  UdcAuthorizationService,
  type AssistedIntake,
  type LanguageCode,
  type OfflineDraft,
  type TranslationEvent,
  type AssistanceConsent,
  type DocumentCapture,
  type ChecklistItemState,
  type ChecklistItem,
} from "@/lib/shakkho";
import { useI18n } from "@/lib/i18n";
import { SkipLink } from "@/components/helpline/primitives/skip-link";
import { NetworkBar } from "../primitives/network-bar";
import styles from "../udc.module.css";

interface Props {
  temporaryId: string;
  role?: string;
}

export function UdcIntakeWorkspacePanel({ temporaryId, role = "udc" }: Props) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  const offline = useOfflineStore();

  /* Find the seeded AssistedIntake for this temporaryId. If none,
   * hydrate one from the matching OfflineDraft via the service so the
   * UI always shows a draft. */
  const initial: AssistedIntake | undefined = useMemo(() => {
    const seeded = envelope.assistedIntakes?.find((a) => a.temporaryId === temporaryId);
    if (seeded) return AssistedIntakeService.ensure(temporaryId, seeded);
    const draft = envelope.offlineDrafts?.find((d) => d.temporaryId === temporaryId);
    if (draft) {
      return AssistedIntakeService.ensure(temporaryId, {
        applicantName: (draft.payload as Record<string, unknown>).applicant_name as string,
        district: (draft.payload as Record<string, unknown>).district as string,
        matterType: (draft.payload as Record<string, unknown>).matter_type as string ?? "other",
        translations: draft.provenance,
        consents: draft.consent,
        documentCaptureIds: draft.documentMetadata.map((d) => d.id),
        readBacks: draft.provenance.map((t) => ({
          field: t.field,
          confirmation: t.applicantConfirmation ?? {
            status: "read_back_to_applicant",
            mechanism: "oral_with_readback",
          },
        })),
        checklistItemResults: (draft.payload as Record<string, unknown>).checklist_states
          ? ((draft.payload as Record<string, unknown>).checklist_states as { id: string; state: string }[]).map((c) => ({
              itemId: c.id,
              state: (c.state === "required" ? "required" : "uncertain") as ChecklistItemState,
            }))
          : [],
        freeServiceNoticeAcknowledged: (draft.payload as Record<string, unknown>).free_service_notice_acknowledged === true,
        state: draft.syncStatus === "synced" ? "accepted" : "local_draft",
        authoritativeApplicationId: draft.authoritativeApplicationId,
      });
    }
    return AssistedIntakeService.ensure(temporaryId, {
      applicantName: "—",
      district: "—",
      matterType: "other",
    });
  }, [envelope.assistedIntakes, envelope.offlineDrafts, temporaryId]);

  if (!initial) {
    return (
      <main id="udc-main" className={styles.page}>
        <SkipLink targetId="udc-main" />
        <h1 className={styles.pageTitle}>
          {lang === "bn" ? "ইনটেক পাওয়া যায়নি" : "Intake not found"}
        </h1>
        <p className={styles.bannerInfo}>
          {lang === "bn"
            ? `OFF UUID ${temporaryId} ডেমো ডেটাতে নেই।`
            : `OFF UUID ${temporaryId} is not in the demo data.`}{" "}
          <Link href={`/dashboard/${role}/intake/new`} className={styles.cardLink}>
            {lang === "bn" ? "নতুন ইনটেক শুরু করুন" : "Start a new intake"}
          </Link>
        </p>
      </main>
    );
  }

  return <UdcIntakeWorkspaceBody initial={initial} role={role} offlineDrafts={offline.drafts ?? []} />;
}

function UdcIntakeWorkspaceBody({
  initial,
  role,
  offlineDrafts,
}: {
  initial: AssistedIntake;
  role: string;
  offlineDrafts: OfflineDraft[];
}) {
  const { lang } = useI18n();
  const [intake, setIntake] = useState<AssistedIntake>(initial);
  const [transcript, setTranscript] = useState<TranslationEvent[]>(initial.translations);
  const [draftStatus, setDraftStatus] = useState<OfflineDraft["syncStatus"]>(
    offlineDrafts.find((d) => d.temporaryId === initial.temporaryId)?.syncStatus ?? "local_draft",
  );

  useEffect(() => {
    ensureSeeded();
  }, []);

  const checklist = useMemo(() => AssistedIntakeService.defaultChecklist(intake.matterType), [intake.matterType]);
  const topics = ConsentService.topics();

  function recordConsent(topic: AssistanceConsent["topic"], response: "yes" | "no" | "ask_again") {
    const c = ConsentService.record({
      topic,
      method: "oral_with_readback",
      language: (intake.languagePreference?.primary ?? "bn") as LanguageCode,
      explainedBy: "রহমান (UDC)",
      interpreter: intake.languagePreference?.interpreterName,
      applicantResponse: response,
    });
    const next = AssistedIntakeService.recordConsent(intake, c);
    setIntake(next);
  }

  function recordTranslation(field: string, original: string, translated: string) {
    const t = TranslationProvenanceService.record({
      field,
      sourceLanguage: (intake.languagePreference?.primary ?? "marma") as LanguageCode,
      originalText: original,
      translatedText: translated,
      personWhoSpoke: "আবেদনকারী",
      interpreterOrTranslator: intake.languagePreference?.interpreterName,
      personWhoTyped: "UDC entrepreneur",
      method: "human_interpreter",
    });
    const next = AssistedIntakeService.recordTranslation(intake, t);
    setIntake(next);
    setTranscript((prev) => [...prev, t]);
  }

  async function captureDoc(checklistItemId: string, label: string) {
    const capture = DocumentCaptureService.capture({
      applicationOrDraftId: intake.temporaryId,
      checklistItemId,
      capturedBy: "UDC entrepreneur",
      documentType: { bn: label, en: label },
      pageCount: 1,
      bytes: 28_000,
      compressed: true,
      pageOrder: [1],
      sensitivity: "restricted",
    });
    const findings = DocumentQualityService.evaluate(capture, { blur: true });
    const updated = DocumentCaptureService.attachQuality(capture, findings);
    const confirmed = DocumentCaptureService.confirmByApplicant(updated);
    const next = AssistedIntakeService.attachDocument(intake, confirmed);
    setIntake(next);
  }

  function setItem(itemId: string, state: ChecklistItemState) {
    const next = AssistedIntakeService.setChecklistItem(intake, itemId, state);
    setIntake(next);
  }

  function acknowledgeFreeNotice() {
    const next = AssistedIntakeService.acknowledgeFreeServiceNotice(intake);
    setIntake(next);
  }

  async function saveAndQueue() {
    const authz = UdcAuthorizationService.authorize("submission.queue");
    if (!authz.allowed) return;
    const draft = await AssistedIntakeService.saveAndQueue(intake);
    setDraftStatus(draft.syncStatus);
  }

  async function simulateNetworkDrop() {
    const trail: string[] = [];
    NetworkConditionService.setProfile("offline");
    trail.push("offline");
    await OfflineStore.setStatus(intake.temporaryId, "retry_scheduled");
    setDraftStatus("retry_scheduled");
    await new Promise((r) => setTimeout(r, 200));
    NetworkConditionService.setProfile("slow");
    trail.push("slow");
    await OfflineStore.setStatus(intake.temporaryId, "retry_scheduled");
    NetworkConditionService.setProfile("reconnected");
    trail.push("reconnected");
    await SyncQueueService.tryDrain(intake.temporaryId);
    const fresh = await OfflineStore.get(intake.temporaryId);
    if (fresh) setDraftStatus(fresh.syncStatus);
    NetworkConditionService.setProfile("normal");
    void trail;
  }

  const readiness: { grantedTopics: AssistanceConsent["topic"][]; missing: AssistanceConsent["topic"][] } = (() => {
    const granted = intake.consents.filter((c) => c.applicantResponse === "yes").map((c) => c.topic);
    const required = AssistedIntakeService.requiredConsentTopics();
    return { grantedTopics: granted, missing: required.filter((t) => !granted.includes(t)) };
  })();

  return (
    <>
      <SkipLink targetId="udc-main" />
      <main id="udc-main" className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.pageEyebrow}>
            {lang === "bn" ? "UDC · সহায়-ইনটেক" : "UDC · assisted intake"}
          </span>
          <h1 className={styles.pageTitle}>
            {intake.applicantName} · {intake.district}
          </h1>
          <p className={styles.pageIntro}>
            {lang === "bn" ? "অস্থায়ী UUID" : "Temporary UUID"}: {intake.temporaryId} ·{" "}
            {lang === "bn" ? "কেস আইডি তৈরি হবে শুধু সিঙ্কের পরে" : "Case ID is minted only after sync"}
          </p>
          <NetworkBar lang={lang} />
          <p className={styles.bannerInfo}>
            {lang === "bn" ? "সম্প্রসারণ অবস্থা" : "Current state"}: <strong>{intake.state}</strong> ·{" "}
            {lang === "bn" ? "স্থানীয় সংস্করণ" : "Local version"}: {intake.localVersion}
          </p>
        </header>

        {/* Left: language + interpreter, Right: provenance chain */}
        <section className={styles.callGrid}>
          <div className={styles.callColumn}>
            <h2>{lang === "bn" ? "ভাষা ও দোভাষী" : "Language + interpreter"}</h2>
            <div className={styles.fieldGrid}>
              <label htmlFor="udc-primary">
                {lang === "bn" ? "প্রাথমিক ভাষা" : "Primary language"}
              </label>
              <select id="udc-primary" defaultValue={intake.languagePreference?.primary ?? "bn"}>
                <option value="bn">Bangla</option>
                <option value="en">English</option>
                <option value="marma">Marma</option>
                <option value="chakma">Chakma</option>
                <option value="tripura">Tripura</option>
                <option value="garo">Garo</option>
              </select>
              <span></span>

              <label htmlFor="udc-interp">
                {lang === "bn" ? "দোভাষীর নাম" : "Interpreter name"}
              </label>
              <input
                id="udc-interp"
                type="text"
                defaultValue={intake.languagePreference?.interpreterName ?? ""}
              />
              <span></span>
            </div>
            <p className={styles.bannerInfo}>
              {lang === "bn"
                ? "প্রতিটি ক্ষেত্রের অনুবাদ নিচের চেইনে যোগ হবে।"
                : "Translations are added to the chain below as you record them."}
            </p>
            <div className={styles.btnRow}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() =>
                  recordTranslation(
                    "applicant_name",
                    "Nuching Marma (Marma)",
                    "নুচিং মারমা",
                  )
                }
              >
                {lang === "bn" ? "নাম রেকর্ড করুন (দোভাষী)" : "Record name (interpreter)"}
              </button>
            </div>
          </div>

          <div className={styles.callColumn}>
            <h2>{lang === "bn" ? "প্রোভেন্যান্স চেইন" : "Provenance chain"}</h2>
            <div className={styles.transcript} role="log" aria-live="polite">
              {transcript.length === 0 ? (
                <p>{lang === "bn" ? "এখনো কোনো অনুবাদ রেকর্ড হয়নি।" : "No translations recorded yet."}</p>
              ) : (
                transcript.map((t, i) => (
                  <div
                    key={t.id ?? i}
                    className={`${styles.turn} ${t.method === "human_interpreter" ? styles.interpreter : styles.udc}`}
                  >
                    <div className={styles.turnHead}>
                      <span>{t.method === "human_interpreter" ? "INTERPRETER" : "DIRECT"}</span>
                      <span>{t.field}</span>
                    </div>
                    <p className={styles.turnBody}>
                      <strong>{lang === "bn" ? "মূল" : "Source"}:</strong> {t.originalText}
                      <br />
                      <strong>{lang === "bn" ? "অনুবাদ" : "Translation"}:</strong> {t.translatedText}
                      <br />
                      <span className={styles.turnHead}>
                        {lang === "bn" ? "বক্তা" : "Spoken by"}: {t.personWhoSpoke} →{" "}
                        {lang === "bn" ? "অনুবাদ" : "Interpreted by"}: {t.interpreterOrTranslator} →{" "}
                        {lang === "bn" ? "টাইপ" : "Typed by"}: {t.personWhoTyped} →{" "}
                        {lang === "bn" ? "নিশ্চিত" : "Confirmed"}: {t.applicantConfirmation?.status ?? "—"}
                      </span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.callColumn}>
            <h2>{lang === "bn" ? "অস্থায়ী রেকর্ড" : "Draft record"}</h2>
            <ul className={styles.provenanceList}>
              <li>
                <span>temporaryId</span>
                <span>{intake.temporaryId}</span>
              </li>
              <li>
                <span>applicant_name</span>
                <span>{intake.applicantName}</span>
              </li>
              <li>
                <span>district</span>
                <span>{intake.district}</span>
              </li>
              <li>
                <span>matter_type</span>
                <span>{intake.matterType}</span>
              </li>
              <li>
                <span>free_service_notice</span>
                <span>{intake.freeServiceNoticeAcknowledged ? "ack" : "—"}</span>
              </li>
              <li>
                <span>state</span>
                <span><strong>{intake.state}</strong></span>
              </li>
              <li>
                <span>status (offline)</span>
                <span>{draftStatus}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Consent */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "সম্মতি (৮টি বিষয়)" : "Consent (8 topics)"}</h2>
            <span className={styles.statusPill}>
              {readiness.missing.length === 0
                ? lang === "bn" ? "সম্পূর্ণ" : "All required granted"
                : `${readiness.missing.length} missing`}
            </span>
          </div>
          <div className={styles.consentList}>
            {topics.map((topic) => {
              const notice = ConsentService.topicNotices()[topic];
              const existing = intake.consents.find((c) => c.topic === topic);
              return (
                <div key={topic} className={styles.consentRow}>
                  <input
                    type="checkbox"
                    checked={existing?.applicantResponse === "yes"}
                    onChange={(e) =>
                      recordConsent(topic, e.target.checked ? "yes" : "no")
                    }
                  />
                  <div>
                    <strong>{topic}</strong>
                    <p className={styles.consentNotice}>
                      {lang === "bn" ? notice.bn : notice.en}
                    </p>
                    {existing ? (
                      <span className={styles.statusPill}>
                        {existing.applicantResponse} · {existing.method} · {existing.obtainedAt.split("T")[0]}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className={styles.btnRow}>
            <button type="button" className={styles.btn} onClick={acknowledgeFreeNotice}>
              {lang === "bn" ? "বিনামূল্যে সেবার নোটিশ নিশ্চিত" : "Acknowledge free-service notice"}
            </button>
          </div>
        </section>

        {/* Checklist */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "চেকলিস্ট" : "Checklist"}</h2>
            <span className={styles.cardLink}>{checklist.id}</span>
          </div>
          <ul className={styles.checklist}>
            {checklist.items.map((item: ChecklistItem) => {
              const state = intake.checklistItemResults.find((r) => r.itemId === item.id)?.state ?? "required";
              return (
                <li key={item.id} className={styles.checklistItem}>
                  <input
                    id={`chk-${item.id}`}
                    type="checkbox"
                    checked={state === "captured"}
                    onChange={(e) =>
                      setItem(item.id, e.target.checked ? "captured" : "required")
                    }
                  />
                  <label htmlFor={`chk-${item.id}`}>
                    <strong>{lang === "bn" ? item.label.bn : item.label.en}</strong>
                    <span className={styles.checklistWhy}>
                      {lang === "bn" ? item.why.bn : item.why.en}
                    </span>
                  </label>
                  <span
                    className={`${styles.statusPill} ${item.required ? styles.statusPillUrgent : ""}`}
                  >
                    {state}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Documents */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "নথি ক্যাপচার" : "Document capture"}</h2>
          </div>
          <div className={styles.btnRow}>
            {checklist.items.map((item: ChecklistItem) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.btn} ${styles.btnSm}`}
                onClick={() =>
                  captureDoc(item.id, lang === "bn" ? item.label.bn : item.label.en)
                }
              >
                + {lang === "bn" ? item.label.bn : item.label.en}
              </button>
            ))}
          </div>
          <div className={styles.docsList}>
            {intake.documentCaptureIds.length === 0 ? (
              <p className={styles.bannerInfo}>
                {lang === "bn" ? "কোনো নথি ক্যাপচার হয়নি।" : "No documents captured yet."}
              </p>
            ) : (
              intake.documentCaptureIds.map((id) => (
                <div key={id} className={styles.docCard}>
                  <strong>{id}</strong>
                  <span>{lang === "bn" ? "ব্লকিং সমস্যা নেই — সতর্কতা রিভিউ করুন" : "No blockers — review warnings"}</span>
                  <ul className={styles.docFindings}>
                    <li className={styles.docFindingWarn}>
                      {lang === "bn" ? "ছবি ঝাপসা — ধরন: সতর্কতা" : "Blur detected — severity: warn"}
                    </li>
                  </ul>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Contact route */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "যোগাযোগের রুট" : "Applicant contact route"}</h2>
          </div>
          <p className={styles.bannerInfo}>
            <strong>
              {lang === "bn" ? "UDC-র নিজের ফোন কখনো ব্যবহার হবে না।" : "UDC own phone is never used."}{" "}
              {lang === "bn"
                ? "এখানে শুধু বিশ্বস্ত পরিচিতি বা নিরাপদ সময়ের ফোন।"
                : "Only trusted contact or safe-window phone numbers here."}
            </strong>
          </p>
          <ul className={styles.provenanceList}>
            <li>
              <span>{lang === "bn" ? "রুট" : "Route kind"}</span>
              <span>{intake.applicantContact?.kind ?? "—"}</span>
            </li>
            <li>
              <span>{lang === "bn" ? "মান" : "Value"}</span>
              <span>{intake.applicantContact?.value ?? "—"}</span>
            </li>
            <li>
              <span>{lang === "bn" ? "নিরাপদ সময়" : "Safe window"}</span>
              <span>
                {intake.applicantContact?.safeWindow
                  ? lang === "bn"
                    ? intake.applicantContact.safeWindow.bn
                    : intake.applicantContact.safeWindow.en
                  : "—"}
              </span>
            </li>
          </ul>
        </section>

        {/* Save + queue + simulate network drop */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "সংরক্ষণ ও সিঙ্ক" : "Save + sync"}</h2>
          </div>
          <p
            className={
              readiness.missing.length > 0 ? styles.safetyBanner : styles.bannerSuccess
            }
          >
            {readiness.missing.length > 0
              ? lang === "bn"
                ? `প্রয়োজনীয় সম্মতি অনুপস্থিত: ${readiness.missing.join(", ")}`
                : `Missing required consents: ${readiness.missing.join(", ")}`
              : lang === "bn"
                ? "সব প্রয়োজনীয় সম্মতি আছে — সিঙ্ক করা যায়।"
                : "All required consents granted — ready to sync."}
          </p>
          <div className={styles.btnRow}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={saveAndQueue}
              disabled={readiness.missing.length > 0}
            >
              {lang === "bn" ? "সংরক্ষণ ও সারিতে রাখুন" : "Save + queue for sync"}
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={simulateNetworkDrop}>
              {lang === "bn" ? "নেটওয়ার্ক বিচ্ছিন্ন সিমুলেট করুন" : "Simulate network drop"}
            </button>
          </div>
        </section>

        {/* Audit / integrity */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>{lang === "bn" ? "অখণ্ডতা যাচাই" : "Integrity verification"}</h2>
          </div>
          {intake.integrityDigest ? (
            <p className={styles.bannerInfo}>
              <strong>SHA-256:</strong> <code>{intake.integrityDigest.slice(0, 24)}…</code>
              <br />
              {lang === "bn"
                ? "এই ডাইজেস্ট প্রতিটি সিঙ্কের সময় যাচাই হবে।"
                : "This digest is verified on every sync."}
            </p>
          ) : (
            <p className={styles.bannerInfo}>
              {lang === "bn"
                ? "প্রথম সিঙ্কের সময় SHA-256 তৈরি হবে।"
                : "A SHA-256 digest is computed at the first sync."}
            </p>
          )}
          <p className={styles.bannerInfo}>
            {lang === "bn"
              ? "IntegrityVerificationService সব রিট্রাই-তে ডাইজেস্ট পুনরায় যাচাই করে।"
              : "IntegrityVerificationService re-checks the digest on every retry."}
          </p>
          <Link href={`/dashboard/${role}/sync-centre`} className={styles.cardLink}>
            {lang === "bn" ? "সিঙ্ক সেন্টারে যান →" : "Open sync centre →"}
          </Link>
        </section>
      </main>
    </>
  );
}
