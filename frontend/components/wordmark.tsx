"use client";

import styles from "./wordmark.module.css";
import { BRAND } from "@/lib/brand";
import { useI18n } from "@/lib/i18n";
import { Scale } from "@/components/icons";

type WordmarkProps = {
  /**
   * `onDark` keeps the brand name white for use on dark surfaces
   * (e.g. the login left pane).
   *
   * `onSidebar` keeps the brand name white on the *light*
   * citizen-sidebar surface. We render the brand with a defined "card"
   * background on the sidebar header so the wordmark stays legible and
   * recognizable.
   *
   * `compact` pairs a small scale icon with the brand name + tagline
   * for the new dark citizen sidebar header. No card surface — the
   * parent sidebar already provides the dark plate.
   */
  variant?: "default" | "onDark" | "onSidebar" | "compact";
};

export function Wordmark({ variant = "default" }: WordmarkProps) {
  const { t } = useI18n();

  const className = [styles.wordmark]
    .concat(variant === "onDark" ? [styles.onDark] : [])
    .concat(variant === "onSidebar" ? [styles.onSidebar] : [])
    .concat(variant === "compact" ? [styles.compact] : [])
    .join(" ");

  return (
    <span className={className}>
      {variant === "compact" ? (
        <Scale size={22} className={styles.badge} aria-hidden />
      ) : null}
      <span className={styles.text}>
        <span className={styles.name}>{BRAND.name}</span>
        <span className={styles.tagline}>{t("tagline")}</span>
      </span>
    </span>
  );
}
