"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  InactivityPatternService,
  RequiredUpdateService,
  HearingService,
  LawyerAssignmentService,
  PanelLawyerDirectoryService,
} from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function DlaoInactivityReviewsPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  useEffect(() => { ensureSeeded(); }, []);
  const patterns = useMemo(() => InactivityPatternService.list(envelope), [envelope, tick]);

  function detect() {
    InactivityPatternService.detectPatterns();
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dlao/inactivity-reviews" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAO workspace</span>
          <span>{t("dlaoInactivityTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("dlaoInactivityTitle")}</h1>
        <section className={styles.section}>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={detect}>Run pattern detection</button>
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.card}>
            {patterns.length === 0 && <div className={styles.notice}>No patterns detected.</div>}
            {patterns.map((p) => {
              const lawyer = PanelLawyerDirectoryService.find(envelope, p.lawyerId);
              const exc = InactivityPatternService.evaluateExceptions(envelope, p.lawyerId);
              return (
                <div key={p.patternId} className={styles.row} style={{ borderBottom: "1px dashed var(--line)", paddingBottom: 12 }}>
                  <div><div className={styles.kvLabel}>{t("dlaoInactivityRow")}</div><div>{lawyer?.fullNameEn ?? p.lawyerId}</div></div>
                  <div><div className={styles.kvLabel}>State</div><div><span className={styles.tag}>{p.state}</span></div></div>
                  <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>{t("dlaoInactivityContributing")}</div><div>{p.contributingCaseIds.length} cases</div></div>
                  <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>{t("delaInactivityExceptions")}</div><div>{exc.notes.join("; ") || "None"}</div></div>
                  <div style={{ gridColumn: "1 / -1" }} className={styles.actions}>
                    <Link href={`/dlao/inactivity-reviews/${p.patternId}`} className={`${styles.btn} ${styles.btnGhost}`}>Open review</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.notice}>Pattern review is intentionally separate from the lawyer-change workflow (service continuity) and payment reconciliation. Leave, outage, waived, stayed and alt-channel submissions suppress the alert.</div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionTitle}>Supporting counts</div>
          <div className={styles.card}>
            <div><div className={styles.kvLabel}>Total required updates</div><div>RequiredUpdateService: {RequiredUpdateService.list(envelope).length}</div></div>
            <div><div className={styles.kvLabel}>Total hearings</div><div>HearingService: {HearingService.list(envelope).length}</div></div>
            <div><div className={styles.kvLabel}>Total active assignments</div><div>LawyerAssignmentService: {LawyerAssignmentService.list(envelope).filter((a) => a.state === "active").length}</div></div>
          </div>
        </section>
      </main>
    </div>
  );
}
