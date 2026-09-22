"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  ensureSeeded,
  useHelplineStore,
  VoiceStatusService,
  CitizenStatusService,
} from "@/lib/shakkho";
import styles from "@/components/lawyer/lawyer.module.css";

export default function VoiceStatusPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const { lang, setLang, t } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => { ensureSeeded(); }, []);

  const summary = useMemo(() => CitizenStatusService.safeForVoice(envelope, caseId), [envelope, caseId, tick]);
  const activeLang: "bn" | "en" = lang === "bn" ? "bn" : "en";

  function start() {
    const s = VoiceStatusService.startSession({ caseId, actor: "voice-ivr", language: activeLang });
    setSessionId(s.sessionId);
    setTick((x) => x + 1);
  }
  function press(key: "repeat" | "slower" | "back" | "human" | "exit" | "next" | "previous") {
    if (!sessionId) return;
    VoiceStatusService.recordKey({ sessionId, key, actor: "voice-ivr" });
    setTick((x) => x + 1);
  }
  function exit() {
    if (!sessionId) return;
    VoiceStatusService.endSession({ sessionId, actor: "voice-ivr", reason: "user_exit" });
    setSessionId("");
    setTick((x) => x + 1);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={`/citizen/cases/${caseId}/status`} className={styles.brand}>
          <span className={styles.brandEyebrow}>DLAS</span>
          <span>{t("voiceStatusTitle")}</span>
        </Link>
        <div className={styles.langRow}>
          <button type="button" onClick={() => setLang("bn")} className={`${styles.langBtn} ${lang === "bn" ? styles.langBtnActive : ""}`}>বাংলা</button>
          <button type="button" onClick={() => setLang("en")} className={`${styles.langBtn} ${lang === "en" ? styles.langBtnActive : ""}`}>English</button>
        </div>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t("voiceStatusTitle")}</h1>
        <p className={styles.intro}>{t("voiceStatusPrompt")}</p>

        {!sessionId ? (
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={start}>Start session</button>
          </div>
        ) : (
          <>
            <section className={styles.section}>
              <div className={styles.langToggle}>
                <span className={styles.kvLabel}>Language:</span>
                <span><span className={styles.tag}>{activeLang === "bn" ? "বাংলা" : "English"}</span></span>
              </div>
              <div className={styles.spokenText}>
                {activeLang === "bn" ? summary.bn : summary.en}
              </div>
              {summary.travelAdvisory && (
                <div className={styles.travelWarning}>{t("citizenStatusTravelAdvisory")}</div>
              )}
            </section>
            <section className={styles.section}>
              <div className={styles.kvLabel}>{t("voiceStatusPrompt")}</div>
              <div className={styles.actions} style={{ marginTop: 8 }}>
                <button type="button" className={styles.btn} onClick={() => press("repeat")}><span className={styles.kbd}>1</span> {t("voiceStatusRepeat")}</button>
                <button type="button" className={styles.btn} onClick={() => press("slower")}><span className={styles.kbd}>2</span> {t("voiceStatusSlower")}</button>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => press("back")}><span className={styles.kbd}>3</span> {t("voiceStatusBack")}</button>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => press("human")}><span className={styles.kbd}>9</span> {t("voiceStatusHuman")}</button>
                <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={exit}><span className={styles.kbd}>0</span> {t("voiceStatusExit")}</button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}