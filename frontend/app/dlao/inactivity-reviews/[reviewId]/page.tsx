"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  InactivityPatternService,
  PanelLawyerDirectoryService,
  RequiredUpdateService,
  HearingService,
} from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function DlaoInactivityReviewPage({ params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState<string>("");
  useEffect(() => { ensureSeeded(); }, []);
  const pattern = InactivityPatternService.find(envelope, reviewId);

  function decide(action: "human_review" | "explanation_requested" | "resolved_operationally" | "dismissed" | "monitoring" | "formal_review_recommended") {
    if (!pattern) return;
    InactivityPatternService.transition({ patternId: pattern.patternId, to: action, actor: "DLAO officer", payload: { reason: note || "Review decision recorded", note } });
    setNote("");
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dlao/inactivity-reviews" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAO workspace</span>
          <span>Pattern review</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>Inactivity pattern review</h1>
        {!pattern && <div className={styles.notice}>Not found.</div>}
        {pattern && (() => {
          const lawyer = PanelLawyerDirectoryService.find(envelope, pattern.lawyerId);
          const exc = InactivityPatternService.evaluateExceptions(envelope, pattern.lawyerId);
          return (
            <>
              <section className={styles.section}>
                <div className={styles.row}>
                  <div><div className={styles.kvLabel}>{t("dlaoInactivityRow")}</div><div>{lawyer?.fullNameEn ?? pattern.lawyerId}</div></div>
                  <div><div className={styles.kvLabel}>State</div><div><span className={styles.tag}>{pattern.state}</span></div></div>
                  <div><div className={styles.kvLabel}>{t("dlaoInactivityContributing")}</div><div>{pattern.contributingCaseIds.length}</div></div>
                  <div><div className={styles.kvLabel}>Threshold</div><div>{pattern.threshold.crossCaseCount}+ cases</div></div>
                  <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>{t("delaInactivityExceptions")}</div><div>{exc.notes.join("; ") || "None"}</div></div>
                </div>
              </section>
              <section className={styles.section}>
                <div className={styles.sectionTitle}>Contributing cases</div>
                <div className={styles.card}>
                  {pattern.contributingCaseIds.map((cid) => {
                    const overdue = RequiredUpdateService.forCase(envelope, cid);
                    const hearings = HearingService.forCase(envelope, cid);
                    return (
                      <div key={cid} style={{ marginBottom: 12 }}>
                        <div className={styles.kvValueMono}>{cid}</div>
                        <div className={styles.sectionSub}>{overdue.length} overdue updates · {hearings.length} hearings</div>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className={styles.section}>
                <div className={styles.sectionTitle}>{t("dlaoInactivityDecision")}</div>
                <div className={styles.card}>
                  <div className={styles.formRow}>
                    <label>Note</label>
                    <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                  <div className={styles.actions}>
                    <button type="button" className={styles.btn} onClick={() => decide("human_review")}>Move to human review</button>
                    <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => decide("explanation_requested")}>Request explanations</button>
                    <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => decide("resolved_operationally")}>{t("dlaoInactivityDecisionResolved")}</button>
                    <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => decide("dismissed")}>{t("dlaoInactivityDecisionDismiss")}</button>
                    <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => decide("formal_review_recommended")}>{t("dlaoInactivityDecisionFormal")}</button>
                    <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => decide("monitoring")}>{t("dlaoInactivityDecisionMonitor")}</button>
                  </div>
                </div>
              </section>
              <section className={styles.section}>
                <div className={styles.notice}>No automatic misconduct finding. No recoverable amount recorded on the pattern review path — see the separate Payment Reconciliation workspace for that.</div>
              </section>
            </>
          );
        })()}
      </main>
    </div>
  );
}
