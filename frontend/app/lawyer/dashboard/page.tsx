"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  LawyerWorklistService,
  RequiredUpdateService,
  HearingService,
  ReportingService,
  LawyerAssignmentService,
  DemoTimeService,
} from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

const DEMO_LAWYER_ID = "law-moinul";

export default function LawyerDashboardPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    ensureSeeded();
  }, []);

  const worklist = useMemo(
    () => LawyerWorklistService.forLawyer(envelope, DEMO_LAWYER_ID),
    [envelope],
  );
  const overdue = useMemo(
    () => LawyerWorklistService.overdueUpdates(envelope, DEMO_LAWYER_ID),
    [envelope],
  );
  const hearings = useMemo(
    () => LawyerWorklistService.hearingsNext7Days(envelope, DEMO_LAWYER_ID),
    [envelope],
  );

  const now = DemoTimeService.now(envelope);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = todayStart.getTime() + 24 * 60 * 60 * 1000;
  const today = hearings.filter((h) => {
    const t = new Date(h.hearingDate).getTime();
    return t >= todayStart.getTime() && t < todayEnd;
  });

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/lawyer/dashboard" className={styles.brand}>
          <span className={styles.brandEyebrow}>Lawyer workspace</span>
          <span>{t("lawyerDashboardTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("lawyerDashboardTitle")}</h1>
        <p className={styles.intro}>{t("lawyerDashboardSubtitle")}</p>

        <section className={styles.kpiGrid}>
          <Kpi label={t("lawyerKpiAwaiting")} value={worklist.awaitingResponse.length} />
          <Kpi label={t("lawyerKpiActive")} value={worklist.active.length} />
          <Kpi label={t("lawyerKpiHearingsToday")} value={today.length} />
          <Kpi label={t("lawyerKpiHearingsWeek")} value={hearings.length} />
          <Kpi label={t("lawyerKpiDueUpdates")} value={RequiredUpdateService.forCase.length} value2={overdue.length + " overdue"} danger />
          <Kpi label={t("lawyerKpiHandover")} value={worklist.handoverRequired.length} />
          <Kpi label={t("lawyerKpiCompleted")} value={worklist.recentlyCompleted.length} />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("lawyerWorklistTitle")}</h2>
            <span className={styles.sectionSub}>{worklist.active.length} active</span>
          </div>
          <div className={styles.card}>
            {worklist.active.length === 0 && <div className={styles.empty}>{t("lawyerWorklistEmpty")}</div>}
            {worklist.active.map((a) => (
              <div key={a.assignmentId} className={styles.row}>
                <div>
                  <div className={styles.kvLabel}>Case</div>
                  <div className={styles.kvValueMono}>{a.caseId}</div>
                </div>
                <div>
                  <div className={styles.kvLabel}>Application</div>
                  <div className={styles.kvValueMono}>{a.applicationId}</div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div className={styles.kvLabel}>Required first action</div>
                  <div>{a.requiredFirstAction}</div>
                </div>
                <div style={{ gridColumn: "1 / -1" }} className={styles.actions}>
                  <Link href={`/lawyer/cases/${a.caseId}`} className={`${styles.btn} ${styles.btnGhost}`}>{t("lawyerOpenCase")}</Link>
                  <Link href={`/lawyer/cases/${a.caseId}/updates`} className={styles.btn}>Submit update</Link>
                  <Link href={`/lawyer/cases/${a.caseId}/hearings`} className={`${styles.btn} ${styles.btnGhost}`}>Hearings</Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("lawyerKpiOverdue")}</h2>
            <span className={styles.sectionSub}>{overdue.length}</span>
          </div>
          <div className={styles.card}>
            {overdue.length === 0 && <div className={styles.notice}>No overdue updates.</div>}
            {overdue.map((u) => (
              <div key={u.requirementId} className={`${styles.notice} ${styles.noticeDanger}`}>
                <div className={styles.kvLabel}>Case {u.caseId}</div>
                <div>{u.requiredUpdateType} — due {u.dueAt.slice(0, 10)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("lawyerKpiHearingsWeek")}</h2>
            <span className={styles.sectionSub}>{hearings.length}</span>
          </div>
          <div className={styles.card}>
            {hearings.length === 0 && <div className={styles.notice}>No hearings scheduled in the next 7 days.</div>}
            {hearings.map((h) => (
              <div key={h.hearingId} className={styles.row}>
                <div>
                  <div className={styles.kvLabel}>Case</div>
                  <div className={styles.kvValueMono}>{h.caseId}</div>
                </div>
                <div>
                  <div className={styles.kvLabel}>Court</div>
                  <div>{h.court}</div>
                </div>
                <div>
                  <div className={styles.kvLabel}>Date</div>
                  <div className={styles.kvValueMono}>{h.hearingDate.slice(0, 16).replace("T", " ")}</div>
                </div>
                <div>
                  <div className={styles.kvLabel}>Status</div>
                  <div><span className={styles.tag}>{h.verificationStatus}</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Demo controls</h2>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={() => { DemoTimeService.advance(24, "lawyer-demo"); setTick((x) => x + 1); }}>{t("demoAdvance24h")}</button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => { DemoTimeService.advance(72, "lawyer-demo"); setTick((x) => x + 1); }}>{t("demoAdvance72h")}</button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => { ReportingService.overdueCaseUpdates(envelope); setTick((x) => x + 1); }}>Recompute overdue</button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => { LawyerAssignmentService.recalculateExpired(); setTick((x) => x + 1); }}>Recompute expired offers</button>
          </div>
        </section>
      </main>
    </div>
  );
}

function Kpi({ label, value, value2, danger }: { label: string; value: number | string; value2?: string; danger?: boolean }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={`${styles.kpiValue} ${danger ? styles.kpiDanger : ""}`}>{value}</div>
      {value2 && <div className={styles.sectionSub}>{value2}</div>}
    </div>
  );
}
