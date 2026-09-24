"use client";

import { useI18n, type MessageKey } from "@/lib/i18n";
import { useHashRoute } from "@/lib/use-hash-route";
import { Bell, Building, FileText, HelpingHand, Home } from "@/components/icons";
import { useCitizenApplications, useCitizenNotifications } from "@/lib/dlas/citizen-view";
import styles from "./bottom-nav.module.css";

/* ------------------------------------------------------------------ *
 *  BottomNav — mobile-only navigation for the citizen role.
 *  Four tabs (Home / Lodge / Cases / UDC) fixed to the bottom edge.
 *  Active tab is derived from the URL hash so the sidebar's hash
 *  writes stay in sync without prop drilling. "Lodge a Complaint"
 *  points at #intake — there's only one citizen-facing wizard now.
 * ------------------------------------------------------------------ */

type TabKey = "home" | "intake" | "cases" | "notifications" | "udc";

function tabActive(tab: TabKey, current: string): boolean {
  switch (tab) {
    case "home":
      return current === "home" || current === "";
    case "intake":
      // Backward-compatible: legacy #complaint hashes still highlight the tab.
      return current === "intake" || current === "complaint";
    case "cases":
      return current === "cases" || current.startsWith("cases/");
    case "notifications":
      return current === "notifications";
    case "udc":
      return current === "udc" || current.startsWith("udc/");
  }
}

export function BottomNav({ role }: { role: string }) {
  const { t } = useI18n();
  const { navigate, current } = useHashRoute();
  // Glow: unread notifications (bell) and documents the office is waiting for (cases).
  const unread = useCitizenNotifications().filter((n) => n.unread).length;
  const docsNeeded = useCitizenApplications().some(
    (a) => a.status !== "REJECTED" && a.status !== "RESOLVED" && a.status !== "CLOSED" && a.status !== "WITHDRAWN" && a.data.documents.some((d) => d.status !== "ATTACHED" && d.requested),
  );

  // Only render for the citizen role (other roles keep using the
  // existing sidebar / drawer behaviour).
  if (role !== "citizen") return null;

  const glowFor = (k: TabKey) => (k === "notifications" && unread > 0) || (k === "cases" && docsNeeded);
  const tabs: { key: TabKey; labelKey: MessageKey; icon: React.ReactNode; hash: string }[] = [
    { key: "home", labelKey: "bottomNavHome", icon: <Home size={22} />, hash: "home" },
    { key: "intake", labelKey: "navLodgeComplaint", icon: <HelpingHand size={22} />, hash: "intake" },
    { key: "cases", labelKey: "bottomNavCases", icon: <FileText size={22} />, hash: "cases" },
    { key: "notifications", labelKey: "navNotifications", icon: <Bell size={22} />, hash: "notifications" },
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
            <span className={`${styles.icon} ${glowFor(tab.key) ? styles.iconGlow : ""}`} aria-hidden>
              {tab.icon}
              {tab.key === "notifications" && unread > 0 ? <span className={styles.badge}>{unread}</span> : null}
              {tab.key === "cases" && docsNeeded ? <span className={styles.dot} /> : null}
            </span>
            <span className={styles.label}>{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
