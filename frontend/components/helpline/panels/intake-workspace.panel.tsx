"use client";

import { useI18n } from "@/lib/i18n";
import {
  ApplicationRecordService,
  IntakeSessionService,
  RepresentationService,
  RepresentationOutOfScopeError,
  SafeContactService,
  useHelplineStore,
} from "@/lib/shakkho";
import { AlertCircle, Check } from "@/components/icons";
import { IconButton } from "../primitives/icon-button";
import styles from "../helpline.module.css";

interface IntakeWorkspacePanelProps {
  sessionId: string;
}

export function IntakeWorkspacePanel({ sessionId }: IntakeWorkspacePanelProps) {
  const { t, lang } = useI18n();
  const envelope = useHelplineStore();
  const session = envelope.sessions.find((s) => s.id === sessionId);
  const record = session?.applicationId
    ? envelope.records.find((r) => r.applicationId === session.applicationId)
    : undefined;
  const rep = record
    ? envelope.representations.find((r) => r.applicationId === record.applicationId)
    : undefined;

  if (!session || !record) {
    return <p className={styles.empty}>{t("helplineRecordNotFound")}</p>;
  }

  function confirm() {
    if (!session || !record) return;
    try {
      if (rep) {
        RepresentationService.assertConfirmedOrAbsent(record.applicationId);
      }
      ApplicationRecordService.submit(record.applicationId, "agent");
    } catch (error) {
      if (error instanceof RepresentationOutOfScopeError) {
        alert(t("helplineErrRepOutOfScope"));
      } else {
        alert((error as Error).message);
      }
    }
  }

  function handoff() {
    if (!session || !record) return;
    IntakeSessionService.requestHandoff({
      sessionId: session.id,
      reason: "general",
      targetRole: "dlao",
      actor: "agent",
    });
    SafeContactService.attach(record.applicationId, {
      cleared: false,
      reasons: [{ bn: "মানব হস্তান্তর", en: "Human handoff required" }],
      evaluatedAt: new Date().toISOString(),
      rulesApplied: ["human_handoff"],
    }, "agent");
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.pageEyebrow}>{t("helplineIntakeTitle")}</span>
        <h1 className={styles.pageTitle}>{record.applicationId}</h1>
      </header>
      <section className={styles.callColumn}>
        <h2>{t("helplineIntakeReadback")}</h2>
        <ul className={styles.provenanceList}>
          {Object.entries(record.facts).map(([key, value]) => (
            <li key={key}>
              <span>{key}</span>
              <span>
                {value?.value ?? "—"}{" "}
                <em style={{ color: "var(--gray)" }}>
                  ({value?.source} · {value?.confidence})
                </em>
              </span>
            </li>
          ))}
        </ul>
        {rep ? (
          <p className={styles.safetyBanner}>
            {rep.state === "reported"
              ? t("helplineErrRepOutOfScope")
              : t("helplineVerifiedBadge")}
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <IconButton Icon={Check} onClick={confirm} className={styles.dashboardPrimaryBtn}>
            {t("helplineIntakeConfirmBtn")}{" "}
            <em style={{ opacity: 0.7 }}>({lang === "bn" ? "APP-" : "APP-"})</em>
          </IconButton>
          <IconButton Icon={AlertCircle} onClick={handoff} variant="danger">
            {t("helplineIntakeHandoffBtn")}
          </IconButton>
        </div>
      </section>
    </div>
  );
}
