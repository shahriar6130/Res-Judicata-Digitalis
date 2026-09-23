"use client";

import type { CitizenCaseSummary } from "@/lib/case-demo";
import { useCitizenCases, useCitizenNotifications, useCurrentCitizen } from "@/lib/dlas/citizen-view";
import { CitizenAuth } from "@/lib/dlas";
import { useI18n } from "@/lib/i18n";
import { useCitizenProfile } from "@/lib/citizen-profile";
import { useHashRoute } from "@/lib/use-hash-route";
import { StatusPill } from "@/components/status-pill";
import { Bell, Building, ChevronRight, FileText, HelpingHand } from "@/components/icons";
import styles from "./home-dashboard.module.css";

/* ------------------------------------------------------------------ *
 *  HomeDashboard — the citizen's landing page (#home).
 *
 *    Greeting (time-of-day-aware, BN/EN)
 *    ────────────────────────────────────
 *    How can we help you today?
 *    ┌─ Lodge ─┐  ┌─ My cases ─┐  ┌─ UDC office ─┐
 *    │ (fill)  │  │            │  │              │
 *    │  Start  │  │   View     │  │    Find      │
 *    └─────────┘  └────────────┘  └──────────────┘
 *
 *    RECENT CASES
 *    ┌──────────────────────────────────────────┐
 *    │ CASE 07  #DLAS-2026-0847                 │
 *    │ <applicant> v. <other party>             │
 *    │ Family violence and maintenance stopped  │
 *    │ ● Active · Updated 18 September          │
 *    │ [View case →]                            │
 *    └──────────────────────────────────────────┘
 *
 *  The 3 action cards and the per-case "View case →" buttons both
 *  route via `useHashRoute().navigate()` — same single source of
 *  truth as the sidebar.
 * ------------------------------------------------------------------ */

type Greeting = "morning" | "afternoon" | "evening";

function greetingFor(date: Date): Greeting {
  const h = date.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function greetingKey(g: Greeting) {
  return g === "morning"
    ? "homeGreetingMorning"
    : g === "afternoon"
      ? "homeGreetingAfternoon"
      : "homeGreetingEvening";
}

export function HomeDashboard() {
  const { lang, t } = useI18n();
  const profile = useCitizenProfile();
  const cases = useCitizenCases();
  const { navigate } = useHashRoute();
  const me = useCurrentCitizen();
  const unread = useCitizenNotifications().filter((n) => n.unread);
  // Most important new item first: a document request, else the newest.
  const top = unread.find((n) => n.id.startsWith("task-") && n.title.en.startsWith("Document needed")) ?? unread[0];

  const greeting = greetingFor(new Date());
  const greetingText = t(greetingKey(greeting));
  const nameText = lang === "bn" ? profile.nameBn : profile.nameEn;

  return (
    <div className={styles.home}>
      <header className={styles.greeting}>
        <p className={styles.eyebrow}>{t("navHome")}</p>
        <h1 className={styles.headline}>
          {greetingText}, <span className={styles.name}>{nameText}</span>
        </h1>
        <p className={styles.subhead}>{t("homeHowCanWeHelp")}</p>
      </header>

      {top ? (
        <button
          type="button"
          className={styles.alert}
          onClick={() => {
            if (me) CitizenAuth.markNotificationsRead(me.citizenId);
            navigate(top.href);
          }}
        >
          <span className={styles.alertIcon} aria-hidden>
            <Bell size={20} />
          </span>
          <span className={styles.alertBody}>
            <span className={styles.alertTitle}>{top.title[lang]}</span>
            <span className={styles.alertSub}>
              {top.body[lang]}
              {unread.length > 1 ? ` · +${unread.length - 1} ${lang === "bn" ? "আরও নতুন" : "more new"}` : ""}
            </span>
          </span>
          <span className={styles.alertCta}>
            {lang === "bn" ? "খুলুন" : "Open"}
            <ChevronRight size={16} aria-hidden />
          </span>
        </button>
      ) : null}

      <section className={styles.actions} aria-label={t("homeHowCanWeHelp")}>
        <button
          type="button"
          className={styles.actionCard}
          onClick={() => navigate("intake")}
        >
          <span className={styles.actionIcon} aria-hidden>
            <HelpingHand size={26} />
          </span>
          <span className={styles.actionBody}>
            <span className={styles.actionTitle}>{t("homeActionLodgeTitle")}</span>
            <span className={styles.actionDesc}>{t("homeActionLodgeDesc")}</span>
          </span>
          <span className={styles.actionCta}>
            {t("homeActionStart")}
            <ChevronRight size={16} aria-hidden />
          </span>
        </button>

        <button
          type="button"
          className={styles.actionCard}
          onClick={() => navigate("cases")}
        >
          <span className={styles.actionIcon} aria-hidden>
            <FileText size={26} />
          </span>
          <span className={styles.actionBody}>
            <span className={styles.actionTitle}>{t("homeActionMyCasesTitle")}</span>
            <span className={styles.actionDesc}>{t("homeActionMyCasesDesc")}</span>
          </span>
          <span className={styles.actionCta}>
            {t("homeActionView")}
            <ChevronRight size={16} aria-hidden />
          </span>
        </button>

        <button
          type="button"
          className={styles.actionCard}
          onClick={() => navigate("udc")}
        >
          <span className={styles.actionIcon} aria-hidden>
            <Building size={26} />
          </span>
          <span className={styles.actionBody}>
            <span className={styles.actionTitle}>{t("homeActionUdcTitle")}</span>
            <span className={styles.actionDesc}>{t("homeActionUdcDesc")}</span>
          </span>
          <span className={styles.actionCta}>
            {t("homeActionFind")}
            <ChevronRight size={16} aria-hidden />
          </span>
        </button>
      </section>

      <section className={styles.recent} aria-label={t("homeRecentCases")}>
        <h2 className={styles.recentHeading}>{t("homeRecentCases")}</h2>
        {cases.length === 0 ? (
          <p className={styles.recentEmpty}>{t("homeNoRecentCases")}</p>
        ) : (
          <div className={styles.recentList}>
            {cases.map((c, idx) => (
              <RecentCaseCard
                key={c.id}
                caseItem={c}
                indexLabel={t("sidebarCaseItemLabel").replace("%d", String(idx + 1))}
                onView={() => navigate(`cases/${c.id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RecentCaseCard({
  caseItem,
  indexLabel,
  onView,
}: {
  caseItem: CitizenCaseSummary;
  indexLabel: string;
  onView: () => void;
}) {
  const { lang, t } = useI18n();
  const title = lang === "bn" ? caseItem.titleBn : caseItem.titleEn;
  // Issue: case-summary doesn't carry `issueBn/En`, but the related
  // full record does. We fall back to a tiny placeholder so the card
  // still renders cleanly if the issue field is unavailable.
  return (
    <article className={styles.recentCard}>
      <header className={styles.recentCardHead}>
        <span className={styles.recentCardLabel}>{indexLabel}</span>
        <span className={styles.recentCardId}>{caseItem.displayId}</span>
      </header>
      <h3 className={styles.recentCardTitle}>{title}</h3>
      <div className={styles.recentCardMeta}>
        <StatusPill status={caseItem.status} lang={lang} />
      </div>
      <button type="button" className={styles.recentCardCta} onClick={onView}>
        {t("homeViewCase")}
        <ChevronRight size={16} aria-hidden />
      </button>
    </article>
  );
}