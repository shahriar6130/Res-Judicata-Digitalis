"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ReferralService, SensitiveEvidenceService, useHelplineStore, ensureSeeded } from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

export default function AccessHistoryPage({ params }: { params: Promise<{ referralId: string }> }) {
  const { referralId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();

  useEffect(() => {
    ensureSeeded();
  }, []);

  const ref = ReferralService.find(envelope, referralId);
  if (!ref) return <div className={styles.shell}><div className={styles.main}>Not found.</div></div>;
  const evidence = SensitiveEvidenceService.listFor(envelope, ref.applicationId);
  const events = (envelope.sensitiveEvidence?.events ?? []).filter((e) => e.applicationId === ref.applicationId);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={`/referrals/${ref.referralId}`} className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralAccessTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("referralAccessTitle")}</h1>
        <p className={styles.intro}>{ref.referralId} · {ref.applicationId}</p>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Evidence items</h2>
            <span className={styles.sectionSub}>{evidence.length}</span>
          </div>
          <div className={styles.card}>
            {evidence.length === 0 && <div className={styles.notice}>No evidence attached.</div>}
            {evidence.map((item) => {
              const itemEvents = events.filter((e) => e.evidenceId === item.evidenceId);
              return (
                <div key={item.evidenceId} className={styles.evidenceRow}>
                  <div>{item.accessClassification === "highly_restricted" ? "🔒" : "🗝"}</div>
                  <div>
                    <div>{item.subject}</div>
                    <div className={styles.evidenceMeta}>{item.kind} · {item.accessClassification}</div>
                    {itemEvents.length > 0 && (
                      <ul className={styles.timeline}>
                        {itemEvents.map((e) => (
                          <li key={e.eventId} className={styles.timelineItem}>
                            <span className={styles.timelineTime}>{new Date(e.occurredAt).toISOString().slice(0, 16).replace("T", " ")}</span>
                            <span>{e.action} · {e.actor} · purpose {e.purpose}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Link href={`/applications/${ref.applicationId}/sensitive-review`} className={`${styles.btn} ${styles.btnGhost}`}>
                    {t("referralQueueOpen")}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        <div style={{ marginTop: 16 }}>
          <Link href={`/referrals/${ref.referralId}`} className={`${styles.btn} ${styles.btnGhost}`}>← Back to referral</Link>
        </div>
      </main>
    </div>
  );
}