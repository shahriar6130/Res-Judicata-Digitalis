"use client";

import { useEffect, useState } from "react";
import {
  NetworkConditionService,
  type NetworkProfile,
  type NetworkProfileKind,
} from "@/lib/shakkho";
import styles from "../udc.module.css";

const PROFILES: NetworkProfileKind[] = [
  "normal",
  "slow",
  "intermittent",
  "offline",
  "reconnected",
];

const ICONS: Record<NetworkProfileKind, string> = {
  normal: "OK",
  slow: "··",
  intermittent: "≈",
  offline: "✕",
  reconnected: "↻",
};

export function NetworkBar({ lang = "en" }: { lang?: "bn" | "en" }) {
  const [profile, setProfile] = useState<NetworkProfile>(() =>
    NetworkConditionService.current(),
  );

  useEffect(() => {
    return NetworkConditionService.subscribe(setProfile);
  }, []);

  return (
    <div className={styles.networkBar} role="status" aria-live="polite">
      <span className={styles.networkBarIcon} aria-hidden="true">
        {ICONS[profile.kind]}
      </span>
      <span className={styles.networkBarLabel}>
        {lang === "bn" ? profile.statusLabel.bn : profile.statusLabel.en}
      </span>
      <span className={styles.networkBarKind}>{profile.kind}</span>
      <div className={styles.networkBarControls}>
        {PROFILES.map((p) => (
          <button
            key={p}
            type="button"
            className={`${styles.networkBarBtn} ${
              p === profile.kind ? styles.networkBarBtnActive : ""
            }`}
            onClick={() => NetworkConditionService.setProfile(p)}
            aria-pressed={p === profile.kind}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
