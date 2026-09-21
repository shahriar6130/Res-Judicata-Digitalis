"use client";

import { useI18n } from "@/lib/i18n";
import { LiveRegion } from "../primitives/live-region";
import { SimulationTag } from "../primitives/simulation-tag";
import type { ConversationalIntakeTurn } from "@/lib/shakkho";
import styles from "../helpline.module.css";

interface TranscriptProps {
  turns: ConversationalIntakeTurn[];
}

export function Transcript({ turns }: TranscriptProps) {
  const { t, lang } = useI18n();
  if (turns.length === 0) {
    return <p className={styles.empty}>{t("helplineTranscriptEmpty")}</p>;
  }
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: "var(--s-2) 0",
          marginBottom: 12,
        }}
      >
        <SimulationTag kind="voice" label={t("helplineSimulationTagVoice")} />
        <span style={{ fontSize: "var(--t-label)", color: "var(--gray)" }}>
          {t("helplineTranscriptHeading")}
        </span>
      </div>
      <LiveRegion politeness="polite" role="log" atomic={false}>
        <div className={styles.transcript}>
          {turns.map((turn, idx) => (
            <article
              key={`${turn.spokenAt}-${idx}`}
              className={`${styles.turn} ${turn.speaker === "caller" ? styles.caller : ""}`}
            >
              <header className={styles.turnHead}>
                <strong>{turn.speaker === "t5" ? "T5" : "Caller"}</strong>
                <span>{new Date(turn.spokenAt).toLocaleTimeString(lang === "bn" ? "bn-BD" : "en-GB")}</span>
                {turn.uncertain ? (
                  <SimulationTag kind="voice" label={t("helplineT5Uncertain")} />
                ) : null}
              </header>
              <p className={styles.turnBody}>{turn.text[lang]}</p>
            </article>
          ))}
        </div>
      </LiveRegion>
    </div>
  );
}
