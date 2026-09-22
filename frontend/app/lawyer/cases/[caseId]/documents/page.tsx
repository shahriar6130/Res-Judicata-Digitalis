"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ensureSeeded, useHelplineStore } from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function LawyerCaseDocumentsPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const { lang, setLang, t } = useI18n();
  useEffect(() => { ensureSeeded(); }, []);
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={`/lawyer/cases/${caseId}`} className={styles.brand}>
          <span className={styles.brandEyebrow}>Lawyer workspace</span>
          <span>{t("lawyerDocumentsTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("lawyerDocumentsTitle")} — {caseId}</h1>
        <section className={styles.section}>
          <div className={styles.notice}>Document access surfaces here once the case is fully onboarded. Mocked for the prototype.</div>
        </section>
      </main>
    </div>
  );
}
