"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  AuthorityDirectoryService,
  useHelplineStore,
  ensureSeeded,
} from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

export default function AuthorityDirectoryAdminPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  const [officer, setOfficer] = useState<string>("প্রশাসনিক কর্মকর্তা");

  useEffect(() => {
    ensureSeeded();
  }, []);

  const list = AuthorityDirectoryService.list(envelope);

  function markVerified(id: string) {
    AuthorityDirectoryService.markVerified(id, officer, officer);
    setTick((x) => x + 1);
  }
  function markExpired(id: string) {
    AuthorityDirectoryService.markExpired(id, officer);
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/referrals/dashboard" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralAuthorityDirectoryTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("referralAuthorityDirectoryTitle")}</h1>
        <p className={styles.intro}>Authoritative routing directory. Routing information must be verified by an authorised officer before referral.</p>

        <div className={styles.noticeWarn}>
          Routing information must be verified by an authorised officer before referral. Expired entries MUST NOT be used as routing targets.
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Officer</h2>
          </div>
          <div className={styles.card}>
            <div className={styles.formRow}>
              <label htmlFor="ofc">Authorising officer</label>
              <input id="ofc" value={officer} onChange={(e) => setOfficer(e.target.value)} />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Directory entries</h2>
            <span className={styles.sectionSub}>{list.length}</span>
          </div>
          <div className={styles.card}>
            <table className={styles.queue}>
              <thead>
                <tr>
                  <th>Entry</th>
                  <th>Type</th>
                  <th>Coverage (geo)</th>
                  <th>Coverage (subject)</th>
                  <th>Ack deadline</th>
                  <th>Verification</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.entryId} className={styles.queueRow}>
                    <td>
                      <div><strong>{e.displayNameEn}</strong></div>
                      <div className={styles.evidenceMeta}>{e.displayNameBn}</div>
                      <div className={styles.evidenceMeta}>{e.entryId}</div>
                    </td>
                    <td>{e.type}</td>
                    <td>{e.geographicCoverage.join(", ")}</td>
                    <td>{e.subjectCoverage.join(", ")}</td>
                    <td>{e.acknowledgmentDeadlineHours}h</td>
                    <td>
                      <span
                        className={`${styles.statusPill} ${
                          e.verificationStatus === "verified"
                            ? styles.statusPillOk
                            : e.verificationStatus === "expired"
                            ? styles.statusPillAlert
                            : styles.statusPillWarn
                        }`}
                      >
                        {e.verificationStatus}
                      </span>
                      <div className={styles.evidenceMeta}>effective {e.effectiveDate}{e.expiryDate ? ` · expires ${e.expiryDate}` : ""}</div>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {e.verificationStatus !== "verified" && (
                          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => markVerified(e.entryId)}>
                            Mark verified
                          </button>
                        )}
                        {e.verificationStatus !== "expired" && (
                          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => markExpired(e.entryId)}>
                            Mark expired
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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