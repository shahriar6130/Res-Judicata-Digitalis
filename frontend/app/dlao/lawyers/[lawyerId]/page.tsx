"use client";

import { use, useEffect, useMemo } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  PanelLawyerDirectoryService,
  LawyerAssignmentService,
  HearingService,
  RequiredUpdateService,
  ReportingService,
} from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function DlaoLawyerProfile({ params }: { params: Promise<{ lawyerId: string }> }) {
  const { lawyerId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();

  useEffect(() => { ensureSeeded(); }, []);
  const lawyer = PanelLawyerDirectoryService.find(envelope, lawyerId);
  const active = useMemo(() => LawyerAssignmentService.activeForLawyer(envelope, lawyerId), [envelope, lawyerId]);
  const overdue = useMemo(() => RequiredUpdateService.overdueForLawyer(envelope, lawyerId), [envelope, lawyerId]);
  const upcoming = useMemo(
    () => active.flatMap((a) => HearingService.forCase(envelope, a.caseId).filter((h) => new Date(h.hearingDate).getTime() >= Date.now())),
    [envelope, active],
  );
  const days = useMemo(() => ReportingService.daysSinceLastActivity(envelope, lawyerId), [envelope, lawyerId]);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dlao/lawyers" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAO workspace</span>
          <span>{t("dlaoLawyerProfileTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{lawyer?.fullNameEn ?? lawyerId}</h1>
        {!lawyer && <div className={styles.notice}>Not found.</div>}
        {lawyer && (
          <>
            <section className={styles.caseHero}>
              <Kpi label="Status" value={lawyer.panelStatus} />
              <Kpi label="Availability" value={lawyer.availability} />
              <Kpi label="Active cases" value={String(lawyer.activeCaseCount)} />
              <Kpi label="Days since last activity" value={days === 9999 ? "n/a" : String(days)} />
            </section>
            <section className={styles.section}>
              <div className={styles.sectionTitle}>{t("dlaoLawyerActiveCases")}</div>
              <div className={styles.card}>
                {active.length === 0 && <div className={styles.notice}>No active cases.</div>}
                {active.map((a) => (
                  <div key={a.assignmentId} className={styles.row}>
                    <div><div className={styles.kvLabel}>Case</div><div className={styles.kvValueMono}>{a.caseId}</div></div>
                    <div><div className={styles.kvLabel}>Application</div><div className={styles.kvValueMono}>{a.applicationId}</div></div>
                  </div>
                ))}
              </div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionTitle}>{t("dlaoLawyerUpcomingHearings")}</div>
              <div className={styles.card}>
                {upcoming.length === 0 && <div className={styles.notice}>No upcoming hearings.</div>}
                {upcoming.map((h) => (
                  <div key={h.hearingId} className={styles.row}>
                    <div><div className={styles.kvLabel}>Court</div><div>{h.court}</div></div>
                    <div><div className={styles.kvLabel}>Date</div><div className={styles.kvValueMono}>{h.hearingDate.slice(0, 16).replace("T", " ")}</div></div>
                    <div><div className={styles.kvLabel}>Case</div><div className={styles.kvValueMono}>{h.caseId}</div></div>
                    <div><div className={styles.kvLabel}>Status</div><div><span className={styles.tag}>{h.verificationStatus}</span></div></div>
                  </div>
                ))}
              </div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionTitle}>{t("dlaoLawyerOverdueUpdates")}</div>
              <div className={styles.card}>
                {overdue.length === 0 && <div className={styles.notice}>No overdue updates.</div>}
                {overdue.map((u) => (
                  <div key={u.requirementId} className={`${styles.notice} ${styles.noticeDanger}`}>
                    {u.caseId} — {u.requiredUpdateType} (due {u.dueAt.slice(0, 10)})
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue} style={{ fontSize: 16 }}>{value}</div>
    </div>
  );
}
