"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n, type MessageKey } from "@/lib/i18n";
import {
  ReferralService,
  SensitiveEvidenceService,
  ApplicationRecordService,
  useHelplineStore,
  ensureSeeded,
  RoutingRecommendationService,
  DemoTimeService,
  SafeNotificationService,
} from "@/lib/shakkho";
import type { ReferralState } from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

const STATE_LABEL: Record<ReferralState, MessageKey> = {
  draft: "referralStateDraft",
  package_review: "referralStatePackageReview",
  authorized: "referralStateAuthorized",
  sending: "referralStateSending",
  delivered: "referralStateDelivered",
  awaiting_acknowledgment: "referralStateAwaitingAck",
  acknowledged: "referralStateAcknowledged",
  accepted: "referralStateAccepted",
  action_in_progress: "referralStateActionInProgress",
  completed: "referralStateCompleted",
  delivery_failed: "referralStateDeliveryFailed",
  information_requested: "referralStateInfoRequested",
  returned: "referralStateReturned",
  overdue_acknowledgment: "referralStateOverdueAck",
  overdue_action: "referralStateOverdueAction",
  escalation_required: "referralStateEscalationRequired",
  escalated: "referralStateEscalated",
  superseded: "referralStateSuperseded",
  withdrawn_by_authorized_user: "referralStateWithdrawn",
};

export default function ReferralDetailPage({ params }: { params: Promise<{ referralId: string }> }) {
  const { referralId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    ensureSeeded();
    ReferralService.recalculateOverdue("system");
  }, []);

  const ref = ReferralService.find(envelope, referralId);
  const app = ref ? ApplicationRecordService.find(envelope, ref.applicationId) : undefined;
  const applicantName = app?.facts?.applicant_name?.value ?? ref?.applicationId ?? "";

  if (!ref) {
    return (
      <div className={styles.shell}>
        <div className={styles.main}>
          <h1 className={styles.title}>Referral not found</h1>
          <Link href="/referrals/dashboard" className={`${styles.btn} ${styles.btnGhost}`}>
            ← {t("referralDashboardTitle")}
          </Link>
        </div>
      </div>
    );
  }

  const p = ref.package;
  const isOverdue = p.state === "overdue_acknowledgment" || p.state === "overdue_action";
  const recommendation = (envelope.routingRecommendations ?? []).find(
    (r) => r.applicationId === ref.applicationId,
  );

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/referrals/dashboard" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{ref.referralId}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>

      <div className={isOverdue ? styles.noticeDanger : p.state === "completed" ? styles.noticeOk : styles.notice} role="status">
        <strong>{t(STATE_LABEL[p.state])}</strong>
        <div style={{ fontSize: 12 }}>{ref.referralId} · {applicantName}</div>
      </div>

      <main className={styles.main}>
        <section className={styles.header}>
          <span className={styles.eyebrow}>{p.reasonCategory.replace(/_/g, " ")}</span>
          <h1 className={styles.title}>{p.expectedAction}</h1>
          <p className={styles.intro}>{p.reason}</p>
        </section>

        <div className={styles.actions}>
          <Link href={`/referrals/${ref.referralId}/package`} className={styles.btn}>
            {t("referralPackageTitle")}
          </Link>
          <Link href={`/referrals/${ref.referralId}/documents`} className={`${styles.btn} ${styles.btnSecondary}`}>
            {t("referralDocumentsHeading")}
          </Link>
          <Link href={`/referrals/${ref.referralId}/delivery`} className={`${styles.btn} ${styles.btnSecondary}`}>
            {t("referralDeliveryTitle")}
          </Link>
          <Link href={`/referrals/${ref.referralId}/timeline`} className={`${styles.btn} ${styles.btnSecondary}`}>
            {t("referralTimelineTitle")}
          </Link>
          <Link href={`/referrals/${ref.referralId}/access-history`} className={`${styles.btn} ${styles.btnSecondary}`}>
            {t("referralAccessTitle")}
          </Link>
          <Link href={`/applications/${ref.applicationId}/sensitive-review`} className={`${styles.btn} ${styles.btnGhost}`}>
            {t("referralSensitiveVaultTitle")}
          </Link>
          <Link href={`/cases/${ref.applicationId}/referrals`} className={`${styles.btn} ${styles.btnGhost}`}>
            {t("referralOpenCase")}
          </Link>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Referral metadata</h2>
          </div>
          <div className={styles.card}>
            <div className={styles.kvGrid}>
              <div className={styles.kvLabel}>{t("referralRecordId")}</div>
              <div className={styles.kvValueMono}>{ref.applicationId}</div>
              <div className={styles.kvLabel}>{t("referralQueueApplicant")}</div>
              <div className={styles.kvValue}>{applicantName}</div>
              <div className={styles.kvLabel}>{t("referralSendingOffice")}</div>
              <div className={styles.kvValue}>{p.sendingOffice}</div>
              <div className={styles.kvLabel}>{t("referralReceivingOffice")}</div>
              <div className={styles.kvValue}>{p.receivingOffice}</div>
              <div className={styles.kvLabel}>{t("referralState")}</div>
              <div className={styles.kvValue}>{t(STATE_LABEL[p.state])}</div>
              <div className={styles.kvLabel}>{t("referralPackagePriority")}</div>
              <div className={styles.kvValue}>{t(p.priority === "overdue" ? "referralPriorityOverdue" : p.priority === "urgent" ? "referralPriorityUrgent" : "referralPriorityStandard")}</div>
              <div className={styles.kvLabel}>{t("referralQueueReason")}</div>
              <div className={styles.kvValue}>{p.reason}</div>
              <div className={styles.kvLabel}>{t("referralPackageExpectedAction")}</div>
              <div className={styles.kvValue}>{p.expectedAction}</div>
              <div className={styles.kvLabel}>{t("referralPackageAckDeadline")}</div>
              <div className={styles.kvValueMono}>{p.deadline.acknowledgmentDeadline}</div>
              <div className={styles.kvLabel}>{t("referralPackageActionDeadline")}</div>
              <div className={styles.kvValueMono}>{p.deadline.actionDeadline}</div>
              <div className={styles.kvLabel}>{t("referralResponsible")}</div>
              <div className={styles.kvValue}>{p.escalationOwner}</div>
              {p.integrityHash && (
                <>
                  <div className={styles.kvLabel}>Integrity hash</div>
                  <div className={styles.kvValueMono}>{p.integrityHash}</div>
                </>
              )}
            </div>
          </div>
        </section>

        {p.humanPriorityDecision && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t("referralUrgencyHeading")}</h2>
            </div>
            <div className={styles.card}>
              <div className={styles.kvGrid}>
                <div className={styles.kvLabel}>{t("referralUrgencyDecision")}</div>
                <div className={styles.kvValue}>{p.humanPriorityDecision.decision}</div>
                <div className={styles.kvLabel}>{t("referralUrgencyReason")}</div>
                <div className={styles.kvValue}>{p.humanPriorityDecision.reason}</div>
                <div className={styles.kvLabel}>{t("referralUrgencySafety")}</div>
                <div className={styles.kvValue}>{p.humanPriorityDecision.safetyAction}</div>
                <div className={styles.kvLabel}>{t("referralUrgencyResponsible")}</div>
                <div className={styles.kvValue}>{p.humanPriorityDecision.responsiblePerson}</div>
                <div className={styles.kvLabel}>{t("referralUrgencyReviewDeadline")}</div>
                <div className={styles.kvValueMono}>{p.humanPriorityDecision.reviewDeadline}</div>
                <div className={styles.kvLabel}>{t("referralUrgencyOverride")}</div>
                <div className={styles.kvValue}>{p.humanPriorityDecision.override ? (p.humanPriorityDecision.overrideReason ?? "—") : "no"}</div>
              </div>
            </div>
          </section>
        )}

        {recommendation && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t("referralRoutingHeading")}</h2>
            </div>
            <div className={styles.card}>
              <div className={styles.kvGrid}>
                <div className={styles.kvLabel}>{t("referralRoutingRecommended")}</div>
                <div className={styles.kvValue}>{recommendation.recommendedDestination.displayName}</div>
                <div className={styles.kvLabel}>{t("referralRoutingConfidence")}</div>
                <div className={styles.kvValue}>
                  {recommendation.confidence === "sufficient_for_human_review" && t("referralRoutingSufficient")}
                  {recommendation.confidence === "incomplete" && t("referralRoutingIncomplete")}
                  {recommendation.confidence === "conflicting" && t("referralRoutingConflicting")}
                  {recommendation.confidence === "no_verified_route" && t("referralRoutingNoVerified")}
                </div>
                <div className={styles.kvLabel}>{t("referralRoutingReason")}</div>
                <div className={styles.kvValue}>{lang === "bn" ? recommendation.reasons[0]?.bn : recommendation.reasons[0]?.en}</div>
              </div>
              {recommendation.confidence === "no_verified_route" && (
                <div className={styles.noticeWarn} style={{ marginTop: 12 }}>{t("referralRoutingNoVerifiedLong")}</div>
              )}
            </div>
          </section>
        )}

        {p.history && p.history.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Recent transitions</h2>
              <span className={styles.sectionSub}>{p.history.length}</span>
            </div>
            <div className={styles.card}>
              <ul className={styles.timeline}>
                {p.history.slice(-5).reverse().map((h) => (
                  <li key={h.id} className={styles.timelineItem}>
                    <span className={styles.timelineTime}>{new Date(h.occurredAt).toISOString().slice(0, 16).replace("T", " ")}</span>
                    <span><strong>{h.action}</strong> by {h.actor} {h.fromState && h.toState ? `(${h.fromState} → ${h.toState})` : ""} {h.reason && <em style={{ color: "#666" }}>— {h.reason}</em>}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Safe citizen status</h2>
          </div>
          <div className={styles.card}>
            <div className={styles.noticeOk}>
              {SafeNotificationService.safeMessageForReferral(ref, lang)}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
              <Link href={`/citizen/referrals/${ref.applicationId}`}>{t("referralCitizenTitle")}</Link>
            </div>
          </div>
        </section>

        <DemoTimeControls onAdvance={() => setTick((t) => t + 1)} t={t} />
      </main>
    </div>
  );
}

function DemoTimeControls({ onAdvance, t }: { onAdvance: () => void; t: (k: MessageKey) => string }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Demo controls</h2>
      </div>
      <div className={styles.card}>
        <div className={styles.demoTimeRow}>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => { DemoTimeService.advance(24, "officer"); onAdvance(); }}>+24h</button>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => { DemoTimeService.advance(72, "officer"); onAdvance(); }}>+72h</button>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => { DemoTimeService.reset("officer"); onAdvance(); }}>Reset</button>
        </div>
        <div className={styles.tamperHint}>
          Tip: clicking +24h on <code>ref-nb-04</code> pushes past its acknowledgment deadline, triggering overdue state.
        </div>
      </div>
    </section>
  );
}

void SensitiveEvidenceService;