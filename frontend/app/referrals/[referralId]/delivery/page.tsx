"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n, type MessageKey } from "@/lib/i18n";
import {
  ReferralService,
  useHelplineStore,
  ensureSeeded,
  DemoTimeService,
} from "@/lib/shakkho";
import type { DeliveryOperation } from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

const OUTCOME_LABEL: Record<DeliveryOperation["outcome"], MessageKey> = {
  delivered_successfully: "referralDeliveryOutcomeSuccess",
  delivery_delayed: "referralDeliveryOutcomeDelayed",
  endpoint_unavailable: "referralDeliveryOutcomeUnavailable",
  authentication_failure: "referralDeliveryOutcomeAuth",
  duplicate_attempt: "referralDeliveryOutcomeDuplicate",
  package_integrity_mismatch: "referralDeliveryOutcomeMismatch",
  delivered_acknowledgment_pending: "referralDeliveryOutcomeAckPending",
};

const OUTCOMES: DeliveryOperation["outcome"][] = [
  "delivered_successfully",
  "delivery_delayed",
  "endpoint_unavailable",
  "authentication_failure",
  "duplicate_attempt",
  "package_integrity_mismatch",
  "delivered_acknowledgment_pending",
];

export default function DeliverySimulatorPage({ params }: { params: Promise<{ referralId: string }> }) {
  const { referralId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [lastOp, setLastOp] = useState<DeliveryOperation | null>(null);
  const [tick, setTick] = useState(0);
  const [noAckMode, setNoAckMode] = useState<boolean>(false);

  useEffect(() => {
    ensureSeeded();
  }, []);

  const ref = ReferralService.find(envelope, referralId);

  if (!ref) return <div className={styles.shell}><div className={styles.main}>Not found.</div></div>;

  function runDelivery(outcome: DeliveryOperation["outcome"]) {
    const refNow = ReferralService.find(envelope, referralId);
    if (!refNow) return;
    const opId = "op-" + Math.random().toString(36).slice(2, 8);
    const op: DeliveryOperation = {
      operationId: opId,
      referralId: refNow.referralId,
      initiatedAt: DemoTimeService.iso(),
      initiatedBy: "officer",
      outcome,
      completedAt: DemoTimeService.iso(),
    };
    // Idempotency: refuse if the same referral already sent with the same operation.
    if (refNow.package.deliveryAttempts.some((a) => a.operationId === opId)) {
      setLastOp({ ...op, outcome: "duplicate_attempt", message: "duplicate refused" });
      return;
    }
    ReferralService.send({ referralId: refNow.referralId, actor: "officer", operationId: opId });
    ReferralService.markDelivered({
      referralId: refNow.referralId,
      actor: "system",
      operationId: opId,
      outcome,
      message: outcome,
    });
    setLastOp(op);
    setTick((t) => t + 1);
  }

  function runSimulateNoAck() {
    setNoAckMode(true);
  }

  function advanceAndRecompute(hours: number) {
    DemoTimeService.advance(hours, "officer");
    ReferralService.recalculateOverdue("system");
    setTick((t) => t + 1);
  }

  const deliveries = (envelope.deliveryOperations ?? []).filter((d) => d.referralId === ref.referralId);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={`/referrals/${ref.referralId}`} className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralDeliveryTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("referralDeliveryTitle")}</h1>
        <p className={styles.intro}>{ref.applicationId} · {ref.package.sendingOffice} → {ref.package.receivingOffice}</p>

        <div className={styles.simulator}>
          <div className={styles.simulatorLabel}>{t("referralDeliverySimulatorLabel")}</div>
          <p className={styles.intro}>{t("referralDeliveryStable")}</p>
          <div className={styles.outcomeRow}>
            {OUTCOMES.map((o) => (
              <button key={o} type="button" className={styles.outcomeBtn} onClick={() => runDelivery(o)}>
                {t(OUTCOME_LABEL[o])}
              </button>
            ))}
          </div>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("referralDeliveryResult")}</h2>
          </div>
          <div className={styles.card}>
            {lastOp ? (
              <div className={lastOp.outcome === "delivered_successfully" || lastOp.outcome === "delivered_acknowledgment_pending" ? styles.noticeOk : styles.noticeWarn}>
                {lastOp.outcome} · {lastOp.message ?? ""}
              </div>
            ) : (
              <div className={styles.notice}>No delivery attempted yet.</div>
            )}
            {deliveries.length > 0 && (
              <ul className={styles.timeline}>
                {deliveries.slice(-5).reverse().map((d) => (
                  <li key={d.operationId} className={styles.timelineItem}>
                    <span className={styles.timelineTime}>{new Date(d.initiatedAt).toISOString().slice(0, 16).replace("T", " ")}</span>
                    <span>{d.outcome}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Demo: no-acknowledgment failure test</h2>
          </div>
          <div className={styles.card}>
            <div className={styles.notice}>
              <strong>{t("referralSimulateNoAck")}</strong> — {t("referralSimulateNoAckHint")}
            </div>
            <div className={styles.actions}>
              <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={runSimulateNoAck}>
                {t("referralSimulateNoAck")}
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => advanceAndRecompute(24)}>+24h (advance)</button>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => advanceAndRecompute(72)}>+72h (advance)</button>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => { DemoTimeService.reset("officer"); ReferralService.recalculateOverdue("system"); setTick((t) => t + 1); }}>
                {t("referralResetTime")}
              </button>
            </div>
            {noAckMode && (
              <div className={styles.noticeWarn}>
                No-ack mode active. The receiving office will not acknowledge until reset. After advancing past the deadline, the referral transitions to <code>overdue_acknowledgment</code> and an escalation task is created.
              </div>
            )}
            <div className={styles.actions}>
              <Link href="/referrals/overdue" className={`${styles.btn} ${styles.btnSecondary}`}>
                Open overdue list
              </Link>
            </div>
          </div>
        </section>

        <div style={{ marginTop: 16 }}>
          <Link href={`/referrals/${ref.referralId}`} className={`${styles.btn} ${styles.btnGhost}`}>← Back to referral</Link>
        </div>
      </main>
    </div>
  );
}