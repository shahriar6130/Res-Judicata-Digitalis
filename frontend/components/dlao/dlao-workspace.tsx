"use client";

/* ------------------------------------------------------------------ *
 *  /dashboard/dlo — Step 2 · Verification & Eligibility
 *  (DLAO / SCLAC / LLAC). Everything is read from and written to the
 *  shared record in localStorage["dlas.db.v1"] via DlaoReviewService.
 *
 *  Hash routes:  #overview · #new · #review · #decided · #tasks · #app/<APP-ID>
 * ------------------------------------------------------------------ */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import {
  DISTRICTS,
  CONTACT_METHODS,
  DOC_TYPES,
  DlaoReviewService,
  MATTERS,
  SAFE_TIMES,
  URGENCY_FLAGS,
  factChecklist,
  label,
  nidFormatValid,
  officeCode,
  pathwayLabel,
  safeTimeLabel,
  subStage,
  useDlasDb,
  useEligibilityRuleset,
  useOfficeQueue,
  useStoredFile,
  DlaoLawyerService,
  activeAssignment,
  formatDateTime,
  hearingMissed,
  hearingState,
  activeShortlist,
  useClock,
  useLawyerDeadlineSweep,
  useLawyerRules,
  type ApplicationRecord,
  type DocType,
  type DocumentRef,
  type FactStatus,
  type IdentityOutcome,
  incidentLabel,
  incidentOf,
  isRedFlagged,
  groupOf,
  openDuplicateFor,
} from "@/lib/dlas";
import styles from "@/components/dlas/dlas.module.css";
import { DocViewButton } from "@/components/dlas/doc-viewer";
import { OfficeAnalytics } from "./dlao-analytics";
import { LawyerDetail, LawyersMonitor } from "./dlao-lawyers";
import { MediatorDetail, MediatorsRegistry } from "./dlao-mediators";
import { LegalPathway, PathwayDecisionRecord } from "./legal-pathway";
import { MediatorAssignPanel } from "./mediator-assign";
import { MediationMonitor, MediationRecordPanel } from "./mediation-record";
import { OfficeControlCenter } from "./office-control";
import { CaseActivityTrail } from "./case-activity";
import { CaseTransferPanel, CaseTransfers } from "./case-transfer";
import { OfficeNoticeBar, TransferBanner, TransferTag } from "./office-notices";
import { IncidentFlagBanner } from "./incident-flag";
import { AiSummary } from "@/components/dlas/ai-summary";
import { CaseGroupBanner, IncidentGroupDetail, IncidentGroups } from "./incident-groups";
import { DuplicateBanner, DuplicateCheck } from "./duplicate-check";
import { DistrictCases, UrgentCases } from "./district-cases";
import { MediationLifecycleView } from "@/components/demo/lifecycle-timeline";
import ui from "./dlao.module.css";

type QueueView = "overview" | "new" | "review" | "decided" | "tasks";
type View = { kind: "list"; bucket: QueueView } | { kind: "app"; id: string } | { kind: "lawyers" } | { kind: "lawyer"; id: string } | { kind: "mediators" } | { kind: "mediationMonitor" } | { kind: "districtCases" } | { kind: "urgent" } | { kind: "transfers" } | { kind: "groups" } | { kind: "group"; id: string } | { kind: "duplicates" } | { kind: "mediator"; id: string; tab: string };

function parseHash(h: string): View {
  const raw = h.replace(/^#/, "");
  if (raw.startsWith("app/")) return { kind: "app", id: decodeURIComponent(raw.slice(4)) };
  if (raw === "lawyers") return { kind: "lawyers" };
  if (raw === "mediators") return { kind: "mediators" };
  if (raw === "mediation-monitor") return { kind: "mediationMonitor" };
  if (raw === "cases") return { kind: "districtCases" };
  if (raw === "urgent") return { kind: "urgent" };
  if (raw === "transfers") return { kind: "transfers" };
  if (raw === "groups") return { kind: "groups" };
  if (raw === "duplicates") return { kind: "duplicates" };
  if (raw.startsWith("group/")) return { kind: "group", id: decodeURIComponent(raw.slice(6)) };
  if (raw === "mediators/new") return { kind: "mediators" }; // adding mediators is self sign-up only
  if (raw.startsWith("mediator/")) {
    const [id, tab] = raw.slice(9).split("/");
    return { kind: "mediator", id: decodeURIComponent(id), tab: tab ?? "overview" };
  }
  if (raw.startsWith("lawyer/")) return { kind: "lawyer", id: decodeURIComponent(raw.slice(7)) };
  if (raw === "tasks") return { kind: "list", bucket: "overview" }; // the open-tasks view was removed
  if (raw === "new" || raw === "review" || raw === "decided") return { kind: "list", bucket: raw };
  return { kind: "list", bucket: "overview" };
}

const noop = () => () => {};

function useHashView(): View {
  const hash = useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => window.location.hash,
    () => "",
  );
  return parseHash(hash);
}

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

const STAGE_LABEL: Record<string, { bn: string; en: string }> = {
  RECEIVED: { bn: "প্রাপ্ত — শুরু হয়নি", en: "Received — not started" },
  IDENTITY: { bn: "পরিচয় যাচাই", en: "Identity check" },
  IDENTITY_BLOCKED: { bn: "পরিচয় — আটকে আছে", en: "Identity — blocked" },
  FACTS: { bn: "নথি ও তথ্য যাচাই", en: "Documents & facts" },
  FACTS_BLOCKED: { bn: "তথ্য — আটকে আছে", en: "Facts — blocked" },
  ELIGIBILITY: { bn: "যোগ্যতা মূল্যায়ন", en: "Eligibility assessment" },
  AWAITING_DECISION: { bn: "সিদ্ধান্তের অপেক্ষায়", en: "Awaiting officer decision" },
  CASE_OPENED: { bn: "গৃহীত — পথ বাছাই বাকি", en: "Accepted — choose pathway" },
  PATHWAY_GRAM_ADALAT: { bn: "গ্রাম আদালতে প্রেরিত", en: "Sent to Gram Adalat" },
  PATHWAY_MEDIATION: { bn: "মধ্যস্থতায় প্রেরিত", en: "Sent to mediation" },
  PATHWAY_LAWYER: { bn: "আইনজীবীর কাছে প্রেরিত", en: "Sent to panel lawyer" },
  REJECTED: { bn: "বাতিল — বন্ধ", en: "Rejected — closed" },
};

/* ------------------------------ small UI pieces ------------------------------ */

type Tone = "ok" | "err" | "warn" | "ink" | "neutral";

function Tag({ tone = "neutral", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <span className={`${ui.tag} ${tone !== "neutral" ? ui[tone] : ""}`} title={title}>
      {children}
    </span>
  );
}

const pretty = (code: string) => {
  const t = code.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function provTone(source: string | undefined): Tone {
  if (source === "OFFICER_VERIFIED") return "ok";
  if (source === "AI_INFERRED" || source === "REPRESENTATIVE_REPORTED") return "warn";
  return "neutral";
}

/** Where a value came from — green once an officer has verified it. */
function Prov({ a, path }: { a: ApplicationRecord; path: string }) {
  const p = a.provenance[path];
  if (!p) return null;
  return (
    <Tag tone={provTone(p.source)} title={p.note ?? undefined}>
      {p.source === "OFFICER_VERIFIED" ? "✓ " : ""}
      {pretty(p.source)}
    </Tag>
  );
}

function statusTone(s: ApplicationRecord["status"]): Tone {
  if (s === "ACCEPTED") return "ok";
  if (s === "REJECTED" || s === "WITHDRAWN" || s === "CLOSED") return "err";
  if (s === "INFO_REQUESTED") return "err";
  if (s === "UNDER_REVIEW") return "warn";
  return "neutral";
}

function Row({ label: l, children }: { label: string; children: ReactNode }) {
  return (
    <div className={ui.row}>
      <div className={ui.rowLabel}>{l}</div>
      <div className={ui.rowValue}>{children}</div>
    </div>
  );
}

function WorkFact({ name, children }: { name: string; children: ReactNode }) {
  return <div className={ui.workFact}><dt>{name}</dt><dd>{children}</dd></div>;
}

function Banner({ tone, icon, children }: { tone: "ok" | "warn" | "err"; icon: string; children: ReactNode }) {
  const cls = tone === "ok" ? ui.bannerOk : tone === "err" ? ui.bannerErr : ui.bannerWarn;
  return (
    <div className={`${ui.banner} ${cls}`} role={tone === "err" ? "alert" : undefined}>
      <span className={ui.bannerIcon} aria-hidden>
        {icon}
      </span>
      <div>{children}</div>
    </div>
  );
}

/** UNVERIFIED until the officer has checked identity (incl. NID), documents and case facts. */
function VerifiedBadge({ a }: { a: ApplicationRecord }) {
  const { lang } = useI18n();
  const ok = !!a.review?.verifiedAt;
  return (
    <Tag tone={ok ? "ok" : "warn"} title={ok ? new Date(a.review!.verifiedAt!).toLocaleString() : undefined}>
      {ok ? (lang === "bn" ? "✓ যাচাইকৃত" : "✓ Verified") : lang === "bn" ? "অযাচাইকৃত" : "Unverified"}
    </Tag>
  );
}

/** Officer-viewable copy of an uploaded document (localStorage["dlas.files.v1"]). Missing copies say so. */
function DocPreview({ doc }: { doc: DocumentRef }) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const f = useStoredFile(doc.docId);
  if (doc.status !== "ATTACHED") return <div className={ui.missing}>{tx("ফাইল এখনো জমা হয়নি", "File not submitted yet")}</div>;
  if (!f) {
    return (
      <div className={ui.missing}>
        {doc.preview === "TOO_LARGE"
          ? tx("ফাইলটি এখানে দেখানোর জন্য খুব বড় — মূল কপি অফিসে দেখুন।", "Too large to preview here — inspect the original at the office.")
          : tx("এই ডিভাইসে দেখার কপি নেই — মূল কপি দেখুন।", "No viewable copy on this device — inspect the original.")}
      </div>
    );
  }
  if (f.mime.startsWith("image/")) {
    return (
      <a href={f.dataUrl} target="_blank" rel="noreferrer" title={tx("বড় করে দেখুন", "Open full size")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={ui.preview} src={f.dataUrl} alt={doc.fileName ?? doc.type} />
      </a>
    );
  }
  if (f.mime === "application/pdf") return <iframe className={ui.previewFrame} src={f.dataUrl} title={doc.fileName ?? doc.type} />;
  return (
    <a className={ui.link} href={f.dataUrl} download={doc.fileName ?? doc.docId}>
      {tx("ফাইল খুলুন", "Open file")} ({f.mime})
    </a>
  );
}

/* ================================================================== */

export function DlaoWorkspace() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const { lang } = useI18n();
  const router = useRouter();
  const q = useOfficeQueue();
  const view = useHashView();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  useLawyerDeadlineSweep(); // overdue lawyer updates become DLAO alerts without a chase call

  if (!mounted) return null;
  if (!q.officer) {
    return (
      <div className={`${styles.shell} ${ui.readable}`}>
        <p className={styles.eyebrow}>DLAO · SCLAC · LLAC</p>
        <h1 className={styles.title}>{tx("কর্মকর্তা লগইন প্রয়োজন", "Officer login required")}</h1>
        <p className={styles.lead}>{tx("আবেদন যাচাই ও সিদ্ধান্তের জন্য মোবাইল নম্বর দিয়ে লগইন বা সাইন আপ করুন।", "Log in or sign up with your mobile number to verify applications and record decisions.")}</p>
        <Button onClick={() => router.push("/dlo")}>{tx("লগইন / সাইন আপ →", "Log in / sign up →")}</Button>
      </div>
    );
  }
  const o = q.officer;
  return (
    <div className={`${styles.shell} ${ui.readable}`}>
      <p className={styles.eyebrow}>
        {tx("ধাপ ২ · যাচাই ও যোগ্যতা", "Step 2 · Verification & eligibility")} · {officeCode(o)}
      </p>
      <OfficeNoticeBar />
      {view.kind === "app" ? <Review key={view.id} id={view.id} /> : view.kind === "lawyers" ? <LawyersMonitor /> : view.kind === "lawyer" ? <LawyerDetail key={view.id} id={view.id} /> : view.kind === "mediators" ? <MediatorsRegistry /> : view.kind === "mediationMonitor" ? <MediationMonitor /> : view.kind === "districtCases" ? <DistrictCases /> : view.kind === "urgent" ? <UrgentCases /> : view.kind === "transfers" ? <CaseTransfers /> : view.kind === "groups" ? <IncidentGroups /> : view.kind === "duplicates" ? <DuplicateCheck /> : view.kind === "group" ? <IncidentGroupDetail key={view.id} id={view.id} /> : view.kind === "mediator" ? <MediatorDetail key={view.id} id={view.id} tab={view.tab} /> : <Queue bucket={view.bucket} />}
    </div>
  );
}

/* ------------------------------ queue ------------------------------ */

function Queue({ bucket }: { bucket: QueueView }) {
  const { lang } = useI18n();
  const q = useOfficeQueue();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const rows = bucket === "overview" || bucket === "new" ? q.NEW : bucket === "review" ? q.IN_REVIEW : bucket === "decided" ? q.DECIDED : [];
  const title = {
    overview: tx("অফিসের সারসংক্ষেপ", "Office overview"),
    new: tx("নতুন আবেদন — অফিসে প্রাপ্ত", "New applications — received by the office"),
    review: tx("যাচাই চলছে", "In verification"),
    decided: tx("সিদ্ধান্ত হয়েছে", "Decided"),
    tasks: tx("ফলো-আপ কাজ", "Follow-up tasks"),
  }[bucket];
  const isOverview = bucket === "overview";
  const activeCount = q.NEW.length + q.IN_REVIEW.length;
  return (
    <>
      <header className={isOverview ? ui.queueHero : ui.queuePlainHead}>
        <div className={ui.queueHeroCopy}>
          <span className={ui.heroKicker}>{tx("অফিসের কার্যক্রম", "OFFICE WORKSPACE")}</span>
          <h1 className={ui.queueTitle}>{title}</h1>
          {isOverview ? <p className={ui.heroDescription}>
            {tx("প্রাপ্ত আবেদন যাচাই করুন, সিদ্ধান্ত নিন এবং ফলো-আপ কাজের অগ্রগতি দেখুন।", "Review applications, record decisions, and keep follow-up work moving.")}
          </p> : null}
        </div>
        {isOverview ? <div className={ui.heroMetric} aria-label={tx(`${activeCount}টি আবেদন অপেক্ষায়`, `${activeCount} applications awaiting action`)}>
          <span className={ui.heroMetricNumber}>{activeCount}</span>
          <span className={ui.heroMetricLabel}>{tx("পদক্ষেপের অপেক্ষায়", "Awaiting action")}</span>
        </div> : null}
      </header>

      {isOverview ? <nav className={ui.queueStats} aria-label={tx("অফিসের সারসংক্ষেপ", "Office summary")}>
        {(
          [
            ["new", q.NEW.length, tx("নতুন", "New")],
            ["review", q.IN_REVIEW.length, tx("যাচাই চলছে", "In verification")],
            ["decided", q.DECIDED.length, tx("সিদ্ধান্ত", "Decided")],
          ] as const
        ).map(([k, n, l]) => (
          <a key={k} href={`#${k}`} className={ui.queueStat}>
            <span className={ui.queueStatTop}><span className={ui.queueStatDot} aria-hidden="true" />{l}</span>
            <span className={ui.queueStatBottom}><span className={ui.queueStatNum}>{n}</span><span className={ui.queueStatArrow} aria-hidden="true">↗</span></span>
          </a>
        ))}
      </nav> : null}

      {isOverview ? <OfficeControlCenter /> : null}

      {isOverview ? <OfficeAnalytics /> : null}

      <div className={ui.queueSectionHead}>
        <div>
          <p className={ui.sectionKicker}>{tx("লাইভ তালিকা", "LIVE WORKLIST")}</p>
          <h2 className={ui.queueSectionTitle}>
            {isOverview ? tx("নতুন আবেদন", "New applications") : tx("আবেদনসমূহ", "Applications")}
          </h2>
        </div>
        <span className={ui.sectionCount}>{rows.length} {tx("টি", "items")}</span>
      </div>

      {rows.length === 0 ? (
        <p className={ui.queueEmpty}>{tx("এই তালিকায় কোনো আবেদন নেই।", "No applications in this list.")}</p>
      ) : (
        <div className={ui.worklist}>
          {rows.map((a) => {
            return (
              <article className={ui.workItem} key={a.applicationId}>
                <div className={ui.workItemHead}>
                  <div className={ui.workItemIdentity}>
                    <span className={ui.workItemEyebrow}>{tx("আবেদন", "Application")}</span>
                    <a className={ui.workItemId} href={`#app/${a.applicationId}`}>{a.applicationId}</a>
                    {a.caseId ? <span className={ui.workCaseId}>{a.caseId}</span> : null}
                    <TransferTag a={a} />
                  </div>
                  <a className={ui.queueOpen} href={`#app/${a.applicationId}`}>{tx("আবেদন খুলুন", "Open application")} <span aria-hidden="true">→</span></a>
                </div>
                <dl className={ui.workFacts}>
                  <WorkFact name={tx("আবেদনকারী", "Applicant")}>
                    {a.data.applicant.fullName ?? "—"}
                    {a.data.filedBy.kind !== "SELF" ? <span className={ui.workSub}>{pretty(a.data.filedBy.kind)}</span> : null}
                  </WorkFact>
                  <WorkFact name={tx("সমস্যা", "Matter")}>{label(MATTERS, a.data.matter.category, lang)}</WorkFact>
                  <WorkFact name={tx("মাধ্যম", "Channel")}>{a.channel.code}</WorkFact>
                  <WorkFact name={tx("অপেক্ষা", "Waiting")}>{daysSince(a.submittedAt)} {tx("দিন", "d")}</WorkFact>
                  <WorkFact name={tx("প্রস্তাবিত অগ্রাধিকার", "Suggested priority")}>
                    <Tag tone={a.routing.recommendedPriority === "NORMAL" ? "neutral" : "err"}>{a.routing.recommendedPriority}</Tag>
                    {isRedFlagged(a) ? <Tag tone="err">⚑ {incidentLabel(incidentOf(a).category, incidentOf(a).subcategory, lang)}</Tag> : null}
                  </WorkFact>
                  <WorkFact name={tx("যাচাই", "Verification")}><VerifiedBadge a={a} /></WorkFact>
                  <WorkFact name={tx("স্টাফ প্রি-চেক", "Staff pre-check")}><StaffCheckTag a={a} /></WorkFact>
                  <WorkFact name={tx("ধাপ", "Stage")}>
                    {STAGE_LABEL[subStage(a)]?.[lang] ?? subStage(a)}
                  </WorkFact>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ------------------------------ staff pre-check (advisory) ------------------------------ */

function StaffCheckTag({ a }: { a: ApplicationRecord }) {
  const { lang } = useI18n();
  const c = a.staffCheck;
  if (!c) return <Tag>{lang === "bn" ? "বাকি" : "Not yet"}</Tag>;
  return c.outcome === "STORY_VERIFIED" ? <Tag tone="ok">✓ {lang === "bn" ? "বিবরণ ঠিক" : "Story OK"}</Tag> : <Tag tone="warn">! {lang === "bn" ? "স্পষ্টীকরণ দরকার" : "Needs clarification"}</Tag>;
}

function StaffCheckBanner({ a }: { a: ApplicationRecord }) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const c = a.staffCheck;
  if (!c) return null;
  const ok = c.outcome === "STORY_VERIFIED";
  return (
    <Banner tone={ok ? "ok" : "warn"} icon={ok ? "✓" : "!"}>
      <strong>{tx("অফিস স্টাফ প্রি-চেক", "Office staff pre-check")}</strong> — {ok ? tx("বিবরণ পরিষ্কার ও সামঞ্জস্যপূর্ণ", "story is clear and consistent") : tx("বিবরণে স্পষ্টীকরণ দরকার", "story needs clarification")} · {c.byName} · {new Date(c.at).toLocaleString()}
      {c.note ? <> · “{c.note}”</> : null}
      <span className={ui.workSub}>{tx("শুধু পরামর্শমূলক — যাচাই ও সিদ্ধান্ত কর্মকর্তার।", "Advisory only — verification and decisions stay with the officer.")}</span>
    </Banner>
  );
}

/* ------------------------------ review ------------------------------ */

type StepKey = "received" | "identity" | "facts" | "eligibility" | "decision" | "pathway";
type StepState = "done" | "current" | "blocked" | "locked";
const STEP_ORDER: StepKey[] = ["received", "identity", "facts", "eligibility", "decision", "pathway"];

function stepStatus(a: ApplicationRecord): Record<StepKey, StepState> {
  const r = a.review;
  if (!r) return { received: "current", identity: "locked", facts: "locked", eligibility: "locked", decision: "locked", pathway: "locked" };
  const id: StepState = r.identity.state === "COMPLETED" ? "done" : r.identity.state === "BLOCKED" ? "blocked" : "current";
  const facts: StepState = id !== "done" ? "locked" : r.facts.state === "COMPLETED" ? "done" : r.facts.state === "BLOCKED" ? "blocked" : "current";
  const elig: StepState = facts !== "done" ? "locked" : r.eligibility.state === "COMPLETED" ? "done" : "current";
  // A rejection may be recorded once eligibility is assessed; acceptance needs everything done.
  const decision: StepState = r.decision ? "done" : r.eligibility.state === "COMPLETED" ? "current" : "locked";
  const pathway: StepState = r.pathway ? "done" : r.decision?.decision === "ELIGIBLE" ? "current" : "locked";
  return { received: "done", identity: id, facts, eligibility: elig, decision, pathway };
}

function Review({ id }: { id: string }) {
  const { lang } = useI18n();
  const db = useDlasDb();
  const q = useOfficeQueue();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const a = db.applications.find((x) => x.applicationId === id);
  const inScope = !!a && [...q.NEW, ...q.IN_REVIEW, ...q.DECIDED].some((x) => x.applicationId === id);
  const st = a ? stepStatus(a) : null;
  const firstOpen = st ? (STEP_ORDER.find((k) => st[k] === "current" || st[k] === "blocked") ?? (st.pathway === "done" ? "pathway" : "decision")) : "received";
  const [step, setStepState] = useState<StepKey>(firstOpen);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const setStep = (k: StepKey) => {
    setError(null);
    setSaved(null);
    setStepState(k);
  };

  if (!a || !inScope) {
    return (
      <>
        <a className={styles.crumb} href="#new">
          ← {tx("তালিকা", "Queue")}
        </a>
        <Banner tone="err" icon="!">
          {tx("এই আবেদনটি আপনার অফিসের তালিকায় নেই।", "This application is not in your office's queue.")}
        </Banner>
      </>
    );
  }
  const r = a.review;
  const run = (fn: () => void) => {
    try {
      fn();
      setError(null);
      setSaved(tx("সংরক্ষিত হয়েছে", "Saved to the record"));
    } catch (e) {
      setSaved(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const steps: { key: StepKey; bn: string; en: string }[] = [
    { key: "received", bn: "প্রাপ্ত", en: "Received" },
    { key: "identity", bn: "পরিচয় ও এনআইডি", en: "Identity & NID" },
    { key: "facts", bn: "নথি ও তথ্য", en: "Documents & facts" },
    { key: "eligibility", bn: "যোগ্যতা", en: "Eligibility" },
    { key: "decision", bn: "সিদ্ধান্ত", en: "Decision" },
    { key: "pathway", bn: "আইনি পথ", en: "Legal pathway" },
  ];
  const closed = a.status === "REJECTED" || a.status === "RESOLVED" || a.status === "CLOSED" || a.status === "WITHDRAWN";

  return (
    <>
      <a className={styles.crumb} href={a.status === "SUBMITTED" ? "#new" : a.review?.decision ? "#decided" : "#review"}>
        ← {tx("তালিকা", "Queue")}
      </a>

      <header>
        <div className={ui.head}>
          <span className={ui.headId}>{a.applicationId}</span>
          <VerifiedBadge a={a} />
          <Tag tone={statusTone(a.status)}>{pretty(a.status)}</Tag>
          {a.caseId ? <Tag tone="ink">{a.caseId}</Tag> : null}
          {r?.pathway ? <Tag tone="ok">→ {pathwayLabel(r.pathway.type, lang)}</Tag> : null}
        </div>
        <div className={ui.meta}>
          <span>
            <strong>{a.data.applicant.fullName ?? "—"}</strong>
          </span>
          <span>{label(MATTERS, a.data.matter.category, lang)}</span>
          <span>
            {a.channel.code} · {a.routing.office}
          </span>
          <span>{r ? `${tx("কর্মকর্তা", "Officer")}: ${r.officerName}` : tx("কর্মকর্তা নির্ধারিত হয়নি", "No officer yet")}</span>
          <span>
            {tx("হালনাগাদ", "Updated")} {new Date(a.updatedAt).toLocaleString()}
          </span>
        </div>
      </header>

      <StaffCheckBanner a={a} />

      {a.review && !a.review.decision && !closed ? <CorrectionForm key={a.version} a={a} run={run} /> : null}

      {r?.verifiedAt ? (
        <Banner tone="ok" icon="✓">
          <strong>{tx("যাচাইকৃত", "Verified")}</strong> — {tx("পরিচয়/এনআইডি, নথি ও ঘটনার তথ্য কর্মকর্তা যাচাই করেছেন", "identity/NID, documents and case facts were checked by the officer")} · {new Date(r.verifiedAt).toLocaleString()}
        </Banner>
      ) : closed ? null : st?.identity === "blocked" || st?.facts === "blocked" ? (
        <Banner tone="err" icon="!">
          <strong>{tx("আটকে আছে", "Blocked")}</strong> — {st?.identity === "blocked" ? tx("পরিচয় যাচাই সম্পন্ন হয়নি।", "identity could not be confirmed.") : tx("তথ্য বা নথি অনুপস্থিত/বিরোধপূর্ণ।", "facts or documents are missing or disputed.")}{" "}
          {tx("ফলো-আপ কাজ খোলা আছে।", "A follow-up task is open.")}
        </Banner>
      ) : (
        <Banner tone="warn" icon="!">
          <strong>{tx("অযাচাইকৃত", "Unverified")}</strong> — {tx("আবেদনকারীর দেওয়া তথ্য। এনআইডি ও নথি এবং ঘটনার তথ্য যাচাই করুন।", "as submitted by the applicant. Check the NID, documents and case facts.")}
        </Banner>
      )}

      <nav aria-label={tx("ধাপ", "Steps")}>
        <ol className={ui.steps}>
          {steps.map((s, i) => {
            const state = st![s.key];
            const dot = state === "done" ? ui.dotDone : state === "blocked" ? ui.dotBlocked : state === "current" ? ui.dotCurrent : "";
            return (
              <li key={s.key}>
                <button type="button" className={ui.step} aria-current={step === s.key ? "step" : undefined} disabled={state === "locked"} onClick={() => setStep(s.key)} title={state}>
                  <span className={`${ui.dot} ${dot}`}>{state === "done" ? "✓" : state === "blocked" ? "!" : i + 1}</span>
                  <span>{lang === "bn" ? s.bn : s.en}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <TransferBanner a={a} />
      <IncidentFlagBanner a={a} />
      <CaseGroupBanner a={a} group={groupOf(db, a)} />
      <DuplicateBanner flag={openDuplicateFor(db, a.applicationId)} />
      <AiSummary applicationId={a.applicationId} role="DLO" />
      <div className={ui.layout}>
        <section className={ui.main}>
          {error ? (
            <Banner tone="err" icon="!">
              {error}
            </Banner>
          ) : saved ? (
            <Banner tone="ok" icon="✓">
              {saved}
            </Banner>
          ) : null}
          {step === "received" ? <ReceivedStep a={a} run={run} onNext={() => setStep("identity")} /> : null}
          {step === "identity" && r ? <IdentityStep a={a} run={run} onNext={() => setStep("facts")} /> : null}
          {step === "facts" && r ? <FactsStep a={a} run={run} onNext={() => setStep("eligibility")} /> : null}
          {step === "eligibility" && r ? <EligibilityStep a={a} run={run} onNext={() => setStep("decision")} /> : null}
          {step === "decision" && r ? <DecisionStep a={a} run={run} onNext={() => setStep("pathway")} /> : null}
          {step === "pathway" && r ? <PathwayStep a={a} run={run} /> : null}
        </section>
        <SidePanel a={a} />
      </div>
      <CaseTransferPanel a={a} />
      {a.mediation ? (
        <section className={ui.panel} style={{ marginTop: "var(--s-6)" }}>
          <MediationLifecycleView a={a} />
        </section>
      ) : null}
      <CaseActivityTrail a={a} />
    </>
  );
}

type StepProps = { a: ApplicationRecord; run: (fn: () => void) => void; onNext?: () => void };

function CorrectionForm({ a, run }: { a: ApplicationRecord; run: (fn: () => void) => void }) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => lang === "bn" ? bn : en;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [values, setValues] = useState<Record<string, string | boolean>>({
    "applicant.fullName": a.data.applicant.fullName ?? "",
    "applicant.phone": a.data.applicant.phone ?? "",
    "applicant.nidNumber": a.data.applicant.nidNumber ?? "",
    "applicant.district": a.data.applicant.district ?? "",
    "applicant.addressLine": a.data.applicant.addressLine ?? "",
    "filedBy.name": a.data.filedBy.name ?? "",
    "filedBy.phone": a.data.filedBy.phone ?? "",
    "matter.category": a.data.matter.category ?? "",
    "matter.summary": a.data.matter.summary ?? "",
    "matter.summaryOriginal": a.data.matter.summaryOriginal ?? "",
    "matter.incidentDate": a.data.matter.incidentDate ?? "",
    "matter.opposingParty": a.data.matter.opposingParty ?? "",
    "safeContact.method": a.data.safeContact.method ?? "",
    "safeContact.phone": a.data.safeContact.phone ?? "",
    "safeContact.safeTime": a.data.safeContact.safeTime ?? "",
    "safeContact.notes": a.data.safeContact.notes ?? "",
    "safeContact.smsAllowed": a.data.safeContact.smsAllowed,
    "safeContact.voicemailAllowed": a.data.safeContact.voicemailAllowed,
    "safeContact.neutralWordingRequired": a.data.safeContact.neutralWordingRequired,
    "urgency.selfReportedUrgent": a.data.urgency.selfReportedUrgent,
  });
  const update = (path: string, value: string | boolean) => setValues((v) => ({ ...v, [path]: value }));
  const field = (path: string, bn: string, en: string, type = "text") => <label className={ui.correctionField}>{tx(bn, en)}<input type={type} value={String(values[path] ?? "")} onChange={(e) => update(path, e.target.value)} /></label>;
  const select = (path: string, bn: string, en: string, options: { code: string; label: { bn: string; en: string } }[]) => <label className={ui.correctionField}>{tx(bn, en)}<select value={String(values[path] ?? "")} onChange={(e) => update(path, e.target.value)}><option value="">—</option>{options.map((o) => <option key={o.code} value={o.code}>{o.label[lang]}</option>)}</select></label>;
  return <section className={ui.correction}>
    <button type="button" className={ui.correctionToggle} aria-expanded={open} onClick={() => setOpen(!open)}>{tx("আবেদনের তথ্য সংশোধন", "Correct application details")} <span>{open ? "−" : "+"}</span></button>
    {open ? <form onSubmit={(e) => { e.preventDefault(); run(() => DlaoReviewService.correctDetails(a.applicationId, values, reason)); }}>
      <p>{tx("যাচাই চলাকালে সংশোধিত তথ্য ও আগের মান অডিটে থাকবে। সিদ্ধান্তের পরে সংশোধন বন্ধ।", "Corrections during verification retain old values in the audit. Editing closes after the decision.")}</p>
      <h3>{tx("আবেদনকারী ও দাখিলকারী", "Applicant and filer")}</h3><div className={ui.correctionGrid}>
        {field("applicant.fullName", "পূর্ণ নাম", "Full name")}
        {field("applicant.phone", "মোবাইল", "Mobile", "tel")}
        {field("applicant.nidNumber", "এনআইডি", "NID")}
        {select("applicant.district", "জেলা", "District", DISTRICTS)}
        {field("applicant.addressLine", "ঠিকানা", "Address")}
        {field("filedBy.name", "দাখিলকারীর নাম", "Filer name")}
        {field("filedBy.phone", "দাখিলকারীর ফোন", "Filer phone", "tel")}
      </div>
      <h3>{tx("বিষয় ও ঘটনা", "Matter and incident")}</h3><div className={ui.correctionGrid}>
        {select("matter.category", "বিষয়", "Matter", MATTERS)}
        {field("matter.incidentDate", "ঘটনার তারিখ", "Incident date", "date")}
        {field("matter.opposingParty", "বিপক্ষ", "Opposing party")}
        <label className={ui.correctionField}>{tx("সারসংক্ষেপ", "Summary")}<textarea value={String(values["matter.summary"])} onChange={(e) => update("matter.summary", e.target.value)} /></label>
        <label className={ui.correctionField}>{tx("মূল বক্তব্য", "Original words")}<textarea value={String(values["matter.summaryOriginal"])} onChange={(e) => update("matter.summaryOriginal", e.target.value)} /></label>
      </div>
      <h3>{tx("নিরাপদ যোগাযোগ", "Safe contact")}</h3><div className={ui.correctionGrid}>
        {select("safeContact.method", "পদ্ধতি", "Method", CONTACT_METHODS)}
        {field("safeContact.phone", "নিরাপদ ফোন", "Safe phone", "tel")}
        {select("safeContact.safeTime", "নিরাপদ সময়", "Safe time", SAFE_TIMES)}
        {field("safeContact.notes", "যোগাযোগ নোট", "Contact notes")}
      </div>
      <div className={ui.correctionChecks}>
        {([["safeContact.smsAllowed", "এসএমএস অনুমতি", "SMS allowed"], ["safeContact.voicemailAllowed", "ভয়েসমেইল অনুমতি", "Voicemail allowed"], ["safeContact.neutralWordingRequired", "নিরপেক্ষ ভাষা জরুরি", "Neutral wording required"], ["urgency.selfReportedUrgent", "জরুরি বলেছেন", "Reported urgent"]] as const).map(([path, bn, en]) => <label key={path}><input type="checkbox" checked={Boolean(values[path])} onChange={(e) => update(path, e.target.checked)} />{tx(bn, en)}</label>)}
      </div>
      <label className={ui.correctionField}>{tx("সংশোধনের কারণ", "Reason for correction")}<textarea required value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <div className={ui.bar}><Button type="submit">{tx("সংশোধন সংরক্ষণ", "Save corrections")}</Button></div>
    </form> : null}
  </section>;
}

function StepHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <>
      <h2 className={ui.stepTitle}>{title}</h2>
      {lead ? <p className={ui.stepLead}>{lead}</p> : <div style={{ height: "var(--s-4)" }} />}
    </>
  );
}

function ReceivedStep({ a, run, onNext }: StepProps) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const d = a.data;
  return (
    <>
      <StepHead title={tx("অফিসে প্রাপ্ত আবেদন", "Application received by the office")} lead={tx("সারসংক্ষেপ দেখে যাচাই শুরু করুন।", "Skim the summary, then start verification.")} />
      <div className={ui.rows}>
        <Row label={tx("জমার সময়", "Submitted")}>
          {new Date(a.submittedAt).toLocaleString()} <Tag>{a.channel.code}</Tag>
        </Row>
        <Row label={tx("দাখিলকারী", "Filed by")}>
          {pretty(d.filedBy.kind)}
          {d.filedBy.name ? ` · ${d.filedBy.name}` : ""}
          {d.filedBy.relation ? ` (${d.filedBy.relation})` : ""}
          {d.filedBy.operatorId ? ` · ${d.filedBy.operatorId}${d.filedBy.centre ? `, ${d.filedBy.centre}` : ""}` : ""}
        </Row>
        <Row label={tx("সমস্যা", "Matter")}>
          <strong>{label(MATTERS, d.matter.category, lang)}</strong>
          <span className={ui.sub}>{d.matter.summary ?? "—"}</span>
        </Row>
        <Row label={tx("জরুরি সংকেত", "Urgency")}>
          {d.urgency.flags.length ? d.urgency.flags.map((f) => <Tag key={f} tone="err">{label(URGENCY_FLAGS, f, lang)}</Tag>) : <Tag tone="ok">{tx("নেই", "None")}</Tag>}
        </Row>
        <Row label={tx("জমার সময় যাচাই", "Completeness")}>
          {a.validation.valid ? <Tag tone="ok">✓ {tx("সম্পূর্ণ", "Complete")}</Tag> : <Tag tone="err">{tx("অসম্পূর্ণ", "Incomplete")}</Tag>}
          {!a.validation.valid ? <span className={ui.sub}>{a.validation.missing.join(", ")}</span> : null}
          {a.validation.warnings.map((w) => (
            <Tag key={w.code} tone="warn">
              {pretty(w.code)}
            </Tag>
          ))}
        </Row>
      </div>
      <div className={ui.bar}>
        {a.review ? (
          <>
            <Tag tone="ok">
              ✓ {tx("প্রাপ্তি নিশ্চিত", "Received")} {new Date(a.review.receivedAt).toLocaleString()}
            </Tag>
            <span className={styles.spacer} />
            <Button onClick={onNext}>{tx("পরবর্তী ধাপ →", "Next step →")}</Button>
          </>
        ) : (
          <Button
            onClick={() =>
              run(() => {
                DlaoReviewService.receive(a.applicationId);
                onNext?.();
              })
            }
          >
            {tx("গ্রহণ করে যাচাই শুরু করুন", "Receive and start verification")}
          </Button>
        )}
      </div>
    </>
  );
}

function IdentityStep({ a, run, onNext }: StepProps) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const r = a.review!;
  const decided = !!r.decision;
  const [outcome, setOutcome] = useState<IdentityOutcome>("CONFIRMED");
  const [method, setMethod] = useState<NonNullable<typeof r.identity.method>>("PHONE_CALL");
  const [note, setNote] = useState("");
  const [name, setName] = useState(a.data.applicant.fullName ?? "");
  const [phone, setPhone] = useState(a.data.applicant.phone ?? "");
  const [district, setDistrict] = useState<string>(a.data.applicant.district ?? "");
  const nidNumber = a.data.applicant.nidNumber;
  const nidDocs = a.data.documents.filter((d) => d.type === "NID");
  const [nidStatus, setNidStatus] = useState<"MATCHES_DOCUMENT" | "MISMATCH" | "NOT_PROVIDED">(r.identity.nid.status ?? (nidNumber ? "MATCHES_DOCUMENT" : "NOT_PROVIDED"));
  const [nidFix, setNidFix] = useState(nidNumber ?? "");
  const reg = r.identity.nid.simulatedRegistryCheck;
  const nidRecorded = r.identity.nid.status;

  return (
    <>
      <StepHead title={tx("পরিচয় ও এনআইডি যাচাই", "Verify identity & NID")} lead={tx("আবেদনকারীর সাথে নিরাপদ মাধ্যমে কথা বলে বিবরণ ও এনআইডি মিলিয়ে দেখুন।", "Speak to the applicant on the safe channel and compare the details and NID.")} />
      {a.data.filedBy.kind === "REPRESENTATIVE" ? (
        <Banner tone="warn" icon="!">
          {tx(`প্রতিনিধি (${a.data.filedBy.name ?? "—"}) আবেদন করেছেন — আবেদনকারীর সাথে সরাসরি নিশ্চিত করুন।`, `Filed by a representative (${a.data.filedBy.name ?? "—"}) — confirm directly with the applicant; the representative's word is not the applicant's confirmation.`)}
        </Banner>
      ) : null}

      <div className={ui.sectionHead}>{tx("আবেদনকারী", "Applicant")}</div>
      <div className={ui.rows}>
        <Row label={tx("নাম", "Name")}>
          {a.data.applicant.fullName ?? "—"} <Prov a={a} path="applicant.fullName" />
        </Row>
        <Row label={tx("মোবাইল", "Mobile")}>
          {a.data.applicant.phone ?? "—"} <Prov a={a} path="applicant.phone" />
          {a.identity.verified ? <Tag tone="ok">✓ {a.identity.method ? pretty(a.identity.method) : ""}</Tag> : <Tag tone="warn">{tx("যাচাই হয়নি", "not verified")}</Tag>}
        </Row>
        <Row label={tx("জেলা", "District")}>
          {label(DISTRICTS, a.data.applicant.district, lang)} <Prov a={a} path="applicant.district" />
        </Row>
        <Row label={tx("নিরাপদ যোগাযোগ", "Safe contact")}>
          {a.data.safeContact.method ?? "—"} · {a.data.safeContact.phone ?? "—"} · {safeTimeLabel(a.data.safeContact, lang)}
          {a.data.safeContact.notes ? <span className={ui.sub}>{a.data.safeContact.notes}</span> : null}
        </Row>
        {r.identity.attempts > 0 ? (
          <Row label={tx("আগের চেষ্টা", "Attempts")}>
            {r.identity.attempts}
            {r.identity.outcome ? <Tag tone={r.identity.state === "COMPLETED" ? "ok" : "err"}>{pretty(r.identity.outcome)}</Tag> : null}
            {r.identity.note ? <span className={ui.sub}>“{r.identity.note}”</span> : null}
          </Row>
        ) : null}
      </div>

      <div className={ui.section}>
        <div className={ui.sectionHead}>{tx("জাতীয় পরিচয়পত্র (এনআইডি)", "National ID (NID)")}</div>
        <div className={ui.rows}>
          <Row label={tx("এনআইডি নম্বর", "NID number")}>
            <span className={styles.mono}>{nidNumber ?? "—"}</span>
            <Prov a={a} path="applicant.nidNumber" />
            {nidNumber ? nidFormatValid(nidNumber) ? <Tag tone="ok">✓ {tx("ফরম্যাট ঠিক", "Format OK")}</Tag> : <Tag tone="err">✗ {tx("ফরম্যাট ভুল", "Invalid format")}</Tag> : <Tag tone="warn">{tx("দেওয়া হয়নি", "Not provided")}</Tag>}
          </Row>
          <Row label={tx("রেজিস্ট্রি যাচাই", "Registry check")}>
            {reg ? <Tag tone={reg.result === "FORMAT_OK" ? "ok" : "err"}>{reg.result === "FORMAT_OK" ? "✓ " : "✗ "}{pretty(reg.result)}</Tag> : <Tag>{tx("করা হয়নি", "Not run")}</Tag>}
            <Tag tone="warn">{tx("সিমুলেটেড", "Simulated")}</Tag>
            {!decided ? (
              <Button variant="secondary" disabled={!nidNumber} onClick={() => run(() => DlaoReviewService.checkNidRegistry(a.applicationId))}>
                {reg ? tx("আবার যাচাই", "Re-check") : tx("রেজিস্ট্রি যাচাই", "Check registry")}
              </Button>
            ) : null}
            <span className={ui.sub}>{tx("নির্বাচন কমিশনের এনআইডি সেবা যুক্ত নয় — শুধু নম্বরের ফরম্যাট দেখা হয়। নথির সাথে মিলিয়ে দেখুন।", "The Election Commission NID service is not connected — only the number format is checked. Compare with the document.")}</span>
          </Row>
          {nidRecorded ? (
            <Row label={tx("রেকর্ডকৃত ফল", "Recorded")}>
              <Tag tone={nidRecorded === "MATCHES_DOCUMENT" ? "ok" : nidRecorded === "MISMATCH" ? "err" : "warn"}>{pretty(nidRecorded)}</Tag>
            </Row>
          ) : null}
        </div>
        <div style={{ marginTop: "var(--s-3)" }}>
          {nidDocs.length === 0 ? (
            <div className={ui.missing}>{tx("এনআইডি নথি জমা নেই — ধাপ ৩-এ অন্য কোনো আপলোডকে এনআইডি হিসেবে চিহ্নিত করা যায়।", "No NID document on record — another upload can be classified as NID in step 3.")}</div>
          ) : (
            <div className={ui.docGrid}>
              {nidDocs.map((d) => (
                <div key={d.docId} className={ui.doc}>
                  <div className={ui.docHead}>
                    {d.fileName ?? d.docId} <Tag tone={d.status === "ATTACHED" ? "ok" : "warn"}>{pretty(d.status)}</Tag>
                  </div>
                  {d.qualityNote ? <Tag tone="warn">{d.qualityNote}</Tag> : null}
                  <DocPreview doc={d} />
                  <div>
                    <DocViewButton app={a} doc={d} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {decided ? null : (
        <div className={ui.section}>
          <div className={ui.sectionHead}>{tx("ফলাফল রেকর্ড করুন", "Record the check")}</div>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>{tx("পদ্ধতি", "Method")}</span>
              <select className={styles.select} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                <option value="PHONE_CALL">{tx("নিরাপদ সময়ে ফোন", "Phone call at the safe time")}</option>
                <option value="OFFICE_VISIT">{tx("অফিসে সাক্ষাৎ", "Office visit")}</option>
                <option value="UDC_VIDEO">{tx("ইউডিসি ভিডিও", "UDC video")}</option>
                <option value="DOCUMENT_CHECK">{tx("নথি দেখে", "Document check")}</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{tx("ফলাফল", "Outcome")}</span>
              <select className={styles.select} value={outcome} onChange={(e) => setOutcome(e.target.value as IdentityOutcome)}>
                <option value="CONFIRMED">{tx("আবেদনকারী নিশ্চিত করেছেন", "Applicant confirmed the details")}</option>
                <option value="CORRECTED">{tx("আবেদনকারী সংশোধন করেছেন", "Applicant corrected details")}</option>
                <option value="DISPUTED">{tx("আবেদনকারী অস্বীকার করেছেন", "Applicant disputes the application")}</option>
                <option value="UNREACHABLE">{tx("নিরাপদে যোগাযোগ করা যায়নি", "Could not be reached safely")}</option>
              </select>
              {outcome === "UNREACHABLE" ? <span className={styles.hint}>{tx("আবেদনকারীকে স্বয়ংক্রিয় এসএমএস/নোটিফিকেশন যাবে এবং হেল্পলাইন আবার কল করবে।", "The applicant gets an automatic SMS/notification and the helpline will call again at the safe time.")}</span> : null}
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{tx("এনআইডি", "NID")}</span>
              <select className={styles.select} value={nidStatus} onChange={(e) => setNidStatus(e.target.value as typeof nidStatus)}>
                <option value="MATCHES_DOCUMENT">{tx("নম্বর নথির সাথে মিলেছে", "Number matches the NID document")}</option>
                <option value="MISMATCH">{tx("মেলেনি", "Does not match")}</option>
                <option value="NOT_PROVIDED">{tx("এনআইডি নেই / দেওয়া হয়নি", "No NID / not provided")}</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{tx("নোট", "Note")}</span>
              <input className={styles.input} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {outcome === "CORRECTED" ? (
              <>
                <label className={styles.field}>
                  <span className={styles.label}>{tx("সঠিক নাম", "Correct name")}</span>
                  <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>{tx("সঠিক মোবাইল", "Correct mobile")}</span>
                  <input className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>{tx("সঠিক জেলা", "Correct district")}</span>
                  <select className={styles.select} value={district} onChange={(e) => setDistrict(e.target.value)}>
                    {DISTRICTS.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.label[lang]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>{tx("সঠিক এনআইডি নম্বর", "Correct NID number")}</span>
                  <input className={`${styles.input} ${nidFix.trim() && !nidFormatValid(nidFix) ? styles.invalid : ""}`} inputMode="numeric" value={nidFix} onChange={(e) => setNidFix(e.target.value)} />
                  <span className={styles.hint}>{tx("সংশোধিত নম্বর নথির সাথে মিললে এনআইডি: “মিলেছে” বাছুন।", "If the corrected number matches the document, set NID to “matches”.")}</span>
                </label>
              </>
            ) : null}
          </div>
          {nidStatus === "MISMATCH" && outcome === "CONFIRMED" ? (
            <div style={{ marginTop: "var(--s-4)" }}>
              <Banner tone="err" icon="!">
                {tx("এনআইডি মেলেনি — “সংশোধন করেছেন” বেছে সঠিক নম্বর দিন, অথবা “অস্বীকার” রেকর্ড করুন।", "NID mismatch — choose “corrected” and enter the right number, or record it as disputed.")}
              </Banner>
            </div>
          ) : null}
          <div className={ui.bar}>
            <Button
              disabled={nidStatus === "MISMATCH" && outcome === "CONFIRMED"}
              onClick={() =>
                run(() => {
                  if (outcome === "CORRECTED" && nidFix.trim() && !nidFormatValid(nidFix)) {
                    throw new Error(tx("সঠিক এনআইডি নম্বর ১০, ১৩ বা ১৭ অঙ্কের হতে হবে", "The corrected NID number must have 10, 13 or 17 digits"));
                  }
                  DlaoReviewService.verifyIdentity(a.applicationId, {
                    outcome,
                    method,
                    note,
                    nid: nidStatus,
                    corrections:
                      outcome === "CORRECTED"
                        ? [
                            { path: "applicant.fullName", to: name },
                            { path: "applicant.phone", to: phone },
                            { path: "applicant.district", to: district },
                            { path: "applicant.nidNumber", to: nidFix.trim() },
                          ]
                        : [],
                  });
                  if ((outcome === "CONFIRMED" || outcome === "CORRECTED") && nidStatus !== "MISMATCH") onNext?.();
                })
              }
            >
              {tx("রেকর্ড করুন", "Record identity check")}
            </Button>
            {r.identity.state === "COMPLETED" ? (
              <>
                <span className={styles.spacer} />
                <Button variant="secondary" onClick={onNext}>
                  {tx("পরবর্তী ধাপ →", "Next step →")}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

function factTone(s: FactStatus): Tone {
  return s === "CORROBORATED" ? "ok" : s === "DISPUTED" ? "err" : s === "UNVERIFIABLE" ? "warn" : "neutral";
}

function FactsStep({ a, run, onNext }: StepProps) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const r = a.review!;
  const decided = !!r.decision;
  const list = factChecklist(a);
  const [status, setStatus] = useState<Record<string, FactStatus>>(() => Object.fromEntries(list.map((i) => [i.key, r.facts.items.find((x) => x.key === i.key)?.status ?? "NOT_REVIEWED"])));
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(list.map((i) => [i.key, r.facts.items.find((x) => x.key === i.key)?.note ?? ""])));
  const [missing, setMissing] = useState(r.facts.missingEvidence.join("\n"));
  const [recvNote, setRecvNote] = useState("");
  const [requestCall, setRequestCall] = useState(false);
  const [reqType, setReqType] = useState<DocType>("POLICE_REPORT");
  const [reqNote, setReqNote] = useState("");
  const docs = a.data.documents;
  const unreviewed = list.filter((i) => status[i.key] === "NOT_REVIEWED").length;
  const db = useDlasDb();
  const pendingDocNames = docs.filter((d) => d.status !== "ATTACHED").map((d) => label(DOC_TYPES, d.type, lang));
  const missingLines = missing.split("\n").map((m) => m.trim()).filter(Boolean);
  const willAsk = missingLines.length > 0 || Object.values(status).includes("DISPUTED");
  const lastSms = db.outbox.filter((m) => m.applicationId === a.applicationId).slice(-1)[0];
  const openCall = db.tasks.find((t) => t.applicationId === a.applicationId && t.type === "HUMAN_CALLBACK" && t.status !== "DONE");
  const safeWhen = safeTimeLabel(a.data.safeContact, lang);

  return (
    <>
      <StepHead title={tx("নথি ও ঘটনার তথ্য যাচাই", "Verify documents & case info")} lead={tx("প্রতিটি নথি দেখুন ও ধরন নিশ্চিত করুন, তারপর প্রতিটি তথ্য যাচাই করুন। কিছু অনুমান করবেন না।", "Look at each document and confirm its type, then check each fact. Do not infer anything.")} />

      <div className={ui.sectionHead}>
        {tx("জমা দেওয়া নথি", "Submitted documents")} ({docs.length})
      </div>
      {docs.length === 0 ? (
        <div className={ui.missing}>{tx("কোনো নথি জমা হয়নি — প্রয়োজনে নিচে “অনুপস্থিত প্রমাণ”-এ লিখুন।", "No documents submitted — list what is needed under “missing evidence” below.")}</div>
      ) : (
        <div className={ui.docGrid}>
          {docs.map((d) => (
            <div key={d.docId} className={ui.doc}>
              <div className={ui.docHead}>
                <Tag tone={d.status === "ATTACHED" ? "ok" : "warn"}>{pretty(d.status)}</Tag>
                {d.sensitive ? <Tag tone="err">{tx("সংবেদনশীল", "Sensitive")}</Tag> : null}
                <Prov a={a} path={`documents.${d.docId}.type`} />
                {d.sizeBytes ? <span>{Math.round(d.sizeBytes / 1024)} KB</span> : null}
                {d.uploadedVia === "APPLICANT_WEB" && d.uploadedAt ? (
                  <Tag tone={!r.facts.at || d.uploadedAt > r.facts.at ? "ok" : "neutral"}>
                    {!r.facts.at || d.uploadedAt > r.facts.at ? `★ ${tx("নতুন", "New")} · ` : ""}
                    {tx("আবেদনকারী আপলোড করেছেন", "Uploaded by applicant")} {new Date(d.uploadedAt).toLocaleDateString()}
                  </Tag>
                ) : null}
                {d.requested && d.status !== "ATTACHED" ? <Tag tone="warn">{tx("আবেদনকারীর কাছে চাওয়া হয়েছে", "Requested from applicant")}</Tag> : null}
              </div>
              <select className={styles.select} disabled={decided} value={d.type} aria-label={tx("নথির ধরন", "Document type")} onChange={(e) => run(() => DlaoReviewService.setDocumentType(a.applicationId, d.docId, e.target.value as DocType))}>
                {DOC_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label[lang]}
                  </option>
                ))}
              </select>
              {d.qualityNote ? <Tag tone="warn">{d.qualityNote}</Tag> : null}
              <DocPreview doc={d} />
              <div>
                <DocViewButton app={a} doc={d} />
              </div>
              {d.status !== "ATTACHED" && !decided ? (
                <Button variant="secondary" onClick={() => run(() => DlaoReviewService.markDocumentReceived(a.applicationId, d.docId, recvNote))}>
                  {tx("অফিসে পাওয়া গেছে", "Received at office")}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {docs.some((d) => d.status !== "ATTACHED") && !decided ? (
        <input className={styles.input} style={{ marginTop: "var(--s-3)" }} placeholder={tx("প্রাপ্তির নোট (ঐচ্ছিক)", "Receipt note for documents received at the office (optional)")} value={recvNote} onChange={(e) => setRecvNote(e.target.value)} />
      ) : null}

      {!decided ? (
        <div className={ui.contactBox} style={{ marginTop: "var(--s-4)" }}>
          <div className={ui.sectionHead} style={{ marginBottom: 0 }}>
            {tx("আবেদনকারীর কাছে নথি চান", "Ask the applicant for a document")}
          </div>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>{tx("নথি", "Document")}</span>
              <select className={styles.select} value={reqType} onChange={(e) => setReqType(e.target.value as DocType)}>
                {DOC_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label[lang]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{tx("নোট (আবেদনকারী দেখবেন)", "Note (the applicant sees this)")}</span>
              <input className={styles.input} value={reqNote} onChange={(e) => setReqNote(e.target.value)} placeholder={tx("যেমন: থানার সিল সহ কপি", "e.g. copy with the police station seal")} />
            </label>
          </div>
          <div className={ui.contactLine}>
            <Button
              variant="secondary"
              onClick={() =>
                run(() => {
                  DlaoReviewService.requestDocument(a.applicationId, { type: reqType, note: reqNote });
                  setReqNote("");
                })
              }
            >
              {tx("অনুরোধ পাঠান", "Send request")}
            </Button>
            <span className={styles.hint}>{tx("আবেদনকারী ড্যাশবোর্ড নোটিফিকেশন ও এসএমএস পাবেন এবং “আমার মামলা” থেকে আপলোড করতে পারবেন।", "The applicant gets a dashboard notification + SMS and can upload it from “My cases”.")}</span>
          </div>
        </div>
      ) : null}

      <div className={ui.section}>
        <div className={ui.sectionHead}>{tx("ঘটনার তথ্য", "Case information")}</div>
        <div className={ui.rows}>
          {list.map((i) => (
            <div key={i.key} className={ui.row}>
              <div className={ui.rowLabel}>
                {i.label}
                <div>
                  <Prov a={a} path={i.key} />
                </div>
              </div>
              <div className={ui.rowValue}>
                <span style={{ flexBasis: "100%" }}>{i.value ?? "—"}</span>
                <div className={styles.chips}>
                  {(["CORROBORATED", "DISPUTED", "UNVERIFIABLE"] as FactStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={decided}
                      className={`${ui.tag} ${status[i.key] === s ? ui[factTone(s) as "ok"] : ""}`}
                      style={{ cursor: decided ? "default" : "pointer", font: "inherit", fontSize: 11 }}
                      aria-pressed={status[i.key] === s}
                      onClick={() => setStatus({ ...status, [i.key]: status[i.key] === s ? "NOT_REVIEWED" : s })}
                    >
                      {s === "CORROBORATED" ? `✓ ${tx("সমর্থিত", "Corroborated")}` : s === "DISPUTED" ? `✗ ${tx("বিরোধপূর্ণ", "Disputed")}` : tx("যাচাই অযোগ্য", "Unverifiable")}
                    </button>
                  ))}
                </div>
                <input className={styles.input} style={{ flexBasis: "100%" }} disabled={decided} placeholder={tx("নোট (ঐচ্ছিক)", "Note (optional)")} value={notes[i.key]} onChange={(e) => setNotes({ ...notes, [i.key]: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
        <label className={styles.field} style={{ marginTop: "var(--s-4)" }}>
          <span className={styles.label}>{tx("অনুপস্থিত প্রমাণ (প্রতি লাইনে একটি)", "Missing evidence (one per line)")}</span>
          <textarea className={styles.textarea} disabled={decided} value={missing} onChange={(e) => setMissing(e.target.value)} placeholder={tx("যেমন: কাবিননামার কপি", "e.g. Copy of the marriage certificate")} />
        </label>
        {pendingDocNames.length && !decided ? (
          <button
            type="button"
            className={ui.textBtn}
            onClick={() => setMissing([...missingLines, ...pendingDocNames.filter((n) => !missingLines.includes(n))].join("\n"))}
          >
            + {tx("জমা না হওয়া নথি যোগ করুন", "Add the documents not yet submitted")} ({pendingDocNames.join(", ")})
          </button>
        ) : null}
      </div>

      {!decided ? (
        <div className={ui.section}>
          <div className={ui.sectionHead}>{tx("কিছু অনুপস্থিত থাকলে আবেদনকারীকে জানানো", "If something is missing — tell the applicant")}</div>
          <div className={ui.contactBox}>
            <div className={ui.contactLine}>
              <Tag tone="ok">{tx("স্বয়ংক্রিয়", "Automatic")}</Tag>
              <span>
                {tx("ড্যাশবোর্ড নোটিফিকেশন + এসএমএস", "Dashboard notification + SMS")}
                {!a.data.safeContact.smsAllowed ? <> — <Tag tone="warn">{tx("এসএমএস বন্ধ (আবেদনকারীর নির্দেশ)", "SMS off (applicant's choice)")}</Tag></> : null}
                {a.data.safeContact.neutralWordingRequired ? <span className={styles.hint}> · {tx("নিরপেক্ষ ভাষায়", "neutral wording")}</span> : null}
              </span>
            </div>
            <label className={ui.contactLine} style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={requestCall} onChange={(e) => setRequestCall(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--ink)" }} />
              <span>
                {tx("হেল্পলাইন থেকে ফোনও করা হোক", "Also have the helpline call the applicant")} <span className={styles.hint}>— {tx("নিরাপদ সময়", "safe time")}: {safeWhen}</span>
              </span>
            </label>
            <div className={styles.hint}>
              {willAsk
                ? tx(`যাচাই করলে জানানো হবে: ${missingLines.join("; ") || "তথ্য স্পষ্ট করা দরকার"}`, `On “Verify”, the applicant will be asked for: ${missingLines.join("; ") || "clarification of disputed details"}`)
                : tx("কিছু অনুপস্থিত নেই — কোনো বার্তা যাবে না।", "Nothing missing — no message will be sent.")}
            </div>
          </div>
        </div>
      ) : null}

      {r.facts.outcome ? (
        <div style={{ marginTop: "var(--s-4)" }}>
          <Banner tone={r.facts.outcome === "SUFFICIENT" ? "ok" : "err"} icon={r.facts.outcome === "SUFFICIENT" ? "✓" : "!"}>
            {tx("শেষ ফল", "Last result")}: <strong>{pretty(r.facts.outcome)}</strong>
            {r.facts.outcome !== "SUFFICIENT" ? ` — ${tx("ফলো-আপ কাজ খোলা হয়েছে; সমাধান হলে আবার যাচাই করুন।", "a follow-up task is open; verify again once resolved.")}` : ""}
            {r.facts.outcome !== "SUFFICIENT" ? (
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                <Tag tone="ok">✓ {tx("ড্যাশবোর্ডে জানানো হয়েছে", "Shown on applicant's dashboard")}</Tag>
                {lastSms && r.facts.at && lastSms.at >= r.facts.at ? <Tag tone={lastSms.status === "DELIVERED" ? "ok" : "warn"}>{lastSms.status === "DELIVERED" ? `✓ ${tx("এসএমএস পাঠানো (সিমুলেটেড)", "SMS sent (simulated)")}` : tx("এসএমএস পাঠানো হয়নি — আবেদনকারীর নির্দেশ", "SMS not sent — applicant's choice")}</Tag> : null}
                {openCall ? <Tag tone="warn">{tx("হেল্পলাইন কল অপেক্ষমাণ", "Helpline call pending")}</Tag> : null}
              </div>
            ) : null}
          </Banner>
        </div>
      ) : null}

      {decided ? null : (
        <div className={ui.bar}>
          <Button
            onClick={() =>
              run(() => {
                const res = DlaoReviewService.reviewFacts(a.applicationId, {
                  items: list.map((i) => ({ key: i.key, status: status[i.key], note: notes[i.key] ?? "" })),
                  missingEvidence: missing.split("\n"),
                  requestCall,
                });
                setRequestCall(false);
                if (res.review?.facts.outcome === "SUFFICIENT") onNext?.();
              })
            }
          >
            {tx("যাচাই করুন", "Verify")}
          </Button>
          <span className={styles.hint}>
            {unreviewed
              ? tx(`${unreviewed}টি তথ্য এখনো দেখা হয়নি`, `${unreviewed} fact(s) not reviewed yet`)
              : tx("কিছু অনুপস্থিত বা বিরোধপূর্ণ না থাকলে আবেদনটি যাচাইকৃত হবে", "Marked verified when nothing is missing or disputed")}
          </span>
        </div>
      )}
    </>
  );
}

function EligibilityStep({ a, run, onNext }: StepProps) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const rs = useEligibilityRuleset();
  const r = a.review!;
  const decided = !!r.decision;
  const e = r.eligibility;
  const [court, setCourt] = useState(e.courtLevel);
  const [notDisclosed, setNotDisclosed] = useState(e.state === "COMPLETED" ? e.declaredAnnualIncomeBdt == null : false);
  const [income, setIncome] = useState(e.declaredAnnualIncomeBdt != null ? String(e.declaredAnnualIncomeBdt) : "");
  const [exempt, setExempt] = useState<string[]>(e.exemptCategories);
  const [notes, setNotes] = useState(e.vulnerabilityNotes ?? "");
  const recOk = e.recommendation === "ELIGIBLE_INCOME" || e.recommendation === "ELIGIBLE_EXEMPT_CATEGORY";
  return (
    <>
      <StepHead title={tx("ঝুঁকি ও যোগ্যতা মূল্যায়ন", "Vulnerability & eligibility")} />
      <div className={ui.advice}>
        {tx("নিয়মসেট", "Ruleset")} <span className={styles.mono}>{rs.version}</span> <Tag tone="warn">{tx("চলতি খসড়া", "Working draft")}</Tag>
        <div className={styles.hint} style={{ marginTop: 4 }}>
          {tx("আয়সীমা", "Income limits")}: SC {rs.incomeThresholdAnnualBdt.SUPREME_COURT.toLocaleString()} · {tx("অন্যান্য আদালত", "other courts")} {rs.incomeThresholdAnnualBdt.OTHER_COURTS.toLocaleString()} BDT
        </div>
      </div>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>{tx("আদালত", "Court level")}</span>
          <select className={styles.select} disabled={decided} value={court} onChange={(ev) => setCourt(ev.target.value as typeof court)}>
            <option value="OTHER_COURTS">{tx("জেলা ও অন্যান্য আদালত", "District & other courts")}</option>
            <option value="SUPREME_COURT">{tx("সুপ্রিম কোর্ট", "Supreme Court")}</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{tx("ঘোষিত বার্ষিক আয় (টাকা)", "Declared annual income (BDT)")}</span>
          <input className={styles.input} type="number" min={0} disabled={decided || notDisclosed} value={income} onChange={(ev) => setIncome(ev.target.value)} />
          <label className={styles.check}>
            <input type="checkbox" disabled={decided} checked={notDisclosed} onChange={(ev) => setNotDisclosed(ev.target.checked)} />
            {tx("আয় জানানো হয়নি", "Income not disclosed")}
          </label>
        </label>
      </div>
      <div className={ui.section}>
        <div className={ui.sectionHead}>{tx("আয় নির্বিশেষে সহায়তার শ্রেণি (যাচাইকৃত)", "Assisted regardless of income (verified by you)")}</div>
        <div className={styles.chips}>
          {rs.exemptCategories.map((c) => {
            const on = exempt.includes(c.code);
            return (
              <button key={c.code} type="button" className={styles.chip} disabled={decided} aria-pressed={on} onClick={() => setExempt(on ? exempt.filter((x) => x !== c.code) : [...exempt, c.code])}>
                {c.label[lang]}
              </button>
            );
          })}
        </div>
        <label className={styles.field} style={{ marginTop: "var(--s-4)" }}>
          <span className={styles.label}>{tx("ঝুঁকি / দুর্বলতার নোট", "Vulnerability notes")}</span>
          <textarea className={styles.textarea} disabled={decided} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
        </label>
      </div>
      {e.recommendation ? (
        <div style={{ marginTop: "var(--s-4)" }}>
          <Banner tone={recOk ? "ok" : "err"} icon={recOk ? "✓" : "✗"}>
            <Tag tone="ink">{tx("সিস্টেমের সুপারিশ — সিদ্ধান্ত আপনার", "Advisory — you decide")}</Tag> <strong>{pretty(e.recommendation)}</strong> · {pretty(e.incomeBand ?? "")}
            <ul style={{ margin: "4px 0 0 16px" }}>
              {e.reasons.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Banner>
        </div>
      ) : null}
      {decided ? null : (
        <div className={ui.bar}>
          <Button
            onClick={() =>
              run(() => {
                const n = notDisclosed || income.trim() === "" ? null : Number(income);
                if (n != null && (!Number.isFinite(n) || n < 0)) throw new Error(tx("সঠিক আয় লিখুন", "Enter a valid income"));
                DlaoReviewService.assessEligibility(a.applicationId, { courtLevel: court, income: n, exempt, vulnerabilityNotes: notes });
              })
            }
          >
            {tx("সুপারিশ হিসাব করুন", "Compute recommendation")}
          </Button>
          {e.recommendation ? (
            <>
              <span className={styles.spacer} />
              <Button variant="secondary" onClick={onNext}>
                {tx("সিদ্ধান্তে যান →", "Go to decision →")}
              </Button>
            </>
          ) : null}
        </div>
      )}
    </>
  );
}

function DecisionStep({ a, run, onNext }: StepProps) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const r = a.review!;
  const rec = r.eligibility.recommendation;
  const recEligible = rec === "ELIGIBLE_INCOME" || rec === "ELIGIBLE_EXEMPT_CATEGORY";
  const [choice, setChoice] = useState<"ELIGIBLE" | "NOT_ELIGIBLE">(recEligible ? "ELIGIBLE" : "NOT_ELIGIBLE");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const canAccept = r.identity.state === "COMPLETED" && r.facts.state === "COMPLETED";
  const sms = useDlasDb().outbox.filter((m) => m.applicationId === a.applicationId).slice(-1)[0];

  if (r.decision) {
    const d = r.decision;
    const ok = d.decision === "ELIGIBLE";
    return (
      <>
        <StepHead title={tx("সিদ্ধান্ত", "Decision")} />
        <div className={`${ui.result} ${ok ? ui.bannerOk : ui.bannerErr}`} style={{ border: "1px solid" }}>
          <span className={ui.bannerIcon} style={{ background: ok ? "var(--green)" : "var(--red)" }}>
            {ok ? "✓" : "✗"}
          </span>
          <div style={{ flex: 1 }}>
            <div>{ok ? tx("আইনি সহায়তার যোগ্য — কেস তৈরি", "Eligible — case created") : tx("যোগ্য নয় — আবেদন বাতিল ও বন্ধ", "Not eligible — application rejected and closed")}</div>
            {ok ? <div className={ui.resultBig}>{a.caseId}</div> : null}
          </div>
          {ok && !r.pathway ? <Button onClick={onNext}>{tx("কোথায় পাঠাবেন? →", "Choose where to send →")}</Button> : null}
          {ok && r.pathway ? <Tag tone="ok">→ {pathwayLabel(r.pathway.type, lang)}</Tag> : null}
        </div>
        <div className={ui.rows}>
          <Row label={tx("কারণ", "Reason")}>{d.reason}</Row>
          <Row label={tx("সুপারিশ", "Recommendation")}>{d.followedRecommendation ? <Tag tone="ok">{tx("অনুসারে", "Followed")}</Tag> : <Tag tone="warn">{tx("ওভাররাইড", "Override")}</Tag>}</Row>
          <Row label={tx("সিদ্ধান্তদাতা", "Decided by")}>
            {d.byName} · {new Date(d.at).toLocaleString()}
          </Row>
          <Row label={tx("আবেদনকারীকে জানানো", "Applicant told")}>
            {sms ? (
              <>
                <Tag tone={sms.status === "DELIVERED" ? "ok" : "warn"}>{pretty(sms.status)}</Tag>
                <span className={ui.sub}>“{sms.body}”</span>
              </>
            ) : (
              tx("নিরাপদ নম্বর নেই — অফিস/১৬৬৯৯ থেকে জানানো হবে", "No safe number — told via the office / 16699")
            )}
          </Row>
        </div>
        <div className={ui.section}>
          <div className={ui.sectionHead}>{tx("নোট", "Notes")}</div>
          {r.notes.length ? (
            <div className={ui.rows}>
              {r.notes.map((n) => (
                <Row key={n.at} label={new Date(n.at).toLocaleString()}>
                  {n.text}
                  <span className={ui.sub}>{n.byName}</span>
                </Row>
              ))}
            </div>
          ) : (
            <p className={styles.hint}>{tx("এখনো কোনো নোট নেই।", "No notes yet.")}</p>
          )}
          <textarea className={styles.textarea} style={{ marginTop: "var(--s-3)" }} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tx("যোগ্যতার বিবরণ / পরবর্তী পদক্ষেপের নোট", "Eligibility details / notes for the next step")} />
          <div className={ui.bar}>
            <Button
              variant="secondary"
              onClick={() =>
                run(() => {
                  DlaoReviewService.addNote(a.applicationId, note);
                  setNote("");
                })
              }
            >
              {tx("নোট রেকর্ড করুন", "Record note")}
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <StepHead title={tx("আইনি সহায়তার যোগ্য?", "Eligible for legal aid?")} lead={tx("সিদ্ধান্ত শুধুমাত্র আপনার। কারণ লেখা বাধ্যতামূলক, সুপারিশ মানলেও।", "The decision is yours alone. A reason is required, even when you agree with the recommendation.")} />
      <div className={ui.advice}>
        <Tag tone="ink">{tx("সিস্টেমের সুপারিশ", "Advisory")}</Tag> <Tag tone={recEligible ? "ok" : "err"}>{rec ? pretty(rec) : "—"}</Tag>
      </div>
      <div className={ui.options}>
        <button type="button" className={ui.option} aria-pressed={choice === "ELIGIBLE"} disabled={!canAccept} onClick={() => setChoice("ELIGIBLE")}>
          <span className={ui.optionTitle}>
            <Tag tone="ok">✓</Tag> {tx("হ্যাঁ — যোগ্য", "Yes — eligible")}
          </span>
          <span className={ui.optionText}>{tx("কেস আইডি তৈরি হবে, তারপর কোথায় পাঠাবেন বাছবেন।", "Creates a Case ID; then you choose where to send it.")}</span>
        </button>
        <button type="button" className={ui.option} aria-pressed={choice === "NOT_ELIGIBLE"} onClick={() => setChoice("NOT_ELIGIBLE")}>
          <span className={ui.optionTitle}>
            <Tag tone="err">✗</Tag> {tx("না — বাতিল", "No — reject")}
          </span>
          <span className={ui.optionText}>{tx("কারণসহ বন্ধ হবে; আবেদনকারীকে জানানো হবে।", "Closed with the reason; the applicant is notified.")}</span>
        </button>
      </div>
      {!canAccept ? <p className={styles.errText} style={{ marginTop: "var(--s-2)" }}>{tx("গ্রহণের আগে পরিচয় ও তথ্য যাচাই সম্পূর্ণ হতে হবে।", "Identity and facts must be verified before accepting.")}</p> : null}
      <label className={styles.field} style={{ marginTop: "var(--s-4)" }}>
        <span className={styles.label}>{tx("কারণ (বাধ্যতামূলক, কমপক্ষে ১০ অক্ষর)", "Reason (required, at least 10 characters)")}</span>
        <textarea className={styles.textarea} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className={ui.bar}>
        <Button
          variant={choice === "NOT_ELIGIBLE" ? "destructive" : "primary"}
          disabled={reason.trim().length < 10}
          onClick={() =>
            run(() => {
              DlaoReviewService.decide(a.applicationId, { decision: choice, reason });
              if (choice === "ELIGIBLE") onNext?.();
            })
          }
        >
          {choice === "ELIGIBLE" ? tx("যোগ্য — কেস আইডি তৈরি করুন", "Eligible — create Case ID") : tx("বাতিল করুন ও জানান", "Reject and notify")}
        </Button>
        <span className={styles.hint}>{reason.trim().length}/10</span>
      </div>
    </>
  );
}


function PathwayStep({ a, run }: StepProps) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const r = a.review!;
  const tasks = useDlasDb().tasks.filter((t) => t.applicationId === a.applicationId && (t.type === "GRAM_ADALAT_REFERRAL" || t.type === "MEDIATION_SCHEDULING" || t.type === "LAWYER_ASSIGNMENT" || t.type === "EXTERNAL_REFERRAL" || t.type === "URGENT_SAFETY_REVIEW"));
  // Right after the officer sends the case on, bring the next flow (mediator / lawyer assignment) into view.
  const decided = !!r.pathway;
  const wasDecided = useRef(decided);
  useEffect(() => {
    if (decided && !wasDecided.current) document.getElementById("pathway-next")?.scrollIntoView({ behavior: "smooth", block: "start" });
    wasDecided.current = decided;
  }, [decided]);

  if (r.decision?.decision !== "ELIGIBLE" || !a.caseId) {
    return <p className={styles.hint}>{tx("শুধু গৃহীত কেস (কেস আইডি সহ) পাঠানো যায়।", "Only an accepted case (with a Case ID) can be sent onward.")}</p>;
  }

  if (r.pathway) {
    const p = r.pathway;
    return (
      <>
        <StepHead title={tx("আইনি পথ — চূড়ান্ত", "Legal pathway — decided")} />
        <div className={`${ui.banner} ${ui.bannerOk}`} style={{ marginBottom: "var(--s-4)" }}>
          <span className={ui.bannerIcon} aria-hidden>
            ✓
          </span>
          <div>
            <strong>{tx(`পাঠানো হয়েছে: ${pathwayLabel(p.type, lang)}`, `Sent to: ${pathwayLabel(p.type, lang)}`)}</strong> —{" "}
            {p.type === "MEDIATION" ? tx("পরবর্তী: মধ্যস্থতাকারী নিয়োগ", "next: mediator assignment") : p.type === "LAWYER" ? tx("পরবর্তী: প্যানেল আইনজীবী নিয়োগ", "next: panel lawyer assignment") : p.type === "GRAM_ADALAT" ? tx("পরবর্তী: গ্রাম আদালতে রেফারেল", "next: Gram Adalat referral") : tx("পরবর্তী: রেফারেল", "next: referral")}{" "}
            <button type="button" onClick={() => document.getElementById("pathway-next")?.scrollIntoView({ behavior: "smooth", block: "start" })} style={{ background: "none", border: 0, padding: 0, textDecoration: "underline", cursor: "pointer", font: "inherit", fontWeight: 700 }}>
              {tx("সেখানে যান ↓", "Go to it ↓")}
            </button>
          </div>
        </div>
        {a.pathwayClassification?.final ? (
          <PathwayDecisionRecord a={a} />
        ) : (
          <>
            <div className={`${ui.result} ${ui.bannerOk}`} style={{ border: "1px solid" }}>
              <span className={ui.bannerIcon} style={{ background: "var(--green)" }}>
                ✓
              </span>
              <div>
                <div className={styles.hint}>{a.caseId}</div>
                <div className={ui.resultBig}>{pathwayLabel(p.type, lang)}</div>
              </div>
            </div>
            <p className={styles.hint}>{tx("নিয়ম-ভিত্তিক শ্রেণিবিন্যাস চালুর আগে সিদ্ধান্ত নেওয়া হয়েছে।", "Decided before the rule-based classification existed.")}</p>
          </>
        )}
        <div className={ui.rows}>
          <Row label={tx("পরবর্তী সেবা", "Downstream service")}>{pathwayLabel(p.type, lang)}</Row>
          <Row label={tx("সিদ্ধান্তদাতা", "Decided by")}>
            {p.byName} · {new Date(p.at).toLocaleString()}
          </Row>
          <Row label={tx("পরবর্তী কাজ", "Next task")}>
            {tasks.map((t) => (
              <span key={t.taskId} style={{ display: "block" }}>
                <Tag tone={t.status === "DONE" ? "ok" : "warn"}>{pretty(t.status)}</Tag> {pretty(t.type)} · {pretty(t.assignedRole)} · {tx("শেষ সময়", "due")} {new Date(t.dueAt).toLocaleString()}
              </span>
            ))}
          </Row>
        </div>
        <div id="pathway-next" style={{ scrollMarginTop: 16 }} />
        {p.type === "LAWYER" ? <LawyerAssignPanel a={a} run={run} /> : null}
        {p.type === "MEDIATION" ? <MediatorAssignPanel a={a} run={run} /> : null}
        {p.type === "MEDIATION" && a.mediation ? <MediationRecordPanel a={a} /> : null}
      </>
    );
  }

  return (
    <>
      <StepHead
        title={tx("আইনি পথ", "Legal pathway")}
        lead={tx("নির্ধারিত নিয়ম একটি সম্ভাব্য পথ দেখায়; লিগ্যাল এইড অফিসার নিশ্চিত, পরিবর্তন বা আরও তথ্য চাইবেন।", "Deterministic rules show a possible pathway; the Legal Aid Officer confirms, changes it or asks for more information.")}
      />
      <LegalPathway a={a} run={run} />
    </>
  );
}

function SidePanel({ a }: { a: ApplicationRecord }) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const audit = useMemo(() => [...a.audit].reverse(), [a.audit]);
  return (
    <aside className={ui.aside}>
      <details className={ui.panel}>
        <summary className={ui.panelTitle} style={{ marginBottom: 0 }}>
          <span>
            {tx("অডিট", "Audit trail")} ({a.audit.length})
          </span>
          <span aria-hidden>▾</span>
        </summary>
        <ul className={ui.auditList} style={{ marginTop: "var(--s-3)" }}>
          {audit.map((e) => (
            <li key={e.seq}>
              <span className={ui.auditAction}>{e.action}</span>
              <span className={ui.auditTime}>{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </li>
          ))}
        </ul>
        <a className={ui.link} href="#case-activity" onClick={(ev) => { ev.preventDefault(); document.getElementById("case-activity")?.scrollIntoView({ behavior: "smooth" }); }}>
          {tx("কার্যকলাপ / অডিট ট্রেইল ↓", "Activity / audit trail ↓")}
        </a>{" "}
        <Link className={ui.link} href={`/debug?id=${a.applicationId}`}>
          {tx("পূর্ণ JSON ও অডিট →", "Full JSON & audit →")}
        </Link>
      </details>
    </aside>
  );
}

/* ------------------------------ panel lawyer (LAWYER pathway) ------------------------------ */

const COMPLETION_OUTCOMES = ["WON", "LOST", "SETTLED", "WITHDRAWN_BY_CLIENT", "OTHER"] as const;

function LawyerAssignPanel({ a, run }: StepProps) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const db = useDlasDb();
  const now = useClock();
  const rules = useLawyerRules();
  const sl = activeShortlist(a);
  const latestSl = [...(a.lawyer?.shortlists ?? [])].reverse()[0] ?? null;
  const s = activeAssignment(a);
  const m = a.lawyer;
  const [lawyerId, setLawyerId] = useState("");
  const [note, setNote] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState("");
  const [completing, setCompleting] = useState(false);
  const [outcome, setOutcome] = useState<(typeof COMPLETION_OUTCOMES)[number]>("WON");
  const [doneReason, setDoneReason] = useState("");
  const hearings = [...(m?.hearings ?? [])].sort((x, y) => x.at.localeCompare(y.at));
  const alerts = db.tasks.filter((t) => t.applicationId === a.applicationId && t.status !== "DONE" && (t.type === "LAWYER_UPDATE_OVERDUE" || t.type === "LAWYER_REASSIGN_REVIEW" || t.type === "LAWYER_INACTIVITY_REVIEW" || t.type === "LAWYER_ASSIGNMENT"));
  const reassignAlert = alerts.find((t) => t.type === "LAWYER_REASSIGN_REVIEW");
  const pending = sl?.candidates.filter((c) => c.outcome === "PENDING") ?? [];
  const chosen = lawyerId && pending.some((c) => c.lawyerId === lawyerId) ? lawyerId : (pending[0]?.lawyerId ?? "");
  const nameOf = (assignmentId: string | null) => m?.assignments.find((x) => x.assignmentId === assignmentId)?.lawyerName ?? "—";
  const worked = (m?.assignments ?? []).filter((x) => x.status === "ACCEPTED" || x.status === "WITHDRAWN" || x.status === "COMPLETED");
  const alertTitle = (type: string) =>
    type === "LAWYER_REASSIGN_REVIEW"
      ? tx("শুনানি মিস — অন্য আইনজীবী দিন", "Missed hearings — assign another lawyer")
      : type === "LAWYER_INACTIVITY_REVIEW"
        ? tx("একাধিক মামলায় শুনানি মিস — পর্যালোচনা", "Missed hearings across cases — review")
        : type === "LAWYER_ASSIGNMENT"
          ? tx("আইনজীবী নিয়োগ দিন", "Assign a panel lawyer")
          : tx("আইনজীবীর প্রতিবেদন দেরি", "Lawyer report overdue");

  return (
    <div className={ui.section}>
      <div className={ui.sectionHead}>{tx("প্যানেল আইনজীবী", "Panel lawyer")}</div>

      {alerts.map((t) => (
        <Banner key={t.taskId} tone={t.type === "LAWYER_ASSIGNMENT" ? "warn" : "err"} icon="!">
          <strong>{alertTitle(t.type)}</strong> — {t.reason}
        </Banner>
      ))}

      {m?.completion ? (
        <Banner tone="ok" icon="✓">
          <strong>{tx("প্রতিনিধিত্ব সম্পন্ন", "Representation completed")}</strong> — {pretty(m.completion.outcome)} · {m.completion.reason} · {m.completion.byName} · {formatDateTime(m.completion.at, lang)}
        </Banner>
      ) : null}

      {s ? (
        <>
          <div className={ui.rows}>
            <Row label={tx("আইনজীবী", "Lawyer")}>
              <strong>{s.lawyerName}</strong>
              <Tag tone={s.status === "ACCEPTED" ? "ok" : new Date(s.respondBy).getTime() < now ? "err" : "warn"}>
                {s.status === "ACCEPTED" ? tx("✓ নিয়োগপ্রাপ্ত", "✓ Assigned") : new Date(s.respondBy).getTime() < now ? tx("উত্তর দেননি — দেরি", "No answer — overdue") : tx("উত্তরের অপেক্ষায়", "Offer sent — awaiting answer")}
              </Tag>
              {s.handoverFrom ? <Tag>{tx(`${nameOf(s.handoverFrom)}-এর কাছ থেকে হস্তান্তর`, `Handed over from ${nameOf(s.handoverFrom)}`)}</Tag> : null}
              <span className={ui.sub}>
                {tx("প্রস্তাব", "Offered")} {formatDateTime(s.offeredAt, lang)} ·{" "}
                {s.status === "ACCEPTED" && s.respondedAt ? `${tx("গ্রহণ", "accepted")} ${formatDateTime(s.respondedAt, lang)}` : `${tx("উত্তর দিতে হবে", "respond by")} ${formatDateTime(s.respondBy, lang)}`}
              </span>
            </Row>
            {s.note ? <Row label={tx("নির্দেশনা", "Instructions")}>{s.note}</Row> : null}
            {s.status === "ACCEPTED" ? (
              <Row label={tx("উপস্থিতি", "Attendance")}>
                <Tag tone="ok">{tx(`উপস্থিত ${s.ledger.hearingsAttended}`, `Attended ${s.ledger.hearingsAttended}`)}</Tag>
                <Tag tone={s.ledger.hearingsMissed ? "err" : "neutral"}>{tx(`মিস ${s.ledger.hearingsMissed}/${rules.missedHearingsBeforeReassign}`, `Missed ${s.ledger.hearingsMissed} of ${rules.missedHearingsBeforeReassign} allowed`)}</Tag>
                {s.ledger.hearingsNotHeld ? <Tag>{tx(`হয়নি ${s.ledger.hearingsNotHeld}`, `Not held ${s.ledger.hearingsNotHeld}`)}</Tag> : null}
                {s.ledger.hearingsUnreported ? <Tag tone="warn">{tx(`প্রতিবেদন বাকি ${s.ledger.hearingsUnreported}`, `Report due ${s.ledger.hearingsUnreported}`)}</Tag> : null}
              </Row>
            ) : null}
          </div>
          {withdrawing ? (
            <div className={ui.contactBox} style={{ marginTop: "var(--s-3)" }}>
              <label className={styles.field}>
                <span className={styles.label}>{tx("কেন অন্য আইনজীবী (কমপক্ষে ১০ অক্ষর)", "Why reassign (at least 10 characters)")}</span>
                <textarea className={styles.textarea} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <p className={styles.hint}>
                {tx(
                  "বর্তমান আইনজীবীর প্রবেশাধিকার বাতিল হবে; তাঁর উপস্থিতির হিসাব পেমেন্টের জন্য সংরক্ষিত থাকবে। নতুন আইনজীবী গ্রহণ করলে পুরো ইতিহাস ও নথি দেখতে পাবেন।",
                  "The current lawyer's access is revoked; their attendance record is kept for payment. The new lawyer sees the full history and documents once they accept.",
                )}
              </p>
              <div className={styles.actions} style={{ marginTop: 0 }}>
                <Button
                  variant="destructive"
                  disabled={reason.trim().length < 10}
                  onClick={() =>
                    run(() => {
                      DlaoLawyerService.withdraw(a.applicationId, reason);
                      setWithdrawing(false);
                      setReason("");
                    })
                  }
                >
                  {tx("প্রত্যাহার করে নতুন আইনজীবী বাছুন", "Withdraw & choose another lawyer")}
                </Button>
                <Button variant="secondary" onClick={() => setWithdrawing(false)}>
                  {tx("বাতিল", "Cancel")}
                </Button>
              </div>
            </div>
          ) : !m?.completion ? (
            <div className={ui.bar}>
              <Button
                variant={reassignAlert ? "primary" : "secondary"}
                onClick={() => {
                  setWithdrawing(true);
                  if (reassignAlert && !reason) setReason(tx(`${s.ledger.hearingsMissed}টি শুনানি মিস করেছেন`, `Missed ${s.ledger.hearingsMissed} hearings on this case`));
                }}
              >
                {tx("অন্য আইনজীবী দিন", "Assign another lawyer")}
              </Button>
              {s.status === "ACCEPTED" ? (
                <Button variant="secondary" onClick={() => setCompleting(true)}>
                  {tx("প্রতিনিধিত্ব সম্পন্ন", "Complete representation")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : m?.completion ? null : !sl ? (
        <div className={ui.bar}>
          <Button onClick={() => run(() => DlaoLawyerService.createShortlist(a.applicationId))}>{tx("আইনজীবী নিয়োগ দিন", "Assign lawyer")}</Button>
          <span className={styles.hint}>
            {tx(
              `ইঞ্জিন কাজের চাপ, জয়ের হার, উপস্থিতি ও মামলার ধরন দেখে সেরা ${rules.shortlistSize} জন আইনজীবী বাছবে।`,
              `The engine picks the best ${rules.shortlistSize} lawyers by workload, win rate, attendance and specialisation.`,
            )}
          </span>
        </div>
      ) : (
        <>
          <div className={ui.advice}>
            <Tag tone="ink">{tx(`ইঞ্জিনের সেরা ${sl.candidates.length} — বাছাই আপনার`, `Engine's top ${sl.candidates.length} — you choose`)}</Tag>{" "}
            {tx(
              "একজনকে প্রস্তাব পাঠান। তিনি প্রত্যাখ্যান করলে বা সময়মতো উত্তর না দিলে ইঞ্জিন স্বয়ংক্রিয়ভাবে তালিকার পরের জনকে পাঠাবে।",
              "Send the offer to one lawyer. If they decline or don't answer in time, the engine automatically offers the case to the next lawyer on this list.",
            )}
            <div className={styles.hint} style={{ marginTop: 4 }}>
              {tx("ওজন", "Weights")}: {tx("কাজের চাপ", "workload")} {rules.weights.workload} · {tx("জয়ের হার", "win rate")} {rules.weights.winRate} · {tx("উপস্থিতি", "attendance")} {rules.weights.attendance} · {tx("বিশেষজ্ঞতা", "specialisation")} {rules.weights.specialisation} ({rules.version})
            </div>
          </div>
          <div className={ui.options}>
            {sl.candidates.map((c) => (
              <ShortlistCard key={c.lawyerId} c={c} selected={chosen === c.lawyerId} onSelect={() => setLawyerId(c.lawyerId)} />
            ))}
          </div>
          <label className={styles.field} style={{ marginTop: "var(--s-4)" }}>
            <span className={styles.label}>{tx("আইনজীবীর জন্য নির্দেশনা (ঐচ্ছিক)", "Instructions for the lawyer (optional)")}</span>
            <textarea className={styles.textarea} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className={ui.bar}>
            <Button
              disabled={!chosen}
              onClick={() =>
                run(() => {
                  DlaoLawyerService.assign(a.applicationId, { lawyerId: chosen, note });
                  setNote("");
                  setLawyerId("");
                })
              }
            >
              {tx("নির্বাচিত আইনজীবীকে প্রস্তাব পাঠান", "Send offer to the selected lawyer")}
            </Button>
            <Button variant="secondary" onClick={() => run(() => DlaoLawyerService.createShortlist(a.applicationId))}>
              {tx("নতুন তালিকা", "New shortlist")}
            </Button>
            <span className={styles.hint}>{tx(`প্রত্যেকে ${rules.offerResponseHours} ঘণ্টা সময় পাবেন`, `Each lawyer has ${rules.offerResponseHours} h to answer`)}</span>
          </div>
        </>
      )}

      {latestSl && (s || latestSl.status !== "ACTIVE") ? (
        <div className={ui.section}>
          <div className={ui.sectionHead}>
            {tx("ইঞ্জিনের তালিকা ও প্রস্তাবের ধারা", "Engine shortlist & offer chain")}{" "}
            <Tag tone={latestSl.status === "ACCEPTED" ? "ok" : latestSl.status === "EXHAUSTED" ? "err" : latestSl.status === "ACTIVE" ? "warn" : "neutral"}>{pretty(latestSl.status)}</Tag>
          </div>
          <div className={ui.rows}>
            {latestSl.candidates.map((c) => {
              const asn = a.lawyer?.assignments.find((x) => x.shortlistId === latestSl.shortlistId && x.lawyerId === c.lawyerId);
              return (
                <Row key={c.lawyerId} label={`#${c.rank} · ${c.score}/100`}>
                  <strong>{c.name}</strong>
                  <Tag tone={c.outcome === "ACCEPTED" ? "ok" : c.outcome === "DECLINED" || c.outcome === "NO_RESPONSE" ? "err" : c.outcome === "OFFERED" ? "warn" : "neutral"}>
                    {c.outcome === "PENDING" ? tx("অপেক্ষমাণ", "Not asked yet") : c.outcome === "OFFERED" ? tx("প্রস্তাব পাঠানো", "Offer sent") : c.outcome === "ACCEPTED" ? tx("✓ গ্রহণ", "✓ Accepted") : c.outcome === "DECLINED" ? tx("প্রত্যাখ্যান", "Declined") : tx("উত্তর দেননি", "No answer")}
                  </Tag>
                  {asn?.offeredVia === "AUTO_NEXT" ? <Tag>{tx("ইঞ্জিন স্বয়ংক্রিয়ভাবে পাঠিয়েছে", "Auto-offered by the engine")}</Tag> : asn ? <Tag>{tx("আপনার বাছাই", "Your choice")}</Tag> : null}
                  {c.reason ? <span className={ui.sub}>“{c.reason}”</span> : null}
                  {c.offeredAt ? <span className={ui.sub}>{tx("প্রস্তাব", "Offered")} {formatDateTime(c.offeredAt, lang)}</span> : null}
                </Row>
              );
            })}
          </div>
        </div>
      ) : null}

      {completing && !m?.completion ? (
        <div className={ui.contactBox} style={{ marginTop: "var(--s-3)" }}>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>{tx("ফলাফল", "Outcome")}</span>
              <select className={styles.select} value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
                {COMPLETION_OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {pretty(o)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{tx("কারণ / বিবরণ (কমপক্ষে ১০ অক্ষর)", "Reason / details (at least 10 characters)")}</span>
              <input className={styles.input} value={doneReason} onChange={(e) => setDoneReason(e.target.value)} />
            </label>
          </div>
          <p className={styles.hint}>{tx("সব আইনজীবীর উপস্থিত শুনানির হিসাব পেমেন্ট পর্যালোচনায় যাবে।", "Every lawyer's attended-hearing count moves to payment review.")}</p>
          <div className={styles.actions} style={{ marginTop: 0 }}>
            <Button
              disabled={doneReason.trim().length < 10}
              onClick={() =>
                run(() => {
                  DlaoLawyerService.complete(a.applicationId, { outcome, reason: doneReason });
                  setCompleting(false);
                })
              }
            >
              {tx("সম্পন্ন করুন", "Complete")}
            </Button>
            <Button variant="secondary" onClick={() => setCompleting(false)}>
              {tx("বাতিল", "Cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      {hearings.length ? (
        <div className={ui.section}>
          <div className={ui.sectionHead}>{tx("শুনানি (সব আইনজীবী)", "Hearings (all lawyers)")}</div>
          <div className={ui.rows}>
            {hearings.map((h) => {
              const st = hearingState(h, now);
              const missed = hearingMissed(h, now);
              const u = m?.updates.find((x) => x.updateId === h.updateId);
              return (
                <Row key={h.hearingId} label={formatDateTime(h.at, lang)}>
                  <span>{h.court}</span>
                  <Tag>{nameOf(h.assignmentId)}</Tag>
                  <Tag tone={h.result === "ATTENDED" ? "ok" : missed ? "err" : st === "UPDATE_DUE" ? "warn" : "neutral"}>
                    {h.result === "ATTENDED"
                      ? tx("✓ উপস্থিত", "✓ Attended")
                      : h.result === "NOT_HELD"
                        ? tx("শুনানি হয়নি", "Not held")
                        : h.result === "MISSED"
                          ? tx("✗ মিস (আইনজীবীর প্রতিবেদন)", "✗ Missed (lawyer reported)")
                          : missed
                            ? tx("✗ মিস — প্রতিবেদন আসেনি", "✗ Missed — no report")
                            : st === "UPDATE_DUE"
                              ? tx("প্রতিবেদন বাকি", "Report due")
                              : tx("আসন্ন", "Upcoming")}
                  </Tag>
                  {u ? (
                    <span className={ui.sub}>
                      {pretty(u.outcome)} · “{u.note}” {u.late ? `· ${tx("দেরিতে", "late")}` : ""} <Tag>{tx("আইনজীবীর প্রতিবেদন", "Lawyer reported")}</Tag>
                    </span>
                  ) : null}
                </Row>
              );
            })}
          </div>
        </div>
      ) : null}

      {worked.length ? (
        <div className={ui.section}>
          <div className={ui.sectionHead}>{tx("উপস্থিতি ও পেমেন্ট হিসাব", "Attendance & payment ledger")}</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{tx("আইনজীবী", "Lawyer")}</th>
                  <th>{tx("উপস্থিত", "Attended")}</th>
                  <th>{tx("মিস", "Missed")}</th>
                  <th>{tx("হয়নি", "Not held")}</th>
                  <th>{tx("প্রতিবেদন সময়মতো / দেরিতে", "Reports on time / late")}</th>
                  <th>{tx("পেমেন্ট", "Payment")}</th>
                </tr>
              </thead>
              <tbody>
                {worked.map((x) => (
                  <tr key={x.assignmentId}>
                    <td>
                      {x.lawyerName} <Tag tone={x.status === "WITHDRAWN" ? "warn" : x.status === "COMPLETED" ? "ok" : "neutral"}>{pretty(x.status)}</Tag>
                    </td>
                    <td>{x.ledger.hearingsAttended}</td>
                    <td style={x.ledger.hearingsMissed ? { color: "var(--red)", fontWeight: 600 } : undefined}>{x.ledger.hearingsMissed}</td>
                    <td>{x.ledger.hearingsNotHeld}</td>
                    <td>
                      {x.ledger.updatesOnTime} / {x.ledger.updatesLate}
                    </td>
                    <td>
                      {x.payment ? (
                        <>
                          <Tag tone={x.payment.status === "DLAO_REVIEW" ? "ok" : x.payment.status === "PENDING_CASE_COMPLETION" ? "warn" : "neutral"}>{pretty(x.payment.status)}</Tag>
                          <div className={styles.hint}>
                            {tx(`${x.payment.payableHearings}টি শুনানি × জেলা ফি`, `${x.payment.payableHearings} hearing(s) × district fee`)} ({x.payment.eligibleAmount})
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.hint}>{rules.feeBasis}</p>
        </div>
      ) : null}

      {m?.access.length ? (
        <div className={ui.section}>
          <div className={ui.sectionHead}>{tx("মামলার রেকর্ডে প্রবেশাধিকার", "Access to the case record")}</div>
          <div className={ui.rows}>
            {m.access.map((g) => (
              <Row key={g.assignmentId} label={g.lawyerName}>
                {g.revokedAt ? <Tag tone="err">{tx("বাতিল", "Revoked")}</Tag> : <Tag tone="ok">{tx("সক্রিয়", "Active")}</Tag>}
                <span className={ui.sub}>
                  {tx("দেওয়া", "Granted")} {formatDateTime(g.grantedAt, lang)}
                  {g.revokedAt ? ` · ${tx("বাতিল", "revoked")} ${formatDateTime(g.revokedAt, lang)} — ${g.revokeReason ?? ""}` : ""}
                </span>
              </Row>
            ))}
          </div>
        </div>
      ) : null}

      {(m?.assignments ?? []).filter((x) => x.status === "DECLINED").length ? (
        <div className={ui.rows} style={{ marginTop: "var(--s-3)" }}>
          {m!.assignments
            .filter((x) => x.status === "DECLINED")
            .map((x) => (
              <Row key={x.assignmentId} label={tx("প্রত্যাখ্যান", "Declined")}>
                {x.lawyerName} <span className={ui.sub}>“{x.declineReason}”</span>
              </Row>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function ShortlistCard({ c, selected, onSelect }: { c: import("@/lib/dlas").ShortlistCandidate; selected: boolean; onSelect: () => void }) {
  const { lang } = useI18n();
  const tx = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const rules = useLawyerRules();
  const st = c.stats;
  const asked = c.outcome !== "PENDING";
  return (
    <button type="button" className={ui.option} aria-pressed={selected} disabled={asked} onClick={onSelect}>
      <span className={ui.optionTitle}>
        #{c.rank} {c.name} <Tag tone={c.rank === 1 ? "ok" : "neutral"}>{c.score}/100</Tag>
        {c.rank === 1 && !asked ? <Tag tone="ok">{tx("শীর্ষ পছন্দ", "Top pick")}</Tag> : null}
        {st.absentToday ? <Tag tone="err">{tx("আজ অনুপস্থিত", "Absent today")}</Tag> : null}
        {st.redFlagged ? <Tag tone="err" title={tx(`${st.declines ?? 0}টি প্রস্তাব প্রত্যাখ্যান`, `${st.declines ?? 0} offers declined`)}>🚩 {tx("লাল পতাকা", "Red flag")}</Tag> : null}
        {asked ? <Tag tone={c.outcome === "ACCEPTED" ? "ok" : c.outcome === "OFFERED" ? "warn" : "err"}>{pretty(c.outcome)}</Tag> : null}
      </span>
      <span className={ui.optionText}>
        {tx("কাজের চাপ", "Workload")} {c.breakdown.workload}/{rules.weights.workload} ({st.activeCases}/{st.capacity} {tx("চলমান", "active")}) · {tx("জয়", "Win")} {c.breakdown.winRate}/{rules.weights.winRate} (
        {st.winPct == null ? tx("রেকর্ড নেই", "no record") : `${st.winPct}% · ${st.won}W ${st.lost}L`}) · {tx("উপস্থিতি", "Attendance")} {c.breakdown.attendance}/{rules.weights.attendance} (
        {st.attendancePct == null ? tx("রেকর্ড নেই", "no record") : `${st.attendancePct}% · ${st.presentDays}/${st.presentDays + st.absentDays} ${tx("দিন", "days")}`}) · {tx("বিশেষজ্ঞতা", "Specialisation")} {c.breakdown.specialisation}/{rules.weights.specialisation}
      </span>
    </button>
  );
}
