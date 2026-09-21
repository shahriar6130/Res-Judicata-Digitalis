"use client";

import { useI18n } from "@/lib/i18n";
import {
  AlertCircle,
  ChevronRight,
  HelpingHand,
  Mail,
  Mic,
  MicOff,
  Play,
  Shield,
} from "@/components/icons";
import { IconButton } from "../primitives/icon-button";
import { SimulationTag } from "../primitives/simulation-tag";
import styles from "../helpline.module.css";

interface CallControlProps {
  sessionId: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onResume: () => void;
  onMute: () => void;
  onHold: () => void;
  onTransfer: () => void;
  onHangup: () => void;
  onSendSms: () => void;
  onHandoffDlao: () => void;
  onMarkUncertain: () => void;
  voiceAvailable: boolean;
  interrupted: boolean;
}

export function CallControl({
  sessionId,
  onConnect,
  onDisconnect,
  onResume,
  onMute,
  onHold,
  onTransfer,
  onHangup,
  onSendSms,
  onHandoffDlao,
  onMarkUncertain,
  voiceAvailable,
  interrupted,
}: CallControlProps) {
  const { t, lang } = useI18n();

  return (
    <div className={styles.callColumn}>
      <h2>{t("helplineCallPanelTitle")}</h2>
      <div className={styles.callBanner}>
        <SimulationTag kind="voice" label={t("helplineSimulationTagVoice")} />
        <span>{t("helplineCallBanner")}</span>
      </div>
      <small style={{ color: "var(--gray)" }}>
        {lang === "bn" ? "সেশন" : "Session"}: {sessionId}
      </small>

      <p style={{ color: "var(--gray)", fontSize: "var(--t-label)", margin: 0 }}>
        {t("helplineCallDialHint")}
      </p>
      <div className={styles.dialpad}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((key) => (
          <button key={key} type="button" aria-label={`key-${key}`}>{key}</button>
        ))}
      </div>

      <div className={styles.callActions}>
        <IconButton Icon={Play} onClick={onConnect}>
          {t("helplineConnectSimBtn")}
        </IconButton>
        <IconButton Icon={MicOff} onClick={onDisconnect}>
          {t("helplineDisconnectBtn")}
        </IconButton>
        {interrupted ? (
          <IconButton Icon={Play} onClick={onResume}>
            {t("helplineResumeBtn")}
          </IconButton>
        ) : null}
        <IconButton Icon={Mic} onClick={onMute}>
          {t("helplineMuteBtn")}
        </IconButton>
        <IconButton Icon={MicOff} onClick={onHold}>
          {t("helplineHoldBtn")}
        </IconButton>
        <IconButton Icon={ChevronRight} onClick={onTransfer}>
          {t("helplineTransferBtn")}
        </IconButton>
        <IconButton Icon={AlertCircle} onClick={onHangup} variant="danger">
          {t("helplineHangupBtn")}
        </IconButton>
        <IconButton Icon={Mail} onClick={onSendSms}>
          {t("helplineSendSmsBtn")}
        </IconButton>
        <IconButton Icon={HelpingHand} onClick={onHandoffDlao}>
          {t("helplineHandoffToDlaoBtn")}
        </IconButton>
        <IconButton Icon={AlertCircle} onClick={onMarkUncertain}>
          {t("helplineT5Uncertain")}
        </IconButton>
      </div>

      {!voiceAvailable ? (
        <p className={styles.safetyBanner}>
          <em>{t("helplineSimulationPausedNote")}</em>
        </p>
      ) : null}
    </div>
  );
}

void Shield;
