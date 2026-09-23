"use client";

import { useRouter } from "next/navigation";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/button";
import { CaseDetail } from "@/components/case-detail";
import { AssistedIntake } from "@/components/assisted-intake";
import { CoverageNavigator } from "@/components/coverage-navigator";
import { HomeDashboard } from "@/components/home-dashboard";
import { NotificationList } from "@/components/notification-list";
import { OperationalRoleDashboard } from "@/components/operational-role-dashboard";
import { UdcSection, type UdcTab } from "@/components/udc-section";
import type { CitizenCaseSummary } from "@/lib/case-demo";
import { useCitizenCases, useCurrentCitizen } from "@/lib/dlas/citizen-view";
import { useI18n, type Lang } from "@/lib/i18n";
import { DlaoWorkspace } from "@/components/dlao/dlao-workspace";
import { LawyerWorkspace } from "@/components/lawyer/lawyer-workspace";
import type { RoleId } from "@/lib/roles";
import styles from "./role-dashboard.module.css";

type Copy = { bn: string; en: string };
const copy = (value: Copy, lang: Lang) => value[lang];

const labels = {
  view: { bn: "প্রমাণ দেখুন", en: "View evidence" },
  close: { bn: "বন্ধ করুন", en: "Close" },
  saved: { bn: "এই প্রোটোটাইপ সেশনে সংরক্ষিত হয়েছে।", en: "Saved for this prototype session." },
};

type DashboardProps = { role: RoleId };

export function RoleDashboard({ role }: DashboardProps) {
  const { lang } = useI18n();
  return role === "citizen" ? <CitizenGate /> :
    role === "lawyer" ? <LawyerWorkspace /> :
    role === "dlo" ? <DlaoWorkspace /> :
    role === "admin" ? <AdminDashboard lang={lang} /> :
    <OperationalRoleDashboard role={role} />;
}

function PrototypeNote({ lang: _lang }: { lang: Lang }) {
  // Prototype note text removed per design update. Argument kept so
  // existing call sites don't have to change; `_lang` is intentionally
  // unused.
  void _lang;
  return null;
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

function AdminDashboard({ lang }: { lang: Lang }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className={styles.page}>
      <PrototypeNote lang={lang} />
      <PageHeader eyebrow={lang === "bn" ? "সিস্টেম প্রশাসক" : "System administrator"} title={lang === "bn" ? "কার্যক্রমের সংক্ষেপ" : "Operations overview"} intro={lang === "bn" ? "সংস্করণযুক্ত নিয়ম, অনুমোদিত ব্যবহারকারী এবং উৎসযোগ্য সেবা পরিমাপ দেখুন।" : "Review versioned rules, authorised users, and sourceable service measures."} action={<Button onClick={() => setEditing(true)}>{lang === "bn" ? "নিয়ম সম্পাদনা" : "Edit rules"}</Button>} />
      <section id="overview" className={styles.metrics}><div><strong>30</strong><span>{lang === "bn" ? "সক্রিয় মামলা" : "Active cases"}</span></div><div><strong>03</strong><span>{lang === "bn" ? "পর্যালোচনা প্রয়োজন" : "Need review"}</span></div><div><strong>92%</strong><span>{lang === "bn" ? "সময়মতো তথ্য" : "Updates on time"}</span></div><div><strong>01</strong><span>{lang === "bn" ? "ডেলিভারি ব্যর্থ" : "Delivery failed"}</span></div></section>
      <div className={styles.twoColumn}>
        <section id="rules" className={styles.section}><div className={styles.sectionHeading}><div><p className={styles.sectionLabel}>{lang === "bn" ? "সক্রিয় নীতি · সংস্করণ ৪" : "Active policy · version 4"}</p><h2>{lang === "bn" ? "হস্তক্ষেপের নিয়ম" : "Intervention rules"}</h2></div></div><dl className={styles.ruleList}><div><dt>{lang === "bn" ? "প্রতিবেদন গ্রেস পিরিয়ড" : "Report grace period"}</dt><dd>48h</dd></div><div><dt>{lang === "bn" ? "জরুরি করতে বকেয়া প্রতিবেদন" : "Overdue reports before escalation"}</dt><dd>2</dd></div><div><dt>{lang === "bn" ? "যোগাযোগের সতেজতা" : "Contact freshness"}</dt><dd>24h</dd></div></dl></section>
        <section id="users" className={styles.section}><div className={styles.sectionHeading}><div><p className={styles.sectionLabel}>{lang === "bn" ? "অনুমোদিত প্রবেশাধিকার" : "Authorised access"}</p><h2>{lang === "bn" ? "ব্যবহারকারী" : "Users"}</h2></div></div><div className={styles.userRow}><span>{lang === "bn" ? "কর্মকর্তা" : "Officers"}</span><strong>4</strong></div><div className={styles.userRow}><span>{lang === "bn" ? "প্যানেল আইনজীবী" : "Panel lawyers"}</span><strong>18</strong></div><div className={styles.userRow}><span>{lang === "bn" ? "অফিস কর্মী" : "Office staff"}</span><strong>6</strong></div></section>
      </div>
      <section id="audit" className={styles.hairlineList}><h2>{lang === "bn" ? "সাম্প্রতিক অডিট ঘটনা" : "Recent audit events"}</h2><div><time>09:42</time><span>{lang === "bn" ? "SHK-DEMO-007 পুনর্মূল্যায়ন" : "SHK-DEMO-007 re-evaluated"}</span><span>rule hearing-date/v1</span></div><div><time>09:18</time><span>{lang === "bn" ? "নীতি সংস্করণ ৪ সক্রিয়" : "Policy version 4 activated"}</span><span>Admin · Dhaka</span></div></section>
      <CoverageNavigator />
      {editing ? <div className={styles.dialogBackdrop} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="rule-title"><div className={styles.sectionHeading}><h2 id="rule-title">{lang === "bn" ? "নিয়মের খসড়া" : "Draft rule version"}</h2><button className={styles.textButton} onClick={() => setEditing(false)}>{copy(labels.close, lang)}</button></div><form className={styles.form} onSubmit={(event) => { event.preventDefault(); setSaved(true); }}><label>{lang === "bn" ? "প্রতিবেদন গ্রেস পিরিয়ড (ঘণ্টা)" : "Report grace period (hours)"}<input type="number" defaultValue="48" min="1" /></label><label>{lang === "bn" ? "সংস্করণ নোট" : "Version note"}<textarea required placeholder={lang === "bn" ? "কেন পরিবর্তন করা হচ্ছে" : "Why this change is needed"} /></label>{saved ? <p role="status" className={styles.success}>{copy(labels.saved, lang)}</p> : <Button type="submit">{lang === "bn" ? "খসড়া সংরক্ষণ" : "Save draft"}</Button>}</form></section></div> : null}
    </div>
  );
}
