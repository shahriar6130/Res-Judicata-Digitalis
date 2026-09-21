"use client";

import { useI18n, type MessageKey } from "@/lib/i18n";
import { useHashRoute } from "@/lib/use-hash-route";
import { Building, FileText, HelpingHand, Home } from "@/components/icons";
import styles from "./bottom-nav.module.css";

/* ------------------------------------------------------------------ *
 *  BottomNav — mobile-only navigation for the citizen role.
 *  Four tabs (Home / Lodge / Cases / UDC) fixed to the bottom edge.
 *  Active tab is derived from the URL hash so the sidebar's hash
 *  writes stay in sync without prop drilling.
 * ------------------------------------------------------------------ */

type TabKey = "home" | "complaint" | "cases" | "udc";

function tabActive(tab: TabKey, current: string): boolean {
  switch (tab) {
    case "home":
      return current === "home" || current === "";
    case "complaint":
      return current === "complaint";
    case "cases":
      return current === "cases" || current.startsWith("cases/");
    case "udc":
      return current === "udc" || current.startsWith("udc/");
  }
}

export function BottomNav({ role }: { role: string }) {
  const { t } = useI18n();
  const { navigate, current } = useHashRoute();

  // Only render for the citizen role (other roles keep using the
  // existing sidebar / drawer behaviour).
  if (role !== "citizen") return null;

  const tabs: { key: TabKey; labelKey: MessageKey; icon: React.ReactNode; hash: string }[] = [
    { key: "home", labelKey: "bottomNavHome", icon: <Home size={22} />, hash: "home" },
    { key: "complaint", labelKey: "bottomNavLodge", icon: <HelpingHand size={22} />, hash: "complaint" },
    { key: "cases", labelKey: "bottomNavCases", icon: <FileText size={22} />, hash: "cases" },
    { key: "udc", labelKey: "bottomNavUdc", icon: <Building size={22} />, hash: "udc" },
  ];

  return (
    <nav className={styles.bar} aria-label={t("navHome")}>
      {tabs.map((tab) => {
        const isActive = tabActive(tab.key, current);
        return (
          <button
            key={tab.key}
            type="button"
            className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
            onClick={() => navigate(tab.hash)}
            aria-current={isActive ? "page" : undefined}
          >
            <span className={styles.icon} aria-hidden>{tab.icon}</span>
            <span className={styles.label}>{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}