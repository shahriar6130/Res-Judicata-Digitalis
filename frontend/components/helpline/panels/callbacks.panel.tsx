"use client";

import { useI18n } from "@/lib/i18n";
import { IntakeSessionService, useHelplineStore } from "@/lib/shakkho";
import { Check } from "@/components/icons";
import { IconButton } from "../primitives/icon-button";
import styles from "../helpline.module.css";

export function CallbacksPanel() {
  const { t, lang } = useI18n();
  const envelope = useHelplineStore();
  const promises = envelope.sessions.filter(
    (s) => s.status === "waiting_for_caller" || s.status === "interrupted",
  );

  function markContacted(sessionId: string) {
    IntakeSessionService.setStatus(sessionId, "submitted", "agent");
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.pageEyebrow}>{t("helplineNavHistory")}</span>
        <h1 className={styles.pageTitle}>{t("helplineCallbacksTitle")}</h1>
      </header>
      <section className={styles.queueList}>
        {promises.length === 0 ? (
          <p className={styles.empty}>{t("helplineCallbacksEmpty")}</p>
        ) : null}
        {promises.map((s) => (
          <article key={s.id} className={styles.queueRow}>
            <strong>{s.applicationId ?? s.id}</strong>
            <span>{s.status}</span>
            <span>{new Date(s.startedAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}</span>
            <IconButton Icon={Check} size="sm" onClick={() => markContacted(s.id)}>
              {t("helplineCallbacksMarkBtn")}
            </IconButton>
          </article>
        ))}
      </section>
    </div>
  );
}
