"use client";

import { use, useEffect, useMemo } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  HearingService,
  RequiredUpdateService,
  CaseProgressService,
  LawyerAssignmentService,
  ContactReliabilityService,
} from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function LawyerCaseWorkspace({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();

  useEffect(() => {
    ensureSeeded();
  }, []);

  const assignment = useMemo(
    () => LawyerAssignmentService.byCase(envelope, caseId).find((a) => a.state === "active"),
    [envelope, caseId],
  );
  const hearings = useMemo(() => HearingService.forCase(envelope, caseId), [envelope, caseId]);
  const updates = useMemo(() => CaseProgressService.forCase(envelope, caseId), [envelope, caseId]);
  const required = useMemo(() => RequiredUpdateService.forCase(envelope, caseId), [envelope, caseId]);
  const contacts = useMemo(() => ContactReliabilityService.forCase(envelope, caseId), [envelope, caseId]);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/lawyer/dashboard" className={styles.brand}>
          <span className={styles.brandEyebrow}>Lawyer workspace</span>
          <span>{t("lawyerCaseWorkspace")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>Case {caseId}</h1>
        {!assignment && <div className={styles.notice}>No active assignment for this case.</div>}
        {assignment && (
          <section className={styles.caseHero}>
            <Kpi label="Assignment" value={assignment.state} />
            <Kpi label="Application" value={assignment.applicationId} mono />
            <Kpi label="Active since" value={assignment.becameActiveAt?.slice(0, 10) ?? assignment.preparedAt.slice(0, 10)} />
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("lawyerHearingsTitle")}</h2>
            <Link href={`/lawyer/cases/${caseId}/hearings`} className={`${styles.btn} ${styles.btnGhost}`}>Manage</Link>
          </div>
          <div className={styles.card}>
            {hearings.length === 0 && <div className={styles.notice}>No hearings recorded.</div>}
            {hearings.map((h) => (
              <div key={h.hearingId} className={styles.row}>
                <div><div className={styles.kvLabel}>Court</div><div>{h.court}</div></div>
                <div><div className={styles.kvLabel}>Date</div><div className={styles.kvValueMono}>{h.hearingDate.slice(0, 16).replace("T", " ")}</div></div>
                <div><div className={styles.kvLabel}>Status</div><div><span className={styles.tag}>{h.verificationStatus}</span></div></div>
                <div><div className={styles.kvLabel}>Attendance</div><div>{h.attendanceRequirement}</div></div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Required updates</h2>
            <Link href={`/lawyer/cases/${caseId}/updates`} className={styles.btn}>Submit update</Link>
          </div>
          <div className={styles.card}>
            {required.length === 0 && <div className={styles.notice}>No required updates scheduled.</div>}
            {required.map((u) => (
              <div key={u.requirementId} className={`${styles.notice} ${u.state === "overdue" ? styles.noticeDanger : ""}`}>
                <div className={styles.kvLabel}>{u.requiredUpdateType} — {u.state}</div>
                <div>Due {u.dueAt.slice(0, 10)} (trigger: {u.trigger})</div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Submitted updates</h2>
            <span className={styles.sectionSub}>{updates.length}</span>
          </div>
          <div className={styles.card}>
            {updates.length === 0 && <div className={styles.notice}>No updates submitted yet.</div>}
            {updates.map((u) => (
              <div key={u.updateId} className={styles.row}>
                <div><div className={styles.kvLabel}>Type</div><div>{u.updateType}</div></div>
                <div><div className={styles.kvLabel}>Submitted</div><div className={styles.kvValueMono}>{u.submissionDate.slice(0, 10)}</div></div>
                <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>Summary</div><div>{u.summary}</div></div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Safe contact</h2>
          </div>
          <div className={styles.card}>
            {contacts.length === 0 && <div className={styles.notice}>No contact on file.</div>}
            {contacts.map((c) => (
              <div key={c.contactId} className={styles.row}>
                <div><div className={styles.kvLabel}>Owner</div><div>{c.numberOwner}</div></div>
                <div><div className={styles.kvLabel}>Channel</div><div>{c.channel}</div></div>
                <div><div className={styles.kvLabel}>Safe to use</div><div>{c.safeToUse ? "Yes" : "No"}</div></div>
                <div><div className={styles.kvLabel}>Reliability</div><div><span className={c.reliability === "high" ? styles.tagOk : styles.tag}>{c.reliability}</span></div></div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Kpi({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={`${styles.kpiValue} ${mono ? styles.kvValueMono : ""}`} style={{ fontSize: 16 }}>{value}</div>
    </div>
  );
}
