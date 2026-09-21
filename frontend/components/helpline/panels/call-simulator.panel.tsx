"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  AuditTrailService,
  CallerVerificationService,
  CommunicationHistoryService,
  ConversationalIntakeService,
  IntakeSessionService,
  RepresentationService,
  SafeContactService,
  useHelplineStore,
} from "@/lib/shakkho";
import type { ApplicationRecord, IntakeSession } from "@/lib/shakkho";
import { AlertCircle, Check, Mail, Play, Shield } from "@/components/icons";
import { CallControl } from "./call-control";
import { Transcript } from "./transcript";
import { SharedRecord } from "./shared-record";
import { IconButton } from "../primitives/icon-button";
import { SimulationTag } from "../primitives/simulation-tag";
import styles from "../helpline.module.css";

interface CallSimulatorPanelProps {
  sessionId: string;
  onHandoffDlao: () => void;
  onSendSms: () => void;
}

export function CallSimulatorPanel({
  sessionId,
  onHandoffDlao,
  onSendSms,
}: CallSimulatorPanelProps) {
  const { t, lang } = useI18n();
  const envelope = useHelplineStore();
  const session = envelope.sessions.find((s) => s.id === sessionId);
  const record = session?.applicationId
    ? envelope.records.find((r) => r.applicationId === session.applicationId)
    : undefined;
  const audit = session?.applicationId
    ? AuditTrailService.listFor(envelope, session.applicationId)
    : [];

  const [draftCallerText, setDraftCallerText] = useState("");

  useEffect(() => {
    // Auto-start the T5 greeting the first time the panel mounts.
    if (!session) return;
    if (session.turns.length === 0) {
      ConversationalIntakeService.nextTurn({
        sessionId: session.id,
        actor: "t5",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session) {
    return <p className={styles.empty}>{t("helplineRecordNotFound")}</p>;
  }

  function start() {
    if (!session) return;
    ConversationalIntakeService.nextTurn({
      sessionId: session.id,
      actor: "agent",
    });
  }

  function connectCall() {
    if (!session) return;
    if (session.status === "active" || session.status === "in_progress") return;
    IntakeSessionService.setStatus(session.id, "active", "agent");
    CommunicationHistoryService.append({
      sessionId: session.id,
      channel: "voice",
      direction: "system",
      actor: "t5",
      body: { bn: "কল সংযুক্ত (সিমুলেটেড)।", en: "Call connected (simulated)." },
    });
  }

  function disconnect() {
    if (!session) return;
    IntakeSessionService.interrupt(session.id, "agent");
  }

  function resume() {
    if (!session) return;
    IntakeSessionService.resume(session.id, "agent");
  }

  function recordRepresentative() {
    if (!session?.applicationId) return;
    RepresentationService.record({
      applicationId: session.applicationId,
      callerName: "Ripon",
      callerRelation: "neighbour",
      actor: "agent",
    });
  }
  void recordRepresentative;

  function markUncertain() {
    if (!session) return;
    ConversationalIntakeService.markUncertain(session.id, "category", "agent");
  }

  function verifyPass() {
    if (!session) return;
    const v = CallerVerificationService.begin({ sessionId: session.id, actor: "agent" });
    CallerVerificationService.pass(v.id, "agent");
  }

  function verifyFail() {
    if (!session) return;
    const v = CallerVerificationService.begin({ sessionId: session.id, actor: "agent" });
    CallerVerificationService.fail(v.id, "agent");
  }

  function evalSafeContact() {
    if (!session?.applicationId || !record) return;
    const evaluation = SafeContactService.evaluate(record);
    SafeContactService.attach(record.applicationId, evaluation, "agent");
  }

  function callerSubmit() {
    if (!session || !draftCallerText.trim()) return;
    ConversationalIntakeService.nextTurn({
      sessionId: session.id,
      actor: "agent",
      lastUtterance: {
        bn: draftCallerText,
        en: draftCallerText,
      },
    });
    setDraftCallerText("");
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.pageEyebrow}>
          {t("helplineCallPanelTitle")} · {session.id}
        </span>
        <h1 className={styles.pageTitle}>
          {session.applicationId ?? t("helplineCallPanelTitle")}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <SimulationTag kind="voice" label={t("helplineSimulationTagVoice")} />
        </div>
      </header>

      <section className={styles.callGrid}>
        <CallControl
          sessionId={session.id}
          voiceAvailable={session.voiceAvailable}
          interrupted={session.status === "interrupted"}
          onConnect={connectCall}
          onDisconnect={disconnect}
          onResume={resume}
          onMute={() => undefined}
          onHold={() => undefined}
          onTransfer={() => undefined}
          onHangup={disconnect}
          onSendSms={onSendSms}
          onHandoffDlao={onHandoffDlao}
          onMarkUncertain={markUncertain}
        />

        <div className={styles.callColumn}>
          <h2>{t("helplineTranscriptHeading")}</h2>
          <Transcript turns={session.turns} />
          <div className={styles.callerInputRow}>
            <input
              type="text"
              value={draftCallerText}
              onChange={(e) => setDraftCallerText(e.target.value)}
              placeholder={lang === "bn" ? "কলারের বক্তব্য লিখুন…" : "Type caller utterance…"}
              className={styles.callerInput}
            />
            <IconButton Icon={Mail} onClick={callerSubmit} size="md" className={`${styles.callerSendBtn} ${styles.callerSendBtnEnd}`}>
              {lang === "bn" ? "পাঠান" : "Send"}
            </IconButton>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <IconButton Icon={Play} onClick={start} size="sm">
              {lang === "bn" ? "টি-৫ শুরু" : "T5 step"}
            </IconButton>
            <IconButton Icon={Check} onClick={verifyPass} size="sm">
              {t("helplineVerificationPassBtn")}
            </IconButton>
            <IconButton Icon={AlertCircle} onClick={verifyFail} size="sm" variant="danger">
              {t("helplineVerificationFailBtn")}
            </IconButton>
            <IconButton Icon={Shield} onClick={evalSafeContact} size="sm">
              {t("helplineRecordSafeContact")}
            </IconButton>
          </div>
        </div>

        <SharedRecord
          record={record}
          audit={audit}
          provenance={record?.provenance ?? []}
          safeContact={record?.safeContact}
        />
      </section>
    </div>
  );
}

void undefined as unknown as ApplicationRecord;
void undefined as unknown as IntakeSession;
