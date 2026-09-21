"use client";

import styles from "./wordmark.module.css";
import { BRAND } from "@/lib/brand";
import { useI18n } from "@/lib/i18n";

type WordmarkProps = {
  onDark?: boolean;
};

export function Wordmark({ onDark = false }: WordmarkProps) {
  const { t } = useI18n();

  return (
    <span
      className={[styles.wordmark, onDark ? styles.onDark : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={styles.name}>{BRAND.name}</span>
      <span className={styles.tagline}>{t("tagline")}</span>
    </span>
  );
}