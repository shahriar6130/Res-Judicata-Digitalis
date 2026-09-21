"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  CommunicationHistoryService,
  HumanHandoffService,
  IntakeSessionService,
  ensureSeeded,
  useHelplineStore,
} from "@/lib/shakkho";
import { Phone, Play } from "@/components/icons";
import { SkipLink } from "./primitives/skip-link";
import { DashboardPanel } from "./panels/dashboard.panel";
import { CallSimulatorPanel } from "./panels/call-simulator.panel";
import { IntakeWorkspacePanel } from "./panels/intake-workspace.panel";
import { SearchPanel } from "./panels/search.panel";
import { HandoffsPanel } from "./panels/handoffs.panel";
import { CallbacksPanel } from "./panels/callbacks.panel";
import { HistoryPanel } from "./panels/history.panel";
import { AccessibilityDemoPanel } from "./panels/accessibility-demo.panel";
import { DlaoApplicantContactPanel } from "./panels/dlao-applicant-contact.panel";
import { IconButton } from "./primitives/icon-button";
import { ActiveCallBar } from "./primitives/active-call-bar";
import { RiponScript } from "@/lib/shakkho/assistants/ripon.script";
import styles from "./helpline.module.css";

function readHash(): { route: string; param?: string; query?: string } {
  if (typeof window === "undefined") return { route: "dashboard" };
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return { route: "dashboard" };
  const [path, queryString = ""] = raw.split("?");
  const [route, ...rest] = path.split("/");
  return { route, param: rest.join("/") || undefined, query: queryString };
}

export function HelplineWorkspace() {
  const { t, lang } = useI18n();
  const envelope = useHelplineStore();
  const [hash, setHash] = useState<{ route: string; param?: string; query?: string }>({
    route: "dashboard",
  });

  useEffect(() => {
    ensureSeeded();
    function sync() {
      setHash(readHash());
    }
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function navigate(hashValue: string) {
    if (typeof window === "undefined") return;
    if (window.location.hash === `#${hashValue}`) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.hash = hashValue;
    }
  }

  function gotoSession(sessionId: string) {
    navigate(`call/${sessionId}`);
  }

  function gotoRecord(applicationId: string) {
    navigate(`record/${applicationId}`);
  }

  function newCall() {
    const record = envelope.records[0];
    if (!record) return;
    const session = IntakeSessionService.start({
      actor: "agent",
      applicationId: record.applicationId,
    });
    gotoSession(session.id);
  }

  function newIntake() {
    const record = envelope.records.find((r) => r.applicationId === "TEMP-SAF-02");
    if (!record) return;
    const session = IntakeSessionService.start({
      actor: "agent",
      applicationId: record.applicationId,
    });
    gotoSession(session.id);
  }

  function sendSms() {
    const session = envelope.sessions.find((s) => s.status === "active");
    if (!session) return;
    const app = envelope.records.find((r) => r.applicationId === session.applicationId);
    CommunicationHistoryService.smsSimulated({
      sessionId: session.id,
      actor: "agent",
      body: {
        bn: `আপনার অস্থায়ী রসিদ: ${app?.applicationId ?? session.id}`,
        en: `Your temporary receipt: ${app?.applicationId ?? session.id}`,
      },
    });
    if (app) {
      IntakeSessionService.setStatus(session.id, "ready_for_confirmation", "agent");
    }
  }

  function handoffToDlao() {
    const session = envelope.sessions.find((s) => s.status !== "interrupted");
    if (!session?.applicationId) return;
    IntakeSessionService.requestHandoff({
      sessionId: session.id,
      reason: "general",
      targetRole: "dlao",
      actor: "agent",
    });
  }

  return (
    <>
      <SkipLink targetId="helpline-main" />
      <main id="helpline-main" tabIndex={-1}>
        <h1 className={styles.pageTitle} style={{ position: "absolute", left: -9999 }}>
          {t("helplineMainHeading")}
        </h1>
        {hash.route === "call" && hash.param ? (
          <CallSimulatorPanel
            sessionId={hash.param}
            onSendSms={sendSms}
            onHandoffDlao={handoffToDlao}
          />
        ) : null}

        {hash.route === "intake" && hash.param ? (
          <IntakeWorkspacePanel sessionId={hash.param} />
        ) : null}

        {hash.route === "record" && hash.param ? (
          <RecordViewPanel applicationId={hash.param} />
        ) : null}

        {hash.route === "search" ? <SearchPanel onOpenRecord={gotoRecord} /> : null}
        {hash.route === "handoffs" ? <HandoffsPanel /> : null}
        {hash.route === "callbacks" ? <CallbacksPanel /> : null}
        {hash.route === "history" ? <HistoryPanel /> : null}
        {hash.route === "accessibility-demo" ? <AccessibilityDemoPanel /> : null}

        {hash.route === "dlao-applicant-contact" && hash.param ? (
          <DlaoApplicantContactPanel applicationId={hash.param} />
        ) : null}

        {hash.route === "ripon-call" ? <RiponCallDemoPanel /> : null}

        {hash.route === "new-call" || hash.route === "new-intake" ? (
          <NewActionChooser
            lang={lang}
            onNewCall={newCall}
            onContinueIntake={newIntake}
          />
        ) : null}

        {hash.route === "dashboard" || !hash.route ? (
          <DashboardPanel
            onNewCall={() => navigate("new-call")}
            onContinueIntake={() => navigate("new-intake")}
            onOpenCall={gotoSession}
            onOpenRecord={gotoRecord}
          />
        ) : null}
      </main>
      <ActiveCallBar />
      <HumanHandoffServiceShim />
      <RiponScriptShim />
    </>
  );
}

function HumanHandoffServiceShim() {
  void HumanHandoffService;
  return null;
}

function RiponScriptShim() {
  void RiponScript;
  return null;
}

function NewActionChooser({
  lang,
  onNewCall,
  onContinueIntake,
}: {
  lang: "bn" | "en";
  onNewCall: () => void;
  onContinueIntake: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.pageEyebrow}>{lang === "bn" ? "১৬৬৯৯" : "16699"}</span>
        <h1 className={styles.pageTitle}>{t("helplineNewCallTitle")}</h1>
        <p className={styles.pageIntro}>{t("helplineNewCallBody")}</p>
      </header>
      <section className={styles.callColumn}>
        <IconButton Icon={Phone} onClick={onNewCall} className={styles.dashboardPrimaryBtn}>
          {t("helplineNewCallBtn")}
        </IconButton>
        <IconButton Icon={Play} onClick={onContinueIntake}>
          {t("helplineNewIntakeBtn")}
        </IconButton>
      </section>
    </div>
  );
}

function RecordViewPanel({ applicationId }: { applicationId: string }) {
  const { t } = useI18n();
  const envelope = useHelplineStore();
  const record = envelope.records.find((r) => r.applicationId === applicationId);
  if (!record) return <p className={styles.empty}>{t("helplineRecordNotFound")}</p>;
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.pageEyebrow}>{t("helplineRecordHeading")}</span>
        <h1 className={styles.pageTitle}>{record.applicationId}</h1>
        <p className={styles.pageIntro}>{record.office}</p>
      </header>
      <section className={styles.callColumn}>
        <h2>{record.facts.applicant_name?.value ?? "—"}</h2>
        <p style={{ color: "var(--gray)" }}>
          {record.status} · {record.channel}
        </p>
        <ul className={styles.provenanceList}>
          {Object.entries(record.facts).map(([k, v]) => (
            <li key={k}>
              <span>{k}</span>
              <span>{v?.value ?? "—"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Lightweight demo panel used by /helpline/calls/... and as the
 *  Ripon call page itself. */
function RiponCallDemoPanel() {
  const { t } = useI18n();
  const transcript = RiponScript.buildDemoTranscript();
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.pageEyebrow}>
          {t("helplineDashboardEyebrow")} · Ripon / Moyuri
        </span>
        <h1 className={styles.pageTitle}>{t("helplineCallPanelTitle")}</h1>
      </header>
      <section className={styles.callColumn}>
        <h2>{t("helplineTranscriptHeading")}</h2>
        <div className={styles.transcript}>
          {transcript.map((turn, i) => (
            <div
              key={i}
              className={`${styles.turn} ${turn.speaker === "caller" ? styles.caller : ""}`}
            >
              <div className={styles.turnHead}>
                <span>{turn.speaker === "t5" ? "T5" : "Ripon"}</span>
              </div>
              <p className={styles.turnBody}>{turn.text.en}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
