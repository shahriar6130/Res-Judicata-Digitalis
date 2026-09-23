"use client";

/* ------------------------------------------------------------------ *
 *  MediatorCaseWorkspace — the one connected mediator case page
 *  (§2 route: /mediator/cases/:caseId). Reuses the existing shared
 *  record (ApplicationRecord by Case ID), the safe-contact gate, the
 *  DLAO task engine, and the audit trail. No separate mediation app,
 *  no separate database: everything here reads/writes the single
 *  `shakkho.helpline.v1` store via lib/shakkho.
 * ------------------------------------------------------------------ */

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/language-toggle";
import {
  useHelplineStore,
  MediationService,
  SettlementDraftingService,
  SettlementSigningService,
  SafeContactService,
  AuditTrailService,
} from "@/lib/shakkho";
import { MEDIATION_STEPS } from "@/lib/shakkho/types";
import type {
  ClauseDisposition,
  MediationAttendanceRecord,
  MediationMatter,
  MediationParticipationMode,
  MediationSessionNotes,
  SettlementConsentChecklist,
} from "@/lib/shakkho/types";
import styles from "./mediation.module.css";

const ACTOR = "mediator";
type TabKey = "overview" | "parties" | "schedule" | "documents" | "attendance" | "session" | "draft" | "signing" | "history";

function stepStatus(matter: MediationMatter, states: string[]): "done" | "current" | "not_started" | "blocked" {
  const idx = MEDIATION_STEPS.findIndex((s) => s.states.includes(matter.state));
  const stepIdx = MEDIATION_STEPS.findIndex((s) => s.states[0] === states[0]);
  if (states.includes(matter.state)) return "current";
  if (idx > stepIdx) return "done";
  return "not_started";
}

export default function MediatorCaseWorkspace({ caseId }: { caseId: string }) {
  const { lang } = useI18n();
  const envelope = useHelplineStore();
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<TabKey>("overview");
  const [error, setError] = useState<string | null>(null);
  void tick;

  const record = envelope.records.find((r) => r.caseId === caseId);
  const matter = MediationService.findByCaseId(envelope, caseId);
  const bump = () => setTick((x) => x + 1);
  const say = (bn: string, en: string) => (lang === "bn" ? bn : en);

  function run<T>(fn: () => { ok: true; value: T } | { ok: false; error: string }) {
    const result = fn();
    if (!result.ok) setError(result.error);
    else { setError(null); bump(); }
    return result;
  }

  async function runAsync<T>(fn: () => Promise<{ ok: true; value: T } | { ok: false; error: string }>) {
    const result = await fn();
    if (!result.ok) setError(result.error);
    else { setError(null); bump(); }
    return result;
  }

  if (!matter) {
    return (
      <main className={styles.page}>
        <div className={styles.langRow}>
          <LanguageToggle />
        </div>
        <div className={styles.pageHeader}>
          <span className={styles.eyebrow}>{say("মধ্যস্থতা", "Mediation")}</span>
          <h1 className={styles.title}>{say("কোনো মধ্যস্থতা বিষয় পাওয়া যায়নি", "No mediation matter found")}</h1>
          <p className={styles.intro}>
            {say(
              `কেস ${caseId}-এর জন্য এখনো কোনো মধ্যস্থতা বিষয় নিবন্ধিত হয়নি।`,
              `No mediation matter is registered yet for case ${caseId}.`,
            )}
          </p>
          <Link href="/mediator" className={styles.backLink}>{say("← মধ্যস্থতাকারীর কর্মতালিকায় ফিরুন", "← Back to mediator worklist")}</Link>
        </div>
      </main>
    );
  }

  const sessions = MediationService.sessionsFor(envelope, matter.matterId).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const latestSession = sessions[sessions.length - 1];
  const drafts = SettlementDraftingService.forMatter(envelope, matter.matterId);
  const draft = drafts[drafts.length - 1];
  const signing = draft ? SettlementSigningService.forDraft(envelope, draft.draftId) : undefined;
  const auditEvents = AuditTrailService.listFor(envelope, matter.matterId);

  const nextAction = deriveNextAction(matter, draft, signing, lang);

  return (
    <div className={styles.caseShell}>
      <header className={styles.caseHeader}>
        <div className={styles.breadcrumbRow}>
          <div className={styles.breadcrumb}>
            {say("মধ্যস্থতা", "Mediation")} → {say("সক্রিয় বিষয়সমূহ", "Active Matters")} → {matter.caseId}
          </div>
          <LanguageToggle />
        </div>
        <div className={styles.headerTopRow}>
          <div>
            <h1 className={styles.title} style={{ margin: 0 }}>{matter.mediationReference} — {matter.matterCategory}</h1>
            <div className={styles.intro}>
              {say("কেস আইডি", "Case ID")}: <strong>{matter.caseId}</strong> · {matter.pathway === "pre_case" ? say("প্রাক-মামলা", "Pre-case") : say("মামলা-পরবর্তী", "Post-case")} · {say("দায়িত্বপ্রাপ্ত মধ্যস্থতাকারী", "Assigned mediator")}: {matter.assignedMediator}
            </div>
          </div>
          <div className={styles.primaryActions}>{renderPrimaryActions(matter, draft, signing, lang, run, tick, setTab)}</div>
        </div>
        <dl className={styles.headerFacts}>
          <div><dt>{say("বর্তমান অবস্থা", "Current state")}</dt><dd><span className={styles.pill}>{matter.state}</span></dd></div>
          <div><dt>{say("পরবর্তী অধিবেশন", "Next session")}</dt><dd>{latestSession ? new Date(latestSession.scheduledFor).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB") : "—"}</dd></div>
          <div><dt>{say("দায়িত্বপ্রাপ্ত", "Responsible actor")}</dt><dd>{matter.assignedMediator}</dd></div>
          <div><dt>{say("পরবর্তী প্রয়োজনীয় কাজ", "Next required action")}</dt><dd>{nextAction}</dd></div>
          <div><dt>{say("অংশগ্রহণ পদ্ধতি", "Mode")}</dt><dd>{matter.participationMode}</dd></div>
          <div><dt>{say("সর্বশেষ আপডেট", "Last updated")}</dt><dd>{new Date(matter.updatedAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}</dd></div>
        </dl>
      </header>

      {error && <div className={styles.blockBox} style={{ margin: "0 var(--page-pad)" }} role="alert">{error}</div>}

      <div className={styles.caseBody}>
        <nav className={styles.stepperCol} aria-label={say("মধ্যস্থতা অগ্রগতি", "Mediation progress")}>
          {MEDIATION_STEPS.map((step) => {
            const status = stepStatus(matter, step.states);
            const tabForStep: TabKey =
              step.key === "registration" ? "overview" :
              step.key === "parties" ? "parties" :
              step.key === "scheduling" ? "schedule" :
              step.key === "documents" ? "documents" :
              step.key === "attendance" ? "attendance" :
              step.key === "session" ? "session" :
              step.key === "draft" ? "draft" :
              step.key === "signing" ? "signing" : "signing";
            return (
              <button
                key={step.key}
                className={`${styles.stepperItem} ${tab === tabForStep ? styles.stepperItemActive : ""}`}
                onClick={() => setTab(tabForStep)}
              >
                <span className={`${styles.stepDot} ${status === "done" ? styles.stepDotDone : status === "current" ? styles.stepDotCurrent : ""}`} />
                {say(step.titleBn, step.titleEn)}
              </button>
            );
          })}
        </nav>

        <div className={styles.centerCol}>
          {tab === "overview" && <OverviewSection matter={matter} record={record} sessions={sessions} draft={draft} lang={lang} />}
          {tab === "parties" && <PartiesSection matter={matter} record={record} lang={lang} run={run} />}
          {tab === "schedule" && <ScheduleSection matter={matter} sessions={sessions} lang={lang} run={run} />}
          {tab === "documents" && <DocumentsSection matter={matter} lang={lang} run={run} />}
          {tab === "attendance" && <AttendanceSection matter={matter} session={latestSession} lang={lang} run={run} />}
          {tab === "session" && <SessionSection session={latestSession} lang={lang} run={run} />}
          {tab === "draft" && <DraftSection matter={matter} session={latestSession} draft={draft} lang={lang} run={run} />}
          {tab === "signing" && <SigningOutcomeSection matter={matter} draft={draft} signing={signing} lang={lang} run={run} runAsync={runAsync} />}
          {tab === "history" && <HistorySection matter={matter} auditEvents={auditEvents} lang={lang} />}
        </div>

        <aside className={styles.rightCol}>
          <div className={styles.rightPanel}>
            <span className={styles.sectionHeading}>{say("দায়িত্ব ও ইতিহাস", "Responsibility and history")}</span>
            <div className={styles.kv}><dt>{say("বর্তমান মালিক", "Current owner")}</dt><dd>{matter.assignedMediator}</dd></div>
            <div className={styles.kv}><dt>{say("পরবর্তী কাজ", "Next task")}</dt><dd>{nextAction}</dd></div>
            <div className={styles.kv}><dt>{say("অমীমাংসিত ধারা", "Unresolved clauses")}</dt><dd>{draft ? draft.clauses.filter((c) => c.disposition === "undisposed").length : "—"}</dd></div>
            <div className={styles.kv}><dt>{say("ব্লকিং অসঙ্গতি", "Blocking inconsistencies")}</dt><dd>{draft ? draft.inconsistencies.filter((i) => i.severity === "blocking").length : 0}</dd></div>
            <div className={styles.kv}><dt>{say("অপেক্ষমাণ নথি", "Pending documents")}</dt><dd>{matter.documentReviews.filter((d) => d.status !== "reviewed").length}</dd></div>
            <button className={styles.backLink} style={{ border: "none", background: "none", textAlign: "left", padding: 0 }} onClick={() => setTab("history")}>
              {say("সম্পূর্ণ অডিট ইতিহাস দেখুন →", "View full audit history →")}
            </button>
          </div>
          <div className={styles.rightPanel}>
            <span className={styles.sectionHeading}>{say("সাম্প্রতিক কার্যক্রম", "Recent activity")}</span>
            <div className={styles.timeline}>
              {[...matter.history].slice(-4).reverse().map((h, i) => (
                <div key={i} className={styles.timelineItem}>
                  <div>{h.toState}</div>
                  <div style={{ color: "var(--gray)" }}>{h.actor} · {new Date(h.at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function deriveNextAction(matter: MediationMatter, draft: ReturnType<typeof SettlementDraftingService.find>, signing: ReturnType<typeof SettlementSigningService.forDraft>, lang: "bn" | "en"): string {
  const say = (bn: string, en: string) => (lang === "bn" ? bn : en);
  switch (matter.state) {
    case "registered": return say("পক্ষের সাথে যোগাযোগ করুন", "Contact the parties");
    case "party_contact_pending": return say("যোগাযোগ সম্পন্ন করুন", "Complete party contact");
    case "scheduled": return say("নোটিশ পাঠান", "Send notices");
    case "notices_sent": return say("নথি পর্যালোচনা করুন", "Review documents");
    case "documents_under_review": return say("অধিবেশনের জন্য প্রস্তুত চিহ্নিত করুন", "Mark ready for session");
    case "ready_for_session": return say("উপস্থিতি রেকর্ড করুন", "Record attendance");
    case "attendance_confirmed": return say("অধিবেশন শুরু করুন", "Start the session");
    case "in_session": return say("অধিবেশন পরিচালনা করুন", "Run the session");
    case "adjourned": return say("পুনরায় সময়সূচী নির্ধারণ করুন", "Reschedule");
    case "no_show_rescheduled": return say("বিকল্প অধিবেশন নিশ্চিত করুন", "Confirm the fallback session");
    case "drafting": return say("খসড়া তৈরি করুন", "Generate the settlement draft");
    case "draft_under_review": return say("প্রতিটি ধারা পর্যালোচনা করুন", "Review every clause");
    case "party_review": return say("পক্ষের সম্মতি রেকর্ড করুন", "Record party consent");
    case "awaiting_signatures": return say("স্বাক্ষরের অপেক্ষায়", "Awaiting signatures");
    case "partially_signed": return say("অফলাইন স্বাক্ষর সিঙ্ক করুন", "Sync the offline signature");
    case "signed": return say("ফলাফল রেকর্ড করুন", "Record the outcome");
    case "outcome_recorded": return say("বিষয়টি বন্ধ করুন", "Close the matter");
    default: return say("—", "—");
  }
  void draft; void signing;
}

/*
 * Only a real state-changing action belongs here — anything that merely
 * jumps to a section (Contact parties, Prepare draft, Signing & outcome, …)
 * duplicated the left-hand progress stepper, which already navigates to
 * every section and shows the matter's current step. Removed.
 */
function renderPrimaryActions(
  matter: MediationMatter,
  draft: ReturnType<typeof SettlementDraftingService.find>,
  signing: ReturnType<typeof SettlementSigningService.forDraft>,
  lang: "bn" | "en",
  run: <T,>(fn: () => { ok: true; value: T } | { ok: false; error: string }) => unknown,
  tick: number,
  setTab: (t: TabKey) => void,
) {
  void tick; void signing; void setTab;
  const say = (bn: string, en: string) => (lang === "bn" ? bn : en);
  switch (matter.state) {
    case "outcome_recorded":
      return <button className={styles.btnSecondary} onClick={() => run(() => MediationService.closeMatter({ matterId: matter.matterId, actor: ACTOR }) ? { ok: true as const, value: true } : { ok: false as const, error: "" })}>{say("বিষয়টি বন্ধ করুন", "Close matter")}</button>;
    default:
      return null;
  }
  void draft;
}

/* ------------------------------- Overview ------------------------------- */
function OverviewSection({ matter, record, sessions, draft, lang }: { matter: MediationMatter; record: ReturnType<typeof useHelplineStore>["records"][number] | undefined; sessions: ReturnType<typeof MediationService.sessionsFor>; draft: ReturnType<typeof SettlementDraftingService.find>; lang: "bn" | "en" }) {
  const say = (bn: string, en: string) => (lang === "bn" ? bn : en);
  return (
    <div className={styles.section}>
      <span className={styles.sectionHeading}>{say("নিবন্ধন ও সারসংক্ষেপ", "Registration & summary")}</span>
      <div className={styles.grid2}>
        <div>
          <div className={styles.kv}><dt>{say("মধ্যস্থতা রেফারেন্স", "Mediation reference")}</dt><dd>{matter.mediationReference}</dd></div>
          <div className={styles.kv}><dt>{say("কেস আইডি", "Case ID")}</dt><dd>{matter.caseId}</dd></div>
          <div className={styles.kv}><dt>{say("আবেদনের উৎস", "Application source")}</dt><dd>{record?.channel ?? "—"} <span className={styles.provTag}>{record ? "staff-entered" : ""}</span></dd></div>
          <div className={styles.kv}><dt>{say("বিষয়ের ধরন", "Matter category")}</dt><dd>{matter.matterCategory}</dd></div>
          <div className={styles.kv}><dt>{say("পথ", "Pathway")}</dt><dd>{matter.pathway}</dd></div>
          {matter.referralSource && <div className={styles.kv}><dt>{say("রেফারেল উৎস", "Referral source")}</dt><dd>{matter.referralSource}</dd></div>}
          <div className={styles.kv}><dt>{say("নিবন্ধনের উৎস", "Registration source")}</dt><dd>{matter.registrationSource}</dd></div>
          <div className={styles.kv}><dt>{say("দায়িত্বপ্রাপ্ত মধ্যস্থতাকারী", "Assigned mediator")}</dt><dd>{matter.assignedMediator}</dd></div>
        </div>
        <div>
          <div className={styles.kv}><dt>{say("প্রতিনিধিত্ব", "Representation status")}</dt><dd>{matter.parties.some((p) => p.representedBy) ? say("এক বা একাধিক পক্ষ প্রতিনিধিত্বপ্রাপ্ত", "One or more parties represented") : say("সরাসরি", "Direct")}</dd></div>
          <div className={styles.kv}><dt>{say("নিরাপদ যোগাযোগ", "Safe-contact restrictions")}</dt><dd>{matter.parties.some((p) => p.safeContact) ? say("প্রযোজ্য", "Applies") : "—"}</dd></div>
          <div className={styles.kv}><dt>{say("পছন্দের ভাষা", "Preferred language")}</dt><dd>{matter.parties.map((p) => p.preferredLanguage ?? "bn").join(", ")}</dd></div>
          <div className={styles.kv}><dt>{say("বর্তমান পর্যায়", "Current stage")}</dt><dd>{matter.state}</dd></div>
          <div className={styles.kv}><dt>{say("পূর্ববর্তী অধিবেশন", "Previous sessions")}</dt><dd>{sessions.length}</dd></div>
          <div className={styles.kv}><dt>{say("পর্যালোচনার অপেক্ষায় নথি", "Documents awaiting review")}</dt><dd>{matter.documentReviews.filter((d) => d.status !== "reviewed").length}</dd></div>
          <div className={styles.kv}><dt>{say("ফলাফলের অবস্থা", "Outcome status")}</dt><dd>{matter.outcome ? matter.outcome.decision : say("অমীমাংসিত", "Pending")}</dd></div>
        </div>
      </div>
      <div className={styles.warnBox}>
        {say(
          "নিচের তথ্য বিদ্যমান কেস রেকর্ড থেকে পুনর্ব্যবহৃত — পুনরায় প্রবেশ করানো হয়নি। অনিশ্চিত/অযাচাইকৃত তথ্য এমনভাবে চিহ্নিত করা হয়েছে; নিশ্চিত তথ্য হিসেবে উপস্থাপন করা হয়নি।",
          "The information below is reused from the existing case record, not re-entered. Unconfirmed/unverified information is flagged as such, never presented as fact.",
        )}
      </div>
      {draft && (
        <div className={styles.kv}><dt>{say("সংযুক্ত নিষ্পত্তি খসড়া", "Attached settlement draft")}</dt><dd>{draft.draftId} — {draft.status}</dd></div>
      )}
    </div>
  );
}

/* ------------------------------- Parties ------------------------------- */
function PartiesSection({ matter, record, lang, run }: { matter: MediationMatter; record: ReturnType<typeof useHelplineStore>["records"][number] | undefined; lang: "bn" | "en"; run: <T,>(fn: () => { ok: true; value: T } | { ok: false; error: string }) => unknown }) {
  const say = (bn: string, en: string) => (lang === "bn" ? bn : en);
  return (
    <div className={styles.section}>
      <span className={styles.sectionHeading}>{say("পক্ষগণ", "Parties")}</span>
      {matter.parties.map((party) => {
        const evaluation = record ? SafeContactService.evaluate(record) : undefined;
        return (
          <div key={party.role} className={styles.partyCard}>
            <div className={styles.headerTopRow}>
              <strong>{party.name}</strong>
              <span className={styles.pill}>{party.role}</span>
            </div>
            <div className={styles.grid2}>
              <div>
                <div className={styles.kv}><dt>{say("পছন্দের ভাষা", "Preferred language")}</dt><dd>{party.preferredLanguage ?? "bn"}</dd></div>
                <div className={styles.kv}><dt>{say("প্রতিনিধি", "Representative")}</dt><dd>{party.representedBy ?? "—"}</dd></div>
                <div className={styles.kv}><dt>{say("অংশগ্রহণ পদ্ধতি", "Participation mode")}</dt><dd>{party.participationMode ?? "—"}</dd></div>
                <div className={styles.kv}><dt>{say("নোটিশের অবস্থা", "Notice status")}</dt><dd>{party.noticeStatus ?? "not_sent"}</dd></div>
                <div className={styles.kv}><dt>{say("উপস্থিতির অবস্থা", "Attendance status")}</dt><dd>{party.attendanceStatus ?? "pending"}</dd></div>
              </div>
              <div>
                <div className={styles.kv}><dt>{say("নিরাপদ যোগাযোগ নির্দেশনা", "Safe-contact instruction")}</dt><dd>{party.safeContact ?? "—"}</dd></div>
                <div className={styles.kv}><dt>{say("অনুমোদিত চ্যানেল", "Permitted channel")}</dt><dd>{evaluation?.cleared ? say("এসএমএস/সরাসরি", "SMS / in-person") : say("সীমাবদ্ধ", "Restricted")}</dd></div>
                <div className={styles.kv}><dt>{say("যোগাযোগের ফলাফল", "Contact result")}</dt><dd>{party.contactResult ?? "—"}</dd></div>
              </div>
            </div>
            <div className={styles.actionsRow}>
              <button
                className={styles.btnSecondary}
                onClick={() =>
                  run(() =>
                    MediationService.recordPartyContact({
                      matterId: matter.matterId,
                      partyRole: party.role,
                      application: record,
                      channel: "sms",
                      result: "reached",
                      actor: ACTOR,
                    }),
                  )
                }
              >
                {say("যোগাযোগ সম্পন্ন হিসেবে চিহ্নিত করুন", "Record contact attempt")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- Schedule & Notices ------------------------------- */
function ScheduleSection({ matter, sessions, lang, run }: { matter: MediationMatter; sessions: ReturnType<typeof MediationService.sessionsFor>; lang: "bn" | "en"; run: <T,>(fn: () => { ok: true; value: T } | { ok: false; error: string }) => unknown }) {
  const say = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const [date, setDate] = useState("");
  const [mode, setMode] = useState<MediationParticipationMode>("in_person");
  const [fallback, setFallback] = useState(true);
  const latest = sessions[sessions.length - 1];

  return (
    <div className={styles.section}>
      <span className={styles.sectionHeading}>{say("সময়সূচী নির্ধারণ", "Schedule a session")}</span>
      <div className={styles.field}>
        <label>{say("তারিখ ও সময়", "Date & time")}</label>
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className={styles.field}>
        <label>{say("অংশগ্রহণ পদ্ধতি", "Participation mode")}</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as MediationParticipationMode)}>
          <option value="in_person">{say("সরাসরি", "In-person")}</option>
          <option value="remote">{say("দূরবর্তী", "Remote")}</option>
          <option value="hybrid">{say("হাইব্রিড", "Hybrid")}</option>
        </select>
      </div>
      {mode !== "in_person" && (
        <div className={styles.warnBox}>
          {say(
            "নিশ্চিত করার আগে পক্ষের ডিভাইস প্রাপ্যতা, সংযোগ, ডিজিটাল সাক্ষরতা, ভাষা, প্রবেশযোগ্যতা, গোপনীয়তা এবং সরাসরি বিকল্পের প্রাপ্যতা পর্যালোচনা করুন। চূড়ান্ত সিদ্ধান্ত মধ্যস্থতাকারীর।",
            "Before confirming, review party device access, connectivity, digital literacy, language, accessibility, privacy, and availability of an in-person alternative. The mediator makes the final decision — it is never auto-selected.",
          )}
          <div className={styles.checklistRow} style={{ marginTop: "var(--s-2)" }}>
            <input type="checkbox" id="fallback" checked={fallback} onChange={(e) => setFallback(e.target.checked)} />
            <label htmlFor="fallback">{say("সরাসরি বিকল্প বিন্যস্ত করা হয়েছে", "In-person fallback configured")}</label>
          </div>
        </div>
      )}
      <div className={styles.actionsRow}>
        <button
          className={styles.btn}
          disabled={!date}
          onClick={() =>
            run(() =>
              MediationService.scheduleSession({
                matterId: matter.matterId,
                scheduledFor: new Date(date).toISOString(),
                expectedDurationMinutes: 60,
                mode,
                inPersonFallbackPlanned: mode === "in_person" ? true : fallback,
                actor: ACTOR,
              }),
            )
          }
        >
          {say("অধিবেশন নির্ধারণ করুন", "Schedule session")}
        </button>
      </div>

      <span className={styles.sectionHeading}>{say("নোটিশ", "Notices")}</span>
      {latest ? (
        <>
          <table className={styles.table}>
            <thead><tr><th>{say("প্রাপক", "Recipient")}</th><th>{say("চ্যানেল", "Channel")}</th><th>{say("ডেলিভারি অবস্থা", "Delivery state")}</th></tr></thead>
            <tbody>
              {latest.noticesSent.length === 0 && <tr><td colSpan={3}>{say("এখনো কোনো নোটিশ পাঠানো হয়নি।", "No notices sent yet.")}</td></tr>}
              {latest.noticesSent.map((n, i) => (
                <tr key={i}><td>{n.party}</td><td>{n.channel}</td><td><span className={styles.pill}>{n.deliveryState}</span></td></tr>
              ))}
            </tbody>
          </table>
          <div className={styles.actionsRow}>
            <button
              className={styles.btnSecondary}
              onClick={() =>
                run(() =>
                  MediationService.sendNotices({
                    sessionId: latest.sessionId,
                    parties: matter.parties.map((p) => ({ party: p.name, language: p.preferredLanguage ?? "bn" })),
                    actor: ACTOR,
                  }),
                )
              }
            >
              {say("নোটিশ পাঠান (সিমুলেটেড)", "Send notices (simulated)")}
            </button>
          </div>
        </>
      ) : (
        <p>{say("প্রথমে একটি অধিবেশন নির্ধারণ করুন।", "Schedule a session first.")}</p>
      )}
    </div>
  );
}

/* ------------------------------- Documents ------------------------------- */
function DocumentsSection({ matter, lang, run }: { matter: MediationMatter; lang: "bn" | "en"; run: <T,>(fn: () => { ok: true; value: T } | { ok: false; error: string }) => unknown }) {
  const say = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const [newDocId, setNewDocId] = useState("");
  return (
    <div className={styles.section}>
      <span className={styles.sectionHeading}>{say("নথিসমূহ", "Documents")}</span>
      <table className={styles.table}>
        <thead><tr><th>{say("নথি", "Document")}</th><th>{say("অবস্থা", "Status")}</th><th>{say("নোট", "Note")}</th><th></th></tr></thead>
        <tbody>
          {matter.documentReviews.length === 0 && <tr><td colSpan={4}>{say("কোনো নথি এখনো পর্যালোচনা হয়নি।", "No documents reviewed yet.")}</td></tr>}
          {matter.documentReviews.map((d) => (
            <tr key={d.documentId}>
              <td>{d.documentId}</td>
              <td><span className={styles.pill}>{d.status}</span></td>
              <td>{d.note ?? "—"}</td>
              <td>
                <div className={styles.actionsRow}>
                  <button className={styles.btnSecondary} onClick={() => run(() => MediationService.reviewDocument({ matterId: matter.matterId, documentId: d.documentId, status: "reviewed", actor: ACTOR }))}>{say("পর্যালোচিত", "Reviewed")}</button>
                  <button className={styles.btnSecondary} onClick={() => run(() => MediationService.reviewDocument({ matterId: matter.matterId, documentId: d.documentId, status: "unclear", note: say("অস্পষ্ট — অনুসরণকারী কাজ তৈরি হয়েছে", "Unclear — follow-up task created"), actor: ACTOR }))}>{say("অস্পষ্ট", "Unclear")}</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.field}>
        <label>{say("অনুপস্থিত নথি অনুরোধ করুন (আইডি)", "Request a missing document (ID)")}</label>
        <input value={newDocId} onChange={(e) => setNewDocId(e.target.value)} placeholder="DOC-..." />
      </div>
      <div className={styles.actionsRow}>
        <button
          className={styles.btn}
          disabled={!newDocId}
          onClick={() => {
            run(() => MediationService.reviewDocument({ matterId: matter.matterId, documentId: newDocId, status: "missing_requested", note: say("পক্ষের কাছ থেকে অনুরোধ করা হয়েছে", "Requested from party"), actor: ACTOR }));
            setNewDocId("");
          }}
        >
          {say("অনুপস্থিত হিসেবে চিহ্নিত করে কাজ তৈরি করুন", "Mark missing & create follow-up task")}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- Attendance ------------------------------- */
function AttendanceSection({ matter, session, lang, run }: { matter: MediationMatter; session: ReturnType<typeof MediationService.sessionsFor>[number] | undefined; lang: "bn" | "en"; run: <T,>(fn: () => { ok: true; value: T } | { ok: false; error: string }) => unknown }) {
  const say = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const [rows, setRows] = useState<MediationAttendanceRecord[]>(() =>
    matter.parties.map((p) => ({ party: p.name, role: p.role, attended: true, status: "present", represented: !!p.representedBy, identityCheck: "completed", interpreterPresent: false, accessibilitySupportProvided: false })),
  );
  if (!session) return <div className={styles.section}>{say("প্রথমে একটি অধিবেশন নির্ধারণ করুন।", "Schedule a session first.")}</div>;

  return (
    <div className={styles.section}>
      <span className={styles.sectionHeading}>{say("উপস্থিতি রেজিস্টার", "Attendance register")}</span>
      <table className={styles.table}>
        <thead><tr><th>{say("নাম", "Name")}</th><th>{say("ভূমিকা", "Role")}</th><th>{say("উপস্থিত", "Present")}</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.party}>
              <td>{r.party}</td>
              <td>{r.role}</td>
              <td>
                <input
                  type="checkbox"
                  checked={r.attended}
                  onChange={(e) => setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, attended: e.target.checked, status: e.target.checked ? "present" : "absent" } : row)))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.actionsRow}>
        <button className={styles.btn} onClick={() => run(() => MediationService.recordAttendance({ sessionId: session.sessionId, attendance: rows, actor: ACTOR }))}>
          {say("উপস্থিতি সংরক্ষণ করুন", "Save attendance")}
        </button>
        {session.mode !== "in_person" && (
          <button className={styles.btnDanger} onClick={() => run(() => MediationService.recordAttendance({ sessionId: session.sessionId, attendance: rows, connectionFailed: true, actor: ACTOR }))}>
            {say("সংযোগ ব্যর্থতা — সরাসরি বিকল্পে যান", "Connection failure — fall back to in-person")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Session ------------------------------- */
function SessionSection({ session, lang, run }: { session: ReturnType<typeof MediationService.sessionsFor>[number] | undefined; lang: "bn" | "en"; run: <T,>(fn: () => { ok: true; value: T } | { ok: false; error: string }) => unknown }) {
  const say = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const [notes, setNotes] = useState<Omit<MediationSessionNotes, "author" | "updatedAt" | "version">>({
    issuesIdentified: "", documentsConsidered: "", agreedFacts: "", disputedFacts: "", proposedTerms: "", unresolvedTerms: "", followUpRequirements: "", sessionResult: "",
  });
  if (!session) return <div className={styles.section}>{say("প্রথমে একটি অধিবেশন নির্ধারণ করুন।", "Schedule a session first.")}</div>;

  const remote = session.mode !== "in_person";

  return (
    <div className={styles.section}>
      <span className={styles.sectionHeading}>{remote ? say("রিমোট/হাইব্রিড অধিবেশন সিমুলেটর", "Remote/Hybrid Session Simulator") : say("মধ্যস্থতা অধিবেশন", "Mediation session")}</span>
      <div className={styles.kv}><dt>{say("অবস্থা", "Status")}</dt><dd><span className={styles.pill}>{session.status}</span></dd></div>
      {remote && <div className={styles.kv}><dt>{say("সংযোগের অবস্থা", "Connection status")}</dt><dd>{session.connectionStatus}</dd></div>}
      <div className={styles.actionsRow}>
        <button className={styles.btnSecondary} onClick={() => run(() => MediationService.sessionAction({ sessionId: session.sessionId, action: "start", actor: ACTOR }))}>{say("শুরু করুন", "Start")}</button>
        <button className={styles.btnSecondary} onClick={() => run(() => MediationService.sessionAction({ sessionId: session.sessionId, action: "pause", actor: ACTOR }))}>{say("বিরতি", "Pause")}</button>
        {remote && <button className={styles.btnSecondary} onClick={() => run(() => MediationService.sessionAction({ sessionId: session.sessionId, action: "mark_connection_failure", actor: ACTOR }))}>{say("সংযোগ ব্যর্থতা চিহ্নিত করুন", "Mark connection failure")}</button>}
        {remote && <button className={styles.btnDanger} onClick={() => run(() => MediationService.sessionAction({ sessionId: session.sessionId, action: "switch_to_in_person", actor: ACTOR }))}>{say("সরাসরি বিকল্পে যান", "Switch to in-person")}</button>}
        <button className={styles.btnSecondary} onClick={() => run(() => MediationService.sessionAction({ sessionId: session.sessionId, action: "adjourn", actor: ACTOR }))}>{say("মুলতবি", "Adjourn")}</button>
        <button className={styles.btn} onClick={() => run(() => MediationService.sessionAction({ sessionId: session.sessionId, action: "end", actor: ACTOR }))}>{say("শেষ করুন", "End session")}</button>
      </div>

      <span className={styles.sectionHeading}>{say("মধ্যস্থতাকারীর নোট (কাঠামোগত)", "Mediator notes (structured)")}</span>
      {(Object.keys(notes) as (keyof typeof notes)[]).map((key) => (
        <div className={styles.field} key={key}>
          <label>{key}</label>
          <textarea rows={2} value={notes[key]} onChange={(e) => setNotes((prev) => ({ ...prev, [key]: e.target.value }))} />
        </div>
      ))}
      <div className={styles.actionsRow}>
        <button className={styles.btn} onClick={() => run(() => MediationService.saveSessionNotes({ sessionId: session.sessionId, notes, actor: ACTOR }))}>{say("নোট সংরক্ষণ করুন", "Save notes")}</button>
      </div>
      <p className={styles.intro}>{say("এই নোটগুলো নাগরিক পৃষ্ঠা বা সাধারণ অনুসন্ধানে স্বয়ংক্রিয়ভাবে প্রদর্শিত হয় না।", "These notes never automatically appear on citizen pages or in general search.")}</p>
    </div>
  );
}

/* ------------------------------- Settlement Draft (T7) ------------------------------- */
function DraftSection({ matter, session, draft, lang, run }: { matter: MediationMatter; session: ReturnType<typeof MediationService.sessionsFor>[number] | undefined; draft: ReturnType<typeof SettlementDraftingService.find>; lang: "bn" | "en"; run: <T,>(fn: () => { ok: true; value: T } | { ok: false; error: string }) => unknown }) {
  const say = (bn: string, en: string) => (lang === "bn" ? bn : en);

  if (!draft) {
    return (
      <div className={styles.section}>
        <span className={styles.sectionHeading}>{say("নিষ্পত্তি খসড়া সহায়ক — শুধুমাত্র খসড়া", "Settlement Drafting Assistant — Draft Only")}</span>
        <p>{say("এটি কোনো এআই আইনজীবী বা স্বয়ংক্রিয় নিষ্পত্তি সিদ্ধান্ত নয়।", "This is not an AI lawyer or an automated settlement decision.")}</p>
        <button
          className={styles.btn}
          disabled={!session}
          onClick={() =>
            run(() => {
              const generated = SettlementDraftingService.generateDraft({
                matterId: matter.matterId,
                caseId: matter.caseId,
                category: matter.matterCategory,
                mediatorNotes: session?.mediatorNotes ?? "",
                partyNames: matter.parties.map((p) => p.name),
                actor: ACTOR,
              });
              MediationService.attachSettlementDraft({ matterId: matter.matterId, draftId: generated.draftId, actor: ACTOR });
              return { ok: true as const, value: generated };
            })
          }
        >
          {say("মধ্যস্থতাকারীর নোট থেকে খসড়া তৈরি করুন", "Generate draft from mediator notes")}
        </button>
      </div>
    );
  }

  const allDisposed = SettlementDraftingService.allRequiredClausesDisposed(draft);
  const blocking = SettlementDraftingService.hasBlockingInconsistency(draft);

  return (
    <div className={styles.section}>
      <span className={styles.sectionHeading}>{say("নিষ্পত্তি খসড়া সহায়ক — শুধুমাত্র খসড়া", "Settlement Drafting Assistant — Draft Only")}</span>
      <div className={styles.warnBox}>{lang === "bn" ? draft.formalityWarning.bn : draft.formalityWarning.en}</div>

      {draft.inconsistencies.map((inc, i) => (
        <div key={i} className={styles.inconsistency}>
          <strong>{say("অসঙ্গতি সনাক্ত হয়েছে", "Inconsistency detected")}</strong> ({inc.severity}) — {lang === "bn" ? inc.description.bn : inc.description.en}
          <div>{say("সংশ্লিষ্ট ধারা", "Affected clauses")}: {inc.clauseIds.join(", ")}</div>
        </div>
      ))}

      {draft.clauses.map((clause) => (
        <div key={clause.clauseId} className={`${styles.clause} ${clause.origin === "template" ? styles.clauseTemplate : clause.origin === "ai_inferred" ? styles.clauseAiInferred : styles.clauseHumanEdited}`}>
          <div className={styles.clauseTitle}>
            {lang === "bn" ? clause.titleBn : clause.titleEn}
            <span className={styles.originBadge}>{clause.origin}</span>
            <span className={styles.pill}>{clause.disposition}</span>
          </div>
          <div>{lang === "bn" ? clause.bodyBn : clause.bodyEn}</div>
          {clause.sourceNote && <div style={{ color: "var(--gray)", fontSize: "var(--t-label)" }}>{clause.sourceNote}</div>}
          {draft.status === "draft" || draft.status === "human_reviewed" ? (
            <div className={styles.actionsRow}>
              {(["accept", "edit", "reject", "request_clarification", "mark_unresolved"] as ClauseDisposition[]).map((d) => (
                <button key={d} className={styles.btnSecondary} onClick={() => run(() => SettlementDraftingService.dispositionClause({ draftId: draft.draftId, clauseId: clause.clauseId, disposition: d, actor: ACTOR }))}>
                  {d}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}

      <div className={styles.actionsRow}>
        {draft.status === "draft" && (
          <button className={styles.btn} disabled={!allDisposed} onClick={() => run(() => { const r = SettlementDraftingService.submitForReview({ draftId: draft.draftId, reviewer: ACTOR }); return r ? { ok: true as const, value: r } : { ok: false as const, error: "" }; })}>
            {say("মানবিক পর্যালোচনা জমা দিন", "Submit for human review")}
          </button>
        )}
        {draft.status === "human_reviewed" && (
          <button className={styles.btn} disabled={!allDisposed || blocking} onClick={() => { run(() => SettlementDraftingService.requestPartyConsent({ draftId: draft.draftId, actor: ACTOR })); MediationService.markPartyReview({ matterId: matter.matterId, actor: ACTOR }); }}>
            {say("পক্ষের সম্মতির জন্য পাঠান", "Send for party consent")}
          </button>
        )}
        {!allDisposed && <span className={styles.errorNote}>{say("পার্টি পর্যালোচনায় যাওয়ার আগে প্রতিটি প্রয়োজনীয় ধারা নিষ্পত্তি করতে হবে।", "Every required clause must be dispositioned before moving to party review.")}</span>}
      </div>

      {draft.status === "party_consent_pending" && (
        <ConsentPanel matter={matter} draft={draft} lang={lang} run={run} />
      )}
    </div>
  );
}

function ConsentPanel({ matter, draft, lang, run }: { matter: MediationMatter; draft: NonNullable<ReturnType<typeof SettlementDraftingService.find>>; lang: "bn" | "en"; run: <T,>(fn: () => { ok: true; value: T } | { ok: false; error: string }) => unknown }) {
  const say = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const checklistLabels: { key: keyof SettlementConsentChecklist; bn: string; en: string }[] = [
    { key: "languageRecorded", bn: "ব্যবহৃত ভাষা রেকর্ড করা হয়েছে", en: "Language used is recorded" },
    { key: "plainLanguageExplanationProvided", bn: "সহজ ভাষায় ব্যাখ্যা প্রদান করা হয়েছে", en: "Plain-language explanation provided" },
    { key: "interpreterOrAccessibilitySupportRecorded", bn: "দোভাষী/প্রবেশযোগ্যতা সহায়তা রেকর্ড করা হয়েছে", en: "Interpreter or accessibility support recorded" },
    { key: "questionsAndClarificationsRecorded", bn: "প্রশ্ন ও স্পষ্টীকরণ রেকর্ড করা হয়েছে", en: "Questions and clarifications recorded" },
    { key: "voluntaryConsentRecorded", bn: "স্বেচ্ছামূলক সম্মতি রেকর্ড করা হয়েছে", en: "Voluntary consent recorded" },
    { key: "unresolvedIssuesCleared", bn: "অমীমাংসিত বিষয় সমাধান হয়েছে", en: "Unresolved issues cleared" },
    { key: "humanLegalReviewCompleted", bn: "মানবিক আইনি পর্যালোচনা সম্পন্ন", en: "Human legal review completed" },
    { key: "requiredFormalitiesMarked", bn: "প্রয়োজনীয় আনুষ্ঠানিকতা চিহ্নিত", en: "Required formalities marked" },
  ];
  return (
    <div className={styles.section}>
      <span className={styles.sectionHeading}>{say("পক্ষের বোঝাপড়া ও সম্মতি যাচাই তালিকা", "Party understanding & consent checklist")}</span>
      {checklistLabels.map((item) => (
        <div key={item.key} className={styles.checklistRow}>
          <input
            type="checkbox"
            id={item.key}
            checked={draft.consentChecklist[item.key]}
            onChange={(e) => run(() => SettlementDraftingService.updateConsentChecklist({ draftId: draft.draftId, checklist: { [item.key]: e.target.checked }, actor: ACTOR }))}
          />
          <label htmlFor={item.key}>{say(item.bn, item.en)}</label>
        </div>
      ))}
      {draft.consent.map((c) => (
        <div key={c.party} className={styles.kv}>
          <dt>{c.party}</dt>
          <dd>
            {c.consented ? say("সম্মত", "Consented") : (
              <button className={styles.btnSecondary} onClick={() => run(() => SettlementDraftingService.recordPartyConsent({ draftId: draft.draftId, party: c.party, consented: true, method: "in_person_read_back", actor: ACTOR }))}>
                {say("সম্মতি রেকর্ড করুন", "Record consent")}
              </button>
            )}
          </dd>
        </div>
      ))}
      {draft.status === "party_consented" && (
        <button
          className={styles.btn}
          onClick={async () => {
            const result = await SettlementDraftingService.finalize({ draftId: draft.draftId, actor: ACTOR });
            if (!result.ok) return;
            MediationService.markAwaitingSignatures({ matterId: matter.matterId, actor: ACTOR });
            if (result.value.frozenTextHash) {
              SettlementSigningService.openForSigning({ draftId: draft.draftId, matterId: matter.matterId, caseId: matter.caseId, documentHash: result.value.frozenTextHash, parties: draft.consent.map((c) => c.party), actor: ACTOR });
            }
          }}
        >
          {say("খসড়া জমাট করে স্বাক্ষরের জন্য পাঠান", "Freeze draft & send to signing")}
        </button>
      )}
    </div>
  );
}

/* ------------------------------- Signing & Outcome (T11) ------------------------------- */
function SigningOutcomeSection({ matter, draft, signing, lang, run, runAsync }: { matter: MediationMatter; draft: ReturnType<typeof SettlementDraftingService.find>; signing: ReturnType<typeof SettlementSigningService.forDraft>; lang: "bn" | "en"; run: <T,>(fn: () => { ok: true; value: T } | { ok: false; error: string }) => unknown; runAsync: <T,>(fn: () => Promise<{ ok: true; value: T } | { ok: false; error: string }>) => unknown }) {
  const say = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const [decision, setDecision] = useState<"settled" | "not_settled" | "partial">("settled");
  const [nextActionSummary, setNextActionSummary] = useState("");

  return (
    <div className={styles.section}>
      <span className={styles.sectionHeading}>{say("ই-স্বাক্ষর (T11) অবস্থা", "E-signature (T11) status")}</span>
      {!signing && <p>{say("খসড়া এখনো স্বাক্ষরের জন্য পাঠানো হয়নি।", "The draft hasn't been sent to signing yet.")}</p>}
      {signing && (
        <>
          <div className={styles.kv}><dt>{say("নথির সংস্করণ", "Document version")}</dt><dd>{signing.documentVersion}</dd></div>
          <div className={styles.kv}><dt>{say("নথির হ্যাশ", "Document hash")}</dt><dd style={{ fontFamily: "monospace", fontSize: "10px" }}>{signing.documentHash.slice(0, 24)}…</dd></div>
          {signing.parties.map((p) => (
            <div key={p.party} className={styles.partyCard}>
              <div className={styles.kv}><dt>{p.party}</dt><dd><span className={styles.pill}>{p.status}</span></dd></div>
              {p.status === "not_started" && (
                <div className={styles.actionsRow}>
                  <button className={styles.btnSecondary} onClick={() => runAsync(() => SettlementSigningService.sign({ signingId: signing.signingId, party: p.party, offline: false, actor: ACTOR }))}>{say("অনলাইনে স্বাক্ষর করুন", "Sign online")}</button>
                  <button className={styles.btnSecondary} onClick={() => runAsync(() => SettlementSigningService.sign({ signingId: signing.signingId, party: p.party, offline: true, actor: ACTOR }))}>{say("অফলাইনে স্বাক্ষর করুন", "Sign offline")}</button>
                </div>
              )}
              {p.status === "signed_offline_pending_sync" && (
                <button className={styles.btnSecondary} onClick={() => run(() => SettlementSigningService.syncOfflineSignature({ signingId: signing.signingId, party: p.party, currentDocumentHash: signing.documentHash, actor: ACTOR }))}>
                  {say("সংযোগ ফিরেছে — সিঙ্ক করুন", "Connectivity returned — sync")}
                </button>
              )}
            </div>
          ))}
          {signing.parties.every((p) => p.status === "signed_online" || p.status === "synced") && signing.status !== "fully_synced_and_verified" && (
            <button className={styles.btn} onClick={() => { run(() => SettlementSigningService.verifyIntegrity({ signingId: signing.signingId, currentDocumentHash: signing.documentHash, actor: ACTOR })); MediationService.markSigned({ matterId: matter.matterId, actor: ACTOR }); }}>
              {say("স্বাক্ষর ও নথি যাচাই করুন", "Verify signatures & document")}
            </button>
          )}
          {signing.status === "fully_synced_and_verified" && <div className={styles.okBox}>{say("✓ স্বাক্ষর ও নথির অখণ্ডতা যাচাই সম্পন্ন।", "✓ Signatures and document integrity verified.")}</div>}
          <div className={styles.warnBox}>
            {say(
              "ক্রিপ্টোগ্রাফিক যাচাইকরণ স্বাক্ষর ও নথির অখণ্ডতা নিশ্চিত করে। এটি নিজে থেকে পরিচয়, সক্ষমতা, অবগত সম্মতি, আইনি বৈধতা বা প্রয়োগযোগ্যতা প্রতিষ্ঠা করে না।",
              "Cryptographic verification confirms signature and document integrity. It does not by itself establish identity, capacity, informed consent, legal validity or enforceability.",
            )}
          </div>
        </>
      )}

      <span className={styles.sectionHeading}>{say("ফলাফল", "Outcome")}</span>
      {matter.outcome ? (
        <div className={styles.okBox}>
          {say("রেকর্ড হয়েছে", "Recorded")}: {matter.outcome.decision} — {matter.outcome.humanApprovedBy} ({new Date(matter.outcome.recordedAt).toLocaleString()})
        </div>
      ) : (
        <>
          <div className={styles.field}>
            <label>{say("সিদ্ধান্ত", "Decision")}</label>
            <select value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
              <option value="settled">{say("নিষ্পত্তি হয়েছে", "Settled")}</option>
              <option value="partial">{say("আংশিক নিষ্পত্তি", "Partially settled")}</option>
              <option value="not_settled">{say("নিষ্পত্তি হয়নি", "No settlement")}</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>{say("পরবর্তী কাজ সারাংশ", "Next-action summary")}</label>
            <input value={nextActionSummary} onChange={(e) => setNextActionSummary(e.target.value)} placeholder={say("যেমন: পরিপালন যাচাই করুন", "e.g. verify compliance")} />
          </div>
          {decision === "settled" && signing?.status !== "fully_synced_and_verified" && (
            <p className={styles.warnBox}>
              {say(
                "\"নিষ্পত্তি হয়েছে\" ফলাফল রেকর্ড করার আগে নিষ্পত্তিপত্রটি অবশ্যই সম্পূর্ণভাবে স্বাক্ষরিত ও যাচাইকৃত হতে হবে (উপরে \"ই-স্বাক্ষর (T11) অবস্থা\" দেখুন) — একজন মানুষ কখনো একটি অস্বাক্ষরিত নিষ্পত্তি নিশ্চিত করতে পারবেন না।",
                "A \"Settled\" outcome can't be recorded until the settlement is fully signed and verified (see \"E-signature (T11) status\" above) — a human is never allowed to confirm an unsigned settlement.",
              )}
            </p>
          )}
          <button
            className={styles.btn}
            disabled={decision === "settled" && signing?.status !== "fully_synced_and_verified"}
            onClick={() =>
              run(() =>
                MediationService.recordOutcome({
                  matterId: matter.matterId,
                  decision,
                  recordedBy: ACTOR,
                  humanApprovedBy: ACTOR,
                  settlementDraftId: draft?.draftId,
                  settlementSigned: signing?.status === "fully_synced_and_verified",
                  nextActionSummary: nextActionSummary || say("পরবর্তী পদক্ষেপ নির্ধারণ করুন", "Determine next step"),
                  responsibleActor: ACTOR,
                }),
              )
            }
          >
            {say("মানবিক ফলাফল রেকর্ড করুন", "Record human outcome")}
          </button>
          <p className={styles.intro}>{say("ফলাফল রেকর্ড করা মূল আইনি সহায়তা কেসটি স্বয়ংক্রিয়ভাবে বন্ধ করে না।", "Recording an outcome does not automatically close the parent legal-aid case.")}</p>
        </>
      )}
    </div>
  );
}

/* ------------------------------- History ------------------------------- */
function HistorySection({ matter, auditEvents, lang }: { matter: MediationMatter; auditEvents: ReturnType<typeof AuditTrailService.listFor>; lang: "bn" | "en" }) {
  const say = (bn: string, en: string) => (lang === "bn" ? bn : en);
  return (
    <div className={styles.section}>
      <span className={styles.sectionHeading}>{say("সম্পূর্ণ অডিট ইতিহাস", "Complete audit history")}</span>
      <table className={styles.table}>
        <thead><tr><th>{say("সময়", "Time")}</th><th>{say("কর্ম", "Action")}</th><th>{say("অভিনেতা", "Actor")}</th></tr></thead>
        <tbody>
          {[...auditEvents].reverse().map((e) => (
            <tr key={e.id}><td>{new Date(e.occurredAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}</td><td>{e.action}</td><td>{e.actor}</td></tr>
          ))}
        </tbody>
      </table>
      <p className={styles.intro}>{say(`মোট ${auditEvents.length}টি নিরীক্ষা ঘটনা; ${matter.history.length}টি বিষয়-স্তরের রূপান্তর।`, `${auditEvents.length} audit events total; ${matter.history.length} matter-level transitions.`)}</p>
    </div>
  );
}
