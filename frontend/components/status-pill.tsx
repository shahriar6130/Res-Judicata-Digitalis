"use client";

import type { CaseStatus } from "@/lib/case-demo";
import { useI18n, type Lang } from "@/lib/i18n";
import styles from "./status-pill.module.css";

/* ------------------------------------------------------------------ *
 *  StatusPill — labeled colour dot for case status.
 *  Every status renders BOTH a colour and a text label so the colour
 *  is never the sole carrier of meaning (rural users, low-vision,
 *  monochrome printing).
 *
 *  Mapping:
 *    submitted / under_review   → review (amber)
 *    approved                   → active (green)
 *    mediation_started          → active (green)
 *    agreement_pending          → needs-action (red)
 *    resolved                   → resolved (gray)
 *    closed                     → resolved (gray)
 * ------------------------------------------------------------------ */

type StatusPillProps = {
  status: CaseStatus;
  lang?: Lang;
  /** When true, omits the dot (compact text-only mode). */
  compact?: boolean;
};

type StatusKind = "active" | "review" | "needs-action" | "resolved";

function classify(status: CaseStatus): StatusKind {
  switch (status) {
    case "approved":
    case "mediation_started":
      return "active";
    case "submitted":
    case "under_review":
      return "review";
    case "agreement_pending":
      return "needs-action";
    case "resolved":
    case "closed":
      return "resolved";
  }
}

function labelFor(status: CaseStatus, lang: Lang): string {
  if (lang === "bn") {
    switch (status) {
      case "submitted": return "জমা হয়েছে";
      case "under_review": return "পর্যালোচনাধীন";
      case "approved": return "অনুমোদিত";
      case "mediation_started": return "মধ্যস্থতা চলছে";
      case "agreement_pending": return "চুক্তি অনুমোদনের অপেক্ষায়";
      case "resolved": return "নিষ্পত্তি";
      case "closed": return "বন্ধ";
    }
  }
  switch (status) {
    case "submitted": return "Submitted";
    case "under_review": return "Under review";
    case "approved": return "Approved";
    case "mediation_started": return "Mediation in progress";
    case "agreement_pending": return "Needs action";
    case "resolved": return "Resolved";
    case "closed": return "Closed";
  }
}

export function StatusPill({ status, lang: langProp, compact }: StatusPillProps) {
  const i18n = useI18n();
  const lang = langProp ?? i18n.lang;
  const kind = classify(status);
  const text = labelFor(status, lang);
  return (
    <span className={`${styles.pill} ${styles[kind]} ${compact ? styles.compact : ""}`}>
      <span className={styles.dot} aria-hidden />
      <span className={styles.text}>{text}</span>
    </span>
  );
}