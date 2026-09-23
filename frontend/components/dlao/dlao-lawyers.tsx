"use client";

/* ------------------------------------------------------------------ *
 *  /dashboard/dlo#lawyers · #lawyer/<LAW-ID>
 *  The DLAO monitors every panel lawyer in the district: today's
 *  attendance, 30-day attendance, workload, win/loss, missed hearings,
 *  overdue reports, each case's latest update — and can log a call,
 *  summon the lawyer to the office or send a reminder.
 *  Everything comes from localStorage["dlas.db.v1"] (lib/dlas/lawyer-monitor.ts).
 * ------------------------------------------------------------------ */

import { useState, type ReactNode } from "react";
import { Button } from "@/components/button";
import { useI18n } from "@/lib/i18n";
import {
  DISTRICTS,
  DlaoLawyerMonitor,
  MATTERS,
  dayKey,
  formatDateTime,
  label,
  useDistrictLawyers,
  useLawyerRules,
  type LawyerContact,
  type MonitoredLawyer,
} from "@/lib/dlas";
import styles from "@/components/dlas/dlas.module.css";
import ui from "./dlao.module.css";

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

function TodayTag({ s }: { s: MonitoredLawyer["todayStatus"] }) {
  const { tx } = useTx();
  return s === "PRESENT" ? <Tag tone="ok">✓ {tx("আজ উপস্থিত", "Present today")}</Tag> : s === "ABSENT" ? <Tag tone="err">✗ {tx("আজ অনুপস্থিত", "Absent today")}</Tag> : <Tag tone="warn">{tx("আজ দেননি", "Not marked today")}</Tag>;
}

function AttendanceStrip({ m, days = 14, now }: { m: MonitoredLawyer; days?: number; now: number }) {
  const byDate = new Map((m.l.attendance ?? []).map((d) => [d.date, d.status]));
  const keys = Array.from({ length: days }, (_, i) => dayKey(now - (days - 1 - i) * 86_400_000));
  return (
    <span style={{ display: "inline-flex", gap: 3, flexWrap: "wrap" }}>
      {keys.map((d) => {
        const st = byDate.get(d);
        return <span key={d} title={`${d}: ${st ?? "—"}`} style={{ width: 12, height: 12, borderRadius: 3, background: st === "PRESENT" ? "var(--green)" : st === "ABSENT" ? "var(--red)" : "var(--line)" }} />;
      })}
    </span>
  );
}

/* ================================================================== */

export function LawyersMonitor() {
  const { lang, tx } = useTx();
  const { officer, list, feed, now } = useDistrictLawyers();
  const d = DISTRICTS.find((x) => x.code === officer?.district);
  const present = list.filter((m) => m.todayStatus === "PRESENT").length;
  const absent = list.filter((m) => m.todayStatus === "ABSENT").length;
  const unmarked = list.length - present - absent;
  const overdue = list.reduce((n, m) => n + m.overdueReports, 0);
  const summons = list.reduce((n, m) => n + m.openSummons, 0);
  return (
    <>
      <h1 className={styles.title}>{tx("প্যানেল আইনজীবী", "Panel lawyers")}</h1>
      <p className={styles.lead}>
        {officer?.officeType === "SCLAC" ? tx("সব জেলার আইনজীবী", "Lawyers in all districts") : tx(`${d?.label.bn ?? ""} জেলা প্যানেল — উপস্থিতি, মামলার হালনাগাদ ও যোগাযোগ`, `${d?.label.en ?? ""} district panel — attendance, case updates and contact`)}
      </p>
      <div className={styles.stats}>
        {(
          [
            [list.length, tx("আইনজীবী", "Lawyers"), "neutral"],
            [present, tx("আজ উপস্থিত", "Present today"), "ok"],
            [absent, tx("আজ অনুপস্থিত", "Absent today"), absent ? "err" : "neutral"],
            [unmarked, tx("আজ দেননি", "Not marked"), unmarked ? "warn" : "neutral"],
            [overdue, tx("প্রতিবেদন দেরি", "Overdue reports"), overdue ? "err" : "neutral"],
            [summons, tx("খোলা তলব", "Open summons"), summons ? "warn" : "neutral"],
          ] as [number, string, Tone][]
        ).map(([n, l, tone]) => (
          <div key={l} className={styles.stat} style={tone === "err" ? { borderColor: "var(--red)" } : tone === "warn" ? { borderColor: "var(--status-pending)" } : undefined}>
            <div className={styles.statNum} style={tone === "err" ? { color: "var(--red)" } : tone === "ok" ? { color: "var(--green)" } : undefined}>
              {n}
            </div>
            <div className={styles.statLabel}>{l}</div>
          </div>
        ))}
      </div>

      {list.length === 0 ? (
        <Banner tone="warn" icon="i">
          {tx("এই জেলার প্যানেলে এখনো কোনো আইনজীবী নিবন্ধিত নেই (/lawyer থেকে সাইন আপ)।", "No lawyers registered on this district's panel yet (they sign up at /lawyer).")}
        </Banner>
      ) : (
        <section className={ui.main} style={{ marginBottom: "var(--s-6)" }}>
          <div className={styles.tableWrap} style={{ maxHeight: "none" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{tx("আইনজীবী", "Lawyer")}</th>
                  <th>{tx("আজ", "Today")}</th>
                  <th>{tx("১৪ দিন", "Last 14 days")}</th>
                  <th>{tx("উপস্থিতি", "Attendance")}</th>
                  <th>{tx("চলমান", "Active")}</th>
                  <th>{tx("জয়/হার", "Won/Lost")}</th>
                  <th>{tx("মিস (৯০ দিন)", "Missed (90 d)")}</th>
                  <th>{tx("প্রতিবেদন দেরি", "Overdue reports")}</th>
                  <th>{tx("শেষ প্রতিবেদন", "Last report")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.l.lawyerId}>
                    <td>
                      <a href={`#lawyer/${m.l.lawyerId}`}>
                        <strong>{m.l.name}</strong>
                      </a>
                      <div className={styles.hint}>
                        {m.l.barEnrolmentNo} · {m.l.practiceAreas.map((c) => label(MATTERS, c, lang)).join(", ") || "—"}
                      </div>
                      {m.openSummons ? <Tag tone="warn">{tx("তলব খোলা", "Summoned")}</Tag> : null}
                      {m.pendingOffers ? <Tag>{tx(`${m.pendingOffers} প্রস্তাব`, `${m.pendingOffers} offer(s)`)}</Tag> : null}
                    </td>
                    <td>
                      <TodayTag s={m.todayStatus} />
                    </td>
                    <td>
                      <AttendanceStrip m={m} now={now} />
                    </td>
                    <td>{m.stats.attendancePct == null ? "—" : `${m.stats.attendancePct}%`}</td>
                    <td>
                      {m.cases.filter((c) => c.s.status === "ACCEPTED").length}/{m.stats.capacity}
                    </td>
                    <td>{m.stats.won + m.stats.lost ? `${m.stats.won}/${m.stats.lost} (${m.stats.winPct}%)` : "—"}</td>
                    <td style={m.missed90 ? { color: "var(--red)", fontWeight: 600 } : undefined}>{m.missed90}</td>
                    <td>{m.overdueReports ? <Tag tone="err">{m.overdueReports}</Tag> : <Tag tone="ok">0</Tag>}</td>
                    <td>{m.lastReportAt ? formatDateTime(m.lastReportAt, lang) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={ui.main}>
        <div className={ui.sectionHead}>{tx("সাম্প্রতিক মামলার হালনাগাদ", "Latest case updates from lawyers")}</div>
        {feed.length === 0 ? <p className={styles.hint}>{tx("এখনো কোনো শুনানির প্রতিবেদন নেই।", "No hearing reports yet.")}</p> : null}
        <div className={ui.rows}>
          {feed.map(({ a, u, h }) => (
            <Row key={u.updateId} label={formatDateTime(u.at, lang)}>
              <a className={styles.mono} href={`#app/${a.applicationId}`}>
                {a.caseId}
              </a>
              <strong>{u.byName}</strong>
              <Tag tone={u.attendance === "ATTENDED" ? "ok" : u.attendance === "NOT_ATTENDED" ? "err" : "neutral"}>{pretty(u.attendance)}</Tag>
              <Tag>{pretty(u.outcome)}</Tag>
              {u.late ? <Tag tone="err">{tx("দেরিতে", "Late")}</Tag> : null}
              <span className={ui.sub}>
                {h ? `${tx("শুনানি", "Hearing")} ${formatDateTime(h.at, lang)} · ${h.court} · ` : ""}“{u.note}”{u.nextDate ? ` · ${tx("পরবর্তী", "next")} ${formatDateTime(u.nextDate, lang)}` : ""}
              </span>
            </Row>
          ))}
        </div>
      </section>
    </>
  );
}

/* ================================================================== */

export function LawyerDetail({ id }: { id: string }) {
  const { lang, tx } = useTx();
  const { list, now } = useDistrictLawyers();
  const rules = useLawyerRules();
  const m = list.find((x) => x.l.lawyerId === id);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const run = (fn: () => void, ok: string) => {
    try {
      fn();
      setMsg({ tone: "ok", text: ok });
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : String(e) });
    }
  };
  if (!m) {
    return (
      <>
        <a className={styles.crumb} href="#lawyers">
          ← {tx("আইনজীবী", "Lawyers")}
        </a>
        <Banner tone="err" icon="!">
          {tx("এই আইনজীবী আপনার জেলার প্যানেলে নেই।", "This lawyer is not on your district's panel.")}
        </Banner>
      </>
    );
  }
  const contacts = [...(m.l.contacts ?? [])].sort((x, y) => y.at.localeCompare(x.at));
  const caseOptions = [...m.cases, ...m.pastCases].map((r) => r.a);
  return (
    <>
      <a className={styles.crumb} href="#lawyers">
        ← {tx("আইনজীবী", "Lawyers")}
      </a>
      <header>
        <div className={ui.head}>
          <span className={ui.headId} style={{ fontFamily: "inherit" }}>
            {m.l.name}
          </span>
          <TodayTag s={m.todayStatus} />
          {m.overdueReports ? <Tag tone="err">{tx(`${m.overdueReports} প্রতিবেদন দেরি`, `${m.overdueReports} overdue report(s)`)}</Tag> : null}
          {m.missed90 >= rules.missedHearingsBeforeReassign ? <Tag tone="err">{tx(`${m.missed90} শুনানি মিস`, `${m.missed90} missed hearings`)}</Tag> : null}
        </div>
        <div className={ui.meta}>
          <span>
            <strong>{m.l.phone}</strong>
          </span>
          <span>{m.l.barEnrolmentNo}</span>
          <span>{label(DISTRICTS, m.l.district, lang)}</span>
          <span>{m.l.practiceAreas.map((c) => label(MATTERS, c, lang)).join(", ") || "—"}</span>
          <span>
            {tx("শেষ লগইন", "Last login")} {m.l.lastLoginAt ? formatDateTime(m.l.lastLoginAt, lang) : "—"}
          </span>
        </div>
      </header>

      {msg ? (
        <Banner tone={msg.tone} icon={msg.tone === "ok" ? "✓" : "!"}>
          {msg.text}
        </Banner>
      ) : null}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statNum}>{m.stats.attendancePct == null ? "—" : `${m.stats.attendancePct}%`}</div>
          <div className={styles.statLabel}>
            {tx(`উপস্থিতি (${rules.attendanceWindowDays} দিন)`, `Attendance (${rules.attendanceWindowDays} d)`)} · {m.stats.presentDays}/{m.stats.presentDays + m.stats.absentDays}
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>
            {m.cases.filter((c) => c.s.status === "ACCEPTED").length}/{m.stats.capacity}
          </div>
          <div className={styles.statLabel}>{tx("চলমান মামলা", "Active cases")}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>{m.stats.winPct == null ? "—" : `${m.stats.winPct}%`}</div>
          <div className={styles.statLabel}>
            {tx("জয়ের হার", "Win rate")} · {m.stats.won}W {m.stats.lost}L
          </div>
        </div>
        <div className={styles.stat} style={m.missed90 ? { borderColor: "var(--red)" } : undefined}>
          <div className={styles.statNum} style={m.missed90 ? { color: "var(--red)" } : undefined}>
            {m.missed90}
          </div>
          <div className={styles.statLabel}>{tx("শুনানি মিস (৯০ দিন)", "Missed hearings (90 d)")}</div>
        </div>
      </div>

      <div className={ui.layout}>
        <section className={ui.main}>
          <div className={ui.sectionHead}>{tx("দৈনিক উপস্থিতি", "Daily attendance")}</div>
          <AttendanceStrip m={m} days={30} now={now} />
          <p className={styles.hint} style={{ marginTop: 6 }}>
            {tx("সবুজ = উপস্থিত · লাল = অনুপস্থিত · ধূসর = দেননি (গত ৩০ দিন)", "Green = present · red = absent · grey = not marked (last 30 days)")}
          </p>

          <div className={ui.section}>
            <div className={ui.sectionHead}>
              {tx("মামলা ও হালনাগাদ", "Cases & updates")} ({m.cases.length})
            </div>
            {m.cases.length === 0 ? <p className={styles.hint}>{tx("চলমান মামলা নেই।", "No active cases.")}</p> : null}
            <div className={ui.rows}>
              {m.cases.map((r) => (
                <Row key={r.s.assignmentId} label={r.a.caseId ?? r.a.applicationId}>
                  <a href={`#app/${r.a.applicationId}`}>{r.a.data.applicant.fullName ?? "—"}</a>
                  <Tag>{label(MATTERS, r.a.data.matter.category, lang)}</Tag>
                  {r.s.status === "OFFERED" ? <Tag tone="warn">{tx("প্রস্তাব — উত্তর বাকি", "Offer — awaiting answer")}</Tag> : null}
                  {r.overdue ? <Tag tone="err">{tx(`${r.overdue} প্রতিবেদন দেরি`, `${r.overdue} overdue`)}</Tag> : null}
                  {r.due ? <Tag tone="warn">{tx(`${r.due} বাকি`, `${r.due} due`)}</Tag> : null}
                  {r.missed ? <Tag tone="err">{tx(`${r.missed} মিস`, `${r.missed} missed`)}</Tag> : null}
                  <span className={ui.sub}>
                    {tx("পরবর্তী শুনানি", "Next hearing")}: {r.nextHearing ? `${formatDateTime(r.nextHearing.at, lang)} · ${r.nextHearing.court}` : "—"}
                    {" · "}
                    {tx("শেষ হালনাগাদ", "Last update")}: {r.lastUpdate ? `${formatDateTime(r.lastUpdate.at, lang)} — ${pretty(r.lastUpdate.attendance)}, ${pretty(r.lastUpdate.outcome)}: “${r.lastUpdate.note}”` : tx("এখনো নেই", "none yet")}
                  </span>
                </Row>
              ))}
            </div>
            {m.pastCases.length ? (
              <>
                <div className={ui.sectionHead} style={{ marginTop: "var(--s-4)" }}>
                  {tx("আগের মামলা", "Earlier cases")}
                </div>
                <div className={ui.rows}>
                  {m.pastCases.map((r) => (
                    <Row key={r.s.assignmentId} label={r.a.caseId ?? r.a.applicationId}>
                      <Tag tone={r.s.status === "COMPLETED" ? "ok" : "warn"}>{pretty(r.s.status)}</Tag>
                      <span className={ui.sub}>
                        {tx(`উপস্থিত ${r.s.ledger.hearingsAttended} · মিস ${r.s.ledger.hearingsMissed}`, `Attended ${r.s.ledger.hearingsAttended} · missed ${r.s.ledger.hearingsMissed}`)}
                        {r.s.payment ? ` · ${pretty(r.s.payment.status)}` : ""}
                      </span>
                    </Row>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className={ui.section}>
            <div className={ui.sectionHead}>{tx("যোগাযোগের ইতিহাস", "Contact history")}</div>
            {contacts.length === 0 ? <p className={styles.hint}>{tx("এখনো কোনো ফোন, তলব বা বার্তা নেই।", "No calls, summons or messages yet.")}</p> : null}
            <div className={ui.rows}>
              {contacts.map((c) => (
                <ContactRow key={c.contactId} lawyerId={m.l.lawyerId} c={c} run={run} />
              ))}
            </div>
          </div>
        </section>

        <aside className={ui.aside}>
          <CallBox lawyerId={m.l.lawyerId} phone={m.l.phone} cases={caseOptions} run={run} />
          <SummonBox lawyerId={m.l.lawyerId} cases={caseOptions} run={run} />
          <RemindBox lawyerId={m.l.lawyerId} cases={caseOptions} run={run} />
        </aside>
      </div>
    </>
  );
}

type RunFn = (fn: () => void, ok: string) => void;
type CaseOpt = { applicationId: string; caseId: string | null };

function CaseSelect({ value, onChange, cases }: { value: string; onChange: (v: string) => void; cases: CaseOpt[] }) {
  const { tx } = useTx();
  return (
    <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{tx("নির্দিষ্ট মামলা নয়", "Not about one case")}</option>
      {cases.map((a) => (
        <option key={a.applicationId} value={a.applicationId}>
          {a.caseId ?? a.applicationId}
        </option>
      ))}
    </select>
  );
}

function CallBox({ lawyerId, phone, cases, run }: { lawyerId: string; phone: string; cases: CaseOpt[]; run: RunFn }) {
  const { tx } = useTx();
  const [outcome, setOutcome] = useState<"REACHED" | "NO_ANSWER" | "WRONG_NUMBER">("REACHED");
  const [note, setNote] = useState("");
  const [app, setApp] = useState("");
  return (
    <div className={ui.panel}>
      <div className={ui.panelTitle}>
        <span>📞 {tx("ফোন", "Call")}</span>
      </div>
      <a className={styles.mono} href={`tel:${phone}`}>
        {phone}
      </a>
      <p className={styles.hint}>{tx("ফোনটি আপনার ফোন থেকে করুন, তারপর ফল রেকর্ড করুন।", "Call from your phone, then record what happened.")}</p>
      <label className={styles.field}>
        <span className={styles.label}>{tx("ফল", "Result")}</span>
        <select className={styles.select} value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
          <option value="REACHED">{tx("কথা হয়েছে", "Reached")}</option>
          <option value="NO_ANSWER">{tx("ধরেননি", "No answer")}</option>
          <option value="WRONG_NUMBER">{tx("ভুল নম্বর", "Wrong number")}</option>
        </select>
      </label>
      <label className={styles.field} style={{ marginTop: 8 }}>
        <span className={styles.label}>{tx("মামলা", "Case")}</span>
        <CaseSelect value={app} onChange={setApp} cases={cases} />
      </label>
      <label className={styles.field} style={{ marginTop: 8 }}>
        <span className={styles.label}>{tx("নোট", "Notes")}</span>
        <input className={styles.input} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className={styles.actions} style={{ marginTop: 10 }}>
        <Button
          variant="secondary"
          onClick={() =>
            run(() => {
              DlaoLawyerMonitor.logCall(lawyerId, { outcome, note, applicationId: app || null });
              setNote("");
            }, tx("ফোনের রেকর্ড সংরক্ষিত।", "Call logged."))
          }
        >
          {tx("ফোন রেকর্ড করুন", "Log call")}
        </Button>
      </div>
    </div>
  );
}

function SummonBox({ lawyerId, cases, run }: { lawyerId: string; cases: CaseOpt[]; run: RunFn }) {
  const { tx } = useTx();
  const { officer } = useDistrictLawyers();
  const [at, setAt] = useState("");
  const [place, setPlace] = useState(officer?.district ? `DLAO-${officer.district} office` : "Legal aid office");
  const [reason, setReason] = useState("");
  const [app, setApp] = useState("");
  return (
    <div className={ui.panel}>
      <div className={ui.panelTitle}>
        <span>📋 {tx("অফিসে তলব", "Summon to office")}</span>
      </div>
      <label className={styles.field}>
        <span className={styles.label}>{tx("কখন", "When")}</span>
        <input className={styles.input} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
      </label>
      <label className={styles.field} style={{ marginTop: 8 }}>
        <span className={styles.label}>{tx("কোথায়", "Where")}</span>
        <input className={styles.input} value={place} onChange={(e) => setPlace(e.target.value)} />
      </label>
      <label className={styles.field} style={{ marginTop: 8 }}>
        <span className={styles.label}>{tx("মামলা", "Case")}</span>
        <CaseSelect value={app} onChange={setApp} cases={cases} />
      </label>
      <label className={styles.field} style={{ marginTop: 8 }}>
        <span className={styles.label}>{tx("কারণ (কমপক্ষে ১০ অক্ষর)", "Reason (at least 10 characters)")}</span>
        <textarea className={styles.textarea} style={{ minHeight: 70 }} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className={styles.actions} style={{ marginTop: 10 }}>
        <Button
          disabled={!at || reason.trim().length < 10}
          onClick={() =>
            run(() => {
              DlaoLawyerMonitor.summon(lawyerId, { appearAt: at, place, reason, applicationId: app || null });
              setReason("");
              setAt("");
            }, tx("তলব পাঠানো হয়েছে (এসএমএস সিমুলেটেড)।", "Summons sent (SMS simulated)."))
          }
        >
          {tx("তলব পাঠান", "Send summons")}
        </Button>
      </div>
    </div>
  );
}

function RemindBox({ lawyerId, cases, run }: { lawyerId: string; cases: CaseOpt[]; run: RunFn }) {
  const { tx } = useTx();
  const [text, setText] = useState("");
  const [app, setApp] = useState("");
  return (
    <div className={ui.panel}>
      <div className={ui.panelTitle}>
        <span>✉ {tx("বার্তা / রিমাইন্ডার", "Message / reminder")}</span>
      </div>
      <label className={styles.field}>
        <span className={styles.label}>{tx("মামলা", "Case")}</span>
        <CaseSelect value={app} onChange={setApp} cases={cases} />
      </label>
      <label className={styles.field} style={{ marginTop: 8 }}>
        <span className={styles.label}>{tx("বার্তা", "Message")}</span>
        <textarea className={styles.textarea} style={{ minHeight: 70 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={tx("যেমন: গতকালের শুনানির প্রতিবেদন দিন", "e.g. Please file yesterday's hearing report")} />
      </label>
      <div className={styles.actions} style={{ marginTop: 10 }}>
        <Button
          variant="secondary"
          disabled={text.trim().length < 5}
          onClick={() =>
            run(() => {
              DlaoLawyerMonitor.remind(lawyerId, { message: text, applicationId: app || null });
              setText("");
            }, tx("বার্তা পাঠানো হয়েছে (এসএমএস সিমুলেটেড)।", "Message sent (SMS simulated)."))
          }
        >
          {tx("পাঠান", "Send")}
        </Button>
      </div>
    </div>
  );
}

function ContactRow({ lawyerId, c, run }: { lawyerId: string; c: LawyerContact; run: RunFn }) {
  const { lang, tx } = useTx();
  const [note, setNote] = useState("");
  const kind = c.kind === "CALL" ? tx("ফোন", "Call") : c.kind === "SUMMONS" ? tx("তলব", "Summons") : tx("বার্তা", "Message");
  const statusTone: Tone = c.status === "ATTENDED" || c.status === "ACKNOWLEDGED" ? "ok" : c.status === "MISSED" ? "err" : c.status === "SENT" ? "warn" : "neutral";
  return (
    <Row label={formatDateTime(c.at, lang)}>
      <Tag tone="ink">{kind}</Tag>
      {c.kind === "CALL" ? <Tag tone={c.callOutcome === "REACHED" ? "ok" : "err"}>{pretty(c.callOutcome ?? "")}</Tag> : <Tag tone={statusTone}>{pretty(c.status)}</Tag>}
      {c.applicationId ? <a href={`#app/${c.applicationId}`} className={styles.mono}>{c.applicationId}</a> : null}
      <span className={ui.sub}>
        {c.kind === "SUMMONS" && c.appearAt ? `${formatDateTime(c.appearAt, lang)} · ${c.place} · ` : ""}
        {c.note ? `“${c.note}”` : ""} · {c.byName}
        {c.acknowledgedAt ? ` · ${tx("আইনজীবী দেখেছেন", "seen by lawyer")} ${formatDateTime(c.acknowledgedAt, lang)}` : ""}
        {c.resolutionNote ? ` · ${c.resolutionNote}` : ""}
      </span>
      {c.kind === "SUMMONS" && (c.status === "SENT" || c.status === "ACKNOWLEDGED") ? (
        <div style={{ flexBasis: "100%", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input className={styles.input} style={{ maxWidth: 260 }} placeholder={tx("নোট (ঐচ্ছিক)", "Note (optional)")} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button variant="secondary" onClick={() => run(() => DlaoLawyerMonitor.resolveSummons(lawyerId, c.contactId, { result: "ATTENDED", note }), tx("উপস্থিতি রেকর্ড হয়েছে।", "Recorded as attended."))}>
            {tx("এসেছেন", "Attended")}
          </Button>
          <Button variant="destructive" onClick={() => run(() => DlaoLawyerMonitor.resolveSummons(lawyerId, c.contactId, { result: "MISSED", note }), tx("অনুপস্থিতি রেকর্ড হয়েছে।", "Recorded as not attended."))}>
            {tx("আসেননি", "Did not come")}
          </Button>
        </div>
      ) : null}
    </Row>
  );
}
