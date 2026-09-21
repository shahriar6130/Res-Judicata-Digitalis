"use client";

import { useI18n } from "@/lib/i18n";
import {
  HumanHandoffService,
  IntakeSessionService,
  SafeContactService,
  useHelplineStore,
} from "@/lib/shakkho";
import { AlertCircle, Phone } from "@/components/icons";
import { IconButton } from "../primitives/icon-button";
import styles from "../helpline.module.css";

interface DlaoApplicantContactPanelProps {
  applicationId: string;
}

export function DlaoApplicantContactPanel({ applicationId }: DlaoApplicantContactPanelProps) {
  const { t } = useI18n();
  const envelope = useHelplineStore();
  const record = envelope.records.find((r) => r.applicationId === applicationId);

  function outboundCall() {
    if (!record) return;
    IntakeSessionService.start({ actor: "dlao", applicationId: record.applicationId });
  }

  function simulateUnsafe() {
    if (!record) return;
    const evaluation = SafeContactService.evaluate(record);
    SafeContactService.attach(record.applicationId, {
      ...evaluation,
      cleared: false,
      reasons: [{ bn: "অনিরাপদ উত্তর পাওয়া গেছে", en: "Unsafe answer recorded" }],
    }, "dlao");
    HumanHandoffService.create({
      applicationId: record.applicationId,
      reason: "unsafe_answer",
      targetRole: "accessibility_specialist",
      actor: "dlao",
    });
  }

  if (!record) {
    return <p className={styles.empty}>{t("helplineRecordNotFound")}</p>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.pageEyebrow}>{t("helplineNavDlaoTasks")}</span>
        <h1 className={styles.pageTitle}>{t("helplineDlaoApplicantContactTitle")}</h1>
        <p className={styles.pageIntro}>{t("helplineDlaoApplicantContactBody")}</p>
      </header>

      <section className={styles.callColumn}>
        <h2>{record.applicationId}</h2>
        <strong>{record.facts.applicant_name?.value ?? "—"}</strong>
        <p style={{ color: "var(--gray)" }}>{record.office}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <IconButton Icon={Phone} onClick={outboundCall} className={styles.dashboardPrimaryBtn}>
            {t("helplineDlaoSimOutboundBtn")}
          </IconButton>
          <IconButton Icon={AlertCircle} onClick={simulateUnsafe} variant="danger">
            {t("helplineDlaoSimUnsafeBtn")}
          </IconButton>
        </div>
      </section>
    </div>
  );
}
