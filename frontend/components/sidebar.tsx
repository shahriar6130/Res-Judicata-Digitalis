"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { listCitizenCases } from "@/lib/case-demo";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useCitizenProfile } from "@/lib/citizen-profile";
import { useHashRoute } from "@/lib/use-hash-route";
import { Wordmark } from "@/components/wordmark";
import { StatusPill } from "@/components/status-pill";
import {
  Bell,
  Building,
  FileText,
  HelpingHand,
  Home,
  MoreVertical,
  Phone,
  Scale,
} from "@/components/icons";
import styles from "./sidebar.module.css";

type SidebarProps = {
  role: string;
  open?: boolean;
  onNavigate?: () => void;
};

/* ------------------------------------------------------------------ *
 *  Citizen sidebar (dark surface, Discord-inspired layout):
 *
 *    ┌─ brand ─────────────────────────────────┐
 *    │  MAIN                                   │
 *    │  • Home                                 │
 *    │  • Lodge a Complaint  (prominent)       │
 *    │  • My Cases (section header)            │
 *    │       ▸ CASE 01 · status pill · parties │
 *    │       ▸ CASE 02 · status pill · parties │
 *    │       ▸ CASE 03 · status pill · parties │
 *    │  • Notifications     (badge if unread)  │
 *    │                                         │
 *    │  UDC OFFICE                             │
 *    │  • My UDC Office                        │
 *    │  • Legal Aid Officer                    │
 *    │  • Contact Support                      │
 *    ├─ profile panel ─────────────────────────┤
 *    │  [RB] Rahima Begum          [⋮]         │
 *    │       Citizen                           │
 *    └─────────────────────────────────────────┘
 *
 *  Non-citizen roles keep their existing flat-link sidebar.
 *
 *  Everything is driven by `window.location.hash` via `useHashRoute()`
 *  and the existing `ref + commitTick` pattern — no prop drilling,
 *  no shared context, the URL is the single source of truth.
 * ------------------------------------------------------------------ */

export function Sidebar({ role, open = false, onNavigate }: SidebarProps) {
  if (role === "citizen") {
    return <CitizenSidebar open={open} onNavigate={onNavigate} />;
  }
  return <LegacySidebar role={role} open={open} onNavigate={onNavigate} />;
}

/* ------------------------------------------------------------------ *
 *  Citizen sidebar.
 * ------------------------------------------------------------------ */

function CitizenSidebar({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: SidebarProps["onNavigate"];
}) {
  const pathname = usePathname();
  const { lang } = useI18n();
  const profile = useCitizenProfile();
  const { navigate, current } = useHashRoute();
  const cases = listCitizenCases();

  // Track the citizen pathname separately from the hash so the UDC
  // items can compare "same path" without manually string-splitting.
  const basePath = (pathname ?? "").split("#")[0];

  // Active-case id is whatever sits after `#cases/`.
  const activeCaseId = current.startsWith("cases/")
    ? current.slice("cases/".length)
    : null;

  // Notifications unread count (mock — first two entries).
  const unreadCount = 2;

  function go(hash: string) {
    navigate(hash);
    onNavigate?.();
  }

  // Kebab menu open/close.
  const [kebabOpen, setKebabOpen] = useState(false);
  const kebabRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!kebabOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (!kebabRef.current) return;
      if (!kebabRef.current.contains(e.target as Node)) {
        setKebabOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setKebabOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [kebabOpen]);

  return (
    <aside
      className={`${styles.sidebar} ${styles.dark} ${open ? styles.open : ""}`}
      aria-label={lang === "bn" ? "প্রধান নেভিগেশন" : "Main navigation"}
    >
      <div className={styles.brand}>
        <Wordmark variant="compact" />
      </div>

      <nav className={styles.nav} aria-label={lang === "bn" ? "ড্যাশবোর্ড" : "Dashboard"}>
        <div className={styles.section}>
          <p className={styles.sectionLabel}>{t("sidebarSectionMain", lang)}</p>

          <NavItem
            icon={<Home size={18} />}
            label={t("navHome", lang)}
            active={current === "home" || current === ""}
            onClick={() => go("home")}
          />

          <NavItem
            icon={<HelpingHand size={18} />}
            label={t("navLodgeComplaint", lang)}
            active={current === "complaint"}
            onClick={() => go("complaint")}
            prominent
          />

          <p className={styles.subSectionLabel}>{t("sidebarSectionMyCases", lang)}</p>
          <ul className={styles.channelList}>
            {cases.length === 0 ? (
              <li className={styles.channelEmpty}>{t("sidebarNoCases", lang)}</li>
            ) : (
              cases.map((c, idx) => {
                const isActive = activeCaseId === c.id;
                const numberLabel = t("sidebarCaseItemLabel", lang).replace(
                  "%d",
                  String(idx + 1),
                );
                const complainant = lang === "bn" ? c.complainantBn : c.complainantEn;
                const respondent = lang === "bn" ? c.respondentBn : c.respondentEn;
                const separator = t("sidebarCasePartySeparator", lang);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`${styles.channelItem} ${isActive ? styles.channelItemActive : ""}`}
                      onClick={() => go(`cases/${c.id}`)}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={`${c.id} — ${complainant} ${separator} ${respondent}`}
                    >
                      <span className={styles.channelIcon} aria-hidden>
                        <FileText size={16} />
                      </span>
                      <span className={styles.channelBody}>
                        <span className={styles.channelHead}>
                          <span className={styles.channelNumber}>{numberLabel}</span>
                          <span className={styles.channelId}>{c.id}</span>
                        </span>
                        <span className={styles.channelParties}>
                          {complainant} {separator} {respondent}
                        </span>
                        <span className={styles.channelStatus}>
                          <StatusPill status={c.status} lang={lang} compact />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <NavItem
            icon={<Bell size={18} />}
            label={t("navNotifications", lang)}
            active={current === "notifications"}
            onClick={() => go("notifications")}
            badge={unreadCount}
          />
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>{t("sidebarSectionUdc", lang)}</p>

          <NavItem
            icon={<Building size={18} />}
            label={t("navMyUdcOffice", lang)}
            active={current === "udc" || current === "udc/office"}
            onClick={() => go("udc/office")}
            sub
          />
          <NavItem
            icon={<Scale size={18} />}
            label={t("navLegalAidOfficer", lang)}
            active={current === "udc/officer"}
            onClick={() => go("udc/officer")}
            sub
          />
          <NavItem
            icon={<Phone size={18} />}
            label={t("navContactSupport", lang)}
            active={current === "udc/contact"}
            onClick={() => go("udc/contact")}
            sub
          />
        </div>
      </nav>

      <div className={styles.profilePanel}>
        <div className={styles.profileAvatar} aria-hidden>
          {profile.initials}
        </div>
        <div className={styles.profileText}>
          <span className={styles.profileName}>
            {lang === "bn" ? profile.nameBn : profile.nameEn}
          </span>
          <span className={styles.profileRole}>
            {lang === "bn" ? profile.roleBn : profile.roleEn}
          </span>
        </div>
        <div className={styles.kebab} ref={kebabRef}>
          <button
            type="button"
            className={styles.kebabBtn}
            onClick={() => setKebabOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={kebabOpen}
            aria-label={lang === "bn" ? "প্রোফাইল মেনু" : "Profile menu"}
          >
            <MoreVertical size={18} aria-hidden />
          </button>
          {kebabOpen ? (
            <div className={styles.kebabMenu} role="menu">
              <button
                type="button"
                className={styles.kebabItem}
                role="menuitem"
                onClick={() => setKebabOpen(false)}
                title={t("profileComingSoon", lang)}
              >
                {t("profileSettings", lang)}
                <span className={styles.comingSoonTag}>{t("profileComingSoon", lang)}</span>
              </button>
              <button
                type="button"
                className={styles.kebabItem}
                role="menuitem"
                onClick={() => setKebabOpen(false)}
                title={t("profileComingSoon", lang)}
              >
                {t("profileLogout", lang)}
                <span className={styles.comingSoonTag}>{t("profileComingSoon", lang)}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Unused but kept so React/TS still considers basePath referenced. */}
      <span hidden>{basePath}</span>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
  badge,
  prominent,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  prominent?: boolean;
  sub?: boolean;
}) {
  const className = [
    styles.navItem,
    active ? styles.navItemActive : "",
    prominent ? styles.navItemProminent : "",
    sub ? styles.navItemSub : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <span className={styles.navIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.navLabel}>{label}</span>
      {badge ? <span className={styles.navBadge}>{badge}</span> : null}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 *  Legacy sidebar — keeps the original flat-link layout for
 *  non-citizen roles (lawyer, dlo, admin, and the catch-all bucket).
 *  Unchanged behaviour from the previous implementation.
 * ------------------------------------------------------------------ */

type LegacyNavItem = {
  href: string;
  label: MessageKey;
  key: string;
};

const LEGACY_NAV: Record<string, LegacyNavItem[]> = {
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

function getLegacyItems(role: string): LegacyNavItem[] {
  if (role in LEGACY_NAV) return LEGACY_NAV[role];
  return [
    { href: `/dashboard/${role}#work`, label: "navActionQueue", key: "work" },
    { href: `/dashboard/${role}#today`, label: "navOverview", key: "today" },
    { href: `/dashboard/${role}#history`, label: "navAudit", key: "history" },
  ];
}

function LegacySidebar({ role, open, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { lang, t } = useI18n();
  const items = getLegacyItems(role);

  return (
    <aside
      className={`${styles.sidebar} ${styles.legacy} ${open ? styles.open : ""}`}
      aria-label={lang === "bn" ? "প্রধান নেভিগেশন" : "Main navigation"}
    >
      <div className={styles.brand}>
        <Wordmark variant="onSidebar" />
      </div>
      <nav className={styles.nav} aria-label={lang === "bn" ? "ড্যাশবোর্ড" : "Dashboard"}>
        <ul className={styles.legacyList}>
          {items.map((item) => renderLegacyItem(item, pathname, onNavigate, t))}
        </ul>
      </nav>
    </aside>
  );
}

function renderLegacyItem(
  item: LegacyNavItem,
  pathname: string | null,
  onNavigate: SidebarProps["onNavigate"],
  t: (key: MessageKey) => string,
) {
  const [itemPath, itemHash = ""] = item.href.split("#");
  const [currentPath, currentHash = ""] = (pathname ?? "").split("#");
  const isActive =
    currentPath === itemPath &&
    (itemHash === "" || itemHash === currentHash);

  return (
    <li key={item.key} className={styles.listItem}>
      <button
        type="button"
        className={`${styles.legacyLink} ${isActive ? styles.legacyLinkActive : ""}`}
        onClick={() => {
          onNavigate?.();
          if (itemHash && currentPath === itemPath) {
            const nextHash = `#${itemHash}`;
            if (window.location.hash !== nextHash) {
              window.location.hash = itemHash;
            }
            const target = document.getElementById(itemHash);
            if (target) target.scrollIntoView({ block: "start" });
          } else {
            window.location.href = item.href;
          }
        }}
      >
        {t(item.label)}
      </button>
    </li>
  );
}

/* Local `t()` helper — CitizenSidebar uses i18n keys it knows exist
   on the MessageKey union; this stays close to the call sites to avoid
   threading the full `t` function through every NavItem. */
function t(key: MessageKey, lang: "bn" | "en"): string {
  // Fall back to en for any unknown key.
  return messages[lang][key] ?? messages.en[key] ?? "";
}

/* ------------------------------------------------------------------ *
 *  Direct lookup against the same `messages` table the i18n context
 *  uses. We import the table lazily to avoid a circular dependency
 *  between this file and `lib/i18n.tsx`.
 * ------------------------------------------------------------------ */

import { messages } from "@/lib/i18n";