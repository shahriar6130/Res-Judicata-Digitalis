"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  LawyerAvailabilityService,
  LawyerAvailabilityStatus,
} from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

const DEMO_LAWYER_ID = "law-moinul";
const STATUSES: LawyerAvailabilityStatus[] = ["available", "busy", "temporarily_unavailable", "on_approved_leave", "not_accepting_new"];

export default function LawyerAvailabilityPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<LawyerAvailabilityStatus>("busy");
  const [note, setNote] = useState<string>("");

  useEffect(() => { ensureSeeded(); }, []);
  const current = LawyerAvailabilityService.forLawyer(envelope, DEMO_LAWYER_ID);

  function submit() {
    LawyerAvailabilityService.setStatus({ lawyerId: DEMO_LAWYER_ID, status, actor: DEMO_LAWYER_ID, note });
    setNote("");
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/lawyer/dashboard" className={styles.brand}>
          <span className={styles.brandEyebrow}>Lawyer workspace</span>
          <span>{t("lawyerAvailabilityTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("lawyerAvailabilityTitle")}</h1>
        <section className={styles.section}>
          <div className={styles.kvLabel}>{t("lawyerAvailabilityCurrent")}</div>
          <div><span className={styles.tag}>{current?.status ?? "unknown"}</span></div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionTitle}>{t("lawyerAvailabilitySetStatus")}</div>
          <div className={styles.card}>
            <div className={styles.formRow}>
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as LawyerAvailabilityStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.formRow}>
              <label>{t("lawyerAvailabilityNote")}</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.btn} onClick={submit}>{t("lawyerAvailabilitySetStatus")}</button>
            </div>
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.notice}>Stale availability is never treated as misconduct — only structured inactivity-pattern reviews flag concerns.</div>
        </section>
      </main>
    </div>
  );
}
