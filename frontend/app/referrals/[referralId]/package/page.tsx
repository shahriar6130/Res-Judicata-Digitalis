"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ReferralService,
  RoutingRecommendationService,
  ApplicationRecordService,
  useHelplineStore,
  ensureSeeded,
} from "@/lib/shakkho";
import styles from "@/components/referrals/referrals.module.css";

const REQUIRED_CONFIRMATIONS = [
  "referralPackageConfirmDestination",
  "referralPackageConfirmMinNecessary",
  "referralPackageConfirmSensitive",
  "referralPackageConfirmLegalBasis",
  "referralPackageConfirmExpected",
  "referralPackageConfirmDeadline",
  "referralPackageConfirmSafeComms",
] as const;

export default function PackageBuilderPage({ params }: { params: Promise<{ referralId: string }> }) {
  const { referralId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [step, setStep] = useState(1);
  const [confirmations, setConfirmations] = useState<string[]>([]);
  const [expectedAction, setExpectedAction] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<string>("standard");
  const [receivingOffice, setReceivingOffice] = useState<string>("");
  const [sendingOfficer, setSendingOfficer] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    ensureSeeded();
  }, []);

  const ref = ReferralService.find(envelope, referralId);

  useEffect(() => {
    if (ref) {
      setReason(ref.package.reason);
      setExpectedAction(ref.package.expectedAction);
      setPriority(ref.package.priority);
      setReceivingOffice(ref.package.receivingOffice);
      setSendingOfficer(ref.package.sendingOfficer.name);
    }
  }, [ref?.referralId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ref) {
    return <div className={styles.shell}><div className={styles.main}>Not found.</div></div>;
  }

  const recommendation = (envelope.routingRecommendations ?? []).find((r) => r.applicationId === ref.applicationId);
  const directories = envelope.authorityDirectory ?? [];

  function handleConfirmFlag(flag: typeof REQUIRED_CONFIRMATIONS[number]) {
    setConfirmations((cur) => cur.includes(flag) ? cur.filter((c) => c !== flag) : [...cur, flag]);
  }

  function handleSend() {
    const missing = REQUIRED_CONFIRMATIONS.filter((c) => !confirmations.includes(c));
    if (missing.length > 0) {
      setError(`Authorization incomplete: ${missing.length} of 7`);
      return;
    }
    try {
      ReferralService.authorizePackage({ referralId: ref!.referralId, actor: "মোঃ আরিফ হোসেন", confirmationFlags: confirmations });
      ReferralService.transition({
        referralId: ref!.referralId,
        to: "package_review",
        actor: "মোঃ আরিফ হোসেন",
        reason: "Step 6 authorized by officer",
      });
      const opId = "op-" + Math.random().toString(36).slice(2, 8);
      ReferralService.send({ referralId: ref!.referralId, actor: "মোঃ আরিফ হোসেন", operationId: opId });
      ReferralService.markDelivered({ referralId: ref!.referralId, actor: "system", operationId: opId, outcome: "delivered_successfully" });
      setSent(true);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={`/referrals/${ref.referralId}`} className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("referralPackageTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.header}>
          <span className={styles.eyebrow}>Step {step}/6</span>
          <h1 className={styles.title}>{t("referralPackageTitle")}</h1>
          <p className={styles.intro}>{ref.applicationId} · {ref.package.sendingOffice} → {receivingOffice || ref.package.receivingOffice}</p>
        </section>

        <div className={styles.actions}>
          {[1,2,3,4,5,6].map((s) => (
            <button key={s} type="button" className={`${styles.btn} ${step === s ? "" : styles.btnGhost}`} onClick={() => setStep(s)}>
              {t(`referralPackageStep${s}` as `referralPackageStep${1|2|3|4|5|6}`)}
            </button>
          ))}
        </div>

        {step === 1 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t("referralPackageStep1")}</h2>
            </div>
            <div className={styles.card}>
              <div className={styles.formRow}>
                <label htmlFor="reason">{t("referralPackageReason")}</label>
                <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className={styles.formRow}>
                <label htmlFor="expected">{t("referralPackageExpectedAction")}</label>
                <textarea id="expected" value={expectedAction} onChange={(e) => setExpectedAction(e.target.value)} />
              </div>
              <div className={styles.formRow}>
                <label htmlFor="prio">{t("referralPackagePriority")}</label>
                <select id="prio" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="standard">{t("referralPriorityStandard")}</option>
                  <option value="urgent">{t("referralPriorityUrgent")}</option>
                </select>
              </div>
              <div className={styles.formRow}>
                <label htmlFor="recv">{t("referralPackageReceivingOffice")}</label>
                <select id="recv" value={receivingOffice} onChange={(e) => setReceivingOffice(e.target.value)}>
                  {directories.map((d) => (
                    <option key={d.entryId} value={d.displayNameEn}>{d.displayNameEn}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formRow}>
                <label htmlFor="send">{t("referralPackageSendingOfficer")}</label>
                <input id="send" value={sendingOfficer} onChange={(e) => setSendingOfficer(e.target.value)} />
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t("referralPackageStep2")}</h2>
            </div>
            <div className={styles.card}>
              <div className={styles.notice}>
                Selected case history is auto-derived from the shared ApplicationRecord and may be edited in Step 4.
                The receiving office only sees the entries you include.
              </div>
              <ul className={styles.timeline}>
                {Array.isArray(ref.package.selectedHistoryIds) && ref.package.selectedHistoryIds.length > 0 ? (
                  ref.package.selectedHistoryIds.map((h) => <li key={h} className={styles.timelineItem}>{h}</li>)
                ) : (
                  <li className={styles.timelineItem}>
                    <span className={styles.timelineTime}>—</span>
                    <span>No history items pre-selected. Edit selection in Step 4.</span>
                  </li>
                )}
              </ul>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t("referralPackageStep3")}</h2>
              <span className={styles.sectionSub}>{(envelope.sensitiveEvidence?.items ?? []).filter((i) => i.applicationId === ref.applicationId).length}</span>
            </div>
            <div className={styles.card}>
              <div className={styles.notice}>Documents are NOT attached by default. Toggle inclusion explicitly.</div>
              {(envelope.sensitiveEvidence?.items ?? []).filter((i) => i.applicationId === ref.applicationId).map((item) => {
                const included = ref.package.documentSelections.some((s) => s.documentId === item.evidenceId);
                return (
                  <div key={item.evidenceId} className={styles.evidenceRow}>
                    <div>{included ? "✓" : "—"}</div>
                    <div>
                      <div>{item.subject}</div>
                      <div className={styles.evidenceMeta}>{item.kind} · {item.accessClassification}</div>
                    </div>
                    <Link href={`/applications/${item.applicationId}/sensitive-review`} className={`${styles.btn} ${styles.btnGhost}`}>
                      {t("referralQueueOpen")}
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {step === 4 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t("referralPackageStep4")}</h2>
            </div>
            <div className={styles.card}>
              <div className={styles.notice}>Sensitive material stays restricted. Redacted derivatives are preferred over originals when sharing.</div>
              <ul className={styles.timeline}>
                <li className={styles.timelineItem}><span className={styles.timelineTime}>Safe contact</span><span>{ref.package.safeContactRuleIds.join(", ") || "—"}</span></li>
                <li className={styles.timelineItem}><span className={styles.timelineTime}>Applicant notification</span><span>{ref.package.applicantNotificationRule}</span></li>
              </ul>
            </div>
          </section>
        )}

        {step === 5 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t("referralPackageStep5")}</h2>
            </div>
            <div className={styles.card}>
              <div className={styles.kvGrid}>
                <div className={styles.kvLabel}>{t("referralPackageSendingOfficer")}</div>
                <div className={styles.kvValue}>{sendingOfficer}</div>
                <div className={styles.kvLabel}>{t("referralPackageReceivingOffice")}</div>
                <div className={styles.kvValue}>{receivingOffice || ref.package.receivingOffice}</div>
                <div className={styles.kvLabel}>{t("referralPackageAckDeadline")}</div>
                <div className={styles.kvValueMono}>{ref.package.deadline.acknowledgmentDeadline}</div>
                <div className={styles.kvLabel}>{t("referralPackageActionDeadline")}</div>
                <div className={styles.kvValueMono}>{ref.package.deadline.actionDeadline}</div>
                <div className={styles.kvLabel}>{t("referralPackageEscalationOwner")}</div>
                <div className={styles.kvValue}>{ref.package.escalationOwner}</div>
              </div>
            </div>
          </section>
        )}

        {step === 6 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t("referralPackageStep6")}</h2>
            </div>
            <div className={styles.card}>
              <div className={styles.noticeWarn}>
                Confirm every checkbox below before sending. <strong>{t("referralNoJurisdictionDecision")}</strong>
              </div>
              <div className={styles.checkList}>
                {REQUIRED_CONFIRMATIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.checkItem} ${confirmations.includes(c) ? styles.checkItemActive : ""}`}
                    onClick={() => handleConfirmFlag(c)}
                  >
                    <span>{confirmations.includes(c) ? "✓" : "○"}</span>
                    <span>{t(c)}</span>
                  </button>
                ))}
              </div>
              {error && <div className={styles.conflict}>{error}</div>}
              {sent && <div className={styles.noticeOk}>{t("referralPackageSent")}</div>}
              <div className={styles.actions} style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={handleSend}
                  disabled={confirmations.length < 7 || sent}
                >
                  {t("referralPackageSend")}
                </button>
              </div>
            </div>
          </section>
        )}

        {recommendation && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t("referralRoutingHeading")}</h2>
            </div>
            <div className={styles.card}>
              <div className={styles.kvGrid}>
                <div className={styles.kvLabel}>{t("referralRoutingRecommended")}</div>
                <div className={styles.kvValue}>{recommendation.recommendedDestination.displayName}</div>
                <div className={styles.kvLabel}>{t("referralRoutingConfidence")}</div>
                <div className={styles.kvValue}>{recommendation.confidence}</div>
                <div className={styles.kvLabel}>{t("referralRoutingReason")}</div>
                <div className={styles.kvValue}>{lang === "bn" ? recommendation.reasons[0]?.bn : recommendation.reasons[0]?.en}</div>
              </div>
              <div className={styles.actions} style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={() =>
                    RoutingRecommendationService.recordHumanDecision({
                      recommendationId: recommendation.recommendationId,
                      decidedBy: "মোঃ আরিফ হোসেন",
                      accepted: true,
                      reason: "Recommendation matches directory coverage",
                      authorityForDecision: "আইনি সহায়তা সেবা আইন ২০২৬ §12",
                    })
                  }
                >
                  {t("referralRoutingAccept")}
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={() =>
                    RoutingRecommendationService.recordHumanDecision({
                      recommendationId: recommendation.recommendationId,
                      decidedBy: "মোঃ আরিফ হোসেন",
                      accepted: false,
                      reason: "Local sensitivity requires different route",
                      authorityForDecision: "আইনি সহায়তা সেবা আইন ২০২৬ §15",
                    })
                  }
                >
                  {t("referralRoutingReject")}
                </button>
              </div>
            </div>
          </section>
        )}

        <div style={{ marginTop: 16 }}>
          <Link href={`/referrals/${ref.referralId}`} className={`${styles.btn} ${styles.btnGhost}`}>← Back to referral</Link>
        </div>
      </main>
    </div>
  );
}

void ApplicationRecordService;