"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  LawyerAssignmentService,
} from "@/lib/shakkho";
import type { AssignmentDeclineReason } from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

const REASONS: AssignmentDeclineReason[] = [
  "conflict_of_interest",
  "unavailable_during_critical_date",
  "matter_outside_panel_scope",
  "capacity_limitation",
  "incomplete_assignment_package",
  "other",
];

export default function LawyerAssignmentDetailPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  const [declineReason, setDeclineReason] = useState<AssignmentDeclineReason>("capacity_limitation");
  const [declineNote, setDeclineNote] = useState("");

  useEffect(() => { ensureSeeded(); }, []);
  const a = LawyerAssignmentService.find(envelope, assignmentId);

  function accept() {
    if (!a) return;
    LawyerAssignmentService.accept({ assignmentId: a.assignmentId, actor: a.lawyerId });
    LawyerAssignmentService.markActive({ assignmentId: a.assignmentId, actor: a.lawyerId });
    setTick((x) => x + 1);
  }
  function decline() {
    if (!a) return;
    LawyerAssignmentService.decline({ assignmentId: a.assignmentId, actor: a.lawyerId, reason: declineReason, note: declineNote });
    setDeclineNote("");
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/lawyer/assignments" className={styles.brand}>
          <span className={styles.brandEyebrow}>Lawyer workspace</span>
          <span>Assignment {assignmentId}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>Assignment detail</h1>
        {!a && <div className={styles.notice}>Not found.</div>}
        {a && (
          <>
            <section className={styles.section}>
              <div className={styles.row}>
                <div><div className={styles.kvLabel}>Case</div><div className={styles.kvValueMono}>{a.caseId}</div></div>
                <div><div className={styles.kvLabel}>State</div><div><span className={styles.tag}>{a.state}</span></div></div>
                <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>Reason for assignment</div><div>{a.reasonForAssignment}</div></div>
                <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>Required first action</div><div>{a.requiredFirstAction}</div></div>
                <div><div className={styles.kvLabel}>Response deadline</div><div className={styles.kvValueMono}>{a.responseDeadline?.slice(0, 16).replace("T", " ") ?? "—"}</div></div>
                <div><div className={styles.kvLabel}>Applicant preference considered</div><div>{a.applicantPreferenceConsidered ? "Yes" : "No"}</div></div>
              </div>
            </section>
            {(a.state === "prepared" || a.state === "offered" || a.state === "awaiting_response") && (
              <section className={styles.section}>
                <div className={styles.sectionTitle}>Decision</div>
                <div className={styles.actions}>
                  <button type="button" className={styles.btn} onClick={accept}>{t("lawyerAssignmentAccept")}</button>
                </div>
                <div className={styles.card} style={{ marginTop: 12 }}>
                  <div className={styles.formRow}>
                    <label>{t("lawyerAssignmentDeclineReason")}</label>
                    <select value={declineReason} onChange={(e) => setDeclineReason(e.target.value as AssignmentDeclineReason)}>
                      {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className={styles.formRow}>
                    <label>{t("lawyerAssignmentDeclineNote")}</label>
                    <input value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} />
                  </div>
                  <div className={styles.actions}>
                    <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={decline}>{t("lawyerAssignmentDecline")}</button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
