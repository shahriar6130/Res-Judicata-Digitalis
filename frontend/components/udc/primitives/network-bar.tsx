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

/**
 * Pick the colour modifier class for the current profile.
 *  - normal / reconnected → green
 *  - slow / intermittent   → amber
 *  - offline               → red
 * Text + icon are always present so colour is never the only signal.
 */
function netClass(kind: NetworkProfileKind): string {
  switch (kind) {
    case "offline":                       return styles.networkBarOffline!;
    case "slow":
    case "intermittent":                  return styles.networkBarWarn!;
    case "reconnected":                   return styles.networkBarReconnected!;
    default:                              return styles.networkBarNormal!;
  }
}

export function NetworkBar({ lang = "en" }: { lang?: "bn" | "en" }) {
  const [profile, setProfile] = useState<NetworkProfile>(() =>
    NetworkConditionService.current(),
  );

  useEffect(() => {
    return NetworkConditionService.subscribe(setProfile);
  }, []);

  return (
    <div
      className={`${styles.networkBar} ${netClass(profile.kind)}`}
      role="status"
      aria-live="polite"
    >
      <span className={styles.networkBarIcon} aria-hidden="true">
        {ICONS[profile.kind]}
      </span>
      <span className={styles.networkBarLabel}>
        {lang === "bn" ? profile.statusLabel.bn : profile.statusLabel.en}
      </span>
      <span className={styles.networkBarKind}>{profile.kind}</span>
      <span className={styles.networkBarStats}>
        <span><strong>{profile.latencyMs}</strong><small> ms</small></span>
        <span><strong>{Math.round(profile.packetLoss * 100)}</strong><small>% loss</small></span>
        <span><strong>{Math.round(profile.bandwidthBps / 1000)}</strong><small> kbps</small></span>
      </span>
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
