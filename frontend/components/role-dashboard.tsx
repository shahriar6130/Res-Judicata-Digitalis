"use client";

import { useRouter } from "next/navigation";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/button";
import { CaseDetail } from "@/components/case-detail";
import { AssistedIntake } from "@/components/assisted-intake";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { HomeDashboard } from "@/components/home-dashboard";
import { NotificationList } from "@/components/notification-list";
import { OperationalRoleDashboard } from "@/components/operational-role-dashboard";
import { UdcSection, type UdcTab } from "@/components/udc-section";
import type { CitizenCaseSummary } from "@/lib/case-demo";
import { useCitizenCases, useCurrentCitizen } from "@/lib/dlas/citizen-view";
import { useI18n, type Lang } from "@/lib/i18n";
import { DlaoWorkspace } from "@/components/dlao/dlao-workspace";
import { LawyerWorkspace } from "@/components/lawyer/lawyer-workspace";
import { MediatorWorkspace } from "@/components/mediator/mediator-workspace";
import type { RoleId } from "@/lib/roles";
import styles from "./role-dashboard.module.css";

type DashboardProps = { role: RoleId };

export function RoleDashboard({ role }: DashboardProps) {
  return role === "citizen" ? <CitizenGate /> :
    role === "lawyer" ? <LawyerWorkspace /> :
    role === "mediator" ? <MediatorWorkspace /> :
    role === "dlo" ? <DlaoWorkspace /> :
    role === "admin" ? <AdminWorkspace /> :
    <OperationalRoleDashboard role={role} />;
}

function PageHeader({ eyebrow, title, intro, action }: { eyebrow: string; title: string; intro: string; action?: React.ReactNode }) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p className={styles.intro}>{intro}</p>
      </div>
      {action ? <div className={styles.headerAction}>{action}</div> : null}
    </header>
  );
}

/** Citizen pages need a logged-in account; after logout they point back to sign-in. */
function CitizenGate() {
  const { lang } = useI18n();
  const router = useRouter();
  const me = useCurrentCitizen();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return null;
  if (!me) {
    return (
      <div className={styles.page}>
        <PageHeader
          eyebrow={lang === "bn" ? "নাগরিক" : "Citizen"}
          title={lang === "bn" ? "লগইন প্রয়োজন" : "Please log in"}
          intro={lang === "bn" ? "আপনার আবেদন ও নোটিফিকেশন দেখতে মোবাইল নম্বর দিয়ে লগইন বা সাইন আপ করুন।" : "Log in or sign up with your mobile number to see your applications and notifications."}
          action={
            <Button onClick={() => router.push("/")}>
              {lang === "bn" ? "লগইন / সাইন আপ →" : "Log in / sign up →"}
            </Button>
          }
        />
      </div>
    );
  }
  return <CitizenDashboard key={me.citizenId} />;
}

function CitizenDashboard() {
  // The citizen sidebar writes `window.location.hash`; this dashboard
  // mirrors it into state and renders exactly one panel. No tab strip;
  // no shared context — the URL is the only state holder.
  //
  // Hash shapes:
  //   ""                  → home (default landing)
  //   #home               → home
  //   #notifications      → notification feed
  //   #intake             → "Lodge a Complaint" wizard (assisted intake)
  //   #cases              → case list
  //   #cases/<id>         → case detail
  //   #udc                → UDC overview
  //   #udc/office         → My UDC office
  //   #udc/officer        → Legal aid officer
  //   #udc/contact        → Contact support
  const { lang, t } = useI18n();
  const citizenCases = useCitizenCases();
  type Section =
    | "home"
    | "notifications"
    | "intake"
    | "cases"
    | "udc";
  const [section, setSection] = useState<Section>("home");
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [udcTab, setUdcTab] = useState<UdcTab>("overview");

  useEffect(() => {
    function sync() {
      const raw = window.location.hash.replace(/^#/, "");
      const [head, rest] = raw.split("/");
      if (head === "intake") {
        setSection("intake");
        setActiveCaseId(null);
      } else if (head === "udc") {
        setSection("udc");
        setActiveCaseId(null);
        setUdcTab((rest as UdcTab) || "overview");
      } else if (head === "home" || head === "") {
        setSection("home");
        setActiveCaseId(null);
      } else if (head === "notifications") {
        setSection("notifications");
        setActiveCaseId(null);
      } else if (head === "cases") {
        setSection("cases");
        setActiveCaseId(rest || null);
      } else {
        // Unknown — fall back to home so the user always lands somewhere sane.
        setSection("home");
        setActiveCaseId(null);
      }
    }
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function openCase(caseId: string) {
    // Mirror the sidebar's behavior — push the hash so the URL stays
    // the single source of truth that the sidebar reads.
    window.location.hash = `cases/${caseId}`;
  }

  function backToCases() {
    setActiveCaseId(null);
    history.replaceState(null, "", "#cases");
  }

  return (
    <div className={styles.page}>
      {section === "home" ? <HomeDashboard key="home" /> : null}

      {section === "notifications" ? (
        <NotificationList key="notifications" />
      ) : null}

      {section === "intake" ? (
        <section
          id="intake"
          key="intake"
          role="region"
          aria-label={t("navLodgeComplaint")}
        >
          <AssistedIntake />
        </section>
      ) : null}

      {section === "cases" ? (
        activeCaseId ? (
          <CaseDetail
            key={`case-detail-${activeCaseId}`}
            caseId={activeCaseId}
            onBack={backToCases}
          />
        ) : (
          <CasesList
            key="cases-list"
            lang={lang}
            t={t}
            cases={citizenCases}
            onOpen={openCase}
          />
        )
      ) : null}

      {section === "udc" ? (
        <UdcSection key="udc" lang={lang} tab={udcTab} />
      ) : null}
    </div>
  );
}

function CasesList({
  lang,
  t,
  cases,
  onOpen,
}: {
  lang: Lang;
  t: (key: import("@/lib/i18n").MessageKey) => string;
  cases: CitizenCaseSummary[];
  onOpen: (caseId: string) => void;
}) {
  return (
    <section
      id="cases"
      role="region"
      aria-label={t("myCasesHeading")}
      className={styles.hairlineList}
    >
      <header className={styles.pageHeader} style={{ marginBottom: "var(--s-4)" }}>
        <div>
          <p className={styles.eyebrow}>{t("myCasesHeading")}</p>
          <h1>{t("myCasesHeading")}</h1>
          <p className={styles.intro}>{t("myCasesIntro")}</p>
        </div>
      </header>
      {cases.length === 0 ? (
        <p style={{ color: "var(--gray)" }}>{t("myCasesEmpty")}</p>
      ) : (
        cases.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            className={styles.queueRow}
            style={{ gridTemplateColumns: "160px 1fr" }}
            aria-label={c.id}
          >
            <strong style={{ fontWeight: "var(--weight-regular)" }}>{c.id}</strong>
            <span>{lang === "bn" ? c.titleBn : c.titleEn}</span>
          </button>
        ))
      )}
    </section>
  );
}
