"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { CaseDetail } from "@/components/case-detail";
import { ComplaintModal } from "@/components/complaint-modal";
import { CoverageNavigator } from "@/components/coverage-navigator";
import { HomeDashboard } from "@/components/home-dashboard";
import { NotificationList } from "@/components/notification-list";
import { OperationalRoleDashboard } from "@/components/operational-role-dashboard";
import { UdcSection, type UdcTab } from "@/components/udc-section";
import { listCitizenCases, type CitizenCaseSummary } from "@/lib/case-demo";
import { useI18n, type Lang } from "@/lib/i18n";
import { useDlaoInbox } from "@/lib/shakkho/bridges/dlao-inbox.bridge";
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
  return role === "citizen" ? <CitizenDashboard /> :
    role === "lawyer" ? <LawyerDashboard lang={lang} /> :
    role === "dlo" ? <OfficerDashboard lang={lang} /> :
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

function State({ value }: { value: "verified" | "reported" | "pending" | "disputed" | "missing" | "stale" }) {
  return <span className={`${styles.state} ${styles[value]}`}>{value.replace("_", " ")}</span>;
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
  //   #complaint          → complaint wizard
  //   #cases              → case list
  //   #cases/<id>         → case detail
  //   #udc                → UDC overview
  //   #udc/office         → My UDC office
  //   #udc/officer        → Legal aid officer
  //   #udc/contact        → Contact support
  const { lang, t } = useI18n();
  const citizenCases = listCitizenCases();
  type Section =
    | "home"
    | "notifications"
    | "complaint"
    | "cases"
    | "udc";
  const [section, setSection] = useState<Section>("home");
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [udcTab, setUdcTab] = useState<UdcTab>("overview");

  useEffect(() => {
    function sync() {
      const raw = window.location.hash.replace(/^#/, "");
      const [head, rest] = raw.split("/");
      if (head === "complaint") {
        setSection("complaint");
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

      {section === "complaint" ? (
        <section
          id="complaint"
          key="complaint"
          role="region"
          aria-label={t("navLodgeComplaint")}
        >
          <ComplaintModal />
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

function LawyerDashboard({ lang }: { lang: Lang }) {
  const [caseState, setCaseState] = useState<"offered" | "accepted" | "declined">("offered");
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  return (
    <div className={styles.page}>
      <PrototypeNote lang={lang} />
      <PageHeader eyebrow={lang === "bn" ? "প্যানেল আইনজীবী" : "Panel lawyer"} title={lang === "bn" ? "নিয়োগপ্রাপ্ত মামলা" : "Assigned cases"} intro={lang === "bn" ? "নিয়োগ গ্রহণ করুন এবং এক মিনিটের মধ্যে শুনানির তথ্য দিন।" : "Accept assignments and submit a structured hearing update in under a minute."} action={<Button onClick={() => setFormOpen(true)}>{lang === "bn" ? "শুনানির প্রতিবেদন দিন" : "Submit hearing report"}</Button>} />
      <section id="assigned" className={styles.section}>
        <div className={styles.sectionHeading}><div><p className={styles.sectionLabel}>SHK-DEMO-007 · CIVIL</p><h2>{lang === "bn" ? "রহিমা বেগম বনাম মোহাম্মদ আলী" : "Rahima Begum v. Mohammad Ali"}</h2></div><State value={caseState === "accepted" ? "pending" : "reported"} /></div>
        <div className={styles.caseMeta}><span>{lang === "bn" ? "পরবর্তী শুনানি · ৩০ সেপ্টেম্বর" : "Next hearing · 30 September"}</span><span>{lang === "bn" ? "জেলা আদালত · কক্ষ ৩" : "District Court · Room 3"}</span></div>
        {caseState === "offered" ? <div className={styles.actions}><Button onClick={() => setCaseState("accepted")}>{lang === "bn" ? "নিয়োগ গ্রহণ করুন" : "Accept assignment"}</Button><Button variant="secondary" onClick={() => setCaseState("declined")}>{lang === "bn" ? "কারণসহ প্রত্যাখ্যান" : "Decline with reason"}</Button></div> : <p role="status" className={styles.success}>{caseState === "accepted" ? (lang === "bn" ? "নিয়োগ গ্রহণ করা হয়েছে।" : "Assignment accepted.") : (lang === "bn" ? "প্রত্যাখ্যানটি কর্মকর্তার কাছে পাঠানো হয়েছে।" : "Decline reason sent to the officer.")}</p>}
      </section>

      <section id="reports" className={styles.section}>
        <div className={styles.sectionHeading}><div><p className={styles.sectionLabel}>{lang === "bn" ? "প্রতিবেদন প্রয়োজন" : "Report due"}</p><h2>{lang === "bn" ? "২৮ সেপ্টেম্বরের শুনানি" : "Hearing on 28 September"}</h2></div><State value="missing" /></div>
        <p>{lang === "bn" ? "উপস্থিতি, ফলাফল এবং পরবর্তী তারিখ আলাদা করে দিন। শেষ সময় আজ বিকেল ৫টা।" : "Record attendance, outcome, and next date separately. Due today at 5:00 PM."}</p>
        <button className={styles.textButton} onClick={() => setFormOpen(true)}>{lang === "bn" ? "এখন প্রতিবেদন পূরণ করুন" : "Complete report now"}</button>
      </section>

      {formOpen ? <div className={styles.dialogBackdrop} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="report-title"><div className={styles.sectionHeading}><h2 id="report-title">{lang === "bn" ? "শুনানির প্রতিবেদন" : "Hearing report"}</h2><button className={styles.textButton} onClick={() => setFormOpen(false)}>{copy(labels.close, lang)}</button></div><form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }} className={styles.form}><label>{lang === "bn" ? "উপস্থিতি" : "Attendance"}<select required><option value="">{lang === "bn" ? "বেছে নিন" : "Select"}</option><option>{lang === "bn" ? "উপস্থিত" : "Attended"}</option><option>{lang === "bn" ? "অনুপস্থিত" : "Did not attend"}</option></select></label><label>{lang === "bn" ? "ফলাফল" : "Outcome"}<select required><option value="">{lang === "bn" ? "বেছে নিন" : "Select"}</option><option>{lang === "bn" ? "মুলতবি" : "Adjourned"}</option><option>{lang === "bn" ? "আদেশ হয়েছে" : "Order issued"}</option></select></label><label>{lang === "bn" ? "পরবর্তী তারিখ" : "Next date"}<input type="date" required /></label>{submitted ? <p role="status" className={styles.success}>{lang === "bn" ? "প্রতিবেদনটি স্ব-প্রতিবেদিত প্রমাণ হিসেবে নথিভুক্ত হয়েছে।" : "Report recorded as self-reported evidence."}</p> : <Button type="submit">{lang === "bn" ? "প্রতিবেদন জমা দিন" : "Submit report"}</Button>}</form></section></div> : null}
      <section id="calendar" className={styles.hairlineList}><h2>{lang === "bn" ? "আগামী সময়সূচি" : "Upcoming schedule"}</h2><div><time>30 Sep · 10:00</time><span>SHK-DEMO-007</span><span>{lang === "bn" ? "জেলা আদালত" : "District Court"}</span></div><div><time>08 Oct · 11:30</time><span>SHK-DEMO-011</span><span>{lang === "bn" ? "পারিবারিক আদালত" : "Family Court"}</span></div></section>
      <CoverageNavigator />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  DLO workspace — WordPress-style single-section navigation.
 *
 *  The sidebar (Case / Alerts / Assignments / Timeline) writes to
 *  `window.location.hash` and this dashboard mirrors it. Only ONE
 *  section is rendered at a time — exactly like a WordPress admin
 *  switching between pages. The hash shapes are:
 *
 *    #case         → Case workspace (queue + filter + cases)
 *    #alerts       → Alerts workspace
 *    #assignments  → Assignments workspace
 *    #timeline     → Timeline workspace
 *
 *  Falling back to `#case` on empty / unknown hash keeps the user
 *  on a sensible workspace after a hard refresh.
 * ------------------------------------------------------------------ */

type DloSection = "case" | "alerts" | "assignments" | "timeline";

function readDloSection(hash: string): DloSection {
  const head = hash.replace(/^#/, "").split("/")[0];
  if (head === "alerts" || head === "assignments" || head === "timeline") {
    return head;
  }
  return "case";
}

type QueueItem = {
  id: string;
  state: "verified" | "reported" | "pending" | "disputed" | "missing" | "stale";
  priority: "escalated" | "action" | "watch";
  field: string;
  age: string;
  reasonEn: string;
  reasonBn: string;
};

const queue: QueueItem[] = [
  {
    id: "SKY-2026-00412",
    state: "disputed",
    priority: "escalated",
    field: "hearing_date",
    age: "2h",
    reasonEn: "Lawyer and court records show different next hearing dates.",
    reasonBn: "আইনজীবী ও আদালতের নথিতে শুনানির ভিন্ন তারিখ রয়েছে।",
  },
  {
    id: "SKY-2026-00203",
    state: "missing",
    priority: "action",
    field: "hearing_report",
    age: "1d",
    reasonEn: "Hearing report was not received within 48 hours. Attendance is unknown.",
    reasonBn: "৪৮ ঘণ্টার মধ্যে শুনানির প্রতিবেদন পাওয়া যায়নি। উপস্থিতি অজানা।",
  },
  {
    id: "SKY-2026-00678",
    state: "stale",
    priority: "watch",
    field: "client_contact",
    age: "2d",
    reasonEn: "The last client-contact record is older than the configured freshness window.",
    reasonBn: "সর্বশেষ নাগরিক-যোগাযোগের তথ্য নির্ধারিত সময়ের চেয়ে পুরোনো।",
  },
];

type AlertItem = {
  id: string;
  caseId: string;
  severity: "escalated" | "action" | "watch";
  age: string;
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  descriptionBn: string;
};

/* Realistic Bangladesh alerts — new complaint, hearing approaching,
   assignment updated, status changed, deadline. */
const alerts: AlertItem[] = [
  {
    id: "ALT-9012",
    caseId: "SKY-2026-00412",
    severity: "escalated",
    age: "12m",
    titleEn: "New complaint received — Dhaka",
    titleBn: "নতুন অভিযোগ গৃহীত — ঢাকা",
    descriptionEn: "Raima Akter lodged a family maintenance complaint from Mirpur-10.",
    descriptionBn: "রাইমা আক্তার মিরপুর-১০ থেকে পারিবারিক ভরণপোষণ অভিযোগ দায়ের করেছেন।",
  },
  {
    id: "ALT-9008",
    caseId: "SKY-2026-00203",
    severity: "action",
    age: "1h",
    titleEn: "Hearing approaching — 30 Sep, 10:00",
    titleBn: "শুনানির তারিখ আসছে — ৩০ সেপ্টেম্বর, সকাল ১০টা",
    descriptionEn: "Confirm attendance and outcome channel with the panel lawyer.",
    descriptionBn: "প্যানেল আইনজীবীর সাথে উপস্থিতি ও প্রতিবেদনের মাধ্যম নিশ্চিত করুন।",
  },
  {
    id: "ALT-9005",
    caseId: "SKY-2026-00678",
    severity: "watch",
    age: "3h",
    titleEn: "Assignment updated — Sylhet",
    titleBn: "নিয়োগ হালনাগাদ — সিলেট",
    descriptionEn: "Mediator Nazrul Islam accepted the land dispute assignment.",
    descriptionBn: "মধ্যস্থতাকারী নজরুল ইসলাম ভূমি বিরোধ নিয়োগ গ্রহণ করেছেন।",
  },
  {
    id: "ALT-8999",
    caseId: "SKY-2026-00711",
    severity: "action",
    age: "5h",
    titleEn: "Case status changed — Chittagong",
    titleBn: "মামলার অবস্থা পরিবর্তিত — চট্টগ্রাম",
    descriptionEn: "SKY-2026-00711 moved from Under Review to Mediation.",
    descriptionBn: "SKY-2026-00711 পর্যালোচনাধীন থেকে মধ্যস্থতায় স্থানান্তরিত হয়েছে।",
  },
  {
    id: "ALT-8993",
    caseId: "SKY-2026-00345",
    severity: "escalated",
    age: "8h",
    titleEn: "Important deadline — Khulna",
    titleBn: "গুরুত্বপূর্ণ সময়সীমা — খুলনা",
    descriptionEn: "Statutory 30-day response window expires tomorrow at 5 PM.",
    descriptionBn: "আইনগত ৩০ দিনের জবাবের সময়সীমা আগামীকাল বিকেল ৫টায় শেষ হচ্ছে।",
  },
];

type AssignmentItem = {
  id: string;
  caseId: string;
  officerEn: string;
  officerBn: string;
  taskEn: string;
  taskBn: string;
  dueEn: string;
  dueBn: string;
  priority: "escalated" | "action" | "watch";
};

const assignments: AssignmentItem[] = [
  {
    id: "ASG-3301",
    caseId: "SKY-2026-00412",
    officerEn: "Barrister Kamrul Hasan",
    officerBn: "ব্যারিস্টার কামরুল হাসান",
    taskEn: "Confirm next hearing date with the court bench",
    taskBn: "আদালতের বেঞ্চের সাথে পরবর্তী শুনানির তারিখ নিশ্চিত করুন",
    dueEn: "Due today, 5:00 PM",
    dueBn: "আজ বিকেল ৫টায় দরকার",
    priority: "escalated",
  },
  {
    id: "ASG-3302",
    caseId: "SKY-2026-00203",
    officerEn: "Md. Nazrul Islam",
    officerBn: "মোঃ নজরুল ইসলাম",
    taskEn: "Submit attendance and outcome record",
    taskBn: "উপস্থিতি ও ফলাফলের নথি জমা দিন",
    dueEn: "Due in 2 hours",
    dueBn: "২ ঘণ্টায় দরকার",
    priority: "action",
  },
  {
    id: "ASG-3304",
    caseId: "SKY-2026-00678",
    officerEn: "Salma Begum (UDC, Sylhet)",
    officerBn: "সালমা বেগম (ইউডিসি, সিলেট)",
    taskEn: "Update citizen contact and confirm receipt",
    taskBn: "নাগরিকের যোগাযোগ হালনাগাদ করুন ও প্রাপ্তি নিশ্চিত করুন",
    dueEn: "Due tomorrow",
    dueBn: "আগামীকাল দরকার",
    priority: "watch",
  },
  {
    id: "ASG-3307",
    caseId: "SKY-2026-00711",
    officerEn: "Adv. Rehana Parveen",
    officerBn: "অ্যাড. রেহানা পারভীন",
    taskEn: "Schedule separate mediation session — safety-screened",
    taskBn: "পৃথক মধ্যস্থতা সেশন নির্ধারণ করুন — নিরাপত্তা যাচাইকৃত",
    dueEn: "Due in 3 days",
    dueBn: "৩ দিনের মধ্যে দরকার",
    priority: "watch",
  },
];

type TimelineEntry = {
  timeEn: string;
  timeBn: string;
  titleEn: string;
  titleBn: string;
  actorEn: string;
  actorBn: string;
};

/* Realistic Bangladesh chronological events: lodged, reviewed,
   assigned, investigation, hearing scheduled, decision recorded. */
const timeline: TimelineEntry[] = [
  {
    timeEn: "Today · 10:42",
    timeBn: "আজ · ১০:৪২",
    titleEn: "Complaint lodged — SKY-2026-00412",
    titleBn: "অভিযোগ দায়ের — SKY-2026-00412",
    actorEn: "Raima Akter · Mirpur, Dhaka",
    actorBn: "রাইমা আক্তার · মিরপুর, ঢাকা",
  },
  {
    timeEn: "Today · 11:05",
    timeBn: "আজ · ১১:০৫",
    titleEn: "Complaint reviewed by receiving officer",
    titleBn: "গ্রহণকারী কর্মকর্তা কর্তৃক অভিযোগ পর্যালোচিত",
    actorEn: "Md. Arif Hossain · DLO Dhaka",
    actorBn: "মোঃ আরিফ হোসেন · ডিএলও ঢাকা",
  },
  {
    timeEn: "Today · 11:48",
    timeBn: "আজ · ১১:৪৮",
    titleEn: "Officer assigned — Kamrul Hasan",
    titleBn: "কর্মকর্তা নিয়োজিত — কামরুল হাসান",
    actorEn: "Panel lawyer · Dhaka Bar",
    actorBn: "প্যানেল আইনজীবী · ঢাকা বার",
  },
  {
    timeEn: "Today · 14:20",
    timeBn: "আজ · ১৪:২০",
    titleEn: "Investigation started — Khilgaon",
    titleBn: "তদন্ত শুরু — খিলগাঁও",
    actorEn: "Investigator · Dhaka Field Office",
    actorBn: "তদন্তকারী · ঢাকা মাঠ কার্যালয়",
  },
  {
    timeEn: "Today · 15:30",
    timeBn: "আজ · ১৫:৩০",
    titleEn: "Hearing scheduled — 30 Sep 2026",
    titleBn: "শুনানি নির্ধারিত — ৩০ সেপ্টেম্বর ২০২৬",
    actorEn: "District Court · Dhaka · Room 3",
    actorBn: "জেলা আদালত · ঢাকা · কক্ষ ৩",
  },
  {
    timeEn: "Yesterday · 16:10",
    timeBn: "গতকাল · ১৬:১০",
    titleEn: "Decision recorded — SKY-2026-00203",
    titleBn: "সিদ্ধান্ত নথিভুক্ত — SKY-2026-00203",
    actorEn: "Court order issued · Chittagong bench",
    actorBn: "আদালতের আদেশ প্রদত্ত · চট্টগ্রাম বেঞ্চ",
  },
];

function OfficerDashboard({ lang }: { lang: Lang }) {
  /* WordPress-style navigation: the sidebar writes the hash, this
     dashboard mirrors it into state and renders EXACTLY ONE section
     at a time. Clicking a sidebar item replaces the workspace; the
     previously selected section disappears entirely. */
  const [section, setSection] = useState<DloSection>("case");

  useEffect(() => {
    function sync() {
      setSection(readDloSection(window.location.hash));
    }
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <div className={styles.page}>
      {section === "case" ? <CaseWorkspace lang={lang} /> : null}
      {section === "alerts" ? <AlertsWorkspace lang={lang} /> : null}
      {section === "assignments" ? <AssignmentsWorkspace lang={lang} /> : null}
      {section === "timeline" ? <TimelineWorkspace lang={lang} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Case workspace — queue + filter + case detail cards.
 * ------------------------------------------------------------------ */

function CaseWorkspace({ lang }: { lang: Lang }) {
  const [filter, setFilter] = useState<"all" | "escalated" | "action" | "watch">("all");
  const [selected, setSelected] = useState<QueueItem | null>(null);
  /* DLAO inbox bridge — additive merge from the helpline workspace.
     Existing `queue` is untouched; bridged tasks render as a leading
     prefix so the officer sees new handoffs immediately. */
  const dlaoTasks = useDlaoInbox();
  const bridgedRows: QueueItem[] = dlaoTasks.map((task) => ({
    id: task.applicationId,
    state: "missing",
    priority:
      task.reason === "voice_failure" ||
      task.reason === "unsafe_answer" ||
      task.reason === "urgency_urgent"
        ? "escalated"
        : "action",
    field: "helpline_handoff",
    age: lang === "bn" ? "নতুন" : "new",
    reasonEn: `Helpline handoff (${task.reason})`,
    reasonBn: `হেল্পলাইন হস্তান্তর (${task.reason})`,
  }));
  const combined = [...bridgedRows, ...queue];
  const visible = filter === "all" ? combined : combined.filter((item) => item.priority === filter);
  return (
    <>
      <PrototypeNote lang={lang} />
      <PageHeader
        eyebrow={lang === "bn" ? "জেলা আইনি সহায়তা কর্মকর্তা" : "District Legal Aid Officer"}
        title={lang === "bn" ? "হস্তক্ষেপ কিউ" : "Intervention queue"}
        intro={
          lang === "bn"
            ? "৩টি প্রমাণগত ব্যতিক্রম পর্যালোচনা প্রয়োজন। অগ্রাধিকার ও বয়স অনুযায়ী সাজানো।"
            : "Three evidence exceptions need review, ordered by priority and age."
        }
        action={
          <Button onClick={() => setFilter("escalated")}>
            {lang === "bn" ? "জরুরি দেখুন" : "Review escalated"}
          </Button>
        }
      />

      <div className={styles.metrics}>
        <div>
          <strong>03</strong>
          <span>{lang === "bn" ? "খোলা ব্যতিক্রম" : "Open exceptions"}</span>
        </div>
        <div>
          <strong>01</strong>
          <span>{lang === "bn" ? "বিরোধপূর্ণ" : "Disputed"}</span>
        </div>
        <div>
          <strong>06h</strong>
          <span>{lang === "bn" ? "গড় প্রথম পদক্ষেপ" : "Median first action"}</span>
        </div>
        <div>
          <strong>92%</strong>
          <span>{lang === "bn" ? "সময়মতো তথ্য" : "Updates on time"}</span>
        </div>
      </div>

      {dlaoTasks.filter((t) => t.reason === "urgency_urgent").length > 0 ? (
        <section
          className={styles.section}
          aria-labelledby="dlao-urgent"
          style={{ borderColor: "var(--red)" }}
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionLabel}>
                {lang === "bn" ? "জরুরি হেল্পলাইন বিজ্ঞপ্তি" : "Urgent helpline notifications"}
              </p>
              <h2 id="dlao-urgent">
                {lang === "bn"
                  ? "জরুরি — ২৪ ঘণ্টার মধ্যে যোগাযোগ"
                  : "Urgent — contact within 24 hours"}
              </h2>
            </div>
          </div>
          <ul className={styles.alertsList}>
            {dlaoTasks
              .filter((t) => t.reason === "urgency_urgent")
              .map((task) => (
                <li key={task.id} className={`${styles.alertRow} ${styles.escalated}`}>
                  <span className={`${styles.alertSeverity} ${styles.alertSeverity_escalated}`}>
                    {lang === "bn" ? "জরুরি" : "Urgent"}
                  </span>
                  <div className={styles.alertBody}>
                    <strong>{task.applicantName} · {task.applicationId}</strong>
                    <p>
                      {lang === "bn"
                        ? "শারীরিক নিরাপত্তা হুমকি — অবিলম্বে যাচাই করুন।"
                        : "Physical safety threat — verify immediately."}
                    </p>
                    {task.notes ? <small>{task.notes}</small> : null}
                    <small>
                      <a href={`/dashboard/dlao/applications/${encodeURIComponent(task.applicationId)}`}>
                        {lang === "bn" ? "যাচাই শুরু করুন →" : "Open verification →"}
                      </a>
                    </small>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <nav
        className={styles.filters}
        aria-label={lang === "bn" ? "কিউ ফিল্টার" : "Queue filters"}
      >
        {(
          [
            ["all", lang === "bn" ? "সব" : "All"],
            ["escalated", lang === "bn" ? "জরুরি" : "Escalated"],
            ["action", lang === "bn" ? "পদক্ষেপ প্রয়োজন" : "Needs action"],
            ["watch", lang === "bn" ? "নজরে রাখুন" : "Watch"],
          ] as const
        ).map(([key, name]) => (
          <button
            key={key}
            className={filter === key ? styles.filterActive : ""}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
          >
            {name}
          </button>
        ))}
      </nav>

      <section
        id="case"
        className={styles.queue}
        aria-live="polite"
        aria-label={lang === "bn" ? "হস্তক্ষেপ কিউ" : "Intervention queue"}
      >
        <div className={styles.queueHead}>
          <span>{lang === "bn" ? "অগ্রাধিকার" : "Priority"}</span>
          <span>{lang === "bn" ? "কারণ" : "Reason"}</span>
          <span>{lang === "bn" ? "মামলা" : "Case"}</span>
          <span>{lang === "bn" ? "অবস্থা" : "State"}</span>
          <span>{lang === "bn" ? "বয়স" : "Age"}</span>
        </div>
        {visible.map((item) => (
          <button
            key={item.id}
            className={`${styles.queueRow} ${styles[item.priority]}`}
            onClick={() => {
              if (item.field === "helpline_handoff") {
                if (typeof window !== "undefined") {
                  window.location.href = `/dashboard/dlao/applications/${encodeURIComponent(item.id)}`;
                }
                return;
              }
              setSelected(item);
            }}
            aria-label={item.id}
          >
            <span className={`${styles.priority} ${styles[item.priority]}`}>
              <i />
              {item.priority === "action"
                ? lang === "bn"
                  ? "পদক্ষেপ"
                  : "Needs action"
                : item.priority === "escalated"
                  ? lang === "bn"
                    ? "জরুরি"
                    : "Escalated"
                  : lang === "bn"
                    ? "নজর"
                    : "Watch"}
            </span>
            <strong>{lang === "bn" ? item.reasonBn : item.reasonEn}</strong>
            <span>{item.id}</span>
            <State value={item.state} />
            <span>{item.age}</span>
          </button>
        ))}
      </section>

      {/* Detailed case cards — populated with realistic Bangladeshi
         dummy data (parties, location, complaint type, status,
         assigned officer, description) so the section feels like a
         working application rather than placeholder text. */}
      <div className={styles.caseCardGrid}>
        <CaseCard
          lang={lang}
          caseId="SKY-2026-00412"
          complainantEn="Raima Akter"
          complainantBn="রাইমা আক্তার"
          respondentEn="Mohammad Ali Hossain"
          respondentBn="মোহাম্মদ আলী হোসেন"
          locationEn="Mirpur-10, Dhaka"
          locationBn="মিরপুর-১০, ঢাকা"
          typeEn="Family maintenance"
          typeBn="পারিবারিক ভরণপোষণ"
          statusEn="Under review"
          statusBn="পর্যালোচনাধীন"
          officerEn="Md. Arif Hossain"
          officerBn="মোঃ আরিফ হোসেন"
          descriptionEn="Complainant seeks monthly maintenance for two minor children; respondent has not responded within the statutory window."
          descriptionBn="অভিযোগকারী দুই সন্তানের জন্য মাসিক ভরণপোষণ চান; বিবাদী আইনগত সময়সীমার মধ্যে সাড়া দেননি।"
        />
        <CaseCard
          lang={lang}
          caseId="SKY-2026-00203"
          complainantEn="Shahidul Alam"
          complainantBn="শহীদুল আলম"
          respondentEn="Nazma Begum"
          respondentBn="নাজমা বেগম"
          locationEn="Agrabad, Chittagong"
          locationBn="আগ্রাবাদ, চট্টগ্রাম"
          typeEn="Civil recovery"
          typeBn="দেওয়ানি ফেরত"
          statusEn="Hearing scheduled"
          statusBn="শুনানি নির্ধারিত"
          officerEn="Barrister Kamrul Hasan"
          officerBn="ব্যারিস্টার কামরুল হাসান"
          descriptionEn="Dispute over a registered land deed transfer; mediation failed twice and the case is now before the bench."
          descriptionBn="নিবন্ধিত ভূমি দলিল হস্তান্তর নিয়ে বিরোধ; মধ্যস্থতা দুইবার ব্যর্থ, এখন বেঞ্চে বিচারাধীন।"
        />
        <CaseCard
          lang={lang}
          caseId="SKY-2026-00678"
          complainantEn="Rehana Parveen"
          complainantBn="রেহানা পারভীন"
          respondentEn="Jalal Ahmed"
          respondentBn="জালাল আহমেদ"
          locationEn="Zindabazar, Sylhet"
          locationBn="জিন্দাবাজার, সিলেট"
          typeEn="Land boundary"
          typeBn="ভূমি সীমানা"
          statusEn="Mediation in progress"
          statusBn="মধ্যস্থতা চলছে"
          officerEn="Md. Nazrul Islam"
          officerBn="মোঃ নজরুল ইসলাম"
          descriptionEn="Adjacent plot owners contest the boundary line recorded in the 2018 mouza map."
          descriptionBn="প্রতিবেশী জমির মালিকগণ ২০১৮ সালের মৌজা মানচিত্রে লিপিবদ্ধ সীমানা নিয়ে দ্বন্দ্বে আছেন।"
        />
      </div>

      <CoverageNavigator />

      {selected ? (
        <div className={styles.dialogBackdrop} role="presentation">
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-title"
          >
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionLabel}>
                  {selected.id} · {selected.field}
                </p>
                <h2 id="alert-title">
                  {lang === "bn" ? selected.reasonBn : selected.reasonEn}
                </h2>
              </div>
              <button className={styles.textButton} onClick={() => setSelected(null)}>
                {copy(labels.close, lang)}
              </button>
            </div>
            <div className={styles.evidenceCompare}>
              <article>
                <p>{lang === "bn" ? "আইনজীবীর প্রতিবেদন" : "Lawyer report"}</p>
                <strong>28 Sep 2026</strong>
                <State value="reported" />
              </article>
              <article>
                <p>{lang === "bn" ? "আদালতের নথি" : "Court record"}</p>
                <strong>30 Sep 2026</strong>
                <State value="verified" />
              </article>
            </div>
            <p className={styles.evidence}>
              {lang === "bn"
                ? "নিয়ম hearing-date/v1 · উভয় সক্রিয় পর্যবেক্ষণ সংরক্ষিত · সিদ্ধান্ত নেওয়ার জন্য অনুমোদিত কর্মকর্তার কারণ ও কর্তৃত্বের ভিত্তি প্রয়োজন।"
                : "Rule hearing-date/v1 · both active observations are preserved · resolution requires an authorised officer, cited evidence, authority basis, and reason."}
            </p>
            <div className={styles.actions}>
              <Button disabled>
                {lang === "bn" ? "সমাধান নথিভুক্ত করুন" : "Record resolution"}
              </Button>
              <Button variant="secondary" onClick={() => setSelected(null)}>
                {lang === "bn" ? "কিউতে রাখুন" : "Keep in queue"}
              </Button>
            </div>
            <p className={styles.deferred}>
              {lang === "bn"
                ? "নিরাপদ রেজোলিউশন API এখনো Phase 2-তে; এই ডেমো বোতামটি তাই সংরক্ষণ দাবি করে না।"
                : "The authorised resolution API is scheduled for Phase 2, so this demo does not claim to save a decision."}
            </p>
          </section>
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ *
 *  Case detail card — used inside the Case workspace.
 * ------------------------------------------------------------------ */

function CaseCard({
  lang,
  caseId,
  complainantEn,
  complainantBn,
  respondentEn,
  respondentBn,
  locationEn,
  locationBn,
  typeEn,
  typeBn,
  statusEn,
  statusBn,
  officerEn,
  officerBn,
  descriptionEn,
  descriptionBn,
}: {
  lang: Lang;
  caseId: string;
  complainantEn: string;
  complainantBn: string;
  respondentEn: string;
  respondentBn: string;
  locationEn: string;
  locationBn: string;
  typeEn: string;
  typeBn: string;
  statusEn: string;
  statusBn: string;
  officerEn: string;
  officerBn: string;
  descriptionEn: string;
  descriptionBn: string;
}) {
  const rows = [
    {
      labelEn: "Case ID",
      labelBn: "মামলার নম্বর",
      value: caseId,
    },
    {
      labelEn: "Complainant",
      labelBn: "অভিযোগকারী",
      value: lang === "bn" ? complainantBn : complainantEn,
    },
    {
      labelEn: "Respondent",
      labelBn: "বিবাদী",
      value: lang === "bn" ? respondentBn : respondentEn,
    },
    {
      labelEn: "Location",
      labelBn: "অবস্থান",
      value: lang === "bn" ? locationBn : locationEn,
    },
    {
      labelEn: "Complaint type",
      labelBn: "অভিযোগের ধরন",
      value: lang === "bn" ? typeBn : typeEn,
    },
    {
      labelEn: "Current status",
      labelBn: "বর্তমান অবস্থা",
      value: lang === "bn" ? statusBn : statusEn,
    },
    {
      labelEn: "Assigned officer",
      labelBn: "নিয়োজিত কর্মকর্তা",
      value: lang === "bn" ? officerBn : officerEn,
    },
  ];
  return (
    <article className={styles.caseCard} aria-label={caseId}>
      <header className={styles.caseCardHead}>
        <div>
          <p className={styles.sectionLabel}>{caseId}</p>
          <h3>
            {lang === "bn" ? complainantBn : complainantEn}
            <span className={styles.caseCardVs}>
              {" "}
              {lang === "bn" ? "বনাম" : "v."}{" "}
            </span>
            {lang === "bn" ? respondentBn : respondentEn}
          </h3>
        </div>
        <span
          className={
            statusEn === "Hearing scheduled"
              ? styles.statusBadge
              : statusEn === "Under review"
                ? styles.statusBadgeMuted
                : styles.statusBadgeOk
          }
        >
          {lang === "bn" ? statusBn : statusEn}
        </span>
      </header>
      <dl className={styles.caseCardList}>
        {rows.slice(1).map((row) => (
          <div key={row.labelEn}>
            <dt>{lang === "bn" ? row.labelBn : row.labelEn}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.caseCardDescription}>
        {lang === "bn" ? descriptionBn : descriptionEn}
      </p>
    </article>
  );
}

/* ------------------------------------------------------------------ *
 *  Alerts workspace — independent section, rich Bangladeshi alerts.
 * ------------------------------------------------------------------ */

function AlertsWorkspace({ lang }: { lang: Lang }) {
  return (
    <>
      <PrototypeNote lang={lang} />
      <PageHeader
        eyebrow={lang === "bn" ? "জেলা আইনি সহায়তা কর্মকর্তা" : "District Legal Aid Officer"}
        title={lang === "bn" ? "সতর্কতা" : "Alerts"}
        intro={
          lang === "bn"
            ? "নতুন অভিযোগ, শুনানির আগমন, নিয়োগ হালনাগাদ ও গুরুত্বপূর্ণ সময়সীমা — একনজরে।"
            : "New complaints, approaching hearings, assignment updates, status changes, and important deadlines — at a glance."
        }
      />

      <section
        id="alerts"
        className={styles.workspacePanel}
        aria-labelledby="alerts-heading"
      >
        <div className={styles.workspacePanelHead}>
          <h2 id="alerts-heading">
            {lang === "bn" ? "সক্রিয় সতর্কতা" : "Active alerts"}
          </h2>
          <span className={styles.sidePanelCount}>{alerts.length}</span>
        </div>
        <ul className={styles.alertsList}>
          {alerts.map((a) => (
            <li
              key={a.id}
              className={`${styles.alertRow} ${styles[a.severity]}`}
            >
              <span
                className={`${styles.alertSeverity} ${styles[`alertSeverity_${a.severity}`]}`}
              >
                {a.severity === "escalated"
                  ? lang === "bn"
                    ? "জরুরি"
                    : "Escalated"
                  : a.severity === "action"
                    ? lang === "bn"
                      ? "পদক্ষেপ"
                      : "Needs action"
                    : lang === "bn"
                      ? "নজর"
                      : "Watch"}
              </span>
              <div className={styles.alertBody}>
                <strong>
                  {lang === "bn" ? a.titleBn : a.titleEn}
                </strong>
                <p>{lang === "bn" ? a.descriptionBn : a.descriptionEn}</p>
                <small>
                  {a.id} · {a.caseId} · {a.age}
                </small>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <CoverageNavigator />
    </>
  );
}

/* ------------------------------------------------------------------ *
 *  Assignments workspace — independent section, rich dummy data.
 * ------------------------------------------------------------------ */

function AssignmentsWorkspace({ lang }: { lang: Lang }) {
  return (
    <>
      <PrototypeNote lang={lang} />
      <PageHeader
        eyebrow={lang === "bn" ? "জেলা আইনি সহায়তা কর্মকর্তা" : "District Legal Aid Officer"}
        title={lang === "bn" ? "নিয়োগ" : "Assignments"}
        intro={
          lang === "bn"
            ? "কর্মকর্তা, কাজ ও সময়সীমা অনুযায়ী সাজানো নিয়োগ তালিকা।"
            : "Assignment list ordered by officer, task, and deadline."
        }
      />

      <section
        id="assignments"
        className={styles.workspacePanel}
        aria-labelledby="assignments-heading"
      >
        <div className={styles.workspacePanelHead}>
          <h2 id="assignments-heading">
            {lang === "bn" ? "চলমান নিয়োগ" : "Open assignments"}
          </h2>
          <span className={styles.sidePanelCount}>{assignments.length}</span>
        </div>
        <div className={styles.assignmentsHead}>
          <span>{lang === "bn" ? "কর্মকর্তা" : "Officer"}</span>
          <span>{lang === "bn" ? "কাজ" : "Task"}</span>
          <span>{lang === "bn" ? "মামলা" : "Case"}</span>
          <span>{lang === "bn" ? "অগ্রাধিকার" : "Priority"}</span>
          <span>{lang === "bn" ? "সময়সীমা" : "Due"}</span>
        </div>
        <ul className={styles.assignmentsList}>
          {assignments.map((a) => (
            <li
              key={a.id}
              className={`${styles.assignmentRow} ${styles[a.priority]}`}
            >
              <span className={styles.assignmentOfficer}>
                {lang === "bn" ? a.officerBn : a.officerEn}
              </span>
              <span className={styles.assignmentTask}>
                {lang === "bn" ? a.taskBn : a.taskEn}
              </span>
              <span className={styles.assignmentCase}>{a.caseId}</span>
              <span
                className={`${styles.priority} ${styles[a.priority]}`}
              >
                <i />
                {a.priority === "escalated"
                  ? lang === "bn"
                    ? "জরুরি"
                    : "Escalated"
                  : a.priority === "action"
                    ? lang === "bn"
                      ? "পদক্ষেপ"
                      : "Needs action"
                    : lang === "bn"
                      ? "নজর"
                      : "Watch"}
              </span>
              <span className={styles.assignmentDue}>
                {lang === "bn" ? a.dueBn : a.dueEn}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <CoverageNavigator />
    </>
  );
}

/* ------------------------------------------------------------------ *
 *  Timeline workspace — independent section, chronological events.
 * ------------------------------------------------------------------ */

function TimelineWorkspace({ lang }: { lang: Lang }) {
  return (
    <>
      <PrototypeNote lang={lang} />
      <PageHeader
        eyebrow={lang === "bn" ? "জেলা আইনি সহায়তা কর্মকর্তা" : "District Legal Aid Officer"}
        title={lang === "bn" ? "সময়রেখা" : "Timeline"}
        intro={
          lang === "bn"
            ? "অভিযোগ দায়ের থেকে সিদ্ধান্ত নথিভুক্তি পর্যন্ত প্রতিটি ঘটনার কালানুক্রম।"
            : "Chronological events from complaint lodgement to recorded decision."
        }
      />

      <section
        id="timeline"
        className={styles.workspacePanel}
        aria-labelledby="timeline-heading"
      >
        <div className={styles.workspacePanelHead}>
          <h2 id="timeline-heading">
            {lang === "bn" ? "সাম্প্রতিক ঘটনা" : "Recent events"}
          </h2>
          <span className={styles.sidePanelCount}>{timeline.length}</span>
        </div>
        <ul className={styles.timelineList}>
          {timeline.map((t, idx) => (
            <li
              key={`${t.timeEn}-${idx}`}
              className={styles.timelineItem}
            >
              <time className={styles.timelineTime}>
                {lang === "bn" ? t.timeBn : t.timeEn}
              </time>
              <div className={styles.timelineBody}>
                <strong>
                  {lang === "bn" ? t.titleBn : t.titleEn}
                </strong>
                <small>{lang === "bn" ? t.actorBn : t.actorEn}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <CoverageNavigator />
    </>
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

