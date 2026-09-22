"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ensureSeeded, useHelplineStore, LawyerChangeRequestService } from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function DlaoChangeRequestsPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  useEffect(() => { ensureSeeded(); }, []);
  const requests = LawyerChangeRequestService.list(envelope);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dlao/lawyer-change-requests" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAO workspace</span>
          <span>{t("dlaoChangeRequestsTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("dlaoChangeRequestsTitle")}</h1>
        <section className={styles.section}>
          <div className={styles.card}>
            <table className={styles.queue}>
              <thead>
                <tr><th>Case</th><th>Applicant</th><th>Reason</th><th>State</th><th>Action</th></tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.requestId}>
                    <td className={styles.kvValueMono}>{r.caseId}</td>
                    <td>{r.applicantName}</td>
                    <td>{r.reasonCategory}</td>
                    <td><span className={styles.tag}>{r.state}</span></td>
                    <td><Link href={`/dlao/lawyer-change-requests/${r.requestId}`} className={`${styles.btn} ${styles.btnGhost}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
