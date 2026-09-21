"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useHelplineStore, type ApplicationRecord } from "@/lib/shakkho";
import { FileText } from "@/components/icons";
import { IconButton } from "../primitives/icon-button";
import styles from "../helpline.module.css";

export function SearchPanel({ onOpenRecord }: { onOpenRecord: (id: string) => void }) {
  const { t, lang } = useI18n();
  const envelope = useHelplineStore();
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as ApplicationRecord[];
    return envelope.records.filter((r) => {
      const name = r.facts.applicant_name?.value ?? "";
      return (
        r.applicationId.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q)
      );
    });
  }, [envelope, query]);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.pageEyebrow}>{t("helplineNavSearchRecord")}</span>
        <h1 className={styles.pageTitle}>{t("helplineSearchTitle")}</h1>
      </header>

      <form
        className={styles.searchForm}
        onSubmit={(event) => event.preventDefault()}
      >
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("helplineSearchPlaceholder")}
          aria-label={t("helplineSearchTitle")}
        />
        <IconButton type="submit" Icon={FileText} className={styles.dashboardPrimaryBtn}>
          {t("helplineSearchBtn")}
        </IconButton>
      </form>

      <section className={styles.queueList}>
        {matches.length === 0 ? (
          <p className={styles.empty}>{t("helplineSearchEmpty")}</p>
        ) : null}
        {matches.map((r) => (
          <button
            key={r.applicationId}
            type="button"
            className={styles.queueRow}
            onClick={() => onOpenRecord(r.applicationId)}
          >
            <strong>{r.applicationId}</strong>
            <span>{r.facts.applicant_name?.value ?? "—"}</span>
            <span>{r.office}</span>
            <span>{r.status}</span>
          </button>
        ))}
      </section>
      {lang === "bn" ? null : null}
    </div>
  );
}
