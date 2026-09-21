"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/button";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  HelpingHand,
  Lock,
  Mic,
  MicOff,
  Moon,
  Shield,
  User,
  Users,
} from "@/components/icons";
import { useI18n } from "@/lib/i18n";
import { useMockVoice, type VoiceStatus } from "@/lib/useMockVoice";
import { DESCRIPTIONS, NAMES, PHONES, pickRandom } from "@/lib/voice-demo";
import styles from "./complaint-modal.module.css";

/* ------------------------------------------------------------------ *
 *  Lodge-a-Complaint — 5-step citizen-friendly wizard.
 *
 *  Step 1 — Identity            (name + mobile, both voice-enabled)
 *  Step 2 — Acting For          (self / family / neighbour)
 *  Step 3 — Dispute             (6 selectable cards + voice description)
 *  Step 4 — Safe Contact Time   (4 time slots + special instructions)
 *  Step 5 — Final Consent       (voice OR typed verbatim phrase)
 *
 *  Right column holds a live preview card + a 3-point "how it works"
 *  card. After successful submit a calm success screen replaces the
 *  wizard with the reference number `G-YYYY-NNNN` and an "Apply again"
 *  reset button.
 *
 *  Voice input is fully mocked via `useMockVoice`: every microphone
 *  button transitions through idle → listening → processing → completed
 *  on timer chains and writes a Bangla filler into its target field.
 *  When real STT is plugged in later, replace `useMockVoice` with a
 *  real adapter — the call sites don't change.
 * ------------------------------------------------------------------ */

type Step = 1 | 2 | 3 | 4 | 5;

type ActingFor = "self" | "family" | "neighbor";

type DisputeKey =
  | "violence"
  | "maintenance"
  | "dowry"
  | "property"
  | "custody"
  | "other";

type ContactSlot = "friday_morning" | "while_at_work" | "evening" | "anytime";

const DISPUTE_KEYS: readonly DisputeKey[] = [
  "violence",
  "maintenance",
  "dowry",
  "property",
  "custody",
  "other",
];

const SLOT_KEYS: readonly ContactSlot[] = [
  "friday_morning",
  "while_at_work",
  "evening",
  "anytime",
];

type StepErrors = Partial<
  Record<
    | "name"
    | "phone"
    | "actingFor"
    | "proxyName"
    | "proxyRel"
    | "dispute"
    | "contactSlot"
    | "consent",
    string
  >
>;

function disputeTitleKey(k: DisputeKey): import("@/lib/i18n").MessageKey {
  switch (k) {
    case "violence":
      return "dispute1Title";
    case "maintenance":
      return "dispute2Title";
    case "dowry":
      return "dispute3Title";
    case "property":
      return "dispute4Title";
    case "custody":
      return "dispute5Title";
    case "other":
      return "dispute6Title";
  }
}

function disputeSubKey(k: DisputeKey): import("@/lib/i18n").MessageKey {
  switch (k) {
    case "violence":
      return "dispute1Sub";
    case "maintenance":
      return "dispute2Sub";
    case "dowry":
      return "dispute3Sub";
    case "property":
      return "dispute4Sub";
    case "custody":
      return "dispute5Sub";
    case "other":
      return "dispute6Sub";
  }
}

function disputeEyebrowKey(k: DisputeKey): import("@/lib/i18n").MessageKey {
  switch (k) {
    case "violence":
      return "dispute1Eyebrow";
    case "maintenance":
      return "dispute2Eyebrow";
    case "dowry":
      return "dispute3Eyebrow";
    case "property":
      return "dispute4Eyebrow";
    case "custody":
      return "dispute5Eyebrow";
    case "other":
      return "dispute6Eyebrow";
  }
}

function slotTitleKey(k: ContactSlot): import("@/lib/i18n").MessageKey {
  switch (k) {
    case "friday_morning":
      return "slot1Title";
    case "while_at_work":
      return "slot2Title";
    case "evening":
      return "slot3Title";
    case "anytime":
      return "slot4Title";
  }
}

function slotSubKey(k: ContactSlot): import("@/lib/i18n").MessageKey {
  switch (k) {
    case "friday_morning":
      return "slot1Sub";
    case "while_at_work":
      return "slot2Sub";
    case "evening":
      return "slot3Sub";
    case "anytime":
      return "slot4Sub";
  }
}

function SlotIcon({ k }: { k: ContactSlot }) {
  switch (k) {
    case "friday_morning":
      return <Calendar size={22} />;
    case "while_at_work":
      return <Lock size={22} />;
    case "evening":
      return <Moon size={22} />;
    case "anytime":
      return <Clock size={22} />;
  }
}

/* ------------------------------------------------------------------ *
 *  Reusable microphone button.
 *  Shared by every voice-enabled field so the listening animation,
 *  aria-pressed state, and label language stay perfectly in sync.
 * ------------------------------------------------------------------ */

function VoiceMicButton({
  status,
  onStart,
  ariaLabel,
  size = "lg",
}: {
  status: VoiceStatus;
  onStart: () => void;
  ariaLabel: string;
  size?: "lg" | "sm";
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
      data-size={size}
    >
      {/* Decorative concentric pulse rings — only visible while listening */}
      <span className={styles.micRing} aria-hidden />
      <span
        className={`${styles.micRing} ${styles.micRing2}`}
        aria-hidden
      />
      <span
        className={`${styles.micRing} ${styles.micRing3}`}
        aria-hidden
      />
      {completed ? <Check size={28} /> : listening ? <MicOff size={28} /> : <Mic size={28} />}
    </button>
  );
}

function VoiceStatusRow({ status }: { status: VoiceStatus }) {
  const { t } = useI18n();
  let label = t("voiceIdle");
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
    default:
      label = "";
  }
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
 *  Voice status meter that ticks while listening.
 *  Purely cosmetic — keeps the citizen engaged during the 1.2s "listen"
 *  window by counting up 00:01 → 00:04 in 100ms ticks.
 * ------------------------------------------------------------------ */

function ListeningMeter({ active }: { active: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) {
      // Parent unmounts the meter while idle, so no reset is needed.
      return;
    }
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [active]);
  if (!active) return null;
  const seconds = Math.min(4, Math.floor(tick / 4) + 1);
  return <span className={styles.voiceCounter}>{`00:0${seconds}`}</span>;
}

/* ------------------------------------------------------------------ *
 *  Top-level wizard.
 *  Mounted by <CitizenDashboard /> inside the `#complaint` section.
 * ------------------------------------------------------------------ */

export function ComplaintModal() {
  const { t } = useI18n();

  /* Wizard progression */
  const [step, setStep] = useState<Step>(1);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  /* Step 1 */
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  /* Step 2 */
  const [actingFor, setActingFor] = useState<ActingFor | null>(null);
  const [proxyRel, setProxyRel] = useState("");
  const [proxyName, setProxyName] = useState("");
  const [proxyPhone, setProxyPhone] = useState("");

  /* Step 3 */
  const [dispute, setDispute] = useState<DisputeKey | null>(null);
  const [description, setDescription] = useState("");

  /* Step 4 */
  const [contactSlot, setContactSlot] = useState<ContactSlot | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState("");

  /* Step 5 */
  const [consentText, setConsentText] = useState("");

  /* Voice state (4 hooks, one per voice-enabled field). The onComplete
   * callback writes the transcript into the matching field from inside
   * the mock STT timer — not from a React effect — so the
   * `react-hooks/set-state-in-effect` rule stays happy. */
  const nameVoice = useMockVoice(() => pickRandom(NAMES), {
    onComplete: (value) => setName(value),
  });
  const phoneVoice = useMockVoice(() => pickRandom(PHONES), {
    onComplete: (value) => setPhone(value),
  });
  const descVoice = useMockVoice(() => pickRandom(DESCRIPTIONS), {
    onComplete: (value) => setDescription(value),
  });
  const consentVoice = useMockVoice(() => "", {
    onComplete: () => setConsentText(t("consentPhrase")),
  });

  /* Validation */
  const errors = useMemo<StepErrors>(() => validateStep(step, {
    name,
    phone,
    actingFor,
    proxyName,
    proxyRel,
    dispute,
    contactSlot,
    consentText,
  }, t), [
    step, name, phone, actingFor, proxyName, proxyRel, dispute, contactSlot,
    consentText, t,
  ]);

  /* Consent is valid when the typed phrase matches verbatim OR voice completed. */
  const consentOk =
    consentText.trim() === t("consentPhrase") ||
    consentVoice.status === "completed";

  /* Final-submit gating */
  const allValid = Object.keys(errors).length === 0;

  /* ---------------------------------------------------------------- *
   *  Navigation
   * ---------------------------------------------------------------- */

  function handleNext() {
    if (!allValid) return;
    if (step < 5) setStep(((step + 1) as Step));
  }

  function handleBack() {
    if (step > 1) setStep(((step - 1) as Step));
  }

  function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!allValid) return;
    const now = new Date();
    const year = now.getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    setSubmittedRef(`G-${year}-${random}`);
  }

  function handleReset() {
    setStep(1);
    setName("");
    setPhone("");
    setActingFor(null);
    setProxyRel("");
    setProxyName("");
    setProxyPhone("");
    setDispute(null);
    setDescription("");
    setContactSlot(null);
    setSpecialInstructions("");
    setConsentText("");
    setSubmittedRef(null);
  }

  /* ---------------------------------------------------------------- *
   *  Render
   * ---------------------------------------------------------------- */

  if (submittedRef) {
    return <SuccessView refNumber={submittedRef} onAnother={handleReset} />;
  }

  return (
    <div className={styles.workspace}>
      <StepProgress current={step} onJump={(target) => setStep(target)} />

      <div className={styles.layout}>
        <form className={styles.main} onSubmit={handleSubmit} noValidate>
          {step === 1 ? (
            <Step1Identity
              name={name}
              onName={setName}
              nameStatus={nameVoice.status}
              onNameVoice={nameVoice.start}
              phone={phone}
              onPhone={setPhone}
              phoneStatus={phoneVoice.status}
              onPhoneVoice={phoneVoice.start}
              errors={errors}
            />
          ) : null}

          {step === 2 ? (
            <Step2ActingFor
              actingFor={actingFor}
              onActingFor={setActingFor}
              proxyRel={proxyRel}
              onProxyRel={setProxyRel}
              proxyName={proxyName}
              onProxyName={setProxyName}
              proxyPhone={proxyPhone}
              onProxyPhone={setProxyPhone}
              errors={errors}
            />
          ) : null}

          {step === 3 ? (
            <Step3Dispute
              dispute={dispute}
              onDispute={setDispute}
              description={description}
              onDescription={setDescription}
              descStatus={descVoice.status}
              onDescVoice={descVoice.start}
              errors={errors}
            />
          ) : null}

          {step === 4 ? (
            <Step4ContactTime
              contactSlot={contactSlot}
              onContactSlot={setContactSlot}
              specialInstructions={specialInstructions}
              onSpecialInstructions={setSpecialInstructions}
              errors={errors}
            />
          ) : null}

          {step === 5 ? (
            <Step5Consent
              consentText={consentText}
              onConsentText={setConsentText}
              consentStatus={consentVoice.status}
              onConsentVoice={consentVoice.start}
              consentOk={consentOk}
              errors={errors}
              applicantLabel={
                actingFor === "family" && proxyName ? proxyName : name
              }
              consentMeterActive={consentVoice.status === "listening"}
            />
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
          <SidePreview
            name={actingFor === "family" && proxyName ? proxyName : name}
            dispute={dispute}
            actingFor={actingFor}
            phone={actingFor === "family" && proxyPhone ? proxyPhone : phone}
            contactSlot={contactSlot}
            consentOk={consentOk}
          />
          <HowItWorks />
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Step progress strip.
 *  Sticky at the top of the workspace; circles + connectors reflect
 *  completion state for each step. Clicking a circle jumps back to that
 *  step in the wizard.
 * ------------------------------------------------------------------ */

const STEPS: { id: Step; key: import("@/lib/i18n").MessageKey }[] = [
  { id: 1, key: "progress1" },
  { id: 2, key: "progress2" },
  { id: 3, key: "progress3" },
  { id: 4, key: "progress4" },
  { id: 5, key: "progress5" },
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
          {t("stepLabel")} {current} {t("stepOf")}
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
 *  Step 1 — Identity.
 * ------------------------------------------------------------------ */

function Step1Identity({
  name,
  onName,
  nameStatus,
  onNameVoice,
  phone,
  onPhone,
  phoneStatus,
  onPhoneVoice,
  errors,
}: {
  name: string;
  onName: (v: string) => void;
  nameStatus: VoiceStatus;
  onNameVoice: () => void;
  phone: string;
  onPhone: (v: string) => void;
  phoneStatus: VoiceStatus;
  onPhoneVoice: () => void;
  errors: StepErrors;
}) {
  const { t } = useI18n();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (errors.name) nameRef.current?.focus();
    else if (errors.phone) phoneRef.current?.focus();
  }, [errors.name, errors.phone]);

  return (
    <section className={styles.stepCard} aria-labelledby="s1-title">
      <span className={styles.stepBadge}>০১ · {t("s1Headline")}</span>
      <h2 id="s1-title" className={styles.stepTitle}>
        {t("s1Headline")}
      </h2>
      <p className={styles.stepSubtitle}>{t("s1Sub")}</p>

      {/* Name — voice + text */}
      <div className={styles.voiceBlock}>
        <VoiceMicButton
          status={nameStatus}
          onStart={onNameVoice}
          ariaLabel={t("voiceMicName")}
        />
        <div>
          <p className={styles.micLabel}>{t("voiceMicName")}</p>
          <p className={styles.micLabelMuted}>{t("voiceSavedHint")}</p>
        </div>
        <VoiceStatusRow status={nameStatus} />
        <ListeningMeter active={nameStatus === "listening"} />
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t("nameLabel")}</span>
        <input
          ref={nameRef}
          className={styles.textInput}
          type="text"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={t("namePlaceholder")}
          autoComplete="name"
        />
        {errors.name ? (
          <span className={styles.fieldError} role="alert">
            {errors.name}
          </span>
        ) : null}
      </label>

      {/* Phone — voice + text */}
      <div className={styles.voiceBlock}>
        <VoiceMicButton
          status={phoneStatus}
          onStart={onPhoneVoice}
          ariaLabel={t("voiceMicPhone")}
        />
        <div>
          <p className={styles.micLabel}>{t("voiceMicPhone")}</p>
          <p className={styles.micLabelMuted}>{t("voiceSavedHint")}</p>
        </div>
        <VoiceStatusRow status={phoneStatus} />
        <ListeningMeter active={phoneStatus === "listening"} />
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t("phoneLabel")}</span>
        <input
          ref={phoneRef}
          className={styles.textInput}
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => onPhone(e.target.value)}
          placeholder={t("phonePlaceholder")}
          autoComplete="tel"
        />
        {errors.phone ? (
          <span className={styles.fieldError} role="alert">
            {errors.phone}
          </span>
        ) : null}
      </label>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  Step 2 — Acting For.
 * ------------------------------------------------------------------ */

function Step2ActingFor({
  actingFor,
  onActingFor,
  proxyRel,
  onProxyRel,
  proxyName,
  onProxyName,
  proxyPhone,
  onProxyPhone,
  errors,
}: {
  actingFor: ActingFor | null;
  onActingFor: (v: ActingFor) => void;
  proxyRel: string;
  onProxyRel: (v: string) => void;
  proxyName: string;
  onProxyName: (v: string) => void;
  proxyPhone: string;
  onProxyPhone: (v: string) => void;
  errors: StepErrors;
}) {
  const { t } = useI18n();
  const proxyNameRef = useRef<HTMLInputElement | null>(null);
  const proxyRelRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (errors.proxyName) proxyNameRef.current?.focus();
    else if (errors.proxyRel) proxyRelRef.current?.focus();
  }, [errors.proxyName, errors.proxyRel]);

  const cards: {
    key: ActingFor;
    titleKey: import("@/lib/i18n").MessageKey;
    subKey: import("@/lib/i18n").MessageKey;
    icon: React.ReactNode;
  }[] = [
    { key: "self", titleKey: "actingSelfTitle", subKey: "actingSelfSub", icon: <User size={20} /> },
    { key: "family", titleKey: "actingFamilyTitle", subKey: "actingFamilySub", icon: <Users size={20} /> },
    { key: "neighbor", titleKey: "actingNeighborTitle", subKey: "actingNeighborSub", icon: <HelpingHand size={20} /> },
  ];

  return (
    <section className={styles.stepCard} aria-labelledby="s2-title">
      <span className={styles.stepBadge}>০২ · {t("s2Headline")}</span>
      <h2 id="s2-title" className={styles.stepTitle}>
        {t("s2Headline")}
      </h2>
      <p className={styles.stepQuestion}>{t("s2Question")}</p>
      <p className={styles.stepSubtitle}>{t("s2Sub")}</p>

      <div className={styles.selectCardGrid} role="radiogroup" aria-label={t("s2Question")}>
        {cards.map((card) => {
          const active = actingFor === card.key;
          return (
            <button
              key={card.key}
              type="button"
              role="radio"
              aria-checked={active}
              className={`${styles.selectCard} ${active ? styles.selectCardActive : ""}`}
              onClick={() => onActingFor(card.key)}
            >
              <span className={styles.selectCardIcon} aria-hidden>
                {card.icon}
              </span>
              <p className={styles.selectCardTitle}>{t(card.titleKey)}</p>
              <p className={styles.selectCardSub}>{t(card.subKey)}</p>
              <span className={styles.selectCardCheck} aria-hidden>
                <Check size={14} />
              </span>
            </button>
          );
        })}
      </div>

      {errors.actingFor ? (
        <span className={styles.fieldError} role="alert">
          {errors.actingFor}
        </span>
      ) : null}

      {actingFor === "family" ? (
        <div className={styles.proxyDisclosure}>
          <p className={styles.proxyTitle}>{t("actingFamilyTitle")}</p>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("proxyRelLabel")}</span>
            <input
              ref={proxyRelRef}
              className={styles.textInput}
              type="text"
              value={proxyRel}
              onChange={(e) => onProxyRel(e.target.value)}
              placeholder={t("proxyRelPlaceholder")}
            />
            {errors.proxyRel ? (
              <span className={styles.fieldError} role="alert">
                {errors.proxyRel}
              </span>
            ) : null}
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("proxyNameLabel")}</span>
            <input
              ref={proxyNameRef}
              className={styles.textInput}
              type="text"
              value={proxyName}
              onChange={(e) => onProxyName(e.target.value)}
              placeholder={t("proxyNamePlaceholder")}
            />
            {errors.proxyName ? (
              <span className={styles.fieldError} role="alert">
                {errors.proxyName}
              </span>
            ) : null}
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("proxyPhoneLabel")}</span>
            <input
              className={styles.textInput}
              type="tel"
              inputMode="tel"
              value={proxyPhone}
              onChange={(e) => onProxyPhone(e.target.value)}
              placeholder={t("proxyPhonePlaceholder")}
            />
          </label>

          <p className={styles.consentLegal}>{t("proxySafety")}</p>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  Step 3 — Dispute.
 * ------------------------------------------------------------------ */

function Step3Dispute({
  dispute,
  onDispute,
  description,
  onDescription,
  descStatus,
  onDescVoice,
  errors,
}: {
  dispute: DisputeKey | null;
  onDispute: (v: DisputeKey) => void;
  description: string;
  onDescription: (v: string) => void;
  descStatus: VoiceStatus;
  onDescVoice: () => void;
  errors: StepErrors;
}) {
  const { t } = useI18n();
  const descRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (errors.dispute) {
      // No native focus target; the wizard jumps to the first card.
    }
  }, [errors.dispute]);

  return (
    <section className={styles.stepCard} aria-labelledby="s3-title">
      <span className={styles.stepBadge}>০৩ · {t("s3Headline")}</span>
      <h2 id="s3-title" className={styles.stepTitle}>
        {t("s3Headline")}
      </h2>
      <p className={styles.stepQuestion}>{t("s3Question")}</p>
      <p className={styles.stepSubtitle}>{t("s3Sub")}</p>

      <div className={styles.selectCardGrid} role="radiogroup" aria-label={t("s3Question")}>
        {DISPUTE_KEYS.map((key) => {
          const active = dispute === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              className={`${styles.selectCard} ${active ? styles.selectCardActive : ""}`}
              onClick={() => onDispute(key)}
            >
              <p className={styles.selectCardEyebrow}>
                {t(disputeEyebrowKey(key))}
              </p>
              <span className={styles.selectCardTitle}>{t(disputeTitleKey(key))}</span>
              <p className={styles.selectCardSub}>{t(disputeSubKey(key))}</p>
              <span className={styles.selectCardCheck} aria-hidden>
                <Check size={14} />
              </span>
            </button>
          );
        })}
      </div>

      {errors.dispute ? (
        <span className={styles.fieldError} role="alert">
          {errors.dispute}
        </span>
      ) : null}

      <div className={styles.voiceBlock}>
        <VoiceMicButton
          status={descStatus}
          onStart={onDescVoice}
          ariaLabel={t("voiceMicDescription")}
        />
        <div>
          <p className={styles.micLabel}>{t("voiceMicDescription")}</p>
          <p className={styles.micLabelMuted}>{t("descVoiceNoteAdded")}</p>
        </div>
        <VoiceStatusRow status={descStatus} />
        <ListeningMeter active={descStatus === "listening"} />
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t("descLabel")}</span>
        <textarea
          ref={descRef}
          className={styles.textarea}
          rows={5}
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          placeholder={t("descPlaceholder")}
        />
      </label>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  Step 4 — Safe Contact Time.
 * ------------------------------------------------------------------ */

function Step4ContactTime({
  contactSlot,
  onContactSlot,
  specialInstructions,
  onSpecialInstructions,
  errors,
}: {
  contactSlot: ContactSlot | null;
  onContactSlot: (v: ContactSlot) => void;
  specialInstructions: string;
  onSpecialInstructions: (v: string) => void;
  errors: StepErrors;
}) {
  const { t } = useI18n();

  return (
    <section className={styles.stepCard} aria-labelledby="s4-title">
      <span className={styles.stepBadge}>০৪ · {t("s4Headline")}</span>
      <h2 id="s4-title" className={styles.stepTitle}>
        {t("s4Headline")}
      </h2>
      <p className={styles.stepSubtitle}>{t("s4Sub")}</p>

      <div className={styles.agreementBox}>
        <Shield size={24} />
        <div>
          <p className={styles.agreementTitle}>{t("stepLabel")}</p>
          <p className={styles.agreementBody}>{t("s4Promise")}</p>
        </div>
      </div>

      <div className={styles.selectCardGridTight} role="radiogroup" aria-label={t("s4Headline")}>
        {SLOT_KEYS.map((key) => {
          const active = contactSlot === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              className={`${styles.selectCard} ${active ? styles.selectCardActive : ""}`}
              onClick={() => onContactSlot(key)}
            >
              <span className={styles.selectCardIcon} aria-hidden>
                <SlotIcon k={key} />
              </span>
              <p className={styles.selectCardTitle}>{t(slotTitleKey(key))}</p>
              <p className={styles.selectCardSub}>{t(slotSubKey(key))}</p>
              <span className={styles.selectCardCheck} aria-hidden>
                <Check size={14} />
              </span>
            </button>
          );
        })}
      </div>

      {errors.contactSlot ? (
        <span className={styles.fieldError} role="alert">
          {errors.contactSlot}
        </span>
      ) : null}

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{t("specialInstrLabel")}</span>
        <textarea
          className={styles.textarea}
          rows={3}
          value={specialInstructions}
          onChange={(e) => onSpecialInstructions(e.target.value)}
          placeholder={t("specialInstrPlaceholder")}
        />
      </label>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  Step 5 — Final Consent.
 * ------------------------------------------------------------------ */

function Step5Consent({
  consentText,
  onConsentText,
  consentStatus,
  onConsentVoice,
  consentOk,
  errors,
  applicantLabel,
  consentMeterActive,
}: {
  consentText: string;
  onConsentText: (v: string) => void;
  consentStatus: VoiceStatus;
  onConsentVoice: () => void;
  consentOk: boolean;
  errors: StepErrors;
  applicantLabel: string;
  consentMeterActive: boolean;
}) {
  const { t } = useI18n();

  return (
    <section className={styles.stepCard} aria-labelledby="s5-title">
      <span className={styles.stepBadge}>০৫ · {t("s5Headline")}</span>
      <h2 id="s5-title" className={styles.stepTitle}>
        {t("s5Headline")}
      </h2>
      <p className={styles.stepSubtitle}>{t("s5Sub")}</p>

      <ReviewSummary applicantLabel={applicantLabel} />

      <p className={styles.stepQuestion}>{t("s5Confirm")}</p>

      <div className={styles.consentGrid}>
        <div className={styles.consentCard}>
          <p className={styles.consentCardTitle}>{t("consentStep1Title")}</p>
          <p className={styles.consentCardHint}>{t("consentStep1VoiceLabel")}</p>

          <div className={styles.voiceBlock}>
            <VoiceMicButton
              status={consentStatus}
              onStart={onConsentVoice}
              ariaLabel={t("voiceMicConsent")}
            />
            <div>
              <p className={styles.micLabel}>{t("voiceMicConsent")}</p>
              <p className={styles.micLabelMuted}>{t("voiceSavedHint")}</p>
            </div>
            <VoiceStatusRow status={consentStatus} />
            <ListeningMeter active={consentMeterActive} />
          </div>
        </div>

        <div className={styles.consentCard}>
          <p className={styles.consentCardTitle}>{t("consentStep2Title")}</p>
          <textarea
            className={styles.textarea}
            rows={4}
            value={consentText}
            onChange={(e) => onConsentText(e.target.value)}
            placeholder={t("consentPhrase")}
          />
          <div className={styles.consentConfirmRow}>
            <span
              className={styles.consentPill}
              data-active={consentOk ? "true" : "false"}
            >
              <Check size={14} />
              {t("consentConfirmBtn")}
            </span>
          </div>
        </div>
      </div>

      {errors.consent ? (
        <span className={styles.fieldError} role="alert">
          {errors.consent}
        </span>
      ) : null}

      <p className={styles.consentLegal}>{t("consentLegal")}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  Review summary card inside Step 5.
 * ------------------------------------------------------------------ */

function ReviewSummary({ applicantLabel }: { applicantLabel: string }) {
  const { t } = useI18n();
  return (
    <div className={styles.review}>
      <p className={styles.reviewHeading}>{t("reviewHeading")}</p>
      <div className={styles.reviewRow}>
        <span className={styles.reviewLabel}>{t("reviewApplicant")}</span>
        <span className={styles.reviewValue}>{applicantLabel || "—"}</span>
      </div>
      <div className={styles.reviewRow}>
        <span className={styles.reviewLabel}>{t("reviewOfficeName")}</span>
        <span className={styles.reviewValue}>{t("reviewOfficeName")}</span>
      </div>
    </div>
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
 *  Right column — live preview + how-it-works.
 * ------------------------------------------------------------------ */

function SidePreview({
  name,
  dispute,
  actingFor,
  phone,
  contactSlot,
  consentOk,
}: {
  name: string;
  dispute: DisputeKey | null;
  actingFor: ActingFor | null;
  phone: string;
  contactSlot: ContactSlot | null;
  consentOk: boolean;
}) {
  const { t } = useI18n();
  const allEmpty =
    !name && !dispute && !actingFor && !phone && !contactSlot;

  const actingForLabel = actingFor === "self"
    ? t("actingSelfTitle")
    : actingFor === "family"
      ? t("actingFamilyTitle")
      : actingFor === "neighbor"
        ? t("actingNeighborTitle")
        : null;

  return (
    <div className={styles.previewCard} aria-live="polite">
      <p className={styles.previewEyebrow}>{t("previewHeading")}</p>

      {allEmpty ? (
        <p className={styles.previewEmpty}>{t("previewEmpty")}</p>
      ) : (
        <dl className={styles.previewRows}>
          <div className={styles.previewRow}>
            <dt className={styles.previewLabel}>{t("previewApplicant")}</dt>
            <dd className={styles.previewValue}>{name || "—"}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt className={styles.previewLabel}>{t("previewActingFor")}</dt>
            <dd className={styles.previewValue}>{actingForLabel || "—"}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt className={styles.previewLabel}>{t("previewDispute")}</dt>
            <dd className={styles.previewValue}>
              {dispute ? t(disputeTitleKey(dispute)) : "—"}
            </dd>
          </div>
          <div className={styles.previewRow}>
            <dt className={styles.previewLabel}>{t("phoneLabel")}</dt>
            <dd className={styles.previewValue}>{phone || "—"}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt className={styles.previewLabel}>{t("previewContactSlot")}</dt>
            <dd className={styles.previewValue}>
              {contactSlot ? t(slotTitleKey(contactSlot)) : "—"}
            </dd>
          </div>
          <div className={styles.previewRow}>
            <dt className={styles.previewLabel}>{t("previewConsent")}</dt>
            <dd className={styles.previewValue}>
              {consentOk ? t("voiceDone") : "—"}
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
      <p className={styles.howHeading}>{t("complaintHelpTitle")}</p>
      <ol className={styles.howList}>
        <li className={styles.howItem}>
          <span className={styles.howNum}>1</span>
          <div className={styles.howBody}>
            <span className={styles.howItemTitle}>{t("help1Title")}</span>
            <span className={styles.howItemBody}>{t("help1Body")}</span>
          </div>
        </li>
        <li className={styles.howItem}>
          <span className={styles.howNum}>2</span>
          <div className={styles.howBody}>
            <span className={styles.howItemTitle}>{t("help2Title")}</span>
            <span className={styles.howItemBody}>{t("help2Body")}</span>
          </div>
        </li>
        <li className={styles.howItem}>
          <span className={styles.howNum}>3</span>
          <div className={styles.howBody}>
            <span className={styles.howItemTitle}>{t("help3Title")}</span>
            <span className={styles.howItemBody}>{t("help3Body")}</span>
          </div>
        </li>
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Success view (after submit).
 * ------------------------------------------------------------------ */

function SuccessView({
  refNumber,
  onAnother,
}: {
  refNumber: string;
  onAnother: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.successWrap} role="status" aria-live="polite">
      <span className={styles.successBadge}>{t("complaintReference")}</span>
      <p className={styles.successRef}>
        <span className={styles.successRefNumber}>{refNumber}</span>
      </p>

      <h2 className={styles.successTitle}>{t("successTitle")}</h2>
      <p className={styles.successBody}>{t("successBody")}</p>

      <ul className={styles.successList}>
        <li>
          <Check size={20} />
          {t("successNext1")}
        </li>
        <li>
          <Check size={20} />
          {t("successNext2")}
        </li>
        <li>
          <Check size={20} />
          {t("successNext3")}
        </li>
      </ul>

      <Button onClick={onAnother}>{t("applyAgainBtn")}</Button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Per-step validation. Returns bn-friendly error messages keyed by
 *  field. The wizard disables Next/Submit while the map is non-empty.
 * ------------------------------------------------------------------ */

function validateStep(
  step: Step,
  state: {
    name: string;
    phone: string;
    actingFor: ActingFor | null;
    proxyName: string;
    proxyRel: string;
    dispute: DisputeKey | null;
    contactSlot: ContactSlot | null;
    consentText: string;
  },
  t: (k: import("@/lib/i18n").MessageKey) => string,
): StepErrors {
  const errors: StepErrors = {};
  if (step >= 1) {
    if (!state.name.trim()) errors.name = t("errName");
    if (!state.phone.trim()) errors.phone = t("errPhone");
  }
  if (step >= 2) {
    if (!state.actingFor) errors.actingFor = t("errActingFor");
    if (state.actingFor === "family") {
      if (!state.proxyName.trim()) errors.proxyName = t("errProxyName");
      if (!state.proxyRel.trim()) errors.proxyRel = t("errProxyRel");
    }
  }
  if (step >= 3) {
    if (!state.dispute) errors.dispute = t("errDispute");
  }
  if (step >= 4) {
    if (!state.contactSlot) errors.contactSlot = t("errContactSlot");
  }
  if (step >= 5) {
    if (state.consentText.trim() !== t("consentPhrase")) {
      errors.consent = t("errConsent");
    }
  }
  return errors;
}
