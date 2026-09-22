"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ensureSeeded, useHelplineStore, PanelLawyerDirectoryService } from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function DlaoLawyersPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  useEffect(() => { ensureSeeded(); }, []);
  const lawyers = PanelLawyerDirectoryService.list(envelope);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dlao/lawyers" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAO workspace</span>
          <span>{t("dlaoLawyersTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("dlaoLawyersTitle")}</h1>
        <section className={styles.section}>
          <div className={styles.card}>
            <table className={styles.queue}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Availability</th>
                  <th>Active</th>
                  <th>Overdue</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lawyers.map((l) => (
                  <tr key={l.lawyerId}>
                    <td className={styles.kvValueMono}>{l.lawyerId}</td>
                    <td>{l.fullNameEn}</td>
                    <td><span className={styles.tag}>{l.panelStatus}</span></td>
                    <td><span className={l.availability === "on_approved_leave" ? styles.tagDanger : styles.tag}>{l.availability}</span></td>
                    <td>{l.activeCaseCount}</td>
                    <td>{l.overdueRequiredUpdateCount}</td>
                    <td><Link href={`/dlao/lawyers/${l.lawyerId}`} className={`${styles.btn} ${styles.btnGhost}`}>Open</Link></td>
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
