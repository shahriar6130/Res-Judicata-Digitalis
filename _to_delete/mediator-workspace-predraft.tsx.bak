"use client";

/* ------------------------------------------------------------------ *
 *  /dashboard/mediator — MEDIATION WORKSPACE (Feature 4)
 *    #cases                 my mediations
 *    #case/<APP-ID>[/<tab>]  one case: overview · documents · session ·
 *                            caucus · settlement · outcome · audit
 *  Reads only the need-to-know view (lib/dlas/mediation-workspace.ts);
 *  every action is audited on the case with role "mediator".
 * ------------------------------------------------------------------ */

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { DocViewButton } from "@/components/dlas/doc-viewer";
import { useI18n } from "@/lib/i18n";
import {
  DISTRICTS,
  DOC_TYPES,
  LANGUAGES,
  MATTERS,
  MEDIATION_CASE_TYPES,
  MEDIATION_CHANNELS,
  MEDIATOR_STATUSES,
  MediationWorkspaceService,
  MediatorOfferService,
  SETTLEMENT_LISTS,
  connectivityLimited,
  confidentialCaucusNotes,
  finalOutcome,
  transportOf,
  formatDateTime,
  label,
  lbl,
  useCurrentMediator,
  useMediatorCase,
  useMyMediations,
  useMyMediatorOffers,
  useMediatorOfferSweep,
  useStoredFile,
  type ApplicationRecord,
  type LanguageCode,
  type MediationChannel,
  type MediationOutcome,
  type MediationWorkspace,
  type OnlineConnectionState,
  type OnlineParticipantKey,
  type MediatorCaseView,
  type PartySide,
  type SettlementList,
  type WorkspaceStatus,
  type FailureReferralPathway,
} from "@/lib/dlas";
import styles from "@/components/dlas/dlas.module.css";
import ui from "@/components/dlao/dlao.module.css";

type Tone = "ok" | "err" | "warn" | "ink" | "neutral";
type Lang = "bn" | "en";

const ORIGIN_LABEL = {
  PRE_LITIGATION: { bn: "মামলা-পূর্ব", en: "Pre-Litigation" },
  MANDATORY_PRE_CASE: { bn: "বাধ্যতামূলক প্রাক-মামলা", en: "Mandatory Pre-Case" },
  COURT_REFERRED: { bn: "আদালত-প্রেরিত", en: "Court-Referred" },
  APPELLATE_REFERRAL: { bn: "আপিল রেফারেল", en: "Appellate Referral" },
} as const;

function Tag({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${ui.tag} ${tone !== "neutral" ? ui[tone] : ""}`}>{children}</span>;
}
function Row({ label: l, children }: { label: string; children: ReactNode }) {
  return (
    <div className={ui.row}>
      <div className={ui.rowLabel}>{l}</div>
      <div className={ui.rowValue}>{children}</div>
    </div>
  );
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
function useTx() {
  const { lang } = useI18n();
  return { lang: lang as Lang, tx: (bn: string, en: string) => (lang === "bn" ? bn : en) };
}
function useRun() {
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const run = (fn: () => unknown, ok?: string) => {
    try {
      fn();
      setMsg(ok ? { tone: "ok", text: ok } : null);
      return true;
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : String(e) });
      return false;
    }
  };
  const node = msg ? (
    <Banner tone={msg.tone} icon={msg.tone === "ok" ? "✓" : "!"}>
      {msg.text}
    </Banner>
  ) : null;
  return { run, node };
}

const STATUS_LABEL: Record<WorkspaceStatus, { bn: string; en: string; tone: Tone }> = {
  NOT_SCHEDULED: { bn: "সময় নির্ধারিত হয়নি", en: "Not scheduled", tone: "warn" },
  SCHEDULED: { bn: "নির্ধারিত", en: "Scheduled", tone: "ink" },
  IN_PROGRESS: { bn: "চলছে", en: "In progress", tone: "ok" },
  PAUSED: { bn: "বিরতি", en: "Paused", tone: "warn" },
  AWAITING_OUTCOME: { bn: "ফলাফলের অপেক্ষায়", en: "Awaiting outcome", tone: "warn" },
  OUTCOME_RECORDED: { bn: "ফলাফল নথিভুক্ত", en: "Outcome recorded", tone: "ok" },
};
const OUTCOME_LABEL: Record<MediationOutcome["kind"], { bn: string; en: string }> = {
  SETTLEMENT_REACHED: { bn: "নিষ্পত্তি হয়েছে", en: "Settlement reached" },
  MEDIATION_FAILED: { bn: "মধ্যস্থতা ব্যর্থ", en: "Mediation failed" },
  NEEDS_FOLLOW_UP: { bn: "ফলো-আপ দরকার", en: "Needs follow-up" },
  ADJOURNED: { bn: "মুলতবি", en: "Adjourned" },
};
const CONTACT_LABEL: Record<string, { bn: string; en: string }> = {
  CALL: { bn: "ফোন কল", en: "Phone call" },
  SMS: { bn: "এসএমএস", en: "SMS" },
  VIA_REPRESENTATIVE: { bn: "প্রতিনিধির মাধ্যমে", en: "Through a representative" },
  VISIT_OFFICE: { bn: "অফিসে এসে", en: "Visits the office" },
};
const SAFE_TIME: Record<string, { bn: string; en: string }> = {
  MORNING: { bn: "সকাল", en: "Morning" },
  AFTERNOON: { bn: "বিকাল", en: "Afternoon" },
  EVENING: { bn: "সন্ধ্যা", en: "Evening" },
  ANYTIME: { bn: "যেকোনো সময়", en: "Any time" },
};
const ACCESS_NEED: Record<string, { bn: string; en: string }> = {
  VISUAL: { bn: "দৃষ্টি", en: "Visual" },
  HEARING: { bn: "শ্রবণ", en: "Hearing" },
  LOW_LITERACY: { bn: "পড়তে অসুবিধা", en: "Low literacy" },
  SPEECH: { bn: "কথা বলা", en: "Speech" },
};

function useHash() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => window.location.hash.replace(/^#/, ""),
    () => "",
  );
}

/* ================================================================== */

export function MediatorWorkspace() {
  const { lang, tx } = useTx();
  const me = useCurrentMediator();
  const hash = useHash();
  const router = useRouter();
  if (!me) {
    return (
      <div style={{ maxWidth: 560 }}>
        <h1 className={styles.title}>{tx("মধ্যস্থতা কার্যক্ষেত্র", "Mediation workspace")}</h1>
        <Banner tone="warn" icon="i">
          {tx("মধ্যস্থতাকারী হিসেবে লগইন করুন।", "Log in as a mediator.")}
        </Banner>
        <Button onClick={() => router.push("/mediator")}>{tx("লগইন / সাইন আপ →", "Log in / sign up →")}</Button>
      </div>
    );
  }
  const status = me.status !== "ACTIVE" ? (
    <Banner tone={me.status === "SUSPENDED" ? "err" : "warn"} icon="i">
      {tx("আপনার রেজিস্ট্রি অবস্থা:", "Your registry status:")} <strong>{lbl(MEDIATOR_STATUSES, me.status, lang)}</strong>
      {me.statusReason ? ` — ${me.statusReason}` : ""}. {tx("শুধু সক্রিয় মধ্যস্থতাকারীকে নতুন মামলা দেওয়া হয়।", "Only active mediators receive new cases.")}
    </Banner>
  ) : null;
  if (hash.startsWith("case/")) {
    const [id, tab] = hash.slice(5).split("/");
    return <CaseWorkspace key={id} id={decodeURIComponent(id)} tab={tab ?? "overview"} />;
  }
  return (
    <>
      {status}
      <MyMediations />
    </>
  );
}

/* ------------------------------ my cases ------------------------------ */

function MyMediations() {
  const { lang, tx } = useTx();
  const { me, active, past } = useMyMediations();
  return (
    <>
      <h1 className={styles.title}>{tx("আমার মধ্যস্থতা", "My mediations")}</h1>
      <p className={styles.lead}>
        {me?.name} · {label(DISTRICTS, me?.district ?? null, lang)} · {tx("শুধু আপনাকে নিয়োগ করা মামলা। কর্মকর্তা কেস প্রস্তাব করেন; আপনি গ্রহণ করলে তবেই নিয়োগ হয়।", "Only cases assigned to you. The Legal Aid Officer offers a case; it is assigned only when you accept.")}
      </p>
      <CaseOffers />
      {active.length === 0 ? (
        <Banner tone="warn" icon="i">
          {tx("এখন কোনো মামলা আপনাকে নিয়োগ করা নেই।", "No case is assigned to you right now.")}
        </Banner>
      ) : (
        <div style={{ display: "grid", gap: "var(--s-3)" }}>
          {active.map(({ a, status, next }) => (
            <a key={a.applicationId} href={`#case/${a.applicationId}`} className={ui.flowStep} style={{ display: "grid", gap: 6, textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <strong style={{ fontSize: "var(--t-sub)" }}>{a.caseId}</strong>
                <Tag tone={STATUS_LABEL[status].tone}>{STATUS_LABEL[status][lang]}</Tag>
              </div>
              <div>
                {label(MATTERS, a.data.matter.category, lang)} · {lbl(MEDIATION_CASE_TYPES, a.mediation?.caseType ?? null, lang)} · <Tag tone={a.mediation?.track === "COURT_REFERRED" ? "ink" : "ok"}>{ORIGIN_LABEL[a.mediation?.origin ?? (a.mediation?.track === "COURT_REFERRED" ? "COURT_REFERRED" : "PRE_LITIGATION")][lang]}</Tag>
              </div>
              <div className={styles.hint}>{next?.scheduledFor ? `${tx("পরের সেশন", "Next session")}: ${formatDateTime(next.scheduledFor, lang)} · ${lbl(MEDIATION_CHANNELS, next.channel, lang)}` : tx("সেশন নির্ধারণ বাকি", "Session not scheduled yet")}</div>
              <span className={ui.textBtn}>{tx("কার্যক্ষেত্র খুলুন →", "Open workspace →")}</span>
            </a>
          ))}
        </div>
      )}
      {past.length ? (
        <details style={{ marginTop: "var(--s-5)" }}>
          <summary style={{ cursor: "pointer" }}>{tx(`আগের মামলা (${past.length}) — প্রবেশাধিকার শেষ`, `Earlier cases (${past.length}) — access ended`)}</summary>
          <div className={ui.rows} style={{ marginTop: 8 }}>
            {past.map(({ a, assignment, outcome }) => (
              <Row key={a.applicationId} label={a.caseId ?? a.applicationId}>
                {assignment.status} {outcome ? `· ${OUTCOME_LABEL[outcome.kind][lang]}` : ""} {assignment.endReason ? `· ${assignment.endReason}` : ""}
              </Row>
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

/* ------------------------------ case offers ------------------------------ */

/** Cases the office has offered to me: accept or decline. No personal data of the parties is shown before acceptance. */
function CaseOffers() {
  const { lang, tx } = useTx();
  const offers = useMyMediatorOffers();
  useMediatorOfferSweep();
  const { run, node } = useRun();
  const [declining, setDeclining] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  if (!offers.length && !node) return null;
  return (
    <section id="offers" aria-label={tx("কেস প্রস্তাব", "Case offers")} style={{ marginBottom: "var(--s-5)" }}>
      <div className={ui.sectionHead}>
        {tx("কেস প্রস্তাব — আপনার উত্তরের অপেক্ষায়", "CASE OFFERS — WAITING FOR YOUR ANSWER")} ({offers.length})
      </div>
      {node}
      <div style={{ display: "grid", gap: "var(--s-3)" }}>
        {offers.map(({ a, offer }) => {
          const o = offer.offer!;
          return (
            <article key={a.applicationId} className={`${ui.flowStep} ${ui.suggest}`}>
              <span className={ui.suggestBadge}>{tx("মধ্যস্থতাকারীর সিদ্ধান্ত প্রয়োজন", "MEDIATOR ACTION")}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <strong style={{ fontSize: "var(--t-sub)" }}>{a.caseId}</strong>
                <Tag tone="warn">
                  {tx("উত্তর দিন", "Answer by")} {formatDateTime(o.respondBy, lang)}
                </Tag>
              </div>
              <div>
                {label(MATTERS, a.data.matter.category, lang)} · {lbl(MEDIATION_CASE_TYPES, a.mediation?.caseType ?? null, lang)} · <Tag tone={a.mediation?.track === "COURT_REFERRED" ? "ink" : "ok"}>{ORIGIN_LABEL[a.mediation?.origin ?? (a.mediation?.track === "COURT_REFERRED" ? "COURT_REFERRED" : "PRE_LITIGATION")][lang]}</Tag> · {a.routing.office}
              </div>
              <div className={styles.hint}>
                {o.via === "AUTO_NEXT" ? tx("আগের মধ্যস্থতাকারী গ্রহণ করেননি — সিস্টেম আপনাকে পরের পছন্দ হিসেবে পাঠিয়েছে।", "The previous mediator did not take it — the system offered it to you as the next pick.") : `${tx("প্রস্তাব পাঠিয়েছেন", "Offered by")} ${offer.recommendedByName}`} · {formatDateTime(o.offeredAt, lang)}
                {offer.recommendationNote && o.via !== "AUTO_NEXT" ? ` · “${offer.recommendationNote}”` : ""}
              </div>
              <div className={styles.hint}>{tx("পক্ষদের ব্যক্তিগত তথ্য গ্রহণ করার পরেই দেখা যাবে। স্বার্থের সংঘাত থাকলে প্রত্যাখ্যান করুন।", "The parties' details become visible only after you accept. If you have a conflict of interest, decline.")}</div>
              {declining === a.applicationId ? (
                <div style={{ marginTop: 6 }}>
                  <label className={styles.field}>
                    <span className={styles.label}>{tx("প্রত্যাখ্যানের কারণ (কর্মকর্তা দেখবেন)", "Reason for declining (the officer will see it)")}</span>
                    <input className={styles.input} value={why} onChange={(e) => setWhy(e.target.value)} placeholder={tx("যেমন: এই সপ্তাহে সময় নেই / স্বার্থের সংঘাত", "e.g. not available this week / conflict of interest")} />
                  </label>
                  <div className={styles.actions} style={{ marginTop: 6 }}>
                    <Button
                      variant="destructive"
                      disabled={why.trim().length < 5}
                      onClick={() => {
                        if (run(() => MediatorOfferService.decline(a.applicationId, why), tx("প্রত্যাখ্যান করা হয়েছে — কর্মকর্তাকে জানানো হয়েছে; কেসটি স্বয়ংক্রিয়ভাবে পরের জনের কাছে যাবে।", "Declined — the office has been told and the case moves to the next mediator automatically."))) {
                          setDeclining(null);
                          setWhy("");
                        }
                      }}
                    >
                      {tx("প্রত্যাখ্যান নিশ্চিত", "Confirm decline")}
                    </Button>
                    <Button variant="secondary" onClick={() => setDeclining(null)}>
                      {tx("বাতিল", "Cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={styles.actions} style={{ marginTop: 6 }}>
                  <Button onClick={() => run(() => MediatorOfferService.accept(a.applicationId), tx("গ্রহণ করা হয়েছে — কেসটি এখন আপনার তালিকায়; অফিসকে জানানো হয়েছে।", "Accepted — the case is now in your list and the office has been told."))}>✓ {tx("গ্রহণ করুন", "Accept case")}</Button>
                  <Button variant="secondary" onClick={() => setDeclining(a.applicationId)}>
                    {tx("প্রত্যাখ্যান…", "Decline…")}
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------ one case ------------------------------ */

const TABS = [
  { key: "overview", bn: "সারসংক্ষেপ", en: "Overview" },
  { key: "documents", bn: "নথি", en: "Documents" },
  { key: "session", bn: "সেশন", en: "Session" },
  { key: "caucus", bn: "গোপন আলোচনা", en: "Private caucus" },
  { key: "settlement", bn: "নিষ্পত্তি আলোচনা", en: "Settlement" },
  { key: "outcome", bn: "ফলাফল", en: "Outcome" },
  { key: "audit", bn: "অডিট", en: "Audit trail" },
] as const;

function CaseWorkspace({ id, tab }: { id: string; tab: string }) {
  const { lang, tx } = useTx();
  const c = useMediatorCase(id);
  const allowed = c.allowed;
  useEffect(() => {
    if (!allowed) return;
    try {
      MediationWorkspaceService.open(id);
    } catch {
      /* access re-checked on every action */
    }
  }, [allowed, id]);

  if (!c.allowed) {
    return (
      <>
        <a className={styles.crumb} href="#cases">
          ← {tx("আমার মধ্যস্থতা", "My mediations")}
        </a>
        <Banner tone="err" icon="!">
          {c.reason === "NO_ACCESS" ? tx("আপনি এই মামলার নিয়োগকৃত মধ্যস্থতাকারী নন, বা আপনার প্রবেশাধিকার শেষ হয়েছে।", "You are not the assigned mediator for this case, or your access has ended.") : tx("মামলা পাওয়া যায়নি।", "Case not found.")}
        </Banner>
      </>
    );
  }
  const { view, ws, status, me } = c;
  const active = TABS.some((t) => t.key === tab) ? tab : "overview";
  const fin = finalOutcome(ws);
  const headSession = ws?.sessions.find((x) => x.status === "IN_PROGRESS" || x.status === "PAUSED") ?? ws?.sessions.find((x) => x.status === "SCHEDULED") ?? null;

  return (
    <>
      <a className={styles.crumb} href="#cases">
        ← {tx("আমার মধ্যস্থতা", "My mediations")}
      </a>

      <header className={ui.wsHeader}>
        <div className={ui.wsEyebrow}>{tx("মধ্যস্থতা কার্যক্ষেত্র", "MEDIATION WORKSPACE")}</div>
        <div className={ui.wsHeadGrid}>
          <div>
            <div className={ui.wsKey}>{tx("কেস আইডি", "Case ID")}</div>
            <div className={ui.wsCaseId}>{view.caseId}</div>
          </div>
          <div>
            <div className={ui.wsKey}>{tx("মধ্যস্থতার ধরন", "Mediation type")}</div>
            <div className={ui.wsVal}>
              <Tag tone={view.track === "COURT_REFERRED" ? "ink" : "ok"}>{ORIGIN_LABEL[view.origin][lang]}</Tag>
            </div>
          </div>
          <div>
            <div className={ui.wsKey}>{tx("অবস্থা", "Status")}</div>
            <div className={ui.wsVal}>
              <Tag tone={STATUS_LABEL[status].tone}>{fin ? OUTCOME_LABEL[fin.kind][lang] : STATUS_LABEL[status][lang]}</Tag>
            </div>
          </div>
          <div>
            <div className={ui.wsKey}>{tx("মাধ্যম", "Channel")}</div>
            <div className={ui.wsVal}>
              {headSession ? `${CHANNEL_ICON[headSession.channel]} ${lbl(MEDIATION_CHANNELS, headSession.channel, lang)}` : "—"}
              {connectivityLimited(ws, headSession) ? <div className={ui.limitedPill}>📶 {tx("সীমিত সংযোগ", "LIMITED CONNECTIVITY")}</div> : null}
            </div>
          </div>
          <div>
            <div className={ui.wsKey}>{tx("মধ্যস্থতাকারী", "Mediator")}</div>
            <div className={ui.wsVal}>
              {me?.name} {me?.sample ? <Tag tone="ink">{tx("নমুনা", "SAMPLE")}</Tag> : null}
            </div>
          </div>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label={tx("কার্যক্ষেত্রের অংশ", "Workspace sections")} style={{ marginTop: "var(--s-4)" }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={active === t.key} className={styles.tab} onClick={() => (window.location.hash = `case/${id}${t.key === "overview" ? "" : `/${t.key}`}`)}>
            {lang === "bn" ? t.bn : t.en}
            {t.key === "session" && (status === "IN_PROGRESS" || status === "PAUSED") ? " ●" : ""}
          </button>
        ))}
      </div>

      {active === "overview" ? <Overview id={id} view={view} ws={ws} /> : null}
      {active === "documents" ? <Documents id={id} view={view} /> : null}
      {active === "session" ? <Session id={id} ws={ws} locked={!!fin} view={view} /> : null}
      {active === "caucus" ? <Caucus id={id} ws={ws} locked={!!fin} /> : null}
      {active === "settlement" ? <Settlement id={id} ws={ws} locked={!!fin} /> : null}
      {active === "outcome" ? <Outcome id={id} ws={ws} /> : null}
      {active === "audit" ? <Audit entries={c.audit} /> : null}
    </>
  );
}

/* ------------------------------ 1–2 & 4: overview ------------------------------ */

function Overview({ id, view, ws }: { id: string; view: MediatorCaseView; ws: MediationWorkspace | null }) {
  const { lang, tx } = useTx();
  const { run, node } = useRun();
  const acc = ws?.access;
  const rsp = ws?.respondent;
  const [channel, setChannel] = useState<MediationChannel | null>(acc?.channel ?? null);
  const [conn, setConn] = useState(acc?.connectivity ?? "UNKNOWN");
  const [language, setLanguage] = useState<LanguageCode | null>(acc?.language ?? view.applicant.language);
  const [interp, setInterp] = useState(acc?.interpreter ?? false);
  const [notes, setNotes] = useState(acc?.accessibilityNotes ?? "");
  const [rContact, setRContact] = useState(rsp?.contactPreference ?? "");
  const [rRep, setRRep] = useState(rsp?.representation ?? "UNKNOWN");
  const [rRepName, setRRepName] = useState(rsp?.representativeName ?? "");
  const [rVer, setRVer] = useState(rsp?.verification ?? "NAMED_BY_APPLICANT");
  const ap = view.applicant;
  const contactWindow = ap.contact.window ? `${ap.contact.window.day} ${ap.contact.window.time}` : ap.contact.safeTime ? SAFE_TIME[ap.contact.safeTime][lang] : tx("উল্লেখ নেই", "Not given");
  return (
    <div style={{ display: "grid", gap: "var(--s-4)" }}>
      {node}
      {/* SECTION 1 */}
      <section className={ui.flowStep}>
        <div className={ui.flowLabel}>
          <span className={ui.flowNum}>1</span>
          {tx("পাবলিক কেস রেকর্ড · মামলার সারসংক্ষেপ", "PUBLIC CASE RECORD · Case summary")}
        </div>
        <div className={ui.rows}>
          <Row label={tx("কেস আইডি", "Case ID")}>{view.caseId}</Row>
          <Row label={tx("বিরোধের ধরন", "Dispute type")}>
            {label(MATTERS, view.disputeCategory, lang)}
            {view.disputeSubcategory ? ` — ${view.disputeSubcategory[lang]}` : ""}
            {view.caseType && lbl(MEDIATION_CASE_TYPES, view.caseType, lang) !== view.disputeSubcategory?.[lang] ? ` · ${lbl(MEDIATION_CASE_TYPES, view.caseType, lang)}` : ""}
          </Row>
          <Row label={tx("মামলার পর্যায়", "Case stage")}>{view.stage === "SERVICE_DELIVERY" ? tx("সেবা প্রদান — মধ্যস্থতা", "Service delivery — mediation") : view.stage}</Row>
          <Row label={tx("আইনি পথ", "Legal pathway")}>{view.pathwayLabel}</Row>
          <Row label={tx("মধ্যস্থতার উৎস", "Mediation origin")}><Tag tone={view.track === "COURT_REFERRED" ? "ink" : view.mandatory ? "warn" : "ok"}>{ORIGIN_LABEL[view.origin][lang]}</Tag></Row>
          {view.courtRef ? (
            <Row label={tx("আদালতের রেফারেন্স", "Court reference")}>
              {[view.courtRef.courtName, view.courtRef.courtLevel?.replaceAll("_", " "), view.courtRef.caseNumber, view.courtRef.referralDate, view.courtRef.referralOrderReference, view.courtRef.referringAuthority, view.courtRef.currentLitigationStage?.replaceAll("_", " "), view.courtRef.referralDeadline].filter(Boolean).join(" · ") || "—"}
            </Row>
          ) : null}
          <Row label={tx("তৈরির তারিখ", "Date created")}>{formatDateTime(view.createdAt, lang)}</Row>
          <Row label={tx("দায়িত্বপ্রাপ্ত কর্মকর্তা", "Assigned officer")}>{view.officer ?? "—"}</Row>
          <Row label={tx("নিয়োগকৃত মধ্যস্থতাকারী", "Assigned mediator")}>
            {view.assignedBy ? `${tx("নিয়োগ দিয়েছেন", "assigned by")} ${view.assignedBy}${view.assignedAt ? ` · ${formatDateTime(view.assignedAt, lang)}` : ""}` : "—"}
          </Row>
          {view.summary ? <Row label={tx("আবেদনকারীর বিবরণ", "Applicant's account")}>{view.summary}</Row> : null}
        </div>
      </section>

      {/* SECTION 2 */}
      <section className={ui.flowStep}>
        <div className={ui.flowLabel}>
          <span className={ui.flowNum}>2</span>
          {tx("পক্ষসমূহ", "Parties")}
        </div>
        <div className={ui.pair}>
          <div>
            <div className={ui.sectionHead}>{tx("আবেদনকারী", "Applicant")}</div>
            <div className={ui.rows}>
              <Row label={tx("নাম", "Name")}>{ap.name ?? "—"}</Row>
              <Row label={tx("যাচাই", "Verification")}>{ap.identityVerified ? <Tag tone="ok">✓ {tx("কর্মকর্তা পরিচয় যাচাই করেছেন", "Identity verified by the officer")}</Tag> : <Tag tone="warn">{tx("যাচাই হয়নি", "Not verified")}</Tag>}</Row>
              <Row label={tx("যোগাযোগের পছন্দ", "Contact preference")}>
                {ap.contact.method ? CONTACT_LABEL[ap.contact.method][lang] : "—"} · {contactWindow}
                {ap.contact.neutralWording ? <div className={styles.hint}>{tx("নিরপেক্ষ ভাষা বাধ্যতামূলক — বার্তায় মামলা/আইনি সহায়তা শব্দ নয়", "Neutral wording required — no case or legal-aid words in messages")}</div> : null}
                {!ap.contact.smsAllowed ? <div className={styles.hint}>{tx("এসএমএস নিষেধ", "SMS not allowed")}</div> : null}
              </Row>
              <Row label={tx("প্রতিনিধিত্ব", "Representation")}>{ap.representation.kind === "SELF" ? tx("নিজে", "Self") : `${ap.representation.kind}${ap.representation.name ? ` — ${ap.representation.name}` : ""}`}</Row>
            </div>
          </div>
          <div>
            <div className={ui.sectionHead}>{tx("অপর পক্ষ", "Opposing party")}</div>
            <div className={ui.rows}>
              <Row label={tx("নাম", "Name")}>{view.respondent.name ?? <Tag tone="warn">{tx("চিহ্নিত নয়", "Not identified")}</Tag>}</Row>
              <Row label={tx("যাচাই", "Verification")}>{rsp?.verification === "IDENTITY_SEEN_BY_MEDIATOR" ? <Tag tone="ok">✓ {tx("মধ্যস্থতাকারী পরিচয় দেখেছেন", "Identity seen by the mediator")}</Tag> : <Tag tone="warn">{tx("আবেদনকারী নাম দিয়েছেন — যাচাই হয়নি", "Named by the applicant — not verified")}</Tag>}</Row>
              <Row label={tx("যোগাযোগের পছন্দ", "Contact preference")}>{rsp?.contactPreference ? CONTACT_LABEL[rsp.contactPreference][lang] : tx("মধ্যস্থতাকারী লিখবেন", "To be recorded")}</Row>
              <Row label={tx("প্রতিনিধিত্ব", "Representation")}>{rsp?.representation === "REPRESENTED" ? `${tx("প্রতিনিধি আছে", "Represented")}${rsp.representativeName ? ` — ${rsp.representativeName}` : ""}` : rsp?.representation === "UNREPRESENTED" ? tx("প্রতিনিধি নেই", "Unrepresented") : tx("জানা নেই", "Unknown")}</Row>
            </div>
            <details style={{ marginTop: 8 }}>
              <summary className={ui.textBtn} style={{ cursor: "pointer" }}>
                {tx("অপর পক্ষের তথ্য হালনাগাদ", "Update opposing party details")}
              </summary>
              <div className={styles.grid} style={{ marginTop: 8 }}>
                <label className={styles.field}>
                  <span className={styles.label}>{tx("যোগাযোগ", "Contact preference")}</span>
                  <select className={styles.select} value={rContact} onChange={(e) => setRContact(e.target.value as typeof rContact)}>
                    <option value="">—</option>
                    {Object.keys(CONTACT_LABEL).map((k) => (
                      <option key={k} value={k}>
                        {CONTACT_LABEL[k][lang]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>{tx("প্রতিনিধিত্ব", "Representation")}</span>
                  <select className={styles.select} value={rRep} onChange={(e) => setRRep(e.target.value as typeof rRep)}>
                    <option value="UNKNOWN">{tx("জানা নেই", "Unknown")}</option>
                    <option value="UNREPRESENTED">{tx("প্রতিনিধি নেই", "Unrepresented")}</option>
                    <option value="REPRESENTED">{tx("প্রতিনিধি আছে", "Represented")}</option>
                  </select>
                </label>
                {rRep === "REPRESENTED" ? (
                  <label className={styles.field}>
                    <span className={styles.label}>{tx("প্রতিনিধির নাম", "Representative")}</span>
                    <input className={styles.input} value={rRepName} onChange={(e) => setRRepName(e.target.value)} />
                  </label>
                ) : null}
                <label className={styles.field}>
                  <span className={styles.label}>{tx("যাচাই", "Verification")}</span>
                  <select className={styles.select} value={rVer} onChange={(e) => setRVer(e.target.value as typeof rVer)}>
                    <option value="NAMED_BY_APPLICANT">{tx("আবেদনকারী নাম দিয়েছেন", "Named by the applicant")}</option>
                    <option value="IDENTITY_SEEN_BY_MEDIATOR">{tx("আমি পরিচয় দেখেছি", "I have seen their identity")}</option>
                  </select>
                </label>
              </div>
              <div className={styles.actions} style={{ marginTop: 8 }}>
                <Button variant="secondary" onClick={() => run(() => MediationWorkspaceService.setRespondent(id, { contactPreference: (rContact || null) as never, representation: rRep, representativeName: rRepName, verification: rVer }), tx("সংরক্ষিত।", "Saved."))}>
                  {tx("সংরক্ষণ", "Save")}
                </Button>
              </div>
            </details>
          </div>
        </div>
        <p className={styles.hint} style={{ marginBottom: 0 }}>
          🔒 {tx("এনআইডি, ফোন নম্বর, ঠিকানা, আয় ও কর্মকর্তার নোট মধ্যস্থতাকারীর জন্য প্রয়োজন নয় — দেখানো হয় না।", "NID, phone numbers, address, income and officer notes are not needed for mediation and are not shown.")}
        </p>
      </section>

      {/* SECTION 4 */}
      <section className={ui.flowStep}>
        <div className={ui.flowLabel}>
          <span className={ui.flowNum}>4</span>
          {tx("যোগাযোগ ও প্রবেশযোগ্যতা", "Communication / access")}
        </div>
        <div className={styles.grid}>
          <div className={styles.field}>
            <span className={styles.label}>{tx("পছন্দের মাধ্যম", "Preferred channel")}</span>
            <div className={styles.chips} role="group">
              {MEDIATION_CHANNELS.map((c) => (
                <button key={c.code} type="button" className={styles.chip} aria-pressed={channel === c.code} onClick={() => setChannel(c.code)}>
                  {c.code === "VOICE" ? "🎙 " : c.code === "PHYSICAL" ? "🏢 " : "💻 "}
                  {c.label[lang]}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>{tx("সংযোগ", "Connectivity")}</span>
            <div className={styles.chips} role="group">
              {(["GOOD", "LIMITED", "UNKNOWN"] as const).map((k) => (
                <button key={k} type="button" className={styles.chip} aria-pressed={conn === k} onClick={() => setConn(k)}>
                  {k === "GOOD" ? tx("ভালো", "Good") : k === "LIMITED" ? tx("সীমিত", "Limited") : tx("জানা নেই", "Unknown")}
                </button>
              ))}
            </div>
          </div>
          <label className={styles.field}>
            <span className={styles.label}>{tx("ভাষা", "Language")}</span>
            <select className={styles.select} value={language ?? ""} onChange={(e) => setLanguage((e.target.value || null) as LanguageCode | null)}>
              <option value="">—</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label[lang]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.check} style={{ alignSelf: "end" }}>
            <input type="checkbox" checked={interp} onChange={(e) => setInterp(e.target.checked)} />
            <span>{tx("দোভাষী লাগবে", "Interpreter needed")}</span>
          </label>
        </div>
        <div className={ui.rows} style={{ marginTop: "var(--s-3)" }}>
          <Row label={tx("যোগাযোগের সময়", "Contact window")}>{contactWindow}</Row>
          <Row label={tx("রেকর্ডে প্রবেশযোগ্যতা", "Accessibility on record")}>
            {[...ap.accessibility.map((n) => ACCESS_NEED[n][lang]), ap.canRead === false ? tx("পড়তে পারেন না — মৌখিকভাবে পড়ে শোনান", "Cannot read — read documents aloud") : null, ap.childInvolved ? tx("শিশু জড়িত", "Child involved") : null].filter(Boolean).join(" · ") || tx("কিছু নেই", "None recorded")}
          </Row>
        </div>
        <label className={styles.field} style={{ marginTop: "var(--s-3)" }}>
          <span className={styles.label}>{tx("প্রবেশযোগ্যতার নোট (সেশনের জন্য)", "Accessibility notes (for the session)")}</span>
          <textarea className={styles.textarea} style={{ minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tx("যেমন: হুইলচেয়ার-উপযোগী কক্ষ, নিচু স্বরে কথা, বারবার বিরতি", "e.g. ground-floor room, slow speech, frequent breaks")} />
        </label>
        {channel === "ONLINE" ? <p className={styles.hint}>{tx("অনলাইন সেশন এই প্রোটোটাইপে সিমুলেটেড — কোনো ভিডিও সেবা যুক্ত নেই।", "Online sessions are simulated in this prototype — no video service is connected.")}</p> : null}
        {channel === "ONLINE" && conn === "LIMITED" ? <p style={{ color: "var(--dlo-warning-ink)", margin: "6px 0" }}>! {tx("সংযোগ সীমিত — ফোন বা সশরীরে বিকল্প রাখুন।", "Limited connectivity — keep a phone or in-person fallback.")}</p> : null}
        <div className={styles.actions} style={{ marginTop: 8 }}>
          <Button variant="secondary" onClick={() => run(() => MediationWorkspaceService.setAccess(id, { channel, connectivity: conn, language, interpreter: interp, accessibilityNotes: notes }), tx("সংরক্ষিত।", "Saved."))}>
            {tx("সংরক্ষণ", "Save access details")}
          </Button>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------ 3: documents ------------------------------ */

function DocRow({ id, item, view }: { id: string; item: MediatorCaseView["documents"][number]; view: MediatorCaseView }) {
  const { lang, tx } = useTx();
  const f = useStoredFile(item.doc.docId);
  const [preview, setPreview] = useState(false);
  const log = (op: "viewed" | "downloaded") => {
    try {
      MediationWorkspaceService.logDocument(id, item.doc.docId, op);
    } catch {
      /* logged best-effort */
    }
  };
  const d = item.doc;
  // The viewer only needs the reference and the applicant's name — not the full record.
  const app = { applicationId: view.applicationId, data: { applicant: { fullName: view.applicant.name } } } as unknown as ApplicationRecord;
  return (
    <div className={ui.row}>
      <div className={ui.rowLabel}>
        {label(DOC_TYPES, d.type, lang)}
        {item.relevant ? (
          <div>
            <Tag tone="ink">{tx("এই বিরোধে প্রাসঙ্গিক", "Relevant to this dispute")}</Tag>
          </div>
        ) : null}
      </div>
      <div className={ui.rowValue}>
        <span>{d.fileName ?? tx("(ফাইলের নাম নেই)", "(no file name)")}</span>{" "}
        {item.state === "VERIFIED" ? <Tag tone="ok">✓ {tx("যাচাইকৃত", "Verified")}</Tag> : item.state === "RECEIVED" ? <Tag>{tx("প্রাপ্ত", "Received")}</Tag> : <Tag tone="warn">{tx("বাকি", "Pending")}</Tag>}
        {item.restricted ? <Tag tone="err">{tx("সীমিত — কর্মকর্তার কাছে চান", "Restricted — ask the officer")}</Tag> : null}
        {item.state !== "PENDING" && !item.restricted ? (
          <span style={{ display: "inline-flex", gap: 10, marginLeft: 8, alignItems: "center" }}>
            <DocViewButton app={app} doc={d} className={ui.textBtn} onOpen={() => log("viewed")} />
            <button
              type="button"
              className={ui.textBtn}
              onClick={() => {
                if (!preview) log("viewed");
                setPreview((x) => !x);
              }}
            >
              {preview ? tx("প্রিভিউ বন্ধ", "Hide preview") : tx("প্রিভিউ", "Preview")}
            </button>
            {item.downloadable && f ? (
              <a className={ui.textBtn} href={f.dataUrl} download={d.fileName ?? `${d.type}.${f.mime.includes("pdf") ? "pdf" : "jpg"}`} onClick={() => log("downloaded")}>
                {tx("ডাউনলোড", "Download")}
              </a>
            ) : (
              <span className={styles.hint}>{tx("ডাউনলোড অনুমোদিত নয়", "Download not permitted")}</span>
            )}
          </span>
        ) : null}
        {preview ? (
          <div style={{ marginTop: 8 }}>
            {f?.mime.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.dataUrl} alt={label(DOC_TYPES, d.type, lang)} style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 8, border: "1px solid var(--line)" }} />
            ) : f?.mime === "application/pdf" ? (
              <iframe title={d.fileName ?? d.type} src={f.dataUrl} style={{ width: "100%", height: 320, border: "1px solid var(--line)", borderRadius: 8 }} />
            ) : (
              <div className={ui.flowStep} style={{ background: "var(--off-white)" }}>
                <Tag tone="ink">{tx("নমুনা প্রিভিউ", "SAMPLE PREVIEW")}</Tag>
                <div className={styles.hint} style={{ marginTop: 6 }}>
                  {tx("এই ব্রাউজারে ফাইলের কপি নেই — রেকর্ডের তথ্য:", "No copy of the file in this browser — record metadata:")} {d.mimeType ?? "—"} · {d.sizeBytes ? `${Math.round(d.sizeBytes / 1024)} KB` : "—"} · sha256 {d.sha256?.slice(0, 16) ?? "—"}
                </div>
              </div>
            )}
          </div>
        ) : null}
        {d.qualityNote ? <div className={styles.hint}>{d.qualityNote}</div> : null}
      </div>
    </div>
  );
}

function Documents({ id, view }: { id: string; view: MediatorCaseView }) {
  const { tx } = useTx();
  const groups: [string, MediatorCaseView["documents"]][] = [
    [tx("যাচাইকৃত নথি", "Verified documents"), view.documents.filter((x) => x.state === "VERIFIED")],
    [tx("প্রাপ্ত (যাচাই বাকি)", "Received (not yet verified)"), view.documents.filter((x) => x.state === "RECEIVED")],
    [tx("বাকি নথি", "Pending documents"), view.documents.filter((x) => x.state === "PENDING")],
  ];
  const relevant = view.documents.filter((x) => x.relevant);
  return (
    <section className={ui.flowStep}>
      <div className={ui.flowLabel}>
        <span className={ui.flowNum}>3</span>
        {tx("নথি", "Documents")}
      </div>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        {tx(`এই বিরোধে প্রাসঙ্গিক: ${relevant.length}টি। জাতীয় পরিচয়পত্র দেখানো হয় না — পরিচয় যাচাইয়ের অবস্থা “পক্ষসমূহ” অংশে।`, `Relevant to this dispute: ${relevant.length}. The NID is not shown — identity status is under Parties.`)} {tx("প্রতিটি দেখা ও ডাউনলোড অডিটে থাকে।", "Every view and download is audited.")}
      </p>
      {groups.map(([title, list]) => (
        <div key={title} style={{ marginBottom: "var(--s-3)" }}>
          <div className={ui.sectionHead}>
            {title} ({list.length})
          </div>
          {list.length ? (
            <div className={ui.rows}>
              {list.map((item) => (
                <DocRow key={item.doc.docId} id={id} item={item} view={view} />
              ))}
            </div>
          ) : (
            <p className={styles.hint}>—</p>
          )}
        </div>
      ))}
    </section>
  );
}

/* ------------------------------ 5: session + channel (Feature 5) ------------------------------ */

const CHANNEL_ICON: Record<MediationChannel, string> = { PHYSICAL: "🏢", VOICE: "🎙", ONLINE: "💻" };

function elapsed(s: { startedAt: string | null; endedAt: string | null; pauses: { from: string; to: string | null }[] }, now: number) {
  if (!s.startedAt || !now) return null;
  const end = s.endedAt ? new Date(s.endedAt).getTime() : now;
  const paused = s.pauses.reduce((n, p) => n + ((p.to ? new Date(p.to).getTime() : end) - new Date(p.from).getTime()), 0);
  const ms = Math.max(0, end - new Date(s.startedAt).getTime() - paused);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Ticks once a second (only in the browser, after mount). */
function useTicker(active: boolean) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const i = window.setInterval(() => setT(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, [active]);
  return t;
}

function ChannelRadios({ value, onChange, name }: { value: MediationChannel; onChange: (c: MediationChannel) => void; name: string }) {
  const { lang, tx } = useTx();
  return (
    <fieldset className={ui.channelSet}>
      <legend className={ui.wsKey} style={{ fontWeight: 700, letterSpacing: "0.06em" }}>
        {tx("মধ্যস্থতার মাধ্যম", "MEDIATION CHANNEL")}
      </legend>
      {MEDIATION_CHANNELS.map((c) => (
        <label key={c.code} className={ui.channelOpt} data-on={value === c.code}>
          <input type="radio" name={name} value={c.code} checked={value === c.code} onChange={() => onChange(c.code)} />
          <span>
            {CHANNEL_ICON[c.code]} {c.label[lang]}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function Session({ id, ws, locked, view }: { id: string; ws: MediationWorkspace | null; locked: boolean; view: MediatorCaseView }) {
  const { lang, tx } = useTx();
  const { run, node } = useRun();
  const sessions = ws?.sessions ?? [];
  const live = sessions.find((s) => s.status === "IN_PROGRESS" || s.status === "PAUSED") ?? null;
  const scheduled = sessions.find((s) => s.status === "SCHEDULED") ?? null;
  const current = live ?? scheduled;
  const tr = current ? transportOf(current) : null;
  const limited = connectivityLimited(ws, current);
  const [at, setAt] = useState("");
  const [channel, setChannel] = useState<MediationChannel>(ws?.access.channel ?? "PHYSICAL");
  const [place, setPlace] = useState("");
  const [room, setRoom] = useState("");
  const [pauseWhy, setPauseWhy] = useState("");
  const [fb, setFb] = useState<{ to: MediationChannel; reason: string; place: string; room: string } | null>(null);
  const now = useTicker(!!live && live.status === "IN_PROGRESS");
  const state = live ? (live.status === "PAUSED" ? "PAUSED" : "IN_PROGRESS") : sessions.some((s) => s.status === "COMPLETED") && !scheduled ? "COMPLETED" : "NOT_STARTED";
  const STATES = [
    ["NOT_STARTED", tx("শুরু হয়নি", "Not started")],
    ["IN_PROGRESS", tx("চলছে", "In progress")],
    ["PAUSED", tx("বিরতি", "Paused")],
    ["COMPLETED", tx("সম্পন্ন", "Completed")],
  ] as const;
  const openFallback = (to: MediationChannel) => setFb({ to, reason: to === "ONLINE" ? "" : tx("সংযোগ দুর্বল — বিকল্প মাধ্যম", "Connection too weak — fallback channel"), place: current?.place ?? "", room: current?.room ?? "" });
  const ap = view.applicant.contact;

  return (
    <div style={{ display: "grid", gap: "var(--s-4)" }}>
      {node}

      {/* Mediator-owned process controls — separate from the channel */}
      <section className={ui.flowStep}>
        <div className={ui.flowLabel}>
          <span className={ui.flowNum}>5</span>
          {tx("মধ্যস্থতা সেশন — মধ্যস্থতাকারীর নিয়ন্ত্রণ", "Mediation session — mediator controls")}
        </div>
        <div className={ui.sessionBar}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STATES.map(([k, l]) => (
              <span key={k} className={`${ui.tag} ${state === k ? (k === "IN_PROGRESS" ? ui.ok : k === "PAUSED" ? ui.warn : ui.ink) : ""}`} style={{ opacity: state === k ? 1 : 0.45 }} aria-current={state === k ? "step" : undefined}>
                {k === "IN_PROGRESS" && state === k ? "● " : ""}
                {l}
              </span>
            ))}
          </div>
          {live ? (
            <span className={ui.timer} aria-label={tx("সেশনের সময়", "Session timer")}>
              ⏱ {elapsed(live, now || new Date(live.startedAt ?? 0).getTime()) ?? "00:00:00"}
            </span>
          ) : null}
          {!locked ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
              {!live ? (
                <Button onClick={() => run(() => MediationWorkspaceService.start(id))}>▶ {tx("সেশন শুরু", "Start session")}</Button>
              ) : live.status === "IN_PROGRESS" ? (
                <Button variant="secondary" onClick={() => run(() => MediationWorkspaceService.pause(id, pauseWhy))}>
                  ❚❚ {tx("বিরতি", "Pause")}
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => run(() => MediationWorkspaceService.resume(id))}>
                  ▶ {tx("আবার শুরু", "Resume")}
                </Button>
              )}
              {live ? (
                <Button variant="destructive" onClick={() => run(() => MediationWorkspaceService.end(id), tx("সেশন শেষ — এখন ফলাফল নথিভুক্ত করুন।", "Session ended — record the outcome next."))}>
                  ■ {tx("সেশন শেষ", "End session")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {live?.status === "IN_PROGRESS" && !locked ? <input className={styles.input} style={{ marginTop: 8, maxWidth: 420 }} value={pauseWhy} onChange={(e) => setPauseWhy(e.target.value)} placeholder={tx("বিরতির কারণ (ঐচ্ছিক — যেমন গোপন আলোচনা)", "Reason for pausing (optional — e.g. private caucus)")} /> : null}
        <p className={styles.hint} style={{ marginBottom: 0 }}>
          {tx("প্রক্রিয়া মধ্যস্থতাকারীর: শুরু, বিরতি, গোপন আলোচনা, নিষ্পত্তি আলোচনা ও ফলাফল এখান থেকে ও পাশের ট্যাব থেকে। নিচের মাধ্যম শুধু যোগাযোগের পথ।", "The process belongs to the mediator: start, pause, caucus, settlement discussion and outcome are controlled here and in the other tabs. The channel below is only how people connect.")}{" "}
          <a className={ui.textBtn} href={`#case/${id}/caucus`}>
            {tx("গোপন আলোচনা", "Caucus")}
          </a>{" "}
          ·{" "}
          <a className={ui.textBtn} href={`#case/${id}/settlement`}>
            {tx("নিষ্পত্তি", "Settlement")}
          </a>{" "}
          ·{" "}
          <a className={ui.textBtn} href={`#case/${id}/outcome`}>
            {tx("ফলাফল", "Outcome")}
          </a>
        </p>
      </section>

      {limited ? (
        <div className={ui.limitedBar} role="status">
          <strong>📶 {tx("সীমিত সংযোগ", "LIMITED CONNECTIVITY")}</strong>
          <span>{tx("মধ্যস্থতা থামবে না — ফোন বা সশরীরে বিকল্পে যান।", "Mediation is not blocked — use the voice or in-person fallback.")}</span>
          {current && !locked ? (
            <span style={{ display: "inline-flex", gap: 8, marginLeft: "auto" }}>
              {current.channel !== "VOICE" ? (
                <Button variant="secondary" onClick={() => openFallback("VOICE")}>
                  🎙 {tx("ফোনে চালিয়ে যান", "Voice fallback")}
                </Button>
              ) : null}
              {current.channel !== "PHYSICAL" ? (
                <Button variant="secondary" onClick={() => openFallback("PHYSICAL")}>
                  🏢 {tx("সশরীরে", "Physical fallback")}
                </Button>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Channel (transport) */}
      {current && tr ? (
        <section className={ui.flowStep}>
          <div className={ui.flowLabel}>
            {CHANNEL_ICON[current.channel]} {tx("মাধ্যম", "Channel")}: {lbl(MEDIATION_CHANNELS, current.channel, lang)} · {tx("সেশন", "session")} #{current.number}
            {current.channel !== "PHYSICAL" ? <span className={ui.simBadge}>{tx("সিমুলেটেড", "SIMULATED")}</span> : null}
          </div>

          {current.channel === "PHYSICAL" ? (
            <div className={ui.rows}>
              <Row label={tx("স্থান", "Location")}>{current.place ?? "—"}</Row>
              <Row label={tx("কক্ষ", "Room")}>{current.room ?? "—"}</Row>
              <Row label={tx("নির্ধারিত সময়", "Scheduled time")}>{current.scheduledFor ? formatDateTime(current.scheduledFor, lang) : tx("এখনই", "Now (unscheduled)")}</Row>
              {(["APPLICANT", "RESPONDENT"] as PartySide[]).map((side) => (
                <Row key={side} label={side === "APPLICANT" ? tx("আবেদনকারী পৌঁছেছেন", "Applicant arrived") : tx("অপর পক্ষ পৌঁছেছেন", "Respondent arrived")}>
                  {tr.checkIn[side] ? `✓ ${formatDateTime(tr.checkIn[side]!, lang)}` : tx("এখনো নয়", "Not yet")}{" "}
                  {!locked && !tr.checkIn[side] ? (
                    <button type="button" className={ui.textBtn} onClick={() => run(() => MediationWorkspaceService.checkIn(id, side))}>
                      {tx("পৌঁছেছেন চিহ্নিত করুন", "Mark arrived")}
                    </button>
                  ) : null}
                </Row>
              ))}
            </div>
          ) : null}

          {current.channel === "VOICE" ? (
            <>
              <p className={styles.hint} style={{ marginTop: 0 }}>
                {tx("ফোন/ভয়েস সেশন — প্রোটোটাইপে কোনো টেলিফোনি যুক্ত নেই; কল অবস্থা মধ্যস্থতাকারী নথিভুক্ত করেন।", "Phone / voice session — no telephony is connected in the prototype; the mediator records each call state.")}
              </p>
              {(["APPLICANT", "RESPONDENT"] as PartySide[]).map((side) => {
                const call = tr.voice[side];
                const tone: Tone = call.state === "CONNECTED" ? "ok" : call.state === "NO_ANSWER" ? "err" : call.state === "INITIATED" ? "warn" : "neutral";
                const label = { IDLE: tx("কল হয়নি", "Not called"), INITIATED: tx("কল শুরু — রিং হচ্ছে", "Call initiated — ringing"), CONNECTED: tx("কল সংযুক্ত", "Call connected"), NO_ANSWER: tx("উত্তর নেই", "No answer"), ENDED: tx("কল শেষ", "Call ended") }[call.state];
                return (
                  <div key={side} className={ui.callRow}>
                    <div>
                      <strong>{side === "APPLICANT" ? `${tx("আবেদনকারী", "Applicant")} — ${view.applicant.name ?? ""}` : `${tx("অপর পক্ষ", "Respondent")} — ${view.respondent.name ?? ""}`}</strong>
                      <div style={{ marginTop: 4 }}>
                        {tx("যোগাযোগের অবস্থা:", "Contact status:")} <Tag tone={tone}>{label}</Tag> {call.attempts ? <span className={styles.hint}>· {tx(`${call.attempts} বার চেষ্টা`, `${call.attempts} attempt(s)`)}</span> : null}
                        {call.connectedAt && call.state === "CONNECTED" ? <span className={styles.hint}> · {tx("সংযুক্ত", "connected")} {formatDateTime(call.connectedAt, lang)}</span> : null}
                      </div>
                      {side === "APPLICANT" ? (
                        <div className={styles.hint}>
                          {tx("নিরাপদ যোগাযোগ:", "Safe contact:")} {ap.method ?? "—"} · {ap.window ? `${ap.window.day} ${ap.window.time}` : ap.safeTime ?? "—"}
                          {ap.neutralWording ? tx(" · নিরপেক্ষ ভাষা", " · neutral wording") : ""} · {tx("নম্বর সিস্টেম থেকে ডায়াল হয় — মধ্যস্থতাকারীকে দেখানো হয় না", "number is dialled by the system — not shown to the mediator")}
                        </div>
                      ) : null}
                    </div>
                    {!locked ? (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {call.state === "IDLE" || call.state === "ENDED" || call.state === "NO_ANSWER" ? (
                          <Button variant="secondary" onClick={() => run(() => MediationWorkspaceService.voiceCall(id, side, "INITIATED"))}>
                            📞 {call.state === "IDLE" ? tx("কল করুন", "Call") : tx("আবার কল", "Call again")}
                          </Button>
                        ) : null}
                        {call.state === "INITIATED" ? (
                          <>
                            <Button variant="secondary" onClick={() => run(() => MediationWorkspaceService.voiceCall(id, side, "CONNECTED"))}>
                              ✓ {tx("সংযুক্ত", "Connected")}
                            </Button>
                            <Button variant="secondary" onClick={() => run(() => MediationWorkspaceService.voiceCall(id, side, "NO_ANSWER"))}>
                              ✗ {tx("উত্তর নেই", "No answer")}
                            </Button>
                          </>
                        ) : null}
                        {call.state === "CONNECTED" ? (
                          <Button variant="secondary" onClick={() => run(() => MediationWorkspaceService.voiceCall(id, side, "ENDED"))}>
                            ⏹ {tx("কল শেষ", "End call")}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </>
          ) : null}

          {current.channel === "ONLINE" ? (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                <strong>{tx("সিমুলেটেড মধ্যস্থতা কক্ষ", "Simulated mediation room")}</strong> <Tag>{tr.online.roomId}</Tag>
                <span className={ui.timer}>⏱ {live ? elapsed(live, now || new Date(live.startedAt ?? 0).getTime()) ?? "00:00:00" : "00:00:00"}</span>
              </div>
              <div className={ui.roomGrid}>
                {(["APPLICANT", "RESPONDENT", "MEDIATOR"] as OnlineParticipantKey[]).map((k) => {
                  const p = tr.online.participants[k];
                  const name = k === "APPLICANT" ? view.applicant.name : k === "RESPONDENT" ? view.respondent.name : tx("আপনি (মধ্যস্থতাকারী)", "You (mediator)");
                  const st = { NOT_JOINED: tx("যোগ দেননি", "Not joined"), CONNECTED: tx("সংযুক্ত", "Connected"), WEAK: tx("দুর্বল সংযোগ", "Weak connection"), DISCONNECTED: tx("বিচ্ছিন্ন", "Disconnected") }[p.state];
                  return (
                    <div key={k} className={ui.roomTile} data-state={p.state}>
                      <div className={ui.roomAvatar} aria-hidden>
                        {(name ?? "?").slice(0, 1)}
                      </div>
                      <div style={{ fontWeight: 600 }}>{k === "APPLICANT" ? tx("আবেদনকারী", "Applicant") : k === "RESPONDENT" ? tx("অপর পক্ষ", "Respondent") : tx("মধ্যস্থতাকারী", "Mediator")}</div>
                      <div className={styles.hint}>{name ?? "—"}</div>
                      <div className={ui.connDot} data-state={p.state}>
                        {st}
                      </div>
                      {!locked ? (
                        <div className={ui.simRow} aria-label={tx("সিমুলেটর", "Simulator")}>
                          {(["CONNECTED", "WEAK", "DISCONNECTED"] as OnlineConnectionState[]).map((s) => (
                            <button key={s} type="button" className={styles.chip} aria-pressed={p.state === s} onClick={() => run(() => MediationWorkspaceService.onlineStatus(id, k, s))}>
                              {s === "CONNECTED" ? tx("যোগ", "Join") : s === "WEAK" ? tx("দুর্বল", "Weak") : tx("বিচ্ছিন্ন", "Drop")}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <p className={styles.hint}>{tx("এটি ভিডিও সেবা নয় — সংযোগের অবস্থা সিমুলেটর দিয়ে বদলানো হয়; কিছু রেকর্ড হয় না। মধ্যস্থতার নিয়ন্ত্রণ উপরে আলাদা।", "Not a video service — connection states are changed with the simulator; nothing is recorded. Mediation controls stay separate, above.")}</p>
            </>
          ) : null}

          {/* Attendance — the mediator's record, whatever the channel */}
          <div className={ui.sectionHead} style={{ marginTop: "var(--s-3)" }}>
            {tx("উপস্থিতি", "Attendance")}
          </div>
          <div className={ui.rows}>
            {(["APPLICANT", "RESPONDENT"] as PartySide[]).map((side) => {
              const m = current.attendance[side];
              return (
                <Row key={side} label={side === "APPLICANT" ? tx("আবেদনকারী", "Applicant") : tx("অপর পক্ষ", "Respondent")}>
                  <span style={{ fontWeight: 600, marginRight: 8 }}>{m.status === "PRESENT" ? "✓ " + tx("উপস্থিত", "Present") : m.status === "ABSENT" ? "✗ " + tx("অনুপস্থিত", "Absent") : m.status === "REPRESENTED" ? "✓ " + tx("প্রতিনিধির মাধ্যমে", "Represented") : tx("নথিভুক্ত হয়নি", "Not recorded")}</span>
                  {m.mode ? <span className={styles.hint}>({lbl(MEDIATION_CHANNELS, m.mode, lang)})</span> : null}
                  {!locked ? (
                    <span style={{ display: "inline-flex", gap: 6, marginLeft: 8, flexWrap: "wrap" }}>
                      {(["PRESENT", "ABSENT", "REPRESENTED"] as const).map((st) => (
                        <button key={st} type="button" className={styles.chip} aria-pressed={m.status === st} onClick={() => run(() => MediationWorkspaceService.markAttendance(id, side, st, current.channel))}>
                          {st === "PRESENT" ? tx("উপস্থিত", "Present") : st === "ABSENT" ? tx("অনুপস্থিত", "Absent") : tx("প্রতিনিধি", "Represented")}
                        </button>
                      ))}
                    </span>
                  ) : null}
                </Row>
              );
            })}
          </div>

          {/* Fallback / switch */}
          {!locked ? (
            fb ? (
              <div className={ui.flowStep} style={{ marginTop: "var(--s-3)", background: "var(--off-white)" }}>
                <div className={ui.sectionHead}>{tx(`মাধ্যম পরিবর্তন: ${lbl(MEDIATION_CHANNELS, fb.to, "bn")}`, `Switch to ${lbl(MEDIATION_CHANNELS, fb.to, "en")}`)}</div>
                <p className={styles.hint} style={{ marginTop: 0 }}>
                  {tx("সেশন, উপস্থিতি, নোট ও আলোচনা যেমন আছে তেমন থাকবে।", "The session, attendance, notes and discussion all carry over.")}
                </p>
                <div className={styles.grid}>
                  <label className={styles.field}>
                    <span className={styles.label}>{tx("কারণ", "Reason")}</span>
                    <input className={styles.input} value={fb.reason} onChange={(e) => setFb({ ...fb, reason: e.target.value })} />
                  </label>
                  {fb.to === "PHYSICAL" ? (
                    <>
                      <label className={styles.field}>
                        <span className={styles.label}>{tx("স্থান", "Location")}</span>
                        <input className={styles.input} value={fb.place} onChange={(e) => setFb({ ...fb, place: e.target.value })} />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.label}>{tx("কক্ষ", "Room")}</span>
                        <input className={styles.input} value={fb.room} onChange={(e) => setFb({ ...fb, room: e.target.value })} />
                      </label>
                    </>
                  ) : null}
                </div>
                <div className={styles.actions} style={{ marginTop: 8 }}>
                  <Button
                    onClick={() => {
                      if (run(() => MediationWorkspaceService.switchChannel(id, fb.to, fb.reason, fb.place, fb.room), tx("মাধ্যম পরিবর্তিত — মধ্যস্থতা চলছে।", "Channel switched — the mediation continues."))) setFb(null);
                    }}
                  >
                    {tx("পরিবর্তন করুন", "Switch channel")}
                  </Button>
                  <Button variant="secondary" onClick={() => setFb(null)}>
                    {tx("বাতিল", "Cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <p style={{ marginTop: "var(--s-3)", marginBottom: 0 }}>
                <span className={styles.hint}>{tx("মাধ্যম বদলান:", "Change channel:")}</span>{" "}
                {MEDIATION_CHANNELS.filter((c) => c.code !== current.channel).map((c) => (
                  <button key={c.code} type="button" className={ui.textBtn} style={{ marginRight: 10 }} onClick={() => openFallback(c.code)}>
                    {CHANNEL_ICON[c.code]} {c.label[lang]}
                  </button>
                ))}
              </p>
            )
          ) : null}

          {tr.fallbacks.length ? (
            <div className={styles.hint} style={{ marginTop: 8 }}>
              {tx("মাধ্যম পরিবর্তন:", "Channel changes:")} {tr.fallbacks.map((f) => `${formatDateTime(f.at, lang)} ${f.from}→${f.to} (${f.reason})`).join(" · ")}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Schedule */}
      {!locked && !live ? (
        <section className={ui.flowStep}>
          <div className={ui.sectionHead}>{scheduled ? tx("সেশনের সময় / মাধ্যম পরিবর্তন", "Reschedule / change channel") : tx("সেশন নির্ধারণ", "Schedule a session")}</div>
          <ChannelRadios value={channel} onChange={setChannel} name="schedule-channel" />
          <div className={styles.grid} style={{ marginTop: "var(--s-3)" }}>
            <label className={styles.field}>
              <span className={styles.label}>{tx("তারিখ ও সময়", "Date and time")}</span>
              <input type="datetime-local" className={styles.input} value={at} onChange={(e) => setAt(e.target.value)} />
            </label>
            {channel === "PHYSICAL" ? (
              <>
                <label className={styles.field}>
                  <span className={styles.label}>{tx("স্থান", "Location")}</span>
                  <input className={styles.input} value={place} onChange={(e) => setPlace(e.target.value)} placeholder={tx("যেমন: জেলা লিগ্যাল এইড অফিস, ঝিনাইদহ", "e.g. District Legal Aid Office, Jhenaidah")} />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>{tx("কক্ষ", "Room")}</span>
                  <input className={styles.input} value={room} onChange={(e) => setRoom(e.target.value)} placeholder={tx("যেমন: মধ্যস্থতা কক্ষ ২", "e.g. Mediation room 2")} />
                </label>
              </>
            ) : (
              <label className={styles.field}>
                <span className={styles.label}>{tx("নির্দেশনা (ঐচ্ছিক)", "Instructions (optional)")}</span>
                <input className={styles.input} value={place} onChange={(e) => setPlace(e.target.value)} placeholder={channel === "VOICE" ? tx("যেমন: অফিস থেকে কল করা হবে", "e.g. The office will call both parties") : tx("যেমন: লিংক এসএমএসে যাবে", "e.g. Link sent by SMS")} />
              </label>
            )}
          </div>
          {channel === "VOICE" ? <p className={styles.hint}>{tx("নিরাপদ-যোগাযোগের নিয়ম মেনে সিস্টেম থেকে কল হবে (সিমুলেটেড)।", "Calls go out through the system under the safe-contact rules (simulated).")}</p> : null}
          {channel === "ONLINE" ? (
            <p className={styles.hint} style={{ color: ws?.access.connectivity === "LIMITED" ? "var(--dlo-warning-ink)" : undefined }}>
              {ws?.access.connectivity === "LIMITED" ? tx("সীমিত সংযোগ নথিভুক্ত — অনলাইন নির্ধারণ করা যায়, তবে ফোন/সশরীরে বিকল্প প্রস্তুত রাখুন।", "Limited connectivity is recorded — you can still schedule online, but keep the voice / physical fallback ready.") : tx("সিমুলেটেড মধ্যস্থতা কক্ষ তৈরি হবে; কোনো ভিডিও সেবা যুক্ত নেই।", "A simulated mediation room is created; no video service is connected.")}
            </p>
          ) : null}
          <div className={styles.actions} style={{ marginTop: 8 }}>
            <Button variant="secondary" onClick={() => run(() => MediationWorkspaceService.schedule(id, { at, channel, place, room }), tx("সেশন নির্ধারিত; আবেদনকারীকে নিরাপদ এসএমএস (সিমুলেটেড)।", "Session scheduled; the applicant was told by safe SMS (simulated)."))}>
              {tx("নির্ধারণ করুন", "Schedule")}
            </Button>
          </div>
        </section>
      ) : null}

      {sessions.filter((s) => s.status === "COMPLETED").length ? (
        <section className={ui.flowStep}>
          <div className={ui.sectionHead}>{tx("আগের সেশন", "Earlier sessions")}</div>
          <div className={ui.rows}>
            {sessions
              .filter((s) => s.status === "COMPLETED")
              .map((s) => (
                <Row key={s.sessionId} label={`#${s.number}`}>
                  {CHANNEL_ICON[s.channel]} {lbl(MEDIATION_CHANNELS, s.channel, lang)} · {s.startedAt ? formatDateTime(s.startedAt, lang) : "—"} → {s.endedAt ? formatDateTime(s.endedAt, lang) : "—"} ({elapsed(s, Date.parse(s.endedAt ?? s.startedAt ?? "")) ?? "—"}) · {tx("আবেদনকারী", "applicant")} {s.attendance.APPLICANT.status.toLowerCase()} · {tx("অপর পক্ষ", "respondent")} {s.attendance.RESPONDENT.status.toLowerCase()}
                  {transportOf(s).fallbacks.length ? ` · ${transportOf(s).fallbacks.length} ${tx("বার মাধ্যম পরিবর্তন", "channel change(s)")}` : ""}
                </Row>
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------ 6: private caucus ------------------------------ */

function Caucus({ id, ws, locked }: { id: string; ws: MediationWorkspace | null; locked: boolean }) {
  const { lang, tx } = useTx();
  const { run, node } = useRun();
  const [draft, setDraft] = useState<Record<PartySide, string>>({ APPLICANT: "", RESPONDENT: "" });
  return (
    <section className={ui.flowStep}>
      <div className={ui.flowLabel}>
        <span className={ui.flowNum}>6</span>
        {tx("মধ্যস্থতাকারীর গোপন নোট · ককাস", "MEDIATOR CONFIDENTIAL NOTES · Private caucus")}
      </div>
      {node}
      <p className={styles.hint} style={{ marginTop: 0 }}>
        🔒 {tx("শুধু আপনি দেখতে পান। অপর পক্ষ, আবেদনকারী বা কর্মকর্তার পর্দায় স্বয়ংক্রিয়ভাবে যায় না; অডিটে শুধু “নোট যোগ হয়েছে” থাকে, লেখা নয়।", "Only you can see these. They never flow to the other party, the applicant or the officer's screens; the audit shows only that a note was added, never its text.")}
      </p>
      <div className={ui.pair}>
        {(["APPLICANT", "RESPONDENT"] as PartySide[]).map((side) => {
          const notes = confidentialCaucusNotes(ws).filter((n) => n.side === side);
          return (
            <div key={side} className={`${ui.flowStep} ${ui.confidential}`}>
              <span className={ui.confidentialBadge}>🔒 {tx("গোপন মধ্যস্থতাকারী নোট", "CONFIDENTIAL MEDIATOR NOTE")}</span>
              <div className={ui.sectionHead} style={{ marginTop: 8 }}>
                {side === "APPLICANT" ? tx("গোপন আলোচনা — আবেদনকারী", "Private caucus — Applicant") : tx("গোপন আলোচনা — অপর পক্ষ", "Private caucus — Respondent")}
              </div>
              {notes.length === 0 ? <p className={styles.hint}>{tx("কোনো নোট নেই।", "No notes yet.")}</p> : null}
              {notes.map((n) => (
                <div key={n.noteId} style={{ borderTop: "1px dashed var(--line)", padding: "8px 0" }}>
                  <div style={{ whiteSpace: "pre-wrap" }}>{n.text}</div>
                  <div className={styles.hint}>{formatDateTime(n.at, lang)}</div>
                </div>
              ))}
              {!locked ? (
                <>
                  <textarea className={styles.textarea} style={{ minHeight: 70, marginTop: 8 }} value={draft[side]} onChange={(e) => setDraft({ ...draft, [side]: e.target.value })} placeholder={tx("এই পক্ষের সাথে একান্ত আলোচনার নোট", "Notes from the private meeting with this party")} />
                  <div className={styles.actions} style={{ marginTop: 6 }}>
                    <Button
                      variant="secondary"
                      disabled={draft[side].trim().length < 3}
                      onClick={() => {
                        if (run(() => MediationWorkspaceService.addCaucusNote(id, side, draft[side]))) setDraft({ ...draft, [side]: "" });
                      }}
                    >
                      {tx("গোপন নোট যোগ", "Add confidential note")}
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------ 7: settlement discussion ------------------------------ */

function Settlement({ id, ws, locked }: { id: string; ws: MediationWorkspace | null; locked: boolean }) {
  const { lang, tx } = useTx();
  const { run, node } = useRun();
  const [draft, setDraft] = useState<Record<SettlementList, string>>({ ISSUES: "", DISCUSSION: "", PROPOSED: "", AGREED: "", OUTSTANDING: "" });
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const items = (ws?.settlement ?? []).filter((x) => x.status === "ACTIVE");
  return (
    <section className={ui.flowStep}>
      <div className={ui.flowLabel}>
        <span className={ui.flowNum}>7</span>
        {tx("নিষ্পত্তি আলোচনা", "Settlement discussion")}
      </div>
      {node}
      <p className={styles.hint} style={{ marginTop: 0 }}>
        {tx("আপনি যা শুনেছেন ও পক্ষরা যা বলেছেন তা লিখুন। সিস্টেম কোনো শর্ত, পরিমাণ বা সমাধান প্রস্তাব করে না — কোনো AI আলোচক নেই।", "Record what the parties say and agree. The system never suggests terms, amounts or solutions — there is no AI negotiator.")}
      </p>
      <div className={ui.settleGrid}>
        {SETTLEMENT_LISTS.map((l) => {
          const list = items.filter((x) => x.list === l.code);
          return (
            <div key={l.code} className={`${ui.flowStep} ${l.code === "AGREED" ? ui.confirmed : ""}`} style={{ padding: "var(--s-3)" }}>
              <div style={{ fontWeight: 700 }}>
                {l.label[lang]} <span className={styles.hint}>({list.length})</span>
              </div>
              <div className={styles.hint}>{l.hint[lang]}</div>
              <ol style={{ margin: "8px 0", paddingLeft: 18, display: "grid", gap: 6 }}>
                {list.map((it) => (
                  <li key={it.itemId}>
                    {editing?.id === it.itemId ? (
                      <span style={{ display: "grid", gap: 4 }}>
                        <input className={styles.input} value={editing.text} onChange={(e) => setEditing({ id: it.itemId, text: e.target.value })} />
                        <span style={{ display: "flex", gap: 8 }}>
                          <button type="button" className={ui.textBtn} onClick={() => run(() => MediationWorkspaceService.editItem(id, it.itemId, editing.text)) && setEditing(null)}>
                            {tx("সংরক্ষণ", "Save")}
                          </button>
                          <button type="button" className={ui.textBtn} onClick={() => setEditing(null)}>
                            {tx("বাতিল", "Cancel")}
                          </button>
                        </span>
                      </span>
                    ) : (
                      <>
                        <span style={{ whiteSpace: "pre-wrap" }}>{it.text}</span>
                        {it.history.length ? <span className={styles.hint}> · {tx("সম্পাদিত", "edited")}</span> : null}
                        {!locked ? (
                          <span style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                            <button type="button" className={ui.textBtn} onClick={() => setEditing({ id: it.itemId, text: it.text })}>
                              {tx("সম্পাদনা", "Edit")}
                            </button>
                            <select aria-label={tx("সরান", "Move to")} className={styles.select} style={{ padding: "2px 6px", fontSize: "var(--t-label)", width: "auto" }} value="" onChange={(e) => e.target.value && run(() => MediationWorkspaceService.moveItem(id, it.itemId, e.target.value as SettlementList))}>
                              <option value="">{tx("সরান…", "Move to…")}</option>
                              {SETTLEMENT_LISTS.filter((x) => x.code !== l.code).map((x) => (
                                <option key={x.code} value={x.code}>
                                  {x.label[lang]}
                                </option>
                              ))}
                            </select>
                            <button type="button" className={ui.textBtn} onClick={() => run(() => MediationWorkspaceService.withdrawItem(id, it.itemId))}>
                              {tx("প্রত্যাহার", "Withdraw")}
                            </button>
                          </span>
                        ) : null}
                      </>
                    )}
                  </li>
                ))}
              </ol>
              {!locked ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input className={styles.input} value={draft[l.code]} onChange={(e) => setDraft({ ...draft, [l.code]: e.target.value })} placeholder={tx("যোগ করুন…", "Add…")} aria-label={l.label[lang]} />
                  <Button
                    variant="secondary"
                    disabled={draft[l.code].trim().length < 3}
                    onClick={() => {
                      if (run(() => MediationWorkspaceService.addItem(id, l.code, draft[l.code]))) setDraft({ ...draft, [l.code]: "" });
                    }}
                  >
                    +
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------ 8: outcome ------------------------------ */

function Outcome({ id, ws }: { id: string; ws: MediationWorkspace | null }) {
  const { lang, tx } = useTx();
  const { run, node } = useRun();
  const [kind, setKind] = useState<MediationOutcome["kind"] | null>(null);
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [nsAt, setNsAt] = useState("");
  const [nsChannel, setNsChannel] = useState<MediationChannel>(ws?.access.channel ?? "PHYSICAL");
  const [nsPlace, setNsPlace] = useState("");
  const [terms, setTerms] = useState({ issue: "", proposedResolution: "", agreedResolution: "", conditions: "", deadline: "", additionalTerms: "" });
  const lastCompleted = [...(ws?.sessions ?? [])].reverse().find((s) => s.status === "COMPLETED");
  const [failure, setFailure] = useState<{ mediationDate: string; attendance: Record<PartySide, "PRESENT" | "ABSENT" | "REPRESENTED">; issuesDiscussed: string; outcome: string; reasonStatus: string; followUpRequirement: string; referralPathway: FailureReferralPathway }>(() => ({
    mediationDate: lastCompleted?.endedAt?.slice(0, 10) ?? "",
    attendance: {
      APPLICANT: lastCompleted?.attendance.APPLICANT.status === "UNRECORDED" ? "ABSENT" : (lastCompleted?.attendance.APPLICANT.status ?? "PRESENT"),
      RESPONDENT: lastCompleted?.attendance.RESPONDENT.status === "UNRECORDED" ? "ABSENT" : (lastCompleted?.attendance.RESPONDENT.status ?? "PRESENT"),
    },
    issuesDiscussed: "", outcome: "", reasonStatus: "", followUpRequirement: "", referralPathway: "FURTHER_LEGAL_AID_REVIEW",
  }));
  const fin = finalOutcome(ws);
  const outcomes = [...(ws?.outcomes ?? [])].reverse();
  const BTN: { k: MediationOutcome["kind"]; icon: string; variant: "primary" | "secondary" | "destructive" }[] = [
    { k: "SETTLEMENT_REACHED", icon: "✓", variant: "primary" },
    { k: "MEDIATION_FAILED", icon: "✗", variant: "destructive" },
    { k: "NEEDS_FOLLOW_UP", icon: "↻", variant: "secondary" },
    { k: "ADJOURNED", icon: "⏸", variant: "secondary" },
  ];
  return (
    <section className={ui.flowStep}>
      <div className={ui.flowLabel}>
        <span className={ui.flowNum}>8</span>
        {tx("ফলাফল", "Outcome")}
      </div>
      {node}
      {fin ? (
        <>
          <Banner tone={fin.kind === "SETTLEMENT_REACHED" ? "ok" : "err"} icon={fin.kind === "SETTLEMENT_REACHED" ? "✓" : "!"}>
            <strong>{OUTCOME_LABEL[fin.kind][lang]}</strong> — {fin.byName} · {formatDateTime(fin.at, lang)}.{" "}
            {fin.kind === "SETTLEMENT_REACHED" ? tx("দলিলটি লিগ্যাল এইড অফিসারের যাচাইয়ের আগে চূড়ান্ত নয়।", "The agreement is not final until the Legal Aid Officer verifies it.") : tx("আনুষ্ঠানিক ব্যর্থতা / রেফারেল রেকর্ড তৈরি হয়েছে; কর্মকর্তা পরবর্তী আইনি পথ নিশ্চিত করবেন।", "The formal failure / referral record has been created; the officer will confirm the next legal pathway.")}
          </Banner>
          {fin.kind === "SETTLEMENT_REACHED" ? <SettlementExecution id={id} ws={ws} /> : <FailureRecordView id={id} ws={ws} />}
        </>
      ) : (
        <>
          <p className={styles.hint} style={{ marginTop: 0 }}>
            {tx("ফলাফল আপনাকেই স্পষ্টভাবে নথিভুক্ত করতে হবে। “পক্ষ রাজি হয়েছে” মানেই আইনত চূড়ান্ত চুক্তি নয়।", "You must record the outcome explicitly. “A party agreed” is not a legally final agreement.")}
          </p>
          <div className={ui.modeBar}>
            {BTN.map((b) => (
              <Button key={b.k} variant={kind === b.k ? "primary" : b.variant === "primary" ? "secondary" : b.variant} onClick={() => setKind(b.k)}>
                {b.icon} {OUTCOME_LABEL[b.k][lang]}
              </Button>
            ))}
          </div>
          {kind ? (
            <div className={ui.flowStep} style={{ background: "var(--off-white)" }}>
              {kind === "SETTLEMENT_REACHED" ? (
                <>
                  <div className={ui.sectionHead}>{tx("নিষ্পত্তির শর্ত", "Settlement terms")}</div>
                  <p className={styles.hint}>{tx("মধ্যস্থতাকারী নিজে শর্ত লিখবেন। সিস্টেম কোনো শর্ত তৈরি করে না।", "The mediator records these terms manually. The system does not generate settlement terms.")}</p>
                  <div className={styles.grid}>
                    {([
                      ["issue", tx("বিষয়", "Issue")],
                      ["proposedResolution", tx("প্রস্তাবিত সমাধান", "Proposed resolution")],
                      ["agreedResolution", tx("সম্মত সমাধান", "Agreed resolution")],
                      ["conditions", tx("শর্তাবলি", "Conditions")],
                    ] as const).map(([key, fieldLabel]) => (
                      <label className={styles.field} key={key}>
                        <span className={styles.label}>{fieldLabel}</span>
                        <textarea className={styles.textarea} value={terms[key]} onChange={(e) => setTerms({ ...terms, [key]: e.target.value })} />
                      </label>
                    ))}
                    <label className={styles.field}>
                      <span className={styles.label}>{tx("সময়সীমা", "Deadline")}</span>
                      <input type="date" className={styles.input} value={terms.deadline} onChange={(e) => setTerms({ ...terms, deadline: e.target.value })} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>{tx("অতিরিক্ত শর্ত", "Additional terms")}</span>
                      <textarea className={styles.textarea} value={terms.additionalTerms} onChange={(e) => setTerms({ ...terms, additionalTerms: e.target.value })} />
                    </label>
                  </div>
                </>
              ) : null}
              {kind === "MEDIATION_FAILED" ? (
                <>
                  <div className={ui.sectionHead}>{tx("মধ্যস্থতার ফলাফল", "Mediation outcome")}</div>
                  <Banner tone="warn" icon="i">{tx("শুধু যৌথ সেশনের প্রক্রিয়াগত তথ্য লিখুন। গোপন একান্ত আলোচনার বিষয় প্রকাশ করতে হবে না।", "Record procedural information from the mediation. Do not disclose confidential caucus content.")}</Banner>
                  <div className={styles.grid}>
                    <label className={styles.field}><span className={styles.label}>{tx("মধ্যস্থতার তারিখ", "Mediation date")}</span><input type="date" className={styles.input} value={failure.mediationDate} onChange={(e) => setFailure({ ...failure, mediationDate: e.target.value })} /></label>
                    {(["APPLICANT", "RESPONDENT"] as PartySide[]).map((side) => <label className={styles.field} key={side}><span className={styles.label}>{side === "APPLICANT" ? tx("আবেদনকারীর উপস্থিতি", "Applicant attendance") : tx("প্রতিপক্ষের উপস্থিতি", "Respondent attendance")}</span><select className={styles.select} value={failure.attendance[side]} onChange={(e) => setFailure({ ...failure, attendance: { ...failure.attendance, [side]: e.target.value as "PRESENT" | "ABSENT" | "REPRESENTED" } })}><option value="PRESENT">{tx("উপস্থিত", "Present")}</option><option value="REPRESENTED">{tx("প্রতিনিধির মাধ্যমে", "Represented")}</option><option value="ABSENT">{tx("অনুপস্থিত", "Absent")}</option></select></label>)}
                    <label className={styles.field}><span className={styles.label}>{tx("আলোচিত বিষয়", "Issues discussed")}</span><textarea className={styles.textarea} value={failure.issuesDiscussed} onChange={(e) => setFailure({ ...failure, issuesDiscussed: e.target.value })} /></label>
                    <label className={styles.field}><span className={styles.label}>{tx("ফলাফল", "Outcome")}</span><textarea className={styles.textarea} value={failure.outcome} onChange={(e) => setFailure({ ...failure, outcome: e.target.value })} /></label>
                    <label className={styles.field}><span className={styles.label}>{tx("প্রযোজ্য কারণ / অবস্থা", "Reason / status where appropriate")}</span><textarea className={styles.textarea} value={failure.reasonStatus} onChange={(e) => setFailure({ ...failure, reasonStatus: e.target.value })} /></label>
                    <label className={styles.field}><span className={styles.label}>{tx("ফলো-আপের প্রয়োজন", "Follow-up requirement")}</span><textarea className={styles.textarea} value={failure.followUpRequirement} onChange={(e) => setFailure({ ...failure, followUpRequirement: e.target.value })} /></label>
                    <label className={styles.field}><span className={styles.label}>{tx("প্রস্তাবিত রেফারেল পথ", "Proposed referral pathway")}</span><select className={styles.select} value={failure.referralPathway} onChange={(e) => setFailure({ ...failure, referralPathway: e.target.value as FailureReferralPathway })}><option value="COURT_LEGAL_PATHWAY">{tx("আদালত / আইনি পথ", "Court / legal pathway")}</option><option value="LAWYER_ASSIGNMENT">{tx("আইনজীবী নিয়োগ", "Lawyer assignment")}</option><option value="FURTHER_LEGAL_AID_REVIEW">{tx("আরও লিগ্যাল এইড পর্যালোচনা", "Further legal aid review")}</option><option value="OTHER_REFERRAL">{tx("অন্য রেফারেল", "Other referral")}</option></select></label>
                  </div>
                </>
              ) : null}
              {kind === "NEEDS_FOLLOW_UP" ? (
                <label className={styles.field} style={{ maxWidth: 260 }}>
                  <span className={styles.label}>{tx("ফলো-আপের তারিখ", "Follow up by")}</span>
                  <input type="date" className={styles.input} value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
                </label>
              ) : null}
              {kind === "ADJOURNED" ? (
                <div className={styles.grid}>
                  <label className={styles.field}>
                    <span className={styles.label}>{tx("পরের সেশন", "Next session")}</span>
                    <input type="datetime-local" className={styles.input} value={nsAt} onChange={(e) => setNsAt(e.target.value)} />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>{tx("মাধ্যম", "Channel")}</span>
                    <select className={styles.select} value={nsChannel} onChange={(e) => setNsChannel(e.target.value as MediationChannel)}>
                      {MEDIATION_CHANNELS.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label[lang]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {nsChannel === "PHYSICAL" ? (
                    <label className={styles.field}>
                      <span className={styles.label}>{tx("স্থান", "Venue")}</span>
                      <input className={styles.input} value={nsPlace} onChange={(e) => setNsPlace(e.target.value)} />
                    </label>
                  ) : null}
                </div>
              ) : null}
              {kind !== "MEDIATION_FAILED" ? <label className={styles.field} style={{ marginTop: 8 }}>
                <span className={styles.label}>{tx("ফলাফলের নোট (কমপক্ষে ১০ অক্ষর)", "Outcome note (at least 10 characters)")}</span>
                <textarea className={styles.textarea} value={note} onChange={(e) => setNote(e.target.value)} />
              </label> : null}
              <div className={ui.bar}>
                <Button
                  variant={kind === "MEDIATION_FAILED" ? "destructive" : "primary"}
                  disabled={kind === "MEDIATION_FAILED" ? !failure.mediationDate || failure.issuesDiscussed.trim().length < 5 || failure.outcome.trim().length < 5 : note.trim().length < 10}
                  onClick={() => {
                    if (
                      run(
                        () =>
                          MediationWorkspaceService.recordOutcome(id, {
                            kind,
                            note: kind === "MEDIATION_FAILED" ? failure.outcome : note,
                            failureRecord: failure,
                            followUpBy: followUp,
                            nextSession: { at: nsAt, channel: nsChannel, place: nsPlace },
                            settlementTerms: terms,
                          }),
                        tx("ফলাফল নথিভুক্ত হয়েছে; কর্মকর্তাকে জানানো হয়েছে।", "Outcome recorded; the officer has been notified."),
                      )
                    ) {
                      setKind(null);
                      setNote("");
                    }
                  }}
                >
                  {tx(`নথিভুক্ত করুন: ${OUTCOME_LABEL[kind].bn}`, `Record: ${OUTCOME_LABEL[kind].en}`)}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
      {outcomes.length ? (
        <div style={{ marginTop: "var(--s-4)" }}>
          <div className={ui.sectionHead}>{tx("নথিভুক্ত ফলাফল", "Recorded outcomes")}</div>
          <div className={ui.rows}>
            {outcomes.map((o) => (
              <Row key={o.outcomeId} label={formatDateTime(o.at, lang)}>
                <Tag tone={o.kind === "SETTLEMENT_REACHED" ? "ok" : o.kind === "MEDIATION_FAILED" ? "err" : "warn"}>{OUTCOME_LABEL[o.kind][lang]}</Tag> {o.note}
                {o.agreedTerms.length ? <div className={styles.hint}>{tx("সম্মত শর্ত:", "Agreed terms:")} {o.agreedTerms.join(" · ")}</div> : null}
                {o.failure ? <div className={styles.hint}>{tx("কারণ:", "Reason:")} {o.failure.reason} · {tx("পরামর্শ:", "suggested:")} {o.failure.recommendedNext}</div> : null}
                {o.nextSession ? <div className={styles.hint}>{tx("পরের সেশন:", "Next session:")} {formatDateTime(o.nextSession.at, lang)}</div> : null}
                {o.followUpBy ? <div className={styles.hint}>{tx("ফলো-আপ:", "Follow up by:")} {o.followUpBy}</div> : null}
              </Row>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

const FAILURE_PATH_LABEL: Record<FailureReferralPathway, { bn: string; en: string }> = {
  COURT_LEGAL_PATHWAY: { bn: "আদালত / আইনি পথ", en: "Court / legal pathway" },
  LAWYER_ASSIGNMENT: { bn: "আইনজীবী নিয়োগ", en: "Lawyer assignment" },
  FURTHER_LEGAL_AID_REVIEW: { bn: "আরও লিগ্যাল এইড পর্যালোচনা", en: "Further legal aid review" },
  OTHER_REFERRAL: { bn: "অন্য রেফারেল", en: "Other referral" },
};
const failureSuggestionReason = (path: FailureReferralPathway, lang: Lang) => {
  const text: Record<FailureReferralPathway, { bn: string; en: string }> = {
    COURT_LEGAL_PATHWAY: { bn: "আদালত-প্রেরিত মধ্যস্থতার পর প্রযোজ্য আদালত বা আইনি প্রক্রিয়া কর্মকর্তা পর্যালোচনা করবেন।", en: "The officer should review the applicable court or legal process after court-referred mediation." },
    LAWYER_ASSIGNMENT: { bn: "নথিভুক্ত মামলার ধরনে মধ্যস্থতার পর প্রতিনিধিত্ব প্রয়োজন হতে পারে।", en: "The recorded case type may require representation after mediation." },
    FURTHER_LEGAL_AID_REVIEW: { bn: "রেফারেলের আগে নথিভুক্ত মামলার তথ্য কর্মকর্তা আরও পর্যালোচনা করবেন।", en: "The officer should review the recorded case information before referral." },
    OTHER_REFERRAL: { bn: "মধ্যস্থতাকারীর প্রস্তাব অনুসরণ করা হয়েছে; কর্মকর্তার নিশ্চিতকরণ আবশ্যক।", en: "The suggestion follows the mediator proposal and requires officer confirmation." },
  };
  return text[path][lang];
};

function FailureRecordView({ id, ws }: { id: string; ws: MediationWorkspace | null }) {
  const { lang, tx } = useTx();
  const { run, node } = useRun();
  const [information, setInformation] = useState("");
  const record = ws?.failureRecord;
  if (!record) return null;
  const attendance = (side: PartySide) => record.attendance[side] === "PRESENT" ? tx("উপস্থিত", "Present") : record.attendance[side] === "REPRESENTED" ? tx("প্রতিনিধির মাধ্যমে", "Represented") : tx("অনুপস্থিত", "Absent");
  return <div className={ui.flowStep} style={{ marginTop: "var(--s-4)" }}>
    <div className={ui.sectionHead}>{tx("মধ্যস্থতা ব্যর্থতা / রেফারেল রেকর্ড", "MEDIATION FAILURE / REFERRAL RECORD")}</div>
    {node}
    <div className={ui.rows}>
      <Row label={tx("রেকর্ড আইডি", "Record ID")}><strong>{record.recordId}</strong></Row>
      <Row label={tx("কেস আইডি", "Case ID")}>{record.caseId}</Row>
      <Row label={tx("মধ্যস্থতার ধরন", "Mediation type")}>{record.mediationType === "COURT_REFERRED" ? tx("আদালত-প্রেরিত", "Court-referred") : tx("মামলা-পূর্ব", "Pre-case")}</Row>
      <Row label={tx("মধ্যস্থতাকারী", "Mediator")}>{record.mediator.name}</Row>
      <Row label={tx("তারিখ", "Date")}>{record.mediationDate}</Row>
      <Row label={tx("উপস্থিতি", "Attendance")}>{tx("আবেদনকারী", "Applicant")}: {attendance("APPLICANT")} · {tx("প্রতিপক্ষ", "Respondent")}: {attendance("RESPONDENT")}</Row>
      <Row label={tx("আলোচিত বিষয়", "Issues discussed")}>{record.issuesDiscussed}</Row>
      <Row label={tx("ফলাফল", "Outcome")}>{record.outcome}</Row>
      {record.reasonStatus ? <Row label={tx("কারণ / অবস্থা", "Reason / status")}>{record.reasonStatus}</Row> : null}
      {record.followUpRequirement ? <Row label={tx("ফলো-আপ", "Follow-up requirement")}>{record.followUpRequirement}</Row> : null}
      <Row label={tx("প্রক্রিয়াগত তথ্য", "Procedural information")}>{record.relevantProceduralInformation.sessionNumber ? `${tx("সেশন", "Session")} ${record.relevantProceduralInformation.sessionNumber}` : tx("সেশন নম্বর নেই", "No session number")} · {record.relevantProceduralInformation.channel ?? "—"} · {record.relevantProceduralInformation.completedAt ? formatDateTime(record.relevantProceduralInformation.completedAt, lang) : "—"}</Row>
      <Row label={tx("গোপনীয়তা", "Confidentiality")}><Tag tone="ok">{tx("গোপন একান্ত আলোচনার বিষয় বাদ দেওয়া হয়েছে", "Confidential caucus content excluded")}</Tag></Row>
      <Row label={tx("মধ্যস্থতাকারীর প্রস্তাব", "Mediator proposal")}>{FAILURE_PATH_LABEL[record.mediatorProposedPathway][lang]}</Row>
    </div>
    <div className={ui.advice} style={{ marginTop: "var(--s-4)" }}><Tag tone="ink">{tx("সিস্টেমের পরামর্শ", "SYSTEM SUGGESTION")}</Tag> <strong>{FAILURE_PATH_LABEL[record.systemSuggestion.pathway][lang]}</strong><div className={styles.hint}>{failureSuggestionReason(record.systemSuggestion.pathway, lang)} · {tx("পরামর্শমাত্র; কর্মকর্তা সিদ্ধান্ত নেবেন।", "Advisory only; the officer decides.")}</div></div>
    <div className={ui.sectionHead} style={{ marginTop: "var(--s-4)" }}>{tx("লিগ্যাল এইড অফিসারের পর্যালোচনা", "LEGAL AID OFFICER REVIEW")}</div>
    {record.status === "AWAITING_OFFICER_REVIEW" ? <Banner tone="warn" icon="i">{tx("কর্মকর্তার নিশ্চিতকরণ বাকি। এটি চূড়ান্ত আইনি পথ নয়।", "Officer confirmation is pending. This is not the final legal pathway.")}</Banner> : null}
    {record.status === "MORE_INFORMATION_REQUESTED" ? <div className={ui.flowStep}><Banner tone="warn" icon="!">{tx("আরও তথ্য চাওয়া হয়েছে", "More information requested")}: {record.officerReview.note}</Banner><label className={styles.field}><span className={styles.label}>{tx("প্রক্রিয়াগত উত্তর — গোপন একান্ত আলোচনা লিখবেন না", "Procedural response — do not disclose confidential caucus content")}</span><textarea className={styles.textarea} value={information} onChange={(e) => setInformation(e.target.value)} /></label><Button disabled={information.trim().length < 5} onClick={() => { if (run(() => MediationWorkspaceService.provideFailureInformation(id, information), tx("তথ্য কর্মকর্তার পর্যালোচনার জন্য পাঠানো হয়েছে।", "Information sent for officer review."))) setInformation(""); }}>{tx("তথ্য পাঠান", "Submit information")}</Button></div> : null}
    {record.additionalInformation.length ? <div className={ui.rows}>{record.additionalInformation.map((item, index) => <Row key={`${item.at}-${index}`} label={tx("অতিরিক্ত তথ্য", "Additional information")}>{item.text} · {formatDateTime(item.at, lang)}</Row>)}</div> : null}
    {record.confirmedPathway ? <Banner tone="ok" icon="✓"><strong>{tx("রেফারেল নিশ্চিত", "Referral confirmed")}: {FAILURE_PATH_LABEL[record.confirmedPathway][lang]}</strong><br />{record.officerReview.byName} · {record.officerReview.at ? formatDateTime(record.officerReview.at, lang) : ""} · {record.officerReview.note}</Banner> : null}
    {record.confirmedPathway === "LAWYER_ASSIGNMENT" ? <div className={ui.modeBar} aria-label={tx("হস্তান্তরের ধাপ", "Handoff steps")}>{[tx("মধ্যস্থতা", "Mediation"), tx("ব্যর্থতা", "Failure"), tx("রেফারেল রেকর্ড", "Referral record"), tx("লিগ্যাল এইড অফিসার", "Legal Aid Officer"), tx("আইনজীবী নিয়োগ", "Lawyer assignment")].map((item) => <Tag key={item} tone="ok">✓ {item}</Tag>)}</div> : null}
  </div>;
}

function SettlementExecution({ id, ws }: { id: string; ws: MediationWorkspace | null }) {
  const { lang, tx } = useTx();
  const { run, node } = useRun();
  const flow = ws?.settlementWorkflow;
  const [correction, setCorrection] = useState(() => ({
    issue: flow?.terms.issue ?? "",
    proposedResolution: flow?.terms.proposedResolution ?? "",
    agreedResolution: flow?.terms.agreedResolution ?? "",
    conditions: flow?.terms.conditions ?? "",
    deadline: flow?.terms.deadline ?? "",
    additionalTerms: flow?.terms.additionalTerms ?? "",
  }));
  if (!flow) return null;
  const needsCorrection = flow.status === "RETURNED_FOR_CORRECTION" || flow.status === "CLARIFICATION_REQUESTED";
  const bothSigned = Object.values(flow.execution).every((x) => x.status === "SIGNED");
  const step = flow.status === "RESOLVED" ? 5 : flow.status === "AWAITING_CLO_CERTIFICATION" || needsCorrection ? 4 : bothSigned ? 3 : 2;
  const steps = [tx("শর্ত নথিভুক্ত", "Terms recorded"), tx("পক্ষের স্বাক্ষর", "Party execution"), tx("মধ্যস্থতাকারীর নিশ্চিতকরণ", "Mediator confirms"), tx("অফিসারের যাচাই", "Officer verification"), tx("প্রত্যয়নপত্র ও কেস বন্ধ", "Testimonial & case closed")];
  return (
    <div className={ui.flowStep} style={{ marginTop: "var(--s-4)" }}>
      <div className={ui.sectionHead}>{tx("সফল নিষ্পত্তির কার্যপ্রবাহ", "Successful settlement workflow")}</div>
      {node}
      <div className={ui.modeBar} aria-label={tx("নিষ্পত্তির অগ্রগতি", "Settlement progress")}>
        {steps.map((labelText, index) => <Tag key={labelText} tone={index + 1 < step || flow.status === "RESOLVED" ? "ok" : index + 1 === step ? "ink" : "neutral"}>{index + 1}. {labelText}</Tag>)}
      </div>
      {needsCorrection ? (
        <Banner tone="warn" icon="!">
          <strong>{flow.status === "RETURNED_FOR_CORRECTION" ? tx("সংশোধনের জন্য ফেরত", "Returned for correction") : tx("ব্যাখ্যা চাওয়া হয়েছে", "Clarification requested")}</strong>
          {flow.cloReview.note ? ` — ${flow.cloReview.note}` : ""}
        </Banner>
      ) : null}
      <div className={ui.rows}>
        <Row label={tx("চুক্তি আইডি", "Agreement ID")}><strong>{flow.agreementId}</strong> · {tx("সংস্করণ", "revision")} {flow.terms.revision}</Row>
        <Row label={tx("বিষয়", "Issue")}>{flow.terms.issue}</Row>
        <Row label={tx("প্রস্তাবিত সমাধান", "Proposed resolution")}>{flow.terms.proposedResolution}</Row>
        <Row label={tx("সম্মত সমাধান", "Agreed resolution")}>{flow.terms.agreedResolution}</Row>
        <Row label={tx("শর্তাবলি", "Conditions")}>{flow.terms.conditions}</Row>
        <Row label={tx("সময়সীমা", "Deadline")}>{flow.terms.deadline ?? tx("নেই", "None")}</Row>
        <Row label={tx("অতিরিক্ত শর্ত", "Additional terms")}>{flow.terms.additionalTerms ?? tx("নেই", "None")}</Row>
      </div>
      {needsCorrection ? (
        <div className={ui.flowStep} style={{ marginTop: "var(--s-4)" }}>
          <div className={ui.sectionHead}>{tx("শর্ত সংশোধন করুন", "Revise terms")}</div>
          <div className={styles.grid}>
            {(["issue", "proposedResolution", "agreedResolution", "conditions"] as const).map((key) => (
              <label className={styles.field} key={key}><span className={styles.label}>{key === "issue" ? tx("বিষয়", "Issue") : key === "proposedResolution" ? tx("প্রস্তাবিত সমাধান", "Proposed resolution") : key === "agreedResolution" ? tx("সম্মত সমাধান", "Agreed resolution") : tx("শর্তাবলি", "Conditions")}</span><textarea className={styles.textarea} value={correction[key]} onChange={(e) => setCorrection({ ...correction, [key]: e.target.value })} /></label>
            ))}
            <label className={styles.field}><span className={styles.label}>{tx("সময়সীমা", "Deadline")}</span><input type="date" className={styles.input} value={correction.deadline} onChange={(e) => setCorrection({ ...correction, deadline: e.target.value })} /></label>
            <label className={styles.field}><span className={styles.label}>{tx("অতিরিক্ত শর্ত", "Additional terms")}</span><textarea className={styles.textarea} value={correction.additionalTerms} onChange={(e) => setCorrection({ ...correction, additionalTerms: e.target.value })} /></label>
          </div>
          <Button onClick={() => run(() => MediationWorkspaceService.reviseSettlementTerms(id, correction), tx("সংশোধিত শর্ত সংরক্ষিত হয়েছে। আবার স্বাক্ষর নিতে হবে।", "Revised terms saved. Both parties must sign again."))}>{tx("সংশোধন সংরক্ষণ", "Save correction")}</Button>
        </div>
      ) : null}
      {!needsCorrection && !flow.resolution ? (
        <>
          <div className={ui.sectionHead} style={{ marginTop: "var(--s-4)" }}>{tx("পক্ষের সম্পাদন / স্বাক্ষর", "Party execution / signatures")}</div>
          <Banner tone="warn" icon="i">{tx("DEMO / SIMULATED স্বাক্ষর — কোনো বাস্তব ডিজিটাল স্বাক্ষর ব্যবস্থা সংযুক্ত নেই।", "DEMO / SIMULATED signatures — no real digital signature system is connected.")}</Banner>
          <div className={ui.rows}>
            {(["APPLICANT", "RESPONDENT"] as PartySide[]).map((side) => {
              const signature = flow.execution[side];
              return <Row key={side} label={side === "APPLICANT" ? tx("আবেদনকারী", "Applicant") : tx("প্রতিপক্ষ", "Respondent")}><Tag tone={signature.status === "SIGNED" ? "ok" : "warn"}>{signature.status === "SIGNED" ? tx("স্বাক্ষরিত · DEMO / SIMULATED", "Signed · DEMO / SIMULATED") : tx("স্বাক্ষর বাকি", "Pending signature")}</Tag>{signature.signedAt ? ` · ${formatDateTime(signature.signedAt, lang)}` : ""}{signature.status !== "SIGNED" ? <div style={{ marginTop: 6 }}><Button variant="secondary" onClick={() => run(() => MediationWorkspaceService.simulatePartySignature(id, side), tx("DEMO / SIMULATED স্বাক্ষর নথিভুক্ত হয়েছে।", "DEMO / SIMULATED signature recorded."))}>{tx("DEMO স্বাক্ষর নিন", "Simulate signature")}</Button></div> : null}</Row>;
            })}
            <Row label={tx("মধ্যস্থতাকারী", "Mediator")}><Tag tone={flow.mediatorConfirmation.status === "CONFIRMED" ? "ok" : "warn"}>{flow.mediatorConfirmation.status === "CONFIRMED" ? tx("নিশ্চিত করেছেন", "Confirmed") : tx("নিশ্চিতকরণ বাকি", "Pending confirmation")}</Tag>{flow.mediatorConfirmation.confirmedAt ? ` · ${flow.mediatorConfirmation.mediatorName} · ${formatDateTime(flow.mediatorConfirmation.confirmedAt, lang)}` : ""}</Row>
          </div>
          {bothSigned && flow.mediatorConfirmation.status !== "CONFIRMED" ? <Button onClick={() => run(() => MediationWorkspaceService.confirmSettlement(id), tx("লিগ্যাল এইড অফিসারের যাচাইয়ের জন্য পাঠানো হয়েছে।", "Sent to the Legal Aid Officer for verification."))}>{tx("আমি নিশ্চিত করছি যে নথিভুক্ত শর্তগুলো মধ্যস্থতার ফলাফল সঠিকভাবে প্রতিফলিত করে।", "I confirm that the recorded terms reflect the mediation outcome.")}</Button> : null}
          {flow.status === "AWAITING_CLO_CERTIFICATION" ? <Banner tone="warn" icon="i">{tx("লিগ্যাল এইড অফিসারের যাচাই বাকি। পক্ষের স্বাক্ষর নিজে থেকে মামলাকে সমাধানকৃত করে না।", "The Legal Aid Officer's verification is pending. Party signatures do not resolve the case by themselves.")}</Banner> : null}
        </>
      ) : null}
      {flow.resolution ? <Banner tone="ok" icon="✓"><strong>{tx("অবস্থা: সমাধানকৃত", "Status: RESOLVED")}</strong><br />{flow.resolution.outcome}<br />{tx("প্রত্যয়নকারী কর্মকর্তা", "Certifying officer")}: {flow.resolution.certifyingOfficer} · {formatDateTime(flow.resolution.certificationTimestamp, lang)}</Banner> : null}
    </div>
  );
}

/* ------------------------------ 9: audit trail ------------------------------ */

const WHAT: Record<string, { bn: string; en: string }> = {
  "mediation.workspace_opened": { bn: "মধ্যস্থতাকারী মামলা খুলেছেন", en: "Mediator opened case" },
  "mediation.session_scheduled": { bn: "সেশন নির্ধারিত", en: "Session scheduled" },
  "mediation.session_rescheduled": { bn: "সেশন পুনর্নির্ধারিত", en: "Session rescheduled" },
  "mediation.session_started": { bn: "সেশন শুরু", en: "Session started" },
  "mediation.session_paused": { bn: "সেশনে বিরতি", en: "Session paused" },
  "mediation.session_resumed": { bn: "সেশন আবার শুরু", en: "Session resumed" },
  "mediation.session_ended": { bn: "সেশন শেষ", en: "Session ended" },
  "mediation.attendance_applicant": { bn: "আবেদনকারীর উপস্থিতি নথিভুক্ত", en: "Applicant attendance recorded" },
  "mediation.attendance_respondent": { bn: "অপর পক্ষের উপস্থিতি নথিভুক্ত", en: "Respondent attendance recorded" },
  "mediation.caucus_note_added": { bn: "গোপন নোট যোগ (লেখা গোপন)", en: "Confidential caucus note added (text withheld)" },
  "mediation.settlement_updated": { bn: "নিষ্পত্তির শর্ত হালনাগাদ", en: "Settlement terms updated" },
  "mediation.outcome_recorded": { bn: "ফলাফল নথিভুক্ত", en: "Outcome recorded" },
  "mediation.failure_record_created": { bn: "মধ্যস্থতা ব্যর্থতা / রেফারেল রেকর্ড তৈরি", en: "Mediation failure / referral record created" },
  "mediation.failure_information_supplied": { bn: "অতিরিক্ত প্রক্রিয়াগত তথ্য দেওয়া", en: "Additional procedural information supplied" },
  "mediation.failure_more_information_requested": { bn: "কর্মকর্তা আরও তথ্য চেয়েছেন", en: "Officer requested more information" },
  "mediation.referral_confirmed": { bn: "কর্মকর্তা রেফারেল নিশ্চিত করেছেন", en: "Officer confirmed referral" },
  "mediation.lawyer_handoff_created": { bn: "আইনজীবী নিয়োগে হস্তান্তর তৈরি", en: "Lawyer assignment handoff created" },
  "settlement.party_signed": { bn: "DEMO / SIMULATED পক্ষের স্বাক্ষর নথিভুক্ত", en: "DEMO / SIMULATED party signature recorded" },
  "settlement.mediator_confirmed": { bn: "মধ্যস্থতাকারী নিষ্পত্তি নিশ্চিত করেছেন", en: "Mediator confirmed settlement" },
  "settlement.terms_revised": { bn: "নিষ্পত্তির শর্ত সংশোধিত", en: "Settlement terms revised" },
  "settlement.returned_for_correction": { bn: "অফিসার সংশোধনের জন্য ফেরত দিয়েছেন", en: "Officer returned agreement for correction" },
  "settlement.clarification_requested": { bn: "অফিসার ব্যাখ্যা চেয়েছেন", en: "Officer requested clarification" },
  "settlement.certified": { bn: "অফিসার নিষ্পত্তি যাচাই করেছেন", en: "Officer verified the settlement" },
  "settlement.testimonial_issued": { bn: "অফিসার প্রত্যয়নপত্র ইস্যু করেছেন — কেস বন্ধ", en: "Officer issued the testimonial — case closed" },
  "mediation.document_viewed": { bn: "নথি দেখা হয়েছে", en: "Document viewed" },
  "mediation.document_downloaded": { bn: "নথি ডাউনলোড", en: "Document downloaded" },
  "mediation.access_updated": { bn: "যোগাযোগ/প্রবেশযোগ্যতা হালনাগাদ", en: "Communication / access updated" },
  "mediation.respondent_updated": { bn: "অপর পক্ষের তথ্য হালনাগাদ", en: "Opposing party details updated" },
  "mediation.matter_opened": { bn: "মধ্যস্থতা মামলা খোলা (কর্মকর্তা)", en: "Mediation opened (officer)" },
  "mediation.eligibility_checked": { bn: "যোগ্যতা যাচাই (কর্মকর্তা)", en: "Eligibility checked (officer)" },
  "mediation.mediator_recommended": { bn: "মধ্যস্থতাকারী সুপারিশ (কর্মকর্তা)", en: "Mediator recommended (officer)" },
  "mediation.mediator_assigned": { bn: "মধ্যস্থতাকারী নিয়োগ (কর্মকর্তা)", en: "Mediator assigned (officer)" },
  "notice.sms_sent": { bn: "আবেদনকারীকে এসএমএস (সিমুলেটেড)", en: "SMS to applicant (simulated)" },
  "notice.sms_suppressed": { bn: "এসএমএস বন্ধ (নিরাপত্তা)", en: "SMS suppressed (safety)" },
  "task.created": { bn: "কাজ খোলা হয়েছে", en: "Task created" },
  "mediation.voice_call": { bn: "ফোন কল (সিমুলেটেড)", en: "Voice call (simulated)" },
  "mediation.online_connection": { bn: "অনলাইন সংযোগ (সিমুলেটেড)", en: "Online connection (simulated)" },
  "mediation.channel_switched": { bn: "মাধ্যম পরিবর্তন / বিকল্প", en: "Channel switched / fallback" },
  "mediation.venue_check_in": { bn: "অফিসে পৌঁছেছেন", en: "Arrived at venue" },
};

function Audit({ entries }: { entries: { seq: number; at: string; actor: string; role: string; action: string; detail?: Record<string, unknown> }[] }) {
  const { lang, tx } = useTx();
  const list = [...entries].reverse();
  const who = (e: (typeof entries)[number]) => String((e.role === "mediator" ? e.detail?.mediator : e.detail?.officer) ?? e.actor);
  const extra = (e: (typeof entries)[number]) => {
    const d = e.detail ?? {};
    if (e.action === "mediation.settlement_updated") return `${d.op} · ${d.list ?? `${d.from} → ${d.to}`}`;
    if (e.action === "mediation.outcome_recorded") return String(d.kind);
    if (e.action.startsWith("mediation.attendance")) return String(d.status);
    if (e.action === "mediation.caucus_note_added") return String(d.side).toLowerCase();
    if (e.action.startsWith("mediation.document")) return String(d.type);
    if (e.action === "mediation.voice_call") return `${String(d.side).toLowerCase()} · ${d.state}`;
    if (e.action === "mediation.online_connection") return `${String(d.who).toLowerCase()} · ${d.state}`;
    if (e.action === "mediation.channel_switched") return `${d.from} → ${d.to} · ${d.reason}`;
    if (e.action === "mediation.venue_check_in") return String(d.side).toLowerCase();
    return "";
  };
  return (
    <section className={ui.flowStep}>
      <div className={ui.flowLabel}>
        <span className={ui.flowNum}>9</span>
        {tx("অডিট ট্রেইল", "Audit trail")}
      </div>
      <div className={styles.tableWrap} style={{ maxHeight: 480 }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{tx("কে", "Who")}</th>
              <th>{tx("কী", "What")}</th>
              <th>{tx("কখন", "When")}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.seq}>
                <td>
                  {who(e)}
                  <div className={styles.hint}>{e.role === "mediator" ? tx("মধ্যস্থতাকারী", "mediator") : e.role === "dlao" ? tx("কর্মকর্তা", "officer") : e.role}</div>
                </td>
                <td>
                  {WHAT[e.action]?.[lang] ?? e.action}
                  {extra(e) ? <span className={styles.hint}> · {extra(e)}</span> : null}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(e.at, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
