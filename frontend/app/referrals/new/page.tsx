"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useHelplineStore, ensureSeeded, ApplicationRecordService } from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

export default function NewReferralPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [picked, setPicked] = useState<string>("");

  useEffect(() => {
    ensureSeeded();
  }, []);

  const records = envelope.records ?? [];

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/referrals/dashboard" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralNewTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.header}>
          <span className={styles.eyebrow}>DLAS</span>
          <h1 className={styles.title}>{t("referralNewTitle")}</h1>
          <p className={styles.intro}>{t("referralNewPickRecord")}</p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("referralNewPickRecord")}</h2>
          </div>
          <div className={styles.card}>
            <div className={styles.formRow}>
              <label htmlFor="rec">{t("referralNewPickRecord")}</label>
              <select id="rec" value={picked} onChange={(e) => setPicked(e.target.value)}>
                <option value="">—</option>
                {records.map((r) => (
                  <option key={r.applicationId} value={r.applicationId}>
                    {r.applicationId} — {r.facts?.applicant_name?.value ?? r.office}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.actions}>
              <Link
                href={picked ? `/referrals/${picked}/quickstart` : "#"}
                className={`${styles.btn} ${!picked ? styles.btnGhost : ""}`}
                aria-disabled={!picked}
              >
                {t("referralNewPickContinue")}
              </Link>
            </div>
            <div className={styles.notice}>
              <strong>Demo:</strong> open an existing referral to see the full package flow:
              {" "}<Link href="/referrals/ref-nb-01">Nuching — awaiting acknowledgment</Link>,
              {" "}<Link href="/referrals/ref-nb-02">Nuching — acknowledged</Link>,
              {" "}<Link href="/referrals/ref-nb-03">Nuching — returned</Link>,
              {" "}<Link href="/referrals/ref-nb-04">Nuching — overdue</Link>,
              {" "}<Link href="/referrals/ref-rh-01">Rahim — first transfer/return</Link>,
              {" "}<Link href="/referrals/ref-rh-02">Rahim — second transfer/return</Link>.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

void ApplicationRecordService;