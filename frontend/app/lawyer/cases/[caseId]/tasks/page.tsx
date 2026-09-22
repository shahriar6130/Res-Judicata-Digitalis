"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ensureSeeded, useHelplineStore, DlaoTaskService } from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function LawyerCaseTasksPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  useEffect(() => { ensureSeeded(); }, []);
  const tasks = DlaoTaskService.list(envelope).filter((t) => t.caseId === caseId);
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={`/lawyer/cases/${caseId}`} className={styles.brand}>
          <span className={styles.brandEyebrow}>Lawyer workspace</span>
          <span>{t("lawyerTasksTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("lawyerTasksTitle")} — {caseId}</h1>
        <section className={styles.section}>
          <div className={styles.card}>
            {tasks.length === 0 && <div className={styles.notice}>No tasks assigned.</div>}
            {tasks.map((t) => (
              <div key={t.taskId} className={styles.row}>
                <div><div className={styles.kvLabel}>Title</div><div>{t.title}</div></div>
                <div><div className={styles.kvLabel}>State</div><div><span className={styles.tag}>{t.state}</span></div></div>
                <div><div className={styles.kvLabel}>Priority</div><div><span className={t.priority === "high" || t.priority === "urgent" ? styles.tagDanger : styles.tag}>{t.priority}</span></div></div>
                <div><div className={styles.kvLabel}>Created</div><div className={styles.kvValueMono}>{t.createdAt.slice(0, 16).replace("T", " ")}</div></div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
