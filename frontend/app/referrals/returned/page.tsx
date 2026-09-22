"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ReferralService,
  useHelplineStore,
  ensureSeeded,
  ApplicationRecordService,
} from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

export default function ReturnedPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  const [editNote, setEditNote] = useState<Record<string, string>>({});

  useEffect(() => {
    ensureSeeded();
  }, []);

  const refs = envelope.referrals ?? [];
  const returned = refs.filter(
    (r) =>
      r.package.state === "returned" ||
      r.package.state === "information_requested",
  );

  const recordName = (applicationId: string) =>
    ApplicationRecordService.find(envelope, applicationId)?.facts?.applicant_name?.value ?? applicationId;

  function resubmit(id: string) {
    ReferralService.send({ referralId: id, actor: "প্রেরক কর্মকর্তা", operationId: "op-" + Math.random().toString(36).slice(2, 8) });
    setTick((t) => t + 1);
  }

  function updateAndResubmit(id: string) {
    const note = editNote[id] ?? "";
    if (note.trim().length > 0) {
      ReferralService.transition({
        referralId: id,
        to: envelope.referrals?.find((r) => r.referralId === id)?.package.state ?? "package_review",
        actor: "প্রেরক কর্মকর্তা",
        reason: "Package correction noted: " + note,
      });
    }
    ReferralService.send({ referralId: id, actor: "প্রেরক কর্মকর্তা", operationId: "op-" + Math.random().toString(36).slice(2, 8) });
    setEditNote((m) => ({ ...m, [id]: "" }));
    setTick((t) => t + 1);
  }

  function withdraw(id: string) {
    ReferralService.withdraw({ referralId: id, actor: "প্রেরক কর্মকর্তা", reason: "Returned by receiving office — sender withdrew" });
    setTick((t) => t + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/referrals/dashboard" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralReturnedTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("referralReturnedTitle")}</h1>
        <p className={styles.intro}>
          {returned.length} referral{returned.length === 1 ? "" : "s"} returned by the receiving office and awaiting sender action.
        </p>

        <div className={styles.notice}>
          Both offices share one state. Resending returns the package to the receiving office inbox; withdrawing closes the referral with an audit entry on the same Case ID.
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t("referralQueueHeader")}</h2>
            <span className={styles.sectionSub}>{returned.length}</span>
          </div>
          <div className={styles.card}>
            <table className={styles.queue}>
              <thead>
                <tr>
                  <th>{t("referralQueueRecordId")}</th>
                  <th>{t("referralQueueApplicant")}</th>
                  <th>{t("referralQueueSendingOffice")}</th>
                  <th>{t("referralQueueState")}</th>
                  <th>Return reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {returned.map((r) => {
                  const lastReturn = [...r.package.history].reverse().find((h) => h.action === "referral_returned");
                  return (
                    <tr key={r.referralId} className={styles.queueRow}>
                      <td className={styles.kvValueMono}>{r.applicationId}</td>
                      <td>{recordName(r.applicationId)}</td>
                      <td>{r.package.sendingOffice}</td>
                      <td>{r.package.state}</td>
                      <td>
                        <div>{lastReturn?.reason ?? "—"}</div>
                        {lastReturn?.reason && (
                          <div className={styles.evidenceMeta}>{lastReturn.reason}</div>
                        )}
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <Link href={`/referrals/${r.referralId}`} className={`${styles.btn} ${styles.btnGhost}`}>{t("referralQueueOpen")}</Link>
                          <Link href={`/referrals/${r.referralId}/package`} className={`${styles.btn} ${styles.btnGhost}`}>Edit package</Link>
                          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => resubmit(r.referralId)}>
                            Resend now
                          </button>
                          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => withdraw(r.referralId)}>
                            Withdraw
                          </button>
                        </div>
                        <div className={styles.formRow} style={{ marginTop: 8 }}>
                          <label htmlFor={`note-${r.referralId}`}>Correction note (optional)</label>
                          <input
                            id={`note-${r.referralId}`}
                            value={editNote[r.referralId] ?? ""}
                            onChange={(e) => setEditNote((m) => ({ ...m, [r.referralId]: e.target.value }))}
                          />
                          <button
                            type="button"
                            className={styles.btn}
                            onClick={() => updateAndResubmit(r.referralId)}
                            disabled={!editNote[r.referralId] || editNote[r.referralId].trim().length === 0}
                          >
                            Save note + resend
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {returned.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className={styles.notice}>No returned referrals.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div style={{ marginTop: 16 }}>
          <Link href="/referrals/dashboard" className={`${styles.btn} ${styles.btnGhost}`}>← Back to dashboard</Link>
        </div>
      </main>
    </div>
  );
}