"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n, type MessageKey } from "@/lib/i18n";
import {
  ReferralService,
  useHelplineStore,
  ensureSeeded,
  ApplicationRecordService,
  EscalationService,
} from "@/lib/shakkho";
import type { ReferralReturnReason } from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

const RETURN_REASON_LABEL: Record<ReferralReturnReason, MessageKey> = {
  required_information_missing: "referralReturnReasonMissingInfo",
  required_document_missing: "referralReturnReasonDocMissing",
  document_unreadable: "referralReturnReasonDocUnreadable",
  package_corrupted: "referralReturnReasonCorrupted",
  receiving_office_outside_route: "referralReturnReasonOutsideRoute",
  duplicate_referral: "referralReturnReasonDuplicate",
  existing_responsible_office: "referralReturnReasonExistingOffice",
  legal_basis_verification_required: "referralReturnReasonLegalBasis",
  other: "referralReturnReasonOther",
};

const RETURN_REASONS: ReferralReturnReason[] = [
  "required_information_missing",
  "required_document_missing",
  "document_unreadable",
  "package_corrupted",
  "receiving_office_outside_route",
  "duplicate_referral",
  "existing_responsible_office",
  "legal_basis_verification_required",
  "other",
];

export default function ReceivingInboxPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  const [activeReturnId, setActiveReturnId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState<ReferralReturnReason>("required_information_missing");
  const [returnNote, setReturnNote] = useState<string>("");
  const [missingNote, setMissingNote] = useState<string>("");
  const [officerName, setOfficerName] = useState<string>("");

  useEffect(() => {
    ensureSeeded();
  }, []);

  const refs = envelope.referrals ?? [];
  const inbox = refs.filter(
    (r) =>
      r.package.state === "awaiting_acknowledgment" ||
      r.package.state === "acknowledged" ||
      r.package.state === "accepted" ||
      r.package.state === "action_in_progress" ||
      r.package.state === "overdue_acknowledgment" ||
      r.package.state === "overdue_action" ||
      r.package.state === "information_requested",
  );

  const recordName = (applicationId: string) => ApplicationRecordService.find(envelope, applicationId)?.facts?.applicant_name?.value ?? applicationId;

  function ack(id: string) {
    const ref = ReferralService.find(envelope, id);
    if (!ref) return;
    ReferralService.acknowledge({
      referralId: id,
      actor: "প্রাপক কর্মকর্তা",
      receivingOffice: ref.package.receivingOffice,
    });
    setTick((t) => t + 1);
  }
  function accept(id: string) {
    const ref = ReferralService.find(envelope, id);
    if (!ref) return;
    ReferralService.accept({
      referralId: id,
      actor: "প্রাপক কর্মকর্তা",
      receivingOffice: ref.package.receivingOffice,
    });
    setTick((t) => t + 1);
  }
  function openReturn(id: string) {
    setActiveReturnId(id);
    setReturnReason("required_information_missing");
    setReturnNote("");
  }
  function submitReturn() {
    if (!activeReturnId) return;
    ReferralService.recordReturn({
      referralId: activeReturnId,
      actor: "প্রাপক কর্মকর্তা",
      reason: returnReason,
      note: returnNote,
    });
    setActiveReturnId(null);
    setTick((t) => t + 1);
  }
  function requestMissing(id: string) {
    ReferralService.requestMissingInformation({ referralId: id, actor: "প্রাপক কর্মকর্তা", note: missingNote });
    setMissingNote("");
    setTick((t) => t + 1);
  }
  function assign(id: string) {
    ReferralService.assignReceivingOfficer({
      referralId: id,
      actor: "প্রাপক কর্মকর্তা",
      officer: { role: "assigned_receiving_officer", name: officerName || "সহকারী কর্মকর্তা", office: envelope.referrals.find((r) => r.referralId === id)?.package.receivingOffice ?? "" },
    });
    setOfficerName("");
    setTick((t) => t + 1);
  }
  function firstAction(id: string) {
    ReferralService.recordFirstAction({ referralId: id, actor: "প্রাপক কর্মকর্তা", note: missingNote || "Initial review complete" });
    setTick((t) => t + 1);
  }
  function complete(id: string) {
    ReferralService.markCompleted({ referralId: id, actor: "প্রাপক কর্মকর্তা" });
    setTick((t) => t + 1);
  }
  void EscalationService;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/referrals/dashboard" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralReceivingTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("referralReceivingTitle")}</h1>
        <p className={styles.intro}>{inbox.length} referrals awaiting receiving-office action.</p>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("referralQueueHeader")}</h2>
            <span className={styles.sectionSub}>{inbox.length}</span>
          </div>
          <div className={styles.card}>
            <table className={styles.queue}>
              <thead>
                <tr>
                  <th>{t("referralQueueRecordId")}</th>
                  <th>{t("referralQueueApplicant")}</th>
                  <th>{t("referralQueueSendingOffice")}</th>
                  <th>{t("referralQueueState")}</th>
                  <th>{t("referralQueueAckDeadline")}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inbox.map((r) => (
                  <tr key={r.referralId} className={styles.queueRow}>
                    <td className={styles.kvValueMono}>{r.applicationId}</td>
                    <td>{recordName(r.applicationId)}</td>
                    <td>{r.package.sendingOffice}</td>
                    <td>{r.package.state}</td>
                    <td className={styles.kvValueMono}>{new Date(r.package.deadline.acknowledgmentDeadline).toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td>
                      <div className={styles.actions}>
                        <Link href={`/referrals/${r.referralId}`} className={`${styles.btn} ${styles.btnGhost}`}>{t("referralQueueOpen")}</Link>
                        {r.package.state === "awaiting_acknowledgment" && (
                          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => ack(r.referralId)}>
                            {t("referralAcknowledgeAction")}
                          </button>
                        )}
                        {(r.package.state === "acknowledged" || r.package.state === "information_requested") && (
                          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => accept(r.referralId)}>
                            {t("referralAcceptAction")}
                          </button>
                        )}
                        {(r.package.state === "acknowledged" || r.package.state === "information_requested") && (
                          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => openReturn(r.referralId)}>
                            {t("referralReturnAction")}
                          </button>
                        )}
                        {(r.package.state === "acknowledged" || r.package.state === "information_requested") && (
                          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => requestMissing(r.referralId)}>
                            {t("referralMissingInfoAction")}
                          </button>
                        )}
                        {r.package.state === "accepted" && (
                          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => assign(r.referralId)}>
                            {t("referralAssignOfficer")}
                          </button>
                        )}
                        {r.package.state === "action_in_progress" && (
                          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => firstAction(r.referralId)}>
                            {t("referralRecordFirstAction")}
                          </button>
                        )}
                        {r.package.state === "action_in_progress" && (
                          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => complete(r.referralId)}>
                            {t("referralCompleteAction")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {inbox.length === 0 && (
                  <tr><td colSpan={6}><div className={styles.notice}>No referrals in receiving inbox.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {activeReturnId && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t("referralReturnAction")}</h2>
            </div>
            <div className={styles.card}>
              <div className={styles.formRow}>
                <label htmlFor="rr">{t("referralReturnReasonLabel")}</label>
                <select id="rr" value={returnReason} onChange={(e) => setReturnReason(e.target.value as ReferralReturnReason)}>
                  {RETURN_REASONS.map((r) => (
                    <option key={r} value={r}>{t(RETURN_REASON_LABEL[r])}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formRow}>
                <label htmlFor="rn">{t("referralReturnNoteLabel")}</label>
                <textarea id="rn" value={returnNote} onChange={(e) => setReturnNote(e.target.value)} />
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.btn} onClick={submitReturn}>{t("referralReturnAction")}</button>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setActiveReturnId(null)}>Cancel</button>
              </div>
            </div>
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Quick inputs</h2>
          </div>
          <div className={styles.card}>
            <div className={styles.formRow}>
              <label htmlFor="ofc">{t("referralAssignOfficer")} (name)</label>
              <input id="ofc" value={officerName} onChange={(e) => setOfficerName(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="min">{t("referralMissingInfoNote")}</label>
              <input id="min" value={missingNote} onChange={(e) => setMissingNote(e.target.value)} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}