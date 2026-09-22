"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ReferralService,
  EscalationService,
  ApplicationRecordService,
  useHelplineStore,
  ensureSeeded,
} from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

export default function CaseReferralsPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    ensureSeeded();
  }, []);

  const apps = (envelope.records ?? []).filter((r) => {
    // ApplicationRecord has no caseId of its own — the case ID lives on
    // the referral. Treat the applicationId as the caseId (per seed
    // convention) so the same case groups every transfer.
    return r.applicationId === caseId || (envelope.referrals ?? []).some((ref) => ref.applicationId === r.applicationId && ref.package.caseId === caseId);
  });
  const refs = (envelope.referrals ?? []).filter((r) => apps.some((a) => a.applicationId === r.applicationId));
  const escalations = (envelope.escalationTasks ?? []).filter((e) => e.caseId === caseId || apps.some((a) => a.applicationId === e.applicationId));

  if (apps.length === 0) return <div className={styles.shell}><div className={styles.main}>Case <code>{caseId}</code> not found.</div></div>;

  const primary = apps[0];

  function runReseed() {
    for (const a of apps) {
      EscalationService.seedJurisdictionEscalation({
        applicationId: a.applicationId,
        caseId,
        actor: "officer",
      });
    }
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={`/applications/${primary.applicationId}`} className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralCaseReferralsTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("referralCaseReferralsTitle")}</h1>
        <p className={styles.intro}>
          Case ID <code>{caseId}</code> · {apps.length} application record{apps.length === 1 ? "" : "s"} · {refs.length} referral{refs.length === 1 ? "" : "s"}
        </p>

        <div className={styles.notice}>
          Golden Thread G1: every transfer stays on the same Case ID. Both offices see the same history. No second case is ever minted.
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Applications on this case</h2>
            <span className={styles.sectionSub}>{apps.length}</span>
          </div>
          <div className={styles.card}>
            {apps.map((a) => (
              <div key={a.applicationId} className={styles.evidenceRow}>
                <div>📁</div>
                <div>
                  <div><strong>{a.facts.applicant_name?.value ?? a.applicationId}</strong></div>
                  <div className={styles.evidenceMeta}>{a.applicationId} · office {a.office}</div>
                </div>
                <Link href={`/applications/${a.applicationId}`} className={`${styles.btn} ${styles.btnGhost}`}>{t("referralQueueOpen")}</Link>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Referrals on this case</h2>
            <span className={styles.sectionSub}>{refs.length}</span>
          </div>
          <div className={styles.card}>
            <table className={styles.queue}>
              <thead>
                <tr>
                  <th>Referral</th>
                  <th>{t("referralQueueRecordId")}</th>
                  <th>Route</th>
                  <th>State</th>
                  <th>Urgency</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {refs.map((r) => (
                  <tr key={r.referralId} className={styles.queueRow}>
                    <td className={styles.kvValueMono}>{r.referralId}</td>
                    <td className={styles.kvValueMono}>{r.applicationId}</td>
                    <td>{r.package.sendingOffice} → {r.package.receivingOffice}</td>
                    <td>
                      <span className={`${styles.statusPill} ${
                        r.package.state === "completed" ? styles.statusPillOk
                        : r.package.state === "overdue_acknowledgment" || r.package.state === "overdue_action" ? styles.statusPillAlert
                        : styles.statusPillNeutral
                      }`}>{r.package.state}</span>
                    </td>
                    <td>{r.package.priority}</td>
                    <td className={styles.kvValueMono}>{new Date(r.package.createdAt).toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td>
                      <div className={styles.actions}>
                        <Link href={`/referrals/${r.referralId}`} className={`${styles.btn} ${styles.btnGhost}`}>{t("referralQueueOpen")}</Link>
                        <Link href={`/referrals/${r.referralId}/timeline`} className={`${styles.btn} ${styles.btnGhost}`}>Timeline</Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {refs.length === 0 && (
                  <tr><td colSpan={7}><div className={styles.notice}>No referrals yet on this case.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Escalations</h2>
            <span className={styles.sectionSub}>{escalations.length}</span>
          </div>
          <div className={styles.card}>
            {escalations.length === 0 ? (
              <div className={styles.notice}>No escalations on this case yet.</div>
            ) : (
              escalations.map((e) => (
                <div key={e.escalationId} className={styles.evidenceRow}>
                  <div>⚖</div>
                  <div>
                    <div><strong>{e.escalationId}</strong> · reason {e.reason}</div>
                    <div className={styles.evidenceMeta}>state {e.state} · created {new Date(e.createdAt).toISOString().slice(0, 16).replace("T", " ")}</div>
                  </div>
                  <Link href={`/referrals/escalations/${e.escalationId}`} className={`${styles.btn} ${styles.btnPrimary}`}>
                    Open escalation
                  </Link>
                </div>
              ))
            )}
            <div className={styles.actions}>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={runReseed}>
                Seed jurisdiction escalation (demo)
              </button>
            </div>
          </div>
        </section>

        <div style={{ marginTop: 16 }}>
          <Link href={`/applications/${primary.applicationId}`} className={`${styles.btn} ${styles.btnGhost}`}>← Back to application</Link>
        </div>
      </main>
    </div>
  );
}