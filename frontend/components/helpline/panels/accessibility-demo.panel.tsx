"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Moon } from "@/components/icons";
import { IconButton } from "../primitives/icon-button";
import styles from "../helpline.module.css";

export function AccessibilityDemoPanel() {
  const { t } = useI18n();
  const [seconds, setSeconds] = useState(60);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(60, s)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty(
      "--animation-play-state",
      reducedMotion ? "paused" : "running",
    );
    document.documentElement.dataset.reducedMotion = reducedMotion ? "true" : "false";
  }, [reducedMotion]);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.pageEyebrow}>{t("helplineNavAccessibility")}</span>
        <h1 className={styles.pageTitle}>{t("helplineAccessibilityTitle")}</h1>
      </header>

      <section className={styles.ivr} aria-label={t("helplineAccessibilityIvrWelcome")}>
        <h3>{t("helplineAccessibilityIvrWelcome")}</h3>
        <p>{t("helplineAccessibilityIvrMenu")}</p>
        <p className={styles.menu}>{t("helplineAccessibilityTimer")}: {seconds}s</p>
      </section>

      <section className={styles.callColumn}>
        <h2>{t("helplineAccessibilityNonVisualTitle")}</h2>
        <p>{t("helplineAccessibilityNonVisualBody")}</p>
        <ol style={{ paddingLeft: 24, lineHeight: 1.6 }}>
          <li>{t("helplineVerificationQuestion1")}</li>
          <li>{t("helplineVerificationQuestion2")}</li>
        </ol>
      </section>

      <section className={styles.callColumn}>
        <h2>{t("helplineAccessibilityReducedMotion")}</h2>
        <IconButton
          Icon={Moon}
          onClick={() => setReducedMotion((v) => !v)}
          className={reducedMotion ? styles.iconButtonDanger : ""}
        >
          {t("helplineReducedMotionBtn")}
        </IconButton>
      </section>
    </div>
  );
}
