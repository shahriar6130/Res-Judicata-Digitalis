"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { LanguageToggle } from "@/components/language-toggle";
import styles from "./layout.module.css";
import { useI18n } from "@/lib/i18n";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useI18n();

  const role = (pathname?.split("/")[2] ?? "citizen") as "citizen" | "dlo" | "lawyer" | "admin";

  return (
    <div className={styles.wrapper}>
      <Sidebar role={role} open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <div className={styles.main}>
        <header className={styles.header}>
          <button
            className={styles.menuBtn}
            onClick={() => setSidebarOpen(true)}
            aria-label={t("openMenu")}
            aria-expanded={sidebarOpen}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className={styles.headerRight}>
            <LanguageToggle />
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
      {sidebarOpen && (
        <div
          className={styles.overlay}
          onClick={() => setSidebarOpen(false)}
          aria-label={t("closeMenu")}
        />
      )}
    </div>
  );
}
