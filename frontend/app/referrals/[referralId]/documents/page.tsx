"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { ReferralService, SensitiveEvidenceService, useHelplineStore, ensureSeeded } from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

export default function DocumentsPage({ params }: { params: Promise<{ referralId: string }> }) {
  const { referralId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();

  useEffect(() => {
    ensureSeeded();
  }, []);

  const ref = ReferralService.find(envelope, referralId);
  if (!ref) return <div className={styles.shell}><div className={styles.main}>Not found.</div></div>;
  const evidence = SensitiveEvidenceService.listFor(envelope, ref.applicationId);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={`/referrals/${ref.referralId}`} className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralDocumentsHeading")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("referralDocumentsHeading")}</h1>
        <p className={styles.intro}>{ref.applicationId} · {t("referralDocumentsIncluded")} {ref.package.documentSelections.filter((s) => s.included).length} / {evidence.length}</p>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Source-of-truth evidence</h2>
          </div>
          <div className={styles.card}>
            {evidence.map((item) => {
              const sel = ref.package.documentSelections.find((s) => s.documentId === item.evidenceId);
              return (
                <div key={item.evidenceId} className={styles.evidenceRow}>
                  <div>{sel?.included ? "✓" : "—"}</div>
                  <div>
                    <div>{item.subject}</div>
                    <div className={styles.evidenceMeta}>
                      {item.kind} · {item.accessClassification} · hash {item.hash.slice(0, 16)}…
                    </div>
                  </div>
                  <Link href={`/applications/${ref.applicationId}/sensitive-review`} className={`${styles.btn} ${styles.btnGhost}`}>
                    {t("referralSensitiveVaultTitle")}
                  </Link>
                </div>
              );
            })}
            {evidence.length === 0 && <div className={styles.notice}>No evidence attached to this record.</div>}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Redacted derivatives</h2>
          </div>
          <div className={styles.card}>
            <div className={styles.notice}>
              Originals are NEVER altered. Redacted copies are separate records with their own hash and a parent link.
            </div>
            {(envelope.sensitiveEvidence?.derivatives ?? []).filter((d) => evidence.some((e) => e.evidenceId === d.parentEvidenceId)).map((d) => (
              <div key={d.derivativeId} className={styles.evidenceRow}>
                <div>📄</div>
                <div>
                  <div>{d.transformation} of {d.parentEvidenceId}</div>
                  <div className={styles.evidenceMeta}>hash {d.newHash.slice(0, 16)}… · by {d.responsibleActor}</div>
                </div>
                <span className={styles.statusPill + " " + styles.statusPillOk}>{t("referralSensitiveDerivative")}</span>
              </div>
            ))}
            {(envelope.sensitiveEvidence?.derivatives ?? []).filter((d) => evidence.some((e) => e.evidenceId === d.parentEvidenceId)).length === 0 && (
              <div className={styles.notice}>No derivatives yet.</div>
            )}
          </div>
        </section>

        <div style={{ marginTop: 16 }}>
          <Link href={`/referrals/${ref.referralId}`} className={`${styles.btn} ${styles.btnGhost}`}>← Back to referral</Link>
        </div>
      </main>
    </div>
  );
}