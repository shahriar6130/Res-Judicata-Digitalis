"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  EscalationService,
  ReferralService,
  useHelplineStore,
  ensureSeeded,
  ApplicationRecordService,
} from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

export default function EscalationsInboxPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    ensureSeeded();
  }, []);

  function reseedRahimEscalation() {
    const rahim = (envelope.records ?? []).find((a) => a.applicationId === "APP-2026-RAHIM-01");
    if (!rahim) return;
    const caseIdFromRef = (envelope.referrals ?? []).find((r) => r.applicationId === "APP-2026-RAHIM-01")?.package.caseId;
    EscalationService.seedJurisdictionEscalation({
      applicationId: "APP-2026-RAHIM-01",
      caseId: caseIdFromRef ?? "APP-2026-RAHIM-01",
      actor: "officer",
    });
    setTick((t) => t + 1);
  }

  function detectRepeated() {
    ReferralService.recalculateOverdue("officer");
    const cases = Array.from(new Set((envelope.escalationTasks ?? []).map((e) => e.applicationId)));
    for (const appId of cases) {
      EscalationService.detectRepeatedTransfer({ applicationId: appId, actor: "officer" });
    }
    setTick((t) => t + 1);
  }

  const escalations = envelope.escalationTasks ?? [];

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/referrals/dashboard" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralEscalationsTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("referralEscalationsTitle")}</h1>
        <p className={styles.intro}>
          Escalation reviewers only. The system never decides jurisdiction — a human records the final routing decision.
        </p>

        <div className={styles.notice}>
          Repeated transfer detected — an authorised routing decision is required. This inbox is for escalation reviewers.
        </div>

        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={reseedRahimEscalation}>
            Seed Rahim jurisdiction escalation
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={detectRepeated}>
            Re-scan cases for repeated transfers
          </button>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Escalation queue</h2>
            <span className={styles.sectionSub}>{escalations.length}</span>
          </div>
          <div className={styles.card}>
            <table className={styles.queue}>
              <thead>
                <tr>
                  <th>Escalation</th>
                  <th>{t("referralQueueRecordId")}</th>
                  <th>Applicant</th>
                  <th>Reason</th>
                  <th>State</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {escalations.map((e) => {
                  const rec = ApplicationRecordService.find(envelope, e.applicationId);
                  return (
                    <tr key={e.escalationId} className={styles.queueRow}>
                      <td className={styles.kvValueMono}>{e.escalationId}</td>
                      <td className={styles.kvValueMono}>{e.applicationId}</td>
                      <td>{rec?.facts?.applicant_name?.value ?? e.applicationId}</td>
                      <td>{e.reason}</td>
                      <td>
                        <span className={`${styles.statusPill} ${styles.statusPillWarn}`}>{e.state}</span>
                      </td>
                      <td className={styles.kvValueMono}>{new Date(e.createdAt).toISOString().slice(0, 16).replace("T", " ")}</td>
                      <td>
                        <div className={styles.actions}>
                          <Link href={`/referrals/escalations/${e.escalationId}`} className={`${styles.btn} ${styles.btnPrimary}`}>
                            Open workspace
                          </Link>
                          <Link href={`/cases/${e.caseId ?? "—"}/referrals`} className={`${styles.btn} ${styles.btnGhost}`}>
                            Case referrals
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {escalations.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className={styles.notice}>
                        No escalations. Use the controls above to scan cases or seed the Rahim escalation.
                      </div>
                    </td>
                  </tr>
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