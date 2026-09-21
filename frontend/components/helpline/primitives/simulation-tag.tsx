"use client";

import type { ReactNode } from "react";

/* Reuse the dashed-border simulation badge from
   operational-role-dashboard.module.css. Re-import the module here so
   callers only need a single import. */
import styles from "../helpline.module.css";

type Kind = "voice" | "sms" | "ivr" | "officer_lookup";

interface SimulationTagProps {
  kind: Kind;
  label: string;
}

export function SimulationTag({ kind, label }: SimulationTagProps) {
  return (
    <span
      className={styles.simulationTag}
      data-kind={kind}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        border: "1px dashed var(--gray)",
        background: "transparent",
        color: "var(--gray)",
        fontSize: "var(--t-label)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </span>
  );
}

export function SimulationBadge({
  kind,
  children,
}: {
  kind: Kind;
  children: ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        padding: "2px 8px",
        border: "1px dashed var(--gray)",
        color: "var(--gray)",
        fontSize: "var(--t-label)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
      data-sim-kind={kind}
    >
      {children}
    </span>
  );
}
