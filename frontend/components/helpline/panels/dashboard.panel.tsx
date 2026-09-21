"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import {
  HelplineService,
  useHelplineStore,
  type ApplicationRecord,
  type IntakeSession,
} from "@/lib/shakkho";
import { Phone, Play, MoreVertical } from "@/components/icons";
import { IconButton } from "../primitives/icon-button";
import { SimulationTag } from "../primitives/simulation-tag";
import styles from "../helpline.module.css";

interface DashboardPanelProps {
  onNewCall: () => void;
  onContinueIntake: () => void;
  onOpenCall: (sessionId: string) => void;
  onOpenRecord: (applicationId: string) => void;
}

export function DashboardPanel({
  onNewCall,
  onContinueIntake,
  onOpenCall,
  onOpenRecord,
}: DashboardPanelProps) {
  const { lang, t } = useI18n();
  const envelope = useHelplineStore();
  const kpis = HelplineService.kpis(envelope);
  const recent = useMemo(() => HelplineService.recent(envelope), [envelope]);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.pageEyebrow}>{t("helplineDashboardEyebrow")}</span>
        <h1 className={styles.pageTitle}>{t("helplineDashboardHeadline")}</h1>
        <p className={styles.pageIntro}>{t("helplineDashboardIntro")}</p>
        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <IconButton Icon={Phone} onClick={onNewCall} className={styles.dashboardPrimaryBtn}>
            {t("helplineNewCallBtn")}
          </IconButton>
          <IconButton Icon={Play} onClick={onContinueIntake}>
            {t("helplineNewIntakeBtn")}
          </IconButton>
        </div>
        <div style={{ marginTop: 8 }}>
          <SimulationTag kind="voice" label={t("helplineCallBanner")} />
        </div>
      </header>

      <section className={styles.kpis} aria-label={t("helplineKpiWaitingCalls")}>
        <div>
          <strong>{String(kpis.waitingCalls).padStart(2, "0")}</strong>
          <span>{t("helplineKpiWaitingCalls")}</span>
        </div>
        <div>
          <strong>{String(kpis.activeIntakes).padStart(2, "0")}</strong>
          <span>{t("helplineKpiActiveIntakes")}</span>
        </div>
        <div>
          <strong>{String(kpis.handoffs).padStart(2, "0")}</strong>
          <span>{t("helplineKpiHandoffs")}</span>
        </div>
        <div>
          <strong>{String(kpis.callbacks).padStart(2, "0")}</strong>
          <span>{t("helplineKpiCallbacks")}</span>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>{t("helplineQueuesHeading")}</h2>
          <SimulationTag kind="voice" label={t("helplineSimulationTagVoice")} />
        </div>
        <QueueList
          recent={recent}
          sessions={envelope.sessions}
          lang={lang}
          onOpenCall={onOpenCall}
          onOpenRecord={onOpenRecord}
        />
      </section>
    </div>
  );
}

function QueueList({
  recent,
  sessions,
  lang,
  onOpenCall,
  onOpenRecord,
}: {
  recent: ApplicationRecord[];
  sessions: IntakeSession[];
  lang: "bn" | "en";
  onOpenCall: (sessionId: string) => void;
  onOpenRecord: (applicationId: string) => void;
}) {
  const { t } = useI18n();
  const sessionByApp = new Map<string, IntakeSession>();
  for (const s of sessions) {
    if (s.applicationId) sessionByApp.set(s.applicationId, s);
  }
  return (
    <div className={styles.queueList}>
      {recent.length === 0 ? (
        <p className={styles.empty}>{t("helplineHandoffsEmpty")}</p>
      ) : null}
      {recent.map((r) => {
        const session = sessionByApp.get(r.applicationId);
        const applicant = r.facts.applicant_name?.value ?? r.applicationId;
        const status = r.status;
        return (
          <button
            key={r.applicationId}
            type="button"
            className={styles.queueRow}
            onClick={() =>
              session ? onOpenCall(session.id) : onOpenRecord(r.applicationId)
            }
          >
            <strong>{r.applicationId}</strong>
            <span>{applicant}</span>
            <span>
              <SimulationTag
                kind="voice"
                label={lang === "bn" ? "সিমুলেটেড" : "Simulated"}
              />
            </span>
            <span>{status}</span>
          </button>
        );
      })}
    </div>
  );
}

void MoreVertical;
