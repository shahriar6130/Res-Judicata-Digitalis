"use client";

/* ------------------------------------------------------------------ *
 *  Case Detail — Citizen-facing case tracking experience.
 *
 *  Replaces the prior placeholder. The citizen's case ID selects one
 *  of the logged-in citizen's own applications (lib/dlas/citizen-view.ts). The component answers
 *  the four questions a real-world litigant asks at every visit:
 *
 *    1. "আমার মামলাটা এখন কোথায় আছে?"      → header + status badge
 *    2. "আমাকে কি কিছু করতে হবে?"           → next-action card w/ CTA
 *    3. "পরবর্তী ধাপ কী?"                    → vertical timeline + accent
 *    4. "কে যোগাযোগ করবে? কখন?"             → mediator card + actions
 *
 *  Tone: calm, generous whitespace, Bangla-first. Tokens-driven.
 *  All subcomponents live in this file (spec §22 — no tiny one-offs).
 * ------------------------------------------------------------------ */

import { useState } from "react";
import { Button } from "@/components/button";
import {
  Bell,
  Briefcase,
  Check,
  ChevronRight,
  Copy,
  FileText,
  MapPin,
  Play,
  Shield,
} from "@/components/icons";
import type { CaseRecord, CaseStatus } from "@/lib/case-demo";
import { useCitizenCase } from "@/lib/dlas/citizen-view";
import { CitizenDocuments } from "@/components/dlas/citizen-documents";
import { CitizenSettlementCard } from "@/components/dlas/citizen-settlement";
import { CitizenGroupCard } from "@/components/dlas/citizen-group";
import { useI18n, type MessageKey } from "@/lib/i18n";
import styles from "./case-detail.module.css";

type T = (key: MessageKey) => string;

type Props = {
  caseId: string;
  onBack: () => void;
};

/* ------------------------------------------------------------------ *
 *  Public entry point. Looks up the case; falls back to a calm
 *  not-found card when the id doesn't exist (e.g. deep link from
 *  an older URL hash, or a typo in a future demo seed).
 * ------------------------------------------------------------------ */

export function CaseDetail({ caseId, onBack }: Props) {
  const { lang, t } = useI18n();
  const caseRecord = useCitizenCase(caseId);

  if (!caseRecord) {
    return (
      <section
        id="case-detail"
        role="region"
        aria-labelledby="case-not-found-title"
        className={styles.section}
      >
        <div className={styles.page}>
          <BackLink t={t} onBack={onBack} />
          <NotFoundCard t={t} onBack={onBack} />
        </div>
      </section>
    );
  }

  return (
    <section
      id="case-detail"
      role="region"
      aria-label={lang === "bn" ? "মামলার বিস্তারিত" : "Case detail"}
      className={styles.section}
    >
      <div className={styles.page}>
        <BackLink t={t} onBack={onBack} />
        <CaseHeader caseRecord={caseRecord} t={t} />
        <div className={styles.identityBand}>
          <CaseIdCard caseRecord={caseRecord} t={t} />
          <CurrentStatus caseRecord={caseRecord} t={t} />
        </div>
        <CitizenSettlementCard applicationId={caseRecord.id} />
        <CitizenGroupCard applicationId={caseRecord.id} />
        <CitizenDocuments applicationId={caseRecord.id} />
        <NextActionCard caseRecord={caseRecord} t={t} onConfirmSafeTime={() => {}} />
        <CaseTimeline caseRecord={caseRecord} t={t} />
        <CaseActions caseRecord={caseRecord} t={t} />
        <div className={styles.twoColumn}>
          <MediatorCard caseRecord={caseRecord} t={t} />
          <CommunicationCard caseRecord={caseRecord} t={t} />
        </div>
        <CaseInformation caseRecord={caseRecord} t={t} />
        <SafetyNotice t={t} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  Tiny presentational subcomponents (intentionally kept in-file).
 * ------------------------------------------------------------------ */

function BackLink({ t, onBack }: { t: T; onBack: () => void }) {
  return (
    <button type="button" className={styles.backLink} onClick={onBack}>
      {t("caseBackToMyCases")}
    </button>
  );
}

function NotFoundCard({ t, onBack }: { t: T; onBack: () => void }) {
  return (
    <article className={styles.notFoundCard}>
      <p className={styles.statusEyebrow}>{t("caseNotFoundHeading")}</p>
      <p className={styles.emptyState}>{t("caseNotFoundBody")}</p>
      <Button variant="secondary" onClick={onBack}>
        {t("caseBackToMyCases")}
      </Button>
    </article>
  );
}

/* ------------------------------------------------------------------ *
 *  Case header — eyebrow, title (case subject), party meta.
 *  Two-line title in Bangla sets the tone.
 * ------------------------------------------------------------------ */

function CaseHeader({ caseRecord, t }: { caseRecord: CaseRecord; t: T }) {
  const { lang } = useI18n();
  const pick = (bn: string, en: string) => (lang === "bn" ? bn : en);

  return (
    <header className={styles.header}>
      <p className={styles.headerEyebrow}>{t("caseHeaderEyebrow")}</p>
      <h1 className={styles.headerTitle}>
        {pick(caseRecord.titleBn, caseRecord.titleEn)}
      </h1>
      <div className={styles.headerMeta}>
        <span>
          {t("caseApplicant")}
          <strong>{pick(caseRecord.applicantBn, caseRecord.applicantEn)}</strong>
        </span>
        <span>
          {t("caseBeneficiary")}
          <strong>{pick(caseRecord.beneficiaryBn, caseRecord.beneficiaryEn)}</strong>
        </span>
        <span>
          {t("caseIssue")}
          <strong>{pick(caseRecord.issueBn, caseRecord.issueEn)}</strong>
        </span>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ *
 *  Case ID card — display id + office + copy-to-clipboard.
 *  Pure local state; "কপি হয়েছে" feedback for ~1.5s.
 * ------------------------------------------------------------------ */

function CaseIdCard({ caseRecord, t }: { caseRecord: CaseRecord; t: T }) {
  const { lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    setCopyFailed(false);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(caseRecord.displayId);
      } else {
        throw new Error("clipboard unavailable");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyFailed(true);
      window.setTimeout(() => setCopyFailed(false), 1800);
    }
  };

  return (
    <article className={styles.caseIdCard} aria-labelledby="case-id-label">
      <p id="case-id-label" className={styles.caseIdEyebrow}>
        {t("caseIdLabel")}
      </p>
      <div className={styles.caseIdRow}>
        <p className={styles.caseIdValue}>{caseRecord.displayId}</p>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={handleCopy}
          data-copied={copied ? "true" : "false"}
          aria-live="polite"
        >
          <Copy size={14} aria-hidden />
          {copyFailed
            ? t("errorCopyFailed")
            : copied
              ? t("caseCopiedLabel")
              : t("caseCopyLabel")}
        </button>
      </div>
      <p className={styles.caseIdOffice}>
        <strong>{t("caseIdOffice")}</strong>
        <br />
        {lang === "bn" ? caseRecord.officeBn : caseRecord.officeEn}
      </p>
    </article>
  );
}

/* ------------------------------------------------------------------ *
 *  Current status — pill badge inside a small card.
 *  Driven by `statusBadgeFor()` helper — token-friendly colors.
 *  Every status carries text + color (never color-only).
 * ------------------------------------------------------------------ */

type BadgeSpec = {
  key: MessageKey;
  className: string;
};

function statusBadgeFor(status: CaseStatus): BadgeSpec {
  switch (status) {
    case "submitted":
      return { key: "statusSubmitted", className: styles.statusBadgeSubmitted };
    case "under_review":
      return { key: "statusUnderReview", className: styles.statusBadgeUnderReview };
    case "approved":
      return { key: "statusApproved", className: styles.statusBadgeUnderReview };
    case "mediation_started":
      return { key: "statusMediationStarted", className: styles.statusBadgeMediation };
    case "agreement_pending":
      return {
        key: "statusAgreementPending",
        className: styles.statusBadgeAgreement,
      };
    case "resolved":
      return { key: "statusResolved", className: styles.statusBadgeResolved };
    case "closed":
      return { key: "statusClosed", className: styles.statusBadgeClosed };
  }
}

function CurrentStatus({
  caseRecord,
  t,
}: {
  caseRecord: CaseRecord;
  t: T;
}) {
  const badge = statusBadgeFor(caseRecord.status);
  return (
    <article className={styles.statusCard}>
      <p className={styles.statusEyebrow}>{t("caseStatusLabel")}</p>
      <span className={`${styles.statusBadge} ${badge.className}`}>
        {t(badge.key)}
      </span>
    </article>
  );
}

/* ------------------------------------------------------------------ *
 *  Next-action card.
 *
 *  Single component; icon / copy / CTA change with status. Calm status
 *  messages for waiting states, prominent CTA when the citizen must
 *  confirm safe time, success treatment at resolved.
 * ------------------------------------------------------------------ */

type NextActionSpec = {
  icon: "check" | "calendar";
  iconResolved?: boolean;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  hintKey?: MessageKey;
  cta?: { labelKey: MessageKey };
  resolved?: boolean;
};

function getNextActionFor(status: CaseStatus): NextActionSpec {
  switch (status) {
    case "submitted":
      return {
        icon: "calendar",
        titleKey: "nextActionSubmittedTitle",
        bodyKey: "nextActionSubmittedBody",
      };
    case "under_review":
    case "approved":
      return {
        icon: "calendar",
        titleKey: "nextActionUnderReviewTitle",
        bodyKey: "nextActionUnderReviewBody",
        hintKey: undefined,
      };
    case "mediation_started":
      return {
        icon: "calendar",
        titleKey: "nextActionMediationTitle",
        bodyKey: "nextActionMediationBody",
        hintKey: "nextActionMediationHint",
        cta: { labelKey: "nextActionConfirmTime" },
      };
    case "agreement_pending":
      return {
        icon: "calendar",
        titleKey: "nextActionAgreementTitle",
        bodyKey: "nextActionAgreementBody",
        cta: { labelKey: "nextActionConfirmTime" },
      };
    case "resolved":
      return {
        icon: "check",
        iconResolved: true,
        titleKey: "nextActionResolvedTitle",
        bodyKey: "nextActionResolvedBody",
        hintKey: "nextActionResolvedHint",
        resolved: true,
      };
    case "closed":
      return {
        icon: "check",
        iconResolved: true,
        titleKey: "nextActionResolvedTitle",
        bodyKey: "nextActionResolvedBody",
        hintKey: "nextActionResolvedHint",
        resolved: true,
      };
  }
}

function NextActionCard({
  caseRecord,
  t,
  onConfirmSafeTime,
}: {
  caseRecord: CaseRecord;
  t: T;
  onConfirmSafeTime: () => void;
}) {
  const spec = getNextActionFor(caseRecord.status);
  const cardClass = spec.resolved
    ? `${styles.nextActionCard} ${styles.nextActionCardResolved}`
    : styles.nextActionCard;
  const iconClass = spec.iconResolved
    ? `${styles.nextActionIcon} ${styles.nextActionIconResolved}`
    : styles.nextActionIcon;

  return (
    <article className={cardClass}>
      <span className={iconClass} aria-hidden>
        {spec.icon === "check" ? <Check size={20} aria-hidden /> : <Bell size={20} aria-hidden />}
      </span>
      <div className={styles.nextActionBody}>
        <p className={styles.nextActionEyebrow}>{t("nextActionHeading")}</p>
        <h2 className={styles.nextActionTitle}>{t(spec.titleKey)}</h2>
        <p>{t(spec.bodyKey)}</p>
        {spec.hintKey ? (
          <p className={styles.nextActionHint}>{t(spec.hintKey)}</p>
        ) : null}
        {spec.cta ? (
          <div className={styles.nextActionActions}>
            <Button onClick={onConfirmSafeTime}>{t(spec.cta.labelKey)}</Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ *
 *  Timeline — vertical list with completed / current / upcoming dots
 *  and a left-side accent connector. The current step gets a soft
 *  callout card beneath it to answer "পরবর্তী ধাপ কী?".
 * ------------------------------------------------------------------ */

function CaseTimeline({
  caseRecord,
  t,
}: {
  caseRecord: CaseRecord;
  t: T;
}) {
  const { lang } = useI18n();
  const pick = (bn: string, en: string) => (lang === "bn" ? bn : en);

  return (
    <section
      className={styles.timelineSection}
      aria-labelledby="timeline-heading"
    >
      <h2 id="timeline-heading" className={styles.timelineHeading}>
        {t("timelineHeading")}
      </h2>
      <ol className={styles.timeline}>
        {caseRecord.timeline.map((event, idx) => {
          const isLast = idx === caseRecord.timeline.length - 1;
          const isCompleted = event.state === "completed";
          const isCurrent = event.state === "current";
          const isUpcoming = event.state === "upcoming";

          const dotClass = isCompleted
            ? `${styles.timelineDot} ${styles.timelineDotCompleted}`
            : isCurrent
              ? `${styles.timelineDot} ${styles.timelineDotCurrent}`
              : `${styles.timelineDot} ${styles.timelineDotUpcoming}`;

          const connectorClass = isCompleted
            ? `${styles.timelineConnector} ${styles.timelineConnectorCompleted}`
            : styles.timelineConnector;

          const titleClass = isUpcoming
            ? `${styles.timelineTitle} ${styles.timelineTitleUpcoming}`
            : styles.timelineTitle;

          const bodyClass = isUpcoming
            ? `${styles.timelineBody} ${styles.timelineBodyUpcoming}`
            : styles.timelineBody;

          const dateClass = isUpcoming
            ? `${styles.timelineDate} ${styles.timelineDateUpcoming}`
            : styles.timelineDate;

          const dateText = event.dateBn
            ? pick(event.dateBn, event.dateEn)
            : t("timelineNext");

          return (
            <li key={event.id} className={styles.timelineItem}>
              {!isLast ? <span className={connectorClass} aria-hidden /> : null}
              <span className={dotClass} aria-hidden>
                {isCompleted ? (
                  <Check size={16} aria-hidden />
                ) : isCurrent ? (
                  <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: "currentColor" }} />
                ) : (
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor", display: "inline-block" }} />
                )}
              </span>
              <div className={styles.timelineContent}>
                <h3 className={titleClass}>
                  {pick(event.titleBn, event.titleEn)}
                </h3>
                <p className={bodyClass}>
                  {pick(event.descriptionBn, event.descriptionEn)}
                </p>
                <p className={dateClass}>{dateText}</p>

                {isCurrent ? (
                  <article className={styles.currentCallout}>
                    <span className={styles.currentCalloutBadge}>
                      {t("timelineCurrent")}
                    </span>
                    <h4 className={styles.currentCalloutTitle}>
                      {t("nextActionHeading")}
                    </h4>
                    <p className={styles.currentCalloutBody}>
                      {pick(event.descriptionBn, event.descriptionEn)}
                    </p>
                  </article>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  Action buttons row — three large buttons:
 *    1) Audio update  (secondary — mock toast)
 *    2) View/draft agreement (primary if ready, secondary+disabled if not)
 *    3) Find nearest UDC (secondary → navigates to #udc)
 * ------------------------------------------------------------------ */

function CaseActions({
  caseRecord,
  t,
}: {
  caseRecord: CaseRecord;
  t: T;
}) {
  const [audioHint, setAudioHint] = useState(false);
  const [agreementHint, setAgreementHint] = useState(false);

  const agreementReady = caseRecord.documents.some(
    (d) => d.kind === "agreement" && d.status !== "pending",
  );

  const handleAudio = () => {
    setAudioHint(true);
    window.setTimeout(() => setAudioHint(false), 1800);
  };

  const handleAgreement = () => {
    if (!agreementReady) {
      setAgreementHint(true);
      window.setTimeout(() => setAgreementHint(false), 1800);
      return;
    }
    // Mock — Phase 2 will open a real preview dialog.
  };

  const handleFindUdc = () => {
    window.location.hash = "udc";
  };

  return (
    <section className={styles.actionsSection} aria-labelledby="actions-heading">
      <h2 id="actions-heading" className={styles.actionsHeading}>
        {t("actionHeading")}
      </h2>
      <div className={styles.actionsRow}>
        <Button variant="secondary" onClick={handleAudio}>
          <Play size={18} aria-hidden />
          <span style={{ marginLeft: 8 }}>{t("actionAudioUpdate")}</span>
        </Button>
        <Button variant="secondary" onClick={handleAgreement}>
          <FileText size={18} aria-hidden />
          <span style={{ marginLeft: 8 }}>{t("actionViewAgreement")}</span>
        </Button>
        <Button variant="secondary" onClick={handleFindUdc}>
          <MapPin size={18} aria-hidden />
          <span style={{ marginLeft: 8 }}>{t("actionFindUdc")}</span>
        </Button>
      </div>
      {audioHint ? (
        <p className={styles.actionHint} role="status">
          {t("actionAudioUnavailableHint")}
        </p>
      ) : null}
      {agreementHint ? (
        <p className={styles.actionHint} role="status">
          {t("actionAgreementPending")}
        </p>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  Mediator card — assigned / not-assigned states.
 *  When not assigned, shows a calm empty state.
 * ------------------------------------------------------------------ */

function MediatorCard({
  caseRecord,
  t,
}: {
  caseRecord: CaseRecord;
  t: T;
}) {
  const { lang } = useI18n();
  const pick = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const m = caseRecord.mediator;

  return (
    <article className={styles.mediatorCard} aria-labelledby="mediator-heading">
      <h2 id="mediator-heading" className={styles.cardHeading}>
        {t("mediatorHeading")}
      </h2>
      {m ? (
        <>
          <div className={styles.mediatorProfile}>
            <span className={styles.mediatorIcon} aria-hidden>
              <Briefcase size={22} aria-hidden />
            </span>
            <div>
              <p className={styles.mediatorName}>{pick(m.nameBn, m.nameEn)}</p>
              <p className={styles.mediatorDesignation}>
                {pick(m.designationBn, m.designationEn)}
              </p>
            </div>
          </div>
          <dl className={styles.factsList}>
            <div className={styles.factsRow}>
              <dt className={styles.factsLabel}>{t("mediatorArea")}</dt>
              <dd className={styles.factsValue}>{pick(m.areaBn, m.areaEn)}</dd>
            </div>
            <div className={styles.factsRow}>
              <dt className={styles.factsLabel}>{t("mediatorContactTime")}</dt>
              <dd className={styles.factsValue}>
                {pick(m.contactTimeBn, m.contactTimeEn)}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <p className={styles.emptyState}>{t("mediatorNotAssigned")}</p>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ *
 *  Communication card — latest message preview + expandable thread.
 *  Per spec §16, this is not a chat app: it's a small static thread.
 * ------------------------------------------------------------------ */

function CommunicationCard({
  caseRecord,
  t,
}: {
  caseRecord: CaseRecord;
  t: T;
}) {
  const { lang } = useI18n();
  const pick = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const [threadOpen, setThreadOpen] = useState(false);

  const messages = caseRecord.messages;
  const latest = messages[messages.length - 1];

  return (
    <article
      className={styles.communicationCard}
      aria-labelledby="communication-heading"
    >
      <h2 id="communication-heading" className={styles.cardHeading}>
        {t("communicationHeading")}
      </h2>

      {messages.length === 0 || !latest ? (
        <p className={styles.emptyState}>{t("communicationEmpty")}</p>
      ) : (
        <>
          <div className={styles.messagePreview}>
            <p className={styles.messageSender}>
              {latest.from === "mediator"
                ? t("communicationMediator")
                : t("communicationYou")}
            </p>
            <p className={styles.messageBody}>{pick(latest.bodyBn, latest.bodyEn)}</p>
            <p className={styles.messageTime}>
              {pick(latest.timestampBn, latest.timestampEn)}
            </p>
          </div>

          <button
            type="button"
            className={styles.openThreadBtn}
            onClick={() => setThreadOpen((v) => !v)}
            aria-expanded={threadOpen}
          >
            {threadOpen ? t("communicationClose") : t("communicationOpenThread")}
            {!threadOpen ? <ChevronRight size={14} aria-hidden /> : null}
          </button>
        </>
      )}

      {threadOpen && messages.length > 0 ? (
        <div
          className={styles.threadPanel}
          role="region"
          aria-label={lang === "bn" ? "মেসেজ থ্রেড" : "Message thread"}
        >
          <div className={styles.threadHeader}>
            <p className={styles.cardHeading}>{t("communicationHeading")}</p>
            <button
              type="button"
              className={styles.threadCloseBtn}
              onClick={() => setThreadOpen(false)}
              aria-label={t("communicationClose")}
            >
              {t("communicationClose")}
            </button>
          </div>
          <ol className={styles.threadList}>
            {messages.map((m) => {
              const itemClass =
                m.from === "citizen"
                  ? `${styles.threadItem} ${styles.threadItemCitizen}`
                  : `${styles.threadItem} ${styles.threadItemMediator}`;
              return (
                <li key={m.id} className={itemClass}>
                  <p className={styles.threadSender}>
                    {m.from === "mediator"
                      ? t("communicationMediator")
                      : t("communicationYou")}
                  </p>
                  <p className={styles.threadBody}>{pick(m.bodyBn, m.bodyEn)}</p>
                  <p className={styles.messageTime}>
                    {pick(m.timestampBn, m.timestampEn)}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ *
 *  Case information grid — dl with label / value pairs.
 *  Two columns on desktop, collapses to one at ≤1024px.
 * ------------------------------------------------------------------ */

function CaseInformation({
  caseRecord,
  t,
}: {
  caseRecord: CaseRecord;
  t: T;
}) {
  const { lang } = useI18n();
  const pick = (bn: string, en: string) => (lang === "bn" ? bn : en);

  const rows: Array<{ labelKey: MessageKey; value: string }> = [
    {
      labelKey: "caseInfoApplicant",
      value: pick(caseRecord.applicantBn, caseRecord.applicantEn),
    },
    {
      labelKey: "caseInfoBeneficiary",
      value: pick(caseRecord.beneficiaryBn, caseRecord.beneficiaryEn),
    },
    {
      labelKey: "caseInfoIssue",
      value: pick(caseRecord.issueBn, caseRecord.issueEn),
    },
    {
      labelKey: "caseInfoSubmittedAt",
      value: pick(caseRecord.submittedAtBn, caseRecord.submittedAtEn),
    },
    {
      labelKey: "caseInfoSafeTime",
      value: pick(caseRecord.safeContactTimeBn, caseRecord.safeContactTimeEn),
    },
    {
      labelKey: "caseInfoOffice",
      value: pick(caseRecord.officeBn, caseRecord.officeEn),
    },
  ];

  return (
    <section className={styles.infoCard} aria-labelledby="case-info-heading">
      <h2 id="case-info-heading" className={styles.cardHeading}>
        {t("caseInfoHeading")}
      </h2>
      <dl className={styles.infoGrid}>
        {rows.map((row) => (
          <div key={row.labelKey} className={styles.infoRow}>
            <dt className={styles.infoLabel}>{t(row.labelKey)}</dt>
            <dd className={styles.infoValue}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  Safety / privacy notice — small calm block at the bottom.
 * ------------------------------------------------------------------ */

function SafetyNotice({ t }: { t: T }) {
  return (
    <aside
      className={styles.safetyNotice}
      role="note"
      aria-labelledby="safety-heading"
    >
      <span className={styles.safetyIcon} aria-hidden>
        <Shield size={16} aria-hidden />
      </span>
      <div className={styles.safetyBody}>
        <p id="safety-heading" className={styles.safetyHeading}>
          {t("safetyHeading")}
        </p>
        <p className={styles.safetyText}>{t("safetyBody")}</p>
      </div>
    </aside>
  );
}
