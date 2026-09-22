"use client";

import { use, useEffect, useMemo } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ReferralService,
  ApplicationRecordService,
  SafeNotificationService,
  SafeContactService,
  useHelplineStore,
  ensureSeeded,
} from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

export default function CitizenReferralStatusPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();

  useEffect(() => {
    ensureSeeded();
  }, []);

  const app = useMemo(() => {
    if (!recordId) return undefined;
    const rec = (envelope.records ?? []).find((r) => r.applicationId === recordId);
    if (rec) return rec;
    const ref = (envelope.referrals ?? []).find((r) => r.package.caseId === recordId);
    return ref ? (envelope.records ?? []).find((r) => r.applicationId === ref.applicationId) : undefined;
  }, [envelope.records, recordId]);

  if (!app) return <div className={styles.shell}><div className={styles.main}>Not found.</div></div>;

  const caseId = recordId ?? app.applicationId;
  const refs = (envelope.referrals ?? []).filter((r) => r.applicationId === app.applicationId);
  const safeStatuses = (envelope.citizenSafeStatuses ?? []).filter((s) => s.applicationId === app.applicationId || s.recordId === caseId);
  const safeContact = SafeContactService.evaluate(app);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralCitizenTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("referralCitizenTitle")}</h1>
        <p className={styles.intro}>
          Status for record <code>{caseId}</code>
        </p>

        <div className={styles.notice}>
          Citizen-safe view. Evidence names, internal notes, and routing detail are filtered out before display. Only safe status messages and your approved contact channel are shown.
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Your application status</h2>
          </div>
          <div className={styles.card}>
            {refs.length === 0 && (
              <div className={styles.notice}>
                Your application is registered and being reviewed. Updates will be sent through your safe channel.
              </div>
            )}
            {refs.map((r) => (
              <div key={r.referralId} className={styles.evidenceRow}>
                <div>📬</div>
                <div>
                  <div className={styles.kvLabel}>Reference</div>
                  <div className={styles.kvValueMono}>{r.referralId}</div>
                  <p>{SafeNotificationService.safeMessageForReferral(r, lang)}</p>
                  {r.package.expectedAction && (
                    <div className={styles.evidenceMeta}>Expected next update: {r.package.expectedAction}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Approved contact channel</h2>
          </div>
          <div className={styles.card}>
            {safeContact.cleared ? (
              <div className={styles.kvGrid}>
                <div className={styles.kvLabel}>Safe contact</div>
                <div className={styles.kvValue}>{safeContact.reasons[0]?.en ?? "Cleared"}</div>
                <div className={styles.kvLabel}>Rules applied</div>
                <div className={styles.kvValue}>{safeContact.rulesApplied.join(", ")}</div>
                <div className={styles.kvLabel}>Evaluated</div>
                <div className={styles.kvValueMono}>{safeContact.evaluatedAt.slice(0, 16).replace("T", " ")}</div>
              </div>
            ) : (
              <div className={styles.notice}>No approved channel on file yet. We will reach out when one is set.</div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Approved safe updates</h2>
            <span className={styles.sectionSub}>{safeStatuses.length}</span>
          </div>
          <div className={styles.card}>
            {safeStatuses.length === 0 ? (
              <div className={styles.notice}>No safe updates issued yet.</div>
            ) : (
              safeStatuses.map((s) => (
                <div key={s.notificationId} className={styles.evidenceRow}>
                  <div>✉</div>
                  <div>
                    <div>{lang === "bn" ? s.safeMessageBn : s.safeMessageEn}</div>
                    <div className={styles.evidenceMeta}>{new Date(s.generatedAt).toISOString().slice(0, 10)} · approved channel: {s.approvedContactMethod}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div style={{ marginTop: 16 }}>
          <Link href="/" className={`${styles.btn} ${styles.btnGhost}`}>← Home</Link>
        </div>
      </main>
    </div>
  );
}