"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
} from "@/components/button";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  HelpingHand,
  Mic,
  MicOff,
  Shield,
  User,
  Users,
  X,
} from "@/components/icons";
import { useI18n } from "@/lib/i18n";
import { useSpeechInput, type VoiceStatus } from "@/lib/useSpeechInput";
import {
  emptyDraft,
  enqueueSubmission,
  isOnline,
  loadDraft,
  loadPending,
  makeTempReceipt,
  saveDraft,
  clearDraft,
  syncPending,
  type ActingFor,
  type ContactSlot,
  type IntakeDocument,
  type IntakeDraft,
  type MatterCategory,
} from "@/lib/intake-store";
import styles from "./assisted-intake.module.css";
import Link from "next/link";
import { CitizenAuth, CitizenDoor, DAYS, DISTRICTS, normalizePhone, UdcAuth, UdcDoor, useDlasDb } from "@/lib/dlas";
import { INTAKE_ISSUE_TYPES, simulateIntakeCategory } from "@/lib/intake-category-simulation";

/* ------------------------------------------------------------------ *
 *  Assisted Intake — 5-step wizard for starting a new case.
 *
 *  Step 1 — Identity           (name + mobile, voice-enabled)
 *  Step 2 — AI-assisted matter category (plain-language override list)
 *  Step 3 — Parties + Story    (opposing party + voice/text description)
 *  Step 4 — Documents          (drag/drop box + file picker)
 *  Step 5 — Safe contact time  + consent + submit
 *
 *  All entered data is mirrored into `localStorage` after every
 *  change so a refresh or a network drop does not lose progress.
 *  On submit the draft moves to a separate `pending` queue; a
 *  network-status effect flushes that queue whenever the device
 *  comes back online.
 *
 *  See `lib/intake-store.ts` for the schema and the backend stub.
 * ------------------------------------------------------------------ */

type Step = 1 | 2 | 3 | 4 | 5;

type StepErrors = Partial<
  Record<
    | "name"
    | "phone"
    | "actingFor"
    | "proxyName"
    | "matter"
    | "partyName"
    | "description"
    | "consent",
    string
  >
>;

const SLOT_KEYS: readonly ContactSlot[] = ["anytime", "custom"];

function matterTitleKey(k: MatterCategory): import("@/lib/i18n").MessageKey {
  switch (k) {
    case "family": return "intakeMatterFamily";
    case "land": return "intakeMatterLand";
    case "civil": return "intakeMatterCivil";
    case "criminal": return "intakeMatterCriminal";
    case "sexual_harassment": return "intakeMatterSexualHarassment";
    case "security": return "intakeMatterSecurity";
    case "labour": return "intakeMatterLabour";
    case "other": return "intakeMatterOther";
  }
}

/** Label for the two safe-contact choices: "any time" or a day + time. */
function slotText(k: ContactSlot, t: (k: import("@/lib/i18n").MessageKey) => string, lang: "bn" | "en"): { title: string; sub: string } {
  if (k === "anytime") return { title: t("slot4Title"), sub: t("slot4Sub") };
  return {
    title: lang === "bn" ? "নির্দিষ্ট দিন ও সময়" : "A specific day and time",
    sub: lang === "bn" ? "যখন কথা বলা নিরাপদ, সেই দিন ও সময় লিখুন" : "Enter the day and time when it is safe to talk",
  };
}

function slotSummary(d: IntakeDraft, t: (k: import("@/lib/i18n").MessageKey) => string, lang: "bn" | "en"): string | null {
  if (d.contactSlot === "anytime") return t("slot4Title");
  if (d.contactSlot === "custom") {
    const day = DAYS.find((x) => x.code === d.contactDay)?.label[lang];
    return day && d.contactTime ? `${day} ${d.contactTime}` : slotText("custom", t, lang).title;
  }
  return null;
}

function SlotIcon({ k }: { k: ContactSlot }) {
  return k === "anytime" ? <Clock size={22} /> : <Calendar size={22} />;
}

/* ------------------------------------------------------------------ *
 *  Reused voice-mic affordance — shared by the wizard steps so the
 *  citizen already knows how to use it.
 * ------------------------------------------------------------------ */

function VoiceMicButton({
  status,
  onStart,
  ariaLabel,
}: {
  status: VoiceStatus;
  onStart: () => void;
  ariaLabel: string;
}) {
  const listening = status === "listening";
  const completed = status === "completed";
  return (
    <button
      type="button"
      className={`${styles.micButton} ${listening ? styles.micListening : ""}`}
      onClick={onStart}
      aria-label={ariaLabel}
      aria-pressed={listening}
    >
      <span className={styles.micRing} aria-hidden />
      <span className={`${styles.micRing} ${styles.micRing2}`} aria-hidden />
      <span className={`${styles.micRing} ${styles.micRing3}`} aria-hidden />
      {completed ? <Check size={20} /> : listening ? <MicOff size={20} /> : <Mic size={20} />}
    </button>
  );
}

function VoiceStatusRow({ status }: { status: VoiceStatus }) {
  const { t, lang } = useI18n();
  let label = "";
  let variant: "" | "voiceStatusListening" | "voiceStatusProcessing" | "voiceStatusCompleted" = "";
  switch (status) {
    case "listening":
      label = t("voiceListening");
      variant = "voiceStatusListening";
      break;
    case "processing":
      label = t("voiceProcessing");
      variant = "voiceStatusProcessing";
      break;
    case "completed":
      label = t("voiceDone");
      variant = "voiceStatusCompleted";
      break;
    case "unsupported":
      label = lang === "bn" ? "এই ব্রাউজারে ভয়েস ইনপুট নেই — লিখে দিন" : "Voice input isn't available in this browser — please type";
      break;
    case "error":
      label = lang === "bn" ? "শোনা যায়নি — আবার চেষ্টা করুন বা লিখে দিন" : "Couldn't hear you — try again or type";
      break;
    default:
      label = "";
  }
  if (!label) return null;
  return (
    <span
      className={`${styles.voiceStatusRow} ${variant ? styles[variant] : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className={styles.voiceStatusDot} aria-hidden />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 *  Top-level wizard. Mounted by CitizenDashboard inside #intake.
 * ------------------------------------------------------------------ */

export function AssistedIntake({ mode = "citizen" }: { mode?: "citizen" | "udc" }) {
  const { lang, t } = useI18n();
  const udcOperator = typeof window !== "undefined" && mode === "udc" ? UdcAuth.current() : undefined;
  const storageScope = mode === "udc" ? `udc-${udcOperator?.operatorId ?? "unknown"}` : undefined;

  const [step, setStep] = useState<Step>(1);
  /* Lazy initializers let us read from `localStorage` during render
     (only on the client) without firing the `set-state-in-effect`
     rule the project enforces. After mount we still listen for
     online/offline transitions and refresh the queue count. */
  const [draft, setDraft] = useState<IntakeDraft>(() => {
    const d = loadDraft(storageScope) ?? emptyDraft();
    // The filer is the logged-in account: name + phone always come from it.
    // A draft saved by another account (or by the old demo voice samples)
    // is discarded rather than shown.
    if (mode === "udc") {
      if (!udcOperator) return d;
      const base = d.ownerId === udcOperator.operatorId ? d : emptyDraft();
      return { ...base, ownerId: udcOperator.operatorId, district: base.district || udcOperator.district };
    }
    const acct = typeof window !== "undefined" ? CitizenAuth.current() : undefined;
    if (!acct) return d;
    const base = d.ownerId === acct.citizenId ? d : emptyDraft();
    return { ...base, ownerId: acct.citizenId, name: acct.name, phone: acct.phone };
  });
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [submittedOffline, setSubmittedOffline] = useState(false);
  const [storageFull, setStorageFull] = useState<boolean>(() => {
    // Probe save quota once at mount so the banner can surface it.
    if (typeof window === "undefined") return false;
    return !saveDraft(loadDraft(storageScope) ?? emptyDraft(), storageScope);
  });
  const [online, setOnline] = useState<boolean>(() => isOnline());
  const [pendingCount, setPendingCount] = useState<number>(() => loadPending(storageScope).length);

  /* ------------------------------------------------------------- *
   *  Hydrate from `localStorage` on mount and listen for changes
   *  so the wizard survives a refresh mid-flow. This is also where
   *  the offline queue is counted for the offline banner.
   * ------------------------------------------------------------- */
  useEffect(() => {
    function onOnline() {
      setOnline(true);
      // Best-effort flush — see `lib/intake-store.ts` for the contract.
      syncPending(storageScope)
        .then(({ remaining }) => {
          setPendingCount(remaining);
        })
        .catch(() => {
          /* swallow; the next online tick will retry */
        });
    }
    function onOffline() {
      setOnline(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [storageScope]);

  /* Persist after every draft change. We update `saveDraft` only when
     the field set actually changed to avoid hammering localStorage on
     re-renders, but the cheap path is fine here. */
  const lastSavedJsonRef = useRef<string | null>(null);
  useEffect(() => {
    if (submittedRef) return;
    const json = JSON.stringify(draft);
    if (json === lastSavedJsonRef.current) return;
    lastSavedJsonRef.current = json;
    const ok = saveDraft(draft, storageScope);
    setStorageFull(!ok);
  }, [draft, storageScope, submittedRef]);

  /* ------------------------------------------------------------- *
   *  Voice for description (Step 3). Reuses the mock STT from the
   *  complaint wizard so behaviour is identical and citizens learn
   *  it once. Real adapter can drop in later.
   * ------------------------------------------------------------- */
  const descVoice = useSpeechInput(lang, {
    onComplete: (value) =>
      setDraft((d) => ({ ...d, description: value })),
  });

  /* ------------------------------------------------------------- *
   *  Field setters — typed updaters that keep the draft object
   *  immutable so React's reconciler stays happy.
   * ------------------------------------------------------------- */
  const setField = useCallback(
    <K extends keyof IntakeDraft>(key: K, value: IntakeDraft[K]) => {
      setDraft((d) => ({ ...d, [key]: value }));
    },
    [],
  );

  /* ------------------------------------------------------------- *
   *  Per-step validation.
   * ------------------------------------------------------------- */
  const errors = useMemo<StepErrors>(
    () => validateStep(step, draft, t),
    [step, draft, t],
  );
  // Shared-record requirements (same for every door): verified phone + district
  // on step 1, a safe contact time on step 5. See lib/dlas/validate.ts.
  const dlasDb = useDlasDb();
  const citizenSession = mode === "citizen" ? CitizenDoor.current() : undefined;
  void dlasDb;
  const phoneVerified = mode === "udc"
    ? !!normalizePhone(draft.phone)
    : !!citizenSession?.identity.verified && citizenSession.identity.phone === normalizePhone(draft.phone);
  const extraErrors = useMemo(() => {
    const e: string[] = [];
    if (step === 1 && !draft.district) e.push(lang === "bn" ? "জেলা বাছাই করুন" : "Choose your district");
    if (step === 1 && draft.nidNumber && ![10, 13, 17].includes(draft.nidNumber.replace(/\D/g, "").length))
      e.push(lang === "bn" ? "এনআইডি নম্বর ১০, ১৩ বা ১৭ সংখ্যার হতে হবে" : "NID number must have 10, 13 or 17 digits");
    if (step === 1 && !phoneVerified) e.push(
      mode === "udc"
        ? (lang === "bn" ? "সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন (01…)" : "Enter a valid 11-digit mobile number (01…)")
        : (lang === "bn" ? "মোবাইল নম্বরটি কোড দিয়ে যাচাই করুন" : "Verify your mobile number with the code"),
    );
    if (step === 5 && !draft.contactSlot) e.push(lang === "bn" ? "নিরাপদ যোগাযোগের সময় বাছাই করুন" : "Choose a safe contact time");
    if (step === 5 && draft.contactSlot === "custom" && (!draft.contactDay || !draft.contactTime))
      e.push(lang === "bn" ? "যোগাযোগের দিন ও সময় লিখুন" : "Enter the contact day and time");
    return e;
  }, [step, draft.district, draft.nidNumber, draft.contactSlot, draft.contactDay, draft.contactTime, phoneVerified, lang, mode]);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const allValid = Object.keys(errors).length === 0 && extraErrors.length === 0;

  /* ------------------------------------------------------------- *
   *  Navigation handlers.
   * ------------------------------------------------------------- */
  async function handleNext() {
    if (!allValid) return;
    try {
      if (mode === "udc" && udcOperator) await UdcDoor.syncWizard(draft, udcOperator, lang, step);
      else CitizenDoor.sync(draft, draft.district, step);
    } catch {
      /* storage failure is surfaced on submit */
    }
    if (step < 5) setStep(((step + 1) as Step));
  }
  function handleBack() {
    if (step > 1) setStep(((step - 1) as Step));
  }

  /* ------------------------------------------------------------- *
   *  Submit — moves the draft to the pending queue and shows the
   *  success view. If we are online the queue will be flushed by
   *  the online event handler; otherwise it waits.
   * ------------------------------------------------------------- */
  async function handleSubmit() {
    if (!allValid) return;
    // One record for every door: the gateway validates, mints APP-YYYY-NNNNN,
    // writes provenance + audit and opens the DLAO review task.
    let receipt = makeTempReceipt();
    try {
      const r = mode === "udc" && udcOperator
        ? await UdcDoor.submitWizard(draft, udcOperator, lang)
        : await CitizenDoor.submit(draft, draft.district);
      if (!r.ok) {
        setSubmitErrors(r.validation.errors.map((e) => `${e.path} — ${e.message}`));
        return;
      }
      receipt = r.record.applicationId;
      setSubmitErrors([]);
    } catch (e) {
      setSubmitErrors([String(e)]);
      return;
    }
    const wasOnline = isOnline();
    const queue = enqueueSubmission({
      tempReceipt: receipt,
      draft,
      createdAtIso: new Date().toISOString(),
      lang,
    }, storageScope);
    setPendingCount(queue.length);
    setSubmittedOffline(!wasOnline);
    setSubmittedRef(receipt);
    clearDraft(storageScope);
    if (wasOnline) {
      // Best-effort flush right away.
      syncPending(storageScope)
        .then(({ remaining }) => setPendingCount(remaining))
        .catch(() => {
          /* leave in queue */
        });
    }
  }

  function handleReset() {
    setStep(1);
    if (mode === "udc" && udcOperator) {
      UdcDoor.resetWizard(udcOperator.operatorId);
      setDraft({ ...emptyDraft(), ownerId: udcOperator.operatorId, district: udcOperator.district });
    } else {
      const acct = CitizenAuth.current();
      setDraft(acct ? { ...emptyDraft(), ownerId: acct.citizenId, name: acct.name, phone: acct.phone } : emptyDraft());
    }
    setSubmittedRef(null);
    setSubmittedOffline(false);
    setStorageFull(false);
    setPendingCount(loadPending(storageScope).length);
  }

  /* ------------------------------------------------------------- *
   *  Render.
   * ------------------------------------------------------------- */

  if (submittedRef) {
    return (
      <SuccessView
        refNumber={submittedRef}
        offline={submittedOffline}
        onAnother={handleReset}
        allowDebug={mode !== "udc"}
      />
    );
  }

  return (
    <div className={styles.workspace}>
      {(storageFull || !online || pendingCount > 0) ? (
        <OfflineBanner
          online={online}
          pendingCount={pendingCount}
          storageFull={storageFull}
        />
      ) : null}

      <StepProgress current={step} onJump={(target) => setStep(target)} />

      <div className={styles.layout}>
        <form
          className={styles.main}
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          noValidate
        >
          {step === 1 ? (
            <>
              <Step1Identity
                draft={draft}
                onChange={setField}
                errors={errors}
              />
              {mode === "udc" ? (
                <UdcIdentityCheck
                  draft={draft}
                  onDistrict={(v) => setField("district", v)}
                  onNid={(v) => setField("nidNumber", v)}
                />
              ) : (
                <CitizenIdentityCheck
                  draft={draft}
                  onDistrict={(v) => setField("district", v)}
                  onAddress={(v) => setField("applicantAddress", v)}
                  onNid={(v) => setField("nidNumber", v)}
                  verified={phoneVerified}
                />
              )}
            </>
          ) : null}

          {step === 2 ? (
            <Step2Matter
              draft={draft}
              choiceSource={draft.matterSelectionSource}
              selectedIssueId={draft.matterIssueId}
              onDescription={(description) => {
                const suggestion = simulateIntakeCategory(description);
                setDraft((current) => current.matterSelectionSource === "user"
                  ? { ...current, description }
                  : { ...current, description, matter: suggestion?.matter ?? null, matterIssueId: suggestion?.issue.id ?? null });
              }}
              onSelectIssue={(issue) => {
                setDraft((current) => ({ ...current, matter: issue.matter, matterIssueId: issue.id, matterSelectionSource: "user" }));
              }}
              onUseAi={() => {
                const suggestion = simulateIntakeCategory(draft.description);
                setDraft((current) => ({ ...current, matter: suggestion?.matter ?? null, matterIssueId: suggestion?.issue.id ?? null, matterSelectionSource: "ai" }));
              }}
              errors={errors}
            />
          ) : null}

          {step === 3 ? (
            <Step3Parties
              draft={draft}
              onChange={setField}
              descStatus={descVoice.status}
              onDescVoice={descVoice.start}
              errors={errors}
            />
          ) : null}

          {step === 4 ? (
            <Step4Documents
              draft={draft}
              forwardOnly={mode === "udc"}
              onIdentityDocumentUnavailable={(value) => setField("identityDocumentUnavailable", value)}
              onAdd={(doc) =>
                setField("documents", [...draft.documents, doc])
              }
              onRemove={(id) =>
                setField(
                  "documents",
                  draft.documents.filter((d) => d.id !== id),
                )
              }
            />
          ) : null}

          {step === 5 ? (
            <Step5ContactConsent
              draft={draft}
              onChange={setField}
              errors={errors}
              applicantLabel={
                draft.actingFor !== "self" && draft.proxyName
                  ? draft.proxyName
                  : draft.name
              }
            />
          ) : null}

          {extraErrors.length || submitErrors.length ? (
            <div className={styles.fieldError} role="alert" style={{ margin: "var(--s-3) 0" }}>
              {[...extraErrors, ...submitErrors].map((m) => (
                <div key={m}>• {m}</div>
              ))}
            </div>
          ) : null}
          <WizardFooter
            step={step}
            onBack={handleBack}
            onNext={handleNext}
            onSubmit={handleSubmit}
            canAdvance={allValid}
          />
        </form>

        <aside className={styles.aside}>
          <SidePreview draft={draft} forwardOnly={mode === "udc"} />
          <HowItWorks />
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Offline / pending banner — top of the wizard, full-width strip.
 * ------------------------------------------------------------------ */

function OfflineBanner({
  online,
  pendingCount,
  storageFull,
}: {
  online: boolean;
  pendingCount: number;
  storageFull: boolean;
}) {
  const { t } = useI18n();
  let label = t("intakeOfflineBanner");
  let sub = t("intakeOfflineBannerSub");
  if (storageFull) {
    label = t("intakeStorageQuota");
    sub = t("intakeDocsQualityHint");
  } else if (online && pendingCount > 0) {
    label = "Syncing…";
    sub = `${pendingCount} pending`;
  }
  return (
    <div className={styles.offlineBanner} role="status" aria-live="polite">
      <span className={styles.offlineDot} aria-hidden />
      <div>
        <p className={styles.offlineTitle}>{label}</p>
        <p className={styles.offlineSub}>{sub}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Step progress strip.
 * ------------------------------------------------------------------ */

const STEPS: { id: Step; key: import("@/lib/i18n").MessageKey }[] = [
  { id: 1, key: "intakeProgress1" },
  { id: 2, key: "intakeProgress2" },
  { id: 3, key: "intakeProgress3" },
  { id: 4, key: "intakeProgress4" },
  { id: 5, key: "intakeProgress5" },
];

function StepProgress({
  current,
  onJump,
}: {
  current: Step;
  onJump: (s: Step) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.stepProgress} role="group" aria-label={t("stepLabel")}>
      <div className={styles.stepProgressHeader}>
        <p className={styles.stepProgressEyebrow}>
          {t("stepLabel")} {current} {t("intakeStepOf")} {STEPS.length}
        </p>
        <p className={styles.stepProgressTitle} aria-live="polite">
          {t(STEPS[current - 1].key)}
        </p>
      </div>

      <ol className={styles.stepTrack}>
        {STEPS.map((s, idx) => {
          const completed = s.id < current;
          const active = s.id === current;
          return (
            <li key={s.id} className={styles.stepCell}>
              <button
                type="button"
                className={`${styles.stepDot} ${
                  active ? styles.stepDotActive : ""
                } ${completed ? styles.stepDotCompleted : ""}`}
                onClick={() => onJump(s.id)}
                aria-label={`${t("stepLabel")} ${s.id}: ${t(s.key)}`}
                aria-current={active ? "step" : undefined}
              >
                {completed ? <Check size={16} /> : s.id}
              </button>
              <span
                className={`${styles.stepLabel} ${
                  active ? styles.stepLabelActive : ""
                }`}
              >
                {t(s.key)}
              </span>
              {idx < STEPS.length - 1 ? (
                <span
                  className={`${styles.stepConnector} ${
                    completed ? styles.stepConnectorCompleted : ""
                  }`}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Step 1 — Identity (name + phone + acting-for).
 * ------------------------------------------------------------------ */

function Step1Identity({
  draft,
  onChange,
  errors,
}: {
  draft: IntakeDraft;
  onChange: <K extends keyof IntakeDraft>(k: K, v: IntakeDraft[K]) => void;
  errors: StepErrors;
}) {
  const { t, lang } = useI18n();
  const nameVoice = useSpeechInput(lang, {
    onComplete: (v) => onChange("name", v),
  });
  const phoneVoice = useSpeechInput(lang, {
    onComplete: (v) => onChange("phone", v),
  });

  const cards: {
    key: ActingFor;
    titleKey: import("@/lib/i18n").MessageKey;
    icon: React.ReactNode;
  }[] = [
    { key: "self", titleKey: "actingSelfTitle", icon: <User size={18} /> },
    { key: "family", titleKey: "actingFamilyTitle", icon: <Users size={18} /> },
    { key: "neighbor", titleKey: "actingNeighborTitle", icon: <HelpingHand size={18} /> },
    { key: "alleged", titleKey: "actingAllegedTitle", icon: <Shield size={18} /> },
  ];

  return (
    <section className={styles.stepCard} aria-labelledby="ai-s1-title">
      <span className={styles.stepBadge}>০১ · {t("intakeStep1Headline")}</span>
      <h2 id="ai-s1-title" className={styles.stepTitle}>
        {t("intakeStep1Headline")}
      </h2>
      <p className={styles.stepSubtitle}>{t("intakeStep1Sub")}</p>

      <div className={styles.voiceBlock}>
        <VoiceMicButton
          status={nameVoice.status}
          onStart={nameVoice.start}
          ariaLabel={t("voiceMicName")}
        />
        <div>
          <p className={styles.micLabel}>{t("voiceMicName")}</p>
          <p className={styles.micLabelMuted}>{t("voiceSavedHint")}</p>
        </div>
        <VoiceStatusRow status={nameVoice.status} />
      </div>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t("nameLabel")}</span>
        <input
          className={styles.textInput}
          type="text"
          value={draft.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder={t("namePlaceholder")}
          autoComplete="name"
        />
        {errors.name ? (
          <span className={styles.fieldError} role="alert">
            {errors.name}
          </span>
        ) : null}
      </label>

      <div className={styles.voiceBlock}>
        <VoiceMicButton
          status={phoneVoice.status}
          onStart={phoneVoice.start}
          ariaLabel={t("voiceMicPhone")}
        />
        <div>
          <p className={styles.micLabel}>{t("voiceMicPhone")}</p>
          <p className={styles.micLabelMuted}>{t("voiceSavedHint")}</p>
        </div>
        <VoiceStatusRow status={phoneVoice.status} />
      </div>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t("phoneLabel")}</span>
        <input
          className={styles.textInput}
          type="tel"
          inputMode="tel"
          value={draft.phone}
          onChange={(e) => onChange("phone", e.target.value)}
          placeholder={t("phonePlaceholder")}
          autoComplete="tel"
        />
        {errors.phone ? (
          <span className={styles.fieldError} role="alert">
            {errors.phone}
          </span>
        ) : null}
      </label>

      <p className={styles.stepQuestion}>
        {t("s2Question")}
      </p>
      <div className={styles.actingRow}>
        {cards.map((card) => {
          const active = draft.actingFor === card.key;
          return (
            <button
              key={card.key}
              type="button"
              role="radio"
              aria-checked={active}
              className={`${styles.actingPill} ${active ? styles.actingPillActive : ""}`}
              onClick={() => onChange("actingFor", card.key)}
            >
              <span className={styles.actingIcon} aria-hidden>
                {card.icon}
              </span>
              {t(card.titleKey)}
            </button>
          );
        })}
      </div>
      {errors.actingFor ? (
        <span className={styles.fieldError} role="alert">
          {errors.actingFor}
        </span>
      ) : null}

      {draft.actingFor === "family" || draft.actingFor === "neighbor" || draft.actingFor === "alleged" ? (
        <div className={styles.proxyDisclosure}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("proxyRelLabel")}</span>
            <input
              className={styles.textInput}
              type="text"
              value={draft.proxyRel}
              onChange={(e) => onChange("proxyRel", e.target.value)}
              placeholder={t("proxyRelPlaceholder")}
            />
            {errors.proxyName ? (
              <span className={styles.fieldError} role="alert">
                {t("errProxyName")}
              </span>
            ) : null}
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("proxyNameLabel")}</span>
            <input
              className={styles.textInput}
              type="text"
              value={draft.proxyName}
              onChange={(e) => onChange("proxyName", e.target.value)}
              placeholder={t("proxyNamePlaceholder")}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("proxyPhoneLabel")}</span>
            <input
              className={styles.textInput}
              type="tel"
              inputMode="tel"
              value={draft.proxyPhone}
              onChange={(e) => onChange("proxyPhone", e.target.value)}
              placeholder={t("proxyPhonePlaceholder")}
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  Step 2 — simulated AI recommendation with a plain-language picker.
 * ------------------------------------------------------------------ */

function Step2Matter({
  draft,
  choiceSource,
  selectedIssueId,
  onDescription,
  onSelectIssue,
  onUseAi,
  errors,
}: {
  draft: IntakeDraft;
  choiceSource: "ai" | "user";
  selectedIssueId: string | null;
  onDescription: (value: string) => void;
  onSelectIssue: (issue: (typeof INTAKE_ISSUE_TYPES)[number]) => void;
  onUseAi: () => void;
  errors: StepErrors;
}) {
  const { t, lang } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const suggestion = simulateIntakeCategory(draft.description);
  const selectedIssue = INTAKE_ISSUE_TYPES.find((issue) => issue.id === selectedIssueId) ?? null;
  const issueLabel = selectedIssue?.label[lang] ?? suggestion?.issue.label[lang] ?? null;
  const matterLabel = draft.matter ? t(matterTitleKey(draft.matter)) : null;

  return (
    <section className={styles.stepCard} aria-labelledby="ai-s2-title">
      <span className={styles.stepBadge}>০২ · {t("intakeStep2Headline")}</span>
      <h2 id="ai-s2-title" className={styles.stepTitle}>
        {lang === "bn" ? "আপনার সমস্যাটি আমাদের বলুন" : "Tell us about your problem"}
      </h2>
      <p className={styles.stepSubtitle}>
        {lang === "bn"
          ? "আইনের ধারা বা মামলার ধরন জানার দরকার নেই। নিজের ভাষায় সংক্ষেপে লিখুন—সহকারী আপনার জন্য ধরনটি বেছে নেবে।"
          : "You do not need to know the legal category. Describe it briefly in your own words and the assistant will choose one for you."}
      </p>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          {lang === "bn" ? "কী ঘটেছে?" : "What happened?"}
        </span>
        <textarea
          className={styles.textarea}
          rows={4}
          value={draft.description}
          onChange={(event) => onDescription(event.target.value)}
          placeholder={lang === "bn" ? "যেমন: আমার তিন মাসের বেতন দেয়নি" : "For example: My salary has not been paid for three months"}
        />
        <span className={styles.inputHint}>
          {lang === "bn" ? "কমপক্ষে একটি ছোট বাক্য লিখুন। পরের ধাপে এটি সম্পাদনা করতে পারবেন।" : "Write at least one short sentence. You can edit it in the next step."}
        </span>
      </label>

      <div className={`${styles.aiSuggestion} ${draft.matter ? styles.aiSuggestionReady : ""}`} aria-live="polite">
        <div className={styles.aiSuggestionHead}>
          <span className={styles.aiBadge}>{lang === "bn" ? "AI সিমুলেশন" : "AI simulation"}</span>
          {choiceSource === "user" ? (
            <button type="button" className={styles.textButton} onClick={onUseAi}>
              {lang === "bn" ? "AI-কে আবার বেছে নিতে দিন" : "Let AI choose again"}
            </button>
          ) : null}
        </div>
        {draft.matter ? (
          <div className={styles.aiResult}>
            <span className={styles.aiResultCheck} aria-hidden><Check size={18} /></span>
            <div>
              <p className={styles.aiResultLabel}>
                {choiceSource === "user"
                  ? (lang === "bn" ? "আপনি বেছে নিয়েছেন" : "You selected")
                  : (lang === "bn" ? "সহকারী যে ধরনটি বেছে নিয়েছে" : "The assistant selected")}
              </p>
              <p className={styles.aiResultTitle}>{issueLabel ?? matterLabel}</p>
              {issueLabel && matterLabel ? <p className={styles.aiResultMeta}>{matterLabel}</p> : null}
            </div>
          </div>
        ) : (
          <p className={styles.aiWaiting}>
            {lang === "bn" ? "আপনার বর্ণনা পড়ে এখানে একটি ধরন দেখানো হবে।" : "A recommended issue type will appear here after reading your description."}
          </p>
        )}
      </div>

      <button
        type="button"
        className={styles.issueToggle}
        aria-expanded={showAll}
        aria-controls="intake-issue-list"
        onClick={() => setShowAll((open) => !open)}
      >
        <span>
          <strong>{lang === "bn" ? "সব সমস্যার ধরন দেখুন" : "See all issue types"}</strong>
          <small>{lang === "bn" ? `${INTAKE_ISSUE_TYPES.length}টি সহজ বিকল্প থেকে নিজে বেছে নিন` : `Choose yourself from ${INTAKE_ISSUE_TYPES.length} plain-language options`}</small>
        </span>
        <ChevronDown size={20} className={showAll ? styles.chevronOpen : ""} />
      </button>

      {showAll ? (
        <div id="intake-issue-list" className={styles.issuePanel}>
          <p className={styles.issuePanelIntro}>
            {lang === "bn" ? "আপনার অবস্থার সবচেয়ে কাছের একটি বেছে নিন। অফিস পরে প্রয়োজনে সংশোধন করতে পারবে।" : "Choose the closest match. The office can refine it later if needed."}
          </p>
          <div className={styles.issueGrid} role="radiogroup" aria-label={lang === "bn" ? "বিস্তারিত সমস্যার ধরন" : "Detailed issue type"}>
            {INTAKE_ISSUE_TYPES.map((issue) => {
              const active = choiceSource === "user" && selectedIssueId === issue.id;
              return (
                <button
                  key={issue.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`${styles.issueOption} ${active ? styles.issueOptionActive : ""}`}
                  onClick={() => onSelectIssue(issue)}
                >
                  <span>{issue.label[lang]}</span>
                  <small>{t(matterTitleKey(issue.matter))}</small>
                  {active ? <Check size={16} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {errors.matter ? (
        <span className={styles.fieldError} role="alert">
          {errors.matter}
        </span>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  Step 3 — Parties + Story.
 * ------------------------------------------------------------------ */

function Step3Parties({
  draft,
  onChange,
  descStatus,
  onDescVoice,
  errors,
}: {
  draft: IntakeDraft;
  onChange: <K extends keyof IntakeDraft>(k: K, v: IntakeDraft[K]) => void;
  descStatus: VoiceStatus;
  onDescVoice: () => void;
  errors: StepErrors;
}) {
  const { t, lang } = useI18n();
  return (
    <section className={styles.stepCard} aria-labelledby="ai-s3-title">
      <span className={styles.stepBadge}>০৩ · {t("intakeStep3Headline")}</span>
      <h2 id="ai-s3-title" className={styles.stepTitle}>
        {t("intakeStep3Headline")}
      </h2>
      <p className={styles.stepSubtitle}>{t("intakeStep3Sub")}</p>

      <div className={styles.subBlock}>
        <h3 className={styles.subBlockTitle}>
          {t("intakeStep3PartyHeadline")}
        </h3>
        <p className={styles.subBlockSub}>{t("intakeStep3PartySub")}</p>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("intakePartyNameLabel")}</span>
          <input
            className={styles.textInput}
            type="text"
            value={draft.partyName}
            onChange={(e) => onChange("partyName", e.target.value)}
            placeholder={t("intakePartyNamePlaceholder")}
          />
          {errors.partyName ? (
            <span className={styles.fieldError} role="alert">
              {errors.partyName}
            </span>
          ) : null}
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("intakePartyAddressLabel")}</span>
          <input
            className={styles.textInput}
            type="text"
            value={draft.partyAddress}
            onChange={(e) => onChange("partyAddress", e.target.value)}
            placeholder={t("intakePartyAddressPlaceholder")}
          />
        </label>
        {draft.additionalOpponents.map((opponent, index) => (
          <div className={styles.opponentCard} key={index}>
            <div className={styles.opponentCardHead}>
              <strong>{lang === "bn" ? `অতিরিক্ত বিপক্ষ ${index + 2}` : `Additional opponent ${index + 2}`}</strong>
              <button
                type="button"
                className={styles.opponentRemove}
                onClick={() => onChange("additionalOpponents", draft.additionalOpponents.filter((_, itemIndex) => itemIndex !== index))}
              >
                <X size={16} /> {lang === "bn" ? "সরান" : "Remove"}
              </button>
            </div>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t("intakePartyNameLabel")}</span>
              <input
                className={styles.textInput}
                type="text"
                value={opponent.name}
                onChange={(event) => onChange("additionalOpponents", draft.additionalOpponents.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}
                placeholder={t("intakePartyNamePlaceholder")}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t("intakePartyAddressLabel")}</span>
              <input
                className={styles.textInput}
                type="text"
                value={opponent.address}
                onChange={(event) => onChange("additionalOpponents", draft.additionalOpponents.map((item, itemIndex) => itemIndex === index ? { ...item, address: event.target.value } : item))}
                placeholder={t("intakePartyAddressPlaceholder")}
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          className={styles.addOpponentButton}
          onClick={() => onChange("additionalOpponents", [...draft.additionalOpponents, { name: "", address: "" }])}
        >
          <span aria-hidden>+</span> {lang === "bn" ? "আরেকজন বিপক্ষ যোগ করুন" : "Add another opponent"}
        </button>
      </div>

      <div className={styles.subBlock}>
        <h3 className={styles.subBlockTitle}>
          {t("intakeDescLabel")}
        </h3>
        <div className={styles.voiceBlock}>
          <VoiceMicButton
            status={descStatus}
            onStart={onDescVoice}
            ariaLabel={t("intakeVoiceMicStory")}
          />
          <div>
            <p className={styles.micLabel}>{t("intakeVoiceMicStory")}</p>
            <p className={styles.micLabelMuted}>{t("intakeVoiceSavedHint")}</p>
          </div>
          <VoiceStatusRow status={descStatus} />
        </div>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("intakeDescLabel")}</span>
          <textarea
            className={styles.textarea}
            rows={5}
            value={draft.description}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder={t("intakeDescPlaceholder")}
          />
          {errors.description ? (
            <span className={styles.fieldError} role="alert">
              {errors.description}
            </span>
          ) : null}
        </label>
      </div>

      <SafetyNote />
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  No "Is this urgent?" question any more: urgency is decided by fixed
 *  rules from the matter type and the description (lib/dlas/incident-
 *  taxonomy.ts) and red cases are flagged for the officer. The citizen
 *  only gets the emergency advice.
 * ------------------------------------------------------------------ */

function SafetyNote() {
  const { lang } = useI18n();
  return (
    <p style={{ fontSize: "0.85rem", opacity: 0.8, margin: "12px 0 0" }}>
      {lang === "bn" ? "আপনার বর্ণনা থেকেই অফিস বুঝে নেয় কোন কেস জরুরি — আলাদা করে কিছু বলতে হবে না। জীবন-ঝুঁকিতে এখনই ৯৯৯-এ ফোন করুন।" : "The office works out from your description which cases are urgent — you do not need to mark anything. If a life is at risk, call 999 now."}
    </p>
  );
}

/* ------------------------------------------------------------------ *
 *  Step 4 — Documents (drag/drop + file picker).
 *
 *  Reads files via the File API, stores them as `data:` URLs in the
 *  draft. In production the file should be uploaded to object
 *  storage and only the URL sent — see `lib/intake-store.ts`.
 * ------------------------------------------------------------------ */

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB per file — keeps the localStorage quota safe.

function Step4Documents({
  draft,
  onAdd,
  onRemove,
  onIdentityDocumentUnavailable,
  forwardOnly = false,
}: {
  draft: IntakeDraft;
  onAdd: (doc: IntakeDocument) => void;
  onRemove: (id: string) => void;
  onIdentityDocumentUnavailable: (value: boolean) => void;
  forwardOnly?: boolean;
}) {
  const { t, lang } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [limitHit, setLimitHit] = useState(false);

  const ingest = useCallback((files: FileList | File[]) => {
    setLimitHit(false);
    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_BYTES) {
        setLimitHit(true);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!dataUrl) return;
        onAdd({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          dataUrl,
        });
      };
      reader.readAsDataURL(file);
    });
  }, [onAdd]);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer?.files) {
      ingest(event.dataTransfer.files);
    }
  }
  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }
  function handleDragLeave() {
    setIsDragging(false);
  }
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      ingest(event.target.files);
      // Reset so the same file can be re-selected later.
      event.target.value = "";
    }
  }

  return (
    <section className={styles.stepCard} aria-labelledby="ai-s4-title">
      <span className={styles.stepBadge}>০৪ · {t("intakeStep4Headline")}</span>
      <h2 id="ai-s4-title" className={styles.stepTitle}>
        {t("intakeStep4Headline")}
      </h2>
      <p className={styles.stepSubtitle}>{t("intakeStep4Sub")}</p>

      {forwardOnly ? (
        <div className={styles.agreementBox} role="note">
          <Shield size={24} />
          <div>
            <p className={styles.agreementTitle}>
              {lang === "bn" ? "সিল করা ফরওয়ার্ড-অনলি প্রমাণ" : "Sealed, forward-only evidence"}
            </p>
            <p className={styles.agreementBody}>
              {lang === "bn"
                ? "ইউডিসি শুধু ফাইলটি মামলার রেকর্ডে পাঠাতে পারে। এই পর্দায় প্রমাণের বিষয়বস্তু, প্রিভিউ বা ফাইলের নাম দেখা যাবে না।"
                : "The UDC can only pass the file into the case record. This screen never shows its contents, preview, or filename."}
            </p>
          </div>
        </div>
      ) : null}

      <div
        className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        aria-label={t("intakeDocsBody")}
      >
        <div className={styles.dropIcon} aria-hidden>
          <FileText size={36} />
        </div>
        <p className={styles.dropHeading}>{t("intakeDocsHeading")}</p>
        <p className={styles.dropHint}>{t("intakeDocsDropHint")}</p>
        <button
          type="button"
          className={styles.browseBtn}
          onClick={() => fileInputRef.current?.click()}
        >
          {t("intakeDocsBrowseBtn")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className={styles.fileInput}
          onChange={handleFileChange}
          aria-hidden
          tabIndex={-1}
        />
        <p className={styles.dropQuality}>{t("intakeDocsQualityHint")}</p>
      </div>

      {limitHit ? (
        <p className={styles.fieldError} role="alert">
          {t("intakeStorageQuota")}
        </p>
      ) : null}

      {draft.documents.length === 0 ? (
        <p className={styles.docsEmpty}>{t("intakeDocsEmpty")}</p>
      ) : (
        <ul className={styles.docsList}>
          {draft.documents.map((doc, index) => (
            <li key={doc.id} className={styles.docRow}>
              <span className={styles.docIcon} aria-hidden>
                <FileText size={20} />
              </span>
              <span className={styles.docMeta}>
                <span className={styles.docName}>
                  {forwardOnly
                    ? (lang === "bn" ? `সিল করা প্রমাণ ${index + 1}` : `Sealed evidence ${index + 1}`)
                    : doc.name}
                </span>
                <span className={styles.docSize}>
                  {forwardOnly
                    ? (lang === "bn" ? "ফরওয়ার্ডের জন্য প্রস্তুত" : "Ready to forward")
                    : `${t("intakeDocsFileSize")}: ${formatBytes(doc.size)}`}
                </span>
              </span>
              <button
                type="button"
                className={styles.docRemove}
                onClick={() => onRemove(doc.id)}
                aria-label={`${t("intakeDocsRemoveBtn")} — ${forwardOnly ? index + 1 : doc.name}`}
              >
                <X size={16} />
                {t("intakeDocsRemoveBtn")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={`${styles.identityHelpBox} ${draft.identityDocumentUnavailable ? styles.identityHelpBoxActive : ""}`}>
        <div>
          <p className={styles.identityHelpTitle}>
            {lang === "bn" ? "পরিচয়পত্র নেই?" : "No identity document?"}
          </p>
          <p className={styles.identityHelpBody}>
            {lang === "bn"
              ? "আবেদন থামবে না। পরিচয় যাচাইয়ের জন্য সিস্টেম আপনার এলাকার সরকারি প্রতিনিধির কাছে অনুরোধ পাঠাবে এবং জেলা লিগ্যাল এইড অফিস অগ্রগতি দেখবে।"
              : "Your application can continue. The system will send an identity-verification request to a local government representative, and the District Legal Aid Office will track it."}
          </p>
        </div>
        <button
          type="button"
          className={`${styles.identityHelpButton} ${draft.identityDocumentUnavailable ? styles.identityHelpButtonActive : ""}`}
          aria-pressed={draft.identityDocumentUnavailable}
          onClick={() => onIdentityDocumentUnavailable(!draft.identityDocumentUnavailable)}
        >
          {draft.identityDocumentUnavailable ? <Check size={18} /> : null}
          {draft.identityDocumentUnavailable
            ? (lang === "bn" ? "স্থানীয় যাচাই অনুরোধ করা হয়েছে" : "Local verification requested")
            : (lang === "bn" ? "আমার প্রয়োজনীয় পরিচয়পত্র নেই" : "I don't have the necessary identity document")}
        </button>
      </div>
    </section>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/* ------------------------------------------------------------------ *
 *  Step 5 — Safe contact time + consent.
 * ------------------------------------------------------------------ */

function Step5ContactConsent({
  draft,
  onChange,
  errors,
  applicantLabel,
}: {
  draft: IntakeDraft;
  onChange: <K extends keyof IntakeDraft>(k: K, v: IntakeDraft[K]) => void;
  errors: StepErrors;
  applicantLabel: string;
}) {
  const { t, lang } = useI18n();
  return (
    <section className={styles.stepCard} aria-labelledby="ai-s5-title">
      <span className={styles.stepBadge}>০৫ · {t("intakeStep5Headline")}</span>
      <h2 id="ai-s5-title" className={styles.stepTitle}>
        {t("intakeStep5Headline")}
      </h2>
      <p className={styles.stepSubtitle}>{t("intakeStep5Sub")}</p>

      <div className={styles.agreementBox}>
        <Shield size={24} />
        <div>
          <p className={styles.agreementTitle}>{t("intakeStep5Headline")}</p>
          <p className={styles.agreementBody}>{t("intakeStep5Confirm")}</p>
        </div>
      </div>

      <div
        className={styles.slotGrid}
        role="radiogroup"
        aria-label={t("intakeStep5Headline")}
      >
        {SLOT_KEYS.map((key) => {
          const active = draft.contactSlot === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              className={`${styles.slotCard} ${active ? styles.slotCardActive : ""}`}
              onClick={() => onChange("contactSlot", key)}
            >
              <span className={styles.slotIcon} aria-hidden>
                <SlotIcon k={key} />
              </span>
              <p className={styles.slotTitle}>{slotText(key, t, lang).title}</p>
              <p className={styles.slotSub}>{slotText(key, t, lang).sub}</p>
              <span className={styles.slotCheck} aria-hidden>
                <Check size={14} />
              </span>
            </button>
          );
        })}
      </div>

      {draft.contactSlot === "custom" ? (
        <div className={styles.proxyDisclosure}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{lang === "bn" ? "দিন" : "Day"}</span>
            <select
              className={styles.textInput}
              value={draft.contactDay}
              onChange={(e) => onChange("contactDay", e.target.value as IntakeDraft["contactDay"])}
            >
              <option value="">{lang === "bn" ? "বাছাই করুন" : "Select"}</option>
              {DAYS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label[lang]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{lang === "bn" ? "সময়" : "Time"}</span>
            <input
              className={styles.textInput}
              type="time"
              value={draft.contactTime}
              onChange={(e) => onChange("contactTime", e.target.value)}
            />
          </label>
        </div>
      ) : null}

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t("specialInstrLabel")}</span>
        <textarea
          className={styles.textarea}
          rows={3}
          value={draft.specialInstructions}
          onChange={(e) => onChange("specialInstructions", e.target.value)}
          placeholder={t("specialInstrPlaceholder")}
        />
      </label>

      <div className={styles.consentBox}>
        <p className={styles.reviewHeading}>{t("reviewHeading")}</p>
        <div className={styles.reviewRow}>
          <span className={styles.reviewLabel}>{t("reviewApplicant")}</span>
          <span className={styles.reviewValue}>{applicantLabel || "—"}</span>
        </div>
        <label className={styles.consentRow}>
          <input
            type="checkbox"
            checked={draft.consentOk}
            onChange={(e) => onChange("consentOk", e.target.checked)}
          />
          <span>{t("intakeStep5Confirm")}</span>
        </label>
        {errors.consent ? (
          <span className={styles.fieldError} role="alert">
            {errors.consent}
          </span>
        ) : null}
        <p className={styles.consentLegal}>{t("consentLegal")}</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  Wizard footer (back / next / submit).
 * ------------------------------------------------------------------ */

function WizardFooter({
  step,
  onBack,
  onNext,
  onSubmit,
  canAdvance,
}: {
  step: Step;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  canAdvance: boolean;
}) {
  const { t } = useI18n();
  const isLast = step === 5;
  return (
    <footer className={styles.footer}>
      <div className={styles.footerBack}>
        <Button
          variant="secondary"
          onClick={onBack}
          disabled={step === 1}
          type="button"
        >
          <ChevronLeft size={18} />
          {t("backBtn")}
        </Button>
      </div>
      <div className={styles.footerNext}>
        {isLast ? (
          <Button onClick={onSubmit} disabled={!canAdvance} type="submit">
            {t("submitBtn")}
            <ChevronRight size={18} />
          </Button>
        ) : (
          <Button onClick={onNext} disabled={!canAdvance} type="button">
            {t("nextBtn")}
            <ChevronRight size={18} />
          </Button>
        )}
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ *
 *  Live preview card (right column).
 * ------------------------------------------------------------------ */

function SidePreview({ draft, forwardOnly = false }: { draft: IntakeDraft; forwardOnly?: boolean }) {
  const { t, lang } = useI18n();
  const matterLabel = draft.matter ? t(matterTitleKey(draft.matter)) : null;
  const slotLabel = slotSummary(draft, t, lang);
  const applicantLabel =
    draft.actingFor !== "self" && draft.proxyName
      ? draft.proxyName
      : draft.name;

  const allEmpty =
    !applicantLabel && !draft.matter && !draft.partyName && draft.documents.length === 0 && !draft.contactSlot;

  return (
    <div className={styles.previewCard} aria-live="polite">
      <p className={styles.previewEyebrow}>{t("intakePreviewHeading")}</p>
      {allEmpty ? (
        <p className={styles.previewEmpty}>{t("intakePreviewEmpty")}</p>
      ) : (
        <dl className={styles.previewRows}>
          <div className={styles.previewRow}>
            <dt className={styles.previewLabel}>{t("intakePreviewApplicant")}</dt>
            <dd className={styles.previewValue}>{applicantLabel || "—"}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt className={styles.previewLabel}>{t("intakePreviewMatter")}</dt>
            <dd className={styles.previewValue}>{matterLabel || "—"}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt className={styles.previewLabel}>{t("intakePreviewParty")}</dt>
            <dd className={styles.previewValue}>{draft.partyName || "—"}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt className={styles.previewLabel}>{t("intakePreviewDocs")}</dt>
            <dd className={styles.previewValue}>
              {draft.documents.length > 0
                ? forwardOnly
                  ? (lang === "bn" ? `${draft.documents.length}টি সিল করা ফাইল ফরওয়ার্ডের জন্য প্রস্তুত` : `${draft.documents.length} sealed file(s) ready to forward`)
                  : `${draft.documents.length} ${t("intakePreviewDocs").toLowerCase()}`
                : "—"}
            </dd>
          </div>
          <div className={styles.previewRow}>
            <dt className={styles.previewLabel}>{t("intakePreviewContact")}</dt>
            <dd className={styles.previewValue}>{slotLabel || "—"}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt className={styles.previewLabel}>{t("intakePreviewConsent")}</dt>
            <dd className={styles.previewValue}>
              {draft.consentOk ? t("voiceDone") : "—"}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function HowItWorks() {
  const { t } = useI18n();
  return (
    <div className={styles.howCard}>
      <p className={styles.howHeading}>{t("intakeHelpTitle")}</p>
      <ol className={styles.howList}>
        <li className={styles.howItem}>
          <span className={styles.howNum}>1</span>
          <div className={styles.howBody}>
            <span className={styles.howItemTitle}>{t("intakeHelp1Title")}</span>
            <span className={styles.howItemBody}>{t("intakeHelp1Body")}</span>
          </div>
        </li>
        <li className={styles.howItem}>
          <span className={styles.howNum}>2</span>
          <div className={styles.howBody}>
            <span className={styles.howItemTitle}>{t("intakeHelp2Title")}</span>
            <span className={styles.howItemBody}>{t("intakeHelp2Body")}</span>
          </div>
        </li>
        <li className={styles.howItem}>
          <span className={styles.howNum}>3</span>
          <div className={styles.howBody}>
            <span className={styles.howItemTitle}>{t("intakeHelp3Title")}</span>
            <span className={styles.howItemBody}>{t("intakeHelp3Body")}</span>
          </div>
        </li>
      </ol>
    </div>
  );
}

function SuccessView({
  refNumber,
  offline,
  onAnother,
  allowDebug = true,
}: {
  refNumber: string;
  offline: boolean;
  onAnother: () => void;
  allowDebug?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.successWrap} role="status" aria-live="polite">
      <span className={styles.successBadge}>{t("complaintReference")}</span>
      <p className={styles.successRef}>
        <span className={styles.successRefNumber}>{refNumber}</span>
      </p>
      <h2 className={styles.successTitle}>
        {offline ? t("intakeSuccessOfflineTitle") : t("intakeSuccessTitle")}
      </h2>
      <p className={styles.successBody}>
        {offline ? t("intakeSuccessOfflineBody") : t("intakeSuccessBody")}
      </p>
      {offline ? (
        <p className={styles.successHint}>{t("intakeSuccessOfflineHint")}</p>
      ) : null}
      <ul className={styles.successList}>
        <li>
          <Check size={20} />
          {t("intakeSuccessNext1")}
        </li>
        <li>
          <Check size={20} />
          {t("intakeSuccessNext2")}
        </li>
        <li>
          <Check size={20} />
          {t("intakeSuccessNext3")}
        </li>
      </ul>
      {allowDebug && refNumber.startsWith("APP-") ? (
        <p className={styles.successHint}>
          <Link href={`/debug?id=${refNumber}`}>/debug?id={refNumber}</Link>
        </p>
      ) : null}
      <Button onClick={onAnother}>{t("applyAgainBtn")}</Button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Per-step validation. Mirrors the complaint wizard pattern.
 * ------------------------------------------------------------------ */

function validateStep(
  step: Step,
  draft: IntakeDraft,
  t: (k: import("@/lib/i18n").MessageKey) => string,
): StepErrors {
  const errors: StepErrors = {};
  if (step >= 1) {
    if (!draft.name.trim()) errors.name = t("errName");
    if (!draft.phone.trim()) errors.phone = t("errPhone");
  }
  if (step >= 2) {
    if (!draft.matter) errors.matter = t("intakeErrMatter");
  }
  if (step >= 3) {
    if (!draft.partyName.trim()) errors.partyName = t("intakeErrPartyName");
    if (!draft.description.trim()) errors.description = t("intakeErrDescription");
  }
  if (step >= 5) {
    if (!draft.consentOk) errors.consent = t("intakeErrConsent");
  }
  return errors;
}


/* ------------------------------------------------------------------ *
 *  Shared-record identity check (step 1): district + phone OTP.
 *  Same requirements as IVR (caller-line id), USSD (MSISDN) and UDC
 *  (operator attestation) — see lib/dlas/validate.ts.
 * ------------------------------------------------------------------ */

function UdcIdentityCheck({
  draft,
  onDistrict,
  onNid,
}: {
  draft: IntakeDraft;
  onDistrict: (v: string) => void;
  onNid: (v: string) => void;
}) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  return (
    <section className={styles.stepCard} aria-label={tx("পরিচয় প্রত্যয়ন ও জেলা", "Identity attestation and district")}>
      <div className={styles.agreementBox} role="note">
        <Shield size={24} />
        <div>
          <p className={styles.agreementTitle}>{tx("ইউডিসি পরিচয় প্রত্যয়ন", "UDC identity attestation")}</p>
          <p className={styles.agreementBody}>
            {tx(
              "আবেদনকারী বা তার প্রতিনিধি উপস্থিত আছেন—ইউডিসি অপারেটর এই পরিচয় প্রত্যয়ন করে আবেদনটি পাঠাবেন। আবেদনকারীর ফোনে আলাদা ওটিপি লাগবে না।",
              "The applicant or representative is present. The UDC operator attests the identity before forwarding; no separate applicant OTP is required.",
            )}
          </p>
        </div>
      </div>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{tx("আবেদনকারীর জেলা", "Applicant district")}</span>
        <select className={styles.textInput} value={draft.district} onChange={(e) => onDistrict(e.target.value)}>
          <option value="">{tx("বাছাই করুন", "Select")}</option>
          {DISTRICTS.map((district) => (
            <option key={district.code} value={district.code}>{district.label[lang]}</option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{tx("আবেদনকারীর জাতীয় পরিচয়পত্র নম্বর (ঐচ্ছিক)", "Applicant's NID number (optional)")}</span>
        <input
          className={styles.textInput}
          inputMode="numeric"
          value={draft.nidNumber ?? ""}
          onChange={(e) => onNid(e.target.value)}
          placeholder={tx("১০, ১৩ বা ১৭ সংখ্যা", "10, 13 or 17 digits")}
        />
        <span className={styles.micLabelMuted}>
          {tx("জেলা লিগ্যাল এইড অফিসার মূল পরিচয়পত্রের সঙ্গে এটি মিলিয়ে দেখবেন।", "The district legal aid officer will verify this against the original identity document.")}
        </span>
      </label>
    </section>
  );
}

function CitizenIdentityCheck({
  draft,
  onDistrict,
  onAddress,
  onNid,
  verified,
}: {
  draft: IntakeDraft;
  onDistrict: (v: string) => void;
  onAddress: (v: string) => void;
  onNid: (v: string) => void;
  verified: boolean;
}) {
  const { lang } = useI18n();
  const db = useDlasDb();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const phone = normalizePhone(draft.phone);
  const lastOtp = phone
    ? [...db.outbox].reverse().find((m) => m.kind === "SMS_OTP" && m.to === phone)
    : undefined;
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);

  function send() {
    const r = CitizenDoor.requestOtp(draft.phone);
    setMsg(r.ok ? tx("কোড পাঠানো হয়েছে", "Code sent") : tx("সঠিক ১১ সংখ্যার নম্বর দিন (01…)", "Enter a valid 11-digit number (01…)"));
  }
  function verify() {
    const r = CitizenDoor.verifyOtp(code);
    setMsg(
      r.ok
        ? tx("নম্বর যাচাই হয়েছে", "Number verified")
        : r.error === "WRONG_CODE"
          ? tx(`ভুল কোড — আর ${r.attemptsLeft} বার`, `Wrong code — ${r.attemptsLeft} attempts left`)
          : tx("আগে কোড পাঠান", "Send a code first"),
    );
  }

  return (
    <section className={styles.stepCard} aria-label={tx("যাচাই ও জেলা", "Verification and district")}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{tx("আপনার জেলা", "Your district")}</span>
        <select className={styles.textInput} value={draft.district} onChange={(e) => onDistrict(e.target.value)}>
          <option value="">{tx("বাছাই করুন", "Select")}</option>
          {DISTRICTS.map((d) => (
            <option key={d.code} value={d.code}>
              {d.label[lang]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          {draft.actingFor === "family" || draft.actingFor === "neighbor" || draft.actingFor === "alleged"
            ? tx("আবেদনকারীর বিস্তারিত ঠিকানা", "Applicant's detailed address")
            : tx("আপনার বিস্তারিত ঠিকানা", "Your detailed address")}
        </span>
        <textarea
          className={styles.textarea}
          rows={3}
          value={draft.applicantAddress}
          onChange={(e) => onAddress(e.target.value)}
          placeholder={tx("বাড়ি/হোল্ডিং, রাস্তা, গ্রাম/এলাকা, ডাকঘর ও উপজেলা", "House/holding, road, village/area, post office and upazila")}
          autoComplete="street-address"
        />
        <span className={styles.micLabelMuted}>
          {tx("নির্বাচিত জেলার ভেতরের যতটুকু বিস্তারিত ঠিকানা জানেন লিখুন।", "Enter as much of the address as you know within the selected district.")}
        </span>
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          {draft.actingFor === "family" || draft.actingFor === "neighbor" || draft.actingFor === "alleged"
            ? tx("আবেদনকারীর জাতীয় পরিচয়পত্র নম্বর (ঐচ্ছিক)", "Applicant's NID number (optional)")
            : tx("জাতীয় পরিচয়পত্র নম্বর (ঐচ্ছিক)", "NID number (optional)")}
        </span>
        <input
          className={styles.textInput}
          inputMode="numeric"
          value={draft.nidNumber ?? ""}
          onChange={(e) => onNid(e.target.value)}
          placeholder={tx("১০, ১৩ বা ১৭ সংখ্যা", "10, 13 or 17 digits")}
        />
        <span className={styles.micLabelMuted}>
          {tx("জেলা লিগ্যাল এইড অফিসার এটি আপনার এনআইডি কার্ডের সাথে মিলিয়ে দেখবেন। না থাকলে ফাঁকা রাখুন।", "The legal aid officer will check it against your NID card. Leave empty if you don't have it.")}
        </span>
      </label>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>
          {tx("মোবাইল নম্বর যাচাই (ওটিপি)", "Verify mobile number (OTP)")} {verified ? "✓" : ""}
        </span>
        {verified ? (
          <span className={styles.micLabelMuted}>{tx(`${phone} যাচাইকৃত`, `${phone} verified`)}</span>
        ) : (
          <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="secondary" type="button" onClick={send} disabled={!phone}>
              {tx("কোড পাঠান", "Send code")}
            </Button>
            <input
              className={styles.textInput}
              style={{ maxWidth: 160 }}
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••"
              aria-label={tx("৬ সংখ্যার কোড", "6-digit code")}
            />
            <Button type="button" onClick={verify} disabled={code.trim().length !== 6}>
              {tx("যাচাই", "Verify")}
            </Button>
          </div>
        )}
        {msg ? <span className={styles.micLabelMuted}>{msg}</span> : null}
        {lastOtp && !verified ? (
          <span className={styles.micLabelMuted}>
            [{tx("সিমুলেটেড এসএমএস", "Simulated SMS")} → {lastOtp.to}] {lastOtp.body}
          </span>
        ) : null}
      </div>
    </section>
  );
}
