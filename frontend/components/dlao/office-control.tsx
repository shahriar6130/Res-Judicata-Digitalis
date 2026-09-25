"use client";

/* ------------------------------------------------------------------ *
 *  Feature 10 — Legal Aid Office control center, on the office overview
 *  (/dashboard/dlo#overview). Answers "what needs my attention right now?"
 *
 *  1. NEEDS YOU NOW   — cases where this officer must act, overdue first
 *  2. Stage lanes     — Intake · Pathway · Mediation · Deadlines; each
 *                       stage filters the case table
 *  3. Case table      — Case ID · Applicant · Dispute · Pathway · Mediator ·
 *                       Status · Last action · Next action · Deadline, with the
 *                       quick action that opens the owning workflow
 *
 *  Read-only: every button links into the workflow that makes the change.
 *  Data: lib/dlas/office-control.ts
 * ------------------------------------------------------------------ */

import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { MATTERS, formatDateTime, label, useOfficeControl, type ActionOwner, type ControlRow, type ControlStatus, type QuickAction } from "@/lib/dlas";
import cc from "./office-control.module.css";

type Lang = "bn" | "en";
type Tone = "err" | "warn" | "ok" | "ink" | "neutral";

function useTx() {
  const { lang } = useI18n();
  return { lang: lang as Lang, tx: (bn: string, en: string) => (lang === "bn" ? bn : en) };
}

export const STATUS: Record<ControlStatus, { bn: string; en: string; tone: Tone }> = {
  NEW: { bn: "নতুন", en: "New", tone: "ink" },
  PENDING_VERIFICATION: { bn: "যাচাই বাকি", en: "Pending verification", tone: "warn" },
  INCOMPLETE: { bn: "অসম্পূর্ণ", en: "Incomplete", tone: "err" },
  AWAITING_CLASSIFICATION: { bn: "পথ নির্ধারণ বাকি", en: "Awaiting classification", tone: "warn" },
  MANDATORY_AWAITING_CONFIRMATION: { bn: "বাধ্যতামূলক মধ্যস্থতা — নিশ্চিতকরণ বাকি", en: "Mandatory mediation — confirm", tone: "warn" },
  MEDIATION_AVAILABLE: { bn: "মধ্যস্থতা প্রযোজ্য", en: "Mediation available", tone: "warn" },
  LAWYER_PATHWAY: { bn: "আইনজীবী পথ", en: "Lawyer pathway", tone: "neutral" },
  ASSIGNMENT_PENDING: { bn: "মধ্যস্থতাকারী নিয়োগ বাকি", en: "Mediator assignment pending", tone: "warn" },
  AWAITING_OFFICER_CONFIRMATION: { bn: "কর্মকর্তার নিশ্চিতকরণ বাকি", en: "Awaiting officer confirmation", tone: "warn" },
  AWAITING_MEDIATOR_ACCEPTANCE: { bn: "মধ্যস্থতাকারীর সম্মতির অপেক্ষা", en: "Awaiting mediator acceptance", tone: "neutral" },
  AWAITING_SCHEDULE: { bn: "সেশন নির্ধারণ বাকি", en: "Awaiting schedule", tone: "neutral" },
  SCHEDULED: { bn: "নির্ধারিত", en: "Scheduled", tone: "ok" },
  IN_PROGRESS: { bn: "চলমান", en: "In progress", tone: "ink" },
  AWAITING_OUTCOME: { bn: "ফলাফলের অপেক্ষা", en: "Awaiting outcome", tone: "neutral" },
  OUTCOME_REVIEW: { bn: "ফলাফল পর্যালোচনা", en: "Outcome to review", tone: "warn" },
  SETTLEMENT_EXECUTION: { bn: "চুক্তি স্বাক্ষর চলছে", en: "Agreement in execution", tone: "neutral" },
  AGREEMENT_AWAITING_CERTIFICATION: { bn: "প্রত্যয়নের অপেক্ষা", en: "Awaiting certification", tone: "warn" },
  FAILED: { bn: "ব্যর্থ মধ্যস্থতা", en: "Failed mediation", tone: "err" },
  REFERRAL_PENDING: { bn: "রেফারেল বাকি", en: "Referral pending", tone: "err" },
  RESOLVED: { bn: "নিষ্পন্ন", en: "Resolved", tone: "ok" },
  REFERRED: { bn: "রেফার করা", en: "Referred", tone: "neutral" },
  REJECTED: { bn: "প্রত্যাখ্যাত", en: "Not eligible", tone: "neutral" },
};

const QUICK: Record<QuickAction, { bn: string; en: string }> = {
  OPEN: { bn: "কেস খুলুন", en: "Open case" },
  VERIFY: { bn: "যাচাই", en: "Verify" },
  REVIEW_PATHWAY: { bn: "পথ পর্যালোচনা", en: "Review pathway" },
  ASSIGN_MEDIATOR: { bn: "মধ্যস্থতাকারী নিয়োগ", en: "Assign mediator" },
  SCHEDULE_MEDIATION: { bn: "সেশন নির্ধারণ — ফলো-আপ", en: "Schedule mediation — follow up" },
  REVIEW_AGREEMENT: { bn: "চুক্তি পর্যালোচনা", en: "Review agreement" },
  CERTIFY: { bn: "যাচাই", en: "Verify" },
  REVIEW_FAILURE: { bn: "ব্যর্থতা / রেফারেল পর্যালোচনা", en: "Review failure / referral" },
};

const OWNER: Record<ActionOwner, { bn: string; en: string }> = {
  OFFICER: { bn: "আপনি", en: "YOU" },
  CLO: { bn: "CLO", en: "CLO" },
  MEDIATOR: { bn: "মধ্যস্থতাকারী", en: "MEDIATOR" },
  PARTY: { bn: "পক্ষ", en: "PARTY" },
  LAWYER: { bn: "আইনজীবী", en: "LAWYER" },
  NONE: { bn: "—", en: "—" },
};

const PATHWAY: Record<string, { bn: string; en: string }> = {
  MEDIATION: { bn: "মধ্যস্থতা", en: "Mediation" },
  LAWYER: { bn: "আইনজীবী", en: "Lawyer" },
  GRAM_ADALAT: { bn: "গ্রাম আদালত", en: "Gram Adalat" },
  REFERRAL: { bn: "রেফারেল", en: "Referral" },
};

const dotClass = (t: Tone) => `${cc.dot} ${t === "err" ? cc.dotErr : t === "warn" ? cc.dotWarn : t === "ok" ? cc.dotOk : t === "ink" ? cc.dotInk : ""}`;
const pretty = (s: string) => s.replace(/^(mediation|pathway|settlement|mediator|review|task|notice|lawyer|staff|intake|status)\./, "").replaceAll("_", " ");

function relative(at: string, now: number, lang: Lang) {
  if (!now) return "";
  const mins = Math.round((new Date(at).getTime() - now) / 60_000);
  const abs = Math.abs(mins);
  const n = abs < 60 ? `${abs}m` : abs < 48 * 60 ? `${Math.round(abs / 60)}h` : `${Math.round(abs / 1440)}d`;
  return mins < 0 ? (lang === "bn" ? `${n} দেরি` : `${n} overdue`) : lang === "bn" ? `${n} বাকি` : `in ${n}`;
}

function Deadline({ r, now }: { r: ControlRow; now: number }) {
  const { lang } = useTx();
  if (!r.deadline) return <span className={cc.muted}>—</span>;
  const cls = r.deadline.state === "OVERDUE" ? cc.dueErr : r.deadline.state === "DUE_SOON" ? cc.dueWarn : "";
  return (
    <span>
      <span className={`${cc.due} ${cls}`}>
        {r.deadline.state === "OVERDUE" ? "⚠ " : ""}
        {relative(r.deadline.at, now, lang)}
      </span>
      <span className={cc.sub}>{formatDateTime(r.deadline.at, lang)}</span>
      <span className={cc.sub}>{r.deadline.what[lang]}</span>
    </span>
  );
}

function Go({ href, children, ghost }: { href: string; children: ReactNode; ghost?: boolean }) {
  return (
    <a className={`${cc.go} ${ghost ? cc.goGhost : ""}`} href={href}>
      {children}
    </a>
  );
}

function Stage({ k, n, on, onPick, tone }: { k: string; n: number; on: boolean; onPick: () => void; tone?: Tone }) {
  const t: Tone = tone ?? "neutral";
  return (
    <button type="button" className={`${cc.stage} ${on ? cc.stageOn : ""} ${n ? "" : cc.stageZero}`} onClick={onPick} aria-pressed={on}>
      <span>{k}</span>
      <span className={`${cc.count} ${n ? (t === "err" ? cc.countErr : t === "warn" ? cc.countWarn : t === "ink" ? cc.countInk : "") : ""}`}>{n}</span>
    </button>
  );
}

type Filter = { kind: "ACTIVE" } | { kind: "MINE" } | { kind: "WAITING" } | { kind: "OVERDUE" } | { kind: "URGENT" } | { kind: "ALL" } | { kind: "STATUS"; statuses: ControlStatus[]; label: string };

export function OfficeControlCenter() {
  const { lang, tx } = useTx();
  const v = useOfficeControl();
  const [filter, setFilter] = useState<Filter>({ kind: "ACTIVE" });
  if (!v) return null;
  const { lanes, deadlines, attention, now } = v;

  const pick = (statuses: ControlStatus[], l: string) => {
    setFilter((f) => (f.kind === "STATUS" && f.label === l ? { kind: "ACTIVE" } : { kind: "STATUS", statuses, label: l }));
    document.getElementById("office-case-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const isOn = (l: string) => filter.kind === "STATUS" && filter.label === l;
  const S = (status: ControlStatus, n: number, l?: string, statuses?: ControlStatus[]) => {
    const text = l ?? STATUS[status][lang];
    return <Stage key={status} k={text} n={n} on={isOn(text)} onPick={() => pick(statuses ?? [status], text)} tone={STATUS[status].tone} />;
  };

  const rows = v.rows.filter((r) =>
    filter.kind === "ALL" ? true
    : filter.kind === "ACTIVE" ? r.active
    : filter.kind === "MINE" ? r.active && r.owner === "OFFICER"
    : filter.kind === "WAITING" ? r.active && r.owner !== "OFFICER" && r.owner !== "NONE"
    : filter.kind === "OVERDUE" ? r.deadline?.state === "OVERDUE"
    : filter.kind === "URGENT" ? r.urgent
    : filter.statuses.includes(r.status) && (r.active || filter.statuses.includes("RESOLVED")),
  );
  const overdueCount = deadlines.overdue.sessions.length + deadlines.overdue.tasks.length;
  const top = attention.slice(0, 6);

  return (
    <section className={cc.center} aria-label={tx("অফিস নিয়ন্ত্রণ কেন্দ্র", "Office control center")}>
      {/* 1 — needs you now */}
      <div className={cc.headRow}>
        <div>
          <p className={cc.kicker}>{tx("নিয়ন্ত্রণ কেন্দ্র", "CONTROL CENTER")} · {v.clo ? tx("চিফ লিগ্যাল এইড অফিসার", "Chief Legal Aid Officer") : tx("লিগ্যাল এইড অফিসার", "Legal Aid Officer")}</p>
          <h2 className={cc.h2}>{tx("এখন আপনার মনোযোগ দরকার", "Needs your attention now")}</h2>
        </div>
        <span className={cc.headNote}>{tx("জরুরি ও দেরি হওয়া আগে। প্রতিটি বোতাম সংশ্লিষ্ট কাজের ধাপ খোলে — সিদ্ধান্ত সেখানেই আপনি নেন।", "Urgent and overdue first. Each button opens the workflow step — the decision is always yours, made there.")}</span>
      </div>
      <div className={cc.now}>
        {top.length === 0 ? (
          <div className={cc.nowEmpty}>✓ {tx("এই মুহূর্তে আপনার কোনো কাজ বাকি নেই।", "Nothing is waiting on you right now.")}</div>
        ) : (
          top.map((r) => (
            <div className={cc.nowItem} key={r.a.applicationId}>
              <span className={`${cc.rail} ${r.urgent || r.deadline?.state === "OVERDUE" ? cc.railErr : r.deadline?.state === "DUE_SOON" ? cc.railWarn : cc.railInk}`} aria-hidden />
              <div className={cc.nowMain}>
                <div className={cc.nowTop}>
                  <span className={cc.nowCase}>{r.caseRef}</span>
                  <span>{r.a.data.applicant.fullName ?? "—"}</span>
                  <span className={cc.status}>
                    <span className={dotClass(STATUS[r.status].tone)} />
                    {STATUS[r.status][lang]}
                  </span>
                  {r.urgent ? <strong style={{ color: "var(--red)" }}>{tx("জরুরি", "URGENT")}</strong> : null}
                  {r.deadline ? (
                    <span className={`${cc.due} ${r.deadline.state === "OVERDUE" ? cc.dueErr : r.deadline.state === "DUE_SOON" ? cc.dueWarn : ""}`}>
                      {r.deadline.state === "OVERDUE" ? "⚠ " : "⏱ "}
                      {relative(r.deadline.at, now, lang)}
                    </span>
                  ) : null}
                  {r.owner !== "OFFICER" ? <span>· {tx("অপেক্ষমাণ", "waiting on")} {OWNER[r.owner][lang]}</span> : null}
                </div>
                <div className={cc.nowAction}>→ {r.next.label[lang]}</div>
              </div>
              <Go href={r.next.href}>{QUICK[r.next.action][lang]} →</Go>
            </div>
          ))
        )}
      </div>
      {attention.length > top.length ? (
        <p className={cc.muted} style={{ fontSize: "var(--t-small)", margin: "6px 0 0" }}>
          <button type="button" className={cc.chip} onClick={() => setFilter({ kind: "MINE" })}>
            {tx(`আরও ${attention.length - top.length}টি — টেবিলে দেখুন`, `${attention.length - top.length} more — show in table`)}
          </button>
        </p>
      ) : null}

      {/* 2 — lanes */}
      <div className={cc.lanes}>
        <div className={cc.lane}>
          <div className={cc.laneTitle}>
            <span>{tx("গ্রহণ", "INTAKE")}</span>
          </div>
          {S("NEW", lanes.INTAKE.NEW, tx("নতুন আবেদন", "New applications"))}
          {S("PENDING_VERIFICATION", lanes.INTAKE.PENDING_VERIFICATION)}
          {S("INCOMPLETE", lanes.INTAKE.INCOMPLETE, tx("অসম্পূর্ণ আবেদন", "Incomplete applications"))}
        </div>
        <div className={cc.lane}>
          <div className={cc.laneTitle}>
            <span>{tx("আইনি পথ", "PATHWAY")}</span>
          </div>
          {S("AWAITING_CLASSIFICATION", lanes.PATHWAY.AWAITING_CLASSIFICATION, tx("শ্রেণিবিন্যাসের অপেক্ষা", "Awaiting legal classification"))}
          {S("MANDATORY_AWAITING_CONFIRMATION", lanes.PATHWAY.MANDATORY_AWAITING_CONFIRMATION, tx("বাধ্যতামূলক মধ্যস্থতা — নিশ্চিতকরণ বাকি", "Mandatory mediation awaiting confirmation"))}
          {S("MEDIATION_AVAILABLE", lanes.PATHWAY.MEDIATION_AVAILABLE)}
          {S("LAWYER_PATHWAY", lanes.PATHWAY.LAWYER_PATHWAY)}
          <Stage k={tx("জরুরি কেস", "Urgent cases")} n={lanes.PATHWAY.URGENT} on={filter.kind === "URGENT"} onPick={() => setFilter((f) => (f.kind === "URGENT" ? { kind: "ACTIVE" } : { kind: "URGENT" }))} tone="err" />
        </div>
        <div className={cc.lane}>
          <div className={cc.laneTitle}>
            <span>{tx("মধ্যস্থতা", "MEDIATION")}</span>
          </div>
          {S("ASSIGNMENT_PENDING", lanes.MEDIATION.ASSIGNMENT_PENDING)}
          {S("AWAITING_OFFICER_CONFIRMATION", lanes.MEDIATION.AWAITING_OFFICER_CONFIRMATION)}
          {S("AWAITING_MEDIATOR_ACCEPTANCE", lanes.MEDIATION.AWAITING_MEDIATOR_ACCEPTANCE)}
          {S("AWAITING_SCHEDULE", lanes.MEDIATION.AWAITING_SCHEDULE)}
          {S("SCHEDULED", lanes.MEDIATION.SCHEDULED)}
          {S("IN_PROGRESS", lanes.MEDIATION.IN_PROGRESS)}
          {S("AWAITING_OUTCOME", lanes.MEDIATION.AWAITING_OUTCOME, undefined, ["AWAITING_OUTCOME", "OUTCOME_REVIEW"])}
          {S("AGREEMENT_AWAITING_CERTIFICATION", lanes.MEDIATION.AGREEMENT_AWAITING_CERTIFICATION, tx("চুক্তি প্রত্যয়নের অপেক্ষা", "Agreement awaiting certification"))}
          {S("FAILED", lanes.MEDIATION.FAILED)}
          {S("REFERRAL_PENDING", lanes.MEDIATION.REFERRAL_PENDING)}
        </div>
        <div className={cc.lane}>
          <div className={cc.laneTitle}>
            <span>{tx("সময়সীমা", "DEADLINES")}</span>
            {overdueCount ? <span className={`${cc.count} ${cc.countErr}`}>{overdueCount}</span> : null}
          </div>
          <div className={cc.dl}>
            <strong>{tx("আসন্ন মধ্যস্থতা (৭ দিন)", "Upcoming mediation (7 days)")}</strong> <span className={cc.count}>{deadlines.upcoming.length}</span>
            {deadlines.upcoming.slice(0, 3).map((x) => (
              <a key={x.s.sessionId} className={cc.dlItem} href={`#app/${encodeURIComponent(x.a.applicationId)}`}>
                {x.a.caseId ?? x.a.applicationId} · {formatDateTime(x.at, lang)} <span className={cc.muted}>({relative(x.at, now, lang)})</span>
              </a>
            ))}
          </div>
          <div className={cc.dl}>
            <strong style={overdueCount ? { color: "var(--red)" } : undefined}>{tx("দেরি হওয়া মধ্যস্থতা", "Overdue mediation")}</strong> <span className={`${cc.count} ${overdueCount ? cc.countErr : ""}`}>{overdueCount}</span>
            {deadlines.overdue.sessions.slice(0, 2).map((x) => (
              <a key={x.s.sessionId} className={cc.dlItem} href={`#app/${encodeURIComponent(x.a.applicationId)}`}>
                {x.a.caseId ?? x.a.applicationId} · {tx("সেশন শুরু হয়নি", "session not started")} · {relative(x.at, now, lang)}
              </a>
            ))}
            {deadlines.overdue.tasks.slice(0, 2).map((t) => (
              <a key={t.taskId} className={cc.dlItem} href={`#app/${encodeURIComponent(t.applicationId ?? "")}`}>
                {t.reason} · {relative(t.dueAt, now, lang)}
              </a>
            ))}
          </div>
          <div className={cc.dl}>
            <strong>{tx("যাচাই / প্রত্যয়নপত্র বাকি", "Awaiting your verification / testimonial")}</strong> <span className={`${cc.count} ${deadlines.certification.length ? cc.countWarn : ""}`}>{deadlines.certification.length}</span>
            {deadlines.certification.slice(0, 2).map((r) => (
              <a key={r.a.applicationId} className={cc.dlItem} href={r.next.href}>
                {r.caseRef} · {r.next.label[lang]}
              </a>
            ))}
          </div>
          <div className={cc.dl}>
            <strong>{tx("ফলো-আপ বাকি (৪৮ ঘণ্টা)", "Follow-up due (48 h)")}</strong> <span className={`${cc.count} ${deadlines.followUps.length ? cc.countWarn : ""}`}>{deadlines.followUps.length}</span>
            {deadlines.followUps.slice(0, 3).map((t) => (
              <a key={t.taskId} className={cc.dlItem} href={`#app/${encodeURIComponent(t.applicationId ?? "")}`}>
                {t.reason} · <span className={new Date(t.dueAt).getTime() < now ? cc.dueErr : cc.dueWarn}>{relative(t.dueAt, now, lang)}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* 3 — case table */}
      <div className={cc.filters} id="office-case-table">
        {(
          [
            ["ACTIVE", tx("সব চলমান", "All active")],
            ["MINE", tx("আমার কাজ", "Needs me")],
            ["WAITING", tx("অন্যের অপেক্ষায়", "Waiting on others")],
            ["OVERDUE", tx("দেরি", "Overdue")],
            ["URGENT", tx("জরুরি", "Urgent")],
            ["ALL", tx("সব (বন্ধসহ)", "All incl. closed")],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" className={`${cc.chip} ${filter.kind === k ? cc.chipOn : ""}`} onClick={() => setFilter({ kind: k })}>
            {l}
          </button>
        ))}
        {filter.kind === "STATUS" ? (
          <button type="button" className={`${cc.chip} ${cc.chipOn}`} onClick={() => setFilter({ kind: "ACTIVE" })}>
            {filter.label} ✕
          </button>
        ) : null}
        <span className={cc.muted} style={{ marginLeft: "auto", fontSize: "var(--t-small)" }}>
          {rows.length} {tx("টি কেস", "cases")}
        </span>
      </div>
      <div className={cc.tableWrap}>
        <table className={cc.table}>
          <thead>
            <tr>
              <th>{tx("কেস আইডি", "Case ID")}</th>
              <th>{tx("আবেদনকারী", "Applicant")}</th>
              <th>{tx("বিরোধের ধরন", "Dispute type")}</th>
              <th>{tx("পথ", "Pathway")}</th>
              <th>{tx("মধ্যস্থতাকারী", "Mediator")}</th>
              <th>{tx("অবস্থা", "Status")}</th>
              <th>{tx("শেষ কাজ", "Last action")}</th>
              <th>{tx("পরবর্তী কাজ", "Next action")}</th>
              <th>{tx("সময়সীমা", "Deadline")}</th>
              <th>{tx("দ্রুত কাজ", "Quick action")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className={cc.muted}>
                  {tx("এই ফিল্টারে কোনো কেস নেই।", "No cases match this filter.")}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const sub = r.a.pathwayClassification?.inputs.subcategory;
                const pw = r.a.review?.pathway?.type;
                return (
                  <tr key={r.a.applicationId} className={r.urgent ? cc.rowUrgent : undefined}>
                    <td>
                      <a href={`#app/${encodeURIComponent(r.a.applicationId)}`} style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                        {r.caseRef}
                      </a>
                      {r.a.caseId ? <span className={cc.sub}>{r.a.applicationId}</span> : null}
                      {r.urgent ? <span className={cc.sub} style={{ color: "var(--red)", fontWeight: 700 }}>{tx("জরুরি", "URGENT")}</span> : null}
                    </td>
                    <td>
                      {r.a.data.applicant.fullName ?? "—"}
                      <span className={cc.sub}>{r.a.channel.code}</span>
                    </td>
                    <td>
                      {label(MATTERS, r.a.data.matter.category, lang)}
                      {sub ? <span className={cc.sub}>{sub.replaceAll("_", " ").toLowerCase()}</span> : null}
                    </td>
                    <td>
                      {pw ? PATHWAY[pw][lang] : <span className={cc.muted}>{tx("নির্ধারিত হয়নি", "Not decided")}</span>}
                      {r.a.mediation?.track ? <span className={cc.sub}>{r.a.mediation.track === "COURT_REFERRED" ? tx("আদালত-প্রেরিত", "court-referred") : tx("মামলা-পূর্ব", "pre-litigation")}</span> : null}
                    </td>
                    <td>{r.mediator ?? <span className={cc.muted}>—</span>}</td>
                    <td>
                      <span className={cc.status}>
                        <span className={dotClass(STATUS[r.status].tone)} />
                        {STATUS[r.status][lang]}
                      </span>
                    </td>
                    <td>
                      {r.lastAction ? (
                        <>
                          {pretty(r.lastAction.action)}
                          <span className={cc.sub}>
                            {r.lastAction.user} · {formatDateTime(r.lastAction.at, lang)}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {r.owner !== "NONE" ? <span className={`${cc.owner} ${r.owner === "OFFICER" ? cc.ownerYou : ""}`}>{OWNER[r.owner][lang]}</span> : null}
                      <span style={{ display: "block" }}>{r.next.label[lang]}</span>
                    </td>
                    <td>
                      <Deadline r={r} now={now} />
                    </td>
                    <td>
                      <div className={cc.actions}>
                        <Go href={r.next.href} ghost={r.owner !== "OFFICER"}>
                          {QUICK[r.next.action][lang]}
                        </Go>
                        {r.next.action !== "OPEN" && r.next.href !== `#app/${encodeURIComponent(r.a.applicationId)}` ? (
                          <a href={`#app/${encodeURIComponent(r.a.applicationId)}`} style={{ fontSize: "var(--t-small)" }}>
                            {QUICK.OPEN[lang]}
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
