"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCitizenCases, useCitizenNotifications } from "@/lib/dlas/citizen-view";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useCitizenProfile } from "@/lib/citizen-profile";
import { useDloProfile } from "@/lib/dlo-profile";
import { useLawyerProfile } from "@/lib/lawyer-profile";
import { useMediatorProfile } from "@/lib/mediator-profile";
import { useUdcProfile } from "@/lib/udc-profile";
import { useAgentQueue } from "@/lib/dlas/ivr-triage";
import { CitizenAuth, DlaoAuth, LawyerAuth, MediatorAuth, officerAuthorityRole, readDb, UdcAuth, useCurrentOfficer, useDistrictLawyers, useLawyerNotifications, useLawyerWork, useMyMediations, useOfficeQueue, useUrgentCases, useCaseTransfers, useOfficeNotices } from "@/lib/dlas";
import { useHashRoute } from "@/lib/use-hash-route";
import { Wordmark } from "@/components/wordmark";
import { StatusPill } from "@/components/status-pill";
import {
  AlertCircle,
  Bell,
  Building,
  Calendar,
  Check,
  Clock,
  FileText,
  HelpingHand,
  Home,
  MoreVertical,
  Phone,
  Play,
  Scale,
  Shield,
  Users,
  Briefcase,
  ChevronRight,
} from "@/components/icons";
import type { ComponentType, SVGProps } from "react";

type IconComponent = ComponentType<{ size?: number; "aria-hidden"?: boolean } & SVGProps<SVGSVGElement>>;
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
 *    │  [AB] <logged-in citizen>    [⋮]         │
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
  if (role === "udc") {
    return <UdcLegacySidebar role={role} open={open} onNavigate={onNavigate} />;
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
  const router = useRouter();
  const { lang } = useI18n();
  const profile = useCitizenProfile();
  const { navigate, current } = useHashRoute();
  const cases = useCitizenCases();

  // Track the citizen pathname separately from the hash so the UDC
  // items can compare "same path" without manually string-splitting.
  const basePath = (pathname ?? "").split("#")[0];

  // Active-case id is whatever sits after `#cases/`.
  const activeCaseId = current.startsWith("cases/")
    ? current.slice("cases/".length)
    : null;

  // Unread notifications, derived from the citizen's own records.
  const unreadCount = useCitizenNotifications().filter((n) => n.unread).length;

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
      lang={lang}
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
            active={current === "intake" || current === "complaint"}
            onClick={() => go("intake")}
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
            glow={unreadCount > 0}
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
                onClick={() => {
                  setKebabOpen(false);
                  CitizenAuth.logout();
                  router.replace("/");
                }}
              >
                {t("profileLogout", lang)}
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
  glow,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  glow?: boolean;
  prominent?: boolean;
  sub?: boolean;
}) {
  const className = [
    styles.navItem,
    active ? styles.navItemActive : "",
    prominent ? styles.navItemProminent : "",
    sub ? styles.navItemSub : "",
    glow ? styles.navItemGlow : "",
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
      {badge ? <span className={`${styles.navBadge} ${glow ? styles.navBadgeGlow : ""}`}>{badge}</span> : null}
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
  Icon: IconComponent;
};

const LEGACY_NAV: Record<string, LegacyNavItem[]> = {
  helpline: [
    { href: "/dashboard/helpline#dashboard", label: "helplineNavDashboard", key: "dashboard", Icon: Home },
    { href: "/dashboard/helpline#new-call", label: "helplineNavNewCall", key: "new-call", Icon: Phone },
    { href: "/dashboard/helpline#new-intake", label: "helplineNavContinueIntake", key: "new-intake", Icon: Play },
    { href: "/dashboard/helpline#search", label: "helplineNavSearchRecord", key: "search", Icon: FileText },
    { href: "/dashboard/helpline#ivr-escalations", label: "helplineNavIvrEscalations", key: "ivr-escalations", Icon: Phone },
    { href: "/dashboard/helpline#handoffs", label: "helplineNavHandoffs", key: "handoffs", Icon: AlertCircle },
    { href: "/dashboard/helpline#handoffs?filter=dlao", label: "helplineNavDlaoTasks", key: "dlao-tasks", Icon: Briefcase },
    { href: "/dashboard/helpline#history", label: "helplineNavHistory", key: "history", Icon: Clock },
    { href: "/dashboard/helpline#accessibility-demo", label: "helplineNavAccessibility", key: "accessibility", Icon: Shield },
  ],
  dlo: [
    // Step 2 — the office's queue from dlas.db.v1 (see components/dlao/dlao-workspace.tsx)
    { href: "/dashboard/dlo#overview", label: "navOverview", key: "overview", Icon: Home },
    { href: "/dashboard/dlo#new", label: "dlaoNavNew", key: "new", Icon: Briefcase },
    { href: "/dashboard/dlo#review", label: "dlaoNavReview", key: "review", Icon: Clock },
    { href: "/dashboard/dlo#decided", label: "dlaoNavDecided", key: "decided", Icon: Check },
    { href: "/dashboard/dlo#cases", label: "dlaoNavDistrictCases", key: "cases", Icon: Briefcase },
    { href: "/dashboard/dlo#urgent", label: "dlaoNavUrgent", key: "urgent", Icon: AlertCircle },
    { href: "/dashboard/dlo#transfers", label: "dlaoNavTransfers", key: "transfers", Icon: FileText },
    { href: "/dashboard/dlo#groups", label: "dlaoNavGroups", key: "groups", Icon: Users },
    { href: "/dashboard/dlo#duplicates", label: "dlaoNavDuplicates", key: "duplicates", Icon: AlertCircle },
    { href: "/dashboard/dlo#lawyers", label: "dlaoNavLawyers", key: "lawyers", Icon: Scale },
    { href: "/dashboard/dlo#mediators", label: "dlaoNavMediators", key: "mediators", Icon: HelpingHand },
    { href: "/dashboard/dlo#mediation-monitor", label: "dlaoNavMediationMonitor", key: "mediation-monitor", Icon: Scale },
    { href: "/dashboard/dlo/settlements", label: "dlaoNavSettlements", key: "settlements", Icon: FileText },
    { href: "/dashboard/dlo/mediation-outcomes", label: "dlaoNavMediationOutcomes", key: "mediation-outcomes", Icon: AlertCircle },
  ],
  lawyer: [
    { href: "/dashboard/lawyer#overview", label: "navOverview", key: "overview", Icon: Home },
    { href: "/dashboard/lawyer#intake", label: "navCaseIntake", key: "intake", Icon: HelpingHand },
    { href: "/dashboard/lawyer#cases", label: "navMyCases", key: "cases", Icon: Briefcase },
    { href: "/dashboard/lawyer#notifications", label: "navNotifications", key: "notifications", Icon: Bell },
    { href: "/dashboard/lawyer#attendance", label: "navAttendance", key: "attendance", Icon: Check },
    { href: "/dashboard/lawyer#reports", label: "navHearingReports", key: "reports", Icon: FileText },
    { href: "/dashboard/lawyer#calendar", label: "navCalendar", key: "calendar", Icon: Calendar },
  ],
  mediator: [{ href: "/dashboard/mediator#cases", label: "navMyMediations", key: "cases", Icon: Briefcase }],
  admin: [
    { href: "/dashboard/admin", label: "navOverview", key: "overview", Icon: Home },
    { href: "/dashboard/admin#users", label: "navUsers", key: "users", Icon: Users },
    { href: "/dashboard/admin#cases", label: "navApplications", key: "cases", Icon: Briefcase },
    { href: "/dashboard/admin#rules", label: "navRules", key: "rules", Icon: Shield },
    { href: "/dashboard/admin#mediation", label: "navMediationOversight", key: "mediation", Icon: Scale },
    { href: "/dashboard/admin#audit", label: "navAudit", key: "audit", Icon: Clock },
    { href: "/dashboard/admin#backup", label: "navBackup", key: "backup", Icon: FileText },
  ],
};

function getLegacyItems(role: string): LegacyNavItem[] {
  if (role in LEGACY_NAV) return LEGACY_NAV[role];
  return [
    { href: `/dashboard/${role}#work`, label: "navActionQueue", key: "work", Icon: Briefcase },
    { href: `/dashboard/${role}#today`, label: "navOverview", key: "today", Icon: Home },
    { href: `/dashboard/${role}#history`, label: "navAudit", key: "history", Icon: Clock },
  ];
}

function LegacySidebar({ role, open, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useI18n();
  const currentOfficer = useCurrentOfficer();
  const items = getLegacyItems(role).filter((item) => (item.key !== "mediation-monitor") || (!!currentOfficer && officerAuthorityRole(currentOfficer) === "CHIEF_LEGAL_AID_OFFICER"));
  // Always subscribe so the hook order is stable. Only surface the
  // counts when the role actually maps onto the DLO queue buckets.
  const queue = useOfficeQueue();
  const work = useLawyerWork();
  const districtLawyers = useDistrictLawyers();
  const lawyerUnread = useLawyerNotifications().filter((n) => n.unread).length;
  const mediations = useMyMediations();
  const urgentCases = useUrgentCases();
  const agentQueue = useAgentQueue();
  const transfers = useCaseTransfers();
  const notices = useOfficeNotices();
  const badges: Record<string, number> | undefined =
    role === "dlo"
      ? { new: queue.NEW.length, review: queue.IN_REVIEW.length, decided: queue.DECIDED.length, tasks: queue.tasks.length, lawyers: districtLawyers.list.filter((m) => m.overdueReports || m.openSummons || m.todayStatus === "ABSENT").length, urgent: urgentCases.rows.filter((r) => !r.closed).length, transfers: transfers.incoming.length + notices.unread.filter((n) => n.kind !== "TRANSFER_RECEIVED").length }
      : role === "lawyer"
        ? { intake: work.offers.length, cases: work.accepted.length, notifications: lawyerUnread, reports: work.due.length + work.overdue.length, calendar: work.upcoming.length, attendance: work.today ? 0 : 1 }
        : role === "mediator"
          ? { cases: mediations.active.length }
          : role === "helpline"
            ? { "ivr-escalations": agentQueue.open.filter((x) => x.handoff?.status === "WAITING").length }
            : undefined;

  // The legacy sidebar mirrors the citizen pattern: the active tab is
  // determined by `window.location.hash`, not by `usePathname()` (which
  // strips the hash in Next.js). We subscribe to `hashchange` so the
  // yellow accent bar follows the active section as the user clicks
  // around the workspace.
  const [currentHash, setCurrentHash] = useState<string>("");
  useEffect(() => {
    function sync() {
      setCurrentHash((window.location.hash ?? "").replace(/^#/, ""));
    }
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // DLO and UDC need an inline profile panel at the bottom. Other roles
  // fall back to the wordmark-only chrome.
  const showProfile = role === "dlo" || role === "udc" || role === "lawyer" || role === "mediator";
  const officerProfile = useDloProfile();
  const lawyerProfile = useLawyerProfile();
  const mediatorProfile = useMediatorProfile();
  const dloProfile = role === "lawyer" ? lawyerProfile : role === "mediator" ? mediatorProfile : officerProfile;
  const udcProfile = useUdcProfile();

  const isUdc = role === "udc";

  // The DLO profile kebab mirrors the citizen sidebar's profile menu.
  // Click outside / Escape close it so the menu stays dismissable.
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
      className={`${styles.sidebar} ${styles.legacy} ${role === "dlo" || role === "lawyer" || role === "mediator" ? styles.dloSidebar : ""} ${role === "admin" ? styles.adminSidebar : ""} ${open ? styles.open : ""}`}
      lang={lang}
      aria-label={lang === "bn" ? "প্রধান নেভিগেশন" : "Main navigation"}
    >
      <div className={styles.brand}>
        <Wordmark
          variant="onSidebar"
          roleLabel={getRoleLabel(role)}
          roleSubLabel={getRoleSubLabel(role)}
        />
      </div>
      <nav className={styles.nav} aria-label={lang === "bn" ? "ড্যাশবোর্ড" : "Dashboard"}>
        {role === "dlo" || role === "lawyer" || role === "mediator" || role === "admin" ? <div className={styles.dloNavHeading}>
          <span>{lang === "bn" ? "কর্মক্ষেত্র" : "WORKSPACE"}</span>
          <strong>{role === "dlo" ? (lang === "bn" ? "অফিসের তালিকা" : "Office queue") : role === "mediator" ? (lang === "bn" ? "মধ্যস্থতা" : "Mediation") : role === "admin" ? (lang === "bn" ? "সিস্টেম প্রশাসন" : "System administration") : (lang === "bn" ? "আইনজীবীর কাজ" : "Lawyer work")}</strong>
        </div> : null}
        <ul className={styles.legacyList}>
          {items.map((item) => renderLegacyItem(item, pathname, (role === "dlo" || role === "lawyer") && !currentHash ? "overview" : role === "mediator" && (!currentHash || currentHash.startsWith("case/")) ? "cases" : currentHash, onNavigate, t, badges?.[item.key], role === "lawyer" && (item.key === "notifications" || item.key === "intake" || item.key === "attendance") && !!badges?.[item.key]))}
        </ul>
      </nav>
      {showProfile ? (
        <div
          className={styles.legacyProfilePanel}
          role="group"
          aria-label={lang === "bn" ? "প্রোফাইল" : "Profile"}
        >
          {isUdc ? (
            <div
              className={styles.legacyProfileAvatarImg}
              aria-hidden
               
              dangerouslySetInnerHTML={{ __html: udcProfile.avatarSvg }}
            />
          ) : (
            <div className={styles.legacyProfileAvatar} aria-hidden>
              {dloProfile.initials}
            </div>
          )}
          <div className={styles.legacyProfileText}>
            <span className={styles.legacyProfileName}>
              {lang === "bn"
                ? (isUdc ? udcProfile.nameBn : dloProfile.nameBn)
                : (isUdc ? udcProfile.nameEn : dloProfile.nameEn)}
            </span>
            <span className={styles.legacyProfileRole}>
              {lang === "bn"
                ? (isUdc ? udcProfile.roleBn : dloProfile.roleBn)
                : (isUdc ? udcProfile.roleEn : dloProfile.roleEn)}
            </span>
            {isUdc && (
              <span className={styles.legacyProfileOffice}>
                {lang === "bn" ? udcProfile.officeBn : udcProfile.officeEn}
              </span>
            )}
            <span
              className={styles.legacyProfileStatusInline}
              aria-label={lang === "bn" ? "লগইন সক্রিয়" : "Signed in"}
              title={lang === "bn" ? "লগইন সক্রিয়" : "Signed in"}
            >
              <span className={styles.legacyProfileStatusDot} aria-hidden />
              <span className={styles.legacyProfileStatusLabel}>
                {lang === "bn" ? "লগইন" : "Logged in"}
              </span>
            </span>
          </div>
          <div className={styles.legacyKebab} ref={kebabRef}>
            <button
              type="button"
              className={styles.legacyKebabBtn}
              onClick={() => setKebabOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={kebabOpen}
              aria-label={lang === "bn" ? "প্রোফাইল মেনু" : "Profile menu"}
            >
              <MoreVertical size={18} aria-hidden />
            </button>
            {kebabOpen ? (
              <div className={styles.legacyKebabMenu} role="menu">
                {role === "dlo" || role === "udc" || role === "lawyer" || role === "mediator" ? (
                  <button
                    type="button"
                    className={styles.legacyKebabItem}
                    role="menuitem"
                    onClick={() => {
                      setKebabOpen(false);
                      if (role === "dlo") {
                        DlaoAuth.logout();
                        router.replace("/dlo");
                      } else if (role === "lawyer") {
                        LawyerAuth.logout();
                        router.replace("/lawyer");
                      } else if (role === "mediator") {
                        MediatorAuth.logout();
                        router.replace("/mediator");
                      } else {
                        UdcAuth.logout();
                        router.replace("/portal/udc");
                      }
                    }}
                  >
                    {t("profileLogout")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.legacyKebabItem}
                    role="menuitem"
                    onClick={() => setKebabOpen(false)}
                    title={t("profileComingSoon")}
                  >
                    {t("profileLogout")}
                    <span className={styles.legacyComingSoonTag}>
                      {t("profileComingSoon")}
                    </span>
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function renderLegacyItem(
  item: LegacyNavItem,
  pathname: string | null,
  currentHash: string,
  onNavigate: SidebarProps["onNavigate"],
  t: (key: MessageKey) => string,
  badge?: number,
  glow?: boolean,
) {
  const [itemPath, itemHash = ""] = item.href.split("#");
  const currentPath = pathname ?? "";
  const isActive =
    (currentPath === itemPath || (itemHash === "" && currentPath.startsWith(`${itemPath}/`))) &&
    (itemHash ? itemHash === currentHash : currentHash === "");

  const Icon = item.Icon;
  return (
    <li key={item.key} className={styles.listItem}>
      <button
        type="button"
        className={`${styles.legacyLink} ${isActive ? styles.legacyLinkActive : ""} ${glow ? styles.navItemGlow : ""}`}
        onClick={() => {
          onNavigate?.();
          // All legacy items use hash navigation now. Same-path items
          // just rewrite the hash so the dashboard mirrors the new
          // workspace — no full reload, no scrolling into hidden
          // sections (the dashboard replaces the visible workspace).
          if (itemHash) {
            if (window.location.hash !== `#${itemHash}`) {
              window.location.hash = itemHash;
            } else {
              // Re-clicking the active sidebar item — fire a synthetic
              // hashchange so subscribers re-render.
              window.dispatchEvent(new HashChangeEvent("hashchange"));
            }
          } else if (currentPath !== itemPath) {
            window.location.href = item.href;
          } else if (window.location.hash) {
            window.history.replaceState(null, "", itemPath);
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          }
        }}
      >
        <span className={styles.legacyIcon} aria-hidden>
          <Icon size={18} />
        </span>
        <span className={styles.legacyLabel}>{t(item.label)}</span>
        {badge ? (
          <span className={`${styles.navBadge} ${glow ? styles.navBadgeGlow : ""}`} aria-label={`${badge} ${t(item.label)}`}>
            {badge}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 *  UDC sidebar — 4 sections:
 *
 *    1. Intake (collapsible, 5 sub-items)
 *    2. Sync Center (flat link)
 *    3. Conflict Review (flat link)
 *    4. Application List (flat link)
 *
 *  Reuses the legacy surface, wordmark, and profile panel from
 *  LegacySidebar. Sub-items live under #intake-new, #intake/<id>,
 *  #intake/<id>/documents, #intake/<id>/consent, #sync-centre,
 *  #conflict, and #applications. Resume / Consent / Document Capture
 *  resolve to the most recent assisted intake, falling back to
 *  #intake-new when none exists.
 *
 *  Section expand/collapse state is persisted to
 *  `shakkho.udc.sidebar.v1` and seeded with Intake open by default.
 * ------------------------------------------------------------------ */

type UdcSubItem = {
  id: string;
  labelKey: MessageKey;
  /** Where to navigate. If a function, it receives the latest intake id
   *  (or undefined) and returns the destination hash. */
  hrefFor: (latestIntakeId?: string) => string;
};

type UdcSection =
  | {
      id: string;
      kind: "expandable";
      labelKey: MessageKey;
      Icon: IconComponent;
      children: UdcSubItem[];
    }
  | {
      id: string;
      kind: "link";
      labelKey: MessageKey;
      Icon: IconComponent;
      href: string;
    };

const UDC_NAV: UdcSection[] = [
  {
    id: "intake",
    kind: "expandable",
    labelKey: "udcNavIntake",
    Icon: HelpingHand,
    children: [
      { id: "new",       labelKey: "udcNavIntakeNew",         hrefFor: () => "/dashboard/udc#intake-new" },
      { id: "resume",    labelKey: "udcNavIntakeResume",      hrefFor: (id) => id ? `/dashboard/udc#intake/${id}` : "/dashboard/udc#intake-new" },
      { id: "consent",   labelKey: "udcNavIntakeConsent",     hrefFor: (id) => id ? `/dashboard/udc#intake/${id}/consent` : "/dashboard/udc#intake-new" },
      { id: "documents", labelKey: "udcNavIntakeDocuments",   hrefFor: (id) => id ? `/dashboard/udc#intake/${id}/documents` : "/dashboard/udc#intake-new" },
      { id: "translation", labelKey: "udcNavIntakeTranslation", hrefFor: () => "/dashboard/udc#translation" },
    ],
  },
  { id: "sync",        kind: "link", labelKey: "udcNavSyncCentre",     Icon: Briefcase, href: "/dashboard/udc#sync-centre" },
  { id: "applications",kind: "link", labelKey: "udcNavApplications",   Icon: FileText,   href: "/dashboard/udc#applications" },
];

const UDC_SIDEBAR_KEY = "shakkho.udc.sidebar.v1";

/** Latest assisted intake (temporaryId) started by the LOGGED-IN operator,
 *  read from the shared record (dlas.db.v1). Undefined on SSR / empty. */
function latestAssistedIntakeId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const me = UdcAuth.current();
    if (!me) return undefined;
    const mine = readDb().sessions
      .filter((s) => s.channel === "UDC_ASSISTED" && s.meta.operatorId === me.operatorId && s.meta.clientRef)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return mine[0]?.meta.clientRef;
  } catch {
    return undefined;
  }
}

function readUdcSidebarState(): Record<string, boolean> {
  if (typeof window === "undefined") return { intake: true };
  try {
    const raw = window.localStorage.getItem(UDC_SIDEBAR_KEY);
    if (!raw) return { intake: true };
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : { intake: true };
  } catch {
    return { intake: true };
  }
}

function writeUdcSidebarState(state: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UDC_SIDEBAR_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

/** Thin chevron used inside the section toggle. Pulled from the
 *  icon set so we keep a single stroke weight and colour path. */
function ChevronGlyph({ size = 14 }: { size?: number }) {
  return <ChevronRight size={size} />;
}

function UdcLegacySidebar({ role, open, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { current: currentHash } = useHashRoute();
  const router = useRouter();
  const { lang, t } = useI18n();
  const udcProfile = useUdcProfile();

  // Both `collapsed` and `latestId` read from `localStorage`. We seed
  // them with safe defaults that match what the SSR pass returns, and
  // rehydrate inside a `useEffect` so the very first client render
  // matches the server output. The flags `collapsedReady` and
  // `latestReady` only flip to true after mount; the persisted state
  // is ignored until then so the server HTML and the first client
  // paint are byte-identical.
  const [collapsed, setCollapsedState] = useState<Record<string, boolean>>({
    intake: true,
  });
  const [collapsedReady, setCollapsedReady] = useState(false);
  const [latestId, setLatestId] = useState<string | undefined>(undefined);
  const [latestReady, setLatestReady] = useState(false);

  // Read localStorage AFTER mount so the SSR snapshot (which cannot
  // touch `window`) matches the first client render exactly. The
  // `*Ready` flags then flip on so subsequent renders pick up the
  // persisted state. The lint rule flags this as a "cascading
  // render", but it is the documented React pattern for hydrating
  // client-only state from `localStorage` and runs exactly once.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsedState(readUdcSidebarState());
     
    setCollapsedReady(true);
     
    setLatestId(latestAssistedIntakeId());
     
    setLatestReady(true);
  }, []);

  // Until rehydration completes, treat the section as open (matching
  // the SSR default) and treat the latest-id as undefined (matching
  // SSR). The "ready" flags are only used to decide which collapsed
  // value to forward to the toggle's `aria-expanded` so server and
  // client agree.
  const effectiveCollapsed = collapsedReady ? collapsed : { intake: true };
  const effectiveLatestId = latestReady ? latestId : undefined;

  const setCollapsed = useCallback(
    (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
      setCollapsedState((prev) => {
        const next = updater(prev);
        writeUdcSidebarState(next);
        return next;
      });
    },
    [],
  );

  const currentPath = (pathname ?? "").split("#")[0];
  // The Intake section is "active" (parent highlighted) when any of
  // its children is active — even if the section is currently
  // collapsed. A sub-item is considered active when the current hash
  // begins with its href's hash.
  const isSectionActive = (s: UdcSection): boolean => {
    const sectionHash = sectionHashPrefix(s);
    if (sectionHash && currentHash.startsWith(sectionHash)) return true;
    if (s.kind === "expandable") {
      return s.children.some((c) => {
        const href = c.hrefFor(effectiveLatestId);
        const h = href.split("#")[1] ?? "";
        return h !== "" && currentHash.startsWith(h);
      });
    }
    return false;
  };

  // A sub-item is active when its resolved hash starts the current hash.
  const isSubActive = (sub: UdcSubItem): boolean => {
    const href = sub.hrefFor(effectiveLatestId);
    const h = href.split("#")[1] ?? "";
    if (!h) return false;
    return currentHash === h || currentHash.startsWith(`${h}/`);
  };

  function toggleSection(id: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      // Default to open — only persist an explicit "false" (closed)
      // so a fresh user always sees Intake open.
      const persisted: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(next)) {
        if (v === false) persisted[k] = false;
        else persisted[k] = true;
      }
      writeUdcSidebarState(persisted);
      return next;
    });
  }

  const navigateTo = useCallback(
    (href: string) => {
      onNavigate?.();
      const [itemPath, itemHash = ""] = href.split("#");
      if (itemHash) {
        if (window.location.hash !== `#${itemHash}`) {
          window.location.hash = itemHash;
        } else {
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }
      } else if (currentPath !== itemPath) {
        window.location.href = href;
      }
    },
    [currentPath, onNavigate],
  );

  // Kebab menu mirrors CitizenSidebar / LegacySidebar pattern.
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
      className={`${styles.sidebar} ${styles.legacy} ${styles.udcSidebar} ${open ? styles.open : ""}`}
      lang={lang}
      aria-label={lang === "bn" ? "প্রধান নেভিগেশন" : "Main navigation"}
    >
      <div className={styles.brand}>
        <Wordmark
          variant="onSidebar"
          roleLabel={getRoleLabel(role)}
          roleSubLabel={getRoleSubLabel(role)}
        />
      </div>
      <nav className={styles.nav} aria-label={lang === "bn" ? "ড্যাশবোর্ড" : "Dashboard"}>
        <span className={styles.udcNavHeading}>{lang === "bn" ? "কর্মক্ষেত্র" : "WORKSPACE"}</span>
        <button type="button" className={`${styles.legacyLink} ${!currentHash || currentHash === "dashboard" ? styles.legacyLinkActive : ""}`} onClick={() => navigateTo("/dashboard/udc#dashboard")} aria-current={!currentHash || currentHash === "dashboard" ? "page" : undefined}>
          <span className={styles.legacyIcon} aria-hidden><Home size={18} /></span><span className={styles.legacyLabel}>{lang === "bn" ? "সারসংক্ষেপ" : "Overview"}</span>
        </button>
        <span className={styles.udcNavHeading}>{lang === "bn" ? "আবেদনের কাজ" : "APPLICATION WORK"}</span>
        <ul className={styles.legacyList}>
          {UDC_NAV.map((section) => {
            if (section.kind === "link") {
              const Icon = section.Icon;
              const [itemPath, itemHash = ""] = section.href.split("#");
              const linkActive =
                currentPath === itemPath &&
                (itemHash === "" || itemHash === currentHash);
              return (
                <li key={section.id} className={styles.listItem}>
                  <button
                    type="button"
                    className={`${styles.legacyLink} ${linkActive ? styles.legacyLinkActive : ""}`}
                    onClick={() => navigateTo(section.href)}
                    aria-current={linkActive ? "page" : undefined}
                  >
                    <span className={styles.legacyIcon} aria-hidden>
                      <Icon size={18} />
                    </span>
                    <span className={styles.legacyLabel}>{t(section.labelKey)}</span>
                  </button>
                </li>
              );
            }

            // Expandable section (Intake).
            const Icon = section.Icon;
            const sectionActive = isSectionActive(section);
            const isOpen = effectiveCollapsed[section.id] !== false; // default open
            const anyChildActive = section.children.some((c) => isSubActive(c));
            // When a child is active, force the section open regardless of
            // the persisted collapsed state — WordPress-style auto-expand.
            const visuallyOpen = isOpen || anyChildActive;
            const expandLabel = t(
              visuallyOpen ? "udcNavCollapse" : "udcNavExpand",
            );

            return (
              <li key={section.id} className={styles.legacySection}>
                <button
                  type="button"
                  className={`${styles.legacySectionToggle} ${
                    sectionActive && !anyChildActive ? styles.legacySectionActive : ""
                  }`}
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={visuallyOpen}
                  aria-controls={`udc-section-${section.id}`}
                  aria-label={expandLabel}
                >
                  <span className={styles.legacyIcon} aria-hidden>
                    <Icon size={18} />
                  </span>
                  <span className={styles.legacyLabel}>{t(section.labelKey)}</span>
                  <span
                    className={`${styles.legacySectionChevron} ${
                      visuallyOpen ? styles.legacySectionChevronOpen : ""
                    }`}
                    aria-hidden
                  >
                    <ChevronGlyph size={14} />
                  </span>
                </button>
                <ul
                  id={`udc-section-${section.id}`}
                  className={`${styles.legacySubList} ${
                    visuallyOpen ? styles.legacySubListOpen : ""
                  }`}
                  role="region"
                  aria-label={t(section.labelKey)}
                >
                  <div className={styles.legacySubListInner}>
                    {section.children.map((sub) => {
                      const subActive = isSubActive(sub);
                      const href = sub.hrefFor(effectiveLatestId);
                      return (
                        <li key={sub.id}>
                          <button
                            type="button"
                            className={`${styles.legacySubLink} ${
                              subActive ? styles.legacySubLinkActive : ""
                            }`}
                            onClick={() => navigateTo(href)}
                            aria-current={subActive ? "page" : undefined}
                          >
                            {t(sub.labelKey)}
                          </button>
                        </li>
                      );
                    })}
                  </div>
                </ul>
              </li>
            );
          })}
        </ul>
        <span className={styles.udcNavHeading}>{lang === "bn" ? "সহায়তা" : "SUPPORT"}</span>
        <button type="button" className={styles.legacyLink} onClick={() => navigateTo("/dashboard/udc#clarification-tasks")}><span className={styles.legacyIcon} aria-hidden><Check size={18} /></span><span className={styles.legacyLabel}>{lang === "bn" ? "স্পষ্টীকরণ কাজ" : "Clarification tasks"}</span></button>
        <button type="button" className={styles.legacyLink} onClick={() => navigateTo("/dashboard/udc#status-visit")}><span className={styles.legacyIcon} aria-hidden><Users size={18} /></span><span className={styles.legacyLabel}>{lang === "bn" ? "অবস্থা জানার পরিদর্শন" : "Status visit"}</span></button>
        <button type="button" className={styles.legacyLink} onClick={() => navigateTo("/dashboard/udc#history")}><span className={styles.legacyIcon} aria-hidden><Clock size={18} /></span><span className={styles.legacyLabel}>{lang === "bn" ? "ইতিহাস" : "History"}</span></button>
      </nav>

      <div
        className={styles.legacyProfilePanel}
        role="group"
        aria-label={lang === "bn" ? "প্রোফাইল" : "Profile"}
      >
        <div
          className={styles.legacyProfileAvatarImg}
          aria-hidden
           
          dangerouslySetInnerHTML={{ __html: udcProfile.avatarSvg }}
        />
        <div className={styles.legacyProfileText}>
          <span className={styles.legacyProfileName}>
            {lang === "bn" ? udcProfile.nameBn : udcProfile.nameEn}
          </span>
          <span className={styles.legacyProfileRole}>
            {lang === "bn" ? udcProfile.roleBn : udcProfile.roleEn}
          </span>
          <span className={styles.legacyProfileOffice}>
            {lang === "bn" ? udcProfile.officeBn : udcProfile.officeEn}
          </span>
          <span
            className={styles.legacyProfileStatusInline}
            aria-label={lang === "bn" ? "লগইন সক্রিয়" : "Signed in"}
            title={lang === "bn" ? "লগইন সক্রিয়" : "Signed in"}
          >
            <span className={styles.legacyProfileStatusDot} aria-hidden />
            <span className={styles.legacyProfileStatusLabel}>
              {lang === "bn" ? "লগইন" : "Logged in"}
            </span>
          </span>
        </div>
        <div className={styles.legacyKebab} ref={kebabRef}>
          <button
            type="button"
            className={styles.legacyKebabBtn}
            onClick={() => setKebabOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={kebabOpen}
            aria-label={lang === "bn" ? "প্রোফাইল মেনু" : "Profile menu"}
          >
            <MoreVertical size={18} aria-hidden />
          </button>
          {kebabOpen ? (
            <div className={styles.legacyKebabMenu} role="menu">
              <button
                type="button"
                className={styles.legacyKebabItem}
                role="menuitem"
                onClick={() => {
                  setKebabOpen(false);
                  UdcAuth.logout();
                  router.replace("/udc");
                }}
              >
                {t("profileLogout")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

/** Return the hash prefix used to highlight a top-level section.
 *  For expandable sections, returns the prefix of the first sub-item. */
function sectionHashPrefix(section: UdcSection): string {
  if (section.kind === "link") {
    return section.href.split("#")[1] ?? "";
  }
  return "";
}

/* Role label helpers — surface which workspace the user is on right in
   the sidebar header. Returns the localised label + sub-label so the
   wordmark can render them inside a clear pill. */
function getRoleLabel(role: string): string | undefined {
  if (role === "helpline") return "Helpline";
  if (role === "dlo") return "DLO";
  if (role === "lawyer") return "Lawyer";
  if (role === "mediator") return "Mediator";
  if (role === "admin") return "Admin";
  if (role === "udc") return "UDC";
  return undefined;
}

function getRoleSubLabel(role: string): string | undefined {
  if (role === "helpline") return "16699";
  if (role === "dlo") return "District";
  if (role === "lawyer") return "Panel";
  if (role === "mediator") return "ADR";
  if (role === "admin") return "System";
  if (role === "udc") return "Entrepreneur";
  return undefined;
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
