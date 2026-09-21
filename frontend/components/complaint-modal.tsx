"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import styles from "./complaint-modal.module.css";

type Reason = "not_responding" | "asked_payment" | "other";
type Contact = "16699" | "this_phone" | "none";

const ACTIVE_CASE = {
  id: "SHK-DEMO-007",
  titleBn: "রহিমা বেগম বনাম মোহাম্মদ আলী",
  titleEn: "Rahima Begum v. Mohammad Ali",
};

/**
 * Citizen grievance section — PRD-aligned.
 *
 * Per docs/PRD/PRD.md §580 the grievance flow must cover
 * "asked for payment" and "lawyer not responding" with a thin
 * REGISTERED → INVESTIGATING → RESOLVED → CLOSED path.
 *
 * Per docs/PRD/PRD.md §572 grievance must remain thin and not
 * displace mandatory scope. We collect:
 *   - reason (3 options including "other")
 *   - who will see (auto-disclosed per reason; switches when anonymous)
 *   - safe-contact channel (drawn from the citizen's safe-contact policy)
 *   - linked case (when not anonymous)
 *   - approximate date of incident (optional)
 *   - free-text message
 *   - explicit consent
 *
 * Prototype-only: no backend mutation, no audit event. Reference
 * number is local-state-only.
 *
 * Rendered as an in-page section, matching the pattern of the other
 * citizen tabs — one panel under the tab strip, never a modal.
 */
export function ComplaintModal() {
  const { t, lang } = useI18n();
  const [anonymous, setAnonymous] = useState(false);
  const [reason, setReason] = useState<Reason>("not_responding");
  const [otherText, setOtherText] = useState("");
  const [contact, setContact] = useState<Contact>("16699");
  const [whenDate, setWhenDate] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const firstFieldRef = useRef<HTMLInputElement>(null);

  const reasonLabels: Record<Reason, string> = useMemo(
    () => ({
      not_responding: t("complaintReasonNotResponding"),
      asked_payment: t("complaintReasonAskedPayment"),
      other: t("complaintReasonOther"),
    }),
    [t],
  );

  // Who sees the complaint depends on reason AND anonymity.
  // - "asked payment" / "other" → District Legal Aid Officer (financial misconduct)
  // - "lawyer not responding"   → Panel Lawyer Manager (panel accountability)
  // - anonymous                  → Anonymous Review Panel (decoupled from citizen's identity)
  const whoSeesLabel = useMemo(() => {
    if (anonymous) return t("complaintWhoSeesAnonymousPool");
    if (reason === "not_responding") return t("complaintWhoSeesManager");
    return t("complaintWhoSeesOfficer");
  }, [anonymous, reason, t]);

  const showLinkedCase = !anonymous;
  const showContactField = !anonymous;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const now = new Date();
    const year = now.getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    setSubmittedRef(`G-${year}-${random}`);
  }

  function handleReset() {
    setAnonymous(false);
    setReason("not_responding");
    setOtherText("");
    setContact("16699");
    setWhenDate("");
    setMessage("");
    setConsent(false);
    setSubmittedRef(null);
    firstFieldRef.current?.focus();
  }

  const caseTitle = lang === "bn" ? ACTIVE_CASE.titleBn : ACTIVE_CASE.titleEn;

  return (
    <div className={styles.section}>
      {submittedRef ? (
        <SuccessView
          refNumber={submittedRef}
          anonymous={anonymous}
          linkedCaseId={showLinkedCase ? ACTIVE_CASE.id : null}
          caseTitle={caseTitle}
          onAnother={handleReset}
        />
      ) : (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <header className={styles.header}>
            <h2 className={styles.title}>{t("complaintTitle")}</h2>
            <p className={styles.intro}>{t("complaintIntro")}</p>
          </header>

          {/* Anonymous toggle — top of form so the citizen sees it before
              they enter anything sensitive. */}
          <label className={styles.anonymousToggle}>
            <input
              ref={firstFieldRef}
              type="checkbox"
              className={styles.anonymousCheckbox}
              checked={anonymous}
              onChange={(event) => setAnonymous(event.target.checked)}
            />
            <span className={styles.anonymousBody}>
              <strong className={styles.anonymousLabel}>
                {t("complaintAnonymous")}
              </strong>
              <span className={styles.anonymousHint}>
                {t("complaintAnonymousHint")}
              </span>
            </span>
          </label>

          {/* Who will see this — auto-disclosed per reason + anonymous flag */}
          <aside className={styles.whoSees} aria-live="polite">
            <span className={styles.whoSeesLabel}>{t("complaintWhoSees")}</span>
            <strong className={styles.whoSeesValue}>{whoSeesLabel}</strong>
          </aside>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>
              {t("complaintReasonLabel")}
            </legend>
            {(Object.keys(reasonLabels) as Reason[]).map((value) => (
              <label key={value} className={styles.radio}>
                <input
                  type="radio"
                  name="complaint-reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                  required
                />
                <span>{reasonLabels[value]}</span>
              </label>
            ))}
            {reason === "other" ? (
              <input
                className={styles.otherInput}
                type="text"
                required
                placeholder={t("complaintOtherPlaceholder")}
                value={otherText}
                onChange={(event) => setOtherText(event.target.value)}
              />
            ) : null}
          </fieldset>

          {showLinkedCase ? (
            <div className={styles.linkedCase} aria-live="polite">
              <span className={styles.fieldLabel}>
                {t("complaintLinkedCaseLabel")}
              </span>
              <span className={styles.linkedCaseValue}>
                <strong>{ACTIVE_CASE.id}</strong>
                <span className={styles.linkedCaseTitle}>{caseTitle}</span>
              </span>
            </div>
          ) : null}

          {showContactField ? (
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>
                {t("complaintContactLabel")}
              </legend>
              {(
                [
                  { value: "16699", label: t("complaintContact16699") },
                  { value: "this_phone", label: t("complaintContactThisPhone") },
                  { value: "none", label: t("complaintContactNone") },
                ] as { value: Contact; label: string }[]
              ).map((option) => (
                <label key={option.value} className={styles.radio}>
                  <input
                    type="radio"
                    name="complaint-contact"
                    value={option.value}
                    checked={contact === option.value}
                    onChange={() => setContact(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
          ) : null}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("complaintWhenLabel")}</span>
            <input
              type="date"
              className={styles.dateInput}
              value={whenDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setWhenDate(event.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              {t("complaintMessageLabel")}
            </span>
            <textarea
              className={styles.textarea}
              rows={4}
              placeholder={t("complaintMessagePlaceholder")}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>

          <label className={styles.consent}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
            />
            <span>{t("complaintConsent")}</span>
          </label>

          <footer className={styles.footer}>
            <Button type="submit" disabled={!consent}>
              {t("complaintSubmit")}
            </Button>
          </footer>
        </form>
      )}
    </div>
  );
}

function SuccessView({
  refNumber,
  anonymous,
  linkedCaseId,
  caseTitle,
  onAnother,
}: {
  refNumber: string;
  anonymous: boolean;
  linkedCaseId: string | null;
  caseTitle: string;
  onAnother: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.successWrap} role="status" aria-live="polite">
      <p className={styles.eyebrow}>{t("complaintReference")}</p>
      <p className={styles.refNumber}>{refNumber}</p>

      <div
        className={`${styles.successTag} ${anonymous ? styles.tagAnon : styles.tagLinked}`}
      >
        {anonymous
          ? t("complaintAnonymousTag")
          : `${t("complaintLinkedTag")} · ${linkedCaseId}`}
      </div>

      <h2 className={styles.title}>{t("complaintSuccess")}</h2>

      <section className={styles.whatNext}>
        <h3 className={styles.whatNextTitle}>
          {t("complaintWhatNextTitle")}
        </h3>
        <ul className={styles.whatNextList}>
          <li>{t("complaintWhatNextCase")}</li>
          <li>{t("complaintWhatNextContact")}</li>
          <li>{t("complaintWhatNextDays")}</li>
          {!anonymous && linkedCaseId ? (
            <li>
              <span className={styles.caseTag}>{linkedCaseId}</span>
              <span>{caseTitle}</span>
            </li>
          ) : null}
        </ul>
      </section>

      <footer className={styles.footer}>
        <Button variant="secondary" onClick={onAnother}>
          {t("complaintClose")}
        </Button>
      </footer>
    </div>
  );
}
