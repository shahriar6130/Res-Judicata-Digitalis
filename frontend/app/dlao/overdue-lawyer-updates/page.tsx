"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ensureSeeded, useHelplineStore, RequiredUpdateService, ReportingService } from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function DlaoOverdueUpdatesPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  useEffect(() => { ensureSeeded(); }, []);
  const overdue = useMemo(() => ReportingService.overdueCaseUpdates(envelope), [envelope]);
  const allByLawyer = useMemo(() => {
    const map = new Map<string, typeof overdue>();
    for (const u of overdue) {
      const list = map.get(u.lawyerId) ?? [];
      list.push(u);
      map.set(u.lawyerId, list);
    }
    return map;
  }, [overdue]);

  void RequiredUpdateService;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dlao/overdue-lawyer-updates" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAO workspace</span>
          <span>{t("dlaoOverdueTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("dlaoOverdueTitle")}</h1>
        <p className={styles.intro}>No automatic reassignment occurs from overdue alerts — see Inactivity Pattern Review for the structured process.</p>
        <section className={styles.section}>
          <div className={styles.card}>
            {Array.from(allByLawyer.entries()).length === 0 && <div className={styles.notice}>No overdue updates.</div>}
            {Array.from(allByLawyer.entries()).map(([lawyerId, items]) => (
              <div key={lawyerId} style={{ marginBottom: 12 }}>
                <h3 className={styles.sectionTitle}>{lawyerId}</h3>
                {items.map((u) => {
                  const days = Math.max(0, Math.round((Date.now() - new Date(u.dueAt).getTime()) / (24 * 60 * 60 * 1000)));
                  return (
                    <div key={u.requirementId} className={`${styles.notice} ${styles.noticeDanger}`}>
                      <div className={styles.kvLabel}>{u.caseId} — {u.requiredUpdateType}</div>
                      <div>{t("dlaoOverdueAlert").replace("{days}", String(days))}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
