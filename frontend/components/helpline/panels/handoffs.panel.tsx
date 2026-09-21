"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { HumanHandoffService, useHelplineStore } from "@/lib/shakkho";
import { AlertCircle, Check, Users } from "@/components/icons";
import { IconButton } from "../primitives/icon-button";
import styles from "../helpline.module.css";

type Filter = "all" | "dlao" | "human";

export function HandoffsPanel() {
  const { t } = useI18n();
  const envelope = useHelplineStore();
  const [filter, setFilter] = useState<Filter>("all");

  const items = useMemo(() => {
    return envelope.handoffs.filter((h) => {
      if (filter === "all") return true;
      if (filter === "dlao") return h.targetRole === "dlao";
      return h.targetRole !== "dlao";
    });
  }, [envelope.handoffs, filter]);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.pageEyebrow}>{t("helplineNavHandoffs")}</span>
        <h1 className={styles.pageTitle}>{t("helplineHandoffsTitle")}</h1>
      </header>

      <nav className={styles.tabs} aria-label="handoff filter">
        {(["all", "dlao", "human"] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={filter === key ? styles.active : ""}
            onClick={() => setFilter(key)}
          >
            <span className={styles.tabIcon} aria-hidden>
              {key === "all" ? (
                <AlertCircle size={14} />
              ) : key === "dlao" ? (
                <Users size={14} />
              ) : (
                <Users size={14} />
              )}
            </span>
            {key === "all"
              ? t("helplineHandoffsAllTab")
              : key === "dlao"
                ? t("helplineHandoffsDlaoTab")
                : t("helplineHandoffsHumanTab")}
          </button>
        ))}
      </nav>

      <section className={styles.queueList}>
        {items.length === 0 ? (
          <p className={styles.empty}>{t("helplineHandoffsEmpty")}</p>
        ) : null}
        {items.map((h) => (
          <article key={h.id} className={styles.queueRow}>
            <strong>{h.targetRole.toUpperCase()}</strong>
            <span>{h.reason}</span>
            <span>{h.applicationId ?? "—"}</span>
            <span>
              {h.status}{" "}
              {h.status !== "completed" ? (
                <IconButton
                  Icon={Check}
                  size="sm"
                  onClick={() => HumanHandoffService.complete(h.id, "agent")}
                >
                  {t("helplineHandoffsCompleteBtn")}
                </IconButton>
              ) : null}
            </span>
          </article>
        ))}
      </section>
    </div>
  );
}
