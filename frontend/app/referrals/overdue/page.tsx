"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ReferralService,
  EscalationService,
  DemoTimeService,
  useHelplineStore,
  ensureSeeded,
  ApplicationRecordService,
} from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

export default function OverduePage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    ensureSeeded();
  }, []);

  const refs = envelope.referrals ?? [];
  const overdueAck = refs.filter((r) => r.package.state === "overdue_acknowledgment");
  const overdueAction = refs.filter((r) => r.package.state === "overdue_action");

  const recordName = (applicationId: string) =>
    ApplicationRecordService.find(envelope, applicationId)?.facts?.applicant_name?.value ?? applicationId;

  function recompute() {
    ReferralService.recalculateOverdue("system");
    // Re-run jurisdiction escalation detection for every known case.
    const caseIds = Array.from(new Set((envelope.referrals ?? []).map((r) => r.package.caseId ?? r.applicationId)));
    for (const applicationId of caseIds) {
      EscalationService.detectRepeatedTransfer({ applicationId, actor: "system" });
    }
    setTick((t) => t + 1);
  }

  function advance(hours: number) {
    DemoTimeService.advance(hours, "officer");
    recompute();
  }

  function reset() {
    DemoTimeService.reset("officer");
    recompute();
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/referrals/dashboard" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralOverdueTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("referralOverdueTitle")}</h1>
        <p className={styles.intro}>
          Non-acknowledgment and non-action trigger follow-up tasks and escalation tasks. Both offices continue to share the same state.
        </p>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Demo time controls</h2>
          </div>
          <div className={styles.card}>
            <div className={styles.notice}>
              <strong>{t("referralSimulateNoAck")}</strong> — {t("referralSimulateNoAckHint")}
            </div>
            <div className={styles.actions}>
              <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={recompute}>Recompute overdue now</button>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => advance(24)}>+24h (advance)</button>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => advance(72)}>+72h (advance)</button>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={reset}>{t("referralResetTime")}</button>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("referralOverdueAckTitle")}</h2>
            <span className={styles.sectionSub}>{overdueAck.length}</span>
          </div>
          <div className={styles.card}>
            <table className={styles.queue}>
              <thead>
                <tr>
                  <th>{t("referralQueueRecordId")}</th>
                  <th>{t("referralQueueApplicant")}</th>
                  <th>{t("referralQueueSendingOffice")}</th>
                  <th>{t("referralQueueReceivingOffice")}</th>
                  <th>{t("referralQueueAckDeadline")}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {overdueAck.map((r) => (
                  <tr key={r.referralId} className={styles.queueRow}>
                    <td className={styles.kvValueMono}>{r.applicationId}</td>
                    <td>{recordName(r.applicationId)}</td>
                    <td>{r.package.sendingOffice}</td>
                    <td>{r.package.receivingOffice}</td>
                    <td className={styles.kvValueMono}>{new Date(r.package.deadline.acknowledgmentDeadline).toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td>
                      <div className={styles.actions}>
                        <Link href={`/referrals/${r.referralId}`} className={`${styles.btn} ${styles.btnGhost}`}>{t("referralQueueOpen")}</Link>
                        <Link href={`/referrals/${r.referralId}/delivery`} className={`${styles.btn} ${styles.btnSecondary}`}>Resend</Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {overdueAck.length === 0 && (
                  <tr><td colSpan={6}><div className={styles.notice}>No overdue acknowledgments.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("referralOverdueActionTitle")}</h2>
            <span className={styles.sectionSub}>{overdueAction.length}</span>
          </div>
          <div className={styles.card}>
            <table className={styles.queue}>
              <thead>
                <tr>
                  <th>{t("referralQueueRecordId")}</th>
                  <th>{t("referralQueueApplicant")}</th>
                  <th>{t("referralQueueSendingOffice")}</th>
                  <th>{t("referralQueueReceivingOffice")}</th>
                  <th>Action deadline</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {overdueAction.map((r) => (
                  <tr key={r.referralId} className={styles.queueRow}>
                    <td className={styles.kvValueMono}>{r.applicationId}</td>
                    <td>{recordName(r.applicationId)}</td>
                    <td>{r.package.sendingOffice}</td>
                    <td>{r.package.receivingOffice}</td>
                    <td className={styles.kvValueMono}>{new Date(r.package.deadline.actionDeadline).toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td>
                      <div className={styles.actions}>
                        <Link href={`/referrals/${r.referralId}`} className={`${styles.btn} ${styles.btnGhost}`}>{t("referralQueueOpen")}</Link>
                        <Link href={`/referrals/receiving-inbox`} className={`${styles.btn} ${styles.btnSecondary}`}>Receiving inbox</Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {overdueAction.length === 0 && (
                  <tr><td colSpan={6}><div className={styles.notice}>No overdue actions.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div style={{ marginTop: 16 }}>
          <Link href="/referrals/dashboard" className={`${styles.btn} ${styles.btnGhost}`}>← Back to dashboard</Link>
        </div>
      </main>
    </div>
  );
}