"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./sidebar.module.css";
import { Wordmark } from "@/components/wordmark";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n";

type SidebarProps = {
  role: "citizen" | "dlo" | "lawyer" | "admin";
  open?: boolean;
  onNavigate?: () => void;
};

const NAV_ITEMS: Record<
  "citizen" | "dlo" | "lawyer" | "admin",
  { href: string; label: MessageKey; key: string }[]
> = {
  citizen: [
    { href: "/dashboard/citizen#cases", label: "navMyCases", key: "my-cases" },
    { href: "/dashboard/citizen#messages", label: "navMessages", key: "messages" },
    { href: "/dashboard/citizen#profile", label: "navProfile", key: "profile" },
    { href: "/dashboard/citizen#complaint", label: "navFileComplaint", key: "file-complaint" },
  ],
  dlo: [
    { href: "/dashboard/dlo", label: "navActionQueue", key: "queue" },
    { href: "/dashboard/dlo#cases", label: "navCases", key: "cases" },
    { href: "/dashboard/dlo#queue", label: "navAlerts", key: "alerts" },
    { href: "/dashboard/dlo#queue", label: "navAssignments", key: "assignments" },
    { href: "/dashboard/dlo#queue", label: "navTimeline", key: "timeline" },
  ],
  lawyer: [
    { href: "/dashboard/lawyer", label: "navAssignedCases", key: "assigned" },
    { href: "/dashboard/lawyer#reports", label: "navHearingReports", key: "reports" },
    { href: "/dashboard/lawyer#calendar", label: "navCalendar", key: "calendar" },
    { href: "/dashboard/lawyer#assigned", label: "navProfile", key: "profile" },
  ],
  admin: [
    { href: "/dashboard/admin", label: "navOverview", key: "overview" },
    { href: "/dashboard/admin#users", label: "navUsers", key: "users" },
    { href: "/dashboard/admin#rules", label: "navRules", key: "rules" },
    { href: "/dashboard/admin#overview", label: "navMetrics", key: "metrics" },
    { href: "/dashboard/admin#audit", label: "navAudit", key: "audit" },
  ],
};

export function Sidebar({ role, open = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  const items = NAV_ITEMS[role];

  return (
    <aside className={`${styles.sidebar} ${open ? styles.open : ""}`} aria-label={lang === "bn" ? "প্রধান নেভিগেশন" : "Main navigation"}>
      <div className={styles.header}>
        <Wordmark />
      </div>
      <nav className={styles.nav} aria-label={lang === "bn" ? "ড্যাশবোর্ড" : "Dashboard"}>
        <ul className={styles.list}>
          {items.map((item) => {
            const isComplaint = item.key === "file-complaint";
            // Active match must split the path from the hash so hash-only
            // links (e.g. /dashboard/citizen#complaint) light up correctly
            // on the citizen route.
            const [itemPath, itemHash = ""] = item.href.split("#");
            const [currentPath, currentHash = ""] = pathname.split("#");
            const isActive =
              currentPath === itemPath &&
              (itemHash === "" || itemHash === currentHash);
            return (
              <li
                key={item.key}
                className={`${styles.listItem} ${isComplaint ? styles.listItemComplaint : ""}`}
              >
                <Link
                  href={item.href}
                  className={`${styles.link} ${isActive ? styles.active : ""} ${isComplaint ? styles.complaintLink : ""}`}
                  onClick={onNavigate}
                >
                  {t(item.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className={styles.simulatedSection}>
        <p className={styles.simulatedLabel}>{t("simulated")}</p>
        <ul className={styles.simulatedList}>
          <li className={styles.simulatedItem}>
            <Link href="/sim/clock" className={styles.simulatedLink}>
              {t("simClock")}
            </Link>
          </li>
          <li className={styles.simulatedItem}>
            <Link href="/sim/sms" className={styles.simulatedLink}>
              {t("simSms")}
            </Link>
          </li>
          <li className={styles.simulatedItem}>
            <Link href="/sim/court" className={styles.simulatedLink}>
              {t("simCourt")}
            </Link>
          </li>
          <li className={styles.simulatedItem}>
            <Link href="/sim/scenario" className={styles.simulatedLink}>
              {t("simScenario")}
            </Link>
          </li>
          <li className={styles.simulatedItem}>
            <Link href="/sim/reset" className={styles.simulatedLink}>
              {t("simReset")}
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  );
}
