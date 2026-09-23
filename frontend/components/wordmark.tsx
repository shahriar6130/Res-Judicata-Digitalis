"use client";

import styles from "./wordmark.module.css";
import { BRAND } from "@/lib/brand";
import { useI18n } from "@/lib/i18n";

type WordmarkProps = {
  /**
   * `onDark` keeps the brand name white for use on dark surfaces
   * (e.g. the login left pane).
   *
   * `onSidebar` keeps the brand name white on the light sidebar
   * surface — the wordmark renders as a defined dark plate so the
   * brand stays immediately recognizable.
   *
   * `roleLabel` (optional) appends a small role badge underneath the
   * tagline — used by every legacy sidebar to surface which workspace
   * the user is on (Helpline / DLO / Lawyer / Admin).
   *
   * `roleSubLabel` (optional) appends a smaller sub-line beneath the
   * role badge with extra context (e.g. "16699 · Operations").
   */
  variant?: "default" | "onDark" | "onSidebar" | "compact";
  roleLabel?: string;
  roleSubLabel?: string;
};

export function Wordmark({ variant = "default", roleLabel, roleSubLabel }: WordmarkProps) {
  const { t } = useI18n();

  const className = [styles.wordmark]
    .concat(
      variant === "onDark" || variant === "compact" ? [styles.onDark] : [],
    )
    .concat(variant === "onSidebar" ? [styles.onSidebar] : [])
    .concat(roleLabel ? [styles.hasRoleBadge] : [])
    .join(" ");

  return (
    <span className={className}>
      <span className={styles.text}>
        <span className={styles.name}>
          {BRAND.name}
          <br />
        </span>
        <span className={styles.tagline}>{t("tagline")}</span>
        {roleLabel ? (
          <span className={styles.roleBadge} aria-label={`workspace: ${roleLabel}`}>
            <span className={styles.roleBadgeDot} aria-hidden />
            <span className={styles.roleBadgeText}>{roleLabel}</span>
            {roleSubLabel ? (
              <span className={styles.roleBadgeSub}>{roleSubLabel}</span>
            ) : null}
          </span>
        ) : null}
      </span>
    </span>
  );
}
