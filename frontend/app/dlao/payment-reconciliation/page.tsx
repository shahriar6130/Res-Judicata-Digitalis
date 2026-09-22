"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ensureSeeded, useHelplineStore, PaymentReconciliationService } from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function DlaoPaymentIndexPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  useEffect(() => { ensureSeeded(); }, []);
  const list = PaymentReconciliationService.list(envelope);
  const groupedByCase = new Map<string, typeof list>();
  for (const r of list) {
    const arr = groupedByCase.get(r.caseId) ?? [];
    arr.push(r);
    groupedByCase.set(r.caseId, arr);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dlao/payment-reconciliation" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAO workspace</span>
          <span>{t("dlaoPaymentTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("dlaoPaymentTitle")}</h1>
        <div className={styles.disclaimer}>{t("dlaoPaymentDisclaimer")}</div>
        <section className={styles.section}>
          <div className={styles.card}>
            {groupedByCase.size === 0 && <div className={styles.notice}>No worksheets prepared yet.</div>}
            {Array.from(groupedByCase.entries()).map(([caseId, items]) => (
              <div key={caseId} className={styles.row}>
                <div><div className={styles.kvLabel}>Case</div><div className={styles.kvValueMono}>{caseId}</div></div>
                <div><div className={styles.kvLabel}>Worksheets</div><div>{items.length}</div></div>
                <div><div className={styles.kvLabel}>State</div><div><span className={styles.tag}>{items[items.length - 1].state}</span></div></div>
                <div><Link href={`/dlao/payment-reconciliation/${caseId}`} className={`${styles.btn} ${styles.btnGhost}`}>Open</Link></div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
