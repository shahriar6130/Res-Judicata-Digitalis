"use client";

import { use, useEffect, useMemo } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ensureSeeded, useHelplineStore, CitizenStatusService, TravelChecklistService, HearingService } from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function CitizenCaseStatusPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  useEffect(() => { ensureSeeded(); }, []);
  const summary = useMemo(() => CitizenStatusService.deriveSafeSummary(envelope, caseId), [envelope, caseId]);
  const upcoming = HearingService.upcoming(envelope, caseId)[0];
  const checklist = upcoming ? TravelChecklistService.evaluate(envelope, upcoming) : null;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("citizenStatusTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("citizenStatusTitle")}</h1>
        <p className={styles.intro}>{t("citizenStatusSafeIntro")}</p>
        {checklist && !checklist.travelRecommended && (
          <div className={styles.travelWarning}>{t("citizenStatusTravelAdvisory")}</div>
        )}
        <section className={styles.section}>
          <div className={styles.row}>
            <div><div className={styles.kvLabel}>Case</div><div className={styles.kvValueMono}>{summary.caseId}</div></div>
            <div><div className={styles.kvLabel}>{t("citizenStatusAssignedLawyer")}</div><div>{summary.assignedLawyerName ?? "—"}</div></div>
            <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>{t("citizenStatusNextHearing")}</div><div className={styles.kvValueMono}>{summary.nextVerifiedHearing?.hearingDate.slice(0, 10) ?? "—"} · {summary.nextVerifiedHearing?.court ?? "—"}</div></div>
            <div><div className={styles.kvLabel}>Verification</div><div><span className={styles.tag}>{summary.nextVerifiedHearing?.verificationStatus ?? "—"}</span></div></div>
            <div><div className={styles.kvLabel}>Attendance</div><div>{summary.attendanceRequired ?? "—"}</div></div>
            <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>{t("citizenStatusLastUpdate")}</div><div>{summary.lastVerifiedUpdateSummary ?? "—"}</div></div>
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.actions}>
            <Link href={`/voice-status/${caseId}`} className={styles.btn}>Voice / IVR status</Link>
            <Link href={`/citizen/cases/${caseId}/lawyer-change`} className={`${styles.btn} ${styles.btnGhost}`}>{t("citizenLawyerChangeTitle")}</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
