"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  HearingService,
} from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

const DEMO_LAWYER_ID = "law-moinul";

export default function LawyerCaseHearingsPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    ensureSeeded();
  }, []);

  const hearings = useMemo(() => HearingService.forCase(envelope, caseId), [envelope, caseId, tick]);
  const [resultByHearing, setResultByHearing] = useState<Record<string, string>>({});

  function verify(hearingId: string) {
    HearingService.verifyHearing({ hearingId, actor: DEMO_LAWYER_ID });
    setTick((x) => x + 1);
  }
  function recordResult(hearingId: string) {
    const summary = resultByHearing[hearingId];
    if (!summary) return;
    HearingService.recordResult({
      hearingId,
      actor: DEMO_LAWYER_ID,
      result: {
        recordedAt: new Date().toISOString(),
        recordedBy: DEMO_LAWYER_ID,
        outcome: "hearing_held",
        summary,
      },
    });
    setResultByHearing({ ...resultByHearing, [hearingId]: "" });
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={`/lawyer/cases/${caseId}`} className={styles.brand}>
          <span className={styles.brandEyebrow}>Lawyer workspace</span>
          <span>{t("lawyerHearingsTitle")} — {caseId}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("lawyerHearingsTitle")}</h1>
        <section className={styles.section}>
          <div className={styles.card}>
            {hearings.length === 0 && <div className={styles.notice}>No hearings on file.</div>}
            {hearings.map((h) => (
              <div key={h.hearingId} className={styles.row}>
                <div><div className={styles.kvLabel}>Court</div><div>{h.court}</div></div>
                <div><div className={styles.kvLabel}>Date</div><div className={styles.kvValueMono}>{h.hearingDate.slice(0, 16).replace("T", " ")}</div></div>
                <div><div className={styles.kvLabel}>Status</div><div><span className={styles.tag}>{h.verificationStatus}</span></div></div>
                <div><div className={styles.kvLabel}>Attendance</div><div>{h.attendanceRequirement}</div></div>
                <div style={{ gridColumn: "1 / -1" }} className={styles.actions}>
                  {(h.verificationStatus === "reported" || h.verificationStatus === "awaiting_verification") && (
                    <button type="button" className={styles.btn} onClick={() => verify(h.hearingId)}>{t("lawyerHearingMarkVerified")}</button>
                  )}
                  {h.verificationStatus === "verified" && (
                    <>
                      <input
                        placeholder={t("lawyerHearingResultSummary")}
                        value={resultByHearing[h.hearingId] ?? ""}
                        onChange={(e) => setResultByHearing({ ...resultByHearing, [h.hearingId]: e.target.value })}
                      />
                      <button type="button" className={styles.btn} onClick={() => recordResult(h.hearingId)}>{t("lawyerHearingRecordResult")}</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
