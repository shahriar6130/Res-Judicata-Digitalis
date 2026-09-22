"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  CaseProgressService,
  LawyerAssignmentService,
  DemoTimeService,
} from "@/lib/shakkho";
import type { ProgressUpdateType } from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

const UPDATE_TYPES: ProgressUpdateType[] = [
  "assignment_accepted",
  "client_contact_attempted",
  "client_contact_completed",
  "document_reviewed",
  "filing_prepared",
  "filing_submitted",
  "hearing_attended",
  "hearing_adjourned",
  "order_received",
  "next_hearing_recorded",
  "additional_information_required",
  "case_stage_changed",
  "outcome_reported",
  "unable_to_continue",
  "other",
];

const DEMO_LAWYER_ID = "law-moinul";

export default function LawyerCaseUpdatesPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();

  const [updateType, setUpdateType] = useState<ProgressUpdateType>("client_contact_completed");
  const [eventDate, setEventDate] = useState<string>(DemoTimeService.iso(envelope).slice(0, 10));
  const [summary, setSummary] = useState<string>("");
  const [court, setCourt] = useState<string>("");
  const [citizenVisible, setCitizenVisible] = useState<string>("");
  const [internalNote, setInternalNote] = useState<string>("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    ensureSeeded();
  }, []);

  const updates = useMemo(() => CaseProgressService.forCase(envelope, caseId), [envelope, caseId, tick]);
  const assignment = useMemo(
    () => LawyerAssignmentService.byCase(envelope, caseId).find((a) => a.state === "active"),
    [envelope, caseId],
  );

  function submit() {
    if (!summary || !assignment) return;
    CaseProgressService.recordProgress({
      caseId,
      lawyerId: assignment.lawyerId,
      updateType,
      eventDate: new Date(eventDate).toISOString(),
      summary,
      source: "lawyer_recorded",
      courtOrLocation: court || undefined,
      citizenVisibleSummary: citizenVisible || summary,
      internalNote: internalNote || undefined,
      actor: DEMO_LAWYER_ID,
    });
    setSummary("");
    setCitizenVisible("");
    setInternalNote("");
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={`/lawyer/cases/${caseId}`} className={styles.brand}>
          <span className={styles.brandEyebrow}>Lawyer workspace</span>
          <span>Updates — {caseId}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("lawyerCaseUpdateNew")}</h1>

        <section className={styles.section}>
          <div className={styles.card}>
            <div className={styles.formRow}>
              <label>{t("lawyerCaseUpdateType")}</label>
              <select value={updateType} onChange={(e) => setUpdateType(e.target.value as ProgressUpdateType)}>
                {UPDATE_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className={styles.formRow}>
              <label>{t("lawyerCaseUpdateEventDate")}</label>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label>{t("lawyerCaseUpdateCourt")}</label>
              <input value={court} onChange={(e) => setCourt(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label>{t("lawyerCaseUpdateSummary")}</label>
              <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label>{t("lawyerCaseUpdateCitizenVisible")}</label>
              <textarea rows={2} value={citizenVisible} onChange={(e) => setCitizenVisible(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label>{t("lawyerCaseUpdateInternal")}</label>
              <textarea rows={2} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.btn} onClick={submit}>{t("lawyerCaseUpdateSubmit")}</button>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>History</h2>
            <span className={styles.sectionSub}>{updates.length}</span>
          </div>
          <div className={styles.card}>
            {updates.length === 0 && <div className={styles.notice}>No updates yet.</div>}
            {updates.map((u) => (
              <div key={u.updateId} className={styles.row}>
                <div><div className={styles.kvLabel}>Type</div><div>{u.updateType}</div></div>
                <div><div className={styles.kvLabel}>Submitted</div><div className={styles.kvValueMono}>{u.submissionDate.slice(0, 16).replace("T", " ")}</div></div>
                <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>Summary</div><div>{u.summary}</div></div>
                {u.citizenVisibleSummary && <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>Citizen-visible</div><div>{u.citizenVisibleSummary}</div></div>}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
