"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  LawyerChangeRequestService,
  LawyerAssignmentService,
} from "@/lib/shakkho";
import type { LawyerChangeReasonCategory } from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

const REASONS: LawyerChangeReasonCategory[] = [
  "unable_to_contact_lawyer",
  "no_case_update_received",
  "hearing_information_not_provided",
  "communication_accessibility_problem",
  "safety_or_trust_concern",
  "conflict_concern",
  "lawyer_reported_inability_to_continue",
  "other",
];

export default function CitizenLawyerChangePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [reason, setReason] = useState<LawyerChangeReasonCategory>("no_case_update_received");
  const [statement, setStatement] = useState<string>("");
  const [applicantName, setApplicantName] = useState<string>("");
  const [assistedBy, setAssistedBy] = useState<string>("");
  const [tick, setTick] = useState(0);
  useEffect(() => { ensureSeeded(); }, []);
  const assignment = LawyerAssignmentService.byCase(envelope, caseId).find((a) => a.state === "active");

  function submit() {
    if (!assignment || !statement || !applicantName) return;
    LawyerChangeRequestService.submit({
      caseId,
      applicationId: assignment.applicationId,
      currentLawyerId: assignment.lawyerId,
      submittedThrough: assistedBy ? "dlao_assisted" : "self",
      reasonCategory: reason,
      reasonNote: statement,
      applicantName,
      actor: assistedBy || "citizen",
      assistedBy: assistedBy || undefined,
    });
    setStatement("");
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={`/citizen/cases/${caseId}/status`} className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("citizenLawyerChangeTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("citizenLawyerChangeTitle")}</h1>
        <p className={styles.intro}>Plain-language form. The submission is routed to the DLAO for triage and human review.</p>
        <section className={styles.section}>
          <div className={styles.card}>
            <div className={styles.formRow}>
              <label>Applicant name</label>
              <input value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label>{t("citizenLawyerChangeReason")}</label>
              <select value={reason} onChange={(e) => setReason(e.target.value as LawyerChangeReasonCategory)}>
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className={styles.formRow}>
              <label>{t("citizenLawyerChangeStatement")}</label>
              <textarea rows={4} value={statement} onChange={(e) => setStatement(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label>{t("citizenLawyerChangeAssistedBy")}</label>
              <input value={assistedBy} onChange={(e) => setAssistedBy(e.target.value)} placeholder="UDC staff or DLAO officer name (if assisted)" />
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.btn} onClick={submit}>{t("citizenLawyerChangeSubmit")}</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}