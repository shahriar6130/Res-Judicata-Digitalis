"use client";

/* ------------------------------------------------------------------ *
 *  /dashboard/lawyer — Panel lawyer workspace (B5, T1 inputs).
 *  Everything is read from and written to the shared record in
 *  localStorage["dlas.db.v1"] via LawyerService — nothing hardcoded.
 *
 *  Hash routes:  #overview · #assigned · #reports · #calendar · #case/<APP-ID>
 * ------------------------------------------------------------------ */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/button";
import { DocViewButton } from "@/components/dlas/doc-viewer";
import { useI18n } from "@/lib/i18n";
import {
  DISTRICTS,
  DOC_TYPES,
  LawyerService,
  MATTERS,
  URGENCY_FLAGS,
  activeAssignment,
  hasCaseAccess,
  hearingMissed,
  useLawyerRules,
  formatDateTime,
  hearingState,
  label,
  safeTimeLabel,
  useDlasDb,
  useLawyerDeadlineSweep,
  useLawyerWork,
  type ApplicationRecord,
  type Hearing,
  type HearingState,
  type HearingUpdate,
  type LawyerAssignment,
} from "@/lib/dlas";
import styles from "@/components/dlas/dlas.module.css";
import ui from "@/components/dlao/dlao.module.css";

type View = { kind: "overview" | "assigned" | "reports" | "calendar" } | { kind: "case"; id: string };

function parseHash(h: string): View {
  const raw = h.replace(/^#/, "");
  if (raw.startsWith("case/")) return { kind: "case", id: decodeURIComponent(raw.slice(5)) };
  if (raw === "assigned" || raw === "reports" || raw === "calendar") return { kind: raw };
  return { kind: "overview" };
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

/* ------------------------------ small UI pieces ------------------------------ */

type Tone = "ok" | "err" | "warn" | "ink" | "neutral";

function Tag({ tone = "neutral", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <span className={`${ui.tag} ${tone !== "neutral" ? ui[tone] : ""}`} title={title}>
      {children}
    </span>
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

function Row({ label: l, children }: { label: string; children: ReactNode }) {
  return (
    <div className={ui.row}>
      <div className={ui.rowLabel}>{l}</div>
      <div className={ui.rowValue}>{children}</div>
    </div>
  );
}

const pretty = (code: string) => {
  const t = code.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function useTx() {
  const { lang } = useI18n();
  return { lang, tx: (bn: string, en: string) => (lang === "bn" ? bn : en) };
}

const STATE_TONE: Record<HearingState, Tone> = { UPCOMING: "neutral", UPDATE_DUE: "warn", OVERDUE: "err", REPORTED: "ok" };

function HearingTag({ state }: { state: HearingState }) {
  const { tx } = useTx();
  const text = {
    UPCOMING: tx("আসন্ন", "Upcoming"),
    UPDATE_DUE: tx("প্রতিবেদন বাকি", "Update due"),
    OVERDUE: tx("প্রতিবেদন দেরি — ডিএলএও জানে", "Update overdue — DLAO alerted"),
    REPORTED: tx("✓ প্রতিবেদন দেওয়া", "✓ Reported"),
  }[state];
  return <Tag tone={STATE_TONE[state]}>{text}</Tag>;
}

function caseTitle(a: ApplicationRecord, lang: "bn" | "en") {
  return `${a.caseId ?? a.applicationId} · ${label(MATTERS, a.data.matter.category, lang)}`;
}

/* ================================================================== */

export function LawyerWorkspace() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const { tx } = useTx();
  const router = useRouter();
  const work = useLawyerWork();
  const view = useHashView();
  useLawyerDeadlineSweep();

  if (!mounted) return null;
  if (!work.me) {
    return (
      <div className={`${styles.shell} ${ui.readable}`}>
        <p className={styles.eyebrow}>{tx("প্যানেল আইনজীবী", "Panel lawyer")}</p>
        <h1 className={styles.title}>{tx("আইনজীবী লগইন প্রয়োজন", "Lawyer login required")}</h1>
        <p className={styles.lead}>{tx("নিয়োগপ্রাপ্ত মামলা, শুনানি ও প্রতিবেদনের জন্য মোবাইল নম্বর দিয়ে লগইন বা সাইন আপ করুন।", "Log in or sign up with your mobile number to see assigned cases, hearings and reports.")}</p>
        <Button onClick={() => router.push("/lawyer")}>{tx("লগইন / সাইন আপ →", "Log in / sign up →")}</Button>
      </div>
    );
  }
  const d = DISTRICTS.find((x) => x.code === work.me!.district);
  return (
    <div className={`${styles.shell} ${ui.readable}`}>
      <p className={styles.eyebrow}>
        {tx("প্যানেল আইনজীবী", "Panel lawyer")} · {d ? tx(`${d.label.bn} জেলা প্যানেল`, `${d.label.en} district panel`) : "—"} · {work.me.barEnrolmentNo}
      </p>
      {view.kind === "case" ? (
        <CaseView key={view.id} id={view.id} />
      ) : view.kind === "assigned" ? (
        <Assigned />
      ) : view.kind === "reports" ? (
        <Reports />
      ) : view.kind === "calendar" ? (
        <Calendar />
      ) : (
        <Overview />
      )}
    </div>
  );
}

/* ------------------------------ overview ------------------------------ */

function Overview() {
  const { lang, tx } = useTx();
  const w = useLawyerWork();
  const stats: [string, number, string, Tone][] = [
    ["assigned", w.offers.length, tx("উত্তরের অপেক্ষায়", "Offers to answer"), w.offers.length ? "warn" : "neutral"],
    ["reports", w.overdue.length, tx("প্রতিবেদন দেরি", "Updates overdue"), w.overdue.length ? "err" : "neutral"],
    ["reports", w.due.length, tx("প্রতিবেদন বাকি", "Updates due"), w.due.length ? "warn" : "neutral"],
    ["calendar", w.upcoming.length, tx("আসন্ন শুনানি", "Upcoming hearings"), "neutral"],
    ["assigned", w.accepted.length, tx("চলমান মামলা", "Active cases"), "neutral"],
  ];
  type Action = { key: string; tone: Tone; title: string; sub: string; href: string; at: string };
  const actions: Action[] = [
    ...w.overdue.map(({ c, h }) => ({ key: h.hearingId, tone: "err" as Tone, title: tx(`প্রতিবেদন দেরি: ${formatDateTime(h.at, lang)}-এর শুনানি`, `Overdue update: hearing of ${formatDateTime(h.at, lang)}`), sub: `${caseTitle(c.a, lang)} · ${h.court}`, href: `#case/${c.a.applicationId}`, at: h.updateDueAt })),
    ...w.offers.map((c) => ({ key: c.assignment.assignmentId, tone: "warn" as Tone, title: tx("নতুন নিয়োগ — গ্রহণ বা প্রত্যাখ্যান করুন", "New assignment — accept or decline"), sub: `${caseTitle(c.a, lang)} · ${tx("উত্তর দিন", "respond by")} ${formatDateTime(c.assignment.respondBy, lang)}`, href: `#case/${c.a.applicationId}`, at: c.assignment.respondBy })),
    ...w.due.map(({ c, h }) => ({ key: h.hearingId, tone: "warn" as Tone, title: tx(`প্রতিবেদন দিন: ${formatDateTime(h.at, lang)}-এর শুনানি`, `Report on the ${formatDateTime(h.at, lang)} hearing`), sub: `${caseTitle(c.a, lang)} · ${tx("শেষ সময়", "due")} ${formatDateTime(h.updateDueAt, lang)}`, href: `#case/${c.a.applicationId}`, at: h.updateDueAt })),
    ...w.upcoming.slice(0, 3).map(({ c, h }) => ({ key: h.hearingId, tone: "neutral" as Tone, title: tx(`শুনানি: ${formatDateTime(h.at, lang)}`, `Hearing: ${formatDateTime(h.at, lang)}`), sub: `${caseTitle(c.a, lang)} · ${h.court}`, href: `#case/${c.a.applicationId}`, at: h.at })),
  ];
  return (
    <>
      <h1 className={styles.title}>{tx("আজকের কাজ", "Today's work")}</h1>
      <div className={styles.stats}>
        {stats.map(([k, n, l, tone], i) => (
          <a key={i} href={`#${k}`} className={styles.stat} style={tone === "err" ? { borderColor: "var(--red)" } : tone === "warn" ? { borderColor: "var(--status-pending)" } : undefined}>
            <div className={styles.statNum} style={tone === "err" ? { color: "var(--red)" } : undefined}>
              {n}
            </div>
            <div className={styles.statLabel}>{l}</div>
          </a>
        ))}
      </div>
      {w.overdue.length ? (
        <Banner tone="err" icon="!">
          <strong>{tx(`${w.overdue.length}টি শুনানির প্রতিবেদন দেরি হয়েছে।`, `${w.overdue.length} hearing update(s) overdue.`)}</strong> {tx("জেলা লিগ্যাল এইড অফিসার স্বয়ংক্রিয়ভাবে জেনেছেন। এখনই প্রতিবেদন দিন।", "The District Legal Aid Officer was alerted automatically. Please report now.")}
        </Banner>
      ) : null}
      <section className={ui.main}>
        <h2 className={ui.stepTitle}>{tx("পরবর্তী কাজ", "Next actions")}</h2>
        {actions.length === 0 ? (
          <p className={ui.stepLead}>
            {w.accepted.length || w.offers.length
              ? tx("এখন কিছু করার নেই। নতুন শুনানি বা নিয়োগ এলে এখানে দেখাবে।", "Nothing to do right now. New hearings or assignments will appear here.")
              : tx("এখনো কোনো মামলা নিয়োগ হয়নি। জেলা লিগ্যাল এইড অফিস আপনাকে মামলা দিলে এখানে দেখাবে।", "No cases assigned yet. When the District Legal Aid Office assigns you a case it appears here.")}
          </p>
        ) : (
          <div className={ui.rows}>
            {actions.map((x) => (
              <a key={`${x.key}-${x.title}`} href={x.href} className={ui.row} style={{ textDecoration: "none", color: "inherit" }}>
                <div className={ui.rowLabel}>
                  <Tag tone={x.tone}>{x.tone === "err" ? tx("দেরি", "Overdue") : x.tone === "warn" ? tx("করণীয়", "To do") : tx("আসন্ন", "Upcoming")}</Tag>
                </div>
                <div className={ui.rowValue}>
                  <strong>{x.title}</strong>
                  <span className={ui.sub}>{x.sub}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* ------------------------------ assignments ------------------------------ */

function Assigned() {
  const { lang, tx } = useTx();
  const w = useLawyerWork();
  return (
    <>
      <h1 className={styles.title}>{tx("নিয়োগ ও মামলা", "Assignments & cases")}</h1>
      <section className={ui.main} style={{ marginBottom: "var(--s-6)" }}>
        <div className={ui.sectionHead}>
          {tx("নতুন নিয়োগ", "New offers")} ({w.offers.length})
        </div>
        {w.offers.length === 0 ? (
          <p className={styles.hint}>{tx("কোনো নতুন নিয়োগ নেই।", "No new offers.")}</p>
        ) : (
          w.offers.map((c) => <OfferCard key={c.assignment.assignmentId} a={c.a} s={c.assignment} />)
        )}
      </section>
      <section className={ui.main}>
        <div className={ui.sectionHead}>
          {tx("চলমান মামলা", "Active cases")} ({w.accepted.length})
        </div>
        {w.accepted.length === 0 ? (
          <p className={styles.hint}>{tx("কোনো চলমান মামলা নেই।", "No active cases.")}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{tx("মামলা", "Case")}</th>
                  <th>{tx("মক্কেল", "Client")}</th>
                  <th>{tx("সমস্যা", "Matter")}</th>
                  <th>{tx("পরবর্তী শুনানি", "Next hearing")}</th>
                  <th>{tx("প্রতিবেদন", "Updates")}</th>
                </tr>
              </thead>
              <tbody>
                {w.accepted.map(({ a }) => {
                  const hs = a.lawyer?.hearings ?? [];
                  const next = hs.filter((h) => hearingState(h, w.now) === "UPCOMING").sort((x, y) => x.at.localeCompare(y.at))[0];
                  const late = hs.filter((h) => hearingState(h, w.now) === "OVERDUE").length;
                  const due = hs.filter((h) => hearingState(h, w.now) === "UPDATE_DUE").length;
                  return (
                    <tr key={a.applicationId}>
                      <td>
                        <a className={styles.mono} href={`#case/${a.applicationId}`}>
                          {a.caseId}
                        </a>
                      </td>
                      <td>{a.data.applicant.fullName ?? "—"}</td>
                      <td>{label(MATTERS, a.data.matter.category, lang)}</td>
                      <td>{next ? `${formatDateTime(next.at, lang)} · ${next.court}` : <span className={styles.hint}>{tx("তারিখ নেই", "No date yet")}</span>}</td>
                      <td>
                        {late ? <Tag tone="err">{tx(`${late} দেরি`, `${late} overdue`)}</Tag> : null} {due ? <Tag tone="warn">{tx(`${due} বাকি`, `${due} due`)}</Tag> : null}
                        {!late && !due ? <Tag tone="ok">{tx("হালনাগাদ", "Up to date")}</Tag> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {w.past.length ? (
          <div className={ui.section}>
            <div className={ui.sectionHead}>{tx("পূর্বের নিয়োগ", "Past assignments")}</div>
            <div className={ui.rows}>
              {w.past.map(({ a, assignment: s }) => (
                <Row key={s.assignmentId} label={a.caseId ?? a.applicationId}>
                  <Tag tone={s.status === "DECLINED" ? "warn" : s.status === "COMPLETED" ? "ok" : "neutral"}>{pretty(s.status)}</Tag>
                  {s.status === "WITHDRAWN" ? <Tag tone="err">{tx("প্রবেশাধিকার বাতিল", "Access removed")}</Tag> : null}
                  {s.status !== "DECLINED" ? (
                    <span className={ui.sub}>
                      {tx(`উপস্থিত ${s.ledger.hearingsAttended} · মিস ${s.ledger.hearingsMissed}`, `Attended ${s.ledger.hearingsAttended} · missed ${s.ledger.hearingsMissed}`)}
                      {s.payment ? ` · ${tx("পেমেন্ট", "payment")}: ${pretty(s.payment.status)}` : ""}
                    </span>
                  ) : null}
                  {s.declineReason ? <span className={ui.sub}>“{s.declineReason}”</span> : null}
                </Row>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}

function OfferCard({ a, s }: { a: ApplicationRecord; s: LawyerAssignment }) {
  const { lang, tx } = useTx();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { now } = useLawyerWork();
  const overdue = new Date(s.respondBy).getTime() < now;
  const run = (fn: () => void) => {
    try {
      fn();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className={ui.doc} style={{ marginBottom: "var(--s-3)" }}>
      <div className={ui.docHead}>
        <Tag tone="ink">{a.caseId}</Tag>
        <Tag>{label(MATTERS, a.data.matter.category, lang)}</Tag>
        <Tag>{label(DISTRICTS, a.data.applicant.district, lang)}</Tag>
        {a.data.urgency.flags.map((f) => (
          <Tag key={f} tone="err">
            {label(URGENCY_FLAGS, f, lang)}
          </Tag>
        ))}
        <Tag tone={overdue ? "err" : "warn"}>
          {tx("উত্তর দিন", "Respond by")} {formatDateTime(s.respondBy, lang)}
        </Tag>
      </div>
      <div>
        {tx("প্রস্তাব করেছেন", "Offered by")} <strong>{s.offeredByName}</strong> · {formatDateTime(s.offeredAt, lang)}
      </div>
      {s.note ? <div className={ui.advice}>“{s.note}”</div> : null}
      <p className={styles.hint}>{tx("গ্রহণের পর মক্কেলের তথ্য ও নথি খুলবে।", "Client details and documents open after you accept.")}</p>
      {error ? (
        <Banner tone="err" icon="!">
          {error}
        </Banner>
      ) : null}
      {declining ? (
        <>
          <label className={styles.field}>
            <span className={styles.label}>{tx("প্রত্যাখ্যানের কারণ (কমপক্ষে ১০ অক্ষর)", "Reason for declining (at least 10 characters)")}</span>
            <textarea className={styles.textarea} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tx("যেমন: স্বার্থের সংঘাত / একই দিনে অন্য শুনানি", "e.g. conflict of interest / clashing hearing")} />
          </label>
          <div className={styles.actions} style={{ marginTop: "var(--s-2)" }}>
            <Button variant="destructive" disabled={reason.trim().length < 10} onClick={() => run(() => LawyerService.decline(a.applicationId, reason))}>
              {tx("প্রত্যাখ্যান করুন", "Decline")}
            </Button>
            <Button variant="secondary" onClick={() => setDeclining(false)}>
              {tx("বাতিল", "Cancel")}
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.actions} style={{ marginTop: "var(--s-2)" }}>
          <Button onClick={() => run(() => LawyerService.accept(a.applicationId))}>{tx("গ্রহণ করুন", "Accept assignment")}</Button>
          <Button variant="secondary" onClick={() => setDeclining(true)}>
            {tx("কারণসহ প্রত্যাখ্যান", "Decline with reason")}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ reports ------------------------------ */

function Reports() {
  const { lang, tx } = useTx();
  const w = useLawyerWork();
  const { updateDueHours: UPDATE_DUE_HOURS } = useLawyerRules();
  const list = [...w.overdue, ...w.due];
  return (
    <>
      <h1 className={styles.title}>{tx("শুনানির প্রতিবেদন", "Hearing reports")}</h1>
      <p className={styles.lead}>{tx(`প্রতিটি শুনানির ${UPDATE_DUE_HOURS} ঘণ্টার মধ্যে উপস্থিতি, ফলাফল ও পরবর্তী তারিখ জানান। দেরি হলে ডিএলএও স্বয়ংক্রিয়ভাবে জানবেন।`, `Report attendance, outcome and next date within ${UPDATE_DUE_HOURS} hours of each hearing. Late updates alert the DLAO automatically.`)}</p>
      {list.length === 0 ? (
        <Banner tone="ok" icon="✓">
          {tx("কোনো প্রতিবেদন বাকি নেই।", "No reports due.")}
        </Banner>
      ) : (
        list.map(({ c, h, state }) => (
          <section key={h.hearingId} className={ui.main} style={{ marginBottom: "var(--s-4)" }}>
            <div className={ui.docHead} style={{ marginBottom: "var(--s-3)" }}>
              <a className={styles.mono} href={`#case/${c.a.applicationId}`}>
                {c.a.caseId}
              </a>
              <HearingTag state={state} />
              <span>
                {formatDateTime(h.at, lang)} · {h.court}
              </span>
              <span>
                · {tx("শেষ সময়", "due")} {formatDateTime(h.updateDueAt, lang)}
              </span>
            </div>
            <UpdateForm a={c.a} hearing={h} />
          </section>
        ))
      )}
      {w.reported.length ? (
        <section className={ui.main}>
          <div className={ui.sectionHead}>{tx("জমা দেওয়া প্রতিবেদন", "Submitted reports")}</div>
          <div className={ui.rows}>
            {w.reported
              .map(({ c, h }) => ({ c, h, u: c.a.lawyer?.updates.find((x) => x.updateId === h.updateId) }))
              .sort((x, y) => (y.u?.at ?? "").localeCompare(x.u?.at ?? ""))
              .map(({ c, h, u }) => (
                <Row key={h.hearingId} label={formatDateTime(h.at, lang)}>
                  <a className={styles.mono} href={`#case/${c.a.applicationId}`}>
                    {c.a.caseId}
                  </a>
                  {u ? <UpdateSummary u={u} /> : null}
                </Row>
              ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function UpdateSummary({ u }: { u: HearingUpdate }) {
  const { lang, tx } = useTx();
  return (
    <>
      <Tag tone={u.attendance === "ATTENDED" ? "ok" : u.attendance === "NOT_ATTENDED" ? "err" : "neutral"}>{pretty(u.attendance)}</Tag>
      <Tag>{pretty(u.outcome)}</Tag>
      {u.late ? <Tag tone="err">{tx("দেরিতে", "Late")}</Tag> : <Tag tone="ok">{tx("সময়মতো", "On time")}</Tag>}
      <Tag title={tx("আইনজীবীর নিজস্ব প্রতিবেদন", "Self-reported by the lawyer")}>{tx("আইনজীবীর প্রতিবেদন", "Lawyer reported")}</Tag>
      <span className={ui.sub}>
        {u.note}
        {u.nextDate ? ` · ${tx("পরবর্তী তারিখ", "next date")} ${formatDateTime(u.nextDate, lang)}` : ""} · {formatDateTime(u.at, lang)}
      </span>
    </>
  );
}

function UpdateForm({ a, hearing }: { a: ApplicationRecord; hearing: Hearing }) {
  const { tx } = useTx();
  const [attendance, setAttendance] = useState<HearingUpdate["attendance"]>("ATTENDED");
  const [outcome, setOutcome] = useState<HearingUpdate["outcome"]>("ADJOURNED");
  const [nextDate, setNextDate] = useState("");
  const [nextCourt, setNextCourt] = useState(hearing.court);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const submit = () => {
    try {
      LawyerService.submitUpdate(a.applicationId, { hearingId: hearing.hearingId, attendance, outcome, nextDate, nextCourt, note, notifyClient: notify });
      setError(null);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  if (saved) {
    return (
      <Banner tone="ok" icon="✓">
        {tx("প্রতিবেদন জমা হয়েছে।", "Report submitted.")}
      </Banner>
    );
  }
  return (
    <>
      {error ? (
        <Banner tone="err" icon="!">
          {error}
        </Banner>
      ) : null}
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>{tx("উপস্থিতি", "Attendance")}</span>
          <select className={styles.select} value={attendance} onChange={(e) => setAttendance(e.target.value as typeof attendance)}>
            <option value="ATTENDED">{tx("উপস্থিত ছিলাম", "I attended")}</option>
            <option value="NOT_ATTENDED">{tx("উপস্থিত ছিলাম না", "I did not attend")}</option>
            <option value="NOT_HELD">{tx("শুনানি হয়নি", "Hearing not held")}</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{tx("ফলাফল", "Outcome")}</span>
          <select className={styles.select} value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
            <option value="ADJOURNED">{tx("মুলতবি", "Adjourned")}</option>
            <option value="HEARD">{tx("শুনানি হয়েছে", "Heard")}</option>
            <option value="ORDER_PASSED">{tx("আদেশ হয়েছে", "Order passed")}</option>
            <option value="JUDGMENT">{tx("রায় হয়েছে", "Judgment")}</option>
            <option value="SETTLED">{tx("আপস হয়েছে", "Settled")}</option>
            <option value="OTHER">{tx("অন্যান্য", "Other")}</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{tx("পরবর্তী তারিখ (থাকলে)", "Next date (if any)")}</span>
          <input className={styles.input} type="datetime-local" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{tx("পরবর্তী শুনানির আদালত", "Court for the next hearing")}</span>
          <input className={styles.input} value={nextCourt} onChange={(e) => setNextCourt(e.target.value)} />
        </label>
        <label className={`${styles.field} ${styles.full}`}>
          <span className={styles.label}>{tx("কী হয়েছে (সংক্ষেপে)", "What happened (briefly)")}</span>
          <textarea className={styles.textarea} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      {nextDate ? (
        <label className={styles.check}>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          {tx("মক্কেলকে পরবর্তী তারিখ জানান (নিরাপদ যোগাযোগের নিয়ম মেনে)", "Tell the client the next date (safe-contact rules apply)")}
        </label>
      ) : null}
      <div className={ui.bar}>
        <Button disabled={note.trim().length < 5} onClick={submit}>
          {tx("প্রতিবেদন জমা দিন", "Submit report")}
        </Button>
        <span className={styles.hint}>{tx("আপনার নিজস্ব প্রতিবেদন হিসেবে রেকর্ড হবে", "Recorded as self-reported by you")}</span>
      </div>
    </>
  );
}

/* ------------------------------ calendar ------------------------------ */

function Calendar() {
  const { lang, tx } = useTx();
  const w = useLawyerWork();
  const all = [...w.upcoming, ...w.due, ...w.overdue, ...w.reported].sort((x, y) => x.h.at.localeCompare(y.h.at));
  const upcoming = all.filter((x) => x.state === "UPCOMING");
  const past = all.filter((x) => x.state !== "UPCOMING").reverse();
  const list = (items: typeof all) => (
    <div className={ui.rows}>
      {items.map(({ c, h, state }) => (
        <a key={h.hearingId} href={`#case/${c.a.applicationId}`} className={ui.row} style={{ textDecoration: "none", color: "inherit" }}>
          <div className={ui.rowLabel}>
            <strong style={{ color: "var(--ink)" }}>{formatDateTime(h.at, lang)}</strong>
          </div>
          <div className={ui.rowValue}>
            <span className={styles.mono}>{c.a.caseId}</span> <HearingTag state={state} />
            <span className={ui.sub}>
              {h.court}
              {h.purpose ? ` · ${h.purpose}` : ""} · {c.a.data.applicant.fullName ?? "—"}
            </span>
          </div>
        </a>
      ))}
    </div>
  );
  return (
    <>
      <h1 className={styles.title}>{tx("শুনানির সময়সূচি", "Hearing schedule")}</h1>
      <section className={ui.main} style={{ marginBottom: "var(--s-6)" }}>
        <div className={ui.sectionHead}>
          {tx("আসন্ন", "Upcoming")} ({upcoming.length})
        </div>
        {upcoming.length ? list(upcoming) : <p className={styles.hint}>{tx("কোনো আসন্ন শুনানি নেই — মামলার পাতায় শুনানি যোগ করুন।", "No upcoming hearings — add one from the case page.")}</p>}
      </section>
      {past.length ? (
        <section className={ui.main}>
          <div className={ui.sectionHead}>
            {tx("আগের শুনানি", "Past hearings")} ({past.length})
          </div>
          {list(past)}
        </section>
      ) : null}
    </>
  );
}

/* ------------------------------ one case ------------------------------ */

function CaseView({ id }: { id: string }) {
  const { lang, tx } = useTx();
  const db = useDlasDb();
  const w = useLawyerWork();
  const a = db.applications.find((x) => x.applicationId === id);
  const s = a ? activeAssignment(a) : null;
  // Offered → summary only; accepted → full record while the access grant is active.
  const mine = !!(a && s && w.me && s.lawyerId === w.me.lawyerId && (s.status === "OFFERED" || hasCaseAccess(a, w.me.lawyerId)));

  if (!a || !mine) {
    return (
      <>
        <a className={styles.crumb} href="#assigned">
          ← {tx("মামলা", "Cases")}
        </a>
        <Banner tone="err" icon="!">
          {tx("এই মামলাটি আপনাকে নিয়োগ দেওয়া নেই।", "This case is not assigned to you.")}
        </Banner>
      </>
    );
  }
  const offered = s!.status === "OFFERED";
  const hearings = [...(a.lawyer?.hearings ?? [])].sort((x, y) => x.at.localeCompare(y.at));
  const states = hearings.map((h) => ({ h, state: hearingState(h, w.now), mine: h.assignmentId === s!.assignmentId }));
  const overdue = states.filter((x) => x.mine && x.state === "OVERDUE");
  const toReport = states.filter((x) => x.mine && (x.state === "OVERDUE" || x.state === "UPDATE_DUE"));
  const nameOf = (assignmentId: string | null) => a.lawyer?.assignments.find((x) => x.assignmentId === assignmentId)?.lawyerName ?? "—";
  const previous = s!.handoverFrom ? a.lawyer?.assignments.find((x) => x.assignmentId === s!.handoverFrom) : null;

  return (
    <>
      <a className={styles.crumb} href="#assigned">
        ← {tx("মামলা", "Cases")}
      </a>
      <header>
        <div className={ui.head}>
          <span className={ui.headId}>{a.caseId}</span>
          <Tag tone={offered ? "warn" : "ok"}>{offered ? tx("উত্তরের অপেক্ষায়", "Offer — respond") : tx("✓ গৃহীত", "✓ Accepted")}</Tag>
          <Tag>{label(MATTERS, a.data.matter.category, lang)}</Tag>
          {a.data.urgency.flags.map((f) => (
            <Tag key={f} tone="err">
              {label(URGENCY_FLAGS, f, lang)}
            </Tag>
          ))}
        </div>
        <div className={ui.meta}>
          <span>
            <strong>{offered ? tx("মক্কেল (গ্রহণের পর দেখা যাবে)", "Client (visible after acceptance)") : a.data.applicant.fullName ?? "—"}</strong>
          </span>
          <span>{label(DISTRICTS, a.data.applicant.district, lang)}</span>
          <span>{a.routing.office}</span>
          <span>
            {tx("নিয়োগ", "Assigned by")} {s!.offeredByName} · {formatDateTime(s!.offeredAt, lang)}
          </span>
        </div>
      </header>

      {offered ? (
        <OfferCard a={a} s={s!} />
      ) : (
        <>
          {previous ? (
            <Banner tone="warn" icon="↻">
              <strong>{tx("হস্তান্তরিত মামলা", "Handed-over case")}</strong> — {tx(`আগে ${previous.lawyerName} ছিলেন। আগের সব শুনানি, প্রতিবেদন ও নথি নিচে আছে; তাঁর প্রবেশাধিকার বাতিল হয়েছে।`, `Previously with ${previous.lawyerName}. All earlier hearings, reports and documents are below; their access has been removed.`)}
              {previous.declineReason ? <span className={ui.sub}> {tx("কারণ", "Reason")}: {previous.declineReason}</span> : null}
            </Banner>
          ) : null}
          {overdue.length ? (
            <Banner tone="err" icon="!">
              <strong>{tx(`${overdue.length}টি প্রতিবেদন দেরি।`, `${overdue.length} update(s) overdue.`)}</strong> {tx("ডিএলএও জানেন — নিচে প্রতিবেদন দিন।", "The DLAO has been alerted — report below.")}
            </Banner>
          ) : toReport.length ? (
            <Banner tone="warn" icon="!">
              {tx("একটি শুনানির প্রতিবেদন বাকি আছে।", "A hearing report is due.")}
            </Banner>
          ) : (
            <Banner tone="ok" icon="✓">
              {tx("সব প্রতিবেদন হালনাগাদ।", "All updates are up to date.")}
            </Banner>
          )}

          <div className={ui.layout}>
            <section className={ui.main}>
              <div className={ui.sectionHead}>{tx("মামলার সারসংক্ষেপ", "Case summary")}</div>
              <div className={ui.rows}>
                <Row label={tx("ঘটনা", "What happened")}>{a.data.matter.summary ?? "—"}</Row>
                <Row label={tx("অপর পক্ষ", "Other party")}>{a.data.matter.opposingParty ?? "—"}</Row>
                <Row label={tx("অফিসের নির্দেশনা", "Officer's note")}>{s!.note ?? "—"}</Row>
                <Row label={tx("কেন আইনজীবী", "Why a lawyer")}>{a.review?.pathway?.reason ?? "—"}</Row>
                <Row label={tx("আমার উপস্থিতি", "My attendance")}>
                  <Tag tone="ok">{tx(`উপস্থিত ${s!.ledger.hearingsAttended}`, `Attended ${s!.ledger.hearingsAttended}`)}</Tag>
                  <Tag tone={s!.ledger.hearingsMissed ? "err" : "neutral"}>{tx(`মিস ${s!.ledger.hearingsMissed}`, `Missed ${s!.ledger.hearingsMissed}`)}</Tag>
                  <span className={ui.sub}>{tx("উপস্থিত শুনানির হিসাবে মামলা শেষে পেমেন্ট হবে। প্রতিবেদন না দিলে শুনানি মিস হিসেবে গণ্য হয়।", "Payment after the case ends is based on attended hearings. A hearing with no report by the deadline counts as missed.")}</span>
                </Row>
              </div>

              <div className={ui.section}>
                <div className={ui.sectionHead}>{tx("মক্কেলের সাথে নিরাপদ যোগাযোগ", "Contacting the client safely")}</div>
                <div className={ui.rows}>
                  <Row label={tx("নাম", "Name")}>{a.data.applicant.fullName ?? "—"}</Row>
                  <Row label={tx("মাধ্যম", "Channel")}>
                    {a.data.safeContact.method ?? "—"} · {a.data.safeContact.phone ?? "—"}
                  </Row>
                  <Row label={tx("নিরাপদ সময়", "Safe time")}>{safeTimeLabel(a.data.safeContact, lang)}</Row>
                  <Row label={tx("নিয়ম", "Rules")}>
                    {a.data.safeContact.neutralWordingRequired ? <Tag tone="warn">{tx("নিরপেক্ষ ভাষা", "Neutral wording")}</Tag> : null}
                    {a.data.safeContact.smsAllowed ? <Tag tone="ok">{tx("এসএমএস চলবে", "SMS allowed")}</Tag> : <Tag tone="err">{tx("এসএমএস নয়", "No SMS")}</Tag>}
                    {a.data.safeContact.voicemailAllowed ? null : <Tag tone="err">{tx("ভয়েসমেইল নয়", "No voicemail")}</Tag>}
                    {a.data.safeContact.notes ? <span className={ui.sub}>{a.data.safeContact.notes}</span> : null}
                  </Row>
                </div>
              </div>

              <div className={ui.section}>
                <div className={ui.sectionHead}>
                  {tx("নথি", "Documents")} ({a.data.documents.length})
                </div>
                <div className={ui.rows}>
                  {a.data.documents.map((d) => (
                    <Row key={d.docId} label={label(DOC_TYPES, d.type, lang)}>
                      <Tag tone={d.status === "ATTACHED" ? "ok" : "warn"}>{pretty(d.status)}</Tag>
                      {d.sensitive ? <Tag tone="err">{tx("সংবেদনশীল", "Sensitive")}</Tag> : null}
                      {d.status === "ATTACHED" ? <DocViewButton app={a} doc={d} /> : null}
                    </Row>
                  ))}
                </div>
              </div>

              <div className={ui.section}>
                <div className={ui.sectionHead}>{tx("শুনানি", "Hearings")}</div>
                {states.length === 0 ? <p className={styles.hint}>{tx("এখনো কোনো শুনানির তারিখ নেই।", "No hearing dates yet.")}</p> : null}
                <div className={ui.rows}>
                  {states.map(({ h, state, mine: own }) => {
                    const u = a.lawyer?.updates.find((x) => x.updateId === h.updateId);
                    return (
                      <Row key={h.hearingId} label={formatDateTime(h.at, lang)}>
                        {own ? <HearingTag state={state} /> : <Tag>{tx(`আগের আইনজীবী: ${nameOf(h.assignmentId)}`, `Previous lawyer: ${nameOf(h.assignmentId)}`)}</Tag>}
                        {!own && hearingMissed(h, w.now) ? <Tag tone="err">{tx("মিস", "Missed")}</Tag> : null}
                        <span>
                          {h.court}
                          {h.purpose ? ` · ${h.purpose}` : ""}
                        </span>
                        {h.clientNotifiedAt ? <Tag tone="ok">{tx("মক্কেলকে জানানো", "Client told")}</Tag> : null}
                        {u ? (
                          <div style={{ flexBasis: "100%", display: "flex", flexWrap: "wrap", gap: 6 }}>
                            <UpdateSummary u={u} />
                          </div>
                        ) : own && state !== "UPCOMING" ? (
                          <span className={ui.sub}>
                            {tx("প্রতিবেদনের শেষ সময়", "Report due")} {formatDateTime(h.updateDueAt, lang)}
                          </span>
                        ) : null}
                      </Row>
                    );
                  })}
                </div>
                <AddHearing a={a} />
              </div>

              {toReport.length ? (
                <div className={ui.section}>
                  <div className={ui.sectionHead}>{tx("শুনানির প্রতিবেদন দিন", "Report on a hearing")}</div>
                  {toReport.map(({ h, state }) => (
                    <div key={h.hearingId} style={{ marginBottom: "var(--s-6)" }}>
                      <div className={ui.docHead} style={{ marginBottom: "var(--s-2)" }}>
                        <HearingTag state={state} /> {formatDateTime(h.at, lang)} · {h.court}
                      </div>
                      <UpdateForm a={a} hearing={h} />
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
            <CaseSide a={a} />
          </div>
        </>
      )}
    </>
  );
}

function AddHearing({ a }: { a: ApplicationRecord }) {
  const { tx } = useTx();
  const { updateDueHours: UPDATE_DUE_HOURS } = useLawyerRules();
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState("");
  const [court, setCourt] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <div className={ui.bar}>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          + {tx("শুনানির তারিখ যোগ করুন", "Add a hearing date")}
        </Button>
      </div>
    );
  }
  return (
    <div className={ui.contactBox} style={{ marginTop: "var(--s-4)" }}>
      {error ? (
        <Banner tone="err" icon="!">
          {error}
        </Banner>
      ) : null}
      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>{tx("তারিখ ও সময়", "Date & time")}</span>
          <input className={styles.input} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{tx("আদালত", "Court")}</span>
          <input className={styles.input} value={court} onChange={(e) => setCourt(e.target.value)} placeholder={tx("যেমন: শ্রম আদালত, বরিশাল", "e.g. Labour Court, Barishal")} />
        </label>
        <label className={`${styles.field} ${styles.full}`}>
          <span className={styles.label}>{tx("উদ্দেশ্য (ঐচ্ছিক)", "Purpose (optional)")}</span>
          <input className={styles.input} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </label>
      </div>
      <label className={styles.check}>
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        {tx("মক্কেলকে তারিখ জানান (নিরাপদ যোগাযোগের নিয়ম মেনে)", "Tell the client the date (safe-contact rules apply)")}
      </label>
      <p className={styles.hint}>{tx(`শুনানির পর ${UPDATE_DUE_HOURS} ঘণ্টার মধ্যে প্রতিবেদন দিতে হবে। আগের শুনানিও রেকর্ড করা যায়।`, `A report is due within ${UPDATE_DUE_HOURS} hours after the hearing. Past hearings can be recorded too.`)}</p>
      <div className={styles.actions} style={{ marginTop: 0 }}>
        <Button
          disabled={!at || court.trim().length < 2}
          onClick={() => {
            try {
              LawyerService.addHearing(a.applicationId, { at, court, purpose, notifyClient: notify });
              setError(null);
              setOpen(false);
              setAt("");
              setPurpose("");
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          {tx("শুনানি যোগ করুন", "Add hearing")}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          {tx("বাতিল", "Cancel")}
        </Button>
      </div>
    </div>
  );
}

function CaseSide({ a }: { a: ApplicationRecord }) {
  const { lang, tx } = useTx();
  const db = useDlasDb();
  const w = useLawyerWork();
  const { offerResponseHours: OFFER_RESPONSE_HOURS, updateDueHours: UPDATE_DUE_HOURS, missedHearingsBeforeReassign } = useLawyerRules();
  const tasks = db.tasks.filter((t) => t.applicationId === a.applicationId && t.assigneeId === w.me?.lawyerId && t.status !== "DONE");
  const audit = useMemo(() => [...a.audit].reverse().filter((e) => e.role === "panel_lawyer" || e.action.startsWith("lawyer.") || e.action.startsWith("hearing.")), [a.audit]);
  return (
    <aside className={ui.aside}>
      <div className={ui.panel}>
        <div className={ui.panelTitle}>
          <span>{tx("আমার কাজ", "My tasks")}</span>
          <Tag tone={tasks.length ? "warn" : "ok"}>{tasks.length}</Tag>
        </div>
        {tasks.length === 0 ? <p className={styles.hint}>{tx("কিছু বাকি নেই", "Nothing open")}</p> : null}
        {tasks.map((t) => (
          <div key={t.taskId} className={ui.taskItem}>
            <div className={ui.taskTop}>
              <Tag tone={new Date(t.dueAt).getTime() < w.now ? "err" : "warn"}>{pretty(t.type)}</Tag>
            </div>
            <div>{t.reason}</div>
            <div className={styles.hint}>
              {tx("শেষ সময়", "due")} {formatDateTime(t.dueAt, lang)}
            </div>
          </div>
        ))}
      </div>
      <details className={ui.panel}>
        <summary className={ui.panelTitle} style={{ marginBottom: 0 }}>
          <span>
            {tx("এই মামলায় আমার কার্যক্রম", "My activity on this case")} ({audit.length})
          </span>
          <span aria-hidden>▾</span>
        </summary>
        <ul className={ui.auditList} style={{ marginTop: "var(--s-3)" }}>
          {audit.map((e) => (
            <li key={e.seq}>
              <span className={ui.auditAction}>{e.action}</span>
              <span className={ui.auditTime}>{formatDateTime(e.at, lang)}</span>
            </li>
          ))}
        </ul>
        <Link className={ui.link} href={`/debug?id=${a.applicationId}`}>
          {tx("পূর্ণ JSON →", "Full JSON →")}
        </Link>
      </details>
      <p className={styles.hint}>
        {tx(
          `নিয়োগের উত্তর ${OFFER_RESPONSE_HOURS} ঘণ্টার মধ্যে, প্রতিবেদন শুনানির ${UPDATE_DUE_HOURS} ঘণ্টার মধ্যে। ${missedHearingsBeforeReassign}টি শুনানি মিস করলে অফিস অন্য আইনজীবী দিতে পারে।`,
          `Offers: answer within ${OFFER_RESPONSE_HOURS} h. Reports: within ${UPDATE_DUE_HOURS} h of a hearing. After ${missedHearingsBeforeReassign} missed hearings the office may assign another lawyer.`,
        )}
      </p>
    </aside>
  );
}
