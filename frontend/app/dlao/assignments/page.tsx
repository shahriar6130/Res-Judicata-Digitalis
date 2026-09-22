"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  PanelLawyerDirectoryService,
  LawyerAssignmentService,
  DemoTimeService,
} from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function DlaoAssignmentsPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  const [selectedLawyerId, setSelectedLawyerId] = useState<string>("");
  const [applicationId, setApplicationId] = useState<string>("APP-2026-MALEK-01");
  const [caseId, setCaseId] = useState<string>("CASE-MALEK-01");
  const [firstAction, setFirstAction] = useState<string>("Initial client contact within 7 days.");
  const [hours, setHours] = useState<string>("48");
  useEffect(() => { ensureSeeded(); }, []);
  const lawyers = PanelLawyerDirectoryService.list(envelope);
  const eligible = PanelLawyerDirectoryService.eligibleFor(envelope, { court: "Barguna", matter: "compensation", language: "bn" });

  function prepare() {
    if (!selectedLawyerId || !applicationId || !caseId) return;
    LawyerAssignmentService.prepareAssignment({
      caseId,
      applicationId,
      lawyerId: selectedLawyerId,
      actor: "ড্যাশবোর্ড কর্মকর্তা",
      responseDeadline: new Date(Date.now() + Number(hours) * 60 * 60 * 1000).toISOString(),
      reasons: ["Court match", "Matter match", "Language match"],
      applicantPreferenceConsidered: true,
      conflictCheckCompleted: true,
      workloadReviewed: true,
      requiredFirstAction: firstAction,
    });
    setTick((x) => x + 1);
  }
  void DemoTimeService;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dlao/assignments" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAO workspace</span>
          <span>{t("dlaoAssignmentsTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("dlaoAssignmentsTitle")}</h1>
        <section className={styles.section}>
          <div className={styles.sectionTitle}>Eligible lawyers</div>
          <div className={styles.card}>
            <table className={styles.queue}>
              <thead>
                <tr><th>Lawyer</th><th>Status</th><th>Load</th><th>Reasons</th><th>Limitations</th></tr>
              </thead>
              <tbody>
                {eligible.map((e) => (
                  <tr key={e.lawyer.lawyerId}>
                    <td>{e.lawyer.fullNameEn}</td>
                    <td><span className={styles.tag}>{e.lawyer.availability}</span></td>
                    <td>{e.caseLoad}</td>
                    <td style={{ fontSize: 12 }}>{e.reasons.slice(0, 2).join("; ")}</td>
                    <td style={{ fontSize: 12 }}>{e.limitations.join("; ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>{t("dlaoAssignmentRecordDecision")}</div>
          <div className={styles.card}>
            <div className={styles.formRow}>
              <label>Application ID</label>
              <input value={applicationId} onChange={(e) => setApplicationId(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label>Case ID</label>
              <input value={caseId} onChange={(e) => setCaseId(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label>{t("dlaoAssignmentSelectedLawyer")}</label>
              <select value={selectedLawyerId} onChange={(e) => setSelectedLawyerId(e.target.value)}>
                <option value="">— select —</option>
                {lawyers.map((l) => <option key={l.lawyerId} value={l.lawyerId}>{l.fullNameEn} ({l.availability})</option>)}
              </select>
            </div>
            <div className={styles.formRow}>
              <label>{t("dlaoAssignmentResponseDeadline")} (hours from now)</label>
              <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label>{t("dlaoAssignmentRequiredFirstAction")}</label>
              <input value={firstAction} onChange={(e) => setFirstAction(e.target.value)} />
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.btn} onClick={prepare}>{t("dlaoAssignmentPrepare")}</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
