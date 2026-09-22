"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  LawyerAssignmentService,
} from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function LawyerAssignmentsPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  useEffect(() => { ensureSeeded(); }, []);
  const assignments = useMemo(() => LawyerAssignmentService.list(envelope), [envelope]);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/lawyer/dashboard" className={styles.brand}>
          <span className={styles.brandEyebrow}>Lawyer workspace</span>
          <span>All assignments</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>All assignments</h1>
        <section className={styles.section}>
          <div className={styles.card}>
            <table className={styles.queue}>
              <thead>
                <tr>
                  <th>Case</th>
                  <th>State</th>
                  <th>Lawyer</th>
                  <th>Active since</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.assignmentId}>
                    <td className={styles.kvValueMono}>{a.caseId}</td>
                    <td><span className={styles.tag}>{a.state}</span></td>
                    <td>{a.lawyerId}</td>
                    <td className={styles.kvValueMono}>{a.becameActiveAt?.slice(0, 10) ?? a.preparedAt.slice(0, 10)}</td>
                    <td><Link href={`/lawyer/cases/${a.caseId}`} className={`${styles.btn} ${styles.btnGhost}`}>{t("lawyerOpenCase")}</Link></td>
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
