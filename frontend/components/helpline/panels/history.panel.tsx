"use client";

import { useI18n } from "@/lib/i18n";
import { useHelplineStore } from "@/lib/shakkho";
import styles from "../helpline.module.css";

export function HistoryPanel() {
  const { t } = useI18n();
  const envelope = useHelplineStore();
  const events = [...envelope.communications].reverse();
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.pageEyebrow}>{t("helplineNavHistory")}</span>
        <h1 className={styles.pageTitle}>{t("helplineHistoryTitle")}</h1>
      </header>
      <section className={styles.queueList}>
        {events.length === 0 ? (
          <p className={styles.empty}>{t("helplineHistoryEmpty")}</p>
        ) : null}
        {events.map((event) => (
          <article key={event.id} className={styles.queueRow}>
            <strong>{event.channel.toUpperCase()}</strong>
            <span>{event.body.en}</span>
            <span>{event.actor}</span>
            <span>{new Date(event.occurredAt).toLocaleString()}</span>
          </article>
        ))}
      </section>
    </div>
  );
}
