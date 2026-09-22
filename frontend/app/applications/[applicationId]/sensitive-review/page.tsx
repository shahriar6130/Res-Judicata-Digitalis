"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  SensitiveEvidenceService,
  useHelplineStore,
  ensureSeeded,
  ApplicationRecordService,
  DemoTimeService,
} from "@/lib/shakkho";
import type { EvidenceAccessPurpose, EvidenceAccessGrant } from "@/lib/shakkho";
import { EVIDENCE_ACCESS_PURPOSES } from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

export default function SensitiveReviewPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);

  const [officer, setOfficer] = useState<string>("জেলা আইনি সহায়তা কর্মকর্তা");
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<EvidenceAccessPurpose["code"]>("urgency_review");
  const [reauth, setReauth] = useState<EvidenceAccessGrant["reauthMethod"]>("officer_supervisor_attestation");
  const [minNec, setMinNec] = useState<boolean>(true);

  useEffect(() => {
    ensureSeeded();
  }, []);

  const rec = ApplicationRecordService.find(envelope, applicationId);
  if (!rec) return <div className={styles.shell}><div className={styles.main}>Not found.</div></div>;

  const items = SensitiveEvidenceService.listFor(envelope, applicationId);
  const allEvents = (envelope.sensitiveEvidence?.events ?? []).filter((e) => e.applicationId === applicationId);

  const grantsByEvidence: Record<string, EvidenceAccessGrant | undefined> = {};
  for (const it of items) {
    grantsByEvidence[it.evidenceId] = SensitiveEvidenceService.activeGrant(envelope, it.evidenceId, officer);
  }

  function requestAccessFor(evidenceId: string) {
    SensitiveEvidenceService.requestAccess({
      evidenceId,
      applicantId: applicationId,
      purpose,
      reauthMethod: reauth,
      minimumNecessary: minNec,
      actor: officer,
    });
    setActiveEvidenceId(null);
    setTick((x) => x + 1);
  }

  function view(evidenceId: string) {
    const grant = grantsByEvidence[evidenceId];
    if (!grant) return;
    SensitiveEvidenceService.recordView({
      evidenceId,
      grantId: grant.grantId,
      actor: officer,
      role: "officer",
      purpose: grant.purpose,
    });
    setTick((x) => x + 1);
  }

  function download(evidenceId: string) {
    const grant = grantsByEvidence[evidenceId];
    if (!grant) return;
    SensitiveEvidenceService.recordDownload({
      evidenceId,
      grantId: grant.grantId,
      actor: officer,
      role: "officer",
      purpose: grant.purpose,
    });
    setTick((x) => x + 1);
  }

  function makeRedactedCopy(evidenceId: string) {
    SensitiveEvidenceService.createDerivative({
      parentEvidenceId: evidenceId,
      transformation: "redaction",
      responsibleActor: officer,
      note: "Redacted derivative created for onward sharing",
    });
    setTick((x) => x + 1);
  }

  function revoke(grantId: string) {
    SensitiveEvidenceService.revokeGrant({ grantId, revokedBy: officer, actor: officer, reason: "Officer-initiated revocation" });
    setTick((x) => x + 1);
  }

  const nowMs = Date.now() + (envelope.demoTimeOffsetMs ?? 0);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={`/applications/${applicationId}`} className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralSensitiveVaultTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("referralSensitiveVaultTitle")}</h1>
        <p className={styles.intro}>
          {rec.facts.applicant_name?.value ?? applicationId} · <code>{applicationId}</code>
        </p>

        <div className={styles.noticeWarn}>
          Sensitive evidence workspace. The vault renders safe metadata only — no thumbnail, no content. Access is role-bound, purpose-bound, and time-bounded (5-minute default grant). Every access event is recorded in the audit trail.
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Officer</h2>
          </div>
          <div className={styles.card}>
            <div className={styles.formRow}>
              <label htmlFor="ofc">Officer name (used as grant holder)</label>
              <input id="ofc" value={officer} onChange={(e) => setOfficer(e.target.value)} />
            </div>
            <div className={styles.evidenceMeta}>Demo time: {new Date(nowMs).toISOString().slice(0, 16).replace("T", " ")}</div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Evidence items</h2>
            <span className={styles.sectionSub}>{items.length}</span>
          </div>
          <div className={styles.card}>
            {items.length === 0 && <div className={styles.notice}>No evidence attached to this record.</div>}
            {items.map((item) => {
              const grant = grantsByEvidence[item.evidenceId];
              const active = !!grant && new Date(grant.expiresAt).getTime() > nowMs;
              return (
                <div key={item.evidenceId} className={styles.evidenceRow}>
                  <div>{item.accessClassification === "highly_restricted" ? "🔒" : "🗝"}</div>
                  <div>
                    <div><strong>{item.subject}</strong></div>
                    <div className={styles.evidenceMeta}>
                      {item.kind} · {item.accessClassification} · hash {item.hash.slice(0, 16)}… · version {item.version}
                    </div>
                    <div className={styles.evidenceMeta}>
                      Retention: {item.retentionStatus} · Sharing: {item.sharingStatus} · Verification: {item.verificationStatus}
                    </div>
                    {active && grant && (
                      <div className={styles.noticeOk}>
                        Active grant · purpose {grant.purpose} · expires {new Date(grant.expiresAt).toISOString().slice(0, 16).replace("T", " ")}
                      </div>
                    )}
                  </div>
                  <div className={styles.actions}>
                    {!active && (
                      <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setActiveEvidenceId(item.evidenceId)}>
                        Request access
                      </button>
                    )}
                    {active && (
                      <>
                        <button type="button" className={styles.btn} onClick={() => view(item.evidenceId)}>View (audit)</button>
                        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => download(item.evidenceId)}>Download (audit)</button>
                        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => makeRedactedCopy(item.evidenceId)}>Create redacted copy</button>
                        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => grant && revoke(grant.grantId)}>Revoke grant</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {activeEvidenceId && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Request access</h2>
            </div>
            <div className={styles.card}>
              <div className={styles.notice}>
                A grant is created only after explicit officer re-authentication. The grant is bound to the chosen purpose, the officer's identity, and a 5-minute window.
              </div>
              <div className={styles.formRow}>
                <label htmlFor="pp">Purpose</label>
                <select id="pp" value={purpose} onChange={(e) => setPurpose(e.target.value as EvidenceAccessPurpose["code"])}>
                  {EVIDENCE_ACCESS_PURPOSES.map((p) => (
                    <option key={p.code} value={p.code}>{p.labelEn} / {p.labelBn}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formRow}>
                <label htmlFor="rr">Re-authentication</label>
                <select id="rr" value={reauth} onChange={(e) => setReauth(e.target.value as EvidenceAccessGrant["reauthMethod"])}>
                  <option value="officer_supervisor_attestation">Officer + Supervisor attestation</option>
                  <option value="biometric_local">Biometric (local)</option>
                  <option value="human_alternative">Human alternative</option>
                  <option value="pin_ivr">PIN via IVR</option>
                </select>
              </div>
              <div className={styles.formRow}>
                <label>
                  <input type="checkbox" checked={minNec} onChange={(e) => setMinNec(e.target.checked)} /> Confirm minimum-necessary disclosure
                </label>
              </div>
              <div className={styles.actions}>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => requestAccessFor(activeEvidenceId)}>
                  Re-authenticate and grant (5 min)
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setActiveEvidenceId(null)}>Cancel</button>
              </div>
            </div>
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Access audit (this case)</h2>
            <span className={styles.sectionSub}>{allEvents.length}</span>
          </div>
          <div className={styles.card}>
            {allEvents.length === 0 ? (
              <div className={styles.notice}>No access events yet.</div>
            ) : (
              <ul className={styles.timeline}>
                {allEvents.slice().reverse().map((e) => (
                  <li key={e.eventId} className={styles.timelineItem}>
                    <span className={styles.timelineTime}>{new Date(e.occurredAt).toISOString().slice(0, 16).replace("T", " ")}</span>
                    <span><strong>{e.action}</strong> · {e.actor} · purpose {e.purpose} · version {e.version}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Redacted derivatives</h2>
            <span className={styles.sectionSub}>{(envelope.sensitiveEvidence?.derivatives ?? []).filter((d) => items.some((i) => i.evidenceId === d.parentEvidenceId)).length}</span>
          </div>
          <div className={styles.card}>
            <div className={styles.notice}>
              Originals are NEVER altered. Redacted copies are separate records with their own hash and a parent link.
            </div>
            {(envelope.sensitiveEvidence?.derivatives ?? []).filter((d) => items.some((i) => i.evidenceId === d.parentEvidenceId)).map((d) => (
              <div key={d.derivativeId} className={styles.evidenceRow}>
                <div>📄</div>
                <div>
                  <div>{d.transformation} of {d.parentEvidenceId}</div>
                  <div className={styles.evidenceMeta}>hash {d.newHash.slice(0, 16)}… · by {d.responsibleActor}</div>
                </div>
                <span className={`${styles.statusPill} ${styles.statusPillOk}`}>{t("referralSensitiveDerivative")}</span>
              </div>
            ))}
            {(envelope.sensitiveEvidence?.derivatives ?? []).filter((d) => items.some((i) => i.evidenceId === d.parentEvidenceId)).length === 0 && (
              <div className={styles.notice}>No derivatives yet.</div>
            )}
          </div>
        </section>

        <div style={{ marginTop: 16 }}>
          <Link href={`/applications/${applicationId}`} className={`${styles.btn} ${styles.btnGhost}`}>← Back to application</Link>
        </div>
      </main>
    </div>
  );
}