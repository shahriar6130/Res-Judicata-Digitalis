"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  LawyerChangeRequestService,
  RequiredUpdateService,
  HearingService,
  ContactReliabilityService,
  PanelLawyerDirectoryService,
} from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

const DEMO_REVIEWER = "ডিএলএও কর্মকর্তা";

export default function DlaoChangeRequestWorkspace({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  const [reason, setReason] = useState<string>("Reassignment approved after review");

  useEffect(() => { ensureSeeded(); }, []);
  const req = LawyerChangeRequestService.find(envelope, requestId);
  const overdue = req ? RequiredUpdateService.forCase(envelope, req.caseId) : [];
  const hearings = req ? HearingService.forCase(envelope, req.caseId) : [];
  const contacts = req ? ContactReliabilityService.forCase(envelope, req.caseId) : [];
  const candidateLawyers = req ? PanelLawyerDirectoryService.eligibleFor(envelope, { excludeLawyerIds: [req.requestId] }) : [];

  function decide(decision: "approve" | "retain" | "clarify" | "escalate") {
    if (!req) return;
    if (decision === "approve") LawyerChangeRequestService.approveReassignment({ requestId: req.requestId, actor: DEMO_REVIEWER, reason });
    if (decision === "retain") LawyerChangeRequestService.retainWithAction({ requestId: req.requestId, actor: DEMO_REVIEWER, reason, action: "Corrective action recorded" });
    if (decision === "clarify") LawyerChangeRequestService.requestClarification({ requestId: req.requestId, actor: DEMO_REVIEWER, question: reason });
    if (decision === "escalate") LawyerChangeRequestService.escalate({ requestId: req.requestId, actor: DEMO_REVIEWER, reason });
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dlao/lawyer-change-requests" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAO workspace</span>
          <span>{t("dlaoChangeRequestWorkspaceTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("dlaoChangeRequestWorkspaceTitle")}</h1>
        {!req && <div className={styles.notice}>Not found.</div>}
        {req && (
          <>
            <section className={styles.section}>
              <div className={styles.row}>
                <div><div className={styles.kvLabel}>Case</div><div className={styles.kvValueMono}>{req.caseId}</div></div>
                <div><div className={styles.kvLabel}>Applicant</div><div>{req.applicantName}</div></div>
                <div><div className={styles.kvLabel}>Reason</div><div>{req.reasonCategory}</div></div>
                <div><div className={styles.kvLabel}>State</div><div><span className={styles.tag}>{req.state}</span></div></div>
                <div style={{ gridColumn: "1 / -1" }}><div className={styles.kvLabel}>Statement</div><div>{req.reasonNote}</div></div>
              </div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Overdue updates</div>
              <div className={styles.card}>
                {overdue.length === 0 && <div className={styles.notice}>No overdue updates.</div>}
                {overdue.map((u) => (
                  <div key={u.requirementId} className={`${styles.notice} ${styles.noticeDanger}`}>
                    {u.requiredUpdateType} — {u.state} (due {u.dueAt.slice(0, 10)})
                  </div>
                ))}
              </div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Hearing history</div>
              <div className={styles.card}>
                {hearings.length === 0 && <div className={styles.notice}>No hearings recorded.</div>}
                {hearings.map((h) => (
                  <div key={h.hearingId} className={styles.row}>
                    <div><div className={styles.kvLabel}>Court</div><div>{h.court}</div></div>
                    <div><div className={styles.kvLabel}>Date</div><div className={styles.kvValueMono}>{h.hearingDate.slice(0, 10)}</div></div>
                    <div><div className={styles.kvLabel}>Status</div><div><span className={styles.tag}>{h.verificationStatus}</span></div></div>
                  </div>
                ))}
              </div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Contact attempts</div>
              <div className={styles.card}>
                {contacts.length === 0 && <div className={styles.notice}>No contacts on file.</div>}
                {contacts.map((c) => (
                  <div key={c.contactId} className={styles.row}>
                    <div><div className={styles.kvLabel}>Owner</div><div>{c.numberOwner}</div></div>
                    <div><div className={styles.kvLabel}>Safe</div><div>{c.safeToUse ? "Yes" : "No"}</div></div>
                    <div><div className={styles.kvLabel}>Reliability</div><div>{c.reliability}</div></div>
                  </div>
                ))}
              </div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Candidate replacement lawyers</div>
              <div className={styles.card}>
                {candidateLawyers.length === 0 && <div className={styles.notice}>No eligible candidates.</div>}
                {candidateLawyers.slice(0, 5).map((c) => (
                  <div key={c.lawyer.lawyerId} className={styles.row}>
                    <div>{c.lawyer.fullNameEn}</div>
                    <div><span className={styles.tag}>{c.lawyer.availability}</span></div>
                  </div>
                ))}
              </div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Decision</div>
              <div className={styles.card}>
                <div className={styles.formRow}>
                  <label>{t("dlaoChangeRequestDecisionNote")}</label>
                  <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <div className={styles.actions}>
                  <button type="button" className={styles.btn} onClick={() => decide("approve")}>{t("dlaoChangeRequestDecisionReassign")}</button>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => decide("retain")}>{t("dlaoChangeRequestDecisionRetain")}</button>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => decide("clarify")}>{t("dlaoChangeRequestDecisionClarify")}</button>
                  <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => decide("escalate")}>{t("dlaoChangeRequestDecisionEscalate")}</button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
