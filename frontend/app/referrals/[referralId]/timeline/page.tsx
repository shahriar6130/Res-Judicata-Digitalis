"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ReferralService, useHelplineStore, ensureSeeded } from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

export default function TimelinePage({ params }: { params: Promise<{ referralId: string }> }) {
  const { referralId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();

  useEffect(() => {
    ensureSeeded();
  }, []);

  const ref = ReferralService.find(envelope, referralId);
  if (!ref) return <div className={styles.shell}><div className={styles.main}>Not found.</div></div>;
  const audit = ReferralService.auditFor(envelope, ref.referralId);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={`/referrals/${ref.referralId}`} className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralTimelineTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("referralTimelineTitle")}</h1>
        <p className={styles.intro}>{ref.referralId}</p>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Package history</h2>
            <span className={styles.sectionSub}>{ref.package.history.length}</span>
          </div>
          <div className={styles.card}>
            {ref.package.history.length === 0 ? (
              <div className={styles.notice}>{t("referralTimelineEmpty")}</div>
            ) : (
              <ul className={styles.timeline}>
                {ref.package.history.slice().reverse().map((h) => (
                  <li key={h.id} className={styles.timelineItem}>
                    <span className={styles.timelineTime}>{new Date(h.occurredAt).toISOString().slice(0, 16).replace("T", " ")}</span>
                    <span><strong>{h.action}</strong> by {h.actor}{h.fromState && h.toState ? ` (${h.fromState} → ${h.toState})` : ""}{h.reason && <em style={{ color: "#666" }}> — {h.reason}</em>}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Audit events</h2>
            <span className={styles.sectionSub}>{audit.length}</span>
          </div>
          <div className={styles.card}>
            {audit.length === 0 ? (
              <div className={styles.notice}>No audit events.</div>
            ) : (
              <ul className={styles.timeline}>
                {audit.slice().reverse().map((a) => (
                  <li key={a.id} className={styles.timelineItem}>
                    <span className={styles.timelineTime}>{new Date(a.occurredAt).toISOString().slice(0, 16).replace("T", " ")}</span>
                    <span>{a.action} · {a.actor} · subject {a.subjectKind}{a.payload ? ` · ${JSON.stringify(a.payload).slice(0, 80)}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div style={{ marginTop: 16 }}>
          <Link href={`/referrals/${ref.referralId}`} className={`${styles.btn} ${styles.btnGhost}`}>← Back to referral</Link>
        </div>
      </main>
    </div>
  );
}