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
import { CitizenAuth, CitizenDoor, DAYS, DISTRICTS, normalizePhone, useDlasDb } from "@/lib/dlas";

/* ------------------------------------------------------------------ *
 *  Assisted Intake — 5-step wizard for starting a new case.
 *
 *  Step 1 — Identity           (name + mobile, voice-enabled)
 *  Step 2 — Matter             (6 selectable cards)
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

const MATTER_KEYS: readonly MatterCategory[] = [
  "family",
  "land",
  "civil",
  "criminal",
  "labour",
  "other",
];

const SLOT_KEYS: readonly ContactSlot[] = ["anytime", "custom"];

function matterTitleKey(k: MatterCategory): import("@/lib/i18n").MessageKey {
  switch (k) {
    case "family": return "intakeMatterFamily";
    case "land": return "intakeMatterLand";
    case "civil": return "intakeMatterCivil";
    case "criminal": return "intakeMatterCriminal";
    case "labour": return "intakeMatterLabour";
    case "other": return "intakeMatterOther";
  }
}

function matterEyebrowKey(k: MatterCategory): import("@/lib/i18n").MessageKey {
  switch (k) {
    case "family": return "intakeMatterFamilyEyebrow";
    case "land": return "intakeMatterLandEyebrow";
    case "civil": return "intakeMatterCivilEyebrow";
    case "criminal": return "intakeMatterCriminalEyebrow";
    case "labour": return "intakeMatterLabourEyebrow";
    case "other": return "intakeMatterOtherEyebrow";
  }
}

function matterSubKey(k: MatterCategory): import("@/lib/i18n").MessageKey {
  switch (k) {
    case "family": return "intakeMatterFamilySub";
    case "land": return "intakeMatterLandSub";
    case "civil": return "intakeMatterCivilSub";
    case "criminal": return "intakeMatterCriminalSub";
    case "labour": return "intakeMatterLabourSub";
    case "other": return "intakeMatterOtherSub";
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

export function AssistedIntake() {
  const { lang, t } = useI18n();

  const [step, setStep] = useState<Step>(1);
  /* Lazy initializers let us read from `localStorage` during render
     (only on the client) without firing the `set-state-in-effect`
     rule the project enforces. After mount we still listen for
     online/offline transitions and refresh the queue count. */
  const [draft, setDraft] = useState<IntakeDraft>(() => {
    const d = loadDraft() ?? emptyDraft();
    // The filer is the logged-in account: name + phone always come from it.
    // A draft saved by another account (or by the old demo voice samples)
    // is discarded rather than shown.
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
    return !saveDraft(loadDraft() ?? emptyDraft());
  });
  const [online, setOnline] = useState<boolean>(() => isOnline());
  const [pendingCount, setPendingCount] = useState<number>(() => loadPending().length);

  /* ------------------------------------------------------------- *
   *  Hydrate from `localStorage` on mount and listen for changes
   *  so the wizard survives a refresh mid-flow. This is also where
   *  the offline queue is counted for the offline banner.
   * ------------------------------------------------------------- */
  useEffect(() => {
    function onOnline() {
      setOnline(true);
      // Best-effort flush — see `lib/intake-store.ts` for the contract.
      syncPending()
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
  }, []);

  /* Persist after every draft change. We update `saveDraft` only when
     the field set actually changed to avoid hammering localStorage on
     re-renders, but the cheap path is fine here. */
  const lastSavedJsonRef = useRef<string | null>(null);
  useEffect(() => {
    if (submittedRef) return;
    const json = JSON.stringify(draft);
    if (json === lastSavedJsonRef.current) return;
    lastSavedJsonRef.current = json;
    const ok = saveDraft(draft);
    setStorageFull(!ok);
  }, [draft, submittedRef]);

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
  const citizenSession = CitizenDoor.current();
  void dlasDb;
  const phoneVerified =
    !!citizenSession?.identity.verified &&
    citizenSession.identity.phone === normalizePhone(draft.phone);
  const extraErrors = useMemo(() => {
    const e: string[] = [];
    if (step === 1 && !draft.district) e.push(lang === "bn" ? "জেলা বাছাই করুন" : "Choose your district");
    if (step === 1 && !phoneVerified) e.push(lang === "bn" ? "মোবাইল নম্বরটি কোড দিয়ে যাচাই করুন" : "Verify your mobile number with the code");
    if (step === 5 && !draft.contactSlot) e.push(lang === "bn" ? "নিরাপদ যোগাযোগের সময় বাছাই করুন" : "Choose a safe contact time");
    if (step === 5 && draft.contactSlot === "custom" && (!draft.contactDay || !draft.contactTime))
      e.push(lang === "bn" ? "যোগাযোগের দিন ও সময় লিখুন" : "Enter the contact day and time");
    return e;
  }, [step, draft.district, draft.contactSlot, draft.contactDay, draft.contactTime, phoneVerified, lang]);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const allValid = Object.keys(errors).length === 0 && extraErrors.length === 0;

  /* ------------------------------------------------------------- *
   *  Navigation handlers.
   * ------------------------------------------------------------- */
  function handleNext() {
    if (!allValid) return;
    try {
      CitizenDoor.sync(draft, draft.district, step);
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
      const r = await CitizenDoor.submit(draft, draft.district);
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
    });
    setPendingCount(queue.length);
    setSubmittedOffline(!wasOnline);
    setSubmittedRef(receipt);
    clearDraft();
    if (wasOnline) {
      // Best-effort flush right away.
      syncPending()
        .then(({ remaining }) => setPendingCount(remaining))
        .catch(() => {
          /* leave in queue */
        });
    }
  }

  function handleReset() {
    setStep(1);
    const acct = CitizenAuth.current();
    setDraft(acct ? { ...emptyDraft(), ownerId: acct.citizenId, name: acct.name, phone: acct.phone } : emptyDraft());
    setSubmittedRef(null);
    setSubmittedOffline(false);
    setStorageFull(false);
    setPendingCount(loadPending().length);
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
              <CitizenIdentityCheck
                draft={draft}
                onDistrict={(v) => setField("district", v)}
                verified={phoneVerified}
              />
            </>
          ) : null}

          {step === 2 ? (
            <Step2Matter
              draft={draft}
              onMatter={(m) => setField("matter", m)}
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
                draft.actingFor === "family" && draft.proxyName
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
          <SidePreview draft={draft} />
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

      {draft.actingFor === "family" || draft.actingFor === "neighbor" ? (
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
 *  Step 2 — Matter (6 category cards).
 * ------------------------------------------------------------------ */

function Step2Matter({
  draft,
  onMatter,
  errors,
}: {
  draft: IntakeDraft;
  onMatter: (m: MatterCategory) => void;
  errors: StepErrors;
}) {
  const { t } = useI18n();
  return (
    <section className={styles.stepCard} aria-labelledby="ai-s2-title">
      <span className={styles.stepBadge}>০২ · {t("intakeStep2Headline")}</span>
      <h2 id="ai-s2-title" className={styles.stepTitle}>
        {t("intakeStep2Headline")}
      </h2>
      <p className={styles.stepQuestion}>{t("intakeStep2Question")}</p>
      <p className={styles.stepSubtitle}>{t("intakeStep2Sub")}</p>

      <div
        className={styles.matterGrid}
        role="radiogroup"
        aria-label={t("intakeStep2Question")}
      >
        {MATTER_KEYS.map((key) => {
          const active = draft.matter === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              className={`${styles.matterCard} ${active ? styles.matterCardActive : ""}`}
              onClick={() => onMatter(key)}
            >
              <p className={styles.matterEyebrow}>
                {t(matterEyebrowKey(key))}
              </p>
              <p className={styles.matterTitle}>
                {t(matterTitleKey(key))}
              </p>
              <p className={styles.matterSub}>
                {t(matterSubKey(key))}
              </p>
              <span className={styles.matterCheck} aria-hidden>
                <Check size={14} />
              </span>
            </button>
          );
        })}
      </div>
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
  const { t } = useI18n();
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
    </section>
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
}: {
  draft: IntakeDraft;
  onAdd: (doc: IntakeDocument) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useI18n();
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
          {draft.documents.map((doc) => (
            <li key={doc.id} className={styles.docRow}>
              <span className={styles.docIcon} aria-hidden>
                <FileText size={20} />
              </span>
              <span className={styles.docMeta}>
                <span className={styles.docName}>{doc.name}</span>
                <span className={styles.docSize}>
                  {t("intakeDocsFileSize")}: {formatBytes(doc.size)}
                </span>
              </span>
              <button
                type="button"
                className={styles.docRemove}
                onClick={() => onRemove(doc.id)}
                aria-label={`${t("intakeDocsRemoveBtn")} — ${doc.name}`}
              >
                <X size={16} />
                {t("intakeDocsRemoveBtn")}
              </button>
            </li>
          ))}
        </ul>
      )}
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

function SidePreview({ draft }: { draft: IntakeDraft }) {
  const { t, lang } = useI18n();
  const matterLabel = draft.matter ? t(matterTitleKey(draft.matter)) : null;
  const slotLabel = slotSummary(draft, t, lang);
  const applicantLabel =
    draft.actingFor === "family" && draft.proxyName
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
                ? `${draft.documents.length} ${t("intakePreviewDocs").toLowerCase()}`
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
}: {
  refNumber: string;
  offline: boolean;
  onAnother: () => void;
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
      {refNumber.startsWith("APP-") ? (
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

function CitizenIdentityCheck({
  draft,
  onDistrict,
  verified,
}: {
  draft: IntakeDraft;
  onDistrict: (v: string) => void;
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
