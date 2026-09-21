"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { ComplaintModal } from "@/components/complaint-modal";
import { CoverageNavigator } from "@/components/coverage-navigator";
import { OperationalRoleDashboard } from "@/components/operational-role-dashboard";
import { useI18n, type Lang } from "@/lib/i18n";
import type { RoleId } from "@/lib/roles";
import styles from "./role-dashboard.module.css";
import citizenStyles from "./citizen-dashboard.module.css";

type Copy = { bn: string; en: string };
const copy = (value: Copy, lang: Lang) => value[lang];

const labels = {
  simulated: { bn: "সিমুলেটেড", en: "Simulated" },
  view: { bn: "প্রমাণ দেখুন", en: "View evidence" },
  close: { bn: "বন্ধ করুন", en: "Close" },
  saved: { bn: "এই প্রোটোটাইপ সেশনে সংরক্ষিত হয়েছে।", en: "Saved for this prototype session." },
};

type DashboardProps = { role: RoleId };

export function RoleDashboard({ role }: DashboardProps) {
  const { lang } = useI18n();
  return role === "citizen" ? <CitizenDashboard lang={lang} /> :
    role === "lawyer" ? <LawyerDashboard lang={lang} /> :
    role === "dlo" ? <OfficerDashboard lang={lang} /> :
    role === "admin" ? <AdminDashboard lang={lang} /> :
    <OperationalRoleDashboard role={role} />;
}

function PrototypeNote({ lang }: { lang: Lang }) {
  return (
    <p className={styles.prototypeNote}>
      <span>{copy(labels.simulated, lang)}</span>
      {lang === "bn"
        ? "প্রোটোটাইপ তথ্য · ঘড়ি, এসএমএস ও আদালতের তথ্য বাস্তব নয়"
        : "Prototype data · clock, SMS, and court records are not live"}
    </p>
  );
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

// Citizen view — easy, calm, large. General users see this; it is deliberately
// the most readable view in the app. Uses its own CSS module so the operational
// role dashboards stay compact.
const citizenCopy = {
  statusLabel: { bn: "মামলা SHK-DEMO-007", en: "Case SHK-DEMO-007" },
  verifiedHeading: { bn: "পরবর্তী শুনানি ৩০ সেপ্টেম্বর ২০২৬", en: "Next hearing: 30 September 2026" },
  verifiedBody: {
    bn: "তারিখটি আদালতের নথি দেখে যাচাই করা হয়েছে। সকাল ১০টার মাঝে জেলা আদালতে উপস্থিত থাকুন।",
    en: "The date was verified against a court record. Arrive at the District Court by 10:00 AM.",
  },
  tabCases: { bn: "আমার মামলা", en: "My case" },
  tabMessages: { bn: "বার্তা", en: "Message" },
  tabProfile: { bn: "মামলার তথ্য", en: "Case details" },
  tabHelp: { bn: "সাহায্য", en: "Get help" },
  messageLabel: { bn: "সর্বশেষ বার্তা", en: "Latest message" },
  messageHeading: { bn: "পরবর্তী পদক্ষেপ নিশ্চিত করুন", en: "Confirm your next step" },
  messageBody: {
    bn: "আপনার শুনানির তারিখ ৩০ সেপ্টেম্বর। এই তথ্যটি কি আপনার জানা তথ্যের সঙ্গে মেলে?",
    en: "Your hearing date is 30 September. Does this match the information you have?",
  },
  confirm: { bn: "হ্যাঁ, তথ্য ঠিক আছে", en: "Yes, this is correct" },
  dispute: { bn: "না, তথ্যটি ভুল", en: "No, this is wrong" },
  callback: { bn: "আমাকে ফোন করুন", en: "Call me back" },
  factsHeading: { bn: "মামলার তথ্য", en: "Case details" },
  status: { bn: "অবস্থা", en: "Status" },
  statusValue: { bn: "আইনি সহায়তা চলমান", en: "Legal aid active" },
  lawyer: { bn: "আইনজীবী", en: "Lawyer" },
  lawyerValue: { bn: "ফারহানা রহমান", en: "Farhana Rahman" },
  nextAction: { bn: "পরবর্তী কাজ", en: "Next action" },
  nextActionValue: { bn: "শুনানিতে উপস্থিতি", en: "Attend hearing" },
  view: { bn: "প্রমাণ দেখুন", en: "View source" },
  viewLess: { bn: "প্রমাণ লুকান", en: "Hide source" },
  evidence: {
    bn: "উৎস: সিমুলেটেড আদালত নথি · ধারণ: ২০ সেপ্টেম্বর ২০২৬ · নীতি: hearing-date/v1",
    en: "Source: simulated court record · captured 20 Sep 2026 · policy: hearing-date/v1",
  },
  helpHeading: { bn: "সাহায্য দরকার?", en: "Need help?" },
  helpBody: {
    bn: "যেকোনো প্রশ্নে ১৬৬৯৯ নম্বরে কল করুন অথবা নিচের বোতামে চাপ দিয়ে আমাদের জানান — আমরাই আপনাকে ফোন করব।",
    en: "Call 16699 for any question, or tap the button below and we will call you back.",
  },
  confirmSuccess: { bn: "আপনার নিশ্চিতকরণ নথিভুক্ত হয়েছে।", en: "Your confirmation was recorded." },
  disputeSuccess: { bn: "বিষয়টি কর্মকর্তার পর্যালোচনার জন্য পাঠানো হয়েছে।", en: "This was sent to an officer for review." },
  callbackSuccess: { bn: "ফোন করার অনুরোধ নথিভুক্ত হয়েছে।", en: "Your callback request was recorded." },
};

// Tab keys match the URL hash destinations on the citizen sidebar.
// "cases" is the default landing tab.
type CitizenTab = "cases" | "messages" | "profile" | "help" | "complaint";

const TAB_HASH: Record<CitizenTab, string> = {
  cases: "#cases",
  messages: "#messages",
  profile: "#profile",
  help: "#help",
  complaint: "#complaint",
};

function readHashTab(): CitizenTab {
  if (typeof window === "undefined") return "cases";
  const raw = window.location.hash.replace(/^#/, "");
  if (raw === "messages" || raw === "profile" || raw === "help" || raw === "complaint") return raw;
  return "cases";
}

function CitizenDashboard({ lang }: { lang: Lang }) {
  const [reply, setReply] = useState<"confirm" | "dispute" | "callback" | null>(null);
  const [details, setDetails] = useState(false);
  // Active tab is driven by the URL hash so the sidebar acts as the tab bar
  // and the same in-page anchor links work.
  const [tab, setTab] = useState<CitizenTab>("cases");
  useEffect(() => {
    function sync() {
      setTab(readHashTab());
    }
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  function selectTab(next: CitizenTab) {
    // Update the URL hash so deep-links/back-button work and the sidebar
    // active state stays in sync. We use replaceState + a synthetic
    // hashchange so the React state catches up without a full nav.
    history.replaceState(null, "", TAB_HASH[next] + window.location.search);
    setTab(next);
  }
  const c = (k: keyof typeof citizenCopy) => copy(citizenCopy[k], lang);

  return (
    <div className={citizenStyles.page}>
      <p className={citizenStyles.prototypeNote}>
        <span className={citizenStyles.simTag}>{copy(labels.simulated, lang)}</span>
        {lang === "bn"
          ? "প্রোটোটাইপ তথ্য · ঘড়ি, এসএমএস ও আদালতের তথ্য বাস্তব নয়"
          : "Prototype data · clock, SMS, and court records are not live"}
      </p>

      <header className={citizenStyles.pageHeader}>
        <p className={citizenStyles.eyebrow}>{lang === "bn" ? "নাগরিক পোর্টাল" : "Citizen portal"}</p>
        <h1>{lang === "bn" ? "আপনার আইনি সহায়তা" : "Your legal aid"}</h1>
        <p className={citizenStyles.intro}>
          {lang === "bn"
            ? "যাচাইকৃত পরবর্তী পদক্ষেপ দেখুন এবং কোনো তথ্য ভুল হলে জানান।"
            : "See the verified next step and tell the office when something is wrong."}
        </p>
      </header>

      {/* WordPress-style tab strip — only the active panel renders below. */}
      <nav className={citizenStyles.tabs} role="tablist" aria-label={lang === "bn" ? "বিভাগ" : "Sections"}>
        {(
          [
            { id: "cases", label: c("tabCases") },
            { id: "messages", label: c("tabMessages") },
            { id: "profile", label: c("tabProfile") },
            { id: "help", label: c("tabHelp") },
            { id: "complaint", label: lang === "bn" ? "অভিযোগ" : "Complaint" },
          ] as { id: CitizenTab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`citizen-panel-${t.id}`}
            id={`citizen-tab-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={`${citizenStyles.tab} ${tab === t.id ? citizenStyles.tabActive : ""}`}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "cases" ? (
        <section
          id="cases"
          role="tabpanel"
          aria-labelledby="citizen-tab-cases"
          className={citizenStyles.heroStatus}
        >
          <div className={citizenStyles.heroStatusTop}>
            <p className={citizenStyles.sectionLabel}>{c("statusLabel")}</p>
            <State value="verified" />
          </div>
          <h2>{c("verifiedHeading")}</h2>
          <p>{c("verifiedBody")}</p>
        </section>
      ) : null}

      {tab === "messages" ? (
        <section
          id="messages"
          role="tabpanel"
          aria-labelledby="citizen-tab-messages"
          className={`${citizenStyles.card} ${citizenStyles.cardSplit}`}
        >
          <div>
            <p className={citizenStyles.sectionLabel}>{c("messageLabel")}</p>
            <h2>{c("messageHeading")}</h2>
            <p className={citizenStyles.message}>{c("messageBody")}</p>
            {reply ? (
              <p role="status" className={citizenStyles.success}>
                {reply === "confirm" ? c("confirmSuccess") : reply === "dispute" ? c("disputeSuccess") : c("callbackSuccess")}
              </p>
            ) : null}
            <div className={citizenStyles.actions}>
              <Button onClick={() => setReply("confirm")}>{c("confirm")}</Button>
              <Button variant="secondary" onClick={() => setReply("dispute")}>{c("dispute")}</Button>
              <button className={citizenStyles.textButton} onClick={() => setReply("callback")}>{c("callback")}</button>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "profile" ? (
        <aside
          id="profile"
          role="tabpanel"
          aria-labelledby="citizen-tab-profile"
          className={`${citizenStyles.card} ${citizenStyles.facts}`}
          aria-label={c("factsHeading")}
        >
          <h2>{c("factsHeading")}</h2>
          <dl>
            <div><dt>{c("status")}</dt><dd>{c("statusValue")}</dd></div>
            <div><dt>{c("lawyer")}</dt><dd>{c("lawyerValue")}</dd></div>
            <div><dt>{c("nextAction")}</dt><dd>{c("nextActionValue")}</dd></div>
          </dl>
          <button className={citizenStyles.textButton} onClick={() => setDetails(!details)}>
            {details ? c("viewLess") : c("view")}
          </button>
          {details ? <p className={citizenStyles.evidence}>{c("evidence")}</p> : null}
        </aside>
      ) : null}

      {tab === "help" ? (
        <section
          id="help"
          role="tabpanel"
          aria-labelledby="citizen-tab-help"
          className={citizenStyles.help}
        >
          <h3>{c("helpHeading")}</h3>
          <p>{c("helpBody")}</p>
          <div className={citizenStyles.actions}>
            <Button onClick={() => setReply("callback")}>{c("callback")}</Button>
          </div>
        </section>
      ) : null}

      {/* Complaint — same panel pattern as the other tabs. */}
      {tab === "complaint" ? (
        <div role="tabpanel" aria-labelledby="citizen-tab-complaint">
          <ComplaintModal />
        </div>
      ) : null}
    </div>
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

      {formOpen ? (
        <div className={styles.dialogBackdrop} role="presentation">
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
          >
            <div className={styles.sectionHeading}>
              <h2 id="report-title">{lang === "bn" ? "শুনানির প্রতিবেদন" : "Hearing report"}</h2>
              <button className={styles.textButton} onClick={() => setFormOpen(false)}>
                {copy(labels.close, lang)}
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setSubmitted(true);
              }}
              className={styles.form}
            >
              <label>
                {lang === "bn" ? "উপস্থিতি" : "Attendance"}
                <select required>
                  <option value="">{lang === "bn" ? "বেছে নিন" : "Select"}</option>
                  <option>{lang === "bn" ? "উপস্থিত" : "Attended"}</option>
                  <option>{lang === "bn" ? "অনুপস্থিত" : "Did not attend"}</option>
                </select>
              </label>
              <label>
                {lang === "bn" ? "ফলাফল" : "Outcome"}
                <select required>
                  <option value="">{lang === "bn" ? "বেছে নিন" : "Select"}</option>
                  <option>{lang === "bn" ? "মুলতবি" : "Adjourned"}</option>
                  <option>{lang === "bn" ? "আদেশ হয়েছে" : "Order issued"}</option>
                </select>
              </label>
              <label>
                {lang === "bn" ? "পরবর্তী তারিখ" : "Next date"}
                <input type="date" required />
              </label>
              {submitted ? (
                <p role="status" className={styles.success}>
                  {lang === "bn"
                    ? "প্রতিবেদনটি স্ব-প্রতিবেদিত প্রমাণ হিসেবে নথিভুক্ত হয়েছে।"
                    : "Report recorded as self-reported evidence."}
                </p>
              ) : (
                <Button type="submit">
                  {lang === "bn" ? "প্রতিবেদন জমা দিন" : "Submit report"}
                </Button>
              )}
            </form>
          </section>
        </div>
      ) : null}
      <section id="calendar" className={styles.hairlineList}><h2>{lang === "bn" ? "আগামী সময়সূচি" : "Upcoming schedule"}</h2><div><time>30 Sep · 10:00</time><span>SHK-DEMO-007</span><span>{lang === "bn" ? "জেলা আদালত" : "District Court"}</span></div><div><time>08 Oct · 11:30</time><span>SHK-DEMO-011</span><span>{lang === "bn" ? "পারিবারিক আদালত" : "Family Court"}</span></div></section>
      <CoverageNavigator />
    </div>
  );
}

const queue = [
  { id: "SHK-DEMO-007", state: "disputed" as const, priority: "escalated", field: "hearing_date", age: "2h", reasonEn: "Lawyer and court records show different next hearing dates.", reasonBn: "আইনজীবী ও আদালতের নথিতে শুনানির ভিন্ন তারিখ রয়েছে।" },
  { id: "SHK-DEMO-002", state: "missing" as const, priority: "action", field: "hearing_report", age: "1d", reasonEn: "Hearing report was not received within 48 hours. Attendance is unknown.", reasonBn: "৪৮ ঘণ্টার মধ্যে শুনানির প্রতিবেদন পাওয়া যায়নি। উপস্থিতি অজানা।" },
  { id: "SHK-DEMO-006", state: "stale" as const, priority: "watch", field: "client_contact", age: "2d", reasonEn: "The last client-contact record is older than the configured freshness window.", reasonBn: "সর্বশেষ নাগরিক-যোগাযোগের তথ্য নির্ধারিত সময়ের চেয়ে পুরোনো।" },
];

function OfficerDashboard({ lang }: { lang: Lang }) {
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<typeof queue[number] | null>(null);
  const visible = filter === "all" ? queue : queue.filter((item) => item.priority === filter);
  return (
    <div className={styles.page}>
      <PrototypeNote lang={lang} />
      <PageHeader eyebrow={lang === "bn" ? "জেলা আইনি সহায়তা কর্মকর্তা" : "District Legal Aid Officer"} title={lang === "bn" ? "হস্তক্ষেপ কিউ" : "Intervention queue"} intro={lang === "bn" ? "৩টি প্রমাণগত ব্যতিক্রম পর্যালোচনা প্রয়োজন। অগ্রাধিকার ও বয়স অনুযায়ী সাজানো।" : "Three evidence exceptions need review, ordered by priority and age."} action={<Button onClick={() => document.getElementById("queue")?.scrollIntoView()}>{lang === "bn" ? "কিউ পর্যালোচনা" : "Review queue"}</Button>} />
      <nav className={styles.filters} aria-label={lang === "bn" ? "কিউ ফিল্টার" : "Queue filters"}>{[["all", lang === "bn" ? "সব" : "All"], ["escalated", lang === "bn" ? "জরুরি" : "Escalated"], ["action", lang === "bn" ? "পদক্ষেপ প্রয়োজন" : "Needs action"], ["watch", lang === "bn" ? "নজরে রাখুন" : "Watch"]].map(([key, name]) => <button key={key} className={filter === key ? styles.filterActive : ""} onClick={() => setFilter(key)}>{name}</button>)}</nav>
      <section id="queue" className={styles.queue} aria-live="polite"><div className={styles.queueHead}><span>{lang === "bn" ? "অগ্রাধিকার" : "Priority"}</span><span>{lang === "bn" ? "কারণ" : "Reason"}</span><span>{lang === "bn" ? "মামলা" : "Case"}</span><span>{lang === "bn" ? "অবস্থা" : "State"}</span><span>{lang === "bn" ? "বয়স" : "Age"}</span></div>{visible.map((item) => <button key={item.id} className={styles.queueRow} onClick={() => setSelected(item)}><span className={`${styles.priority} ${styles[item.priority]}`}><i />{item.priority === "action" ? (lang === "bn" ? "পদক্ষেপ" : "Needs action") : item.priority === "escalated" ? (lang === "bn" ? "জরুরি" : "Escalated") : (lang === "bn" ? "নজর" : "Watch")}</span><strong>{lang === "bn" ? item.reasonBn : item.reasonEn}</strong><span>{item.id}</span><State value={item.state} /><span>{item.age}</span></button>)}</section>
      <div className={styles.metrics} id="cases"><div><strong>03</strong><span>{lang === "bn" ? "খোলা ব্যতিক্রম" : "Open exceptions"}</span></div><div><strong>01</strong><span>{lang === "bn" ? "বিরোধপূর্ণ" : "Disputed"}</span></div><div><strong>06h</strong><span>{lang === "bn" ? "গড় প্রথম পদক্ষেপ" : "Median first action"}</span></div></div>
      <CoverageNavigator />
      {selected ? <div className={styles.dialogBackdrop} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="alert-title"><div className={styles.sectionHeading}><div><p className={styles.sectionLabel}>{selected.id} · {selected.field}</p><h2 id="alert-title">{lang === "bn" ? selected.reasonBn : selected.reasonEn}</h2></div><button className={styles.textButton} onClick={() => setSelected(null)}>{copy(labels.close, lang)}</button></div><div className={styles.evidenceCompare}><article><p>{lang === "bn" ? "আইনজীবীর প্রতিবেদন" : "Lawyer report"}</p><strong>28 Sep 2026</strong><State value="reported" /></article><article><p>{lang === "bn" ? "আদালতের নথি" : "Court record"}</p><strong>30 Sep 2026</strong><State value="verified" /></article></div><p className={styles.evidence}>{lang === "bn" ? "নিয়ম hearing-date/v1 · উভয় সক্রিয় পর্যবেক্ষণ সংরক্ষিত · সিদ্ধান্ত নেওয়ার জন্য অনুমোদিত কর্মকর্তার কারণ ও কর্তৃত্বের ভিত্তি প্রয়োজন।" : "Rule hearing-date/v1 · both active observations are preserved · resolution requires an authorised officer, cited evidence, authority basis, and reason."}</p><div className={styles.actions}><Button disabled>{lang === "bn" ? "সমাধান নথিভুক্ত করুন" : "Record resolution"}</Button><Button variant="secondary" onClick={() => setSelected(null)}>{lang === "bn" ? "কিউতে রাখুন" : "Keep in queue"}</Button></div><p className={styles.deferred}>{lang === "bn" ? "নিরাপদ রেজোলিউশন API এখনো Phase 2-তে; এই ডেমো বোতামটি তাই সংরক্ষণ দাবি করে না।" : "The authorised resolution API is scheduled for Phase 2, so this demo does not claim to save a decision."}</p></section></div> : null}
    </div>
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
