"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ensureSeeded, useHelplineStore, ReassignmentService, CaseHandoverService } from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function DlaoReassignmentPage({ params }: { params: Promise<{ reassignmentId: string }> }) {
  const { reassignmentId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  useEffect(() => { ensureSeeded(); }, []);
  const r = ReassignmentService.find(envelope, reassignmentId);
  void CaseHandoverService;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dlao/lawyer-change-requests" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAO workspace</span>
          <span>{t("dlaoReassignmentTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("dlaoReassignmentTitle")}</h1>
        {!r && <div className={styles.notice}>Not found.</div>}
        {r && (
          <section className={styles.section}>
            <div className={styles.row}>
              <div><div className={styles.kvLabel}>Case</div><div className={styles.kvValueMono}>{r.caseId}</div></div>
              <div><div className={styles.kvLabel}>From lawyer</div><div className={styles.kvValueMono}>{r.fromLawyerId}</div></div>
              <div><div className={styles.kvLabel}>To lawyer</div><div className={styles.kvValueMono}>{r.toLawyerId ?? "—"}</div></div>
              <div><div className={styles.kvLabel}>Recorded</div><div className={styles.kvValueMono}>{r.recordedAt.slice(0, 16).replace("T", " ")}</div></div>
              <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>Decision</div><div>{r.decision.decision}</div></div>
              <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>Reason</div><div>{r.decision.reason}</div></div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}