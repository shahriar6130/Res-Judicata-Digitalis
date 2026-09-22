"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  LegalBasisRegistryService,
  useHelplineStore,
  ensureSeeded,
} from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

export default function LegalBasisRegistryPage() {
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  const [officer, setOfficer] = useState<string>("প্রশাসনিক কর্মকর্তা");

  useEffect(() => {
    ensureSeeded();
  }, []);

  const list = LegalBasisRegistryService.list(envelope);
  const active = LegalBasisRegistryService.active(envelope);

  function markVerified(id: string) {
    LegalBasisRegistryService.markVerified(id, officer, officer);
    setTick((x) => x + 1);
  }
  function supersede(id: string, byId: string) {
    if (!byId) return;
    LegalBasisRegistryService.supersede(id, byId, officer);
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/referrals/dashboard" className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralLegalBasisTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("referralLegalBasisTitle")}</h1>
        <p className={styles.intro}>Versioned legal-basis entries that drive routing and required-document selection.</p>

        <div className={styles.noticeWarn}>
          Routing information must be verified by an authorised officer before referral. Supserseded entries MUST NOT be used as routing references.
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Officer</h2>
          </div>
          <div className={styles.card}>
            <div className={styles.formRow}>
              <label htmlFor="ofc">Authorising officer</label>
              <input id="ofc" value={officer} onChange={(e) => setOfficer(e.target.value)} />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Registry entries</h2>
            <span className={styles.sectionSub}>{list.length}</span>
          </div>
          <div className={styles.card}>
            <table className={styles.queue}>
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Reference</th>
                  <th>Matter</th>
                  <th>Authority type</th>
                  <th>Required docs</th>
                  <th>Verification</th>
                  <th>Ruleset</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.basisId} className={styles.queueRow}>
                    <td>
                      <div><strong>{b.instrument}</strong></div>
                      <div className={styles.evidenceMeta}>{b.basisId}</div>
                    </td>
                    <td>{b.reference}</td>
                    <td>{b.matterCategory}</td>
                    <td>{b.receivingAuthorityType}</td>
                    <td>{b.requiredDocuments.join(", ")}</td>
                    <td>
                      <span
                        className={`${styles.statusPill} ${
                          b.verificationStatus === "verified"
                            ? styles.statusPillOk
                            : b.verificationStatus === "superseded"
                            ? styles.statusPillAlert
                            : styles.statusPillWarn
                        }`}
                      >
                        {b.verificationStatus}
                      </span>
                      <div className={styles.evidenceMeta}>{b.verifiedBy ?? "—"}</div>
                    </td>
                    <td className={styles.kvValueMono}>{b.rulesetVersion}</td>
                    <td>
                      <div className={styles.actions}>
                        {b.verificationStatus !== "verified" && (
                          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => markVerified(b.basisId)}>
                            Mark verified
                          </button>
                        )}
                        {b.verificationStatus !== "superseded" && (
                          <select
                            onChange={(e) => {
                              supersede(b.basisId, e.target.value);
                              e.target.value = "";
                            }}
                            className={styles.btn}
                          >
                            <option value="">Supersede with…</option>
                            {active.filter((a) => a.basisId !== b.basisId).map((a) => (
                              <option key={a.basisId} value={a.basisId}>{a.instrument} ({a.basisId})</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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